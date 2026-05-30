import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_STATIONS } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'schedule.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      crew TEXT NOT NULL DEFAULT 'ANY',
      usual_stations TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      allows_split INTEGER NOT NULL DEFAULT 1,
      required_daily INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      day_index INTEGER NOT NULL,
      state TEXT NOT NULL,
      start_minutes INTEGER,
      end_minutes INTEGER,
      end_uncertain INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      raw_text TEXT NOT NULL DEFAULT '',
      needs_review INTEGER NOT NULL DEFAULT 0,
      review_reason TEXT NOT NULL DEFAULT '',
      UNIQUE(week_id, employee_id, day_index)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      day_index INTEGER NOT NULL,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      employee_ids TEXT NOT NULL DEFAULT '[]',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(week_id, day_index, station_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      open_minutes INTEGER NOT NULL DEFAULT 240,
      close_minutes INTEGER NOT NULL DEFAULT 1380,
      week_start_day INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS affinity (
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      weight INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (employee_id, station_id)
    );
  `);

  // Seed singleton settings row.
  db.prepare(
    `INSERT OR IGNORE INTO settings (id, open_minutes, close_minutes, week_start_day)
     VALUES (1, 240, 1380, 0)`,
  ).run();

  // Seed default stations only when none exist.
  const stationCount = db.prepare('SELECT COUNT(*) AS c FROM stations').get() as { c: number };
  if (stationCount.c === 0) {
    const insert = db.prepare(
      `INSERT INTO stations (name, "order", allows_split, required_daily)
       VALUES (@name, @order, @allowsSplit, @requiredDaily)`,
    );
    const seed = db.transaction(() => {
      for (const s of DEFAULT_STATIONS) {
        insert.run({
          name: s.name,
          order: s.order,
          allowsSplit: s.allowsSplit ? 1 : 0,
          requiredDaily: s.requiredDaily ? 1 : 0,
        });
      }
    });
    seed();
  }
}

export function isDatabaseEmpty(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS c FROM employees').get() as { c: number };
  return row.c === 0;
}
