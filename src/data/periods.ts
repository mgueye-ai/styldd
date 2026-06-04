export type Period = 'day' | 'week' | 'month' | 'year' | 'all';

export type PeriodOption = {
  key: Period;
  label: string;
  revenueLabel: string;
  revenueValue: number;
};

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'day', label: 'Day', revenueLabel: "Today's revenue", revenueValue: 620 },
  { key: 'week', label: 'Week', revenueLabel: "This week's revenue", revenueValue: 2140 },
  { key: 'month', label: 'Month', revenueLabel: "This month's revenue", revenueValue: 7760 },
  { key: 'year', label: 'Year', revenueLabel: "This year's revenue", revenueValue: 74320 },
  { key: 'all', label: 'All time', revenueLabel: 'All-time revenue', revenueValue: 193800 },
];

export function getPeriodOption(period: Period) {
  return PERIOD_OPTIONS.find((option) => option.key === period)!;
}
