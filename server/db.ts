// Zero-dependency JSON-file persistence. Chosen over a native SQLite binding so
// `npm install` needs no compiler/toolchain and works the same on every OS.
// Data lives in schedule.json next to the project; back it up by copying that
// file, reset by deleting it (it re-seeds from sample-schedule.csv).

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_STATIONS, type Settings } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, '..', 'schedule.json');

// Stored rows mirror the domain types (camelCase); no row mapping needed.
export interface StoreShape {
  meta: { employee: number; station: number; week: number; shift: number; assignment: number };
  settings: Settings;
  employees: any[];
  stations: any[];
  weeks: any[];
  shifts: any[];
  assignments: any[];
  affinity: any[];
}

function emptyStore(): StoreShape {
  return {
    meta: { employee: 0, station: 0, week: 0, shift: 0, assignment: 0 },
    settings: { openMinutes: 240, closeMinutes: 1380, weekStartDay: 0 },
    employees: [],
    stations: [],
    weeks: [],
    shifts: [],
    assignments: [],
    affinity: [],
  };
}

export const store: StoreShape = emptyStore();

let saveQueued = false;

export function save(): void {
  // Coalesce rapid writes into one flush on the next tick.
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    flush();
  });
}

export function flush(): void {
  const tmp = DB_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, DB_PATH); // atomic replace
}

export function nextId(kind: keyof StoreShape['meta']): number {
  store.meta[kind] += 1;
  return store.meta[kind];
}

// Load from disk (if present) and ensure defaults exist.
export function initStore(): void {
  if (existsSync(DB_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(DB_PATH, 'utf8'));
      Object.assign(store, emptyStore(), parsed);
    } catch (err) {
      console.error('Could not read schedule.json, starting fresh:', err);
      Object.assign(store, emptyStore());
    }
  }

  // Seed default stations only when none exist.
  if (store.stations.length === 0) {
    for (const s of DEFAULT_STATIONS) {
      store.stations.push({
        id: nextId('station'),
        name: s.name,
        order: s.order,
        allowsSplit: s.allowsSplit,
        requiredDaily: s.requiredDaily,
      });
    }
  }
  flush();
}

export function isStoreEmpty(): boolean {
  return store.employees.length === 0;
}
