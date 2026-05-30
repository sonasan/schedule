import type {
  Affinity,
  Assignment,
  Employee,
  ImportReport,
  Settings,
  Shift,
  Station,
  Week,
} from '../shared/types.ts';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
      const err = new Error(message) as Error & { code?: string };
      err.code = body.code;
      throw err;
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
      throw new Error(message);
    }
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface WeekData {
  week: Week;
  shifts: Shift[];
  assignments: Assignment[];
}

export const api = {
  getSettings: () => req<Settings>('/api/settings'),
  updateSettings: (s: Partial<Settings>) =>
    req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),

  listEmployees: () => req<Employee[]>('/api/employees'),
  createEmployee: (e: Partial<Employee> & { name: string }) =>
    req<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(e) }),
  updateEmployee: (id: number, e: Partial<Employee>) =>
    req<Employee>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(e) }),

  listStations: () => req<Station[]>('/api/stations'),
  createStation: (s: Partial<Station> & { name: string }) =>
    req<Station>('/api/stations', { method: 'POST', body: JSON.stringify(s) }),
  updateStation: (id: number, s: Partial<Station>) =>
    req<Station>(`/api/stations/${id}`, { method: 'PUT', body: JSON.stringify(s) }),
  deleteStation: (id: number) => req<void>(`/api/stations/${id}`, { method: 'DELETE' }),

  listAffinity: () => req<Affinity[]>('/api/affinity'),

  listWeeks: () => req<Week[]>('/api/weeks'),
  createWeek: (startDate: string) =>
    req<Week>('/api/weeks', { method: 'POST', body: JSON.stringify({ startDate }) }),
  getWeekData: (id: number) => req<WeekData>(`/api/weeks/${id}/data`),

  saveShift: (weekId: number, shift: Partial<Shift> & { employeeId: number; dayIndex: number; state: Shift['state'] }) =>
    req<Shift>(`/api/weeks/${weekId}/shifts`, { method: 'PUT', body: JSON.stringify(shift) }),
  deleteShift: (weekId: number, employeeId: number, dayIndex: number) =>
    req<void>(`/api/weeks/${weekId}/shifts`, {
      method: 'DELETE',
      body: JSON.stringify({ employeeId, dayIndex }),
    }),

  saveAssignment: (
    weekId: number,
    a: Pick<Assignment, 'dayIndex' | 'stationId' | 'employeeIds' | 'note'>,
  ) =>
    req<Assignment>(`/api/weeks/${weekId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify(a),
    }),

  copyWeek: (targetId: number, sourceId: number, opts: { shifts?: boolean; assignments?: boolean }) =>
    req<WeekData>(`/api/weeks/${targetId}/copy-from/${sourceId}`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  importCsv: (csv: string) =>
    req<ImportReport>('/api/import', { method: 'POST', body: JSON.stringify({ csv }) }),
};
