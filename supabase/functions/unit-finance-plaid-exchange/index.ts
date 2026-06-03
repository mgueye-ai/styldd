import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createUnitProcessorToken, exchangePublicToken } from '../_shared/plaid.ts';
import { unitJson, type UnitResource } from '../_shared/unit.ts';

type CounterpartyResponse = { data?: UnitResource };

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
    const publicToken = String(body.publicToken || '').trim();
    const accountId = String(body.accountId || '').trim();
    const institutionName = String(body.institutionName || 'Bank').trim();
    const accountMask = String(body.accountMask || '').trim();

    if (!publicToken || !accountId) {
      return jsonResponse({ error: 'publicToken and accountId are required' }, 400);
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

    const { accessToken } = await exchangePublicToken(publicToken);

    // Try to create a Unit counterparty (requires wallet to be fully set up).
    // If it fails, we still save the bank info so the user can see their account.
    let counterpartyId: string | null = null;
    if (finance?.unit_customer_id) {
      try {
        const processorToken = await createUnitProcessorToken(accessToken, accountId);
        const counterparty = await unitJson<CounterpartyResponse>('/counterparties', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'achCounterparty',
              attributes: {
                name: institutionName.slice(0, 50) || 'Linked bank',
                plaidProcessorToken: processorToken,
              },
              relationships: {
                customer: { data: { type: 'customer', id: finance.unit_customer_id } },
              },
            },
          }),
        });
        counterpartyId = counterparty.data?.id ?? null;
      } catch (unitErr) {
        // Swallow Unit errors — bank info is saved below; counterparty retried on next sync
        console.warn('Unit counterparty creation failed (will retry):', unitErr);
      }
    }

    // Upsert the row — create it if the user hasn't started wallet setup yet
    const now = new Date().toISOString();
    const { error: upsertErr } = await admin
      .from('styld_merchant_finance')
      .upsert(
        {
          user_id: userData.user.id,
          unit_counterparty_id: counterpartyId,
          payout_bank_name: institutionName,
          payout_account_mask: accountMask,
          updated_at: now,
        },
        { onConflict: 'user_id', ignoreDuplicates: false },
      );

    if (upsertErr) throw new Error(upsertErr.message);

    return jsonResponse({
      counterpartyId,
      bankName: institutionName,
      accountMask,
      pendingUnitSetup: !counterpartyId,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bank link failed' }, 500);
  }
});
