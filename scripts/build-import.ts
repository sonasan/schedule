// One-off generator: turns the week-of-5/31 CSV into a ready-to-use
// schedule.json (matching the app's StoreShape). Run with: tsx scripts/build-import.ts
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShiftCell, parseStationCell } from '../shared/parser.ts';
import { DEFAULT_STATIONS, DEFAULT_DAY_HOURS } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CSV = `,5/31,6/1/2026,6/2,6/3,6/4,6/5,6/6
TEAM,SUN,MON ,TUE,WED,THU,FRI- ,SAT
Tony,4.30- to 8,OPEN TO 7.30 OR 8,OPEN TO 7.30 ,OPEN TO 7.30 and truck,OPEN,OPEN TO 7.30 OR 8,OFF
Kareem,7 TO 12,7 to 12,OFF,ON CALL,6.45 TO 12,6   TO 12,4.15 to 12
SONAL,off,OPEN,OPEN,OPEN,open,OPEN,open
Sandip,off,OPEN,OPEN,OPEN,OPEN,OPEN,open
PARAS,OPEN to 10,4:00 to 1,4 to 1,4 to 1,4 to 1,4 TO 1,OFF
TABITHA,off,Off,on call,On call,Off,Off,
MARISSA,open,4 to 12,4 to 12,4 to 12,4 to 12,4 to 12,off
RENE,off,4.45 to 11:30,5 to 12,4:30 to 10,OPEN  to 10,Off,Off
RASHMINA,OPEN ,OFF,4 to 12,4 to 12,4 to 12,4 to 12,OPEN TO 12:30
ANGELITA,7 to 12,OFF,OFF,OFF,off,OFF,Off
Lizbeth,8 TO 12.30/1,On call,ON CALL,On call,On call,Thank you,OFF
,,,,,,,
MINTUBEN,7 to 12,5 TO 12,5 to 12,5 to 12,off,5:30 to 12,6 to 12
RANJANBEN,OFF, 5 to 1,5 to 1,OFF,OFF,OFF,OFF
AGNA,OFF,5 to 9,5.30 to 9,5.30 to 9,5 to 9,CALL?,off
ADA,6.30 to 12,OfF,6:00 to 12:30,6.30 TO 12,6  TO  11.30/12,6 to 12,Off
TANKA,9 to 5,ON CALL,6 to 9,6 to 4,7 to 3,9 to 5,6 to 4/5
yessey,On Call,OFF,OFF,OFF,OFF,off,off
Nicolas,Off,OFF,OFF,OFF,OFF,off,OFF
KEIRY,   8 TO 2,OFF,OFF,7 TO 1,7 TO 1,7 to 1,7 TO 2
Dara,9  to 3,10/11 to close,9  TO 5/6,9 TO 5,7 to 3,Off,8  TO 3
Sabrina,8:30 to 12,7 to 12,Off,8.45 to 12,8.45 TO 12,ON CALL,6 to 12.30
Angel,11:30 TO CLOSE,12 TO CLOSE,off,2 TO CLOSE,ON CALL,1 TO CLOSE,8 to 4 OR 4.30
BalA,1 to close,12 to close,1:30 to close,1 TO CLOSE,On call,7 to 5,8 to 3
LIZBEL,8 to 5/6,6 to 2,OFF,12 to close(Cake),12 TO CLOSE,7- 4 ,"4.00 TO 1,then cake "
CHRISTOPHER,On call,ON CALL,5 TO CLOSE,5 TO CLOSE,On call,4:30 to close,4  to close
BRANDON,On call,4.30 TO Cl ,OFF,,4 TO  CLOSE,ON CALL,CALL
Kristian,1 TO CLOSE,OFF,1 TO CLOSE,OFF,3 to close,3 TO CLOSE, 3 to close
GINO,ON CALL,OFF,OFF,OFF,OFF,OFF,ON CALL
KRISTEL,1 TO CLOSE,OFF,1 TO CLOSE,OFF,3 to close,3 to close,3 to close
JIAN,,off,off,off,off,OFF,12 to close
,,,,,,,
FRONT,RASHMINA,Sonal/Agna,RASHMINA/AGNA,RASHMINA/,RASHMINA,RASHMINA/SONAL,RASHMINA
DT ORDER,Dara,Paras,Paras/Dara,Dara,DARA,PARAS,DARA
DT CASH,KARIM,Karim,SANDIP,SANDIP,KARIM,KARIM,KARIM
TAP/OUTSIDE,SABRINA,Lizbell,MINTUBEN,MINTUBEN,SONAL,Bala,Bala
LABEL,ADA,Rene,Rene,Rene,,ADA,Sabrina
HOT,MINTUBEN,mintuben/Agna,AGNA,AGNA/SONAL,AGNA/SABRINA,mintuben,mintuben
LATTE/FROZEN,LIZBETH,LIZBEL/Sabrina,Ada/Sabrina,Ada/Sabrina,RENE,Lizbell,ANGEL
DOORDASH/UBER/,PARAS,Sandip,SONAL,Sonal,SONAL,Nishil if available ,SONAL
EXPEDITER,LIZBELL,Sandip/Paras,PARAS,PARAS(Truck),PARAS,SANDIP,SANDIP
SAND,MARISSA,MARISSA,MARISSA,MARISSA,MARISSA,MARISSA,Tanka
SAND 2,keiry,RANJAN,Ranjan,KEIRY,KEIRY,KEIRY,KEIRY
SAND 3,Angelita,Sonal,Tanka/Sonal,TANKA(Truck),TANKA,TANKA,LIZBELL
CAKE,,,,,,,`;

// --- tiny CSV parser (handles quoted fields) ---
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  row.push(field); rows.push(row);
  return rows;
}

// Canonical roster (display names), in the order they appear in the sheet.
const ROSTER = [
  'Tony', 'Kareem', 'Sonal', 'Sandip', 'Paras', 'Tabitha', 'Marissa', 'Rene',
  'Rashmina', 'Angelita', 'Lizbeth', 'Mintuben', 'Ranjanben', 'Agna', 'Ada',
  'Tanka', 'Yessey', 'Nicolas', 'Keiry', 'Dara', 'Sabrina', 'Angel', 'Bala',
  'Lizbel', 'Christopher', 'Brandon', 'Kristian', 'Gino', 'Kristel', 'Jian',
];

// Maps every spelling found in the sheet to a canonical name.
const ALIAS: Record<string, string> = {
  tony: 'Tony', kareem: 'Kareem', karim: 'Kareem',
  sonal: 'Sonal', sandip: 'Sandip', paras: 'Paras',
  tabitha: 'Tabitha', tabi: 'Tabitha', marissa: 'Marissa', rene: 'Rene',
  rashmina: 'Rashmina', angelita: 'Angelita', lizbeth: 'Lizbeth',
  mintuben: 'Mintuben', mintu: 'Mintuben', ranjanben: 'Ranjanben', ranjan: 'Ranjanben',
  agna: 'Agna', ada: 'Ada', tanka: 'Tanka', yessey: 'Yessey', nicolas: 'Nicolas',
  keiry: 'Keiry', dara: 'Dara', sabrina: 'Sabrina', angel: 'Angel', bala: 'Bala',
  lizbel: 'Lizbel', lizbell: 'Lizbel',
  christopher: 'Christopher', chris: 'Christopher',
  brandon: 'Brandon', branden: 'Brandon', brenden: 'Brandon',
  kristian: 'Kristian', gino: 'Gino', kristel: 'Kristel', jian: 'Jian',
};

const idByName = new Map<string, number>();
ROSTER.forEach((n, i) => idByName.set(n, i + 1));
function resolveEmp(raw: string): number | null {
  const key = raw.trim().toLowerCase();
  const canon = ALIAS[key];
  return canon ? idByName.get(canon)! : null;
}

// Station name normalization -> default station.
const stationByName = new Map<string, number>();
DEFAULT_STATIONS.forEach((s, i) => stationByName.set(s.name.toUpperCase(), i + 1));
function resolveStation(raw: string): { id: number; days: number[]; name: string } | null {
  let key = raw.trim().replace(/\/+$/, '').toUpperCase(); // drop trailing slashes
  if (key === 'DOORDASH/UBER' || key === 'DOORDASH' || key === 'UBER') key = 'DELIVERY';
  if (key === 'SAND') key = 'SAND 1';
  const id = stationByName.get(key);
  if (!id) return null;
  const def = DEFAULT_STATIONS[id - 1];
  return { id, days: def.days, name: def.name };
}

// Light cleanup of messy shift cells before parsing.
function cleanShift(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/-\s*to\b/gi, ' to')          // "4.30- to" -> "4.30 to"
    .replace(/(\d)\s*-\s+(\d)/g, '$1 to $2') // "7- 4" -> "7 to 4"
    .replace(/\bto\s+cl\b/gi, 'to close')   // "to Cl" -> "to close"
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const rows = parseCsv(CSV);
const dayCols = [1, 2, 3, 4, 5, 6, 7];

// Locate the station block (first row whose col0 resolves to a station).
let stationStart = rows.length;
for (let r = 2; r < rows.length; r++) {
  const first = rows[r][0]?.trim();
  if (first && resolveStation(first)) { stationStart = r; break; }
}

const dayHours = DEFAULT_DAY_HOURS;

const shifts: any[] = [];
let shiftId = 0;
for (let r = 2; r < stationStart; r++) {
  const name = rows[r][0]?.trim();
  if (!name) continue;
  const empId = resolveEmp(name);
  if (!empId) { console.warn('Unmatched team member:', name); continue; }
  for (let d = 0; d < 7; d++) {
    const raw = (rows[r][dayCols[d]] ?? '').trim();
    if (!raw) continue;
    const ctx = { openMinutes: dayHours[d].open, closeMinutes: dayHours[d].close };
    const parsed = parseShiftCell(cleanShift(raw), ctx);
    if (!parsed) continue;
    shifts.push({
      id: ++shiftId, weekId: 1, employeeId: empId, dayIndex: d,
      state: parsed.state, startMinutes: parsed.startMinutes, endMinutes: parsed.endMinutes,
      endUncertain: parsed.endUncertain, note: parsed.note, rawText: raw,
      needsReview: parsed.needsReview, reviewReason: parsed.reviewReason,
    });
  }
}

const assignments: any[] = [];
const affinity = new Map<string, number>();
let assignId = 0;
let droppedWeekday = 0;
for (let r = stationStart; r < rows.length; r++) {
  const rawName = rows[r][0]?.trim();
  if (!rawName) continue;
  const station = resolveStation(rawName);
  if (!station) continue;
  for (let d = 0; d < 7; d++) {
    const raw = (rows[r][dayCols[d]] ?? '').trim();
    if (!raw) continue;
    // Respect the store rule: DELIVERY & SAND 3 are weekend-only.
    const weekday = d >= 1 && d <= 5;
    if (!station.days.includes(d)) { if (weekday) droppedWeekday++; continue; }
    const { names, note } = parseStationCell(raw);
    const ids: number[] = [];
    for (const n of names.slice(0, 2)) {
      const id = resolveEmp(n);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (ids.length === 0) continue;
    assignments.push({ id: ++assignId, weekId: 1, dayIndex: d, stationId: station.id, employeeIds: ids, note });
    for (const id of ids) {
      const k = `${id}:${station.id}`;
      affinity.set(k, (affinity.get(k) ?? 0) + 1);
    }
  }
}

const store = {
  meta: { employee: ROSTER.length, station: DEFAULT_STATIONS.length, week: 1, shift: shiftId, assignment: assignId },
  settings: { openMinutes: 240, closeMinutes: 1200, weekStartDay: 0, dayHours: dayHours.map((h) => ({ ...h })) },
  employees: ROSTER.map((name, i) => ({ id: i + 1, name, active: true, crew: 'ANY', usualStations: [], notes: '' })),
  stations: DEFAULT_STATIONS.map((s, i) => ({ id: i + 1, name: s.name, order: s.order, allowsSplit: s.allowsSplit, requiredDaily: s.requiredDaily, days: [...s.days] })),
  weeks: [{ id: 1, startDate: '2026-05-31' }],
  shifts,
  assignments,
  affinity: [...affinity.entries()].map(([k, weight]) => { const [e, s] = k.split(':').map(Number); return { employeeId: e, stationId: s, weight }; }),
};

const out = join(__dirname, '..', 'schedule.json');
writeFileSync(out, JSON.stringify(store, null, 2));
console.log(`Wrote ${out}`);
console.log(`employees=${store.employees.length} shifts=${shifts.length} assignments=${assignId} affinity=${store.affinity.length} (dropped ${droppedWeekday} weekday DELIVERY/SAND3 cells)`);
