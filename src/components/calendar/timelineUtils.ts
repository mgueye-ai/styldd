import { toDateKey } from '../../lib/siteData';

export const HOUR_HEIGHT = 56;
export const TIMELINE_START = 6;
export const TIMELINE_END = 21;
export const SNAP_MINUTES = 30;
export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type TimelineOverlay = {
  id: string;
  title: string;
  subtitle?: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  variant: 'booking' | 'block' | 'completed';
};

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

export function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleString('default', { month: 'long' });
  const endMonth = weekEnd.toLocaleString('default', { month: 'long' });
  const year = weekStart.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()} ${year}`;
  }

  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()} ${year}`;
}

export function formatHourLabel(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

export function formatEventTime(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = `${minute}`.padStart(2, '0');
  return `${displayHour}:${paddedMinute} ${period}`;
}

export function formatTimeRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })} · ${formatEventTime(startsAt.getHours(), startsAt.getMinutes())} – ${formatEventTime(
    endsAt.getHours(),
    endsAt.getMinutes(),
  )}`;
}

export function getOverlayTop(overlay: Pick<TimelineOverlay, 'startHour' | 'startMinute'>) {
  const startMinutes = overlay.startHour * 60 + overlay.startMinute;
  const timelineStartMinutes = TIMELINE_START * 60;
  return ((startMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
}

export function getOverlayHeight(
  overlay: Pick<TimelineOverlay, 'startHour' | 'startMinute' | 'endHour' | 'endMinute'>,
) {
  const startMinutes = overlay.startHour * 60 + overlay.startMinute;
  const endMinutes = overlay.endHour * 60 + overlay.endMinute;
  return Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 40);
}

export function snapMinutes(minutes: number) {
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  const min = TIMELINE_START * 60;
  const max = (TIMELINE_END + 1) * 60;
  return Math.max(min, Math.min(max, snapped));
}

export function yToMinutes(y: number) {
  return snapMinutes(TIMELINE_START * 60 + (y / HOUR_HEIGHT) * 60);
}

export function minutesToDate(date: Date, totalMinutes: number) {
  const next = new Date(date);
  next.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return next;
}

export function normalizeDragRange(
  selectedDate: Date,
  startMinutes: number,
  endMinutes: number,
): TimeRange {
  const start = Math.min(startMinutes, endMinutes);
  let end = Math.max(startMinutes, endMinutes);

  if (end - start < SNAP_MINUTES) {
    end = start + SNAP_MINUTES;
  }

  return {
    startsAt: minutesToDate(selectedDate, start),
    endsAt: minutesToDate(selectedDate, end),
  };
}

export function overlayFromBlock(
  block: { id: string; startsAt: string; endsAt: string; note: string | null },
  dateKey: string,
): TimelineOverlay | null {
  const start = new Date(block.startsAt);
  const end = new Date(block.endsAt);

  if (toDateKey(start) > dateKey || toDateKey(end) < dateKey) {
    return null;
  }

  const dayStart = new Date(start);
  if (toDateKey(dayStart) !== dateKey) {
    dayStart.setHours(TIMELINE_START, 0, 0, 0);
  }

  const dayEnd = new Date(end);
  if (toDateKey(dayEnd) !== dateKey) {
    dayEnd.setHours(TIMELINE_END + 1, 0, 0, 0);
  }

  return {
    id: block.id,
    title: block.note?.trim() || 'Blocked',
    subtitle: 'Unavailable',
    startHour: dayStart.getHours(),
    startMinute: dayStart.getMinutes(),
    endHour: dayEnd.getHours(),
    endMinute: dayEnd.getMinutes(),
    variant: 'block',
  };
}
