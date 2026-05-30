import { useMemo } from 'react';
import { useSchedule } from '../store.tsx';
import { DAY_LABELS } from '../../shared/types.ts';
import { addDays, formatDate } from '../../shared/time.ts';
import { shiftCompactLabel } from '../shiftDisplay.ts';

// Clean, ink-friendly week layout for posting in the back office.
export function PrintView({ onClose }: { onClose: () => void }) {
  const { weekData, employees, stations } = useSchedule();
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  if (!weekData) return null;
  const { week, shifts, assignments } = weekData;
  const active = employees.filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name));

  const shiftAt = (empId: number, d: number) =>
    shifts.find((s) => s.employeeId === empId && s.dayIndex === d);
  const assignAt = (stationId: number, d: number) =>
    assignments.find((a) => a.stationId === stationId && a.dayIndex === d);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <h1 className="mb-1 text-xl font-bold">Weekly Schedule</h1>
      <p className="mb-4 text-sm text-slate-500">Week of {week.startDate}</p>

      <table className="mb-6 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left">Staff</th>
            {DAY_LABELS.map((d, i) => (
              <th key={i} className="border border-slate-300 bg-slate-100 px-2 py-1">
                {d}
                <div className="font-normal text-slate-400">{formatDate(addDays(week.startDate, i))}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((e) => (
            <tr key={e.id}>
              <td className="border border-slate-300 px-2 py-1 font-medium">{e.name}</td>
              {DAY_LABELS.map((_, d) => (
                <td key={d} className="border border-slate-300 px-2 py-1 text-center">
                  {shiftCompactLabel(shiftAt(e.id, d))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-bold">Stations</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left">Station</th>
            {DAY_LABELS.map((d, i) => (
              <th key={i} className="border border-slate-300 bg-slate-100 px-2 py-1">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map((st) => (
            <tr key={st.id}>
              <td className="border border-slate-300 px-2 py-1 font-medium">{st.name}</td>
              {DAY_LABELS.map((_, d) => {
                const ids = assignAt(st.id, d)?.employeeIds ?? [];
                return (
                  <td key={d} className="border border-slate-300 px-2 py-1 text-center">
                    {ids.map((id) => empById.get(id)?.name).filter(Boolean).join(' / ')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
