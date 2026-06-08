/**
 * Shared Styld transactional email shell — matches tenant site theme + logo + Powered by Styld footer.
 */

export const STYLD_APP_ICON_URL = 'https://styldd.com/assets/styld-icon.png';
export const STYLD_SITE_URL = 'https://styldd.com';

/** Pre-filled manage/cancel link for booking confirmation emails. */
export function buildBookingManageUrl(
  siteUrl: string,
  bookingId: string,
  contact: string,
  clientName?: string,
): string {
  const base = siteUrl.replace(/\/$/, '');
  const url = new URL(`${base}/manage-booking`);
  url.searchParams.set('booking_id', bookingId);
  if (contact.trim()) url.searchParams.set('contact', contact.trim());
  if (clientName?.trim()) url.searchParams.set('name', clientName.trim());
  return url.href;
}

export type StyldEmailBranding = {
  businessName: string;
  businessCity: string;
  siteUrl: string;
  primaryColor: string;
  secondaryColor: string;
  pageBg: string;
  cardBg: string;
  innerCardBg: string;
  headerBg: string;
  textColor: string;
  mutedColor: string;
  softTextColor: string;
  borderColor: string;
  rowBorderColor: string;
  logoUrl: string | null;
  headingFont: string;
  bodyFont: string;
  isLight: boolean;
};

const DEFAULT_PRIMARY = '#db2777';
const DEFAULT_SECONDARY = '#0a0a0a';
const DEFAULT_CREAM = '#faf8f4';

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700' +
  '&family=Inter:wght@400;500;600;700' +
  '&family=Lora:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=Montserrat:wght@400;500;600;700' +
  '&family=Nunito:wght@400;500;600;700' +
  '&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=Poppins:wght@400;500;600;700' +
  '&family=Source+Sans+3:wght@400;600;700' +
  '&display=swap';

const FONT_STACKS: Record<string, { heading: string; body: string }> = {
  cormorant: { heading: 'Georgia, "Cormorant Garamond", serif', body: '"Source Sans 3", system-ui, sans-serif' },
  playfair: { heading: '"Playfair Display", Georgia, serif', body: '"Source Sans 3", system-ui, sans-serif' },
  lora: { heading: '"Lora", Georgia, serif', body: '"Source Sans 3", system-ui, sans-serif' },
  inter: { heading: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif' },
  'dm-sans': { heading: '"DM Sans", system-ui, sans-serif', body: '"DM Sans", system-ui, sans-serif' },
  poppins: { heading: 'Poppins, system-ui, sans-serif', body: 'Poppins, system-ui, sans-serif' },
  nunito: { heading: '"Nunito", system-ui, sans-serif', body: '"Nunito", system-ui, sans-serif' },
  montserrat: { heading: 'Montserrat, system-ui, sans-serif', body: 'Montserrat, system-ui, sans-serif' },
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(base: string, target: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  if (!a || !b) return base;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

function primaryRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(252, 97, 163, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function inkRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(10, 10, 10, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function normalizeTheme(themeRaw: unknown) {
  const source = themeRaw && typeof themeRaw === 'object' ? (themeRaw as Record<string, unknown>) : {};
  const fontKey = typeof source.fontFamily === 'string' ? source.fontFamily : 'cormorant';
  const fonts = FONT_STACKS[fontKey] ?? FONT_STACKS.cormorant;
  return {
    primaryColor: isValidHex(source.primaryColor) ? source.primaryColor.trim() : DEFAULT_PRIMARY,
    secondaryColor: isValidHex(source.secondaryColor) ? source.secondaryColor.trim() : DEFAULT_SECONDARY,
    backgroundColor: isValidHex(source.backgroundColor) ? (source.backgroundColor as string).trim() : null,
    navbarColor: isValidHex(source.navbarColor) ? (source.navbarColor as string).trim() : null,
    logoImagePath:
      typeof source.logoImagePath === 'string' && source.logoImagePath.trim()
        ? source.logoImagePath.trim()
        : null,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
  };
}

export function buildPublicLogoUrl(supabaseUrl: string, storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim() || !supabaseUrl.trim()) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/style-covers/${storagePath.trim()}`;
}

export function resolveStyldEmailBranding(input: {
  businessName: string;
  businessCity?: string;
  siteUrl: string;
  logoUrl?: string | null;
  theme?: unknown;
}): StyldEmailBranding {
  const theme = normalizeTheme(input.theme);
  const ink = theme.secondaryColor;
  const pageBg = theme.backgroundColor || DEFAULT_CREAM;
  const headerBg = theme.navbarColor || theme.primaryColor;

  return {
    businessName: input.businessName.trim() || 'Your business',
    businessCity: input.businessCity?.trim() || '',
    siteUrl: input.siteUrl,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    pageBg,
    cardBg: '#ffffff',
    innerCardBg: mixHex(pageBg, '#000000', 0.04),
    headerBg,
    textColor: ink,
    mutedColor: inkRgba(ink, 0.62),
    softTextColor: inkRgba(ink, 0.78),
    borderColor: primaryRgba(theme.primaryColor, 0.2),
    rowBorderColor: inkRgba(ink, 0.12),
    logoUrl: input.logoUrl?.trim() || null,
    headingFont: theme.headingFont,
    bodyFont: theme.bodyFont,
    isLight: true,
  };
}

function buildEmailLogoBlock(branding: StyldEmailBranding): string {
  const initial = esc(branding.businessName.charAt(0) || 'S');
  const border = primaryRgba(branding.primaryColor, 0.35);

  if (branding.logoUrl) {
    return `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.businessName)}" width="64" height="64"
      style="display:block;border-radius:50%;border:2px solid ${border};margin:0 auto 12px;object-fit:cover;" />`;
  }

  return `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${esc(branding.secondaryColor)},${esc(branding.primaryColor)});margin:0 auto 12px;">
    <span style="display:block;color:#fff;font-size:22px;font-weight:800;line-height:64px;text-align:center;width:64px;">${initial}</span>
  </div>`;
}

export function buildEmailHeaderBlock(branding: StyldEmailBranding): string {
  const cityLine = branding.businessCity
    ? `<p style="margin:0;color:${branding.mutedColor};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${esc(branding.businessCity)}</p>`
    : '';

  return `<tr>
    <td style="padding:32px 28px 24px;text-align:center;background:${branding.headerBg};border-bottom:1px solid ${branding.borderColor};">
      ${buildEmailLogoBlock(branding)}
      <h1 style="margin:0 0 6px;color:${branding.textColor};font-family:${branding.headingFont};font-size:22px;font-weight:700;letter-spacing:-0.3px;">${esc(branding.businessName)}</h1>
      ${cityLine}
    </td>
  </tr>`;
}

export function buildEmailFooterBlock(branding: StyldEmailBranding): string {
  return `<tr>
    <td style="padding:16px 28px 22px;text-align:center;border-top:1px solid ${branding.borderColor};background:${branding.innerCardBg};">
      <a href="${STYLD_SITE_URL}" style="display:inline-block;text-decoration:none;">
        <p style="margin:0 0 10px;color:${branding.mutedColor};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Powered by</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td style="padding-right:8px;vertical-align:middle;">
              <img src="${STYLD_APP_ICON_URL}" alt="Styld" width="22" height="22" style="display:block;border-radius:6px;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:${branding.bodyFont};font-size:16px;font-weight:900;letter-spacing:-0.5px;">
                <span style="color:${branding.textColor};">Styl</span><span style="color:${branding.primaryColor};">d</span>
              </span>
            </td>
          </tr>
        </table>
      </a>
    </td>
  </tr>`;
}

/** Subtle cancellation policy note for booking confirmation emails. */
export function buildConfirmationCancellationNote(
  branding: StyldEmailBranding,
  policySummary: string,
): string {
  const summary = String(policySummary ?? '').trim();
  if (!summary) return '';

  return `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid ${branding.rowBorderColor};color:${branding.mutedColor};font-size:12px;line-height:1.55;text-align:center;">
  <span style="display:block;margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;">Cancellation policy</span>
  ${esc(summary)}
</p>`;
}

export function wrapStyldEmail(branding: StyldEmailBranding, innerBodyRows: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS_URL}" rel="stylesheet" />
<style>:root{color-scheme:light only;}body,h1,h2,h3,p,td,span,a{color:inherit;}</style>
</head>
<body style="margin:0;padding:0;background:${branding.pageBg};color:${branding.textColor};font-family:${branding.bodyFont};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${branding.pageBg};">
<tr><td align="center" style="padding:32px 16px 40px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:${branding.cardBg};color:${branding.textColor};border-radius:20px;overflow:hidden;border:1px solid ${branding.borderColor};box-shadow:0 16px 48px rgba(0,0,0,0.08);">
    ${buildEmailHeaderBlock(branding)}
    ${innerBodyRows}
    ${buildEmailFooterBlock(branding)}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

async function loadSiteSettingValue(
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  userId: string,
  recordKey: string,
): Promise<unknown> {
  const { data } = await supabase
    .from('styld_site_records')
    .select('data')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', recordKey)
    .maybeSingle();

  if (!data?.data || typeof data.data !== 'object') return null;
  const wrap = data.data as { value?: unknown };
  return wrap.value ?? null;
}

export async function loadSiteEmailBranding(
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  userId: string,
  siteUrl: string,
): Promise<StyldEmailBranding> {
  const [contentRaw, themeRaw] = await Promise.all([
    loadSiteSettingValue(supabase, userId, 'site_content'),
    loadSiteSettingValue(supabase, userId, 'site_theme'),
  ]);

  const content =
    contentRaw && typeof contentRaw === 'object' ? (contentRaw as Record<string, unknown>) : {};
  const theme = normalizeTheme(themeRaw);

  const businessName = String(content.brandName ?? content.business_name ?? 'Your Stylist');
  const businessCity = [content.city, content.state]
    .filter((v) => typeof v === 'string' && String(v).trim())
    .join(', ');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const logoUrl = buildPublicLogoUrl(supabaseUrl, theme.logoImagePath);

  return resolveStyldEmailBranding({ businessName, businessCity, siteUrl, logoUrl, theme: themeRaw });
}
