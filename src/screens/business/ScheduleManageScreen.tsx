import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppointmentComposerSheet from '../../components/calendar/AppointmentComposerSheet';
import BlockTimeSheet from '../../components/calendar/BlockTimeSheet';
import CalendarWeekHeader from '../../components/calendar/CalendarWeekHeader';
import DraggableDayTimeline from '../../components/calendar/DraggableDayTimeline';
import {
  overlayFromBlock,
  TimeRange,
  TimelineOverlay,
} from '../../components/calendar/timelineUtils';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { toDateKey } from '../../lib/siteData';
import { CatalogService } from '../../data/serviceCatalog';
import {
  addBlockedInterval,
  BlockedInterval,
  createManualBooking,
  deleteBlockedInterval,
  formatBlockRange,
  loadBlockedIntervals,
} from '../../lib/siteAdmin';
import {
  BookingHours,
  DEFAULT_BOOKING_HOURS,
  loadBookingHours,
  saveBookingHours,
} from '../../lib/siteServices';
import { generateHoursText } from '../../data/bookingHours';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

export type ScheduleTab = 'schedule' | 'hours';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ScheduleManage'>;

// ─── Tab pill bar ─────────────────────────────────────────────────────────────

const TABS: { id: ScheduleTab; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
  { id: 'hours', label: 'Hours', icon: 'time-outline' },
];

function TabBar({
  active,
  onChange,
}: {
  active: ScheduleTab;
  onChange: (tab: ScheduleTab) => void;
}) {
  return (
    <View style={tabStyles.wrap}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          style={[tabStyles.pill, active === tab.id && tabStyles.pillActive]}
          onPress={() => onChange(tab.id)}
        >
          <Ionicons
            name={tab.icon as any}
            size={14}
            color={active === tab.id ? '#fff' : colors.textMuted}
          />
          <Text style={[tabStyles.pillText, active === tab.id && tabStyles.pillTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pillActive: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
});

// ─── Combined schedule tab (book + block) ────────────────────────────────────

type ActionChoice = 'book' | 'block' | null;

function ScheduleTab() {
  const { linkedSite, clients, refresh, getCalendarEventsForDateKey } = useSiteData();
  const { catalogServices, getPrice, refresh: refreshCatalog } = useServiceCatalog();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [pendingRange, setPendingRange] = useState<TimeRange | null>(null);
  const [actionChoice, setActionChoice] = useState<ActionChoice>(null);
  const [blocks, setBlocks] = useState<BlockedInterval[]>([]);
  const [saving, setSaving] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);

  useFocusEffect(useCallback(() => { refreshCatalog(); }, [refreshCatalog]));

  const refreshBlocks = useCallback(async () => {
    if (!linkedSite) return;
    try { setBlocks(await loadBlockedIntervals(linkedSite)); } catch { /* ignore */ }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { void refreshBlocks(); }, [refreshBlocks]));

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

  const dismiss = () => { setActionChoice(null); setPendingRange(null); };

  const saveAppointment = async (input: {
    range: TimeRange; style: CatalogService; fullName: string;
    phone: string; email: string; address: string;
    notes: string; hairLength: string; isPlaceholder: boolean;
  }) => {
    if (!linkedSite) return;
    const durationMinutes = Math.max(30,
      Math.round((input.range.endsAt.getTime() - input.range.startsAt.getTime()) / 60000));
    setSaving(true);
    try {
      await createManualBooking(linkedSite, {
        fullName: input.fullName, phone: input.phone, email: input.email,
        styleId: input.style.id, styleName: input.style.name,
        serviceAddress: input.style.venue === 'house' ? input.address : undefined,
        notes: input.isPlaceholder
          ? [input.notes, 'Placeholder slot'].filter(Boolean).join(' · ')
          : input.notes,
        appointmentStartsAt: input.range.startsAt,
        durationMinutes, estimatedTotal: getPrice(input.style.id),
        hairLength: input.hairLength || undefined,
      });
      await refresh();
      dismiss();
      Alert.alert('Booked', 'Manual appointment saved as confirmed.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally { setSaving(false); }
  };

  const saveBlock = async ({ range, note }: { range: TimeRange; note: string }) => {
    if (!linkedSite) return;
    setSaving(true);
    try {
      await addBlockedInterval(linkedSite, { startsAt: range.startsAt, endsAt: range.endsAt, note });
      dismiss();
      await refreshBlocks();
    } catch (err) {
      Alert.alert('Could not block time', err instanceof Error ? err.message : 'Try again.');
    } finally { setSaving(false); }
  };

  const removeBlock = (block: BlockedInterval) => {
    if (!linkedSite) return;
    Alert.alert('Remove block', 'Open this time for booking again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await deleteBlockedInterval(linkedSite, block.id); await refreshBlocks(); }
          catch (err) { Alert.alert('Remove failed', err instanceof Error ? err.message : 'Try again.'); }
        },
      },
    ]);
  };

  const handleDragComplete = (range: TimeRange) => {
    setPendingRange(range);
    setActionChoice(null); // show the choice picker first
  };

  return (
    <View style={styles.tabContent}>
      <CalendarWeekHeader
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        hint="Drag on the timeline, then choose to book or block."
      />
      <DraggableDayTimeline
        selectedDate={selectedDate}
        overlays={overlays}
        draftVariant="appointment"
        dragHint="Press and drag to select a time"
        onSelectionComplete={handleDragComplete}
      />

      {/* Blocked intervals list */}
      <Pressable style={styles.blocksToggle} onPress={() => setShowBlocks((v) => !v)}>
        <Text style={styles.blocksToggleText}>
          {showBlocks ? 'Hide blocked times' : `Blocked times (${blocks.length})`}
        </Text>
        <Ionicons name={showBlocks ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {showBlocks && (
        <ScrollView style={styles.blocksList} showsVerticalScrollIndicator={false}>
          {blocks.length === 0
            ? <Text style={styles.empty}>No blocked times yet.</Text>
            : blocks.map((block) => (
                <Pressable key={block.id} style={styles.blockRow} onPress={() => removeBlock(block)}>
                  <View style={styles.blockInfo}>
                    <Text style={styles.blockRange}>{formatBlockRange(block.startsAt, block.endsAt)}</Text>
                    {block.note ? <Text style={styles.blockNote}>{block.note}</Text> : null}
                  </View>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ))
          }
        </ScrollView>
      )}

      {/* Action choice sheet — shown right after drag */}
      {pendingRange !== null && actionChoice === null && (
        <View style={styles.choiceSheet}>
          <View style={styles.choiceHandle} />
          <Text style={styles.choiceTitle}>
            {pendingRange.startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            {' – '}
            {pendingRange.endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.choiceSubtitle}>What would you like to do with this time?</Text>
          <View style={styles.choiceBtns}>
            <Pressable
              style={[styles.choiceBtn, styles.choiceBtnBook]}
              onPress={() => setActionChoice('book')}
            >
              <Text style={styles.choiceBtnText}>New Appointment</Text>
            </Pressable>
            <Pressable
              style={[styles.choiceBtn, styles.choiceBtnBlock]}
              onPress={() => setActionChoice('block')}
            >
              <Text style={[styles.choiceBtnText, styles.choiceBtnBlockText]}>Block Time</Text>
            </Pressable>
          </View>
          <Pressable style={styles.choiceCancel} onPress={dismiss}>
            <Text style={styles.choiceCancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <AppointmentComposerSheet
        visible={actionChoice === 'book'}
        range={pendingRange}
        catalogServices={catalogServices}
        clients={clients}
        getPrice={getPrice}
        saving={saving}
        onClose={dismiss}
        onSave={saveAppointment}
      />
      <BlockTimeSheet
        visible={actionChoice === 'block'}
        range={pendingRange}
        saving={saving}
        onClose={dismiss}
        onConfirm={saveBlock}
        onBlockFullDay={(date) => {
          const start = new Date(date); start.setHours(0, 0, 0, 0);
          const end = new Date(date); end.setHours(23, 59, 59, 999);
          setPendingRange({ startsAt: start, endsAt: end });
          setActionChoice('block');
        }}
      />
    </View>
  );
}

// ─── Hours tab ────────────────────────────────────────────────────────────────

type TimeField = 'dayStart' | 'dayEnd';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

function formatTime(hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const DAY_CHIPS = [
  { value: 1, short: 'Mo' },
  { value: 2, short: 'Tu' },
  { value: 3, short: 'We' },
  { value: 4, short: 'Th' },
  { value: 5, short: 'Fr' },
  { value: 6, short: 'Sa' },
  { value: 0, short: 'Su' },
];

function HoursTab() {
  const { linkedSite } = useSiteData();
  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<TimeField | null>(null);

  const refreshHours = useCallback(async () => {
    if (!linkedSite) return;
    try { setHours(await loadBookingHours(linkedSite)); } catch { /* ignore */ }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { void refreshHours(); }, [refreshHours]));

  const updateHours = (next: BookingHours) => { setHours(next); setSaved(false); };

  const toggleWeekday = (weekday: number) => {
    const closed = new Set(hours.closedWeekdays);
    closed.has(weekday) ? closed.delete(weekday) : closed.add(weekday);
    updateHours({ ...hours, closedWeekdays: Array.from(closed).sort((a, b) => a - b) });
  };

  const save = async () => {
    if (!linkedSite) return;
    const startMin = hours.slotDayStartHour * 60 + hours.slotDayStartMinute;
    const endMin = hours.slotDayEndHour * 60 + hours.slotDayEndMinute;
    if (endMin <= startMin) { Alert.alert('Invalid hours', 'End time must be after start time.'); return; }
    setSaving(true);
    try {
      await saveBookingHours(linkedSite, hours);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    } finally { setSaving(false); }
  };

  const getPickerTime = () => {
    if (picker === 'dayStart') return { hour: hours.slotDayStartHour, minute: hours.slotDayStartMinute };
    return { hour: hours.slotDayEndHour, minute: hours.slotDayEndMinute };
  };

  const applyPickerDate = (date: Date) => {
    const h = date.getHours(), m = date.getMinutes();
    if (picker === 'dayStart') updateHours({ ...hours, slotDayStartHour: h, slotDayStartMinute: m });
    else updateHours({ ...hours, slotDayEndHour: h, slotDayEndMinute: m });
  };

  const pt = getPickerTime();
  const pickerDate = new Date(); pickerDate.setHours(pt.hour, pt.minute, 0, 0);
  const openCount = DAY_CHIPS.filter(d => !hours.closedWeekdays.includes(d.value)).length;

  return (
    <ScrollView
      style={hStyles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={hStyles.content}
    >
      {/* Booking window card */}
      <Text style={hStyles.sectionLabel}>Booking window</Text>
      <View style={hStyles.card}>
        <Pressable style={hStyles.timeRow} onPress={() => setPicker('dayStart')}>
          <View style={hStyles.timeBody}>
            <Text style={hStyles.timeCaption}>Opens at</Text>
            <Text style={hStyles.timeValue}>{formatTime(hours.slotDayStartHour, hours.slotDayStartMinute)}</Text>
          </View>
        </Pressable>

        <View style={hStyles.cardDivider} />

        <Pressable style={hStyles.timeRow} onPress={() => setPicker('dayEnd')}>
          <View style={hStyles.timeBody}>
            <Text style={hStyles.timeCaption}>Closes at</Text>
            <Text style={hStyles.timeValue}>{formatTime(hours.slotDayEndHour, hours.slotDayEndMinute)}</Text>
          </View>
        </Pressable>
      </View>

      {/* Days open */}
      <Text style={hStyles.sectionLabel}>Days open <Text style={hStyles.sectionBadge}>{openCount} of 7</Text></Text>
      <View style={hStyles.card}>
        <View style={hStyles.dayChipRow}>
          {DAY_CHIPS.map((day) => {
            const open = !hours.closedWeekdays.includes(day.value);
            return (
              <Pressable
                key={day.value}
                style={[hStyles.dayChip, open && hStyles.dayChipOpen]}
                onPress={() => toggleWeekday(day.value)}
              >
                <Text style={[hStyles.dayChipText, open && hStyles.dayChipTextOpen]}>
                  {day.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Advance booking */}
      <Text style={hStyles.sectionLabel}>Advance booking</Text>
      <View style={hStyles.card}>
        <View style={hStyles.advanceRow}>
          <View style={hStyles.timeBody}>
            <Text style={hStyles.timeCaption}>Hours clients must book in advance</Text>
          </View>
          <View style={hStyles.advanceInputWrap}>
            <TextInput
              style={hStyles.advanceInput}
              keyboardType="number-pad"
              value={String(Math.round(hours.sameDayLeadMinutes / 60))}
              onChangeText={(t) => {
                const n = Number(t.replace(/[^\d]/g, ''));
                if (Number.isFinite(n)) updateHours({ ...hours, sameDayLeadMinutes: n * 60 });
              }}
            />
            <Text style={hStyles.advanceSuffix}>hrs</Text>
          </View>
        </View>
      </View>

      {/* Auto-generated hours preview */}
      <Text style={hStyles.sectionLabel}>Hours preview</Text>
      <View style={hStyles.card}>
        <View style={hStyles.timeRow}>
          <Text style={hStyles.hoursPreviewText}>{generateHoursText(hours)}</Text>
        </View>
      </View>

      {/* Save */}
      <Pressable style={[hStyles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={hStyles.saveBtnText}>{saved ? '✓ Saved!' : 'Save to site'}</Text>
        }
      </Pressable>

      {picker && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setPicker(null);
            if (date) applyPickerDate(date);
          }}
        />
      )}
    </ScrollView>
  );
}

const hStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 8 },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionBadge: {
    color: colors.accentPink,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 16,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  timeBody: { flex: 1 },
  timeCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
  },
  timeValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  dayChipRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 6,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayChipOpen: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  dayChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dayChipTextOpen: { color: '#fff' },

  advanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  advanceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    gap: 4,
  },
  advanceInput: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    width: 40,
    paddingVertical: 8,
    textAlign: 'center',
  },
  advanceSuffix: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },

  hoursPreviewText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },

  saveBtn: {
    marginTop: 12,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleManageScreen({ navigation, route }: Props) {
  const { hasLinkedSite } = useSiteData();
  const rawTab = route.params?.tab;
  // map legacy 'book'/'block' params to 'schedule'
  const initialTab: ScheduleTab =
    rawTab === 'hours' ? 'hours' : 'schedule';
  const [activeTab, setActiveTab] = useState<ScheduleTab>(initialTab);

  const titleMap: Record<ScheduleTab, string> = {
    schedule: 'Schedule',
    hours: 'Working hours',
  };

  return (
    <BusinessScreenLayout
      title={titleMap[activeTab]}
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to manage your schedule."
      scroll={false}
      contentStyle={styles.layoutContent}
    >
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'hours' && <HoursTab />}
    </BusinessScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingBottom: 16,
  },

  // Block list
  blocksToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  blocksToggleText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  blocksList: { maxHeight: 180, paddingHorizontal: 16 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: 12 },
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

  // action choice sheet
  choiceSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.accentPinkBorder,
    paddingBottom: 36,
    paddingHorizontal: 24,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  choiceHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentPinkBorder,
    alignSelf: 'center',
    marginBottom: 20,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  choiceSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  choiceBtns: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 14,
  },
  choiceBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  choiceBtnBook: {
    backgroundColor: 'transparent',
    borderColor: colors.accentPink,
  },
  choiceBtnBlock: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
  },
  choiceBtnText: {
    color: colors.accentPink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  choiceBtnBlockText: {
    color: colors.textMuted,
  },
  choiceCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  choiceCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

});
