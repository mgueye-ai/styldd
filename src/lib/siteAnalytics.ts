import { supabase } from './supabase';

export type TopPage = {
  path: string;
  page_type: string;
  views: number;
};

export type DailyPoint = {
  day: string;   // 'YYYY-MM-DD'
  views: number;
};

export type AnalyticsSummary = {
  period_days: number;
  total_views: number;
  profile_views: number;
  booking_views: number;
  daily: DailyPoint[];
  top_pages: TopPage[];
};

export async function fetchAnalyticsSummary(days: number = 7): Promise<AnalyticsSummary | null> {
  const { data, error } = await supabase.rpc('get_site_analytics_summary', { p_days: days });
  if (error) {
    console.warn('[siteAnalytics] RPC error:', error.message);
    return null;
  }
  return (data as AnalyticsSummary) ?? null;
}

/** Format a path like '/booking' → 'Booking' or '/' → 'Home' */
export function friendlyPath(raw: string): string {
  if (!raw || raw === '/') return 'Home';
  const name = raw.split('/').pop()?.replace('.html', '') ?? raw;
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
