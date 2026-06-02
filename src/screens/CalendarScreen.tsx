import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarStackParamList } from '../navigation/CalendarNavigator';
import {
  formatCalendarDateLabel,
} from '../data/calendarEvents';
import { useSiteData } from '../context/SiteDataContext';
import { toDateKey } from '../lib/siteData';
import { colors } from '../theme';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarHome'>;

type CalendarEvent = import('../data/calendarEvents').CalendarEvent;

const HOUR_HEIGHT = 56;
const TIMELINE_START = 0;
const TIMELINE_END = 23;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleString('default', { month: 'long' });
  const endMonth = weekEnd.toLocaleString('default', { month: 'long' });
  const year = weekStart.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()} ${year}`;
  }

  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()} ${year}`;
}

function formatEventTime(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = `${minute}`.padStart(2, '0');
  return `${displayHour}:${paddedMinute} ${period}`;
}

function formatEventRange(event: CalendarEvent) {
  return `${formatEventTime(event.startHour, event.startMinute)} to ${formatEventTime(
    event.endHour,
    event.endMinute,
  )}`;
}

function getEventTop(event: CalendarEvent) {
  const startMinutes = event.startHour * 60 + event.startMinute;
  const timelineStartMinutes = TIMELINE_START * 60;
  return ((startMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
}

function getEventHeight(event: CalendarEvent) {
  const startMinutes = event.startHour * 60 + event.startMinute;
  const endMinutes = event.endHour * 60 + event.endMinute;
  return Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 52);
}

function formatHourLabel(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

export default function CalendarScreen({ navigation }: Props) {
  const { getCalendarEventsForDateKey, hasLinkedSite, isLoading } = useSiteData();
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const scrollRef = useRef<ScrollView>(null);
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const selectedDateKey = toDateKey(selectedDate);

  const dayEvents = useMemo(
    () => getCalendarEventsForDateKey(selectedDateKey),
    [getCalendarEventsForDateKey, selectedDateKey],
  );

  const timelineHeight = (TIMELINE_END - TIMELINE_START + 1) * HOUR_HEIGHT;
  const currentHour = new Date().getHours();

  useEffect(() => {
    if (!isSameDay(selectedDate, new Date())) {
      return;
    }

    const scrollOffset = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: scrollOffset, animated: true });
    });
  }, [selectedDate, currentHour]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.weekNav}>
          <Pressable
            style={styles.navButton}
            onPress={() => setSelectedDate((current) => addDays(current, -7))}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          </Pressable>

          <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>

          <Pressable
            style={styles.navButton}
            onPress={() => setSelectedDate((current) => addDays(current, 7))}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.weekStrip}>
          {weekDays.map((day, index) => {
            const selected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);

            return (
              <Pressable
                key={toDateKey(day)}
                style={styles.dayColumn}
                onPress={() => setSelectedDate(day)}
              >
                <View style={[styles.dayPill, selected && styles.dayPillSelected]}>
                  <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                    {DAY_LABELS[index]}
                  </Text>
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                    {day.getDate()}
                  </Text>
                  {isToday ? (
                    <View
                      style={[styles.todayDot, selected && styles.todayDotSelected]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.timelineScroll}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.timeline, { height: timelineHeight }]}>
          {Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, index) => {
            const hour = TIMELINE_START + index;
            const isCurrentHour = isSameDay(selectedDate, new Date()) && hour === currentHour;

            return (
              <View key={hour} style={[styles.hourRow, { top: index * HOUR_HEIGHT }]}>
                <Text style={[styles.hourLabel, isCurrentHour && styles.hourLabelCurrent]}>
                  {formatHourLabel(hour)}
                </Text>
                <View style={[styles.hourLine, isCurrentHour && styles.hourLineCurrent]} />
              </View>
            );
          })}

          {isSameDay(selectedDate, new Date()) ? (
            <View
              style={[
                styles.currentTimeLine,
                { top: currentHour * HOUR_HEIGHT + HOUR_HEIGHT / 2 },
              ]}
            />
          ) : null}

          <View style={styles.eventsColumn}>
            {dayEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>
                  {!hasLinkedSite
                    ? 'Link a site first'
                    : isLoading
                    ? 'Loading bookings'
                    : 'No bookings'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {!hasLinkedSite
                    ? 'Connect your site table from the Site tab.'
                    : formatCalendarDateLabel(selectedDateKey)}
                </Text>
              </View>
            ) : (
              dayEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [
                    styles.eventCard,
                    event.completed ? styles.eventCompleted : styles.eventPending,
                    pressed && styles.eventCardPressed,
                    {
                      top: getEventTop(event),
                      height: getEventHeight(event),
                    },
                  ]}
                  onPress={() =>
                    navigation.navigate('AppointmentDetail', {
                      appointmentId: event.appointmentId,
                    })
                  }
                >
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventTime}>{formatEventRange(event)}</Text>
                  </View>

                  {event.completed ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>Completed</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRange: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dayPill: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 23,
  },
  dayPillSelected: {
    backgroundColor: colors.calendarSelectedDay,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  dayLabelSelected: {
    color: colors.text,
  },
  dayNumber: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: colors.text,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentBlue,
    marginTop: 6,
  },
  todayDotSelected: {
    backgroundColor: colors.text,
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  timeline: {
    position: 'relative',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 52,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: -6,
  },
  hourLabelCurrent: {
    color: colors.accentBlue,
    fontWeight: '700',
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.calendarGridLine,
  },
  hourLineCurrent: {
    backgroundColor: colors.accentPinkGlow,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 52,
    right: 0,
    height: 2,
    backgroundColor: colors.accentBlue,
    zIndex: 2,
  },
  eventsColumn: {
    position: 'absolute',
    left: 60,
    right: 0,
    top: 0,
    bottom: 0,
  },
  emptyState: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  eventCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eventCompleted: {
    backgroundColor: colors.eventCompleted,
  },
  eventPending: {
    backgroundColor: colors.eventPending,
    borderWidth: 1,
    borderColor: colors.eventPendingBorder,
  },
  eventCardPressed: {
    opacity: 0.82,
  },
  eventContent: {
    flex: 1,
    paddingRight: 12,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  eventTime: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  completedBadge: {
    backgroundColor: colors.eventCompletedBadge,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 2,
  },
  completedBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
});
