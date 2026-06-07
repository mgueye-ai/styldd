export type CalendarEvent = {
  id: string;
  appointmentId: string;
  title: string;
  dateKey: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  completed?: boolean;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCalendarDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
