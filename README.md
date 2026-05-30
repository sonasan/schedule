# Shift & Station Scheduler

A local, single-user web app that replaces a spreadsheet-based weekly schedule
for a quick-service / fast-food store. Runs entirely on your machine — no
accounts, no cloud, no deployment. Works equally well on a phone and a
computer/tablet.

## What it does

It's a **two-layer** scheduler:

- **Layer 1 — Shifts.** For each employee, every day is a *state*: `OFF`,
  `ON CALL`, `OPEN` (store opening time), `CLOSE` (store closing time), or a
  `TIMED` shift with explicit start/end. Cells can carry a note ("Truck",
  "Cake") and an uncertain end ("5/6").
- **Layer 2 — Station assignments.** Each day has a fixed list of stations
  (FRONT, DT ORDER, HOT, SAND 1…). Each station is assigned to one or two
  working employees.

The critical rule the app enforces: **you can only assign someone to a station
on a day they're actually working.** Off-shift staff are never assignable;
on-call staff can be assigned but are flagged as tentative.

## Features

- **CSV importer** for the manager's existing messy spreadsheet, with a
  post-import **review screen** listing anything that couldn't be parsed
  cleanly. The bundled `sample-schedule.csv` seeds the database on first run.
- **Week view** (desktop): two stacked grids (staff × days, stations × days)
  with sticky headers, color-coded shift states, and a quick editor.
- **Day view** (mobile): one day at a time with large tap targets and a
  bottom-sheet editor.
- **Full-assist auto-suggest**: proposes station assignments from each day's
  working pool, using preferred roles + learned affinity, and **learns** every
  time you confirm or override an assignment.
- **Live coverage & conflict panel**: uncovered required stations, unassigned
  workers, off-but-assigned (blocked), on-call assigned, missing opener/closer,
  and uncertain shifts.
- **Copy previous week**, **CSV/JSON export**, and a clean **print view**.
- Editable employees, stations, and store settings (open/close times, week
  start day).

## Running it

Requires Node 18+ (developed on Node 22).

```bash
npm install
npm run dev
```

This starts both the API (Express + SQLite, port 3001) and the web app
(Vite, port 5173) together via `concurrently`. Open:

**http://localhost:5173**

On first run the database (`schedule.db`) is created and seeded from
`sample-schedule.csv`, so the app boots with realistic data.

### Other commands

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Run API + web together (development)          |
| `npm run build`    | Type-check and build the production frontend  |
| `npm run typecheck`| Type-check only                               |
| `npm run start`    | Run the API server once (no watch)            |

## How it's built

- **Frontend:** React + TypeScript + Vite + Tailwind CSS.
- **Backend:** Node + Express + `better-sqlite3`, writing to a local
  `schedule.db` file (so data survives restarts).
- **Shared logic** (`shared/`): the parser, time helpers, coverage checks, and
  the auto-suggest algorithm are pure functions reused by both the server
  (import/seed) and the client (live recompute).

### Project layout

```
server/        Express API, SQLite schema, CSV importer
shared/        Types + pure logic (parser, time, coverage, suggest)
src/           React app (components, store, API client)
sample-schedule.csv   Seed data imported on first run
```

## Data & backup

All data lives in `schedule.db` in the project root. To back up, copy that
file. To start fresh, delete it — the app reseeds from the sample CSV on the
next launch. (It's git-ignored so your data never gets committed.)

## CSV format

```
Row 1: (blank), date, date, …           (one per day column)
Row 2: NAME, SUN, MON, TUE, WED, THU, FRI, SAT
Rows : employee name, then a shift cell per day
(blank row)
Rows : station name, then assignee(s) per day  ("Sonal/Agna" splits a station)
```

The importer is deliberately defensive — it understands `OPEN to 10`,
`1 to close`, `4.30 to 12` (dots = colons), `5/6` (uncertain end), `OfF`,
`call?`, parenthetical notes like `PARAS(Truck)`, and normalizes
`DOORDASH/UBER` → `DELIVERY` and `SAND` → `SAND 1`. Anything ambiguous is
imported best-effort and surfaced on the review screen.
