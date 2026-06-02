import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import AppointmentComposerSheet from '../../components/calendar/AppointmentComposerSheet';
import CalendarWeekHeader from '../../components/calendar/CalendarWeekHeader';
import DraggableDayTimeline from '../../components/calendar/DraggableDayTimeline';
import {
  overlayFromBlock,
  TimeRange,
  TimelineOverlay,
} from '../../components/calendar/timelineUtils';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { toDateKey } from '../../lib/siteData';
import { CatalogService } from '../../data/serviceCatalog';
import { createManualBooking, loadBlockedIntervals } from '../../lib/siteAdmin';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AddAppointment'>;

export default function AddAppointmentScreen({ navigation }: Props) {
  const {
    linkedSite,
    hasLinkedSite,
    clients,
    refresh,
    getCalendarEventsForDateKey,
  } = useSiteData();
  const { catalogServices, getPrice, refresh: refreshCatalog } = useServiceCatalog();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [pendingRange, setPendingRange] = useState<TimeRange | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockOverlays, setBlockOverlays] = useState<TimelineOverlay[]>([]);

  useFocusEffect(useCallback(() => { refreshCatalog(); }, [refreshCatalog]));

  const loadBlocks = useCallback(async () => {
    if (!linkedSite) {
      setBlockOverlays([]);
      return;
    }

    try {
      const blocks = await loadBlockedIntervals(linkedSite);
      const dateKey = toDateKey(selectedDate);
      setBlockOverlays(
        blocks
          .map((block) => overlayFromBlock(block, dateKey))
          .filter((overlay): overlay is TimelineOverlay => overlay !== null),
      );
    } catch {
      setBlockOverlays([]);
    }
  }, [linkedSite, selectedDate]);

  useFocusEffect(useCallback(() => { loadBlocks(); }, [loadBlocks]));

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

    return [...items, ...blockOverlays];
  }, [blockOverlays, getCalendarEventsForDateKey, selectedDateKey]);

  const openComposer = (range: TimeRange) => {
    setPendingRange(range);
    setSheetVisible(true);
  };

  const saveAppointment = async (input: {
    range: TimeRange;
    style: CatalogService;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    hairLength: string;
    isPlaceholder: boolean;
  }) => {
    if (!linkedSite) return;

    const durationMinutes = Math.max(
      30,
      Math.round((input.range.endsAt.getTime() - input.range.startsAt.getTime()) / 60000),
    );

    setSaving(true);
    try {
      await createManualBooking(linkedSite, {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        styleId: input.style.id,
        styleName: input.style.name,
        serviceAddress: input.style.venue === 'house' ? input.address : undefined,
        notes: input.isPlaceholder
          ? [input.notes, 'Placeholder slot'].filter(Boolean).join(' · ')
          : input.notes,
        appointmentStartsAt: input.range.startsAt,
        durationMinutes,
        estimatedTotal: getPrice(input.style.id),
        hairLength: input.hairLength || undefined,
      });
      await refresh();
      setSheetVisible(false);
      setPendingRange(null);
      Alert.alert('Booked', 'Manual appointment saved as confirmed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BusinessScreenLayout
      title="Add appointment"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to create manual bookings on the live calendar."
      scroll={false}
      contentStyle={styles.content}
    >
      <CalendarWeekHeader
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        hint="Drag on the timeline to pick a time, then choose a style and client."
      />

      <DraggableDayTimeline
        selectedDate={selectedDate}
        overlays={overlays}
        draftVariant="appointment"
        dragHint="Press and drag to set appointment time"
        onSelectionComplete={openComposer}
      />

      <AppointmentComposerSheet
        visible={sheetVisible}
        range={pendingRange}
        catalogServices={catalogServices}
        clients={clients}
        getPrice={getPrice}
        saving={saving}
        onClose={() => {
          setSheetVisible(false);
          setPendingRange(null);
        }}
        onSave={saveAppointment}
      />
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingBottom: 16,
  },
});
