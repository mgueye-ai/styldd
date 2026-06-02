import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BlockTimeSheet from '../../components/calendar/BlockTimeSheet';
import CalendarWeekHeader from '../../components/calendar/CalendarWeekHeader';
import DraggableDayTimeline from '../../components/calendar/DraggableDayTimeline';
import {
  overlayFromBlock,
  TimeRange,
  TimelineOverlay,
} from '../../components/calendar/timelineUtils';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import { useSiteData } from '../../context/SiteDataContext';
import { toDateKey } from '../../lib/siteData';
import {
  addBlockedInterval,
  BlockedInterval,
  deleteBlockedInterval,
  formatBlockRange,
  loadBlockedIntervals,
} from '../../lib/siteAdmin';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Schedule'>;

export default function ScheduleScreen({ navigation }: Props) {
  const { linkedSite, hasLinkedSite, getCalendarEventsForDateKey } = useSiteData();
  const [blocks, setBlocks] = useState<BlockedInterval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [pendingRange, setPendingRange] = useState<TimeRange | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);

  const refresh = useCallback(async () => {
    if (!linkedSite) return;
    setIsLoading(true);
    setError(null);
    try {
      setBlocks(await loadBlockedIntervals(linkedSite));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load schedule blocks.');
    } finally {
      setIsLoading(false);
    }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const selectedDateKey = toDateKey(selectedDate);

  const overlays = useMemo(() => {
    const items: TimelineOverlay[] = [];

    for (const event of getCalendarEventsForDateKey(selectedDateKey)) {
      items.push({
        id: event.id,
        title: event.title,
        subtitle: event.completed ? 'Completed' : 'Booked',
        startHour: event.startHour,
        startMinute: event.startMinute,
        endHour: event.endHour,
        endMinute: event.endMinute,
        variant: event.completed ? 'completed' : 'booking',
      });
    }

    for (const block of blocks) {
      const overlay = overlayFromBlock(block, selectedDateKey);
      if (overlay) items.push(overlay);
    }

    return items;
  }, [blocks, getCalendarEventsForDateKey, selectedDateKey]);

  const openSheet = (range: TimeRange) => {
    setPendingRange(range);
    setSheetVisible(true);
  };

  const saveBlock = async ({ range, note }: { range: TimeRange; note: string }) => {
    if (!linkedSite) return;

    setSaving(true);
    try {
      await addBlockedInterval(linkedSite, {
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        note,
      });
      setSheetVisible(false);
      setPendingRange(null);
      await refresh();
    } catch (err) {
      Alert.alert('Could not block time', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const blockFullDay = async (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    setPendingRange({ startsAt: start, endsAt: end });
    setSheetVisible(true);
  };

  const removeBlock = (block: BlockedInterval) => {
    if (!linkedSite) return;

    Alert.alert('Remove block', 'Open this time for booking again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBlockedInterval(linkedSite, block.id);
            await refresh();
          } catch (err) {
            Alert.alert('Remove failed', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <BusinessScreenLayout
      title="Schedule"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to block dates on the public booking calendar."
      isLoading={hasLinkedSite && isLoading}
      error={hasLinkedSite && !isLoading ? error : null}
      onRefresh={refresh}
      scroll={false}
      contentStyle={styles.content}
    >
      <CalendarWeekHeader
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        hint="Drag on the timeline to block time. Existing bookings show underneath."
      />

      <DraggableDayTimeline
        selectedDate={selectedDate}
        overlays={overlays}
        draftVariant="block"
        dragHint="Press and drag to block a time range"
        onSelectionComplete={openSheet}
      />

      <Pressable style={styles.blocksToggle} onPress={() => setShowBlocks((current) => !current)}>
        <Text style={styles.blocksToggleText}>
          {showBlocks ? 'Hide blocked intervals' : `View blocked intervals (${blocks.length})`}
        </Text>
        <Text style={styles.blocksToggleIcon}>{showBlocks ? '▾' : '▸'}</Text>
      </Pressable>

      {showBlocks ? (
        <ScrollView style={styles.blocksList} showsVerticalScrollIndicator={false}>
          <BusinessSection title="Blocked intervals">
            {blocks.length === 0 ? (
              <Text style={styles.empty}>No blocked intervals yet.</Text>
            ) : (
              blocks.map((block) => (
                <Pressable key={block.id} style={styles.blockRow} onPress={() => removeBlock(block)}>
                  <View style={styles.blockInfo}>
                    <Text style={styles.blockRange}>{formatBlockRange(block.startsAt, block.endsAt)}</Text>
                    {block.note ? <Text style={styles.blockNote}>{block.note}</Text> : null}
                  </View>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ))
            )}
          </BusinessSection>
        </ScrollView>
      ) : null}

      <BlockTimeSheet
        visible={sheetVisible}
        range={pendingRange}
        saving={saving}
        onClose={() => {
          setSheetVisible(false);
          setPendingRange(null);
        }}
        onConfirm={saveBlock}
        onBlockFullDay={blockFullDay}
      />
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  blocksToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  blocksToggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  blocksToggleIcon: {
    color: colors.textMuted,
    fontSize: 14,
  },
  blocksList: {
    maxHeight: 180,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    gap: 12,
  },
  blockInfo: { flex: 1 },
  blockRange: { color: colors.text, fontSize: 15, fontWeight: '500' },
  blockNote: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  remove: { color: '#f87171', fontSize: 13, fontWeight: '600' },
});
