import { db } from './db.ts';
import type {
  Affinity,
  Assignment,
  Crew,
  Employee,
  Settings,
  Shift,
  ShiftState,
  Station,
  Week,
} from '../shared/types.ts';

// ---- Row mappers ----

function mapEmployee(r: any): Employee {
  return {
    id: r.id,
    name: r.name,
    active: !!r.active,
    crew: r.crew as Crew,
    usualStations: JSON.parse(r.usual_stations || '[]'),
    notes: r.notes || '',
  };
}

function mapStation(r: any): Station {
  return {
    id: r.id,
    name: r.name,
    order: r.order,
    allowsSplit: !!r.allows_split,
    requiredDaily: !!r.required_daily,
  };
}

function mapShift(r: any): Shift {
  return {
    id: r.id,
    weekId: r.week_id,
    employeeId: r.employee_id,
    dayIndex: r.day_index,
    state: r.state as ShiftState,
    startMinutes: r.start_minutes,
    endMinutes: r.end_minutes,
    endUncertain: !!r.end_uncertain,
    note: r.note || '',
    rawText: r.raw_text || '',
    needsReview: !!r.needs_review,
    reviewReason: r.review_reason || '',
  };
}

function mapAssignment(r: any): Assignment {
  return {
    id: r.id,
    weekId: r.week_id,
    dayIndex: r.day_index,
    stationId: r.station_id,
    employeeIds: JSON.parse(r.employee_ids || '[]'),
    note: r.note || '',
  };
}

// ---- Settings ----

export function getSettings(): Settings {
  const r = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  return {
    openMinutes: r.open_minutes,
    closeMinutes: r.close_minutes,
    weekStartDay: r.week_start_day,
  };
}

export function updateSettings(s: Partial<Settings>): Settings {
  const current = getSettings();
  const next = { ...current, ...s };
  db.prepare(
    `UPDATE settings SET open_minutes = @openMinutes, close_minutes = @closeMinutes,
     week_start_day = @weekStartDay WHERE id = 1`,
  ).run(next);
  return next;
}

// ---- Employees ----

export function listEmployees(includeInactive = true): Employee[] {
  const rows = db
    .prepare(
      `SELECT * FROM employees ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY name COLLATE NOCASE`,
    )
    .all();
  return rows.map(mapEmployee);
}

export function getEmployee(id: number): Employee | undefined {
  const r = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  return r ? mapEmployee(r) : undefined;
}

export function findEmployeeByName(name: string): Employee | undefined {
  const r = db
    .prepare('SELECT * FROM employees WHERE name = ? COLLATE NOCASE')
    .get(name.trim());
  return r ? mapEmployee(r) : undefined;
}

export function createEmployee(data: Partial<Employee> & { name: string }): Employee {
  const info = db
    .prepare(
      `INSERT INTO employees (name, active, crew, usual_stations, notes)
       VALUES (@name, @active, @crew, @usualStations, @notes)`,
    )
    .run({
      name: data.name.trim(),
      active: data.active === false ? 0 : 1,
      crew: data.crew || 'ANY',
      usualStations: JSON.stringify(data.usualStations || []),
      notes: data.notes || '',
    });
  return getEmployee(Number(info.lastInsertRowid))!;
}

export function updateEmployee(id: number, data: Partial<Employee>): Employee | undefined {
  const cur = getEmployee(id);
  if (!cur) return undefined;
  const next = { ...cur, ...data };
  db.prepare(
    `UPDATE employees SET name = @name, active = @active, crew = @crew,
     usual_stations = @usualStations, notes = @notes WHERE id = @id`,
  ).run({
    id,
    name: next.name,
    active: next.active ? 1 : 0,
    crew: next.crew,
    usualStations: JSON.stringify(next.usualStations),
    notes: next.notes,
  });
  return getEmployee(id);
}

// ---- Stations ----

export function listStations(): Station[] {
  return db.prepare('SELECT * FROM stations ORDER BY "order", id').all().map(mapStation);
}

export function getStation(id: number): Station | undefined {
  const r = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  return r ? mapStation(r) : undefined;
}

export function createStation(data: Partial<Station> & { name: string }): Station {
  const maxOrder = db.prepare('SELECT COALESCE(MAX("order"), -1) AS m FROM stations').get() as {
    m: number;
  };
  const info = db
    .prepare(
      `INSERT INTO stations (name, "order", allows_split, required_daily)
       VALUES (@name, @order, @allowsSplit, @requiredDaily)`,
    )
    .run({
      name: data.name.trim(),
      order: data.order ?? maxOrder.m + 1,
      allowsSplit: data.allowsSplit === false ? 0 : 1,
      requiredDaily: data.requiredDaily ? 1 : 0,
    });
  return getStation(Number(info.lastInsertRowid))!;
}

export function updateStation(id: number, data: Partial<Station>): Station | undefined {
  const cur = getStation(id);
  if (!cur) return undefined;
  const next = { ...cur, ...data };
  db.prepare(
    `UPDATE stations SET name = @name, "order" = @order, allows_split = @allowsSplit,
     required_daily = @requiredDaily WHERE id = @id`,
  ).run({
    id,
    name: next.name,
    order: next.order,
    allowsSplit: next.allowsSplit ? 1 : 0,
    requiredDaily: next.requiredDaily ? 1 : 0,
  });
  return getStation(id);
}

export function deleteStation(id: number): void {
  db.prepare('DELETE FROM stations WHERE id = ?').run(id);
}

// ---- Weeks ----

export function listWeeks(): Week[] {
  return db
    .prepare('SELECT * FROM weeks ORDER BY start_date DESC')
    .all()
    .map((r: any) => ({ id: r.id, startDate: r.start_date }));
}

export function getWeek(id: number): Week | undefined {
  const r = db.prepare('SELECT * FROM weeks WHERE id = ?').get(id) as any;
  return r ? { id: r.id, startDate: r.start_date } : undefined;
}

export function getOrCreateWeek(startDate: string): Week {
  const existing = db.prepare('SELECT * FROM weeks WHERE start_date = ?').get(startDate) as any;
  if (existing) return { id: existing.id, startDate: existing.start_date };
  const info = db.prepare('INSERT INTO weeks (start_date) VALUES (?)').run(startDate);
  return { id: Number(info.lastInsertRowid), startDate };
}

// ---- Shifts ----

export function listShifts(weekId: number): Shift[] {
  return db.prepare('SELECT * FROM shifts WHERE week_id = ?').all(weekId).map(mapShift);
}

export function upsertShift(s: Omit<Shift, 'id'>): Shift {
  db.prepare(
    `INSERT INTO shifts (week_id, employee_id, day_index, state, start_minutes, end_minutes,
       end_uncertain, note, raw_text, needs_review, review_reason)
     VALUES (@weekId, @employeeId, @dayIndex, @state, @startMinutes, @endMinutes,
       @endUncertain, @note, @rawText, @needsReview, @reviewReason)
     ON CONFLICT(week_id, employee_id, day_index) DO UPDATE SET
       state = excluded.state, start_minutes = excluded.start_minutes,
       end_minutes = excluded.end_minutes, end_uncertain = excluded.end_uncertain,
       note = excluded.note, raw_text = excluded.raw_text,
       needs_review = excluded.needs_review, review_reason = excluded.review_reason`,
  ).run({
    weekId: s.weekId,
    employeeId: s.employeeId,
    dayIndex: s.dayIndex,
    state: s.state,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    endUncertain: s.endUncertain ? 1 : 0,
    note: s.note,
    rawText: s.rawText,
    needsReview: s.needsReview ? 1 : 0,
    reviewReason: s.reviewReason,
  });
  const r = db
    .prepare('SELECT * FROM shifts WHERE week_id = ? AND employee_id = ? AND day_index = ?')
    .get(s.weekId, s.employeeId, s.dayIndex);
  return mapShift(r);
}

export function deleteShift(weekId: number, employeeId: number, dayIndex: number): void {
  db.prepare('DELETE FROM shifts WHERE week_id = ? AND employee_id = ? AND day_index = ?').run(
    weekId,
    employeeId,
    dayIndex,
  );
}

// ---- Assignments ----

export function listAssignments(weekId: number): Assignment[] {
  return db
    .prepare('SELECT * FROM assignments WHERE week_id = ?')
    .all(weekId)
    .map(mapAssignment);
}

export function upsertAssignment(a: Omit<Assignment, 'id'>): Assignment {
  // Empty employee list -> remove the assignment row entirely.
  if (!a.employeeIds || a.employeeIds.length === 0) {
    db.prepare(
      'DELETE FROM assignments WHERE week_id = ? AND day_index = ? AND station_id = ?',
    ).run(a.weekId, a.dayIndex, a.stationId);
    return { id: -1, ...a };
  }
  db.prepare(
    `INSERT INTO assignments (week_id, day_index, station_id, employee_ids, note)
     VALUES (@weekId, @dayIndex, @stationId, @employeeIds, @note)
     ON CONFLICT(week_id, day_index, station_id) DO UPDATE SET
       employee_ids = excluded.employee_ids, note = excluded.note`,
  ).run({
    weekId: a.weekId,
    dayIndex: a.dayIndex,
    stationId: a.stationId,
    employeeIds: JSON.stringify(a.employeeIds),
    note: a.note || '',
  });
  const r = db
    .prepare('SELECT * FROM assignments WHERE week_id = ? AND day_index = ? AND station_id = ?')
    .get(a.weekId, a.dayIndex, a.stationId);
  return mapAssignment(r);
}

// ---- Affinity ----

export function listAffinity(): Affinity[] {
  return db
    .prepare('SELECT * FROM affinity')
    .all()
    .map((r: any) => ({ employeeId: r.employee_id, stationId: r.station_id, weight: r.weight }));
}

export function bumpAffinity(employeeId: number, stationId: number, delta = 1): void {
  db.prepare(
    `INSERT INTO affinity (employee_id, station_id, weight) VALUES (?, ?, ?)
     ON CONFLICT(employee_id, station_id) DO UPDATE SET weight = weight + ?`,
  ).run(employeeId, stationId, delta, delta);
}

export function getAffinityMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of listAffinity()) map.set(`${a.employeeId}:${a.stationId}`, a.weight);
  return map;
}
