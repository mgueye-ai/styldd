import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrivacyMode } from '../context/PrivacyContext';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<DashboardStackParamList, 'EarningDetails'>;

const CHART_WIDTH = Dimensions.get('window').width - 72;
const REVENUE_CHART_HEIGHT = 190;
const HOURS_CHART_HEIGHT = 120;

const REVENUE_DATA = [
  { day: '22', value: 280 },
  { day: '23', value: 150 },
  { day: '24', value: 400 },
  { day: '25', value: 200 },
  { day: '26', value: 250 },
  { day: '27', value: 180 },
  { day: '28', value: 290 },
];

const HOURS_DATA = [
  { day: '22', value: 4 },
  { day: '23', value: 7 },
  { day: '24', value: 3 },
  { day: '25', value: 5 },
  { day: '26', value: 6 },
  { day: '27', value: 4 },
  { day: '28', value: 5 },
];

const REVENUE_MAX = 400;
const REVENUE_LABELS = ['$0', '$100', '$200', '$300', '$400'];

function RevenueChart() {
  const chartInnerWidth = CHART_WIDTH - 36;
  const chartInnerHeight = REVENUE_CHART_HEIGHT - 28;
  const slotWidth = chartInnerWidth / REVENUE_DATA.length;
  const barWidth = slotWidth * 0.42;

  return (
    <Svg width={CHART_WIDTH} height={REVENUE_CHART_HEIGHT}>
      {REVENUE_LABELS.map((label, index) => {
        const y = chartInnerHeight - (index / (REVENUE_LABELS.length - 1)) * chartInnerHeight + 8;

        return (
          <SvgText
            key={label}
            x={0}
            y={y}
            fill={colors.textMuted}
            fontSize={11}
            fontWeight="500"
          >
            {label}
          </SvgText>
        );
      })}

      {REVENUE_DATA.map((item, index) => {
        const barHeight = (item.value / REVENUE_MAX) * chartInnerHeight;
        const x = 36 + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = chartInnerHeight - barHeight + 8;

        return (
          <Rect
            key={item.day}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={barWidth / 2}
            fill={colors.chartBlue}
          />
        );
      })}

      {REVENUE_DATA.map((item, index) => {
        const x = 36 + index * slotWidth + slotWidth / 2;

        return (
          <SvgText
            key={`${item.day}-label`}
            x={x}
            y={REVENUE_CHART_HEIGHT - 2}
            fill={colors.textMuted}
            fontSize={11}
            fontWeight="500"
            textAnchor="middle"
          >
            {item.day}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function WorkHoursChart() {
  const chartInnerWidth = CHART_WIDTH - 20;
  const chartInnerHeight = HOURS_CHART_HEIGHT - 24;
  const slotWidth = chartInnerWidth / (HOURS_DATA.length - 1);
  const maxHours = 8;

  const points = HOURS_DATA.map((item, index) => {
    const x = 10 + index * slotWidth;
    const y = chartInnerHeight - (item.value / maxHours) * chartInnerHeight + 8;
    return { x, y, day: item.day };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <Svg width={CHART_WIDTH} height={HOURS_CHART_HEIGHT}>
      <Path
        d={linePath}
        stroke={colors.chartTan}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point) => (
        <Circle
          key={point.day}
          cx={point.x}
          cy={point.y}
          r={3}
          fill={colors.chartTan}
        />
      ))}

      {points.map((point) => (
        <SvgText
          key={`${point.day}-label`}
          x={point.x}
          y={HOURS_CHART_HEIGHT - 2}
          fill={colors.textMuted}
          fontSize={11}
          fontWeight="500"
          textAnchor="middle"
        >
          {point.day}
        </SvgText>
      ))}

      <Line
        x1={10}
        y1={chartInnerHeight + 8}
        x2={CHART_WIDTH - 10}
        y2={chartInnerHeight + 8}
        stroke={colors.calendarGridLine}
        strokeWidth={1}
      />
    </Svg>
  );
}

export default function EarningDetailsScreen({ navigation }: Props) {
  const { privacyMode } = usePrivacyMode();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Earning Details</Text>

        <Pressable style={styles.headerButton}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Revenue</Text>
          <Text style={styles.dateRange}>May 22 - May 29, 2025</Text>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>Total: {maskMoney(1250, privacyMode)}</Text>
          </View>

          <RevenueChart />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work hours</Text>
          <Text style={styles.hoursAverage}>
            <Text style={styles.hoursAverageValue}>5 hours </Text>
            Daily Avg.
          </Text>

          <WorkHoursChart />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  dateRange: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 14,
  },
  totalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlueMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  totalBadgeText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: '600',
  },
  hoursAverage: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
  },
  hoursAverageValue: {
    color: colors.chartTan,
    fontWeight: '700',
  },
});
