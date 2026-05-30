import { useEffect, useState } from 'react';
import { Sheet } from './Sheet.tsx';
import { useSchedule } from '../store.tsx';
import type { Employee, Shift, ShiftState } from '../../shared/types.ts';
import { minutesTo24h, time24hToMinutes } from '../../shared/time.ts';
import { STATE_STYLES } from '../shiftDisplay.ts';

interface Props {
  employee: Employee;
  dayIndex: number;
  shift: Shift | undefined;
  onClose: () => void;
}

const PICKABLE: ShiftState[] = ['OFF', 'ON_CALL', 'OPEN', 'CLOSE', 'TIMED'];

export function ShiftEditor({ employee, dayIndex, shift, onClose }: Props) {
  const { saveShift, deleteShift, settings } = useSchedule();
  const [state, setState] = useState<ShiftState>(shift?.state ?? 'OFF');
  const [start, setStart] = useState(minutesTo24h(shift?.startMinutes ?? null));
  const [end, setEnd] = useState(minutesTo24h(shift?.endMinutes ?? null));
  const [endUncertain, setEndUncertain] = useState(shift?.endUncertain ?? false);
  const [note, setNote] = useState(shift?.note ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Default sensible times when switching into a state with no value yet.
    if (state === 'OPEN' && !end && settings) setEnd('');
    if (state === 'CLOSE' && !start && settings) setStart('');
  }, [state, end, start, settings]);

  const needsStart = state === 'CLOSE' || state === 'TIMED';
  const needsEnd = state === 'OPEN' || state === 'TIMED';

  async function save() {
    setBusy(true);
    try {
      await saveShift({
        employeeId: employee.id,
        dayIndex,
        state,
        startMinutes: needsStart ? time24hToMinutes(start) : null,
        endMinutes: needsEnd ? time24hToMinutes(end) : null,
        endUncertain: needsEnd ? endUncertain : false,
        note,
        rawText: shift?.rawText ?? '',
        needsReview: false,
        reviewReason: '',
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await deleteShift(employee.id, dayIndex);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${employee.name} — ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]}`}
      footer={
        <>
          {shift && (
            <button className="btn-ghost mr-auto text-red-600" onClick={clear} disabled={busy}>
              Clear
            </button>
          )}
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
            State
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PICKABLE.map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                  state === s
                    ? STATE_STYLES[s].chip + ' ring-2 ring-offset-1 ring-blue-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {STATE_STYLES[s].label}
              </button>
            ))}
          </div>
        </div>

        {(needsStart || needsEnd) && (
          <div className="grid grid-cols-2 gap-3">
            <div className={needsStart ? '' : 'opacity-40'}>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Start {state === 'OPEN' && '(store open)'}
              </label>
              <input
                type="time"
                className="input"
                value={start}
                disabled={!needsStart}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className={needsEnd ? '' : 'opacity-40'}>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                End {state === 'CLOSE' && '(store close)'}
              </label>
              <input
                type="time"
                className="input"
                value={end}
                disabled={!needsEnd}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {needsEnd && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={endUncertain}
              onChange={(e) => setEndUncertain(e.target.checked)}
            />
            End time is uncertain (e.g. “5/6”)
          </label>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Note</label>
          <input
            className="input"
            placeholder="e.g. Truck, Cake"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}
