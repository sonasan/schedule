import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type WeekData } from './api.ts';
import type {
  Affinity,
  Assignment,
  Employee,
  Settings,
  Shift,
  Station,
  Week,
} from '../shared/types.ts';

interface ScheduleState {
  loading: boolean;
  error: string | null;
  settings: Settings | null;
  employees: Employee[];
  stations: Station[];
  affinity: Affinity[];
  weeks: Week[];
  currentWeekId: number | null;
  weekData: WeekData | null;

  selectWeek: (id: number) => Promise<void>;
  reloadWeek: () => Promise<void>;
  reloadStatic: () => Promise<void>;

  saveShift: (
    shift: Partial<Shift> & { employeeId: number; dayIndex: number; state: Shift['state'] },
  ) => Promise<void>;
  deleteShift: (employeeId: number, dayIndex: number) => Promise<void>;
  saveAssignment: (
    a: Pick<Assignment, 'dayIndex' | 'stationId' | 'employeeIds' | 'note'>,
  ) => Promise<void>;

  affinityMap: Map<string, number>;
}

const Ctx = createContext<ScheduleState | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [affinity, setAffinity] = useState<Affinity[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<number | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);

  const reloadStatic = useCallback(async () => {
    const [s, emps, sts, aff] = await Promise.all([
      api.getSettings(),
      api.listEmployees(),
      api.listStations(),
      api.listAffinity(),
    ]);
    setSettings(s);
    setEmployees(emps);
    setStations(sts);
    setAffinity(aff);
  }, []);

  const selectWeek = useCallback(async (id: number) => {
    setCurrentWeekId(id);
    const data = await api.getWeekData(id);
    setWeekData(data);
  }, []);

  const reloadWeek = useCallback(async () => {
    if (currentWeekId == null) return;
    const data = await api.getWeekData(currentWeekId);
    setWeekData(data);
  }, [currentWeekId]);

  // Initial boot: load static data + the most recent week.
  useEffect(() => {
    (async () => {
      try {
        await reloadStatic();
        const ws = await api.listWeeks();
        setWeeks(ws);
        if (ws.length > 0) {
          setCurrentWeekId(ws[0].id);
          const data = await api.getWeekData(ws[0].id);
          setWeekData(data);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveShift = useCallback(
    async (
      shift: Partial<Shift> & { employeeId: number; dayIndex: number; state: Shift['state'] },
    ) => {
      if (currentWeekId == null) return;
      const saved = await api.saveShift(currentWeekId, shift);
      setWeekData((prev) => {
        if (!prev) return prev;
        const others = prev.shifts.filter(
          (s) => !(s.employeeId === saved.employeeId && s.dayIndex === saved.dayIndex),
        );
        return { ...prev, shifts: [...others, saved] };
      });
    },
    [currentWeekId],
  );

  const deleteShift = useCallback(
    async (employeeId: number, dayIndex: number) => {
      if (currentWeekId == null) return;
      await api.deleteShift(currentWeekId, employeeId, dayIndex);
      setWeekData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shifts: prev.shifts.filter(
            (s) => !(s.employeeId === employeeId && s.dayIndex === dayIndex),
          ),
        };
      });
    },
    [currentWeekId],
  );

  const saveAssignment = useCallback(
    async (a: Pick<Assignment, 'dayIndex' | 'stationId' | 'employeeIds' | 'note'>) => {
      if (currentWeekId == null) return;
      const saved = await api.saveAssignment(currentWeekId, a);
      setWeekData((prev) => {
        if (!prev) return prev;
        const others = prev.assignments.filter(
          (x) => !(x.stationId === a.stationId && x.dayIndex === a.dayIndex),
        );
        const next =
          a.employeeIds.length === 0 ? others : [...others, saved];
        return { ...prev, assignments: next };
      });
      // Affinity changed server-side; refresh it so suggestions improve live.
      api.listAffinity().then(setAffinity).catch(() => {});
    },
    [currentWeekId],
  );

  const affinityMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of affinity) m.set(`${a.employeeId}:${a.stationId}`, a.weight);
    return m;
  }, [affinity]);

  const value: ScheduleState = {
    loading,
    error,
    settings,
    employees,
    stations,
    affinity,
    weeks,
    currentWeekId,
    weekData,
    selectWeek,
    reloadWeek,
    reloadStatic,
    saveShift,
    deleteShift,
    saveAssignment,
    affinityMap,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSchedule(): ScheduleState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
