import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, initSchema, isDatabaseEmpty } from './db.ts';
import * as repo from './repo.ts';
import { importCsv } from './importer.ts';
import { addDays } from '../shared/time.ts';
import type { Assignment, Shift } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

initSchema();

// Seed the DB from the bundled sample CSV the first time the app boots.
function seedIfEmpty(): void {
  if (!isDatabaseEmpty()) return;
  const samplePath = join(__dirname, '..', 'sample-schedule.csv');
  if (!existsSync(samplePath)) return;
  try {
    const csv = readFileSync(samplePath, 'utf8');
    const report = importCsv(csv, repo.getSettings());
    console.log(
      `Seeded from sample-schedule.csv: ${report.shiftsImported} shifts, ` +
        `${report.assignmentsImported} assignments, ${report.employeesCreated.length} employees.`,
    );
  } catch (err) {
    console.error('Failed to seed from sample CSV:', err);
  }
}
seedIfEmpty();

// --- helper to wrap handlers ---
const h =
  (fn: (req: express.Request, res: express.Response) => void) =>
  (req: express.Request, res: express.Response) => {
    try {
      fn(req, res);
    } catch (err: any) {
      console.error(err);
      res.status(400).json({ error: err?.message ?? 'Bad request' });
    }
  };

// ---- Settings ----
app.get('/api/settings', h((_req, res) => res.json(repo.getSettings())));
app.put(
  '/api/settings',
  h((req, res) => res.json(repo.updateSettings(req.body))),
);

// ---- Employees ----
app.get('/api/employees', h((_req, res) => res.json(repo.listEmployees())));
app.post(
  '/api/employees',
  h((req, res) => res.status(201).json(repo.createEmployee(req.body))),
);
app.put(
  '/api/employees/:id',
  h((req, res) => {
    const updated = repo.updateEmployee(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  }),
);

// ---- Stations ----
app.get('/api/stations', h((_req, res) => res.json(repo.listStations())));
app.post(
  '/api/stations',
  h((req, res) => res.status(201).json(repo.createStation(req.body))),
);
app.put(
  '/api/stations/:id',
  h((req, res) => {
    const updated = repo.updateStation(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  }),
);
app.delete(
  '/api/stations/:id',
  h((req, res) => {
    repo.deleteStation(Number(req.params.id));
    res.status(204).end();
  }),
);

// ---- Affinity ----
app.get('/api/affinity', h((_req, res) => res.json(repo.listAffinity())));

// ---- Weeks ----
app.get('/api/weeks', h((_req, res) => res.json(repo.listWeeks())));
app.post(
  '/api/weeks',
  h((req, res) => {
    const { startDate } = req.body;
    if (!startDate) return res.status(400).json({ error: 'startDate required' });
    res.status(201).json(repo.getOrCreateWeek(startDate));
  }),
);

// Full week bundle: week + shifts + assignments (the primary read for the UI).
app.get(
  '/api/weeks/:id/data',
  h((req, res) => {
    const id = Number(req.params.id);
    const week = repo.getWeek(id);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    res.json({
      week,
      shifts: repo.listShifts(id),
      assignments: repo.listAssignments(id),
    });
  }),
);

// ---- Shifts ----
app.put(
  '/api/weeks/:id/shifts',
  h((req, res) => {
    const weekId = Number(req.params.id);
    const body = req.body as Partial<Shift> & {
      employeeId: number;
      dayIndex: number;
      state: Shift['state'];
    };
    // OFF/UNKNOWN: clear the assignment side too? No — just store the shift.
    const saved = repo.upsertShift({
      weekId,
      employeeId: body.employeeId,
      dayIndex: body.dayIndex,
      state: body.state,
      startMinutes: body.startMinutes ?? null,
      endMinutes: body.endMinutes ?? null,
      endUncertain: !!body.endUncertain,
      note: body.note ?? '',
      rawText: body.rawText ?? '',
      needsReview: !!body.needsReview,
      reviewReason: body.reviewReason ?? '',
    });
    res.json(saved);
  }),
);

app.delete(
  '/api/weeks/:id/shifts',
  h((req, res) => {
    const weekId = Number(req.params.id);
    const { employeeId, dayIndex } = req.body;
    repo.deleteShift(weekId, Number(employeeId), Number(dayIndex));
    res.status(204).end();
  }),
);

// ---- Assignments ----
app.put(
  '/api/weeks/:id/assignments',
  h((req, res) => {
    const weekId = Number(req.params.id);
    const body = req.body as Pick<Assignment, 'dayIndex' | 'stationId' | 'employeeIds' | 'note'>;

    // Enforce Layer-1 -> Layer-2 rule: no OFF/UNKNOWN employee may be assigned.
    const shifts = repo.listShifts(weekId);
    for (const empId of body.employeeIds ?? []) {
      const shift = shifts.find((s) => s.dayIndex === body.dayIndex && s.employeeId === empId);
      if (!shift || shift.state === 'OFF' || shift.state === 'UNKNOWN') {
        const name = repo.getEmployee(empId)?.name ?? `#${empId}`;
        return res.status(409).json({
          error: `${name} is not working that day and cannot be assigned.`,
          code: 'NOT_WORKING',
        });
      }
    }

    const saved = repo.upsertAssignment({
      weekId,
      dayIndex: body.dayIndex,
      stationId: body.stationId,
      employeeIds: body.employeeIds ?? [],
      note: body.note ?? '',
    });

    // Learn: bump affinity for each assigned employee/station pair.
    for (const empId of body.employeeIds ?? []) {
      repo.bumpAffinity(empId, body.stationId, 1);
    }

    res.json(saved);
  }),
);

// ---- Copy previous week ----
app.post(
  '/api/weeks/:id/copy-from/:sourceId',
  h((req, res) => {
    const targetId = Number(req.params.id);
    const sourceId = Number(req.params.sourceId);
    const target = repo.getWeek(targetId);
    const source = repo.getWeek(sourceId);
    if (!target || !source) return res.status(404).json({ error: 'Week not found' });

    const copyShifts = req.body?.shifts !== false;
    const copyAssignments = req.body?.assignments === true;

    const tx = db.transaction(() => {
      if (copyShifts) {
        for (const s of repo.listShifts(sourceId)) {
          repo.upsertShift({ ...s, weekId: targetId });
        }
      }
      if (copyAssignments) {
        for (const a of repo.listAssignments(sourceId)) {
          repo.upsertAssignment({ ...a, weekId: targetId });
        }
      }
    });
    tx();

    res.json({
      week: target,
      shifts: repo.listShifts(targetId),
      assignments: repo.listAssignments(targetId),
    });
  }),
);

// ---- Import CSV (paste/upload) ----
app.post(
  '/api/import',
  h((req, res) => {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || !csv.trim()) {
      return res.status(400).json({ error: 'csv (string) required in body' });
    }
    const report = importCsv(csv, repo.getSettings());
    res.json(report);
  }),
);

// ---- Export (JSON / CSV) ----
app.get(
  '/api/weeks/:id/export.json',
  h((req, res) => {
    const id = Number(req.params.id);
    const week = repo.getWeek(id);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    res.json({
      week,
      settings: repo.getSettings(),
      employees: repo.listEmployees(),
      stations: repo.listStations(),
      shifts: repo.listShifts(id),
      assignments: repo.listAssignments(id),
    });
  }),
);

app.get(
  '/api/weeks/:id/export.csv',
  h((req, res) => {
    const id = Number(req.params.id);
    const week = repo.getWeek(id);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    const csv = buildExportCsv(id, week.startDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="week-${week.startDate}.csv"`);
    res.send(csv);
  }),
);

function buildExportCsv(weekId: number, startDate: string): string {
  const employees = repo.listEmployees();
  const stations = repo.listStations();
  const shifts = repo.listShifts(weekId);
  const assignments = repo.listAssignments(weekId);
  const empById = new Map(employees.map((e) => [e.id, e]));

  const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const rows: string[][] = [];
  rows.push(['', ...Array.from({ length: 7 }, (_, d) => addDays(startDate, d))]);
  rows.push(['NAME', ...dayLabels]);

  // Render shift cells from their raw text when available, else a friendly form.
  for (const emp of employees) {
    const row = [emp.name];
    for (let d = 0; d < 7; d++) {
      const s = shifts.find((x) => x.employeeId === emp.id && x.dayIndex === d);
      row.push(s ? s.rawText || s.state : '');
    }
    rows.push(row);
  }

  rows.push([]);
  for (const st of stations) {
    const row = [st.name];
    for (let d = 0; d < 7; d++) {
      const a = assignments.find((x) => x.stationId === st.id && x.dayIndex === d);
      const names = (a?.employeeIds ?? []).map((id) => empById.get(id)?.name ?? '').filter(Boolean);
      row.push(names.join('/'));
    }
    rows.push(row);
  }

  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Scheduler API listening on http://localhost:${PORT}`);
});
