import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EmailPreviews'>;

const EMAIL_TEMPLATES = [
  'Salon new booking',
  'Customer confirmation',
  'Appointment reminder',
  'Daily digest',
  'Deposit received',
  'Booking cancelled',
  'Booking rescheduled',
];

export default function EmailPreviewsScreen({ navigation }: Props) {
  return (
    <BusinessScreenLayout title="Email previews" onBack={() => navigation.goBack()}>
      <Text style={styles.hint}>
        Preview-only in the web admin. These templates are not sent or edited from the app.
      </Text>

      <BusinessSection title="Templates">
        {EMAIL_TEMPLATES.map((template, index) => (
          <View
            key={template}
            style={[styles.row, index < EMAIL_TEMPLATES.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.label}>{template}</Text>
            <Text style={styles.value}>Preview on web</Text>
          </View>
        ))}
      </BusinessSection>
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  label: { flex: 1, color: colors.text, fontSize: 15 },
  value: { color: colors.textMuted, fontSize: 13 },
});
