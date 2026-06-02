/**
 * Small square images on each Styles catalog row (left of the title/price).
 * Supabase overrides from the admin dashboard win over static assets/catalog/*.jpg.
 */
(function () {
  var PREFIX = "assets/catalog/";
  var FILES = {
    "studio-feedin-2": "feedin-2.jpg",
    "house-feedin-2": "feedin-2.jpg",
    "kids-feedin-2": "feedin-2.jpg",
    "studio-feedin-4": "feedin-4.jpg",
    "house-feedin-4": "feedin-4.jpg",
    "kids-feedin-4": "feedin-4.jpg",
    "studio-feedin-8": "feedin-8.jpg",
    "house-feedin-8": "feedin-8.jpg",
    "kids-feedin-8": "feedin-8.jpg",
    "studio-feedin-10plus": "feedin-10plus.jpg",
    "house-feedin-10plus": "feedin-10plus.jpg",
    "kids-feedin-10plus": "feedin-10plus.jpg",
    "studio-natural-cornrows": "natural-cornrows.jpg",
    "studio-fulani-one": "fulani-one.jpg",
    "house-fulani-one": "fulani-one.jpg",
    "kids-fulani-one": "fulani-one.jpg",
    "studio-wig-install": "wig-install.jpg",
    "house-wig-install": "wig-install.jpg",
    "studio-boho-lg": "boho-lg.jpg",
    "house-boho-lg": "boho-lg.jpg",
    "kids-boho-lg": "boho-lg.jpg",
    "studio-locs-barrels": "locs-barrels.jpg",
    "studio-locs-half-up": "locs-half-up.jpg",
    "studio-boho-md": "boho-md.jpg",
    "house-boho-md": "boho-md.jpg",
    "kids-boho-md": "boho-md.jpg",
    "studio-passion-md": "passion-md.jpg",
    "house-passion-md": "passion-md.jpg",
    "kids-passion-md": "passion-md.jpg",
    "studio-natural-twist": "natural-twist.jpg",
    "kids-natural-twist": "natural-twist.jpg",
    "studio-natural-box": "natural-box.jpg",
    "kids-natural-box": "natural-box.jpg",
    "studio-natural-fulani": "natural-fulani.jpg",
    "studio-natural-2strand": "natural-2strand.jpg",
    "kids-natural-2strand": "natural-2strand.jpg",
    "studio-wig-pony": "wig-pony.jpg",
    "house-wig-pony": "wig-pony.jpg",
    "studio-wig-qw": "wig-qw.jpg",
    "house-wig-qw": "wig-qw.jpg",
    "studio-locs-retwist": "locs-retwist.jpg",
    "studio-boho-sm": "boho-sm.jpg",
    "house-boho-sm": "boho-sm.jpg",
    "studio-passion-sm": "passion-sm.jpg",
    "house-passion-sm": "passion-sm.jpg",
    "kids-passion-sm": "passion-sm.jpg",
    "studio-locs-starter": "locs-starter.jpg",
    "studio-locs-2strand": "locs-2strand.jpg",
    "studio-fulani-passion-twists": "fulani-one.jpg",
    "house-fulani-passion-twists": "fulani-one.jpg",
    "kids-fulani-passion-twists": "fulani-one.jpg",
    "kids-knotless-md": "boho-md.jpg",
    "kids-knotless-lg": "boho-lg.jpg",
    "kids-lemonade-one": "fulani-one.jpg",
  };

  function styleCoverPublicUrl(path) {
    var base = window.__NADJAE_SUPABASE && window.__NADJAE_SUPABASE.url;
    if (!base || !path) return "";
    var segs = String(path)
      .replace(/^\/+/, "")
      .split("/")
      .map(function (s) {
        return encodeURIComponent(s);
      })
      .join("/");
    return String(base).replace(/\/$/, "") + "/storage/v1/object/public/style-covers/" + segs;
  }

  function fetchRemoteMap() {
    var SITE = window.__NADJAE_SITE_DATA;
    if (SITE && typeof SITE.fetchStyleCoverMap === "function") {
      return SITE.fetchStyleCoverMap(window.nadjaeSupabaseClient);
    }
    return Promise.resolve({});
  }

  function applyThumbnails(remoteMap) {
    document.querySelectorAll('a.catalog-service-card[href*="style="]').forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var match = href.match(/(?:\?|&)style=([^&]+)/);
      if (!match) return;
      var id = decodeURIComponent(match[1].replace(/\+/g, " "));
      var media = a.querySelector(".catalog-service-card__media");
      if (!media) return;

      var remotePath = remoteMap[id] && remoteMap[id].storage_path;
      if (remotePath) {
        var url = styleCoverPublicUrl(remotePath);
        if (url) {
          media.classList.add("catalog-service-card__media--photo");
          media.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        }
        return;
      }

      var file = FILES[id];
      if (!file) return;
      media.classList.add("catalog-service-card__media--photo");
      media.style.backgroundImage = 'url("' + PREFIX + file + '")';
    });
  }

  function run() {
    fetchRemoteMap().then(function (remoteMap) {
      applyThumbnails(remoteMap || {});
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
