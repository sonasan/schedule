import { useMemo, useState } from 'react';
import { Sheet } from './Sheet.tsx';
import { useSchedule } from '../store.tsx';
import type { Assignment, Station } from '../../shared/types.ts';
import { isWorking } from '../../shared/coverage.ts';
import { shiftCompactLabel } from '../shiftDisplay.ts';

interface Props {
  station: Station;
  dayIndex: number;
  assignment: Assignment | undefined;
  suggestedIds?: number[];
  onClose: () => void;
}

export function AssignmentPicker({ station, dayIndex, assignment, suggestedIds = [], onClose }: Props) {
  const { weekData, employees, saveAssignment } = useSchedule();
  const [selected, setSelected] = useState<number[]>(assignment?.employeeIds ?? []);
  const [note, setNote] = useState(assignment?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // The available pool: anyone working (or on-call) this day. OFF staff are
  // intentionally excluded — they can never be assigned.
  const pool = useMemo(() => {
    const shifts = (weekData?.shifts ?? []).filter((s) => s.dayIndex === dayIndex);
    return shifts
      .filter((s) => isWorking(s.state) || s.state === 'ON_CALL')
      .map((s) => ({ shift: s, emp: empById.get(s.employeeId)! }))
      .filter((x) => x.emp && x.emp.active)
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  }, [weekData, dayIndex, empById]);

  const limit = station.allowsSplit ? 2 : 1;

  function toggle(empId: number) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(empId)) return prev.filter((id) => id !== empId);
      if (prev.length >= limit) {
        // Replace the oldest selection when at the limit.
        return [...prev.slice(1), empId];
      }
      return [...prev, empId];
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveAssignment({ dayIndex, stationId: station.id, employeeIds: selected, note });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion() {
    setSelected(suggestedIds.slice(0, limit));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${station.name} — ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]}`}
      footer={
        <>
          <button className="btn-ghost mr-auto" onClick={() => setSelected([])} disabled={busy}>
            Clear
          </button>
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          {station.allowsSplit ? 'Pick up to 2 people' : 'Pick 1 person'} from today’s working
          staff. Off-shift staff are hidden.
        </p>

        {suggestedIds.length > 0 && (
          <button onClick={applySuggestion} className="btn-outline w-full border-blue-300 text-blue-700">
            ✨ Use suggestion: {suggestedIds.map((id) => empById.get(id)?.name).filter(Boolean).join(', ')}
          </button>
        )}

        {pool.length === 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No one is working this day. Assign shifts first.
          </div>
        )}

        <div className="space-y-1.5">
          {pool.map(({ shift, emp }) => {
            const checked = selected.includes(emp.id);
            const suggested = suggestedIds.includes(emp.id);
            const onCall = shift.state === 'ON_CALL';
            return (
              <button
                key={emp.id}
                onClick={() => toggle(emp.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                  checked
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                      checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span className="font-medium text-slate-700">{emp.name}</span>
                  {suggested && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      suggested
                    </span>
                  )}
                  {onCall && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      on-call
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{shiftCompactLabel(shift)}</span>
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </Sheet>
  );
}
