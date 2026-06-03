import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { getDepositAccountBalance } from '../_shared/unit.ts';

type WebhookPayload = {
  data?: Array<{
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, { data?: { type?: string; id?: string } }>;
  }>;
};

function tagUserId(attrs: Record<string, unknown> | undefined): string | null {
  const tags = attrs?.tags as Record<string, string> | undefined;
  return tags?.styldUserId?.trim() || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const payload = (await req.json()) as WebhookPayload;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    for (const event of payload.data ?? []) {
      const type = event.type ?? '';
      const attrs = event.attributes ?? {};
      const relCustomer = event.relationships?.customer?.data?.id;

      if (type === 'customer.created' || type === 'application.approved') {
        const userId = tagUserId(attrs) || null;
        const customerId = relCustomer || (attrs.customerId as string | undefined);
        if (!userId || !customerId) continue;

        const deposit = await fetch(
          `${Deno.env.get('UNIT_API_URL') || 'https://api.s.unit.sh'}/accounts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${Deno.env.get('UNIT_API_TOKEN')}`,
              'Content-Type': 'application/vnd.api+json',
              'X-Accept-Version': 'V2024_06',
            },
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
          },
        );
        const depositJson = await deposit.json();
        const accountId = depositJson?.data?.id as string | undefined;

        let balanceCents = 0;
        let availableCents = 0;
        if (accountId) {
          try {
            const live = await getDepositAccountBalance(accountId);
            balanceCents = live.balanceCents;
            availableCents = live.availableCents;
          } catch {
            /* ignore */
          }
        }

        await admin.from('styld_merchant_finance').upsert(
          {
            user_id: userId,
            unit_customer_id: customerId,
            unit_account_id: accountId ?? null,
            unit_application_status: 'approved',
            balance_cents: balanceCents,
            available_cents: availableCents,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      }

      if (type === 'payment.created' || type === 'payment.sent' || type === 'payment.clearing') {
        const tags = attrs.tags as Record<string, string> | undefined;
        const bookingId = tags?.bookingId;
        const subdomain = tags?.subdomain;
        const merchantUserId = tags?.merchantUserId;
        const paymentId = event.id;

        if (bookingId && subdomain && merchantUserId) {
          await admin.rpc('styld_tenant_mark_booking_paid', {
            p_subdomain: subdomain,
            p_booking_id: bookingId,
            p_payment_status: 'deposit_paid',
            p_unit_payment_id: paymentId,
          });

          await admin
            .from('styld_booking_payments')
            .update({
              payment_status: 'completed',
              unit_payment_id: paymentId,
              updated_at: new Date().toISOString(),
            })
            .eq('merchant_user_id', merchantUserId)
            .eq('booking_id', bookingId);
        }

        const styldUser = tags?.styldUserId || merchantUserId;
        if (styldUser) {
          const { data: fin } = await admin
            .from('styld_merchant_finance')
            .select('unit_account_id')
            .eq('user_id', styldUser)
            .maybeSingle();
          if (fin?.unit_account_id) {
            const live = await getDepositAccountBalance(fin.unit_account_id);
            await admin
              .from('styld_merchant_finance')
              .update({
                balance_cents: live.balanceCents,
                available_cents: live.availableCents,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', styldUser);
          }
        }
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Webhook error' }, 500);
  }
});
