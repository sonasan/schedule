// Time helpers. Internally everything is "minutes since midnight"; these render
// friendly strings and convert to/from the picker representation.

export function minutesToLabel(mins: number | null): string {
  if (mins === null || mins === undefined) return '';
  const m = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return min === 0 ? `${h} ${period}` : `${h}:${String(min).padStart(2, '0')} ${period}`;
}

// Short form for dense grids, e.g. "4a", "12:30p".
export function minutesToShort(mins: number | null): string {
  if (mins === null || mins === undefined) return '';
  const m = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return min === 0 ? `${h}${period}` : `${h}:${String(min).padStart(2, '0')}${period}`;
}

// "16:30" (24h) <-> minutes, used by <input type="time">.
export function minutesTo24h(mins: number | null): string {
  if (mins === null || mins === undefined) return '';
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function time24hToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
