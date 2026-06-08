import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TimelineClosedLayers from '../components/calendar/TimelineClosedLayers';
import { CalendarStackParamList } from '../navigation/CalendarNavigator';
import { useSiteData } from '../context/SiteDataContext';
import { isWeekdayClosed } from '../lib/bookingAvailability';
import { BlockedInterval, loadBlockedIntervals } from '../lib/siteAdmin';
import { toDateKey } from '../lib/siteData';
import {
  BookingHours,
  DEFAULT_BOOKING_HOURS,
  loadBookingHours,
} from '../lib/siteServices';
import { colors } from '../theme';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarHome'>;
type CalendarEvent = import('../data/calendarEvents').CalendarEvent;
type ViewMode = 'day' | 'week' | 'month';

// ─── day-view constants (unchanged) ──────────────────────────────────────────
const HOUR_HEIGHT = 56;
const TIMELINE_START = 0;
const TIMELINE_END = 23;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── week-view constants ──────────────────────────────────────────────────────
const WEEK_HOUR_HEIGHT = 28;
const WEEK_TIMELINE_START = 7;   // start at 7 AM to keep the view compact
const WEEK_TIMELINE_END = 21;

// ─── helpers ─────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  next.setDate(1);
  return next;
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleString('default', { month: 'long' });
  const endMonth = weekEnd.toLocaleString('default', { month: 'long' });
  const year = weekStart.getFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} – ${weekEnd.getDate()} ${year}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()} ${year}`;
}

function formatMonthYear(date: Date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
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

// ─── day-view position helpers (unchanged) ───────────────────────────────────
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

// ─── week-view helpers ────────────────────────────────────────────────────────
function getWeekEventTop(event: CalendarEvent) {
  const startMinutes = event.startHour * 60 + event.startMinute;
  const timelineStartMinutes = WEEK_TIMELINE_START * 60;
  return Math.max(0, ((startMinutes - timelineStartMinutes) / 60) * WEEK_HOUR_HEIGHT);
}

function getWeekEventHeight(event: CalendarEvent) {
  const startMinutes = Math.max(event.startHour * 60 + event.startMinute, WEEK_TIMELINE_START * 60);
  const endMinutes = Math.min(event.endHour * 60 + event.endMinute, (WEEK_TIMELINE_END + 1) * 60);
  return Math.max(((endMinutes - startMinutes) / 60) * WEEK_HOUR_HEIGHT, 16);
}

// ─── WeekView ─────────────────────────────────────────────────────────────────
function WeekView({
  weekDays,
  today,
  selectedDate,
  bookingHours,
  blocks,
  getEvents,
  onEventPress,
  onDayPress,
}: {
  weekDays: Date[];
  today: Date;
  selectedDate: Date;
  bookingHours: BookingHours;
  blocks: BlockedInterval[];
  getEvents: (key: string) => CalendarEvent[];
  onEventPress: (id: string) => void;
  onDayPress: (day: Date) => void;
}) {
  const timelineHeight = (WEEK_TIMELINE_END - WEEK_TIMELINE_START + 1) * WEEK_HOUR_HEIGHT;
  const hours = Array.from(
    { length: WEEK_TIMELINE_END - WEEK_TIMELINE_START + 1 },
    (_, i) => WEEK_TIMELINE_START + i,
  );
  const currentHour = new Date().getHours();

  return (
    <ScrollView
      style={wkStyles.scroll}
      contentContainerStyle={wkStyles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Day header row */}
      <View style={wkStyles.dayHeaderRow}>
        <View style={wkStyles.timeGutter} />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const isClosed = isWeekdayClosed(day, bookingHours);
          return (
            <Pressable
              key={toDateKey(day)}
              style={wkStyles.dayHeaderCell}
              onPress={() => onDayPress(day)}
            >
              <Text
                style={[
                  wkStyles.dayHeaderLabel,
                  isToday && wkStyles.dayHeaderToday,
                  isClosed && wkStyles.dayHeaderClosed,
                ]}
              >
                {DAY_LABELS[i]}
              </Text>
              <View style={[wkStyles.dayHeaderNum, isSelected && wkStyles.dayHeaderNumSelected, isToday && !isSelected && wkStyles.dayHeaderNumToday]}>
                <Text
                  style={[
                    wkStyles.dayHeaderNumText,
                    isSelected && wkStyles.dayHeaderNumTextSelected,
                    isClosed && wkStyles.dayHeaderClosed,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Timeline grid */}
      <View style={[wkStyles.grid, { height: timelineHeight }]}>
        {/* Time gutter */}
        <View style={wkStyles.timeGutter}>
          {hours.map((hour) => (
            <View
              key={hour}
              style={[wkStyles.hourGutterCell, { top: (hour - WEEK_TIMELINE_START) * WEEK_HOUR_HEIGHT }]}
            >
              <Text style={wkStyles.hourGutterText}>{formatHourLabel(hour)}</Text>
            </View>
          ))}
        </View>

        {/* Day columns */}
        {weekDays.map((day) => {
          const events = getEvents(toDateKey(day));
          const isCurrentDay = isSameDay(day, new Date());
          return (
            <View key={toDateKey(day)} style={wkStyles.dayCol}>
              <TimelineClosedLayers
                selectedDate={day}
                bookingHours={bookingHours}
                blocks={blocks}
                timelineStartHour={WEEK_TIMELINE_START}
                hourHeight={WEEK_HOUR_HEIGHT}
              />
              {/* Hour lines */}
              {hours.map((hour) => (
                <View
                  key={hour}
                  style={[
                    wkStyles.hourLine,
                    { top: (hour - WEEK_TIMELINE_START) * WEEK_HOUR_HEIGHT },
                  ]}
                />
              ))}
              {/* Current time indicator */}
              {isCurrentDay && currentHour >= WEEK_TIMELINE_START && currentHour <= WEEK_TIMELINE_END ? (
                <View
                  style={[
                    wkStyles.nowLine,
                    { top: (currentHour - WEEK_TIMELINE_START) * WEEK_HOUR_HEIGHT + WEEK_HOUR_HEIGHT / 2 },
                  ]}
                />
              ) : null}
              {/* Events */}
              {events.map((event) => (
                <Pressable
                  key={event.id}
                  style={[
                    wkStyles.eventBlock,
                    event.completed ? wkStyles.eventBlockCompleted : wkStyles.eventBlockPending,
                    {
                      top: getWeekEventTop(event),
                      height: getWeekEventHeight(event),
                    },
                  ]}
                  onPress={() => onEventPress(event.appointmentId)}
                >
                  <Text style={wkStyles.eventBlockTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── MonthView ────────────────────────────────────────────────────────────────
function MonthView({
  selectedDate,
  today,
  bookingHours,
  getEvents,
  onDayPress,
}: {
  selectedDate: Date;
  today: Date;
  bookingHours: BookingHours;
  getEvents: (key: string) => CalendarEvent[];
  onDayPress: (day: Date) => void;
}) {
  const monthStart = getMonthStart(selectedDate);
  const startPadding = monthStart.getDay();
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startPadding + daysInMonth) / 7) * 7;
  const weeks = totalCells / 7;

  return (
    <View style={moStyles.container}>
      {/* Column headers */}
      <View style={moStyles.colHeaders}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={moStyles.colHeaderCell}>
            <Text style={moStyles.colHeaderText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {Array.from({ length: weeks }, (_, weekIndex) => (
        <View key={weekIndex} style={moStyles.weekRow}>
          {Array.from({ length: 7 }, (_, dayIndex) => {
            const cellIndex = weekIndex * 7 + dayIndex;
            const dayOffset = cellIndex - startPadding;
            const date = dayOffset >= 0 && dayOffset < daysInMonth
              ? addDays(monthStart, dayOffset)
              : null;

            const isToday = date ? isSameDay(date, today) : false;
            const isSelected = date ? isSameDay(date, selectedDate) : false;
            const isClosed = date ? isWeekdayClosed(date, bookingHours) : false;
            const events = date ? getEvents(toDateKey(date)) : [];
            const dotColors = events.slice(0, 3).map((e) =>
              e.completed ? colors.eventCompletedBadge : colors.accentPink,
            );

            return (
              <Pressable
                key={dayIndex}
                style={moStyles.dayCell}
                onPress={() => date && onDayPress(date)}
                disabled={!date}
              >
                {date ? (
                  <>
                    <View
                      style={[
                        moStyles.dayNum,
                        isToday && moStyles.dayNumToday,
                        isSelected && !isToday && moStyles.dayNumSelected,
                      ]}
                    >
                      <Text
                        style={[
                          moStyles.dayNumText,
                          !isSameMonth(date, selectedDate) && moStyles.dayNumOtherMonth,
                          isToday && moStyles.dayNumTextToday,
                          isSelected && !isToday && moStyles.dayNumTextSelected,
                          isClosed && !isToday && !isSelected && moStyles.dayNumClosed,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    {dotColors.length > 0 ? (
                      <View style={moStyles.dotsRow}>
                        {dotColors.map((c, i) => (
                          <View key={i} style={[moStyles.dot, { backgroundColor: c }]} />
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── CalendarScreen ───────────────────────────────────────────────────────────
export default function CalendarScreen({ navigation }: Props) {
  const { linkedSite, getCalendarEventsForDateKey, hasLinkedSite, isLoading } = useSiteData();
  const [bookingHours, setBookingHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [blocks, setBlocks] = useState<BlockedInterval[]>([]);

  const refreshScheduleMeta = useCallback(async () => {
    if (!linkedSite) {
      setBookingHours(DEFAULT_BOOKING_HOURS);
      setBlocks([]);
      return;
    }
    try {
      const [hours, nextBlocks] = await Promise.all([
        loadBookingHours(linkedSite),
        loadBlockedIntervals(linkedSite),
      ]);
      setBookingHours(hours);
      setBlocks(nextBlocks);
    } catch {
      /* keep last known values */
    }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { void refreshScheduleMeta(); }, [refreshScheduleMeta]));
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('day');
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

  // Auto-scroll to current time in day view
  useEffect(() => {
    if (viewMode !== 'day' || !isSameDay(selectedDate, new Date())) return;
    const scrollOffset = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: scrollOffset, animated: true });
    });
  }, [selectedDate, currentHour, viewMode]);

  // Header navigation
  function goBack() {
    if (viewMode === 'month') {
      setSelectedDate((d) => addMonths(d, -1));
    } else {
      setSelectedDate((d) => addDays(d, -7));
    }
  }

  function goForward() {
    if (viewMode === 'month') {
      setSelectedDate((d) => addMonths(d, 1));
    } else {
      setSelectedDate((d) => addDays(d, 7));
    }
  }

  function handleMonthDayPress(day: Date) {
    setSelectedDate(day);
    setViewMode('day');
  }

  const headerLabel = viewMode === 'month'
    ? formatMonthYear(selectedDate)
    : formatWeekRange(weekStart);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.weekNav}>
          <Pressable style={styles.navButton} onPress={goBack}>
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.weekRange}>{headerLabel}</Text>
          <Pressable style={styles.navButton} onPress={goForward}>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* View mode toggle */}
        <View style={styles.viewToggle}>
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Week strip — day view only */}
        {viewMode === 'day' ? (
          <View style={styles.weekStrip}>
            {weekDays.map((day, index) => {
              const selected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isClosed = isWeekdayClosed(day, bookingHours);
              return (
                <Pressable
                  key={toDateKey(day)}
                  style={styles.dayColumn}
                  onPress={() => {
                    setSelectedDate(day);
                    setViewMode('day');
                  }}
                >
                  <View
                    style={[
                      styles.dayPill,
                      selected && styles.dayPillSelected,
                      isClosed && !selected && styles.dayPillClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        selected && styles.dayLabelSelected,
                        isClosed && !selected && styles.dayLabelClosed,
                      ]}
                    >
                      {DAY_LABELS[index]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        selected && styles.dayNumberSelected,
                        isClosed && !selected && styles.dayNumberClosed,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {isToday ? (
                      <View style={[styles.todayDot, selected && styles.todayDotSelected]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {viewMode === 'day' ? (
          <Text style={styles.hoursLegend}>Grey = closed hours · Red tint = blocked time</Text>
        ) : null}

        {viewMode === 'day' && isWeekdayClosed(selectedDate, bookingHours) ? (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>Closed today — matches your site booking hours</Text>
          </View>
        ) : null}
      </View>

      {/* ── Day view ── */}
      {viewMode === 'day' ? (
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
              <TimelineClosedLayers
                selectedDate={selectedDate}
                bookingHours={bookingHours}
                blocks={blocks}
                timelineStartHour={TIMELINE_START}
                hourHeight={HOUR_HEIGHT}
              />

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
                      : 'Grey = closed hours · Pink = blocked time'}
                  </Text>
                </View>
              ) : null}

              {dayEvents.map((event) => (
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
                ))}
            </View>
          </View>
        </ScrollView>
      ) : null}

      {/* ── Week view ── */}
      {viewMode === 'week' ? (
        <WeekView
          weekDays={weekDays}
          today={today}
          selectedDate={selectedDate}
          bookingHours={bookingHours}
          blocks={blocks}
          getEvents={getCalendarEventsForDateKey}
          onEventPress={(id) => navigation.navigate('AppointmentDetail', { appointmentId: id })}
          onDayPress={(day) => {
            setSelectedDate(day);
            setViewMode('day');
          }}
        />
      ) : null}

      {/* ── Month view ── */}
      {viewMode === 'month' ? (
        <ScrollView
          style={styles.timelineScroll}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <MonthView
            selectedDate={selectedDate}
            today={today}
            bookingHours={bookingHours}
            getEvents={getCalendarEventsForDateKey}
            onDayPress={handleMonthDayPress}
          />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Day-view styles (completely unchanged) ───────────────────────────────────
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
    marginBottom: 10,
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
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    alignSelf: 'center',
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.calendarSelectedDay,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.text,
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
  dayPillClosed: {
    opacity: 0.45,
  },
  dayLabelClosed: {
    textDecorationLine: 'line-through',
  },
  dayNumberClosed: {
    textDecorationLine: 'line-through',
  },
  hoursLegend: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  closedBanner: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  closedBannerText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    zIndex: 2,
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

// ─── Week-view styles ─────────────────────────────────────────────────────────
const wkStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.calendarGridLine,
  },
  timeGutter: {
    width: 44,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayHeaderLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayHeaderToday: {
    color: colors.accentPink,
  },
  dayHeaderClosed: {
    textDecorationLine: 'line-through',
    opacity: 0.45,
  },
  dayHeaderNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderNumSelected: {
    backgroundColor: colors.calendarSelectedDay,
  },
  dayHeaderNumToday: {
    backgroundColor: colors.accentPinkMuted,
  },
  dayHeaderNumText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  dayHeaderNumTextSelected: {
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    position: 'relative',
    marginTop: 4,
  },
  hourGutterCell: {
    position: 'absolute',
    width: 44,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  hourGutterText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: -6,
  },
  dayCol: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.calendarGridLine,
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.calendarGridLine,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accentPink,
    zIndex: 2,
    borderRadius: 1,
  },
  eventBlock: {
    position: 'absolute',
    left: 1,
    right: 1,
    zIndex: 2,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  eventBlockPending: {
    backgroundColor: colors.eventPending,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.eventPendingBorder,
  },
  eventBlockCompleted: {
    backgroundColor: colors.eventCompleted,
  },
  eventBlockTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
});

// ─── Month-view styles ────────────────────────────────────────────────────────
const screenWidth = Dimensions.get('window').width;

const moStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  colHeaders: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  colHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  colHeaderText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 56,
  },
  dayNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dayNumToday: {
    backgroundColor: colors.accentPink,
  },
  dayNumSelected: {
    backgroundColor: colors.calendarSelectedDay,
  },
  dayNumText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dayNumTextToday: {
    color: colors.background,
    fontWeight: '700',
  },
  dayNumTextSelected: {
    color: colors.text,
  },
  dayNumOtherMonth: {
    color: colors.textMuted,
    opacity: 0.4,
  },
  dayNumClosed: {
    textDecorationLine: 'line-through',
    opacity: 0.45,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
