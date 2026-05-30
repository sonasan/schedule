import { useEffect, useState } from 'react';
import { ScheduleProvider, useSchedule } from './store.tsx';
import { api } from './api.ts';
import { WeekView } from './components/WeekView.tsx';
import { DayView } from './components/DayView.tsx';
import { EmployeesPage } from './components/EmployeesPage.tsx';
import { StationsPage } from './components/StationsPage.tsx';
import { SettingsPage } from './components/SettingsPage.tsx';
import { PrintView } from './components/PrintView.tsx';
import { addDays } from '../shared/time.ts';

type Tab = 'schedule' | 'employees' | 'stations' | 'settings';
type ViewMode = 'week' | 'day';

export default function App() {
  return (
    <ScheduleProvider>
      <Shell />
    </ScheduleProvider>
  );
}

function Shell() {
  const { loading, error, weekData } = useSchedule();
  const [tab, setTab] = useState<Tab>('schedule');
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week',
  );
  const [printing, setPrinting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">Loading schedule…</div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-red-600">
        {error}
        <div className="mt-2 text-sm text-slate-400">Is the API running? Try `npm run dev`.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              S
            </div>
            <h1 className="text-base font-semibold text-slate-800">Shift &amp; Station Scheduler</h1>
          </div>
          <nav className="flex gap-1">
            {(['schedule', 'employees', 'stations', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'schedule' && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2">
            <WeekToolbar />
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-md border border-slate-200 p-0.5">
                {(['week', 'day'] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                      view === v ? 'bg-slate-800 text-white' : 'text-slate-500'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                className="btn-outline"
                onClick={() => setPrinting(true)}
                disabled={!weekData}
              >
                🖨 Print
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4">
        {tab === 'schedule' &&
          (weekData ? (
            view === 'week' ? (
              <WeekView />
            ) : (
              <DayView />
            )
          ) : (
            <EmptyState />
          ))}
        {tab === 'employees' && <EmployeesPage />}
        {tab === 'stations' && <StationsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      {printing && <PrintView onClose={() => setPrinting(false)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center text-slate-400">
      No week yet. Create one from the toolbar, or import a CSV in Settings.
    </div>
  );
}

function WeekToolbar() {
  const { weeks, currentWeekId, selectWeek } = useSchedule();
  const [busy, setBusy] = useState(false);
  const current = weeks.find((w) => w.id === currentWeekId);

  // Keep the select in sync; nothing to do here beyond rendering.
  useEffect(() => {}, [currentWeekId]);

  async function newWeek(copy: boolean) {
    setBusy(true);
    try {
      // Next week = 7 days after the most recent existing week (or today).
      const latest = weeks[0];
      const start = latest ? addDays(latest.startDate, 7) : new Date().toISOString().slice(0, 10);
      const week = await api.createWeek(start);
      if (copy && latest) {
        await api.copyWeek(week.id, latest.id, { shifts: true, assignments: false });
      }
      // The store loads its week list on mount and auto-selects the newest week,
      // so a reload is the simplest way to surface the new week everywhere.
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        value={currentWeekId ?? ''}
        onChange={(e) => selectWeek(Number(e.target.value))}
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            Week of {w.startDate}
          </option>
        ))}
      </select>
      {current && <span className="hidden text-xs text-slate-400 sm:inline">Sun–Sat</span>}
      <button className="btn-outline" onClick={() => newWeek(false)} disabled={busy}>
        + New
      </button>
      <button className="btn-outline" onClick={() => newWeek(true)} disabled={busy || weeks.length === 0}>
        Copy previous
      </button>
    </div>
  );
}
