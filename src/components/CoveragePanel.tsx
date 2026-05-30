import { useMemo, useState } from 'react';
import { useSchedule } from '../store.tsx';
import { computeCoverage } from '../../shared/coverage.ts';
import { DAY_LABELS, type CoverageIssue, type IssueSeverity } from '../../shared/types.ts';

const SEVERITY_META: Record<IssueSeverity, { dot: string; label: string; rank: number }> = {
  error: { dot: 'bg-red-500', label: 'Error', rank: 0 },
  warning: { dot: 'bg-amber-500', label: 'Warning', rank: 1 },
  caution: { dot: 'bg-orange-400', label: 'Caution', rank: 2 },
  info: { dot: 'bg-sky-400', label: 'Info', rank: 3 },
};

export function CoveragePanel({ dayFilter }: { dayFilter?: number }) {
  const { weekData, employees, stations } = useSchedule();
  const [collapsed, setCollapsed] = useState(false);

  const issues = useMemo(() => {
    if (!weekData) return [] as CoverageIssue[];
    const days = dayFilter != null ? [dayFilter] : [0, 1, 2, 3, 4, 5, 6];
    return computeCoverage({
      stations,
      employees,
      shifts: weekData.shifts,
      assignments: weekData.assignments,
      days,
    }).sort((a, b) => {
      const r = SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank;
      return r !== 0 ? r : a.dayIndex - b.dayIndex;
    });
  }, [weekData, employees, stations, dayFilter]);

  const counts = useMemo(() => {
    const c: Record<IssueSeverity, number> = { error: 0, warning: 0, caution: 0, info: 0 };
    for (const i of issues) c[i.severity]++;
    return c;
  }, [issues]);

  return (
    <div className="card">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Coverage &amp; conflicts</span>
          <div className="flex items-center gap-2">
            {(['error', 'warning', 'caution', 'info'] as IssueSeverity[]).map((sev) =>
              counts[sev] > 0 ? (
                <span key={sev} className="flex items-center gap-1 text-xs text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${SEVERITY_META[sev].dot}`} />
                  {counts[sev]}
                </span>
              ) : null,
            )}
            {issues.length === 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> All clear
              </span>
            )}
          </div>
        </div>
        <span className="text-slate-400">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && issues.length > 0 && (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 px-4 py-2 text-sm">
              <span
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${SEVERITY_META[issue.severity].dot}`}
              />
              <span className="text-slate-600">
                <span className="font-medium text-slate-500">{DAY_LABELS[issue.dayIndex]}:</span>{' '}
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
