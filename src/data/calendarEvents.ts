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

type EventTemplate = {
  appointmentId: string;
  title: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  completed?: boolean;
};

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    appointmentId: 'completed-2',
    title: 'Quick Weave',
    startHour: 10,
    startMinute: 0,
    endHour: 11,
    endMinute: 30,
    completed: true,
  },
  {
    appointmentId: 'completed-1',
    title: 'Boho Braids',
    startHour: 12,
    startMinute: 0,
    endHour: 14,
    endMinute: 0,
    completed: true,
  },
  {
    appointmentId: 'upcoming-1',
    title: 'Fulani Braids',
    startHour: 16,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
  },
  {
    appointmentId: 'completed-1',
    title: 'Knotless Braids',
    startHour: 9,
    startMinute: 30,
    endHour: 12,
    endMinute: 0,
    completed: true,
  },
  {
    appointmentId: 'upcoming-1',
    title: 'French Braids',
    startHour: 13,
    startMinute: 0,
    endHour: 14,
    endMinute: 30,
  },
  {
    appointmentId: 'completed-2',
    title: 'Silk Press',
    startHour: 15,
    startMinute: 0,
    endHour: 16,
    endMinute: 0,
    completed: true,
  },
  {
    appointmentId: 'upcoming-1',
    title: 'Loc Retwist',
    startHour: 11,
    startMinute: 0,
    endHour: 12,
    endMinute: 30,
  },
];

const SCHEDULE_BY_OFFSET: Record<number, number[]> = {
  [-3]: [3],
  [-2]: [0, 5],
  [-1]: [0, 3],
  [0]: [0, 1, 2],
  [1]: [2, 4],
  [2]: [1, 6],
  [3]: [4],
  [4]: [2, 5],
  [5]: [6],
  [6]: [],
  [7]: [1, 3],
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

function getDayOffset(dateKey: string) {
  const target = parseDateKey(dateKey);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildEvents(dateKey: string, templateIndexes: number[]) {
  return templateIndexes.map((templateIndex, index) => {
    const template = EVENT_TEMPLATES[templateIndex];
    return {
      id: `${dateKey}-${index + 1}`,
      appointmentId: template.appointmentId,
      title: template.title,
      dateKey,
      startHour: template.startHour,
      startMinute: template.startMinute,
      endHour: template.endHour,
      endMinute: template.endMinute,
      completed: template.completed,
    };
  });
}

export function getCalendarEventsForDateKey(dateKey: string): CalendarEvent[] {
  const offset = getDayOffset(dateKey);

  if (Object.prototype.hasOwnProperty.call(SCHEDULE_BY_OFFSET, offset)) {
    return buildEvents(dateKey, SCHEDULE_BY_OFFSET[offset]);
  }

  const date = parseDateKey(dateKey);
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) {
    return [];
  }

  const seed = Number(dateKey.replace(/-/g, ''));
  const eventCount = seed % 3;
  const startIndex = seed % EVENT_TEMPLATES.length;
  const templateIndexes = Array.from({ length: eventCount }, (_, index) =>
    (startIndex + index * 2) % EVENT_TEMPLATES.length,
  );

  return buildEvents(dateKey, templateIndexes);
}

export function formatCalendarDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
