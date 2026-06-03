import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await req.text();
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const type = event.type as string;
  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;

  // Handle Stripe Connect account updates
  if (type === 'account.updated') {
    const accountId = data?.id as string;
    if (!accountId) return json({ received: true });

    await supabase.from('styld_stripe_accounts').update({
      payouts_enabled: data.payouts_enabled === true,
      charges_enabled: data.charges_enabled === true,
      details_submitted: data.details_submitted === true,
      onboarding_complete: data.details_submitted === true,
      updated_at: new Date().toISOString(),
    }).eq('stripe_account_id', accountId);
  }

  // Handle successful payments → mark booking paid
  if (type === 'payment_intent.succeeded') {
    const metadata = (data?.metadata as Record<string, string>) || {};
    const subdomain = metadata.subdomain;
    const bookingId = metadata.bookingId;

    if (subdomain && bookingId) {
      await supabase.rpc('styld_tenant_mark_booking_paid', {
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_payment_status: 'deposit_paid',
        p_unit_payment_id: data?.id as string,
      }).catch((err: unknown) => console.warn('mark_booking_paid:', err));
    }
  }

  return json({ received: true });
});
