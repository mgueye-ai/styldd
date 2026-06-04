import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // 'YYYY-MM-DD'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  // Get this user's subdomain
  const { data: subRow } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain')
    .eq('user_id', user.id)
    .not('published_at', 'is', null)
    .maybeSingle();

  if (!subRow?.subdomain) {
    return json({
      subdomain: null,
      views7d: 0,
      views30d: 0,
      sessions7d: 0,
      sessions30d: 0,
      topPages: [],
      referrers: [],
      devices: { mobile: 0, tablet: 0, desktop: 0 },
      dailyTrend: [],
    });
  }

  const sub = subRow.subdomain;
  const since7d  = daysAgo(7);
  const since30d = daysAgo(30);

  // Fetch all events in the last 30 days for this subdomain
  const { data: events } = await supabase
    .from('styld_analytics_events')
    .select('path, referrer, device_type, session_id, created_at')
    .eq('subdomain', sub)
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(10000);

  const rows = events ?? [];

  const since7dMs = new Date(since7d).getTime();

  const rows7d  = rows.filter((r) => new Date(r.created_at).getTime() >= since7dMs);
  const rows30d = rows;

  // Views
  const views7d  = rows7d.length;
  const views30d = rows30d.length;

  // Unique sessions
  const sessions7d  = new Set(rows7d.filter((r)  => r.session_id).map((r) => r.session_id)).size;
  const sessions30d = new Set(rows30d.filter((r) => r.session_id).map((r) => r.session_id)).size;

  // Top pages (30d)
  const pageCounts = new Map<string, number>();
  for (const r of rows30d) {
    const p = r.path ?? '/';
    pageCounts.set(p, (pageCounts.get(p) ?? 0) + 1);
  }
  const topPages = Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }));

  // Referrers (30d) — clean up empty/self refs
  const refCounts = new Map<string, number>();
  for (const r of rows30d) {
    let ref = r.referrer ?? '';
    if (!ref || ref.includes('styldd.com')) continue;
    try {
      ref = new URL(ref).hostname.replace('www.', '');
    } catch {
      ref = 'direct';
    }
    refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
  }
  const referrers = Array.from(refCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([source, count]) => ({ source, count }));

  // Devices (30d)
  const deviceMap = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
  for (const r of rows30d) {
    const d = r.device_type as keyof typeof deviceMap;
    if (d in deviceMap) deviceMap[d]++;
    else deviceMap.unknown++;
  }
  const total = rows30d.length || 1;
  const devices = {
    mobile:  Math.round((deviceMap.mobile  / total) * 100),
    tablet:  Math.round((deviceMap.tablet  / total) * 100),
    desktop: Math.round((deviceMap.desktop / total) * 100),
  };

  // Daily trend (last 30 days)
  const dailyViews   = new Map<string, number>();
  const dailySessions = new Map<string, Set<string>>();
  for (const r of rows30d) {
    const day = toDateKey(r.created_at);
    dailyViews.set(day, (dailyViews.get(day) ?? 0) + 1);
    if (r.session_id) {
      if (!dailySessions.has(day)) dailySessions.set(day, new Set());
      dailySessions.get(day)!.add(r.session_id);
    }
  }
  // Build sorted array for last 30 days (fill zeros for missing days)
  const dailyTrend: { date: string; views: number; sessions: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyTrend.push({
      date: key,
      views:    dailyViews.get(key)    ?? 0,
      sessions: dailySessions.get(key)?.size ?? 0,
    });
  }

  return json({
    subdomain: sub,
    views7d,
    views30d,
    sessions7d,
    sessions30d,
    topPages,
    referrers,
    devices,
    dailyTrend,
  });
});
