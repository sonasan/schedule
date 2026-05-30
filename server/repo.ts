// Data-access layer over the in-memory JSON store. Every mutator schedules a
// debounced flush to disk. Function signatures match what index.ts/importer.ts
// expect, so the rest of the server is storage-agnostic.

import { store, save, nextId } from './db.ts';
import { ALL_DAYS } from '../shared/types.ts';
import type {
  Affinity,
  Assignment,
  Employee,
  Settings,
  Shift,
  Station,
  Week,
} from '../shared/types.ts';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// ---- Settings ----

export function getSettings(): Settings {
  return { ...store.settings };
}

export function updateSettings(s: Partial<Settings>): Settings {
  store.settings = { ...store.settings, ...s };
  save();
  return { ...store.settings };
}

// ---- Employees ----

export function listEmployees(includeInactive = true): Employee[] {
  return store.employees
    .filter((e) => includeInactive || e.active)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map(clone);
}

export function getEmployee(id: number): Employee | undefined {
  const e = store.employees.find((x) => x.id === id);
  return e ? clone(e) : undefined;
}

export function findEmployeeByName(name: string): Employee | undefined {
  const target = name.trim().toLowerCase();
  const e = store.employees.find((x) => x.name.trim().toLowerCase() === target);
  return e ? clone(e) : undefined;
}

export function createEmployee(data: Partial<Employee> & { name: string }): Employee {
  const emp: Employee = {
    id: nextId('employee'),
    name: data.name.trim(),
    active: data.active === false ? false : true,
    crew: data.crew || 'ANY',
    usualStations: data.usualStations || [],
    notes: data.notes || '',
  };
  store.employees.push(emp);
  save();
  return clone(emp);
}

export function updateEmployee(id: number, data: Partial<Employee>): Employee | undefined {
  const e = store.employees.find((x) => x.id === id);
  if (!e) return undefined;
  Object.assign(e, {
    name: data.name ?? e.name,
    active: data.active ?? e.active,
    crew: data.crew ?? e.crew,
    usualStations: data.usualStations ?? e.usualStations,
    notes: data.notes ?? e.notes,
  });
  save();
  return clone(e);
}

// ---- Stations ----

export function listStations(): Station[] {
  return store.stations
    .slice()
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map(clone);
}

export function getStation(id: number): Station | undefined {
  const s = store.stations.find((x) => x.id === id);
  return s ? clone(s) : undefined;
}

export function createStation(data: Partial<Station> & { name: string }): Station {
  const maxOrder = store.stations.reduce((m, s) => Math.max(m, s.order), -1);
  const station: Station = {
    id: nextId('station'),
    name: data.name.trim(),
    order: data.order ?? maxOrder + 1,
    allowsSplit: data.allowsSplit === false ? false : true,
    requiredDaily: data.requiredDaily ?? false,
    days: data.days ?? [...ALL_DAYS],
  };
  store.stations.push(station);
  save();
  return clone(station);
}

export function updateStation(id: number, data: Partial<Station>): Station | undefined {
  const s = store.stations.find((x) => x.id === id);
  if (!s) return undefined;
  Object.assign(s, {
    name: data.name ?? s.name,
    order: data.order ?? s.order,
    allowsSplit: data.allowsSplit ?? s.allowsSplit,
    requiredDaily: data.requiredDaily ?? s.requiredDaily,
    days: data.days ?? s.days,
  });
  save();
  return clone(s);
}

export function deleteStation(id: number): void {
  store.stations = store.stations.filter((s) => s.id !== id);
  // Cascade: drop assignments and affinity that referenced the station.
  store.assignments = store.assignments.filter((a) => a.stationId !== id);
  store.affinity = store.affinity.filter((a) => a.stationId !== id);
  save();
}

// ---- Weeks ----

export function listWeeks(): Week[] {
  return store.weeks
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
    .map(clone);
}

export function getWeek(id: number): Week | undefined {
  const w = store.weeks.find((x) => x.id === id);
  return w ? clone(w) : undefined;
}

export function getOrCreateWeek(startDate: string): Week {
  const existing = store.weeks.find((w) => w.startDate === startDate);
  if (existing) return clone(existing);
  const week: Week = { id: nextId('week'), startDate };
  store.weeks.push(week);
  save();
  return clone(week);
}

// ---- Shifts ----

export function listShifts(weekId: number): Shift[] {
  return store.shifts.filter((s) => s.weekId === weekId).map(clone);
}

export function upsertShift(s: Omit<Shift, 'id'>): Shift {
  const existing = store.shifts.find(
    (x) => x.weekId === s.weekId && x.employeeId === s.employeeId && x.dayIndex === s.dayIndex,
  );
  if (existing) {
    Object.assign(existing, s);
    save();
    return clone(existing);
  }
  const shift: Shift = { id: nextId('shift'), ...s };
  store.shifts.push(shift);
  save();
  return clone(shift);
}

export function deleteShift(weekId: number, employeeId: number, dayIndex: number): void {
  store.shifts = store.shifts.filter(
    (s) => !(s.weekId === weekId && s.employeeId === employeeId && s.dayIndex === dayIndex),
  );
  save();
}

// ---- Assignments ----

export function listAssignments(weekId: number): Assignment[] {
  return store.assignments.filter((a) => a.weekId === weekId).map(clone);
}

export function upsertAssignment(a: Omit<Assignment, 'id'>): Assignment {
  // Empty employee list -> remove the assignment entirely.
  if (!a.employeeIds || a.employeeIds.length === 0) {
    store.assignments = store.assignments.filter(
      (x) => !(x.weekId === a.weekId && x.dayIndex === a.dayIndex && x.stationId === a.stationId),
    );
    save();
    return { id: -1, ...a, note: a.note || '' };
  }
  const existing = store.assignments.find(
    (x) => x.weekId === a.weekId && x.dayIndex === a.dayIndex && x.stationId === a.stationId,
  );
  if (existing) {
    existing.employeeIds = a.employeeIds;
    existing.note = a.note || '';
    save();
    return clone(existing);
  }
  const assignment: Assignment = { id: nextId('assignment'), ...a, note: a.note || '' };
  store.assignments.push(assignment);
  save();
  return clone(assignment);
}

// ---- Affinity ----

export function listAffinity(): Affinity[] {
  return store.affinity.map(clone);
}

export function bumpAffinity(employeeId: number, stationId: number, delta = 1): void {
  const existing = store.affinity.find(
    (a) => a.employeeId === employeeId && a.stationId === stationId,
  );
  if (existing) existing.weight += delta;
  else store.affinity.push({ employeeId, stationId, weight: delta });
  save();
}

export function getAffinityMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of store.affinity) map.set(`${a.employeeId}:${a.stationId}`, a.weight);
  return map;
}
