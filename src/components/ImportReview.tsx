import { Sheet } from './Sheet.tsx';
import { DAY_LABELS, type ImportReport } from '../../shared/types.ts';

// Post-import review: lists every cell that couldn't be parsed cleanly plus a
// quick summary, so the manager can go fix them in the grid.
export function ImportReview({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title="Import review"
      footer={
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Shifts" value={report.shiftsImported} />
          <Stat label="Assignments" value={report.assignmentsImported} />
          <Stat label="New staff" value={report.employeesCreated.length} />
        </div>

        {report.employeesCreated.length > 0 && (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Created: {report.employeesCreated.join(', ')}
          </div>
        )}

        {report.issues.length === 0 ? (
          <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            ✓ Everything parsed cleanly.
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">
              {report.issues.length} item{report.issues.length === 1 ? '' : 's'} need review
            </div>
            <ul className="space-y-1.5">
              {report.issues.map((issue, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    {issue.dayIndex >= 0 && (
                      <span className="font-semibold">{DAY_LABELS[issue.dayIndex]}</span>
                    )}
                    {issue.employeeName && <span>{issue.employeeName}</span>}
                    {issue.stationName && <span>· {issue.stationName}</span>}
                    {issue.rawText && (
                      <code className="rounded bg-white px-1 text-amber-800">“{issue.rawText}”</code>
                    )}
                  </div>
                  <div className="text-slate-600">{issue.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-xl font-semibold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
