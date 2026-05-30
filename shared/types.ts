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
  days: number[]; // day indices (0=Sun … 6=Sat) on which this station is active
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

export interface DayHours {
  open: number; // minutes since midnight
  close: number;
}

export interface Settings {
  openMinutes: number; // default opening time (used by the CSV importer)
  closeMinutes: number; // default closing time
  weekStartDay: number; // 0 = Sunday … 6 = Saturday
  dayHours: DayHours[]; // per-day store hours, indexed by dayIndex (length 7)
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
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri
export const WEEKENDS = [0, 6]; // Sun, Sat

// The store's actual hours: weekdays 4:00 AM–8:00 PM, Saturday 4:30 AM–8:00 PM,
// Sunday 5:00 AM–8:00 PM. Indexed by dayIndex (0=Sun … 6=Sat).
export const DEFAULT_DAY_HOURS: DayHours[] = [
  { open: 5 * 60, close: 20 * 60 }, // Sun  5:00 AM – 8:00 PM
  { open: 4 * 60, close: 20 * 60 }, // Mon  4:00 AM – 8:00 PM
  { open: 4 * 60, close: 20 * 60 }, // Tue
  { open: 4 * 60, close: 20 * 60 }, // Wed
  { open: 4 * 60, close: 20 * 60 }, // Thu
  { open: 4 * 60, close: 20 * 60 }, // Fri
  { open: 4 * 60 + 30, close: 20 * 60 }, // Sat 4:30 AM – 8:00 PM
];

// Effective open/close for a given day, falling back to the global default.
export function hoursForDay(settings: Settings, dayIndex: number): DayHours {
  return (
    settings.dayHours?.[dayIndex] ?? {
      open: settings.openMinutes,
      close: settings.closeMinutes,
    }
  );
}

// Default station list (used when seeding a fresh store). DELIVERY and SAND 3
// run on weekends only — eliminated on weekdays per the store's setup.
export const DEFAULT_STATIONS: Array<Omit<Station, 'id'>> = [
  { name: 'FRONT', order: 0, allowsSplit: true, requiredDaily: true, days: ALL_DAYS },
  { name: 'DT ORDER', order: 1, allowsSplit: true, requiredDaily: true, days: ALL_DAYS },
  { name: 'DT CASH', order: 2, allowsSplit: true, requiredDaily: true, days: ALL_DAYS },
  { name: 'TAP/OUTSIDE', order: 3, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
  { name: 'LABEL', order: 4, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
  { name: 'HOT', order: 5, allowsSplit: true, requiredDaily: true, days: ALL_DAYS },
  { name: 'LATTE/FROZEN', order: 6, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
  { name: 'DELIVERY', order: 7, allowsSplit: true, requiredDaily: false, days: WEEKENDS },
  { name: 'EXPEDITER', order: 8, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
  { name: 'SAND 1', order: 9, allowsSplit: true, requiredDaily: true, days: ALL_DAYS },
  { name: 'SAND 2', order: 10, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
  { name: 'SAND 3', order: 11, allowsSplit: true, requiredDaily: false, days: WEEKENDS },
  { name: 'CAKE', order: 12, allowsSplit: true, requiredDaily: false, days: ALL_DAYS },
];

// The store's current roster (used when seeding a fresh store).
export const DEFAULT_ROSTER: string[] = [
  'Tony', 'Kareem', 'Sonal', 'Sandip', 'Paras', 'Tabi', 'Marissa', 'Rene',
  'Rashmina', 'Angelita', 'Lizbeth', 'Mintu', 'Ranjan', 'Agna', 'Ada', 'Tanka',
  'Keiry', 'Dara', 'Sabrina', 'Angel', 'Bala', 'Lizbell', 'Chris', 'Brenden',
  'Kristian', 'Kristel', 'Jian',
];
