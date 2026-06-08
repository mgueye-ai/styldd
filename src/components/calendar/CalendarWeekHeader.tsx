import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingHours, isWeekdayClosed as isWeekdayClosedByNumber } from '../../data/bookingHours';
import { toDateKey } from '../../lib/siteData';
import { colors } from '../../theme';
import {
  addDays,
  DAY_LABELS,
  formatWeekRange,
  getWeekStart,
  isSameDay,
} from './timelineUtils';

type CalendarWeekHeaderProps = {
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  bookingHours?: BookingHours | null;
  closedWeekdays?: number[];
  hint?: string;
};

export default function CalendarWeekHeader({
  selectedDate,
  onSelectedDateChange,
  bookingHours = null,
  closedWeekdays = [],
  hint,
}: CalendarWeekHeaderProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View style={styles.weekNav}>
        <Pressable
          style={styles.navButton}
          onPress={() => onSelectedDateChange(addDays(selectedDate, -7))}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>

        <Pressable
          style={styles.navButton}
          onPress={() => onSelectedDateChange(addDays(selectedDate, 7))}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekStrip}>
        {weekDays.map((day, index) => {
          const selected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isClosed = bookingHours
            ? isWeekdayClosedByNumber(bookingHours, day.getDay())
            : closedWeekdays.includes(day.getDay());

          return (
            <Pressable
              key={toDateKey(day)}
              style={styles.dayColumn}
              onPress={() => onSelectedDateChange(day)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRange: {
    color: colors.text,
    fontSize: 15,
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
    paddingVertical: 10,
    borderRadius: 23,
  },
  dayPillSelected: {
    backgroundColor: colors.calendarSelectedDay,
  },
  dayPillClosed: {
    opacity: 0.45,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayLabelSelected: {
    color: colors.text,
  },
  dayNumber: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: colors.text,
  },
  dayLabelClosed: {
    textDecorationLine: 'line-through',
  },
  dayNumberClosed: {
    textDecorationLine: 'line-through',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentBlue,
    marginTop: 5,
  },
  todayDotSelected: {
    backgroundColor: colors.text,
  },
});
