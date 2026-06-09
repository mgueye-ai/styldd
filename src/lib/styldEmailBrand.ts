import {
  DEFAULT_SITE_THEME,
  FONT_FAMILY_OPTIONS,
  FontFamily,
  GOOGLE_FONTS_URL,
  normalizeSiteTheme,
} from '../data/siteTheme';

const DEFAULT_CREAM = '#faf8f4';

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
  headerTextColor: string;
  headerMutedColor: string;
  footerTextColor: string;
  footerMutedColor: string;
  ctaGradient: string;
  ctaTextColor: string;
  borderColor: string;
  rowBorderColor: string;
  logoUrl: string | null;
  headingFont: string;
  bodyFont: string;
  isLight: boolean;
};

export type StyldEmailBrandingInput = {
  businessName: string;
  businessCity?: string;
  siteUrl: string;
  logoUrl?: string | null;
  theme?: unknown;
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(base: string, target: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  if (!a || !b) return base;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
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

function surfaceLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

function darkenHex(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function contrastingTextColor(surfaceHex: string, preferredInk: string): string {
  const surfaceDark = surfaceLuminance(surfaceHex) < 0.45;
  const inkLight = surfaceLuminance(preferredInk) > 0.62;
  if (surfaceDark) return inkLight ? preferredInk : '#f5f5f4';
  return inkLight ? '#0a0a0a' : preferredInk;
}

function textPaletteForSurface(surfaceHex: string, preferredInk: string) {
  const text = contrastingTextColor(surfaceHex, preferredInk);
  return {
    text,
    muted: inkRgba(text, 0.62),
    soft: inkRgba(text, 0.78),
  };
}

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function fontStacks(fontFamily: FontFamily): { heading: string; body: string } {
  const option = FONT_FAMILY_OPTIONS.find((item) => item.id === fontFamily);
  if (!option) {
    return {
      heading: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    };
  }
  return { heading: option.css, body: option.bodyCss };
}

export function resolveStyldEmailBranding(input: StyldEmailBrandingInput): StyldEmailBranding {
  const theme = normalizeSiteTheme(input.theme);
  const primaryColor = theme.primaryColor || DEFAULT_SITE_THEME.primaryColor;
  const secondaryColor = theme.secondaryColor || DEFAULT_SITE_THEME.secondaryColor;

  let pageBg =
    theme.backgroundColor && isValidHex(theme.backgroundColor)
      ? theme.backgroundColor.trim()
      : DEFAULT_CREAM;
  if (!theme.backgroundColor && surfaceLuminance(secondaryColor) > 0.62) {
    pageBg = '#0a0a0a';
  }

  const darkSite = surfaceLuminance(pageBg) < 0.45;
  const cardBg = darkSite ? mixHex(pageBg, '#ffffff', 0.1) : '#ffffff';
  const innerCardBg = darkSite ? mixHex(pageBg, '#ffffff', 0.14) : mixHex(pageBg, '#000000', 0.04);
  const headerBg =
    theme.navbarColor && isValidHex(theme.navbarColor)
      ? theme.navbarColor.trim()
      : primaryColor;
  const fonts = fontStacks(theme.fontFamily);

  const body = textPaletteForSurface(cardBg, secondaryColor);
  const header = textPaletteForSurface(headerBg, secondaryColor);
  const footer = textPaletteForSurface(innerCardBg, secondaryColor);
  const ctaGradient = `linear-gradient(135deg,${primaryColor},${darkenHex(primaryColor, 0.72)})`;
  const ctaTextColor = surfaceLuminance(primaryColor) > 0.55 ? '#0a0a0a' : '#ffffff';

  return {
    businessName: input.businessName.trim() || 'Your business',
    businessCity: input.businessCity?.trim() || '',
    siteUrl: input.siteUrl,
    primaryColor,
    secondaryColor,
    pageBg,
    cardBg,
    innerCardBg,
    headerBg,
    textColor: body.text,
    mutedColor: body.muted,
    softTextColor: body.soft,
    headerTextColor: header.text,
    headerMutedColor: header.muted,
    footerTextColor: footer.text,
    footerMutedColor: footer.muted,
    ctaGradient,
    ctaTextColor,
    borderColor: darkSite ? 'rgba(255,255,255,0.12)' : primaryRgba(primaryColor, 0.2),
    rowBorderColor: inkRgba(body.text, 0.12),
    logoUrl: input.logoUrl?.trim() || null,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
    isLight: !darkSite,
  };
}

export function buildEmailLogoBlock(branding: StyldEmailBranding): string {
  const initial = esc(branding.businessName.charAt(0) || 'S');
  const border = primaryRgba(branding.primaryColor, 0.35);

  if (branding.logoUrl) {
    return `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.businessName)}" width="64" height="64"
      style="display:block;border-radius:50%;border:2px solid ${border};margin:0 auto 12px;object-fit:cover;" />`;
  }

  return `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${esc(branding.secondaryColor)},${esc(branding.primaryColor)});margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
    <span style="color:#fff;font-size:22px;font-weight:800;line-height:64px;text-align:center;width:64px;">${initial}</span>
  </div>`;
}

export function buildEmailHeaderBlock(branding: StyldEmailBranding): string {
  const cityLine = branding.businessCity
    ? `<p style="margin:0;color:${branding.headerMutedColor};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${esc(branding.businessCity)}</p>`
    : '';

  return `<tr>
    <td style="padding:32px 28px 24px;text-align:center;background:${branding.headerBg};border-bottom:1px solid ${branding.borderColor};">
      ${buildEmailLogoBlock(branding)}
      <h1 style="margin:0 0 6px;color:${branding.headerTextColor};font-family:${branding.headingFont};font-size:22px;font-weight:700;letter-spacing:-0.3px;">${esc(branding.businessName)}</h1>
      ${cityLine}
    </td>
  </tr>`;
}

export function buildEmailFooterBlock(branding: StyldEmailBranding): string {
  return `<tr>
    <td style="padding:16px 28px 22px;text-align:center;border-top:1px solid ${branding.borderColor};background:${branding.innerCardBg};">
      <a href="${STYLD_SITE_URL}" style="display:inline-block;text-decoration:none;">
        <p style="margin:0 0 10px;color:${branding.footerMutedColor};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Powered by</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td style="padding-right:8px;vertical-align:middle;">
              <img src="${STYLD_APP_ICON_URL}" alt="Styld" width="22" height="22" style="display:block;border-radius:6px;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:${branding.bodyFont};font-size:16px;font-weight:900;letter-spacing:-0.5px;">
                <span style="color:${branding.footerTextColor};">Styl</span><span style="color:${branding.primaryColor};">d</span>
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
  const colorScheme = branding.isLight ? 'light' : 'light dark';
  const cardShadow = branding.isLight ? '0 16px 48px rgba(0,0,0,0.08)' : '0 16px 48px rgba(0,0,0,0.35)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="${colorScheme}" />
<meta name="supported-color-schemes" content="${colorScheme}" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS_URL}" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:${branding.pageBg};color:${branding.textColor};font-family:${branding.bodyFont};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${branding.pageBg};">
<tr><td align="center" style="padding:32px 16px 40px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background-color:${branding.cardBg};color:${branding.textColor};border-radius:20px;overflow:hidden;border:1px solid ${branding.borderColor};box-shadow:${cardShadow};">
    ${buildEmailHeaderBlock(branding)}
    ${innerBodyRows}
    ${buildEmailFooterBlock(branding)}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildPublicLogoUrl(supabaseUrl: string, storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim() || !supabaseUrl.trim()) return null;
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/style-covers/${storagePath.trim()}`;
}
