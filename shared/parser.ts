// Defensive parser for the messy shift-cell strings found in the manager's CSV.
// Pure functions only (no DB), so they can be unit-tested and reused client-side.

import type { ShiftState } from './types.ts';

export interface ParsedShift {
  state: ShiftState;
  startMinutes: number | null;
  endMinutes: number | null;
  endUncertain: boolean;
  note: string;
  needsReview: boolean;
  reviewReason: string;
}

export interface ParseContext {
  openMinutes: number;
  closeMinutes: number;
}

const MAX_SHIFT_MINUTES = 14 * 60;

// Pull "Truck" / "Cake" notes and any parenthetical text out of the cell,
// returning the cleaned time portion plus the collected note.
function extractNote(raw: string): { text: string; note: string } {
  const notes: string[] = [];
  let text = raw;

  // Parenthetical content -> note.
  text = text.replace(/\(([^)]*)\)/g, (_m, inner) => {
    const trimmed = String(inner).trim();
    if (trimmed) notes.push(trimmed);
    return ' ';
  });

  // Standalone keyword notes, optionally joined with "and"/"then"/"&".
  text = text.replace(/\b(?:and|then|&)?\s*(truck|cake)\b/gi, (_m, word) => {
    notes.push(capitalize(String(word)));
    return ' ';
  });

  return { text: text.replace(/\s+/g, ' ').trim(), note: dedupe(notes).join(', ') };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

// Parse a single clock token. Dots and colons both mean ":". Returns raw hour
// (1–12 or 0–23) and minute, plus whether a period was explicitly stated.
interface RawTime {
  hour: number;
  minute: number;
  period: 'am' | 'pm' | null;
}

function parseClock(token: string): RawTime | null {
  const t = token.trim().toLowerCase();
  const m = /^(\d{1,2})(?:[.:](\d{1,2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  let period: 'am' | 'pm' | null = null;
  if (m[3]) period = m[3].startsWith('a') ? 'am' : 'pm';
  return { hour, minute, period };
}

// An end token may carry an uncertain alternative: "5/6", "8 OR 4.30", "12.30/1".
function parseEndToken(token: string): { time: RawTime | null; uncertain: boolean } {
  const parts = token.split(/\s*(?:\/|\bor\b)\s*/i).filter((p) => p.trim());
  if (parts.length === 0) return { time: null, uncertain: false };
  const first = parseClock(parts[0]);
  return { time: first, uncertain: parts.length > 1 };
}

// Resolve a "start" raw time to absolute minutes using AM/PM heuristics.
function resolveStart(t: RawTime): number {
  if (t.period) return to24(t.hour, t.period) * 60 + t.minute;
  // The store opens early and closes late. Starts 4–11 read as AM; 12 = noon;
  // 1–3 read as PM (e.g. "1 to close" = 1 PM).
  let hour = t.hour;
  if (hour === 12) {
    hour = 12; // noon
  } else if (hour >= 1 && hour <= 3) {
    hour += 12; // afternoon start
  }
  return hour * 60 + t.minute;
}

function to24(hour12: number, period: 'am' | 'pm'): number {
  if (period === 'am') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

// Resolve an "end" raw time relative to a known start, preferring the
// interpretation that yields a positive shift of reasonable length.
function resolveEnd(
  t: RawTime,
  startMinutes: number | null,
): { minutes: number; confident: boolean } {
  if (t.period) {
    return { minutes: to24(t.hour, t.period) * 60 + t.minute, confident: true };
  }
  const amCandidate = (t.hour === 12 ? 0 : t.hour) * 60 + t.minute;
  const pmCandidate = (t.hour === 12 ? 12 : t.hour + 12) * 60 + t.minute;
  const noonCandidate = 12 * 60 + t.minute; // for "12" meaning noon
  const candidates = t.hour === 12 ? [noonCandidate] : [amCandidate, pmCandidate];

  if (startMinutes === null) {
    // No start to anchor against; assume afternoon/evening end.
    return { minutes: t.hour === 12 ? noonCandidate : pmCandidate, confident: false };
  }

  const valid = candidates
    .map((minutes) => ({ minutes, dur: minutes - startMinutes }))
    .filter((c) => c.dur > 0 && c.dur <= MAX_SHIFT_MINUTES)
    .sort((a, b) => a.dur - b.dur);

  if (valid.length > 0) return { minutes: valid[0].minutes, confident: true };

  // Nothing fits cleanly: pick the candidate that at least keeps end > start.
  const positive = candidates
    .map((minutes) => ({ minutes, dur: minutes - startMinutes }))
    .filter((c) => c.dur > 0)
    .sort((a, b) => a.dur - b.dur);
  if (positive.length > 0) return { minutes: positive[0].minutes, confident: false };
  return { minutes: candidates[candidates.length - 1], confident: false };
}

export function parseShiftCell(raw: string, ctx: ParseContext): ParsedShift | null {
  const original = (raw ?? '').trim();
  if (!original) return null; // empty cell -> no record

  const base: ParsedShift = {
    state: 'UNKNOWN',
    startMinutes: null,
    endMinutes: null,
    endUncertain: false,
    note: '',
    needsReview: false,
    reviewReason: '',
  };

  const { text, note } = extractNote(original);
  base.note = note;
  const lower = text.toLowerCase();

  // OFF (also matches "off" embedded after note removal).
  if (/^off\b/.test(lower) || lower === 'off') {
    return { ...base, state: 'OFF' };
  }

  // ON CALL: "on call", "call", "call?".
  if (/\bon\s*call\b/.test(lower) || /^call\??$/.test(lower)) {
    return { ...base, state: 'ON_CALL' };
  }

  // OPEN: starts with "open"; optional "to X" end.
  if (/^open\b/.test(lower)) {
    const result: ParsedShift = { ...base, state: 'OPEN', startMinutes: ctx.openMinutes };
    const toMatch = /to\s+(.+)$/i.exec(text.replace(/^open/i, '').trim());
    if (toMatch) {
      const { time, uncertain } = parseEndToken(toMatch[1]);
      if (time) {
        const end = resolveEnd(time, ctx.openMinutes);
        result.endMinutes = end.minutes;
        result.endUncertain = uncertain || !end.confident;
        if (!end.confident) {
          result.needsReview = true;
          result.reviewReason = 'Ambiguous open-shift end time';
        }
      } else {
        result.needsReview = true;
        result.reviewReason = `Could not parse open end: "${toMatch[1]}"`;
      }
    }
    return result;
  }

  // CLOSE: contains "close"; optional "X to close" start.
  if (/\bclose\b/.test(lower)) {
    const result: ParsedShift = { ...base, state: 'CLOSE', endMinutes: null };
    const startMatch = /^(.+?)\s+to\s+close/i.exec(text);
    if (startMatch) {
      const start = parseClock(startMatch[1]);
      if (start) {
        result.startMinutes = resolveStart(start);
      } else {
        result.needsReview = true;
        result.reviewReason = `Could not parse close start: "${startMatch[1]}"`;
      }
    }
    return result;
  }

  // Explicit range "A to B".
  const range = /^(.+?)\s+to\s+(.+)$/i.exec(text);
  if (range) {
    const start = parseClock(range[1]);
    const { time: endTime, uncertain } = parseEndToken(range[2]);
    if (start && endTime) {
      const startMinutes = resolveStart(start);
      const end = resolveEnd(endTime, startMinutes);
      return {
        ...base,
        state: 'TIMED',
        startMinutes,
        endMinutes: end.minutes,
        endUncertain: uncertain || !end.confident,
        needsReview: !end.confident,
        reviewReason: end.confident ? '' : 'Ambiguous shift end time',
      };
    }
    return {
      ...base,
      state: 'TIMED',
      needsReview: true,
      reviewReason: `Could not fully parse range: "${text}"`,
    };
  }

  // A bare time (e.g. "8 OR 4.30") — treat as an uncertain end, flag for review.
  const single = parseEndToken(text);
  if (single.time) {
    const end = resolveEnd(single.time, ctx.openMinutes);
    return {
      ...base,
      state: 'TIMED',
      startMinutes: null,
      endMinutes: end.minutes,
      endUncertain: true,
      needsReview: true,
      reviewReason: `Single/ambiguous time, no start: "${text}"`,
    };
  }

  // Stray text like "Thank you": treat as a non-working farewell entry.
  return {
    ...base,
    state: 'OFF',
    note: note || original,
    needsReview: true,
    reviewReason: `Unrecognized entry: "${original}"`,
  };
}

// Split a station cell into names + an optional note. Handles "Sonal/Agna"
// (two-person) and "PARAS(Truck)" (note). Does NOT match to employees — the
// caller resolves names against the DB.
export function parseStationCell(raw: string): { names: string[]; note: string } {
  const original = (raw ?? '').trim();
  if (!original) return { names: [], note: '' };

  const notes: string[] = [];
  const cleaned = original.replace(/\(([^)]*)\)/g, (_m, inner) => {
    const t = String(inner).trim();
    if (t) notes.push(t);
    return ' ';
  });

  const names = cleaned
    .split('/')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  return { names, note: dedupe(notes).join(', ') };
}
