// CSV importer. Ingests the manager's messy spreadsheet export into the DB.
//
// Layout:
//   Row 1: dates per column (col 0 blank/label)
//   Row 2: day-of-week labels (SUN..SAT)
//   Rows: employee names + their daily shift cells
//   (blank row)  -> possibly more employees
//   (blank row)  -> station block: col 0 = station name, day cols = assignee(s)

import { parseShiftCell, parseStationCell } from '../shared/parser.ts';
import type { ImportIssue, ImportReport, Settings } from '../shared/types.ts';
import * as repo from './repo.ts';

// Minimal RFC-4180-ish CSV parser (handles quoted fields & commas).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const STATION_ALIASES: Record<string, string> = {
  'DOORDASH/UBER': 'DELIVERY',
  DOORDASH: 'DELIVERY',
  UBER: 'DELIVERY',
  SAND: 'SAND 1',
};

function normalizeStationName(name: string): string {
  const key = name.trim().toUpperCase();
  return STATION_ALIASES[key] ?? name.trim();
}

function isBlankRow(row: string[]): boolean {
  return row.every((c) => c.trim() === '');
}

// Decide which rows are the station block: a contiguous tail of rows whose first
// cell matches a known/normalized station name. Everything before is employees.
function findStationStart(rows: string[][], dataStart: number, stationNames: Set<string>): number {
  for (let i = dataStart; i < rows.length; i++) {
    const first = rows[i][0]?.trim();
    if (!first) continue;
    if (stationNames.has(normalizeStationName(first).toUpperCase())) return i;
  }
  return rows.length;
}

export function importCsv(csvText: string, settings: Settings): ImportReport {
  const rows = parseCsv(csvText).filter((r) => r.length > 1 || r[0]?.trim());
  const issues: ImportIssue[] = [];

  if (rows.length < 3) {
    throw new Error('CSV does not have enough rows (need dates, day labels, and data).');
  }

  // Row 1 = dates, Row 2 = day labels. Day columns are 1..7.
  const dateRow = rows[0];
  const dayCols = [1, 2, 3, 4, 5, 6, 7];

  // Determine the week start date from the first date column, falling back to
  // "most recent week-start day" if the cell isn't a parseable date.
  const startDate = resolveStartDate(dateRow[1], settings.weekStartDay);
  const week = repo.getOrCreateWeek(startDate);

  const stationNameSet = new Set(repo.listStations().map((s) => s.name.toUpperCase()));
  // Include alias targets so DELIVERY/SAND 1 are recognized.
  for (const v of Object.values(STATION_ALIASES)) stationNameSet.add(v.toUpperCase());

  const stationStart = findStationStart(rows, 2, stationNameSet);

  const employeesCreated: string[] = [];
  let shiftsImported = 0;
  let assignmentsImported = 0;

  const ctx = { openMinutes: settings.openMinutes, closeMinutes: settings.closeMinutes };

  function resolveEmployee(name: string): number {
    const trimmed = name.trim();
    const existing = repo.findEmployeeByName(trimmed);
    if (existing) return existing.id;
    const created = repo.createEmployee({ name: trimmed });
    employeesCreated.push(trimmed);
    return created.id;
  }

  // ---- Employee / shift rows ----
  for (let r = 2; r < stationStart; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue;
    const name = row[0]?.trim();
    if (!name) continue;
    const employeeId = resolveEmployee(name);

    for (let d = 0; d < 7; d++) {
      const raw = (row[dayCols[d]] ?? '').trim();
      if (!raw) continue; // empty -> no shift record
      const parsed = parseShiftCell(raw, ctx);
      if (!parsed) continue;
      repo.upsertShift({
        weekId: week.id,
        employeeId,
        dayIndex: d,
        state: parsed.state,
        startMinutes: parsed.startMinutes,
        endMinutes: parsed.endMinutes,
        endUncertain: parsed.endUncertain,
        note: parsed.note,
        rawText: raw,
        needsReview: parsed.needsReview,
        reviewReason: parsed.reviewReason,
      });
      shiftsImported++;
      if (parsed.needsReview) {
        issues.push({
          kind: 'shift',
          employeeName: name,
          dayIndex: d,
          rawText: raw,
          reason: parsed.reviewReason,
        });
      }
    }
  }

  // ---- Station rows ----
  const stationsByName = new Map(
    repo.listStations().map((s) => [s.name.toUpperCase(), s] as const),
  );

  for (let r = stationStart; r < rows.length; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue;
    const rawStationName = row[0]?.trim();
    if (!rawStationName) continue;
    const normalized = normalizeStationName(rawStationName);
    const station = stationsByName.get(normalized.toUpperCase());
    if (!station) {
      issues.push({
        kind: 'station',
        stationName: rawStationName,
        dayIndex: -1,
        rawText: rawStationName,
        reason: `Unknown station "${rawStationName}" — skipped.`,
      });
      continue;
    }

    for (let d = 0; d < 7; d++) {
      const raw = (row[dayCols[d]] ?? '').trim();
      if (!raw) continue;
      const { names, note } = parseStationCell(raw);
      if (names.length === 0) continue;
      const employeeIds = names.slice(0, 2).map((n) => resolveEmployee(n));

      repo.upsertAssignment({
        weekId: week.id,
        dayIndex: d,
        stationId: station.id,
        employeeIds,
        note,
      });
      assignmentsImported++;

      // Flag assignments that conflict with a non-working shift.
      const shifts = repo.listShifts(week.id);
      for (const empId of employeeIds) {
        const shift = shifts.find((s) => s.dayIndex === d && s.employeeId === empId);
        if (!shift || shift.state === 'OFF' || shift.state === 'UNKNOWN') {
          const empName = repo.getEmployee(empId)?.name ?? '';
          issues.push({
            kind: 'station',
            employeeName: empName,
            stationName: station.name,
            dayIndex: d,
            rawText: raw,
            reason: `${empName} assigned to ${station.name} but not scheduled to work.`,
          });
        }
      }
    }
  }

  return {
    weekId: week.id,
    employeesCreated,
    shiftsImported,
    assignmentsImported,
    issues,
  };
}

// Try to read a date from the header cell; otherwise compute the most recent
// occurrence of the configured week-start day.
function resolveStartDate(cell: string | undefined, weekStartDay: number): string {
  const raw = (cell ?? '').trim();
  if (raw) {
    // Accept M/D, M/D/YY, M/D/YYYY, or ISO.
    const iso = /^\d{4}-\d{2}-\d{2}$/.exec(raw);
    if (iso) return raw;
    const md = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(raw);
    if (md) {
      const month = Number(md[1]);
      const day = Number(md[2]);
      let year = md[3] ? Number(md[3]) : new Date().getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  // Fallback: most recent week-start day on/before today.
  const today = new Date();
  const diff = (today.getDay() - weekStartDay + 7) % 7;
  today.setDate(today.getDate() - diff);
  return today.toISOString().slice(0, 10);
}
