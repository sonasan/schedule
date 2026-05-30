// Full-assist auto-suggest. Given a day's working pool plus affinity/usual-station
// data, propose station assignments. Greedy, load-balancing, time-aware. Pure.

import type { Employee, Shift, Station, SuggestionProposal } from './types.ts';
import { isWorking } from './coverage.ts';

interface SuggestInput {
  stations: Station[];
  employees: Employee[];
  shifts: Shift[]; // for this week
  dayIndex: number;
  affinity: Map<string, number>; // key `${empId}:${stationId}`
  openMinutes: number;
  closeMinutes: number;
  includeOnCall?: boolean;
}

interface PoolMember {
  emp: Employee;
  start: number;
  end: number;
  onCall: boolean;
}

// Effective working window for a shift, filling OPEN/CLOSE from store hours.
function effectiveWindow(
  s: Shift,
  openMinutes: number,
  closeMinutes: number,
): { start: number; end: number } {
  let start = s.startMinutes;
  let end = s.endMinutes;
  if (s.state === 'OPEN') {
    start = openMinutes;
    if (end === null) end = closeMinutes;
  } else if (s.state === 'CLOSE') {
    end = closeMinutes;
    if (start === null) start = openMinutes;
  }
  return { start: start ?? openMinutes, end: end ?? closeMinutes };
}

export function buildPool(input: SuggestInput): PoolMember[] {
  const { shifts, employees, dayIndex, openMinutes, closeMinutes, includeOnCall } = input;
  const empById = new Map(employees.map((e) => [e.id, e]));
  const pool: PoolMember[] = [];
  for (const s of shifts) {
    if (s.dayIndex !== dayIndex) continue;
    const isOnCall = s.state === 'ON_CALL';
    if (!isWorking(s.state) && !(includeOnCall && isOnCall)) continue;
    const emp = empById.get(s.employeeId);
    if (!emp || !emp.active) continue;
    const win = effectiveWindow(s, openMinutes, closeMinutes);
    pool.push({ emp, start: win.start, end: win.end, onCall: isOnCall });
  }
  return pool;
}

function overlapMinutes(a: { start: number; end: number }, b: { start: number; end: number }): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

// Stations needed during the whole open day by default; this lets us penalize
// poor time overlap without per-station scheduling metadata.
export function suggestAssignments(input: SuggestInput): SuggestionProposal[] {
  const { stations, affinity, openMinutes, closeMinutes } = input;
  const pool = buildPool(input);
  if (pool.length === 0) return [];

  const storeWindow = { start: openMinutes, end: closeMinutes };
  const loadByEmp = new Map<number, number>();
  for (const m of pool) loadByEmp.set(m.emp.id, 0);

  // Process required-daily stations first, then by display order.
  const ordered = [...stations].sort((a, b) => {
    if (a.requiredDaily !== b.requiredDaily) return a.requiredDaily ? -1 : 1;
    return a.order - b.order;
  });

  const proposals: SuggestionProposal[] = [];

  function scoreFor(member: PoolMember, station: Station): number {
    let score = 0;
    // usualStations match (earlier in the list = stronger preference).
    const idx = member.emp.usualStations.indexOf(station.id);
    if (idx >= 0) score += 6 - Math.min(idx, 5);
    // learned affinity
    score += affinity.get(`${member.emp.id}:${station.id}`) ?? 0;
    // load penalty — spread the work around
    score -= 3 * (loadByEmp.get(member.emp.id) ?? 0);
    // time-overlap penalty: how much of the store day they cover
    const overlap = overlapMinutes(member, storeWindow);
    const coverage = overlap / Math.max(1, storeWindow.end - storeWindow.start);
    score += coverage * 2;
    // on-call people are tentative; mild penalty so real staff win ties
    if (member.onCall) score -= 2;
    return score;
  }

  // First pass: give every working person at least one station before doubling.
  for (const station of ordered) {
    const candidates = [...pool]
      .map((m) => ({ m, score: scoreFor(m, station) }))
      .sort((a, b) => b.score - a.score);

    const unloadedFirst = candidates.sort((a, b) => {
      const la = loadByEmp.get(a.m.emp.id) ?? 0;
      const lb = loadByEmp.get(b.m.emp.id) ?? 0;
      if (la !== lb) return la - lb; // prefer people with fewer assignments
      return b.score - a.score;
    });

    const pick = unloadedFirst[0];
    if (!pick) continue;
    const ids = [pick.m.emp.id];
    loadByEmp.set(pick.m.emp.id, (loadByEmp.get(pick.m.emp.id) ?? 0) + 1);

    proposals.push({
      stationId: station.id,
      employeeIds: ids,
      note: pick.m.onCall ? 'on-call (tentative)' : '',
    });
  }

  return proposals;
}
