import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { getDepositAccountBalance, unitJson, type UnitResource } from '../_shared/unit.ts';

type PaymentResponse = { data?: UnitResource };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const amountCents = Math.round(Number(body.amountCents));
    const description = String(body.description || 'Styld payout').slice(0, 80);

    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return jsonResponse({ error: 'Minimum payout is $1.00' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: finance, error: finErr } = await admin
      .from('styld_merchant_finance')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (finErr) throw new Error(finErr.message);
    if (!finance?.unit_account_id) {
      return jsonResponse({ error: 'Unit wallet not ready' }, 400);
    }
    if (!finance.unit_counterparty_id) {
      return jsonResponse({ error: 'Link a bank account first' }, 400);
    }

    const { availableCents } = await getDepositAccountBalance(finance.unit_account_id);
    if (amountCents > availableCents) {
      return jsonResponse({ error: 'Insufficient available balance' }, 400);
    }

    const payment = await unitJson<PaymentResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'achPayment',
          attributes: {
            amount: amountCents,
            direction: 'Debit',
            description,
            tags: { styldUserId: userData.user.id, source: 'styld_payout' },
          },
          relationships: {
            account: { data: { type: 'account', id: finance.unit_account_id } },
            counterparty: { data: { type: 'counterparty', id: finance.unit_counterparty_id } },
          },
        },
      }),
    });

    const paymentId = payment.data?.id;
    const live = await getDepositAccountBalance(finance.unit_account_id);

    await admin
      .from('styld_merchant_finance')
      .update({
        balance_cents: live.balanceCents,
        available_cents: live.availableCents,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userData.user.id);

    return jsonResponse({
      paymentId,
      status: payment.data?.attributes?.status || 'Pending',
      balanceCents: live.balanceCents,
      availableCents: live.availableCents,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Payout failed' }, 500);
  }
});
