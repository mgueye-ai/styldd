import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { unitJson } from '../_shared/unit.ts';

type ApplicationFormResponse = {
  data?: {
    id?: string;
    attributes?: {
      url?: string;
      applicationFormToken?: { token?: string };
    };
    links?: {
      related?: { href?: string; type?: string } | string;
    };
  };
};

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

    const { data: existing } = await admin
      .from('styld_merchant_finance')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.unit_account_id) {
      return jsonResponse({
        status: 'ready',
        accountId: existing.unit_account_id,
        message: 'Your Unit wallet is already set up.',
      });
    }

    const payload = await unitJson<ApplicationFormResponse>('/application-forms', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'applicationForm',
          attributes: {
            idempotencyKey: `styld-${userId}`,
            tags: { styldUserId: userId },
            allowedApplicationTypes: ['SoleProprietorship', 'SingleMemberBusiness'],
          },
        },
      }),
    });

    const formId = payload.data?.id;

    // Unit V2 response: URL lives in data.links.related.href
    // Fall back to data.attributes.url for legacy V1 responses
    const linksRelated = payload.data?.links?.related;
    const formUrl =
      (typeof linksRelated === 'object' ? linksRelated?.href : linksRelated) ??
      payload.data?.attributes?.url;

    if (!formUrl) {
      return jsonResponse({
        error: 'Unit did not return an application URL. Make sure your Unit org has Application Forms enabled in the Unit Dashboard (Org Settings → Application Form).',
        debug_keys: Object.keys(payload.data?.attributes ?? {}),
        debug_has_links: Boolean(payload.data?.links),
      }, 502);
    }

    await admin.from('styld_merchant_finance').upsert(
      {
        user_id: userId,
        unit_application_id: formId,
        unit_application_status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return jsonResponse({ status: 'pending', applicationFormUrl: formUrl, applicationFormId: formId });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Onboarding failed' }, 500);
  }
});
