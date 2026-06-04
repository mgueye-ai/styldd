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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtTime(hour: number, minute: number) {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${h}${m} ${ampm}`;
}

/** Auto-generates a human-readable hours string from BookingHours data. */
export function generateHoursText(h: BookingHours): string {
  const openTime = fmtTime(h.slotDayStartHour, h.slotDayStartMinute);
  const closeTime = fmtTime(h.slotDayEndHour, h.slotDayEndMinute);
  const timeRange = `${openTime} – ${closeTime}`;

  const openDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !h.closedWeekdays.includes(d));
  const closedDays = h.closedWeekdays;

  if (openDays.length === 0) return 'Closed';
  if (openDays.length === 7) return `Daily: ${timeRange}`;

  // Build consecutive runs for open days
  const runs: string[] = [];
  let runStart = openDays[0];
  let prev = openDays[0];
  for (let i = 1; i <= openDays.length; i++) {
    const cur = openDays[i];
    if (cur === prev + 1) { prev = cur; continue; }
    runs.push(runStart === prev ? DAY_NAMES[runStart] : `${DAY_NAMES[runStart]}–${DAY_NAMES[prev]}`);
    runStart = cur;
    prev = cur;
  }

  const openLabel = runs.join(', ');
  const closedLabel = closedDays.map((d) => DAY_NAMES[d]).join(', ');
  const closedSuffix = closedDays.length > 0 ? `, Closed ${closedLabel}` : '';

  return `${openLabel}: ${timeRange}${closedSuffix}`;
}
