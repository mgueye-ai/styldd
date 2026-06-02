export type Period = 'day' | 'week' | 'month' | 'year' | 'all';

export type PeriodOption = {
  key: Period;
  label: string;
  revenueLabel: string;
  revenueValue: number;
};

export type SiteAnalytics = {
  chartTitle: string;
  chartValues: number[];
  chartLabels: string[];
  totalViews: number;
  bookings: number;
  conversion: string;
  avgSession: string;
  periodSub: string;
  trafficSources: { label: string; pct: number; color: string }[];
  topServices: { name: string; count: number }[];
};

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'day', label: 'Day', revenueLabel: "Today's revenue", revenueValue: 620 },
  { key: 'week', label: 'Week', revenueLabel: "This week's revenue", revenueValue: 2140 },
  { key: 'month', label: 'Month', revenueLabel: "This month's revenue", revenueValue: 7760 },
  { key: 'year', label: 'Year', revenueLabel: "This year's revenue", revenueValue: 74320 },
  { key: 'all', label: 'All time', revenueLabel: 'All-time revenue', revenueValue: 193800 },
];

export const SITE_ANALYTICS_BY_PERIOD: Record<Period, SiteAnalytics> = {
  day: {
    chartTitle: 'Views today',
    chartValues: [12, 18, 24, 31, 28, 22, 19, 15],
    chartLabels: ['8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'],
    totalViews: 169,
    bookings: 2,
    conversion: '1.2%',
    avgSession: '58s',
    periodSub: 'today',
    trafficSources: [
      { label: 'Instagram', pct: 61, color: '#c97bea' },
      { label: 'Direct link', pct: 24, color: '#fc61a3' },
      { label: 'Google search', pct: 10, color: '#4ade80' },
      { label: 'Other', pct: 5, color: '#a1a1aa' },
    ],
    topServices: [
      { name: 'Fulani Braids', count: 1 },
      { name: 'Boho Braids', count: 1 },
    ],
  },
  week: {
    chartTitle: 'Views this week',
    chartValues: [18, 24, 31, 28, 35, 42, 38],
    chartLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    totalViews: 216,
    bookings: 8,
    conversion: '3.7%',
    avgSession: '1m 12s',
    periodSub: 'this week',
    trafficSources: [
      { label: 'Instagram', pct: 58, color: '#c97bea' },
      { label: 'Direct link', pct: 26, color: '#fc61a3' },
      { label: 'Google search', pct: 11, color: '#4ade80' },
      { label: 'Other', pct: 5, color: '#a1a1aa' },
    ],
    topServices: [
      { name: 'Knotless Braids', count: 3 },
      { name: 'Fulani Braids', count: 2 },
      { name: 'Boho Braids', count: 2 },
      { name: 'Quick Weave', count: 1 },
    ],
  },
  month: {
    chartTitle: 'Views this month',
    chartValues: [42, 67, 55, 88, 110, 93, 75],
    chartLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    totalViews: 842,
    bookings: 36,
    conversion: '4.3%',
    avgSession: '1m 42s',
    periodSub: 'this month',
    trafficSources: [
      { label: 'Instagram', pct: 54, color: '#c97bea' },
      { label: 'Direct link', pct: 28, color: '#fc61a3' },
      { label: 'Google search', pct: 12, color: '#4ade80' },
      { label: 'Other', pct: 6, color: '#a1a1aa' },
    ],
    topServices: [
      { name: 'Knotless Braids', count: 14 },
      { name: 'Fulani Braids', count: 10 },
      { name: 'Boho Braids', count: 8 },
      { name: 'Quick Weave', count: 4 },
    ],
  },
  year: {
    chartTitle: 'Views this year',
    chartValues: [1680, 1920, 2140, 2680],
    chartLabels: ['Q1', 'Q2', 'Q3', 'Q4'],
    totalViews: 8420,
    bookings: 368,
    conversion: '4.4%',
    avgSession: '1m 45s',
    periodSub: 'this year',
    trafficSources: [
      { label: 'Instagram', pct: 49, color: '#c97bea' },
      { label: 'Direct link', pct: 31, color: '#fc61a3' },
      { label: 'Google search', pct: 13, color: '#4ade80' },
      { label: 'Other', pct: 7, color: '#a1a1aa' },
    ],
    topServices: [
      { name: 'Knotless Braids', count: 142 },
      { name: 'Fulani Braids', count: 98 },
      { name: 'Boho Braids', count: 76 },
      { name: 'Quick Weave', count: 52 },
    ],
  },
  all: {
    chartTitle: 'Views all time',
    chartValues: [4200, 6100, 8420, 9680],
    chartLabels: ['2022', '2023', '2024', '2025'],
    totalViews: 19380,
    bookings: 892,
    conversion: '4.6%',
    avgSession: '1m 51s',
    periodSub: 'all time',
    trafficSources: [
      { label: 'Instagram', pct: 47, color: '#c97bea' },
      { label: 'Direct link', pct: 33, color: '#fc61a3' },
      { label: 'Google search', pct: 14, color: '#4ade80' },
      { label: 'Other', pct: 6, color: '#a1a1aa' },
    ],
    topServices: [
      { name: 'Knotless Braids', count: 318 },
      { name: 'Fulani Braids', count: 241 },
      { name: 'Boho Braids', count: 186 },
      { name: 'Quick Weave', count: 147 },
    ],
  },
};

export function getPeriodOption(period: Period) {
  return PERIOD_OPTIONS.find((option) => option.key === period)!;
}

export function getSiteAnalytics(period: Period) {
  return SITE_ANALYTICS_BY_PERIOD[period];
}
