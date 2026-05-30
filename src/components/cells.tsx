import type { Assignment, Employee, Shift, Station } from '../../shared/types.ts';
import { STATE_STYLES, shiftCompactLabel } from '../shiftDisplay.ts';
import { isWorking } from '../../shared/coverage.ts';

// A single shift cell (employee × day), color-coded by state.
export function ShiftCell({
  shift,
  onClick,
  compact,
}: {
  shift: Shift | undefined;
  onClick: () => void;
  compact?: boolean;
}) {
  const state = shift?.state ?? 'UNKNOWN';
  const style = STATE_STYLES[state];
  const label = shiftCompactLabel(shift);
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-full min-h-[2.5rem] w-full flex-col items-center justify-center gap-0.5
        border ${style.chip} ${compact ? 'px-1 py-1.5 text-[11px]' : 'px-1.5 py-2 text-xs'}
        font-medium transition hover:brightness-95`}
      title={shift?.note || shift?.rawText || style.label}
    >
      <span className="leading-tight">{label || '+'}</span>
      {shift?.note && (
        <span className="max-w-full truncate text-[9px] font-normal opacity-70">{shift.note}</span>
      )}
      {(shift?.endUncertain || shift?.needsReview) && (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-sky-400" title="Needs review" />
      )}
    </button>
  );
}

// A single station cell (station × day) showing assignee chips.
export function StationCell({
  assignment,
  station,
  employees,
  shifts,
  dayIndex,
  suggestedIds,
  onClick,
}: {
  assignment: Assignment | undefined;
  station: Station;
  employees: Map<number, Employee>;
  shifts: Shift[];
  dayIndex: number;
  suggestedIds?: number[];
  onClick: () => void;
}) {
  const ids = assignment?.employeeIds ?? [];
  const active = station.days.includes(dayIndex);
  const hasSuggestion = active && !ids.length && suggestedIds && suggestedIds.length > 0;
  const uncovered = active && station.requiredDaily && ids.length === 0;

  function stateFor(empId: number): string {
    return shifts.find((s) => s.dayIndex === dayIndex && s.employeeId === empId)?.state ?? 'OFF';
  }

  if (!active) {
    return (
      <div className="flex h-full min-h-[2.5rem] w-full items-center justify-center border border-slate-100 bg-slate-50 text-slate-300">
        <span className="text-[10px]">—</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex h-full min-h-[2.5rem] w-full flex-wrap items-center justify-center gap-1 border px-1 py-1.5
        text-[11px] transition hover:bg-slate-50 ${
          uncovered ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
        }`}
    >
      {ids.map((id) => {
        const st = stateFor(id);
        const bad = st === 'OFF' || st === 'UNKNOWN';
        const onCall = st === 'ON_CALL';
        return (
          <span
            key={id}
            className={`rounded px-1.5 py-0.5 font-medium ${
              bad
                ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                : onCall
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            {employees.get(id)?.name ?? `#${id}`}
            {!isWorking(st) && !onCall && ' ⚠'}
          </span>
        );
      })}
      {hasSuggestion && (
        <span className="rounded border border-dashed border-blue-300 px-1.5 py-0.5 text-blue-500">
          ✨ {suggestedIds!.map((id) => employees.get(id)?.name).filter(Boolean).join(', ')}
        </span>
      )}
      {!ids.length && !hasSuggestion && <span className="text-slate-300">+</span>}
    </button>
  );
}
