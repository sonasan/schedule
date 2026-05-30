import { useMemo, useState } from 'react';
import { useSchedule } from '../store.tsx';
import { useDaySuggestions } from '../useSuggestions.ts';
import { ShiftEditor } from './ShiftEditor.tsx';
import { AssignmentPicker } from './AssignmentPicker.tsx';
import { CoveragePanel } from './CoveragePanel.tsx';
import { STATE_STYLES, shiftCompactLabel } from '../shiftDisplay.ts';
import { isWorking } from '../../shared/coverage.ts';
import type { Employee, Station } from '../../shared/types.ts';
import { DAY_LABELS } from '../../shared/types.ts';
import { addDays, formatDate } from '../../shared/time.ts';

export function DayView() {
  const { weekData, employees, stations, saveAssignment } = useSchedule();
  const [day, setDay] = useState(() => {
    const today = new Date().getDay();
    return today;
  });
  const suggestions = useDaySuggestions(day);
  const [editShift, setEditShift] = useState<Employee | null>(null);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [busy, setBusy] = useState(false);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  if (!weekData) return null;
  const { week, shifts, assignments } = weekData;

  const dayShifts = shifts.filter((s) => s.dayIndex === day);
  const sortedEmployees = [...employees]
    .filter((e) => e.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const shiftFor = (empId: number) => dayShifts.find((s) => s.employeeId === empId);
  const assignFor = (stationId: number) =>
    assignments.find((a) => a.stationId === stationId && a.dayIndex === day);

  async function autoFill() {
    setBusy(true);
    try {
      for (const station of stations) {
        const existing = assignFor(station.id);
        if (existing && existing.employeeIds.length > 0) continue; // don't overwrite manual work
        const ids = suggestions.get(station.id);
        if (ids && ids.length > 0) {
          await saveAssignment({ dayIndex: day, stationId: station.id, employeeIds: ids, note: '' });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Day switcher */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {DAY_LABELS.map((d, i) => (
          <button
            key={i}
            onClick={() => setDay(i)}
            className={`flex min-w-[3.2rem] flex-col items-center rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              day === i ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            <span>{d}</span>
            <span className={day === i ? 'text-blue-100' : 'text-slate-400'}>
              {formatDate(addDays(week.startDate, i))}
            </span>
          </button>
        ))}
      </div>

      <CoveragePanel dayFilter={day} />

      {/* Shifts */}
      <div className="card">
        <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
          Shifts
        </div>
        <ul className="divide-y divide-slate-100">
          {sortedEmployees.map((emp) => {
            const shift = shiftFor(emp.id);
            const style = STATE_STYLES[shift?.state ?? 'UNKNOWN'];
            return (
              <li key={emp.id}>
                <button
                  onClick={() => setEditShift(emp)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{emp.name}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.chip}`}>
                    {shiftCompactLabel(shift) || 'Set shift'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Stations */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-sm font-semibold text-slate-700">Stations</span>
          <button className="btn-outline border-blue-300 text-blue-700" onClick={autoFill} disabled={busy}>
            ✨ Auto-fill
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {stations
            .filter((station) => station.days.includes(day))
            .map((station) => {
            const a = assignFor(station.id);
            const ids = a?.employeeIds ?? [];
            const suggestedIds = suggestions.get(station.id);
            const uncovered = station.requiredDaily && ids.length === 0;
            return (
              <li key={station.id}>
                <button
                  onClick={() => setEditStation(station)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 ${
                    uncovered ? 'bg-amber-50' : ''
                  }`}
                >
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-600">
                    {station.name}
                    {station.requiredDaily && <span className="text-amber-500">*</span>}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {ids.map((id) => {
                      const st = shiftFor(id)?.state ?? 'OFF';
                      const bad = !isWorking(st) && st !== 'ON_CALL';
                      return (
                        <span
                          key={id}
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            bad ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {empById.get(id)?.name}
                        </span>
                      );
                    })}
                    {!ids.length && suggestedIds?.length ? (
                      <span className="rounded border border-dashed border-blue-300 px-1.5 py-0.5 text-xs text-blue-500">
                        ✨ {suggestedIds.map((id) => empById.get(id)?.name).join(', ')}
                      </span>
                    ) : null}
                    {!ids.length && !suggestedIds?.length && <span className="text-slate-300">+</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {editShift && (
        <ShiftEditor
          employee={editShift}
          dayIndex={day}
          shift={shiftFor(editShift.id)}
          onClose={() => setEditShift(null)}
        />
      )}
      {editStation && (
        <AssignmentPicker
          station={editStation}
          dayIndex={day}
          assignment={assignFor(editStation.id)}
          suggestedIds={suggestions.get(editStation.id)}
          onClose={() => setEditStation(null)}
        />
      )}
    </div>
  );
}
