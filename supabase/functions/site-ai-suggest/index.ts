import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SiteAiInput = {
  businessName: string;
  specialty: string;
  city?: string;
  state?: string;
  serviceArea?: string;
  instagramHandle?: string;
};

type SiteAiSuggestions = {
  taglineLeft: string;
  taglineRightLine1: string;
  taglineRightLine2: string;
  serviceArea: string;
  aboutBody: string;
  reelsBlurb: string;
  metaDescription: string;
  visitBody: string;
};

function buildPrompt(input: SiteAiInput): string {
  return `Create website copy for a hair stylist / salon booking site.

Business name: ${input.businessName || 'Unknown'}
Specialty: ${input.specialty || 'General hair services'}
City: ${input.city || ''}
State: ${input.state || ''}
Existing service area note: ${input.serviceArea || ''}
Instagram: ${input.instagramHandle || ''}

Return JSON only with these exact keys:
- taglineLeft (short phrase, 2-4 words, e.g. "Book with")
- taglineRightLine1 (name or brand highlight, 1-3 words)
- taglineRightLine2 (short punchy word, e.g. "today", "studio", "salon")
- serviceArea (1-2 friendly sentences about where they serve and how to reach out)
- aboutBody (2-3 sentences about the business and booking)
- reelsBlurb (1 sentence inviting clients to browse styles and book)
- metaDescription (under 160 chars for SEO)
- visitBody (1 sentence about location / visiting)

Tone: warm, professional, modern. Avoid clichés. Keep it concise.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input = (await req.json()) as SiteAiInput;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You write concise, friendly copy for independent hair stylists and salons. Always respond with valid JSON matching the requested schema.',
          },
          { role: 'user', content: buildPrompt(input) },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      return new Response(JSON.stringify({ error: 'OpenAI request failed', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completion = await openaiResponse.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') {
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(raw) as Partial<SiteAiSuggestions>;
    const suggestions: SiteAiSuggestions = {
      taglineLeft: String(parsed.taglineLeft ?? 'Book with').trim(),
      taglineRightLine1: String(parsed.taglineRightLine1 ?? input.businessName.split(/\s+/)[0] ?? 'your').trim(),
      taglineRightLine2: String(parsed.taglineRightLine2 ?? 'today').trim(),
      serviceArea: String(parsed.serviceArea ?? '').trim(),
      aboutBody: String(parsed.aboutBody ?? '').trim(),
      reelsBlurb: String(parsed.reelsBlurb ?? '').trim(),
      metaDescription: String(parsed.metaDescription ?? '').trim(),
      visitBody: String(parsed.visitBody ?? '').trim(),
    };

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
