import { useMemo, useState } from 'react';
import { useSchedule } from '../store.tsx';
import { useWeekSuggestions } from '../useSuggestions.ts';
import { ShiftCell, StationCell } from './cells.tsx';
import { ShiftEditor } from './ShiftEditor.tsx';
import { AssignmentPicker } from './AssignmentPicker.tsx';
import { CoveragePanel } from './CoveragePanel.tsx';
import type { Employee, Station } from '../../shared/types.ts';
import { DAY_LABELS } from '../../shared/types.ts';
import { addDays, formatDate } from '../../shared/time.ts';

const CREW_LABELS: Record<string, string> = { MORNING: 'Morning', CLOSING: 'Closing', ANY: 'Any' };

export function WeekView() {
  const { weekData, employees, stations } = useSchedule();
  const suggestions = useWeekSuggestions();
  const [editShift, setEditShift] = useState<{ emp: Employee; day: number } | null>(null);
  const [editStation, setEditStation] = useState<{ station: Station; day: number } | null>(null);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const activeEmployees = useMemo(
    () =>
      [...employees]
        .filter((e) => e.active)
        .sort((a, b) => {
          const order = { MORNING: 0, ANY: 1, CLOSING: 2 } as Record<string, number>;
          if (order[a.crew] !== order[b.crew]) return order[a.crew] - order[b.crew];
          return a.name.localeCompare(b.name);
        }),
    [employees],
  );

  if (!weekData) return null;
  const { week, shifts, assignments } = weekData;

  const shiftAt = (empId: number, day: number) =>
    shifts.find((s) => s.employeeId === empId && s.dayIndex === day);
  const assignAt = (stationId: number, day: number) =>
    assignments.find((a) => a.stationId === stationId && a.dayIndex === day);

  // 8-column grid: label column + 7 days.
  const gridCols = 'grid grid-cols-[120px_repeat(7,minmax(80px,1fr))]';

  // Group employees by crew with subtle dividers.
  const groups: Array<{ crew: string; members: Employee[] }> = [];
  for (const e of activeEmployees) {
    let g = groups.find((x) => x.crew === e.crew);
    if (!g) {
      g = { crew: e.crew, members: [] };
      groups.push(g);
    }
    g.members.push(e);
  }

  return (
    <div className="space-y-4">
      <CoveragePanel />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* Header */}
            <div className={`${gridCols} sticky top-0 z-20 bg-slate-50`}>
              <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff
              </div>
              {DAY_LABELS.map((d, i) => (
                <div
                  key={i}
                  className="border-b border-l border-slate-200 px-2 py-2 text-center"
                >
                  <div className="text-xs font-semibold text-slate-700">{d}</div>
                  <div className="text-[10px] text-slate-400">{formatDate(addDays(week.startDate, i))}</div>
                </div>
              ))}
            </div>

            {/* Employee rows grouped by crew */}
            {groups.map((group) => (
              <div key={group.crew}>
                <div className={`${gridCols}`}>
                  <div className="sticky left-0 z-10 col-span-1 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {CREW_LABELS[group.crew]}
                  </div>
                  <div className="col-span-7 bg-slate-100" />
                </div>
                {group.members.map((emp) => (
                  <div key={emp.id} className={gridCols}>
                    <div className="sticky left-0 z-10 flex items-center border-b border-r border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700">
                      <span className="truncate">{emp.name}</span>
                    </div>
                    {DAY_LABELS.map((_, day) => (
                      <div key={day} className="border-b border-l border-slate-100">
                        <ShiftCell
                          shift={shiftAt(emp.id, day)}
                          onClick={() => setEditShift({ emp, day })}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Station board */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-700">Station board</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className={`${gridCols} sticky top-0 z-20 bg-slate-50`}>
              <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Station
              </div>
              {DAY_LABELS.map((d, i) => (
                <div key={i} className="border-b border-l border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                  {d}
                </div>
              ))}
            </div>
            {stations.map((station) => (
              <div key={station.id} className={gridCols}>
                <div className="sticky left-0 z-10 flex items-center gap-1 border-b border-r border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  <span className="truncate">{station.name}</span>
                  {station.requiredDaily && <span className="text-amber-500" title="Required daily">*</span>}
                </div>
                {DAY_LABELS.map((_, day) => (
                  <div key={day} className="border-b border-l border-slate-100">
                    <StationCell
                      assignment={assignAt(station.id, day)}
                      station={station}
                      employees={empById}
                      shifts={shifts}
                      dayIndex={day}
                      suggestedIds={suggestions.get(day)?.get(station.id)}
                      onClick={() => setEditStation({ station, day })}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editShift && (
        <ShiftEditor
          employee={editShift.emp}
          dayIndex={editShift.day}
          shift={shiftAt(editShift.emp.id, editShift.day)}
          onClose={() => setEditShift(null)}
        />
      )}
      {editStation && (
        <AssignmentPicker
          station={editStation.station}
          dayIndex={editStation.day}
          assignment={assignAt(editStation.station.id, editStation.day)}
          suggestedIds={suggestions.get(editStation.day)?.get(editStation.station.id)}
          onClose={() => setEditStation(null)}
        />
      )}
    </div>
  );
}
