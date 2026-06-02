/**
 * Style base prices: loaded from Supabase `hairbynadjae_site` (style_price_overrides).
 * Bundled DEFAULT_STYLE_ROWS are offline fallbacks only until Supabase responds.
 * Admin writes the full price map via Edge Function `admin-salon-site-kv`.
 */
(function () {
  var KV_KEY = "style_price_overrides";
  var SITE = window.__NADJAE_SITE_DATA;

  /** @type {Record<string, number>} */
  var remoteOverrideMap = {};
  var remotePricesLoaded = false;

  var DEFAULT_STYLE_ROWS = [
    { id: "studio-knotless-sm", name: "Studio · Knotless · Small", base: 155 },
    { id: "studio-knotless-md", name: "Studio · Knotless · Medium", base: 110 },
    { id: "studio-knotless-lg", name: "Studio · Knotless · Large", base: 95 },
    { id: "studio-passion-sm", name: "Studio · Passion twist · Smedium", base: 175 },
    { id: "studio-passion-md", name: "Studio · Passion twist · Medium", base: 135 },
    { id: "studio-wig-install", name: "Studio · Wigs / quick weave · Install & style", base: 120 },
    { id: "studio-wig-pony", name: "Studio · Wigs / quick weave · Ponytail", base: 90 },
    { id: "studio-wig-qw", name: "Studio · Wigs / quick weave · Q/W", base: 100 },
    { id: "studio-wig-fulani-quickweave", name: "Studio · Wigs / quick weave · Fulani quick weave", base: 110 },
    { id: "studio-natural-2strand", name: "Studio · Natural · 2 strand", base: 50 },
    { id: "studio-natural-cornrows", name: "Studio · Natural · Cornrows (designs +10)", base: 35 },
    { id: "studio-natural-fulani", name: "Studio · Natural · Fulani", base: 45 },
    { id: "studio-natural-box", name: "Studio · Natural · Box braids", base: 40 },
    { id: "studio-natural-twist", name: "Studio · Natural · Regular twist", base: 35 },
    { id: "studio-boho-sm", name: "Studio · Boho braids · Smedium", base: 185 },
    { id: "studio-boho-md", name: "Studio · Boho braids · Medium", base: 135 },
    { id: "studio-boho-lg", name: "Studio · Boho braids · Large", base: 100 },
    { id: "studio-feedin-2", name: "Studio · Feed-in cornrows · 2", base: 75 },
    { id: "studio-feedin-4", name: "Studio · Feed-in cornrows · 4", base: 85 },
    { id: "studio-feedin-8", name: "Studio · Feed-in cornrows · 8", base: 95 },
    { id: "studio-feedin-10plus", name: "Studio · Feed-in cornrows · 10+", base: 120 },
    { id: "studio-locs-2strand", name: "Studio · Locs · 2 strand", base: 90 },
    { id: "studio-locs-retwist", name: "Studio · Locs · Retwist", base: 70 },
    { id: "studio-locs-barrels", name: "Studio · Locs · Barrels", base: 80 },
    { id: "studio-locs-half-up", name: "Studio · Locs · Half up half down", base: 65 },
    { id: "studio-locs-starter", name: "Studio · Locs · Starter loc", base: 100 },
    { id: "studio-fulani-one", name: "Studio · Fulani braids · One size", base: 155 },
    { id: "studio-fulani-passion-twists", name: "Studio · Fulani passion twists", base: 165 },
    { id: "house-knotless-sm", name: "House call · Knotless · Small", base: 185 },
    { id: "house-knotless-md", name: "House call · Knotless · Medium", base: 135 },
    { id: "house-knotless-lg", name: "House call · Knotless · Large", base: 110 },
    { id: "house-passion-sm", name: "House call · Passion twist · Smedium", base: 175 },
    { id: "house-passion-md", name: "House call · Passion twist · Medium", base: 145 },
    { id: "house-boho-sm", name: "House call · Boho braids · Smedium", base: 200 },
    { id: "house-boho-md", name: "House call · Boho braids · Medium", base: 160 },
    { id: "house-boho-lg", name: "House call · Boho braids · Large", base: 115 },
    { id: "house-feedin-2", name: "House call · Feed-in cornrows · 2", base: 90 },
    { id: "house-feedin-4", name: "House call · Feed-in cornrows · 4", base: 100 },
    { id: "house-feedin-8", name: "House call · Feed-in cornrows · 8", base: 115 },
    { id: "house-feedin-10plus", name: "House call · Feed-in cornrows · 10+", base: 125 },
    { id: "house-fulani-one", name: "House call · Fulani braids · One size", base: 170 },
    { id: "house-fulani-passion-twists", name: "House call · Fulani passion twists", base: 185 },
    { id: "house-wig-install", name: "House call · Wigs / quick weave · Install & style", base: 135 },
    { id: "house-wig-pony", name: "House call · Wigs / quick weave · Ponytail", base: 100 },
    { id: "house-wig-qw", name: "House call · Wigs / quick weave · Q/W", base: 115 },
    { id: "house-wig-fulani-quickweave", name: "House call · Wigs / quick weave · Fulani quick weave", base: 125 },
    { id: "kids-knotless-md", name: "Kids (12 & under) · Knotless · Medium", base: 110 },
    { id: "kids-knotless-lg", name: "Kids (12 & under) · Knotless · Large", base: 85 },
    { id: "kids-passion-sm", name: "Kids (12 & under) · Passion twist · Smedium", base: 135 },
    { id: "kids-passion-md", name: "Kids (12 & under) · Passion twist · Medium", base: 115 },
    { id: "kids-natural-2strand", name: "Kids (12 & under) · Natural · 2 strand", base: 40 },
    { id: "kids-natural-cornrows", name: "Kids (12 & under) · Natural · Cornrows", base: 25 },
    { id: "kids-natural-box", name: "Kids (12 & under) · Natural · Box braids", base: 40 },
    { id: "kids-natural-twist", name: "Kids (12 & under) · Natural · Regular twist", base: 35 },
    { id: "kids-boho-md", name: "Kids (12 & under) · Boho braids · Medium", base: 120 },
    { id: "kids-boho-lg", name: "Kids (12 & under) · Boho braids · Large", base: 100 },
    { id: "kids-feedin-2", name: "Kids (12 & under) · Feed-in cornrows · 2", base: 55 },
    { id: "kids-feedin-4", name: "Kids (12 & under) · Feed-in cornrows · 4", base: 65 },
    { id: "kids-feedin-8", name: "Kids (12 & under) · Feed-in cornrows · 8", base: 90 },
    { id: "kids-feedin-10plus", name: "Kids (12 & under) · Feed-in cornrows · 10+", base: 100 },
    { id: "kids-fulani-one", name: "Kids (12 & under) · Fulani braids · One size", base: 140 },
    { id: "kids-fulani-passion-twists", name: "Kids (12 & under) · Fulani passion twists", base: 150 },
    { id: "kids-lemonade-one", name: "Kids (12 & under) · Lemonade braids · One size", base: 125 },
    { id: "other", name: "Other / consultation (price at visit)", base: 0 },
  ];

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function applyRemoteOverrideMap(map) {
    remoteOverrideMap = {};
    if (map && typeof map === "object" && !Array.isArray(map)) {
      Object.keys(map).forEach(function (k) {
        var v = map[k];
        var n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n) && n >= 0) remoteOverrideMap[k] = round2(n);
      });
    }
    remotePricesLoaded = true;
    try {
      document.dispatchEvent(new CustomEvent("nadjae-pricing-updated"));
    } catch (_) {
      /* ignore */
    }
  }

  function getDefaults() {
    return DEFAULT_STYLE_ROWS.map(function (r) {
      return { id: r.id, name: r.name, base: r.base };
    });
  }

  function defaultBaseById(id) {
    var row = DEFAULT_STYLE_ROWS.find(function (r) {
      return r.id === id;
    });
    return row && Number.isFinite(row.base) ? row.base : 0;
  }

  function getMergedStyles() {
    return DEFAULT_STYLE_ROWS.map(function (row) {
      var base = row.base;
      if (remotePricesLoaded && Object.prototype.hasOwnProperty.call(remoteOverrideMap, row.id)) {
        base = remoteOverrideMap[row.id];
      }
      return { id: row.id, name: row.name, base: base };
    });
  }

  function formatUsd(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "$0";
    var r = round2(x);
    if (Math.abs(r - Math.round(r)) < 1e-9) return "$" + String(Math.round(r));
    return "$" + r.toFixed(2);
  }

  function getBaseForStyleId(id) {
    var row = getMergedStyles().find(function (s) {
      return s.id === id;
    });
    return row ? Number(row.base) : 0;
  }

  function applyCatalogCardPrices() {
    document.querySelectorAll('a.catalog-service-card[href*="booking.html?style="]').forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var m = /[?&]style=([^&]+)/.exec(href);
      if (!m) return;
      var sid = decodeURIComponent(m[1]);
      var priceEl = a.querySelector(".catalog-service-card__price");
      if (!priceEl) return;
      priceEl.textContent = formatUsd(getBaseForStyleId(sid));
    });
  }

  function applyLookbookPriceRanges() {
    document.querySelectorAll("[data-nadjae-price-ids]").forEach(function (el) {
      var ids = String(el.getAttribute("data-nadjae-price-ids") || "")
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var nums = ids.map(getBaseForStyleId).filter(function (n) {
        return n > 0;
      });
      if (!nums.length) return;
      var lo = Math.min.apply(null, nums);
      var hi = Math.max.apply(null, nums);
      el.textContent = lo === hi ? formatUsd(lo) : formatUsd(lo) + " - " + formatUsd(hi);
    });
  }

  function applyPublicPriceDom() {
    applyCatalogCardPrices();
    applyLookbookPriceRanges();
  }

  function fetchRemoteStylePriceOverrides() {
    if (SITE && typeof SITE.fetchStylePriceOverrideMap === "function") {
      return SITE.fetchStylePriceOverrideMap()
        .then(function (val) {
          applyRemoteOverrideMap(val && typeof val === "object" ? val : {});
        })
        .catch(function () {
          /* keep bundled defaults */
        });
    }
    return Promise.resolve();
  }

  function boot() {
    fetchRemoteStylePriceOverrides()
      .catch(function () {
        /* bundled defaults until Supabase is reachable */
      })
      .finally(function () {
        applyPublicPriceDom();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("nadjae-pricing-updated", applyPublicPriceDom);

  window.__NADJAE_STYLE_PRICING = {
    kvKey: KV_KEY,
    getDefaults: getDefaults,
    getMergedStyles: getMergedStyles,
    defaultBaseById: defaultBaseById,
    formatUsd: formatUsd,
    getBaseForStyleId: getBaseForStyleId,
    applyRemoteOverrideMap: applyRemoteOverrideMap,
    fetchRemoteStylePriceOverrides: fetchRemoteStylePriceOverrides,
    refreshPublicPriceDom: applyPublicPriceDom,
  };
})();
