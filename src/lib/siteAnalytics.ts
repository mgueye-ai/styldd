import { supabase } from './supabase';

export type TopPage = {
  path: string;
  views: number;
};

export type Referrer = {
  source: string;
  count: number;
};

export type DailyPoint = {
  date: string;     // 'YYYY-MM-DD'
  views: number;
  sessions: number;
};

export type DeviceBreakdown = {
  mobile: number;   // percentage 0-100
  tablet: number;
  desktop: number;
};

export type AnalyticsSummary = {
  subdomain: string | null;
  views7d: number;
  views30d: number;
  sessions7d: number;
  sessions30d: number;
  topPages: TopPage[];
  referrers: Referrer[];
  devices: DeviceBreakdown;
  dailyTrend: DailyPoint[];
};

const EMPTY: AnalyticsSummary = {
  subdomain: null,
  views7d: 0,
  views30d: 0,
  sessions7d: 0,
  sessions30d: 0,
  topPages: [],
  referrers: [],
  devices: { mobile: 0, tablet: 0, desktop: 0 },
  dailyTrend: [],
};

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const { data, error } = await supabase.functions.invoke<AnalyticsSummary & { error?: string }>(
    'analytics-summary',
    { method: 'GET' },
  );
  if (error || data?.error) return EMPTY;
  return data ?? EMPTY;
}

/** Format a path like '/booking.html' → 'Booking' or '/styles-catalog.html' → 'Styles' */
export function friendlyPath(raw: string): string {
  if (!raw || raw === '/') return 'Home';
  const name = raw.split('/').pop()?.replace('.html', '') ?? raw;
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
