import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { getDepositAccountBalance } from '../_shared/unit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: finance, error } = await admin
      .from('styld_merchant_finance')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!finance) {
      return jsonResponse({
        status: 'not_started',
        balanceCents: 0,
        availableCents: 0,
        payoutBankLinked: false,
      });
    }

    let balanceCents = finance.balance_cents ?? 0;
    let availableCents = finance.available_cents ?? 0;

    if (finance.unit_account_id) {
      try {
        const live = await getDepositAccountBalance(finance.unit_account_id);
        balanceCents = live.balanceCents;
        availableCents = live.availableCents;
        await admin
          .from('styld_merchant_finance')
          .update({
            balance_cents: balanceCents,
            available_cents: availableCents,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userData.user.id);
      } catch {
        /* use cached */
      }
    }

    return jsonResponse({
      status: finance.unit_application_status,
      applicationId: finance.unit_application_id,
      customerId: finance.unit_customer_id,
      accountId: finance.unit_account_id,
      balanceCents,
      availableCents,
      payoutBankLinked: Boolean(finance.unit_counterparty_id || finance.payout_bank_name),
      payoutBankName: finance.payout_bank_name,
      payoutAccountMask: finance.payout_account_mask,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Could not load wallet' }, 500);
  }
});
