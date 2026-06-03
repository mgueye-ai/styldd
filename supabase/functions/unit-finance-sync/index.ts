import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { getDepositAccountBalance, unitJson, type UnitResource } from '../_shared/unit.ts';

type ApplicationResponse = {
  data?: UnitResource & {
    relationships?: {
      customer?: { data?: { id?: string } };
    };
  };
};

/** Resolve approval chain: application → customer → deposit account. */
async function resolveFromApplication(applicationId: string): Promise<{
  customerId?: string;
  accountId?: string;
  status?: string;
}> {
  // 1. Look up the application form to find its linked application
  const formResp = await unitJson<{ data?: UnitResource & { relationships?: Record<string, { data?: { id?: string } }> } }>(
    `/application-forms/${applicationId}`,
  ).catch(() => null);

  const linkedAppId = formResp?.data?.relationships?.application?.data?.id;

  // 2. Try the application directly
  if (linkedAppId) {
    const appResp = await unitJson<ApplicationResponse>(`/applications/${linkedAppId}`).catch(() => null);
    const appStatus = String(appResp?.data?.attributes?.status ?? '').toLowerCase();
    const customerId = appResp?.data?.relationships?.customer?.data?.id;
    if (customerId) {
      return { customerId, status: appStatus };
    }
    if (appStatus && appStatus !== 'pending') {
      return { status: appStatus };
    }
  }

  // 3. List all applications and find by tag
  const appsResp = await unitJson<{ data?: UnitResource[] }>('/applications?page[limit]=20').catch(() => null);
  for (const app of appsResp?.data ?? []) {
    const tags = app.attributes?.tags as Record<string, string> | undefined;
    if (!tags) continue;
    const appStatus = String(app.attributes?.status ?? '').toLowerCase();
    if (appStatus === 'approved' || appStatus === 'pending_review' || appStatus === 'pending') {
      const customerId = (app.relationships as Record<string, { data?: { id?: string } }>)?.customer?.data?.id;
      if (customerId) {
        return { customerId, status: appStatus };
      }
    }
  }

  return {};
}

/** Poll Unit after user completes application form in WebView. */
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

    const userId = userData.user.id;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: finance } = await admin
      .from('styld_merchant_finance')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!finance?.unit_application_id && !finance?.unit_customer_id) {
      return jsonResponse({ status: 'not_started' });
    }

    // Already have an account ID — just refresh balance
    if (finance.unit_account_id) {
      const live = await getDepositAccountBalance(finance.unit_account_id);
      await admin.from('styld_merchant_finance').update({
        balance_cents: live.balanceCents,
        available_cents: live.availableCents,
        unit_application_status: 'approved',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      return jsonResponse({ status: 'ready', accountId: finance.unit_account_id, ...live });
    }

    // We have a customer ID but no account yet — look up accounts
    let customerId = finance.unit_customer_id as string | undefined;

    if (!customerId && finance.unit_application_id) {
      const resolved = await resolveFromApplication(finance.unit_application_id);
      customerId = resolved.customerId;

      if (customerId) {
        await admin.from('styld_merchant_finance').update({
          unit_customer_id: customerId,
          unit_application_status: resolved.status || 'approved',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      } else if (resolved.status && resolved.status !== 'pending') {
        await admin.from('styld_merchant_finance').update({
          unit_application_status: resolved.status,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        return jsonResponse({
          status: resolved.status,
          message: `Application status: ${resolved.status}. Check the Unit dashboard for any required action.`,
        });
      }
    }

    if (customerId) {
      // Look for deposit accounts for this customer
      const accounts = await unitJson<{ data?: UnitResource[] }>(
        `/accounts?filter[customerId]=${customerId}&filter[type]=depositAccount`,
      ).catch(() => unitJson<{ data?: UnitResource[] }>(`/accounts?filter[customerId]=${customerId}`));

      const account = accounts.data?.[0];
      const accountId = account?.id;

      if (accountId) {
        const live = await getDepositAccountBalance(accountId);
        await admin.from('styld_merchant_finance').update({
          unit_customer_id: customerId,
          unit_account_id: accountId,
          unit_application_status: 'approved',
          balance_cents: live.balanceCents,
          available_cents: live.availableCents,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        return jsonResponse({ status: 'ready', accountId, ...live });
      }

      // Customer exists but no account yet — create one
      try {
        const newAccount = await unitJson<{ data?: UnitResource }>('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'depositAccount',
              attributes: {
                depositProduct: 'checking',
                tags: { styldUserId: userId },
              },
              relationships: {
                customer: { data: { type: 'customer', id: customerId } },
              },
            },
          }),
        });

        const newAccountId = newAccount.data?.id;
        if (newAccountId) {
          const live = await getDepositAccountBalance(newAccountId);
          await admin.from('styld_merchant_finance').update({
            unit_customer_id: customerId,
            unit_account_id: newAccountId,
            unit_application_status: 'approved',
            balance_cents: live.balanceCents,
            available_cents: live.availableCents,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
          return jsonResponse({ status: 'ready', accountId: newAccountId, ...live });
        }
      } catch {
        // Account creation failed — customer may already have one or account creation is automatic
      }

      return jsonResponse({
        status: 'approved',
        message: 'Application approved — deposit account is being set up. Tap Refresh in a moment.',
      });
    }

    return jsonResponse({
      status: finance.unit_application_status || 'pending',
      message: 'Application is still being reviewed. This usually takes a few minutes.',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Sync failed' }, 500);
  }
});
