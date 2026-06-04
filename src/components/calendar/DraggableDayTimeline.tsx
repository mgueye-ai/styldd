import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../theme';
import {
  formatEventTime,
  formatHourLabel,
  getOverlayHeight,
  getOverlayTop,
  HOUR_HEIGHT,
  isSameDay,
  normalizeDragRange,
  TIMELINE_END,
  TIMELINE_START,
  TimelineOverlay,
  TimeRange,
  yToMinutes,
} from './timelineUtils';

type DraggableDayTimelineProps = {
  selectedDate: Date;
  overlays: TimelineOverlay[];
  dragHint?: string;
  draftVariant?: 'block' | 'appointment';
  onSelectionComplete: (range: TimeRange) => void;
};

/** Returns true if [aStart, aEnd) overlaps [bStart, bEnd) */
function overlapsMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

export default function DraggableDayTimeline({
  selectedDate,
  overlays,
  dragHint = 'Drag on the timeline to select a time range',
  draftVariant = 'block',
  onSelectionComplete,
}: DraggableDayTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [dragging, setDragging] = useState(false);
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const dragStartRef = useRef<number | null>(null);
  const draftEndRef = useRef<number | null>(null);
  // keep a stable ref so the panResponder closure can read current overlays
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const timelineHeight = (TIMELINE_END - TIMELINE_START + 1) * HOUR_HEIGHT;
  const currentHour = new Date().getHours();
  const isToday = isSameDay(selectedDate, new Date());

  const draftOverlay = useMemo(() => {
    if (draftStart === null || draftEnd === null) return null;

    const start = Math.min(draftStart, draftEnd);
    const end = Math.max(draftStart, draftEnd);
    const safeEnd = end - start < 30 ? start + 30 : end;

    return {
      startHour: Math.floor(start / 60),
      startMinute: start % 60,
      endHour: Math.floor(safeEnd / 60),
      endMinute: safeEnd % 60,
      /** raw minute values for conflict math */
      _startMin: start,
      _endMin: safeEnd,
    };
  }, [draftStart, draftEnd]);

  useEffect(() => {
    if (!isToday) return;

    const scrollOffset = Math.max(0, (Math.max(currentHour - 1, TIMELINE_START) - TIMELINE_START) * HOUR_HEIGHT);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: scrollOffset, animated: false });
    });
  }, [selectedDate, currentHour, isToday]);

  const checkConflict = (startMin: number, endMin: number): boolean => {
    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin);
    const safeHi = hi - lo < 30 ? lo + 30 : hi;
    return overlaysRef.current.some((o) => {
      const oStart = o.startHour * 60 + o.startMinute;
      const oEnd = o.endHour * 60 + o.endMinute;
      return overlapsMinutes(lo, safeHi, oStart, oEnd);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const minutes = yToMinutes(event.nativeEvent.locationY);
          dragStartRef.current = minutes;
          draftEndRef.current = minutes;
          setDraftStart(minutes);
          setDraftEnd(minutes);
          setHasConflict(false);
          setDragging(true);
        },
        onPanResponderMove: (event) => {
          const minutes = yToMinutes(event.nativeEvent.locationY);
          draftEndRef.current = minutes;
          setDraftEnd(minutes);
          const conflict = dragStartRef.current !== null
            ? checkConflict(dragStartRef.current, minutes)
            : false;
          setHasConflict(conflict);
        },
        onPanResponderRelease: () => {
          const start = dragStartRef.current;
          const end = draftEndRef.current;
          dragStartRef.current = null;
          draftEndRef.current = null;
          setDragging(false);
          setDraftStart(null);
          setDraftEnd(null);
          setHasConflict(false);

          if (start === null || end === null) return;
          if (checkConflict(start, end)) return; // blocked — do not fire

          onSelectionComplete(normalizeDragRange(selectedDate, start, end));
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
          draftEndRef.current = null;
          setDragging(false);
          setDraftStart(null);
          setDraftEnd(null);
          setHasConflict(false);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectionComplete, selectedDate],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.dragHint}>{dragHint}</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        <View style={[styles.timeline, { height: timelineHeight }]}>
          {Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, index) => {
            const hour = TIMELINE_START + index;
            const isCurrentHour = isToday && hour === currentHour;

            return (
              <View key={hour} style={[styles.hourRow, { top: index * HOUR_HEIGHT }]}>
                <Text style={[styles.hourLabel, isCurrentHour && styles.hourLabelCurrent]}>
                  {formatHourLabel(hour)}
                </Text>
                <View style={[styles.hourLine, isCurrentHour && styles.hourLineCurrent]} />
              </View>
            );
          })}

          {isToday && currentHour >= TIMELINE_START && currentHour <= TIMELINE_END ? (
            <View
              style={[
                styles.currentTimeLine,
                { top: (currentHour - TIMELINE_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 },
              ]}
            />
          ) : null}

          <View style={styles.eventsColumn} {...panResponder.panHandlers}>
            {overlays.map((overlay) => (
              <View
                key={overlay.id}
                style={[
                  styles.overlayCard,
                  overlay.variant === 'block' && styles.overlayBlock,
                  overlay.variant === 'completed' && styles.overlayCompleted,
                  overlay.variant === 'booking' && styles.overlayBooking,
                  {
                    top: getOverlayTop(overlay),
                    height: getOverlayHeight(overlay),
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.overlayTitle} numberOfLines={1}>
                  {overlay.title}
                </Text>
                {overlay.subtitle ? (
                  <Text style={styles.overlaySubtitle} numberOfLines={1}>
                    {overlay.subtitle}
                  </Text>
                ) : null}
              </View>
            ))}

            {draftOverlay ? (
              <View
                style={[
                  styles.draftCard,
                  hasConflict
                    ? styles.draftConflict
                    : draftVariant === 'appointment' ? styles.draftAppointment : styles.draftBlock,
                  {
                    top: getOverlayTop(draftOverlay),
                    height: getOverlayHeight(draftOverlay),
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.draftTitle, hasConflict && styles.draftConflictText]}>
                  {hasConflict ? '⚠ Conflict' : draftVariant === 'appointment' ? 'New appointment' : 'Block time'}
                </Text>
                <Text style={[styles.draftTime, hasConflict && styles.draftConflictText]}>
                  {formatEventTime(draftOverlay.startHour, draftOverlay.startMinute)} –{' '}
                  {formatEventTime(draftOverlay.endHour, draftOverlay.endMinute)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
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
    zIndex: 3,
  },
  overlayCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    opacity: 0.92,
  },
  overlayBooking: {
    backgroundColor: colors.eventPending,
    borderWidth: 1,
    borderColor: colors.eventPendingBorder,
  },
  overlayCompleted: {
    backgroundColor: colors.eventCompleted,
  },
  overlayBlock: {
    backgroundColor: 'rgba(248, 113, 113, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  overlayTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  overlaySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  draftCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 2,
    zIndex: 4,
  },
  draftBlock: {
    backgroundColor: 'rgba(248, 113, 113, 0.22)',
    borderColor: '#f87171',
  },
  draftAppointment: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPink,
  },
  draftConflict: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: '#ef4444',
    borderStyle: 'dashed',
  },
  draftConflictText: {
    color: '#ef4444',
  },
  draftTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  draftTime: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
