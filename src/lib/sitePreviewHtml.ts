import {
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  formatSiteAddress,
  LocationPart,
  SiteContent,
  SiteSection,
} from '../data/siteContent';
import { FontFamily, FONT_FAMILY_OPTIONS, GOOGLE_FONTS_URL, HeroLayout, StyleCardLayout, TemplateId } from '../data/siteTheme';

const SITE_PREVIEW_CSS = `
:root{--pink:#db2777;--pink-dark:#9f1239;--ink:#0a0a0a;--cream:#fafafa;--muted:#525252;--muted-soft:#737373;--pink-heading:#ec4899;--hero-pink:#f472b6;--hero-pink-deep:#be185d;--white:#fff;--radius:12px;--shadow:0 8px 32px rgba(13,13,13,.08);--font-display:"Cormorant Garamond",Georgia,serif;--font-body:"Source Sans 3",system-ui,sans-serif;--filter-active-text:#fff}
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
.section-head--popular h2{font-family:var(--font-display);font-size:clamp(2.1rem,4.5vw,3rem);font-weight:700;margin:0;display:inline-block;padding-bottom:.5rem;border-bottom:2px solid var(--pink)}
.section-popular-styles .catalog-service-cards--popular{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem 1.25rem}
.section-popular-styles .catalog-service-card{display:flex;flex-direction:row;align-items:stretch;gap:1rem;padding:.85rem 1rem;border-radius:14px;border:1px solid rgba(219,39,119,.14);background:var(--white);box-shadow:0 2px 12px rgba(13,13,13,.05);text-decoration:none;color:inherit;transition:border-color .15s ease,box-shadow .15s ease}
.section-popular-styles .catalog-service-card:hover{border-color:rgba(219,39,119,.35);box-shadow:0 4px 18px rgba(219,39,119,.12)}
.section-popular-styles .catalog-service-card__media{width:90px;min-width:90px;min-height:90px;align-self:center;border-radius:12px;background:linear-gradient(145deg,#ebe7df 0%,#d8d3c9 100%);border:1px dashed rgba(15,23,42,.12)}
.section-popular-styles .catalog-service-card__media--photo{background-size:cover;background-position:center;background-repeat:no-repeat;border:1px solid rgba(15,23,42,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.section-popular-styles .catalog-service-card__body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:.35rem}
.section-popular-styles .catalog-service-card__title{font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--ink);line-height:1.25}
.section-popular-styles .catalog-service-card__mid{display:flex;flex-direction:row;align-items:baseline;justify-content:space-between;gap:.75rem}
.section-popular-styles .catalog-service-card__size{font-size:.85rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.section-popular-styles .catalog-service-card__price{font-size:1.1rem;font-weight:700;color:var(--pink-dark);white-space:nowrap}
.section--reels-showcase{background:linear-gradient(180deg,rgba(253,242,248,.42) 0%,#fff 100%);border-block:1px solid rgba(219,39,119,.09)}
.reels-carousel__track{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.5rem}
.reels-carousel__slide{flex:0 0 min(18rem,calc(100vw - 3rem));scroll-snap-align:start}
.ig-reel-card{display:flex;flex-direction:column;min-height:420px;background:#fff;border:1px solid rgba(219,39,119,.16);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit}
.ig-reel-card__media{display:flex;flex:1;min-height:320px;align-items:center;justify-content:center;background:linear-gradient(145deg,#111,#2a0c1a)}
.ig-reel-card__play{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);color:var(--pink-dark);font-size:1.4rem}
.ig-reel-card__body{padding:1rem;display:grid;gap:.25rem}
.ig-reel-card__handle{color:var(--pink-dark);font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.video-note--reels{margin-top:1.5rem;text-align:center;color:var(--muted)}
.info-card{background:var(--white);border-radius:var(--radius);padding:1.5rem;border:1px solid rgba(181,154,91,.28);box-shadow:var(--shadow)}
.info-card h3{font-family:var(--font-display);color:var(--pink-heading);margin:0 0 1rem}
.info-card p{margin:.25rem 0;color:var(--muted-soft)}.location-map{width:100%;height:220px;border:0;margin-top:1rem;border-radius:10px}
.location-address-link{display:block;color:inherit;text-decoration:none}.location-address-link:hover,.location-address-link:focus-visible{color:var(--pink-dark);text-decoration:underline}.location-address-link p{margin:0 0 .35rem}
.site-footer{padding:2rem 0 2.5rem;background:#111;color:#fafafa;text-align:center}.site-footer p{margin:.35rem 0;font-size:.9rem;color:#a1a1aa}.footer-built-by{margin:.35rem 0 0}.footer-built-by__link{display:inline-flex;align-items:center;gap:.4rem;font-size:.76rem;color:rgba(255,255,255,.55);text-decoration:none}.footer-built-by__logo{width:22px;height:22px;border-radius:6px;object-fit:cover}
@media (max-width:767px){.hero-landing__content{justify-content:center;width:100%}.hero-scale-layout{width:100%;max-width:100%}.hero-scale-title{width:100%;display:flex;flex-direction:column;align-items:center}.hero-scale-title__grid{display:flex;flex-direction:column;align-items:center;gap:1.15rem;width:100%;max-width:min(24rem,100%);margin-inline:auto}.hero-scale-visual{order:-1;max-width:min(360px,92vw);width:100%;margin-inline:auto;align-self:center}.hero-scale-col--left,.hero-scale-col--right,.hero-scale-col--center{width:100%;align-items:center;text-align:center}.hero-scale-display,.hero-scale-display--brand{align-items:center;text-align:center;width:100%}.hero-ctas--scale{width:100%;max-width:min(22rem,92vw);margin-inline:auto;justify-content:center;align-items:center;flex-direction:column}.hero-ctas--scale .hero-btn--lg{width:100%;max-width:20rem;margin-inline:auto;justify-content:center}.hero-nav__burger{display:inline-flex}.hero-nav__panel{display:none;flex-direction:column;align-items:stretch;width:100%;order:3;gap:1rem;margin-top:.35rem;padding:1rem 1.1rem 1.2rem;background:rgba(255,255,255,.98);border-radius:14px;border:1px solid rgba(244,114,182,.28)}.hero-nav__panel.hero-nav__panel--open{display:flex}.hero-nav__links{flex-direction:column;align-items:stretch}.hero-nav__actions{flex-direction:column;width:100%}.hero-nav__actions .hero-btn--nav{width:100%;justify-content:center}}
@media (max-width:720px){.section-popular-styles .catalog-service-cards--popular{grid-template-columns:1fr}}
.style-pill-list{display:flex;flex-direction:column;gap:.6rem;width:100%}
.style-pill{display:flex;align-items:center;gap:.85rem;padding:.6rem 1rem .6rem .6rem;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px rgba(0,0,0,.05);text-decoration:none;color:inherit;transition:box-shadow .15s}
.style-pill:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)}
.style-pill__img{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;background:linear-gradient(145deg,#e8e4dc,#d4cfc5)}
.style-pill__img--bg{width:48px;height:48px;border-radius:50%;flex-shrink:0;background-size:cover;background-position:center}
.style-pill__body{flex:1;min-width:0}
.style-pill__name{font-weight:700;font-size:.92rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.style-pill__desc{font-size:.75rem;color:var(--muted);margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.style-pill__price{font-weight:800;font-size:.9rem;color:var(--pink);flex-shrink:0;white-space:nowrap}
@media (max-width:768px){.section{padding:2.4rem 0}.section-head{margin-bottom:1.65rem;text-align:center}.card-grid{display:flex;flex-wrap:nowrap;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 .25rem .85rem;margin-inline:-.25rem;-webkit-overflow-scrolling:touch}.card-grid>*{flex:0 0 min(18.25rem,calc(100vw - 3rem));scroll-snap-align:start;max-width:min(18.25rem,calc(100vw - 3rem))}.info-cards{display:grid;grid-template-columns:1fr;gap:1rem}.location-map{height:220px}.hero-ctas--scale{flex-direction:column;align-items:stretch;width:100%;max-width:360px;margin-inline:auto}.hero-ctas--scale .hero-btn--lg{width:100%;justify-content:center}}
.profile-nav{background:var(--nav-bg,var(--pink));border-bottom:1px solid rgba(0,0,0,.06);padding:.875rem 0;position:sticky;top:0;z-index:100}
.profile-nav__inner{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.profile-brand{font-family:var(--font-display);font-size:1.15rem;font-weight:700;color:var(--nav-text,#fff);display:flex;align-items:center;gap:.6rem;text-decoration:none}
.profile-brand__logo{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.2);flex-shrink:0}
.profile-brand__logo-img{width:38px;height:38px;border-radius:10px;object-fit:cover;flex-shrink:0}
.profile-book-btn{display:inline-flex;align-items:center;padding:.6rem 1.25rem;background:var(--ink);color:var(--pink);border-radius:999px;font-weight:700;font-size:.9rem;text-decoration:none;white-space:nowrap}
.profile-hero{padding:2.5rem 0 2rem;background:var(--cream)}
.profile-hero__grid{display:grid;grid-template-columns:2fr 3fr;gap:2.5rem;align-items:start}
.profile-photo{border-radius:20px;overflow:hidden;aspect-ratio:3/4;background:linear-gradient(180deg,#f0ece5 0%,#e4dfd7 100%);box-shadow:0 12px 40px rgba(0,0,0,.10)}
.profile-photo__bg{width:100%;height:100%;background-size:cover;background-position:center;min-height:240px}
.profile-info{display:flex;flex-direction:column;gap:1.75rem;padding-top:.5rem}
.profile-section-block{display:flex;flex-direction:column;gap:.5rem}
.profile-about-head,.profile-policy-head{font-family:var(--font-display);color:var(--ink);margin:0}
.profile-about-head{font-size:1.5rem;font-weight:700;border-bottom:2px solid var(--pink);display:inline-block;padding-bottom:.2rem}
.profile-policy-head{font-size:1.5rem;font-weight:700;border-bottom:2px solid var(--pink);display:inline-block;padding-bottom:.2rem}
.profile-about-body,.profile-policy-body{color:var(--muted);font-size:.95rem;line-height:1.7;margin:0}
.profile-menu-section{padding:2.5rem 0;background:var(--cream,#fff);border-top:1px solid rgba(0,0,0,.06)}
.profile-menu-head{margin-bottom:1.25rem}
.profile-menu-head h2{font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2.1rem);font-weight:700;color:var(--ink);margin:0 0 .3rem;border-bottom:2px solid var(--pink);display:inline-block;padding-bottom:.2rem}
.profile-menu-blurb{color:var(--muted);font-size:.9rem;margin:0}
.profile-menu-filters{display:flex;flex-wrap:wrap;gap:0;border-bottom:1px solid rgba(0,0,0,.08);margin-bottom:1.25rem}
.profile-menu-filter{padding:.45rem .9rem;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-family:var(--font-body);font-size:.875rem;font-weight:600;color:var(--muted);cursor:pointer;transition:color .15s,border-color .15s;white-space:nowrap}
.profile-menu-filter:hover{color:var(--pink)}
.profile-menu-filter--active{color:var(--pink);border-bottom-color:var(--pink)}
.profile-service-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.875rem}
.profile-service-card{display:flex;align-items:center;gap:.85rem;padding:.75rem;border-radius:14px;background:var(--cream,#fff);border:1px solid rgba(0,0,0,.07);text-decoration:none;color:inherit;transition:box-shadow .15s}
.profile-service-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);border-color:rgba(219,39,119,.2)}.profile-service-card--outlined{background:var(--cream);border:1.5px solid var(--card-outline,var(--ink))}.profile-service-card--outlined:hover{box-shadow:0 4px 16px rgba(0,0,0,.1);border-color:var(--ink)}
.profile-service-card__img{width:64px;height:64px;border-radius:12px;flex-shrink:0;background:linear-gradient(145deg,#e8e3db,#d6d0c7);background-size:cover;background-position:center}
.profile-service-card__body{flex:1;min-width:0}
.profile-service-card__name{font-weight:700;font-size:.88rem;color:var(--ink);line-height:1.3}
.profile-service-card__price{font-size:.83rem;font-weight:700;color:var(--pink);margin-top:.15rem}
.profile-service-card__duration{font-size:.75rem;color:var(--muted)}
.profile-location-section{padding:2.5rem 0;background:var(--cream);border-top:1px solid rgba(0,0,0,.06)}
.profile-location-head{margin-bottom:1.25rem}
.profile-location-head h2{font-family:var(--font-display);font-size:clamp(1.4rem,2.5vw,2rem);font-weight:700;color:var(--ink);margin:0;border-bottom:2px solid var(--pink);display:inline-block;padding-bottom:.2rem}
.profile-location-card{background:var(--cream,#fff);border-radius:20px;border:1px solid rgba(0,0,0,.07);overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06)}
.profile-location-info{padding:1.25rem 1.5rem;display:flex;flex-wrap:wrap;gap:1.25rem 2.5rem}
.profile-location-col h3{font-family:var(--font-display);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 .4rem}
.profile-location-col p{margin:.2rem 0;color:var(--ink);font-size:.9rem}
.profile-location-col a{color:var(--pink);text-decoration:none}
.profile-location-col a:hover{text-decoration:underline}
.profile-ig-link a{display:inline-flex;align-items:center;gap:.35rem}
.profile-ig-icon{width:15px;height:15px;flex-shrink:0;vertical-align:middle;color:var(--pink)}
.profile-location-map{width:100%;height:240px;border:0;border-top:1px solid rgba(0,0,0,.06);display:block}
.profile-service-card-wrap{display:flex;flex-direction:column}
.profile-service-card-wrap .profile-service-card{flex:1}
.profile-service-card__expand-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:.45rem .75rem;background:transparent;border:none;border-top:1px solid rgba(0,0,0,.07);cursor:pointer;font-family:var(--font-body);font-size:.78rem;font-weight:600;color:var(--muted);text-align:left;gap:.5rem}
.profile-service-card__expand-btn:hover{color:var(--pink)}
.profile-service-card__expand-chevron{flex-shrink:0;transition:transform .2s}
.profile-service-card__expand-btn.is-open .profile-service-card__expand-chevron{transform:rotate(180deg)}
.profile-service-card__desc{padding:.65rem .75rem .75rem;font-size:.85rem;line-height:1.6;color:var(--muted);border-top:1px solid rgba(0,0,0,.06);background:rgba(0,0,0,.02);border-radius:0 0 14px 14px}
[hidden]{display:none!important}
@media(max-width:680px){.profile-hero__grid{grid-template-columns:1fr}.profile-photo{aspect-ratio:4/3;max-height:260px;width:100%;margin:0 auto;justify-self:center}.profile-service-grid{grid-template-columns:1fr}}
.profile-hero--stack{overflow:hidden}
.profile-hero--cover{padding:0}
.profile-hero--cover .profile-hero__grid{display:block;width:100%;max-width:100%;margin:0;padding:0}
.profile-hero--cover .profile-photo{width:100%;aspect-ratio:unset;height:clamp(420px,72vh,760px);border-radius:0;box-shadow:none}
.profile-hero--cover .profile-photo__bg{background-position:center;background-size:cover;min-height:unset;height:100%;position:relative}
.profile-cover-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,rgba(0,0,0,.52) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:2rem 2rem 1.75rem}
.profile-cover-overlay .profile-brand{font-size:1.6rem;font-weight:700;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.35);text-decoration:none;font-family:var(--font-display);display:block;margin-bottom:.85rem}
.profile-cover-overlay .profile-book-btn{align-self:flex-start}
.profile-hero-stack{display:block;width:100%}
.profile-hero-stack__img{display:block;width:100%;max-width:100%;aspect-ratio:3/1;object-fit:cover;object-position:center}
.profile-hero--stack .profile-hero__grid{grid-template-columns:1fr;padding-top:1.5rem}
.profile-hero--stack .profile-photo{display:none}
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
  id?: string;
  title: string;
  description: string;
  priceLabel: string;
  sizeLabel?: string;
  durationLabel?: string;
  imageUrl?: string | null;
  category?: string;
};

export type SitePreviewTheme = {
  heroLayout: HeroLayout;
  heroImageUrl?: string | null;
  logoImageUrl?: string | null;
  heroStackImageUrls?: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  navbarColor?: string | null;
  cardOutlineColor?: string | null;
  zoomedOut?: boolean;
  styleCardLayout?: StyleCardLayout;
  fontFamily?: FontFamily | null;
  templateId?: TemplateId | null;
  hideBookNowButton?: boolean;
};

export const DEFAULT_PREVIEW_THEME: SitePreviewTheme = {
  heroLayout: 'split',
  heroImageUrl: null,
  logoImageUrl: null,
  primaryColor: '#db2777',
  secondaryColor: '#0a0a0a',
  backgroundColor: null,
  zoomedOut: false,
  fontFamily: 'cormorant',
  templateId: 'profile',
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
  const fontOpt = FONT_FAMILY_OPTIONS.find((f) => f.id === theme.fontFamily);
  const fontDisplay = fontOpt ? fontOpt.css : '"Cormorant Garamond", Georgia, serif';
  const fontBody = fontOpt ? fontOpt.bodyCss : '"Source Sans 3", system-ui, sans-serif';
  const bgColor = theme.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(theme.backgroundColor)
    ? theme.backgroundColor
    : null;
  // Only set --cream (body/section background) to the user's chosen color.
  // --white is intentionally NOT overridden so service cards remain visually
  // distinct from the page background.
  const bgPart = bgColor ? `--cream:${bgColor};--white:${bgColor};` : '';
  const navbarColor = theme.navbarColor && /^#[0-9a-fA-F]{6}$/.test(theme.navbarColor)
    ? theme.navbarColor
    : null;
  const navBgPart = navbarColor ? `--nav-bg:${navbarColor};` : '';
  const cardOutlineColor = theme.cardOutlineColor && /^#[0-9a-fA-F]{6}$/.test(theme.cardOutlineColor)
    ? theme.cardOutlineColor : null;
  const cardOutlinePart = cardOutlineColor ? `--card-outline:${cardOutlineColor};` : '';
  const secRgb = hexToRgb(secondary);
  const mutedPart = secRgb
    ? `--muted:rgba(${secRgb[0]},${secRgb[1]},${secRgb[2]},0.62);--muted-soft:rgba(${secRgb[0]},${secRgb[1]},${secRgb[2]},0.46);`
    : '';
  const primaryRgb = hexToRgb(primary);
  const primaryLuminance = primaryRgb
    ? (0.299 * primaryRgb[0] + 0.587 * primaryRgb[1] + 0.114 * primaryRgb[2]) / 255
    : 0;
  const filterActiveText = primaryLuminance > 0.5 ? '#000000' : '#ffffff';
  const hideBookNowPart = theme.hideBookNowButton ? '.profile-book-btn{display:none!important}' : '';
  return `:root{--pink:${primary};--pink-dark:${primaryDark};--pink-heading:${primaryHeading};--hero-pink:${primaryLight};--hero-pink-deep:${primaryDark};--pink-light:${primaryLight};--ink:${secondary};--font-display:${fontDisplay};--font-body:${fontBody};--filter-active-text:${filterActiveText};${bgPart}${navBgPart}${mutedPart}${cardOutlinePart}}${hideBookNowPart}`;
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
<a class="hero-btn hero-btn--gold hero-btn--lg" href="/booking">Book now</a></div>`;
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

function buildCatalogServiceCardHtml(style: SitePreviewStyle): string {
  const mediaClass = style.imageUrl
    ? 'catalog-service-card__media catalog-service-card__media--photo'
    : 'catalog-service-card__media';
  const mediaStyle = style.imageUrl
    ? ` style="background-image:url('${style.imageUrl.replace(/'/g, '%27')}');"`
    : '';
  const sizeHtml = style.sizeLabel
    ? `<span class="catalog-service-card__size">${escapeHtml(style.sizeLabel)}</span>`
    : '';
  const durationHtml = style.durationLabel
    ? `<span class="catalog-service-card__duration">${escapeHtml(style.durationLabel)}</span>`
    : '';
  const priceHtml = style.priceLabel
    ? `<span class="catalog-service-card__price">${escapeHtml(style.priceLabel)}</span>`
    : '';
  const midHtml =
    sizeHtml || durationHtml || priceHtml
      ? `<div class="catalog-service-card__mid">${sizeHtml}${durationHtml}${priceHtml}</div>`
      : '';

  const bookHref = style.id ? `/booking?style=${encodeURIComponent(style.id)}` : '/booking';
  return `<a class="catalog-service-card" href="${bookHref}"><div class="${mediaClass}" aria-hidden="true"${mediaStyle}></div><div class="catalog-service-card__body"><span class="catalog-service-card__title">${escapeHtml(style.title)}</span>${midHtml}</div></a>`;
}

function buildCatalogServiceCardsHtml(styles: SitePreviewStyle[]): string {
  if (!styles.length) {
    return `<div class="catalog-service-cards catalog-service-cards--popular">${buildCatalogServiceCardHtml({
      title: 'Add styles',
      description: '',
      priceLabel: '',
      sizeLabel: 'Your menu',
    })}</div>`;
  }

  const cards = styles.slice(0, 12).map(buildCatalogServiceCardHtml).join('');
  return `<div class="catalog-service-cards catalog-service-cards--popular">${cards}</div>`;
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
      const metaBits = [style.durationLabel, style.priceLabel].filter(Boolean);
      const descText = style.description || metaBits.join(' · ');
      const desc = descText ? `<div class="style-pill__desc">${escapeHtml(descText)}</div>` : '';
      const price = '';
      return `<a class="style-pill" href="#">${imgHtml}<div class="style-pill__body"><div class="style-pill__name">${escapeHtml(style.title)}</div>${desc}</div>${price}</a>`;
    })
    .join('');
  return `<div class="style-pill-list">${items}</div>`;
}

function isSectionHidden(content: SiteContent, section: SiteSection): boolean {
  return Array.isArray(content.hiddenSections) && content.hiddenSections.includes(section);
}

function isLocationPartHidden(content: SiteContent, part: LocationPart): boolean {
  return Array.isArray(content.hiddenLocationParts) && content.hiddenLocationParts.includes(part);
}

function buildProfileServiceCardHtml(style: SitePreviewStyle, outlined = false): string {
  const cls = outlined ? 'profile-service-card profile-service-card--outlined' : 'profile-service-card';
  const imgStyle = style.imageUrl
    ? ` style="background-image:url('${style.imageUrl.replace(/'/g, '%27')}');background-size:cover;background-position:center;"`
    : '';
  const bookHref = style.id ? `/booking?style=${encodeURIComponent(style.id)}` : '/booking';
  const cat = style.category?.trim() || '';
  const desc = style.description?.trim() || '';

  const cardLink = `<a class="${cls}" href="${bookHref}"><div class="profile-service-card__img" aria-hidden="true"${imgStyle}></div><div class="profile-service-card__body"><div class="profile-service-card__name">${escapeHtml(style.title)}</div>${style.priceLabel ? `<div class="profile-service-card__price">${escapeHtml(style.priceLabel)}</div>` : ''}${style.durationLabel ? `<div class="profile-service-card__duration">${escapeHtml(style.durationLabel)}</div>` : ''}</div></a>`;

  const expandHtml = desc
    ? `<button class="profile-service-card__expand-btn" type="button" aria-expanded="false" onclick="(function(btn){var w=btn.closest('.profile-service-card-wrap');var d=w&&w.querySelector('.profile-service-card__desc');if(!d)return;var open=d.hidden;d.hidden=!open;btn.classList.toggle('is-open',open);btn.setAttribute('aria-expanded',open?'true':'false');})(this)"><span>About this service</span><svg class="profile-service-card__expand-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><div class="profile-service-card__desc" hidden>${escapeHtml(desc)}</div>`
    : '';

  return `<div class="profile-service-card-wrap"${cat ? ` data-category="${escapeHtml(cat)}"` : ''}>${cardLink}${expandHtml}</div>`;
}

function buildProfileServiceGridHtml(styles: SitePreviewStyle[], outlined = false): string {
  if (!styles.length) {
    return `<div class="profile-service-grid">${buildProfileServiceCardHtml({ title: 'Add styles in your app', description: '', priceLabel: '', sizeLabel: '' }, outlined)}</div>`;
  }

  const cards = styles.map((s) => buildProfileServiceCardHtml(s, outlined)).join('');

  // Build category filter tabs if any style has a category
  const categories = Array.from(new Set(styles.map((s) => (s.category || '').trim()).filter(Boolean)));
  const filtersHtml = categories.length > 0
    ? `<div class="profile-menu-filters" id="preview-menu-filters">
<button class="profile-menu-filter profile-menu-filter--active" data-filter="__all__" onclick="(function(btn){var filters=btn.closest('.profile-menu-filters');filters.querySelectorAll('.profile-menu-filter').forEach(function(b){b.classList.toggle('profile-menu-filter--active',b===btn)});var grid=document.getElementById('preview-service-grid');if(!grid)return;grid.querySelectorAll('.profile-service-card-wrap').forEach(function(w){w.hidden=false});})(this)">All</button>${categories.map((c) => `<button class="profile-menu-filter" data-filter="${escapeHtml(c)}" onclick="(function(btn){var filters=btn.closest('.profile-menu-filters');filters.querySelectorAll('.profile-menu-filter').forEach(function(b){b.classList.toggle('profile-menu-filter--active',b===btn)});var grid=document.getElementById('preview-service-grid');if(!grid)return;var filter=btn.dataset.filter;grid.querySelectorAll('.profile-service-card-wrap').forEach(function(w){w.hidden=(w.dataset.category||'')!==filter});})(this)">${escapeHtml(c)}</button>`).join('')}
</div>`
    : '';

  return `${filtersHtml}<div class="profile-service-grid" id="preview-service-grid">${cards}</div>`;
}

export function buildProfileSitePreviewHtml(
  content: SiteContent,
  styles: SitePreviewStyle[] = [],
  theme: SitePreviewTheme = DEFAULT_PREVIEW_THEME,
): string {
  const colorOverrideCss = buildColorOverrideCss(theme);
  const viewportContent = theme.zoomedOut
    ? 'width=800'
    : 'width=device-width,initial-scale=1,maximum-scale=1';

  const logoHtml = theme.logoImageUrl
    ? `<img class="profile-brand__logo-img" src="${theme.logoImageUrl.replace(/"/g, '%22')}" alt="" width="38" height="38" decoding="async"/>`
    : `<div class="profile-brand__logo" aria-hidden="true"></div>`;

  const isStack = theme.heroLayout === 'stack';
  const stackUrls = theme.heroStackImageUrls ?? [];

  const photoStyle = theme.heroImageUrl
    ? ` style="background-image:url('${theme.heroImageUrl.replace(/'/g, '%27')}');"`
    : '';
  const photoHtml = `<div class="profile-photo__bg"${photoStyle}></div>`;

  const aboutHtml = content.heroDescription
    ? `<p class="profile-about-body">${escapeHtml(content.heroDescription)}</p>`
    : `<p class="profile-about-body" style="color:#bbb;font-style:italic">Add your bio in the editor…</p>`;

  const policyBullets = content.bookingPolicy
    ? content.bookingPolicy.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const policyHtml = policyBullets.length > 0
    ? `<ul class="profile-policy-body">${policyBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : `<ul class="profile-policy-body"><li style="color:#bbb;font-style:italic;list-style:none">Add your booking policy…</li></ul>`;

  const isOutlined = theme.styleCardLayout === 'outlined';
  const menuSection = isSectionHidden(content, 'menu')
    ? ''
    : `<section class="profile-menu-section" id="preview-menu-section"><div class="container"><div class="profile-menu-head"><h2>${escapeHtml(content.menuTitle || 'Menu')}</h2>${content.menuBlurb ? `<p class="profile-menu-blurb">${escapeHtml(content.menuBlurb)}</p>` : ''}</div>${buildProfileServiceGridHtml(styles, isOutlined)}</div></section>`;

  const address = formatSiteAddress(content);
  const mapsSearchUrl = buildGoogleMapsSearchUrl(address);
  const mapSrc = buildGoogleMapsEmbedUrl(content);

  const hasAddress = !isLocationPartHidden(content, 'address') && address.trim().length > 0;
  const addressColHtml = hasAddress
    ? `<div class="profile-location-col"><h3>Address</h3><p><a href="${escapeHtml(mapsSearchUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(address)}</a></p></div>`
    : '';

  const instagram = content.instagramHandle.replace(/^@/, '').trim();
  const hasContact = !isLocationPartHidden(content, 'contact') && !!(content.phoneDisplay || content.email);
  const contactColHtml = hasContact
    ? `<div class="profile-location-col"><h3>Contact</h3>${content.phoneDisplay ? `<p>${escapeHtml(content.phoneDisplay)}</p>` : ''}${content.email ? `<p>${escapeHtml(content.email)}</p>` : ''}</div>`
    : '';

  const hasSocial = !isLocationPartHidden(content, 'social') && instagram.length > 0;
  const igUrl = hasSocial ? `https://www.instagram.com/${encodeURIComponent(instagram)}/` : '';
  const socialColHtml = hasSocial
    ? `<div class="profile-location-col"><h3>Social</h3><p class="profile-ig-link"><a href="${escapeHtml(igUrl)}" target="_blank" rel="noopener noreferrer"><svg class="profile-ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>@${escapeHtml(instagram)}</a></p></div>`
    : '';

  const mapHtml = !isLocationPartHidden(content, 'map') && mapSrc
    ? `<iframe class="profile-location-map" title="Map" loading="lazy" src="${escapeHtml(mapSrc)}"></iframe>`
    : '';

  const visitTitle = !hasAddress
    ? 'Connect'
    : !hasContact && !hasSocial
      ? 'Visit'
      : escapeHtml(content.visitTitle || 'Visit & Connect');

  const visitSection = isSectionHidden(content, 'visit') || (!hasAddress && !hasContact && !hasSocial)
    ? ''
    : `<section class="profile-location-section" id="preview-visit-section" data-site-section="visit"><div class="container"><div class="profile-location-head"><h2>${visitTitle}</h2></div><div class="profile-location-card"><div class="profile-location-info">${addressColHtml}${contactColHtml}${socialColHtml}</div>${mapHtml}</div></div></section>`;

  const stackImagesHtml = isStack && stackUrls.length > 0
    ? `<div class="profile-hero-stack">${stackUrls.map((u) => `<img class="profile-hero-stack__img" src="${u.replace(/"/g, '%22')}" alt="" loading="lazy"/>`).join('')}</div>`
    : '';

  const isSplit = theme.heroLayout === 'split';
  const infoHtml = isSplit
    ? `<div class="profile-info">
<div class="profile-section-block"><h2 class="profile-about-head">About Me</h2>${aboutHtml}</div>
<div class="profile-section-block" id="profile-policy-block"><h3 class="profile-policy-head">Policies</h3>${policyHtml}</div>
</div>`
    : '';

  const heroSectionClass = isStack ? 'profile-hero profile-hero--stack' : 'profile-hero';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="${viewportContent}"/>
<title>${escapeHtml(content.brandName)} | Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${GOOGLE_FONTS_URL}" rel="stylesheet"/>
<style>${SITE_PREVIEW_CSS}${colorOverrideCss}</style>
</head>
<body class="tpl-profile page-home">
<div class="preview-banner">Styld preview — this is how your booking site will look</div>
<nav class="profile-nav"><div class="container profile-nav__inner">
<a class="profile-brand" href="#">${logoHtml}<span>${escapeHtml(content.brandName)}</span></a>
<a class="profile-book-btn" href="#">Book Now</a>
</div></nav>
<section class="${heroSectionClass}">${stackImagesHtml}<div class="container profile-hero__grid">
<div class="profile-photo">${photoHtml}</div>
${infoHtml}
</div></section>
<main>
${menuSection}
${visitSection}
</main>
<footer class="site-footer site-footer--home-promo"><div class="container footer-bottom">
<p>&copy; ${escapeHtml(content.brandName)}</p>
<p class="footer-built-by"><a class="footer-built-by__link" href="https://styldd.com" target="_blank" rel="noopener noreferrer"><span>Built with Styld</span></a></p></div></footer>
</body></html>`;
}

export function buildSitePreviewHtml(
  content: SiteContent,
  styles: SitePreviewStyle[] = [],
  theme: SitePreviewTheme = DEFAULT_PREVIEW_THEME,
): string {
  if (theme.templateId !== 'classic') {
    return buildProfileSitePreviewHtml(content, styles, theme);
  }
  const address = formatSiteAddress(content);
  const instagram = content.instagramHandle.replace(/^@/, '');
  const mapsSearchUrl = buildGoogleMapsSearchUrl(address);
  const mapSrc = buildGoogleMapsEmbedUrl(content);

  const viewportContent = theme.zoomedOut
    ? 'width=800'
    : 'width=device-width,initial-scale=1,maximum-scale=1';

  const colorOverrideCss = buildColorOverrideCss(theme);

  const isPillLayout = theme.styleCardLayout === 'pill';
  const menuInner = isPillLayout ? buildStylePillsHtml(styles) : buildCatalogServiceCardsHtml(styles);
  const menuSection = isSectionHidden(content, 'menu')
    ? ''
    : `<section class="section section-popular-styles" id="preview-menu-section"><div class="container"><div class="section-head section-head--popular">
<h2>${escapeHtml(content.menuTitle || 'Menu')}</h2><p>${escapeHtml(content.menuBlurb || 'Browse our services & prices — book online.')}</p></div>
${menuInner}</div></section>`;

  const aboutSection = isSectionHidden(content, 'about')
    ? ''
    : `<section class="section"><div class="container"><div class="section-head">
<h2>${escapeHtml(content.aboutTitle)}</h2><p>${escapeHtml(content.aboutBody)}</p></div></div></section>`;

  const addressLine2 = [content.addressLine2, content.city, content.state, content.zip]
    .filter(Boolean)
    .join(', ');
  const addressBlock = isLocationPartHidden(content, 'address')
    ? ''
    : address.trim()
      ? `<a class="location-address-link" href="${escapeHtml(mapsSearchUrl)}" target="_blank" rel="noopener noreferrer">${
          content.addressLine1
            ? `<p><strong>${escapeHtml(content.addressLine1)}</strong></p>`
            : ''
        }${addressLine2 ? `<p>${escapeHtml(addressLine2)}</p>` : ''}${
          !content.addressLine1 && !addressLine2
            ? `<p><strong>${escapeHtml(address)}</strong></p>`
            : ''
        }</a>`
      : '';

  const contactBlock = isLocationPartHidden(content, 'contact')
    ? ''
    : `<p>${escapeHtml(content.phoneDisplay)}</p><p>@${escapeHtml(instagram)}</p>${content.email ? `<p>${escapeHtml(content.email)}</p>` : ''}`;

  const mapBlock =
    isLocationPartHidden(content, 'map') || !mapSrc
      ? ''
      : `<div class="location-map-wrap"><iframe class="location-map" title="Map to ${escapeHtml(address || 'location')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escapeHtml(mapSrc)}"></iframe></div>`;

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
<link href="${GOOGLE_FONTS_URL}" rel="stylesheet"/>
<style>${SITE_PREVIEW_CSS}${colorOverrideCss}</style>
</head>
<body class="page-home">
<div class="preview-banner">Styld preview — this is how your booking site will look</div>
<section class="hero-landing">
<div class="hero-landing__bg"></div><div class="hero-landing__vignette"></div>
<header class="hero-nav"><div class="container hero-nav__inner">
<a class="hero-brand" href="#"><span class="hero-brand__logo"></span><span>${escapeHtml(content.brandName)}</span></a>
<div class="hero-nav__panel"><nav class="hero-nav__links"><a href="#">Home</a></nav>
<a class="hero-btn" href="#preview-visit-section">Book Now</a></div></div></header>
<div class="container hero-landing__content">${buildHeroInnerHtml(content, theme)}</div>
</section>
<main>
${menuSection}
${aboutSection}
${visitSection}
</main>
<footer class="site-footer site-footer--home-promo"><div class="container footer-bottom">
<p>&copy; ${escapeHtml(content.brandName)}</p>
<p class="footer-built-by"><a class="footer-built-by__link" href="https://styldd.com" target="_blank" rel="noopener noreferrer"><img class="footer-built-by__logo" src="https://styldd.com/assets/styld-icon.png" alt="" width="22" height="22" decoding="async"/><span>Built with Styld</span></a></p></div></footer>
</body></html>`;
}
