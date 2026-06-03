import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createUnitProcessorToken, exchangePublicToken } from '../_shared/plaid.ts';
import { unitJson, type UnitResource } from '../_shared/unit.ts';

type PaymentResponse = { data?: UnitResource };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const subdomain = String(body.subdomain || '').trim().toLowerCase();
    const bookingId = String(body.bookingId || '').trim();
    const amountCents = Math.round(Number(body.amountCents));
    const publicToken = String(body.publicToken || '').trim();
    const plaidAccountId = String(body.plaidAccountId || '').trim();
    const description = String(body.description || 'Styld booking payment').slice(0, 80);

    if (!subdomain || !bookingId || !publicToken || !plaidAccountId) {
      return jsonResponse({ error: 'subdomain, bookingId, publicToken, and plaidAccountId are required' }, 400);
    }
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      return jsonResponse({ error: 'Payment must be at least $0.50' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: siteRow } = await admin
      .from('styld_site_subdomains')
      .select('user_id, published_at')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (!siteRow?.published_at || !siteRow.user_id) {
      return jsonResponse({ error: 'Site not found or not published' }, 404);
    }

    const merchantUserId = siteRow.user_id;

    const { data: finance } = await admin
      .from('styld_merchant_finance')
      .select('*')
      .eq('user_id', merchantUserId)
      .maybeSingle();

    if (!finance?.unit_account_id) {
      return jsonResponse({
        error: 'This business has not finished payment setup yet',
        code: 'merchant_not_ready',
      }, 400);
    }

    const { accessToken, itemId } = await exchangePublicToken(publicToken);
    const processorToken = await createUnitProcessorToken(accessToken, plaidAccountId);

    const payment = await unitJson<PaymentResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'achPayment',
          attributes: {
            amount: amountCents,
            direction: 'Credit',
            description,
            plaidProcessorToken: processorToken,
            tags: {
              bookingId,
              subdomain,
              merchantUserId,
              source: 'styld_booking',
            },
          },
          relationships: {
            account: { data: { type: 'account', id: finance.unit_account_id } },
          },
        },
      }),
    });

    const paymentId = payment.data?.id;
    const payStatus = String(payment.data?.attributes?.status || 'Pending');

    await admin.from('styld_booking_payments').upsert(
      {
        merchant_user_id: merchantUserId,
        booking_id: bookingId,
        subdomain,
        amount_cents: amountCents,
        unit_payment_id: paymentId,
        payment_status: payStatus.toLowerCase() === 'clearing' || payStatus.toLowerCase() === 'sent'
          ? 'completed'
          : 'pending',
        plaid_item_id: itemId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_user_id,booking_id' },
    );

    const paid =
      payStatus.toLowerCase() === 'clearing' ||
      payStatus.toLowerCase() === 'sent' ||
      payStatus.toLowerCase() === 'pending';

    if (paid) {
      await admin.rpc('styld_tenant_mark_booking_paid', {
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_payment_status: 'deposit_paid',
        p_unit_payment_id: paymentId,
      }).catch(() => {
        /* RPC added in migration - optional */
      });
    }

    return jsonResponse({
      paymentId,
      status: payStatus,
      paid: payStatus.toLowerCase() !== 'rejected',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Payment failed' }, 500);
  }
});
