export type DayHours = {
  endHour: number;
  endMinute: number;
  startHour: number;
  startMinute: number;
};

export type WeekdayHoursMap = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>>;

export type BookingHours = {
  closedWeekdays: number[];
  slotDayEndHour: number;
  slotDayEndMinute: number;
  slotDayStartHour: number;
  slotDayStartMinute: number;
  slotStepMinutes: number;
  sameDayLeadMinutes: number;
  saturdayLastStartHour: number;
  saturdayLastStartMinute: number;
  concurrentAppointmentCapacity: number;
  /** Per-day open/close overrides (0=Sun … 6=Sat). Falls back to slotDay* when missing. */
  weekdayHours?: WeekdayHoursMap;
};

export const DEFAULT_BOOKING_HOURS: BookingHours = {
  closedWeekdays: [],
  slotDayEndHour: 19,
  slotDayEndMinute: 30,
  slotDayStartHour: 8,
  slotDayStartMinute: 0,
  slotStepMinutes: 30,
  sameDayLeadMinutes: 4320,
  saturdayLastStartHour: 14,
  saturdayLastStartMinute: 0,
  concurrentAppointmentCapacity: 2,
};

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtTime(hour: number, minute: number) {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${h}${m} ${ampm}`;
}

export function defaultDayHours(h: BookingHours): DayHours {
  return {
    startHour: h.slotDayStartHour,
    startMinute: h.slotDayStartMinute,
    endHour: h.slotDayEndHour,
    endMinute: h.slotDayEndMinute,
  };
}

export function isWeekdayClosed(h: BookingHours, weekday: number) {
  return h.closedWeekdays.includes(weekday);
}

export function getDayHours(h: BookingHours, weekday: number): DayHours | null {
  if (isWeekdayClosed(h, weekday)) return null;
  const custom = h.weekdayHours?.[weekday as keyof WeekdayHoursMap];
  return custom ?? defaultDayHours(h);
}

export function getDayWindowMinutes(
  h: BookingHours,
  weekday: number,
): { start: number; end: number } | null {
  const day = getDayHours(h, weekday);
  if (!day) return null;
  return {
    start: day.startHour * 60 + day.startMinute,
    end: day.endHour * 60 + day.endMinute,
  };
}

export function normalizeWeekdayHours(
  value: unknown,
  fallback: BookingHours,
): WeekdayHoursMap | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const source = value as Record<string, unknown>;
  const next: WeekdayHoursMap = {};

  for (const key of Object.keys(source)) {
    const weekday = Number(key);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    const entry = source[key];
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    next[weekday as keyof WeekdayHoursMap] = {
      startHour: normalizeHour(row.startHour, fallback.slotDayStartHour),
      startMinute: normalizeMinute(row.startMinute, fallback.slotDayStartMinute),
      endHour: normalizeHour(row.endHour, fallback.slotDayEndHour),
      endMinute: normalizeMinute(row.endMinute, fallback.slotDayEndMinute),
    };
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeHour(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(23, Math.max(0, Math.round(n))) : fallback;
}

function normalizeMinute(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(59, Math.max(0, Math.round(n))) : fallback;
}

export function validateBookingHours(h: BookingHours): string | null {
  for (const weekday of WEEKDAY_ORDER) {
    if (isWeekdayClosed(h, weekday)) continue;
    const window = getDayWindowMinutes(h, weekday);
    if (!window) continue;
    if (window.end <= window.start) {
      return `${DAY_NAMES[weekday]}: close time must be after open time.`;
    }
  }
  return null;
}

/** Auto-generates a human-readable hours string from BookingHours data. */
export function generateHoursText(h: BookingHours): string {
  const lines = WEEKDAY_ORDER.map((weekday) => {
    if (isWeekdayClosed(h, weekday)) {
      return `${DAY_NAMES[weekday]}: Closed`;
    }
    const day = getDayHours(h, weekday);
    if (!day) return `${DAY_NAMES[weekday]}: Closed`;
    return `${DAY_NAMES[weekday]}: ${fmtTime(day.startHour, day.startMinute)} – ${fmtTime(day.endHour, day.endMinute)}`;
  });

  return lines.join('\n');
}
