import { formatSiteAddress, LocationPart, SiteContent, SiteSection } from '../data/siteContent';
import { HeroLayout, StyleCardLayout } from '../data/siteTheme';

const SITE_PREVIEW_CSS = `
:root{--pink:#db2777;--pink-dark:#9f1239;--ink:#0a0a0a;--cream:#fafafa;--muted:#525252;--muted-soft:#737373;--pink-heading:#ec4899;--hero-pink:#f472b6;--hero-pink-deep:#be185d;--white:#fff;--radius:12px;--shadow:0 8px 32px rgba(13,13,13,.08);--font-display:"Cormorant Garamond",Georgia,serif;--font-body:"Source Sans 3",system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;font-family:var(--font-body);font-size:1rem;line-height:1.6;color:var(--ink);background:var(--cream)}
.container{width:min(1120px,calc(100% - 2rem));margin-inline:auto}
.preview-banner{position:sticky;top:0;z-index:200;background:#0a0a0a;color:#fafafa;text-align:center;font:600 12px/1 var(--font-body);padding:8px 12px;letter-spacing:.04em}
.hero-landing{position:relative;min-height:520px;display:flex;flex-direction:column;color:var(--ink);overflow:hidden;background:var(--white)}
.hero-landing__bg{position:absolute;inset:0;background:#fff;background-image:radial-gradient(ellipse 95% 70% at 8% 5%,rgba(244,114,182,.11),transparent 58%),linear-gradient(180deg,#fffafc 0%,#fff 45%,#fafafa 100%)}
.hero-landing__vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 115% 95% at 44% 48%,transparent 52%,rgba(250,250,250,.92) 100%);opacity:.35}
.hero-nav{position:relative;z-index:3;padding:1rem 0 .5rem}
.hero-nav__inner{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.hero-brand{display:inline-flex;align-items:center;gap:.65rem;text-decoration:none;color:var(--ink);font-family:var(--font-display);font-size:1.2rem;font-weight:600}
.hero-brand__logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#fce7f3,#fbcfe8);box-shadow:0 4px 14px rgba(219,39,119,.15)}
.hero-nav__panel{margin-left:auto;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
.hero-nav__links{display:flex;gap:1rem}.hero-nav__links a{color:var(--muted);font-weight:600;text-decoration:none;font-size:.9rem}
.hero-btn{display:inline-flex;align-items:center;justify-content:center;padding:.65rem 1.2rem;font-weight:700;border-radius:14px;text-decoration:none;background:var(--pink);color:#fff;box-shadow:0 4px 18px rgba(219,39,119,.32);font-size:.9rem}
.hero-landing__content{position:relative;z-index:2;flex:1;display:flex;align-items:center;padding:1.5rem 0 2.5rem}
.hero-scale-layout{width:100%;max-width:960px;margin:0 auto}
.hero-scale-title__grid{display:grid;grid-template-columns:1fr minmax(140px,220px) 1fr;gap:1rem;align-items:center}
.hero-scale-col--left{text-align:right}.hero-scale-col--right{text-align:left}
.hero-scale-col--center{text-align:center;max-width:640px;margin:0 auto}
.hero-scale-kicker{margin:0 0 .35rem;font-size:.85rem;font-weight:600;color:#9ca3af;letter-spacing:.04em}
.hero-scale-display{margin:0;font-size:clamp(2rem,8vw,4.5rem);font-weight:800;letter-spacing:-.03em;line-height:.92;text-transform:uppercase}
.hero-scale-display--ink{color:var(--ink)}.hero-scale-display--brand{color:var(--pink);display:flex;flex-direction:column}
.hero-scale-visual{aspect-ratio:4/5;border-radius:28px;background:linear-gradient(180deg,#f9f5f6 0%,#f3eef0 100%);box-shadow:0 30px 60px -20px rgba(190,24,93,.22),0 0 0 1px rgba(244,114,182,.35)}
.hero-scale-visual--photo{background-size:cover;background-position:center}
.hero-layout--image-below{display:flex;flex-direction:column;align-items:center;gap:1.25rem}
.hero-layout--image-below .hero-scale-visual{width:min(100%,320px)}
.hero-layout--image-below .hero-scale-col--center,.hero-layout--minimal .hero-scale-col--center{text-align:center}
.hero-layout--minimal .hero-scale-title__grid{display:block}
.hero-layout--minimal .hero-scale-visual{display:none}
.hero-layout--minimal .hero-scale-col--left,.hero-layout--minimal .hero-scale-col--right{display:none}
.hero-ctas{display:flex;gap:.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap}
.hero-btn--outline-light{background:#fff;color:var(--ink);border:1.5px solid rgba(244,114,182,.45);box-shadow:none}
.hero-btn--gold{background:var(--pink);color:#fff;border:none}
.section{padding:2.5rem 0}.section-alt{background:var(--white);border-block:1px solid rgba(184,134,11,.12)}
.section-head{text-align:center;max-width:640px;margin:0 auto 1.5rem}.section-head h2{font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2rem);margin:0 0 .5rem}.section-head p{margin:0;color:var(--muted)}
.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.75rem}
.section-popular-styles .style-card{border-color:rgba(219,39,119,.2)}
.section-head--popular h2{font-family:var(--font-display);font-size:clamp(2.1rem,4.5vw,3rem);font-weight:700;margin:0;display:inline-block;padding-bottom:.5rem;border-bottom:2px solid var(--pink)}
.style-card h3{font-family:var(--font-display);font-size:1.35rem;margin:0 0 .35rem}
.style-card .price{font-weight:700;color:var(--pink-dark);font-size:.95rem;margin:.5rem 0 0}
.section--reels-showcase{background:linear-gradient(180deg,rgba(253,242,248,.42) 0%,#fff 100%);border-block:1px solid rgba(219,39,119,.09)}
.reels-carousel__track{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.5rem}
.reels-carousel__slide{flex:0 0 min(18rem,calc(100vw - 3rem));scroll-snap-align:start}
.ig-reel-card{display:flex;flex-direction:column;min-height:420px;background:#fff;border:1px solid rgba(219,39,119,.16);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit}
.ig-reel-card__media{display:flex;flex:1;min-height:320px;align-items:center;justify-content:center;background:linear-gradient(145deg,#111,#2a0c1a)}
.ig-reel-card__play{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);color:var(--pink-dark);font-size:1.4rem}
.ig-reel-card__body{padding:1rem;display:grid;gap:.25rem}
.ig-reel-card__handle{color:var(--pink-dark);font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.video-note--reels{margin-top:1.5rem;text-align:center;color:var(--muted)}
.style-card{background:var(--cream);border-radius:var(--radius);border:1px solid rgba(184,134,11,.2);overflow:hidden}
.style-card__media{aspect-ratio:4/5;background:linear-gradient(145deg,#e8e4dc 0%,#d4cfc5 100%)}
.style-card__body{padding:1rem}.style-card__body strong{display:block;margin-bottom:.35rem}
.style-card__price{margin:.5rem 0 0;font-weight:700;color:var(--pink);font-size:.95rem}
.info-card{background:var(--white);border-radius:var(--radius);padding:1.5rem;border:1px solid rgba(181,154,91,.28);box-shadow:var(--shadow)}
.info-card h3{font-family:var(--font-display);color:var(--pink-heading);margin:0 0 1rem}
.info-card p{margin:.25rem 0;color:var(--muted-soft)}.location-map{width:100%;height:220px;border:0;margin-top:1rem;border-radius:10px}
.site-footer{padding:2rem 0 2.5rem;background:#111;color:#fafafa;text-align:center}.site-footer p{margin:.35rem 0;font-size:.9rem;color:#a1a1aa}
.style-card__body{padding:1rem}.style-card__body strong{display:block;margin-bottom:.35rem}
.style-card-wrap{display:block;text-decoration:none;color:inherit}
@media (max-width:767px){.hero-scale-title__grid{display:flex;flex-direction:column;align-items:center;gap:1.15rem}.hero-scale-visual{order:-1;max-width:min(360px,90vw);margin-bottom:.25rem}.hero-scale-col--left,.hero-scale-col--right{align-items:center;text-align:center}.hero-scale-display--brand{align-items:center;text-align:center}.hero-nav__burger{display:inline-flex}.hero-nav__panel{display:none;flex-direction:column;align-items:stretch;width:100%;order:3;gap:1rem;margin-top:.35rem;padding:1rem 1.1rem 1.2rem;background:rgba(255,255,255,.98);border-radius:14px;border:1px solid rgba(244,114,182,.28)}.hero-nav__panel.hero-nav__panel--open{display:flex}.hero-nav__links{flex-direction:column;align-items:stretch}.hero-nav__actions{flex-direction:column;width:100%}.hero-nav__actions .hero-btn--nav{width:100%;justify-content:center}}
.style-pill-list{display:flex;flex-direction:column;gap:.6rem;width:100%}
.style-pill{display:flex;align-items:center;gap:.85rem;padding:.6rem 1rem .6rem .6rem;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px rgba(0,0,0,.05);text-decoration:none;color:inherit;transition:box-shadow .15s}
.style-pill:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)}
.style-pill__img{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;background:linear-gradient(145deg,#e8e4dc,#d4cfc5)}
.style-pill__img--bg{width:48px;height:48px;border-radius:50%;flex-shrink:0;background-size:cover;background-position:center}
.style-pill__body{flex:1;min-width:0}
.style-pill__name{font-weight:700;font-size:.92rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.style-pill__desc{font-size:.75rem;color:var(--muted);margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.style-pill__price{font-weight:800;font-size:.9rem;color:var(--pink);flex-shrink:0;white-space:nowrap}
@media (max-width:768px){.section{padding:2.4rem 0}.section-head{margin-bottom:1.65rem;text-align:center}.card-grid,.catalog-grid{display:flex;flex-wrap:nowrap;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 .25rem .85rem;margin-inline:-.25rem;-webkit-overflow-scrolling:touch}.card-grid>*,.catalog-grid>*{flex:0 0 min(18.25rem,calc(100vw - 3rem));scroll-snap-align:start;max-width:min(18.25rem,calc(100vw - 3rem))}.info-cards{display:grid;grid-template-columns:1fr;gap:1rem}.location-map{height:220px}.hero-ctas--scale{flex-direction:column;align-items:stretch;width:100%;max-width:360px;margin-inline:auto}.hero-ctas--scale .hero-btn--lg{width:100%;justify-content:center}}
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type SitePreviewStyle = {
  title: string;
  description: string;
  priceLabel: string;
  imageUrl?: string | null;
};

export type SitePreviewTheme = {
  heroLayout: HeroLayout;
  heroImageUrl?: string | null;
  logoImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  zoomedOut?: boolean;
  styleCardLayout?: StyleCardLayout;
};

export const DEFAULT_PREVIEW_THEME: SitePreviewTheme = {
  heroLayout: 'split',
  heroImageUrl: null,
  logoImageUrl: null,
  primaryColor: '#db2777',
  secondaryColor: '#0a0a0a',
  zoomedOut: false,
};

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function darkenHex(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return (
    '#' +
    rgb
      .map((c) => Math.max(0, Math.round(c * factor)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function lightenHex(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return (
    '#' +
    rgb
      .map((c) => Math.min(255, Math.round(c + (255 - c) * factor)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function buildColorOverrideCss(theme: SitePreviewTheme): string {
  const primary = theme.primaryColor || '#db2777';
  const secondary = theme.secondaryColor || '#0a0a0a';
  const primaryDark = darkenHex(primary, 0.68);
  const primaryLight = lightenHex(primary, 0.22);
  const primaryHeading = lightenHex(primary, 0.1);
  return `:root{--pink:${primary};--pink-dark:${primaryDark};--pink-heading:${primaryHeading};--hero-pink:${primaryLight};--hero-pink-deep:${primaryDark};--pink-light:${primaryLight};--ink:${secondary};}`;
}

export function getSitePreviewPageUrl(): string | null {
  const base = process.env.EXPO_PUBLIC_SITE_PREVIEW_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/preview.html`;
}

export function buildSitePreviewInjection(
  content: SiteContent,
  styles: SitePreviewStyle[] = [],
  theme: SitePreviewTheme = DEFAULT_PREVIEW_THEME,
): string {
  const colorCss = buildColorOverrideCss(theme);
  const colorInject = `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(colorCss)};document.head.appendChild(s);})();`;
  return `window.__STYLD_SITE_CONTENT__=${JSON.stringify(content)};window.__STYLD_SITE_STYLES__=${JSON.stringify(styles)};window.__STYLD_SITE_THEME__=${JSON.stringify(theme)};${colorInject}`;
}

function heroImageAttr(url: string | null | undefined): string {
  if (!url) return '';
  return ` style="background-image:url('${url.replace(/'/g, '%27')}');background-size:cover;background-position:center;"`;
}

function buildHeroCtasHtml(): string {
  return `<div class="hero-ctas hero-ctas--landing hero-ctas--scale"><a class="hero-btn hero-btn--outline-light hero-btn--lg" href="#preview-menu-section">Browse menu &amp; prices</a>
<a class="hero-btn hero-btn--gold hero-btn--lg" href="#preview-visit-section">Book now</a></div>`;
}

function buildHeroInnerHtml(content: SiteContent, theme: SitePreviewTheme): string {
  const brand = escapeHtml(content.brandName);
  const left = escapeHtml(content.taglineLeft);
  const r1 = escapeHtml(content.taglineRightLine1);
  const r2 = escapeHtml(content.taglineRightLine2);
  const img = heroImageAttr(theme.heroImageUrl);
  const visualClass = theme.heroImageUrl
    ? 'hero-scale-visual hero-scale-visual--photo'
    : 'hero-scale-visual';
  const ctas = buildHeroCtasHtml();

  if (theme.heroLayout === 'minimal') {
    return `<div class="hero-scale-layout hero-layout--minimal">
<h1 class="hero-scale-title"><span class="hero-scale-title__grid">
<span class="hero-scale-col hero-scale-col--center">
<span class="hero-scale-kicker">${brand}</span>
<span class="hero-scale-display hero-scale-display--ink">${left}</span>
<span class="hero-scale-display hero-scale-display--brand"><span class="hero-scale-display__line">${r1}</span><span class="hero-scale-display__line">${r2}</span></span>
</span></span></h1>${ctas}</div>`;
  }

  if (theme.heroLayout === 'image-below') {
    return `<div class="hero-scale-layout hero-layout--image-below">
<span class="${visualClass}"${img}></span>
<h1 class="hero-scale-title"><span class="hero-scale-col hero-scale-col--center">
<span class="hero-scale-kicker">${brand}</span>
<span class="hero-scale-display hero-scale-display--ink">${left}</span>
<span class="hero-scale-display hero-scale-display--brand"><span class="hero-scale-display__line">${r1}</span><span class="hero-scale-display__line">${r2}</span></span>
</span></h1>${ctas}</div>`;
  }

  return `<div class="hero-scale-layout hero-layout--split">
<h1 class="hero-scale-title"><span class="hero-scale-title__grid">
<span class="hero-scale-col hero-scale-col--left"><span class="hero-scale-kicker">${brand}</span>
<span class="hero-scale-display hero-scale-display--ink">${left}</span></span>
<span class="${visualClass}"${img}></span>
<span class="hero-scale-col hero-scale-col--right"><span class="hero-scale-display hero-scale-display--brand">
<span class="hero-scale-display__line">${r1}</span><span class="hero-scale-display__line">${r2}</span></span></span>
</span></h1>${ctas}</div>`;
}

function buildStyleCardsHtml(styles: SitePreviewStyle[]): string {
  if (!styles.length) {
    return `<div class="style-card-wrap"><article class="style-card"><div class="style-card__media"></div><div class="style-card__body"><h3>Add styles</h3><p>Your service menu appears here once you add styles in the editor.</p></div></article></div>`;
  }

  return styles
    .slice(0, 12)
    .map((style) => {
      const mediaStyle = style.imageUrl
        ? ` style="background-image:url('${style.imageUrl.replace(/'/g, '%27')}');background-size:cover;background-position:center;"`
        : '';
      const description = style.description || 'Book this style online.';
      const price = style.priceLabel
        ? `<p class="price">${escapeHtml(style.priceLabel)}</p>`
        : '';
      return `<a class="style-card-wrap" href="#"><article class="style-card"><div class="style-card__media"${mediaStyle}></div><div class="style-card__body"><h3>${escapeHtml(style.title)}</h3><p>${escapeHtml(description)}</p>${price}</div></article></a>`;
    })
    .join('');
}

function buildStylePillsHtml(styles: SitePreviewStyle[]): string {
  if (!styles.length) {
    return `<div class="style-pill-list"><a class="style-pill" href="#"><div class="style-pill__img"></div><div class="style-pill__body"><div class="style-pill__name">Add styles</div><div class="style-pill__desc">Your services appear here</div></div></a></div>`;
  }
  const items = styles
    .slice(0, 20)
    .map((style) => {
      const imgHtml = style.imageUrl
        ? `<div class="style-pill__img--bg" style="background-image:url('${style.imageUrl.replace(/'/g, '%27')}')"></div>`
        : `<div class="style-pill__img"></div>`;
      const desc = style.description ? `<div class="style-pill__desc">${escapeHtml(style.description)}</div>` : '';
      const price = style.priceLabel ? `<span class="style-pill__price">${escapeHtml(style.priceLabel)}</span>` : '';
      return `<a class="style-pill" href="#">${imgHtml}<div class="style-pill__body"><div class="style-pill__name">${escapeHtml(style.title)}</div>${desc}</div>${price}</a>`;
    })
    .join('');
  return `<div class="style-pill-list">${items}</div>`;
}

function buildInstagramPreviewHtml(content: SiteContent): string {
  const handle = content.instagramHandle.replace(/^@/, '') || 'yourhandle';
  const igUrl = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const slides = [
    { title: 'Recent work', caption: 'Tap to view on Instagram' },
    { title: 'Client features', caption: 'Fresh styles & transformations' },
  ];

  return slides
    .map(
      (slide) =>
        `<div class="reels-carousel__slide"><a class="ig-reel-card" href="${escapeHtml(igUrl)}" target="_blank" rel="noopener noreferrer"><span class="ig-reel-card__media"><span class="ig-reel-card__play">▶</span></span><span class="ig-reel-card__body"><span class="ig-reel-card__handle">@${escapeHtml(handle)}</span><strong>${escapeHtml(slide.title)}</strong><span>${escapeHtml(slide.caption)}</span></span></a></div>`,
    )
    .join('');
}

function isSectionHidden(content: SiteContent, section: SiteSection): boolean {
  return Array.isArray(content.hiddenSections) && content.hiddenSections.includes(section);
}

function isLocationPartHidden(content: SiteContent, part: LocationPart): boolean {
  return Array.isArray(content.hiddenLocationParts) && content.hiddenLocationParts.includes(part);
}

export function buildSitePreviewHtml(
  content: SiteContent,
  styles: SitePreviewStyle[] = [],
  theme: SitePreviewTheme = DEFAULT_PREVIEW_THEME,
): string {
  const address = formatSiteAddress(content);
  const instagram = content.instagramHandle.replace(/^@/, '');
  const mapSrc =
    content.mapEmbedUrl ||
    'https://www.openstreetmap.org/export/embed.html?bbox=-124.5%2C24.5%2C-66.9%2C49.5&layer=mapnik';

  const viewportContent = theme.zoomedOut
    ? 'width=800'
    : 'width=device-width,initial-scale=1,maximum-scale=1';

  const colorOverrideCss = buildColorOverrideCss(theme);

  const socialSection = isSectionHidden(content, 'social')
    ? ''
    : `<section class="section section-alt section--reels-showcase"><div class="container"><div class="section-head">
<h2>${escapeHtml(content.reelsTitle)}</h2><p>${escapeHtml(content.reelsBlurb)}</p></div>
<div class="reels-carousel reels-carousel--cards"><div class="reels-carousel__shell"><div class="reels-carousel__viewport"><div class="reels-carousel__track">${buildInstagramPreviewHtml(content)}</div></div></div></div>
<p class="video-note video-note--reels">Follow <a href="https://www.instagram.com/${escapeHtml(instagram)}/" target="_blank" rel="noopener noreferrer">@${escapeHtml(instagram)}</a></p></div></section>`;

  const isPillLayout = theme.styleCardLayout === 'pill';
  const menuInner = isPillLayout
    ? buildStylePillsHtml(styles)
    : buildStyleCardsHtml(styles);
  const menuGridClass = isPillLayout ? 'style-pill-list' : 'catalog-grid';
  const menuSection = isSectionHidden(content, 'menu')
    ? ''
    : `<section class="section section-popular-styles" id="preview-menu-section"><div class="container"><div class="section-head section-head--popular">
<h2>${escapeHtml(content.menuTitle || 'Menu')}</h2><p>${escapeHtml(content.menuBlurb || 'Browse our services & prices — book online.')}</p></div>
<div class="${menuGridClass}">${menuInner}</div></div></section>`;

  const aboutSection = isSectionHidden(content, 'about')
    ? ''
    : `<section class="section"><div class="container"><div class="section-head">
<h2>${escapeHtml(content.aboutTitle)}</h2><p>${escapeHtml(content.aboutBody)}</p></div></div></section>`;

  const addressBlock = isLocationPartHidden(content, 'address')
    ? ''
    : `<p><strong>${escapeHtml(content.addressLine1)}</strong></p><p>${escapeHtml(address)}</p>`;

  const contactBlock = isLocationPartHidden(content, 'contact')
    ? ''
    : `<p>${escapeHtml(content.phoneDisplay)}</p><p>@${escapeHtml(instagram)}</p>${content.email ? `<p>${escapeHtml(content.email)}</p>` : ''}`;

  const mapBlock = isLocationPartHidden(content, 'map')
    ? ''
    : `<div class="location-map-wrap"><iframe class="location-map" title="Map" loading="lazy" src="${escapeHtml(mapSrc)}"></iframe></div>`;

  const visitSection = isSectionHidden(content, 'visit')
    ? ''
    : `<section class="section section-alt" id="preview-visit-section"><div class="container"><div class="section-head">
<h2>${escapeHtml(content.visitTitle)}</h2><p>${escapeHtml(content.visitBody)}</p></div>
<div class="info-cards info-cards--location-layout">
<article class="info-card info-card--location"><h3>Location</h3><div class="info-card-body">
${addressBlock}${contactBlock}${mapBlock}
</div></article></div></div></section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="${viewportContent}"/>
<title>${escapeHtml(content.brandName)} | Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>${SITE_PREVIEW_CSS}${colorOverrideCss}</style>
</head>
<body class="page-home">
<div class="preview-banner">Styld preview — this is how your booking site will look</div>
<section class="hero-landing">
<div class="hero-landing__bg"></div><div class="hero-landing__vignette"></div>
<header class="hero-nav"><div class="container hero-nav__inner">
<a class="hero-brand" href="#"><span class="hero-brand__logo"></span><span>${escapeHtml(content.brandName)}</span></a>
<div class="hero-nav__panel"><nav class="hero-nav__links"><a href="#">Home</a><a href="#preview-menu-section">Menu</a><a href="#">Gallery</a></nav>
<a class="hero-btn" href="#preview-visit-section">Book Now</a></div></div></header>
<div class="container hero-landing__content">${buildHeroInnerHtml(content, theme)}</div>
</section>
<main>
${socialSection}
${menuSection}
${aboutSection}
${visitSection}
</main>
<footer class="site-footer"><div class="container">
<p>&copy; ${escapeHtml(content.brandName)}</p>
<p>${escapeHtml(content.footerText)}</p></div></footer>
</body></html>`;
}
