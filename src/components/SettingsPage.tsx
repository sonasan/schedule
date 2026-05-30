import { useState } from 'react';
import { useSchedule } from '../store.tsx';
import { api } from '../api.ts';
import { minutesTo24h, time24hToMinutes } from '../../shared/time.ts';
import { DAY_LABELS, type ImportReport } from '../../shared/types.ts';
import { ImportReview } from './ImportReview.tsx';

export function SettingsPage() {
  const { settings, reloadStatic, weeks, currentWeekId, selectWeek } = useSchedule();
  const [open, setOpen] = useState(minutesTo24h(settings?.openMinutes ?? 240));
  const [close, setClose] = useState(minutesTo24h(settings?.closeMinutes ?? 1380));
  const [weekStart, setWeekStart] = useState(settings?.weekStartDay ?? 0);
  const [savedMsg, setSavedMsg] = useState('');
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  async function saveSettings() {
    const o = time24hToMinutes(open);
    const c = time24hToMinutes(close);
    if (o == null || c == null) return;
    await api.updateSettings({ openMinutes: o, closeMinutes: c, weekStartDay: weekStart });
    await reloadStatic();
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  async function doImport() {
    if (!csv.trim()) return;
    setImporting(true);
    setImportError('');
    setReport(null);
    try {
      const r = await api.importCsv(csv);
      setReport(r);
      await reloadStatic();
      await selectWeek(r.weekId);
    } catch (e: any) {
      setImportError(e?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Settings</h2>

      {/* Store hours */}
      <div className="card space-y-4 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Store hours &amp; week</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Opening time</label>
            <input type="time" className="input" value={open} onChange={(e) => setOpen(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Closing time</label>
            <input type="time" className="input" value={close} onChange={(e) => setClose(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Week starts on</label>
            <select
              className="input"
              value={weekStart}
              onChange={(e) => setWeekStart(Number(e.target.value))}
            >
              {DAY_LABELS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={saveSettings}>
            Save settings
          </button>
          {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
        </div>
      </div>

      {/* Export */}
      <div className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Export current week</h3>
        {currentWeekId ? (
          <div className="flex flex-wrap gap-2">
            <a className="btn-outline" href={`/api/weeks/${currentWeekId}/export.csv`}>
              ⬇ Export CSV
            </a>
            <a
              className="btn-outline"
              href={`/api/weeks/${currentWeekId}/export.json`}
              target="_blank"
              rel="noreferrer"
            >
              ⬇ Export JSON
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No week selected.</p>
        )}
      </div>

      {/* Import */}
      <div className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Import CSV</h3>
        <p className="text-xs text-slate-500">
          Paste the spreadsheet export or choose a file. Rows: dates, day labels, employee shifts, a
          blank row, then the station block.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          placeholder="Paste CSV here…"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={doImport} disabled={importing || !csv.trim()}>
            {importing ? 'Importing…' : 'Import'}
          </button>
          {importError && <span className="text-sm text-red-600">{importError}</span>}
        </div>
      </div>

      {report && <ImportReview report={report} onClose={() => setReport(null)} />}

      {/* Weeks list */}
      <div className="card space-y-2 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Weeks</h3>
        <div className="flex flex-wrap gap-2">
          {weeks.map((w) => (
            <button
              key={w.id}
              onClick={() => selectWeek(w.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                w.id === currentWeekId
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {w.startDate}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
