import type { Shift, ShiftState } from '../shared/types.ts';
import { minutesToShort } from '../shared/time.ts';

interface StateStyle {
  label: string;
  // Tailwind classes for filled chips.
  chip: string;
  // Dot color.
  dot: string;
}

export const STATE_STYLES: Record<ShiftState, StateStyle> = {
  OFF: { label: 'Off', chip: 'bg-slate-100 text-slate-400 border-slate-200', dot: 'bg-slate-400' },
  ON_CALL: {
    label: 'On call',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  OPEN: { label: 'Open', chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' },
  CLOSE: {
    label: 'Close',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-600',
  },
  TIMED: {
    label: 'Timed',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  UNKNOWN: { label: '—', chip: 'bg-white text-slate-300 border-dashed border-slate-200', dot: 'bg-slate-300' },
};

// Compact text shown inside a shift cell.
export function shiftCompactLabel(shift: Shift | undefined): string {
  if (!shift || shift.state === 'UNKNOWN') return '';
  switch (shift.state) {
    case 'OFF':
      return 'OFF';
    case 'ON_CALL':
      return 'On call';
    case 'OPEN':
      return shift.endMinutes != null
        ? `Open–${minutesToShort(shift.endMinutes)}${shift.endUncertain ? '?' : ''}`
        : 'Open';
    case 'CLOSE':
      return shift.startMinutes != null
        ? `${minutesToShort(shift.startMinutes)}–close`
        : 'Close';
    case 'TIMED': {
      const s = shift.startMinutes != null ? minutesToShort(shift.startMinutes) : '?';
      const e =
        shift.endMinutes != null
          ? `${minutesToShort(shift.endMinutes)}${shift.endUncertain ? '?' : ''}`
          : '?';
      return `${s}–${e}`;
    }
    default:
      return '';
  }
}
