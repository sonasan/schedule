import { useState } from 'react';
import { useSchedule } from '../store.tsx';
import { api } from '../api.ts';
import type { Station } from '../../shared/types.ts';

export function StationsPage() {
  const { stations, reloadStatic } = useSchedule();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function update(id: number, patch: Partial<Station>) {
    await api.updateStation(id, patch);
    await reloadStatic();
  }

  async function move(station: Station, dir: -1 | 1) {
    const sorted = [...stations].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === station.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await api.updateStation(station.id, { order: swap.order });
    await api.updateStation(swap.id, { order: station.order });
    await reloadStatic();
  }

  async function add() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.createStation({ name: newName.trim() });
      setNewName('');
      await reloadStatic();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this station? Its assignments will be removed.')) return;
    await api.deleteStation(id);
    await reloadStatic();
  }

  const sorted = [...stations].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Stations</h2>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid">
          <span>Name</span>
          <span>Split</span>
          <span>Required</span>
          <span>Order</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {sorted.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
              <input
                className="input"
                value={s.name}
                onChange={(e) => update(s.id, { name: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={s.allowsSplit}
                  onChange={(e) => update(s.id, { allowsSplit: e.target.checked })}
                />
                <span className="sm:hidden">Split</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={s.requiredDaily}
                  onChange={(e) => update(s.id, { requiredDaily: e.target.checked })}
                />
                <span className="sm:hidden">Required</span>
              </label>
              <div className="flex items-center gap-1">
                <button className="btn-ghost px-1.5" disabled={i === 0} onClick={() => move(s, -1)}>
                  ↑
                </button>
                <button
                  className="btn-ghost px-1.5"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(s, 1)}
                >
                  ↓
                </button>
                <button className="btn-ghost px-1.5 text-red-500" onClick={() => remove(s.id)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card flex items-center gap-2 p-3">
        <input
          className="input"
          placeholder="New station name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary whitespace-nowrap" onClick={add} disabled={busy || !newName.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
