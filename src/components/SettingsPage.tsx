import { useState } from 'react';
import { useSchedule } from '../store.tsx';
import { api } from '../api.ts';
import { minutesTo24h, time24hToMinutes } from '../../shared/time.ts';
import {
  DAY_LABELS,
  DEFAULT_DAY_HOURS,
  type DayHours,
  type ImportReport,
} from '../../shared/types.ts';
import { ImportReview } from './ImportReview.tsx';

export function SettingsPage() {
  const { settings, reloadStatic, weeks, currentWeekId, selectWeek } = useSchedule();
  const [dayHours, setDayHours] = useState<DayHours[]>(
    settings?.dayHours ?? DEFAULT_DAY_HOURS,
  );
  const [weekStart, setWeekStart] = useState(settings?.weekStartDay ?? 0);
  const [savedMsg, setSavedMsg] = useState('');
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  function setHour(day: number, which: 'open' | 'close', value: string) {
    const mins = time24hToMinutes(value);
    if (mins == null) return;
    setDayHours((prev) => prev.map((h, i) => (i === day ? { ...h, [which]: mins } : h)));
  }

  async function saveSettings() {
    // Weekday hours (Monday) double as the default used by the CSV importer.
    await api.updateSettings({
      openMinutes: dayHours[1].open,
      closeMinutes: dayHours[1].close,
      weekStartDay: weekStart,
      dayHours,
    });
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
        <h3 className="text-sm font-semibold text-slate-700">Store hours (per day)</h3>
        <div className="space-y-1.5">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2">
              <span className="text-sm font-medium text-slate-600">{d}</span>
              <input
                type="time"
                className="input"
                value={minutesTo24h(dayHours[i]?.open ?? 240)}
                onChange={(e) => setHour(i, 'open', e.target.value)}
              />
              <span className="text-center text-xs text-slate-400">to</span>
              <input
                type="time"
                className="input"
                value={minutesTo24h(dayHours[i]?.close ?? 1200)}
                onChange={(e) => setHour(i, 'close', e.target.value)}
              />
            </div>
          ))}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Week starts on</label>
          <select
            className="input sm:max-w-[12rem]"
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
