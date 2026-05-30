// Live coverage & conflict checks. Pure functions over the week's data so the
// UI can recompute instantly on every edit.

import type {
  Assignment,
  CoverageIssue,
  Employee,
  Shift,
  Station,
} from './types.ts';

const WORKING_STATES = new Set(['OPEN', 'CLOSE', 'TIMED']);

export function isWorking(state: string): boolean {
  return WORKING_STATES.has(state);
}

interface CoverageInput {
  stations: Station[];
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
  days: number[]; // day indices to check, e.g. [0..6]
}

export function computeCoverage(input: CoverageInput): CoverageIssue[] {
  const { stations, employees, shifts, assignments, days } = input;
  const issues: CoverageIssue[] = [];

  const empById = new Map(employees.map((e) => [e.id, e]));
  // shift lookup: `${day}:${empId}`
  const shiftByKey = new Map<string, Shift>();
  for (const s of shifts) shiftByKey.set(`${s.dayIndex}:${s.employeeId}`, s);

  for (const day of days) {
    const dayAssignments = assignments.filter((a) => a.dayIndex === day);
    const assignedEmployeeIds = new Set<number>();
    let hasOpener = false;
    let hasCloser = false;

    // Track who is working today.
    const workingToday = shifts.filter((s) => s.dayIndex === day && isWorking(s.state));
    for (const s of shifts) {
      if (s.dayIndex !== day) continue;
      if (s.state === 'OPEN') hasOpener = true;
      if (s.state === 'CLOSE') hasCloser = true;
    }

    // Per-assignment checks.
    for (const a of dayAssignments) {
      for (const empId of a.employeeIds) {
        assignedEmployeeIds.add(empId);
        const shift = shiftByKey.get(`${day}:${empId}`);
        const emp = empById.get(empId);
        const name = emp?.name ?? `#${empId}`;
        const stationName = stations.find((s) => s.id === a.stationId)?.name ?? '';
        if (!shift || shift.state === 'OFF' || shift.state === 'UNKNOWN') {
          issues.push({
            severity: 'error',
            dayIndex: day,
            stationId: a.stationId,
            employeeId: empId,
            code: 'OFF_BUT_ASSIGNED',
            message: `${name} is assigned to ${stationName} but is not working.`,
          });
        } else if (shift.state === 'ON_CALL') {
          issues.push({
            severity: 'caution',
            dayIndex: day,
            stationId: a.stationId,
            employeeId: empId,
            code: 'ON_CALL_ASSIGNED',
            message: `${name} on ${stationName} is on-call (tentative).`,
          });
        }
      }
    }

    // Uncovered required stations.
    for (const st of stations) {
      if (!st.requiredDaily) continue;
      const a = dayAssignments.find((x) => x.stationId === st.id);
      if (!a || a.employeeIds.length === 0) {
        issues.push({
          severity: 'warning',
          dayIndex: day,
          stationId: st.id,
          code: 'UNCOVERED_STATION',
          message: `${st.name} has no one assigned.`,
        });
      }
    }

    // Workers with no station.
    for (const s of workingToday) {
      if (!assignedEmployeeIds.has(s.employeeId)) {
        const name = empById.get(s.employeeId)?.name ?? `#${s.employeeId}`;
        issues.push({
          severity: 'info',
          dayIndex: day,
          employeeId: s.employeeId,
          code: 'UNASSIGNED_WORKER',
          message: `${name} is working but assigned to no station.`,
        });
      }
    }

    // Uncertain / needs-review shifts.
    for (const s of shifts) {
      if (s.dayIndex !== day) continue;
      if (s.endUncertain || s.needsReview) {
        const name = empById.get(s.employeeId)?.name ?? `#${s.employeeId}`;
        issues.push({
          severity: 'info',
          dayIndex: day,
          employeeId: s.employeeId,
          code: 'UNCERTAIN_SHIFT',
          message: s.reviewReason
            ? `${name}: ${s.reviewReason}`
            : `${name} has an uncertain shift end.`,
        });
      }
    }

    // No opener / no closer (only flag days that have any working staff).
    if (workingToday.length > 0) {
      if (!hasOpener) {
        issues.push({
          severity: 'warning',
          dayIndex: day,
          code: 'NO_OPENER',
          message: 'No opening shift scheduled.',
        });
      }
      if (!hasCloser) {
        issues.push({
          severity: 'warning',
          dayIndex: day,
          code: 'NO_CLOSER',
          message: 'No closing shift scheduled.',
        });
      }
    }
  }

  return issues;
}
