import { useMemo } from 'react';
import { useSchedule } from './store.tsx';
import { suggestAssignments } from '../shared/suggest.ts';
import type { SuggestionProposal } from '../shared/types.ts';

// Suggested assignments for a single day, keyed by station id.
export function useDaySuggestions(dayIndex: number, includeOnCall = false): Map<number, number[]> {
  const { weekData, employees, stations, affinityMap, settings } = useSchedule();
  return useMemo(() => {
    const map = new Map<number, number[]>();
    if (!weekData || !settings) return map;
    const proposals: SuggestionProposal[] = suggestAssignments({
      stations,
      employees,
      shifts: weekData.shifts,
      dayIndex,
      affinity: affinityMap,
      openMinutes: settings.openMinutes,
      closeMinutes: settings.closeMinutes,
      includeOnCall,
    });
    for (const p of proposals) map.set(p.stationId, p.employeeIds);
    return map;
  }, [weekData, employees, stations, affinityMap, settings, dayIndex, includeOnCall]);
}

// Suggestions for all seven days: Map<dayIndex, Map<stationId, employeeIds>>.
export function useWeekSuggestions(includeOnCall = false): Map<number, Map<number, number[]>> {
  const { weekData, employees, stations, affinityMap, settings } = useSchedule();
  return useMemo(() => {
    const result = new Map<number, Map<number, number[]>>();
    if (!weekData || !settings) return result;
    for (let day = 0; day < 7; day++) {
      const proposals = suggestAssignments({
        stations,
        employees,
        shifts: weekData.shifts,
        dayIndex: day,
        affinity: affinityMap,
        openMinutes: settings.openMinutes,
        closeMinutes: settings.closeMinutes,
        includeOnCall,
      });
      const inner = new Map<number, number[]>();
      for (const p of proposals) inner.set(p.stationId, p.employeeIds);
      result.set(day, inner);
    }
    return result;
  }, [weekData, employees, stations, affinityMap, settings, includeOnCall]);
}
