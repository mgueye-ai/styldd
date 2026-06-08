import {
  BookingHours,
  getDayWindowMinutes,
  isWeekdayClosed as isWeekdayClosedByNumber,
} from '../data/bookingHours';

export type BusyInterval = {
  startMs: number;
  endMs: number;
  isBlock?: boolean;
};

export type SlotKind = 'open' | 'limited' | 'full';

export type SlotClassification = {
  kind: SlotKind;
  reason: string;
};

export type ClosedRegion = {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  title: string;
  subtitle?: string;
};

function minutesOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function getTimelineBounds(hours: BookingHours) {
  let minStart = 24 * 60;
  let maxEnd = 0;

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const window = getDayWindowMinutes(hours, weekday);
    if (!window) continue;
    minStart = Math.min(minStart, window.start);
    maxEnd = Math.max(maxEnd, window.end);
  }

  if (maxEnd <= minStart) {
    return { startHour: 6, endHour: 21 };
  }

  return {
    startHour: Math.max(0, Math.floor(minStart / 60) - 1),
    endHour: Math.min(23, Math.ceil(maxEnd / 60) + 1),
  };
}

export function getTimelineBoundsForDate(hours: BookingHours, date: Date) {
  const window = getDayWindowMinutes(hours, date.getDay());
  if (!window) {
    return getTimelineBounds(hours);
  }

  return {
    startHour: Math.max(0, Math.floor(window.start / 60) - 1),
    endHour: Math.min(23, Math.ceil(window.end / 60) + 1),
  };
}

export function isWeekdayClosed(date: Date, hours: BookingHours) {
  return isWeekdayClosedByNumber(hours, date.getDay());
}

export function minAdvanceMs(hours: BookingHours) {
  return Math.max(0, hours.sameDayLeadMinutes * 60 * 1000);
}

export function leadAdvanceLabel(hours: BookingHours) {
  const mins = hours.sameDayLeadMinutes || 0;
  if (mins >= 24 * 60) {
    return `Appointments require at least ${Math.round(mins / 60)} hours advance notice.`;
  }
  return `Appointments require at least ${mins} minutes advance notice.`;
}

export function slotStartMs(date: Date, minuteOfDay: number) {
  const next = new Date(date);
  next.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return next.getTime();
}

export function generateSlotMinuteStarts(date: Date, hours: BookingHours): number[] {
  const window = getDayWindowMinutes(hours, date.getDay());
  if (!window) return [];

  const { start, end } = window;
  const step = Math.max(15, hours.slotStepMinutes || 30);
  const slots: number[] = [];

  for (let minute = start; minute <= end; minute += step) {
    slots.push(minute);
  }

  return slots;
}

function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1;
}

export function overlapCount(
  startMs: number,
  endMs: number,
  busy: BusyInterval[],
  capacity: number,
): number {
  let count = 0;
  for (const interval of busy) {
    if (!overlaps(startMs, endMs, interval.startMs, interval.endMs)) continue;
    if (interval.isBlock) return capacity;
    count += 1;
  }
  return count;
}

export function classifySlot(
  date: Date,
  slotMinute: number,
  durationMinutes: number,
  busy: BusyInterval[],
  hours: BookingHours,
  nowMs = Date.now(),
): SlotClassification {
  const startMs = slotStartMs(date, slotMinute);
  const endMs = startMs + durationMinutes * 60_000;

  if (startMs < nowMs + minAdvanceMs(hours)) {
    return { kind: 'full', reason: leadAdvanceLabel(hours) };
  }

  const capacity = Math.max(1, hours.concurrentAppointmentCapacity);
  const overlapsFound = overlapCount(startMs, endMs, busy, capacity);
  if (overlapsFound >= capacity) return { kind: 'full', reason: 'Fully booked.' };
  if (overlapsFound === capacity - 1 && capacity > 1) {
    return { kind: 'limited', reason: 'Limited — one seat left for this window.' };
  }
  return { kind: 'open', reason: '' };
}

export function dayHasBookableSlot(date: Date, hours: BookingHours, nowMs = Date.now()) {
  const minMs = nowMs + minAdvanceMs(hours);
  return generateSlotMinuteStarts(date, hours).some((minute) => slotStartMs(date, minute) >= minMs);
}

export function calendarDayDisabledReason(
  date: Date,
  hours: BookingHours,
  nowMs = Date.now(),
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  if (day < today) return 'Past dates cannot be booked.';
  if (isWeekdayClosed(date, hours)) return 'Closed this day.';
  if (!dayHasBookableSlot(date, hours, nowMs)) return leadAdvanceLabel(hours);
  return null;
}

export function buildClosedRegions(date: Date, hours: BookingHours): ClosedRegion[] {
  if (isWeekdayClosed(date, hours)) {
    return [
      {
        id: 'closed-day',
        startHour: 0,
        startMinute: 0,
        endHour: 23,
        endMinute: 59,
        title: 'Closed',
        subtitle: 'Not open this day',
      },
    ];
  }

  const window = getDayWindowMinutes(hours, date.getDay());
  if (!window) {
    return [
      {
        id: 'closed-day',
        startHour: 0,
        startMinute: 0,
        endHour: 23,
        endMinute: 59,
        title: 'Closed',
        subtitle: 'Not open this day',
      },
    ];
  }

  const { start, end } = window;
  const regions: ClosedRegion[] = [];

  if (start > 0) {
    regions.push({
      id: 'closed-before',
      startHour: 0,
      startMinute: 0,
      endHour: Math.floor(start / 60),
      endMinute: start % 60,
      title: 'Closed',
      subtitle: 'Before opening',
    });
  }

  const afterCloseMinute = end + Math.max(15, hours.slotStepMinutes || 30);
  if (afterCloseMinute < 24 * 60) {
    regions.push({
      id: 'closed-after',
      startHour: Math.floor(afterCloseMinute / 60),
      startMinute: afterCloseMinute % 60,
      endHour: 23,
      endMinute: 59,
      title: 'Closed',
      subtitle: 'After hours',
    });
  }

  return regions;
}

export function closedRegionsToOverlays(regions: ClosedRegion[]) {
  return regions.map((region) => ({
    id: region.id,
    title: region.title,
    subtitle: region.subtitle,
    startHour: region.startHour,
    startMinute: region.startMinute,
    endHour: region.endHour,
    endMinute: region.endMinute,
    variant: 'closed' as const,
  }));
}

export function isMinuteRangeInClosedRegion(
  startMinute: number,
  endMinute: number,
  regions: ClosedRegion[],
) {
  const lo = Math.min(startMinute, endMinute);
  const hi = Math.max(startMinute, endMinute);
  const safeHi = hi - lo < 30 ? lo + 30 : hi;

  return regions.some((region) => {
    const regionStart = region.startHour * 60 + region.startMinute;
    const regionEnd = region.endHour * 60 + region.endMinute;
    return overlaps(lo, safeHi, regionStart, regionEnd);
  });
}
