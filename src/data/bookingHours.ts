export type BookingHours = {
  closedWeekdays: number[];
  slotDayEndHour: number;
  slotDayEndMinute: number;
  slotDayStartHour: number;
  slotDayStartMinute: number;
  publicHoursText: string;
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
  publicHoursText: 'Monday-Sunday: 8:00 AM - 7:30 PM',
  slotStepMinutes: 30,
  sameDayLeadMinutes: 30,
  saturdayLastStartHour: 14,
  saturdayLastStartMinute: 0,
  concurrentAppointmentCapacity: 2,
};
