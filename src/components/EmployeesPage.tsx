import { useState } from 'react';
import { useSchedule } from '../store.tsx';
import { api } from '../api.ts';
import { Sheet } from './Sheet.tsx';
import type { Crew, Employee } from '../../shared/types.ts';

const CREWS: Crew[] = ['MORNING', 'CLOSING', 'ANY'];

export function EmployeesPage() {
  const { employees, stations, reloadStatic } = useSchedule();
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);

  const sorted = [...employees].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          + Add employee
        </button>
      </div>

      <div className="card divide-y divide-slate-100">
        {sorted.map((e) => (
          <button
            key={e.id}
            onClick={() => setEditing(e)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${e.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {e.name}
                </span>
                {!e.active && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                    archived
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {e.crew} ·{' '}
                {e.usualStations.length
                  ? e.usualStations
                      .map((id) => stations.find((s) => s.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')
                  : 'no usual stations'}
              </div>
            </div>
            <span className="text-slate-300">›</span>
          </button>
        ))}
      </div>

      {editing && (
        <EmployeeEditor
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reloadStatic();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeEditor({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { stations } = useSchedule();
  const [name, setName] = useState(employee?.name ?? '');
  const [crew, setCrew] = useState<Crew>(employee?.crew ?? 'ANY');
  const [active, setActive] = useState(employee?.active ?? true);
  const [usual, setUsual] = useState<number[]>(employee?.usualStations ?? []);
  const [notes, setNotes] = useState(employee?.notes ?? '');
  const [busy, setBusy] = useState(false);

  function toggleStation(id: number) {
    setUsual((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = { name: name.trim(), crew, active, usualStations: usual, notes };
      if (employee) await api.updateEmployee(employee.id, payload);
      else await api.createEmployee(payload);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={employee ? 'Edit employee' : 'New employee'}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !name.trim()}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Crew</label>
          <div className="flex gap-2">
            {CREWS.map((c) => (
              <button
                key={c}
                onClick={() => setCrew(c)}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm ${
                  crew === c ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                {c[0] + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            Usual stations (preferred roles)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {stations.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleStation(s.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  usual.includes(s.id)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (uncheck to archive)
        </label>
      </div>
    </Sheet>
  );
}
