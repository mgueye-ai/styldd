import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import { useSiteData } from '../../context/SiteDataContext';
import {
  BookingHours,
  DEFAULT_BOOKING_HOURS,
  loadBookingHours,
  saveBookingHours,
} from '../../lib/siteServices';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'WorkingHours'>;

type TimeField =
  | 'dayStart'
  | 'dayEnd'
  | 'saturdayLastStart';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

function formatTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dateFromTime(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function getTimeFromHours(hours: BookingHours, field: TimeField): { hour: number; minute: number } {
  switch (field) {
    case 'dayStart':
      return { hour: hours.slotDayStartHour, minute: hours.slotDayStartMinute };
    case 'dayEnd':
      return { hour: hours.slotDayEndHour, minute: hours.slotDayEndMinute };
    case 'saturdayLastStart':
      return { hour: hours.saturdayLastStartHour, minute: hours.saturdayLastStartMinute };
  }
}

function setTimeOnHours(hours: BookingHours, field: TimeField, date: Date): BookingHours {
  const hour = date.getHours();
  const minute = date.getMinutes();

  switch (field) {
    case 'dayStart':
      return { ...hours, slotDayStartHour: hour, slotDayStartMinute: minute };
    case 'dayEnd':
      return { ...hours, slotDayEndHour: hour, slotDayEndMinute: minute };
    case 'saturdayLastStart':
      return { ...hours, saturdayLastStartHour: hour, saturdayLastStartMinute: minute };
  }
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <TextInput
          style={styles.numberInput}
          keyboardType="number-pad"
          value={String(value)}
          onChangeText={(text) => {
            const parsed = Number(text.replace(/[^\d]/g, ''));
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function WorkingHoursScreen({ navigation }: Props) {
  const { linkedSite, hasLinkedSite } = useSiteData();
  const [hours, setHours] = useState<BookingHours>(DEFAULT_BOOKING_HOURS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<TimeField | null>(null);

  const refresh = useCallback(async () => {
    if (!linkedSite) return;
    setIsLoading(true);
    setError(null);
    try {
      setHours(await loadBookingHours(linkedSite));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load working hours.');
    } finally {
      setIsLoading(false);
    }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const updateHours = (next: BookingHours) => {
    setHours(next);
    setSaved(false);
  };

  const toggleWeekday = (weekday: number, open: boolean) => {
    const closed = new Set(hours.closedWeekdays);
    if (open) {
      closed.delete(weekday);
    } else {
      closed.add(weekday);
    }
    updateHours({
      ...hours,
      closedWeekdays: Array.from(closed).sort((a, b) => a - b),
    });
  };

  const save = async () => {
    if (!linkedSite) return;

    const startMinutes = hours.slotDayStartHour * 60 + hours.slotDayStartMinute;
    const endMinutes = hours.slotDayEndHour * 60 + hours.slotDayEndMinute;
    if (endMinutes <= startMinutes) {
      Alert.alert('Invalid hours', 'End time must be after start time.');
      return;
    }

    setSaving(true);
    try {
      await saveBookingHours(linkedSite, hours);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickerTime = picker ? getTimeFromHours(hours, picker) : null;

  return (
    <BusinessScreenLayout
      title="Working hours"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to edit booking hours on the public calendar."
      isLoading={hasLinkedSite && isLoading}
      error={hasLinkedSite && !isLoading ? error : null}
      onRefresh={refresh}
      headerRight={
        saving ? (
          <Text style={styles.saved}>Saving…</Text>
        ) : saved ? (
          <Text style={styles.saved}>Saved</Text>
        ) : null
      }
    >
      <BusinessSection title="Daily booking window">
        <Text style={styles.hint}>
          These times control which slots appear on your public booking site.
        </Text>
        <Pressable style={styles.field} onPress={() => setPicker('dayStart')}>
          <Text style={styles.fieldLabel}>Day starts</Text>
          <Text style={styles.fieldValue}>
            {formatTime(hours.slotDayStartHour, hours.slotDayStartMinute)}
          </Text>
        </Pressable>
        <Pressable style={styles.field} onPress={() => setPicker('dayEnd')}>
          <Text style={styles.fieldLabel}>Day ends</Text>
          <Text style={styles.fieldValue}>
            {formatTime(hours.slotDayEndHour, hours.slotDayEndMinute)}
          </Text>
        </Pressable>
      </BusinessSection>

      <BusinessSection title="Days open">
        {WEEKDAYS.map((day) => {
          const open = !hours.closedWeekdays.includes(day.value);
          return (
            <View key={day.value} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <Switch
                value={open}
                onValueChange={(value) => toggleWeekday(day.value, value)}
                trackColor={{ false: colors.cardBorder, true: colors.accentPinkMuted }}
                thumbColor={open ? colors.accentPink : colors.textMuted}
              />
            </View>
          );
        })}
      </BusinessSection>

      <BusinessSection title="Saturday">
        <Text style={styles.hint}>
          Last appointment start time on Saturdays (often earlier than other days).
        </Text>
        <Pressable style={styles.field} onPress={() => setPicker('saturdayLastStart')}>
          <Text style={styles.fieldLabel}>Last start time</Text>
          <Text style={styles.fieldValue}>
            {formatTime(hours.saturdayLastStartHour, hours.saturdayLastStartMinute)}
          </Text>
        </Pressable>
      </BusinessSection>

      <BusinessSection title="Site display">
        <Text style={styles.hint}>Shown on your public site footer and booking page.</Text>
        <TextInput
          style={styles.input}
          placeholder="Monday-Sunday: 8:00 AM - 7:30 PM"
          placeholderTextColor={colors.textMuted}
          value={hours.publicHoursText}
          onChangeText={(publicHoursText) => updateHours({ ...hours, publicHoursText })}
        />
      </BusinessSection>

      <BusinessSection title="Booking rules">
        <NumberField
          label="Slot interval"
          value={hours.slotStepMinutes}
          suffix="min"
          onChange={(slotStepMinutes) => updateHours({ ...hours, slotStepMinutes })}
        />
        <NumberField
          label="Same-day lead time"
          value={hours.sameDayLeadMinutes}
          suffix="min"
          onChange={(sameDayLeadMinutes) => updateHours({ ...hours, sameDayLeadMinutes })}
        />
        <NumberField
          label="Concurrent appointments"
          value={hours.concurrentAppointmentCapacity}
          onChange={(concurrentAppointmentCapacity) =>
            updateHours({ ...hours, concurrentAppointmentCapacity })
          }
        />
      </BusinessSection>

      <Pressable style={styles.primaryBtn} onPress={save} disabled={saving}>
        <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save to site'}</Text>
      </Pressable>

      {picker && pickerTime ? (
        <DateTimePicker
          value={dateFromTime(pickerTime.hour, pickerTime.minute)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setPicker(null);
            if (!date) return;
            updateHours(setTimeOnHours(hours, picker, date));
          }}
        />
      ) : null}
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  field: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  fieldValue: { color: colors.text, fontSize: 15 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  dayLabel: { color: colors.text, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  numberField: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberInput: {
    minWidth: 56,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  suffix: { color: colors.textMuted, fontSize: 14 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  saved: { color: colors.accentPink, fontSize: 13, fontWeight: '600' },
});
