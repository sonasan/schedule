// Shared domain types used by both the Express backend and the React frontend.

export type ShiftState = 'OFF' | 'ON_CALL' | 'OPEN' | 'CLOSE' | 'TIMED' | 'UNKNOWN';

export type Crew = 'MORNING' | 'CLOSING' | 'ANY';

export interface Employee {
  id: number;
  name: string;
  active: boolean;
  crew: Crew;
  usualStations: number[]; // ordered station ids (preferred roles)
  notes: string;
}

export interface Station {
  id: number;
  name: string;
  order: number;
  allowsSplit: boolean;
  requiredDaily: boolean;
}

export interface Week {
  id: number;
  startDate: string; // ISO date (the week-start day)
}

export interface Shift {
  id: number;
  weekId: number;
  employeeId: number;
  dayIndex: number; // 0 = first day of week … 6
  state: ShiftState;
  startMinutes: number | null;
  endMinutes: number | null;
  endUncertain: boolean;
  note: string;
  rawText: string;
  needsReview: boolean;
  reviewReason: string;
}

export interface Assignment {
  id: number;
  weekId: number;
  dayIndex: number;
  stationId: number;
  employeeIds: number[]; // 1–2 employees
  note: string;
}

export interface Settings {
  openMinutes: number; // store opening time
  closeMinutes: number; // store closing time
  weekStartDay: number; // 0 = Sunday … 6 = Saturday
}

export interface Affinity {
  employeeId: number;
  stationId: number;
  weight: number;
}

// ---- Importer / coverage helper shapes ----

export interface ImportIssue {
  kind: 'shift' | 'station';
  employeeName?: string;
  stationName?: string;
  dayIndex: number;
  rawText: string;
  reason: string;
}

export interface ImportReport {
  weekId: number;
  employeesCreated: string[];
  shiftsImported: number;
  assignmentsImported: number;
  issues: ImportIssue[];
}

export type IssueSeverity = 'error' | 'warning' | 'caution' | 'info';

export interface CoverageIssue {
  severity: IssueSeverity;
  dayIndex: number;
  stationId?: number;
  employeeId?: number;
  code: string;
  message: string;
}

export interface SuggestionProposal {
  stationId: number;
  employeeIds: number[];
  note: string;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default station list (used when seeding a fresh database).
export const DEFAULT_STATIONS: Array<Omit<Station, 'id'>> = [
  { name: 'FRONT', order: 0, allowsSplit: true, requiredDaily: true },
  { name: 'DT ORDER', order: 1, allowsSplit: true, requiredDaily: true },
  { name: 'DT CASH', order: 2, allowsSplit: true, requiredDaily: true },
  { name: 'TAP/OUTSIDE', order: 3, allowsSplit: true, requiredDaily: false },
  { name: 'LABEL', order: 4, allowsSplit: true, requiredDaily: false },
  { name: 'HOT', order: 5, allowsSplit: true, requiredDaily: true },
  { name: 'LATTE/FROZEN', order: 6, allowsSplit: true, requiredDaily: false },
  { name: 'DELIVERY', order: 7, allowsSplit: true, requiredDaily: false },
  { name: 'EXPEDITER', order: 8, allowsSplit: true, requiredDaily: false },
  { name: 'SAND 1', order: 9, allowsSplit: true, requiredDaily: true },
  { name: 'SAND 2', order: 10, allowsSplit: true, requiredDaily: false },
  { name: 'SAND 3', order: 11, allowsSplit: true, requiredDaily: false },
  { name: 'CAKE', order: 12, allowsSplit: true, requiredDaily: false },
];
