/**
 * Admin dashboard for bookings.
 * Access code is UI-only and not secure; use proper auth for production.
 */
(function () {
  var ACCESS_CODE = "0000";
  var LOCAL_BOOKINGS_KEY = "nadjae_bookings_local";
  var gate = document.getElementById("admin-gate");
  var gateForm = document.getElementById("admin-gate-form");
  var gateInput = document.getElementById("admin-code");
  var gateError = document.getElementById("admin-gate-error");
  var rangeEl = document.getElementById("admin-range");
  var refreshBtn = document.getElementById("admin-refresh");
  var loadingEl = document.getElementById("admin-loading");
  var errorEl = document.getElementById("admin-error");

  var kpisEl = document.getElementById("admin-kpis");
  var servicesEl = document.getElementById("admin-services");
  var clientsEl = document.getElementById("admin-clients");
  var daysEl = document.getElementById("admin-days");
  var optionsEl = document.getElementById("admin-options");
  var upcomingBody = document.querySelector("#admin-upcoming-table tbody");
  var recentBody = document.querySelector("#admin-recent-table tbody");
  var inquiriesBody = document.querySelector("#admin-inquiries-table tbody");
  var allBookingsBody = document.querySelector("#admin-all-bookings-table tbody");
  var adminBookingStatus = document.getElementById("admin-booking-status");
  var adminBookingSearch = document.getElementById("admin-booking-search");
  var adminCancelBtn = document.getElementById("admin-cancel-booking-btn");
  var clientDetailOverlay = document.getElementById("admin-client-detail");
  var clientProfileWrap = document.getElementById("admin-client-profile");
  var clientKpisEl = document.getElementById("admin-client-kpis");
  var clientContactEl = document.getElementById("admin-client-contact");
  var clientStylesEl = document.getElementById("admin-client-styles");
  var clientHistoryBody = document.querySelector("#admin-client-history-table tbody");
  var detailOverlay = document.getElementById("admin-booking-detail");
  var emailPreviewModal = document.getElementById("admin-email-preview-modal");
  var emailPreviewFrame = document.getElementById("admin-email-preview-frame");
  var detailEls = {
    bookingIdCode: document.getElementById("admin-detail-booking-id"),
    bookingShort: document.getElementById("admin-detail-booking-short"),
    statusLine: document.getElementById("admin-detail-status"),
    dlContact: document.getElementById("admin-dl-contact"),
    dlAppointment: document.getElementById("admin-dl-appointment"),
    dlService: document.getElementById("admin-dl-service"),
    dlPayment: document.getElementById("admin-dl-payment"),
    dlExtra: document.getElementById("admin-dl-extra"),
    sectionExtra: document.getElementById("admin-section-extra"),
  };
  /** Latest fetch; used to resolve booking id → row for the detail card. */
  var cachedRows = [];
  var cachedClientGroups = new Map();
  var selectedClientKey = "";
  var fcCalendar = null;
  var currentDetailBookingId = null;
  var cachedBlockedIntervals = [];
  var scheduleToastHideTimer = null;
  var scheduleToastDomHideTimer = null;
  var selectedEmailPreviewKey = "salon-booking";

  /** Same online booking rule as `js/booking.js` / booking page calendar. */
  var BOOKING_LEAD_DAYS = 3;
  function getBookCfg() {
    return Object.assign(
      {
        salonTimeZone: "America/New_York",
        blackoutRanges: [],
      },
      window.__NADJAE_BOOKING || {},
    );
  }
  var BOOK_CFG = getBookCfg();

  function reloadBookCfg() {
    BOOK_CFG = getBookCfg();
  }

  function adminIsClosedWeekday(isoDate) {
    var closed = BOOK_CFG.closedWeekdays || [];
    if (!closed.length) return false;
    var lux = adminManualParseIso(isoDate).weekday;
    var jsDay = lux === 7 ? 0 : lux;
    return closed.indexOf(jsDay) >= 0;
  }

  var adminManualCalYear;
  var adminManualCalMonth;
  var adminManualSelectedIsoDate = null;
  var adminManualDatesWithBookings = new Set();

  var adminBlockCalYear;
  var adminBlockCalMonth;
  var adminBlockSelectedIsoDate = null;

  var ADMIN_SLOT_OPTIONS = (function () {
    var labels = [];
    for (var t = 8 * 60; t <= 19 * 60 + 30; t += 30) {
      var h24 = Math.floor(t / 60);
      var m = t % 60;
      var h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      var ampm = h24 < 12 ? "AM" : "PM";
      labels.push(h12 + ":" + (m < 10 ? "0" : "") + m + " " + ampm);
    }
    return labels;
  })();

  function getAdminBookingStyles() {
    var sp = window.__NADJAE_STYLE_PRICING;
    if (sp && typeof sp.getMergedStyles === "function") return sp.getMergedStyles();
    return [];
  }

  /**
   * Bundled Styles-catalog thumbnails (same keys as `js/catalog-thumbnails.js` FILES).
   * Keep in sync when adding/removing static assets under assets/catalog/.
   */
  var STYLE_COVER_DEFAULT_FILES = {
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
  };

  function round2Admin(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /** Same rules as `styleSupportsExtraHairLength` in js/booking.js */
  function styleSupportsExtraHairLength(styleId) {
    if (!styleId || styleId === "other") return false;
    var s = String(styleId).toLowerCase();
    if (s.indexOf("knotless") >= 0) return true;
    if (s.indexOf("boho") >= 0) return true;
    if (s.indexOf("fulani") >= 0) return true;
    if (s.indexOf("feedin") >= 0 || s.indexOf("cornrows") >= 0) return true;
    return false;
  }

  function syncAdminManualDependentFields() {
    var styleSel = document.getElementById("admin-manual-style");
    var sid = styleSel && styleSel.value ? String(styleSel.value) : "";
    var lenWrap = document.getElementById("admin-manual-hair-length-wrap");
    var addrWrap = document.getElementById("admin-manual-house-address-wrap");
    var addrInput = document.getElementById("admin-manual-service-address");
    var hairSel = document.getElementById("admin-manual-hair-length");
    if (lenWrap) {
      var showLen = styleSupportsExtraHairLength(sid);
      lenWrap.hidden = !showLen;
      if (!showLen && hairSel) hairSel.value = "";
    }
    if (addrWrap && addrInput) {
      var showAddr = sid.indexOf("house-") === 0;
      addrWrap.hidden = !showAddr;
      addrInput.required = showAddr;
      if (!showAddr) addrInput.value = "";
    }
  }

  /** Matches `booking.js` computeTotals without promo: base + length add-on, 10% deposit + $15 house flat. */
  function catalogPricingForStyleId(styleId, hairLengthKey) {
    var hk = hairLengthKey || "";
    var def = getAdminBookingStyles().find(function (x) {
      return x.id === styleId;
    });
    var base = def && typeof def.base === "number" ? def.base : 0;
    var lenUsd = 0;
    if (hk === "lower-back") lenUsd = 15;
    else if (hk === "butt") lenUsd = 25;
    else if (hk === "knee") lenUsd = 35;
    var total = Math.max(0, round2Admin(base + lenUsd));
    var pct = round2Admin(total * 0.1);
    var house = styleId && String(styleId).indexOf("house-") === 0 ? 15 : 0;
    var deposit = round2Admin(pct + house);
    return { estimated_total: total, deposit_amount: deposit };
  }

  function adminHairLengthExtraMinutes(key) {
    if (key === "lower-back") return 30;
    if (key === "butt") return 60;
    if (key === "knee") return 90;
    return 0;
  }

  function adminManualHairLengthKey() {
    var styleId = String((document.getElementById("admin-manual-style") || {}).value || "").trim();
    if (!styleSupportsExtraHairLength(styleId)) return "";
    var v = String((document.getElementById("admin-manual-hair-length") || {}).value || "").trim();
    if (v === "lower-back" || v === "butt" || v === "knee") return v;
    return "";
  }

  var ADMIN_STORAGE_BUCKET = "booking-photos";

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

  function setCoversBanner(msg, isErr) {
    var el = document.getElementById("admin-covers-banner");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("admin-banner--error");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("admin-banner--error", !!isErr);
  }

  async function fetchStyleCoverMap() {
    var sb = window.nadjaeSupabaseClient;
    var SITE = window.__NADJAE_SITE_DATA;
    if (SITE && typeof SITE.fetchStyleCoverMap === "function") {
      return SITE.fetchStyleCoverMap(sb);
    }
    return {};
  }

  function renderAdminStyleCoversPanel() {
    var mount = document.getElementById("admin-style-covers-mount");
    if (!mount) return;
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      mount.innerHTML =
        '<p class="admin-inquiries-note">Connect Supabase (see <code>js/supabase-config.local.js</code>) to manage catalog thumbnails.</p>';
      return;
    }
    mount.innerHTML = '<p class="admin-banner">Loading thumbnails…</p>';
    fetchStyleCoverMap().then(function (map) {
      var rows = getAdminBookingStyles().filter(function (s) {
        return s.id !== "other";
      });
      var sectionOrder = {
        knotless: 0,
        passion: 1,
        boho: 2,
        wigs: 3,
        natural: 4,
        locs: 5,
        fulani: 6,
        feedin: 7,
        lemonade: 8,
        other: 99,
      };
      function styleCoverSection(styleId) {
        var x = String(styleId || "").toLowerCase();
        if (x.indexOf("knotless") >= 0) return { key: "knotless", title: "Knotless" };
        if (x.indexOf("boho") >= 0) return { key: "boho", title: "Boho braids" };
        if (x.indexOf("passion") >= 0) return { key: "passion", title: "Passion twists" };
        if (x.indexOf("wig") >= 0) return { key: "wigs", title: "Wigs / quick weave" };
        if (x.indexOf("natural") >= 0) return { key: "natural", title: "Natural styles" };
        if (x.indexOf("locs") >= 0) return { key: "locs", title: "Locs" };
        if (x.indexOf("fulani") >= 0) return { key: "fulani", title: "Fulani braids" };
        if (x.indexOf("feedin") >= 0 || x.indexOf("cornrows") >= 0) return { key: "feedin", title: "Feed-in cornrows" };
        if (x.indexOf("lemonade") >= 0) return { key: "lemonade", title: "Lemonade braids" };
        return { key: "other", title: "Other" };
      }
      rows.sort(function (a, b) {
        var ka = styleCoverSection(a.id).key;
        var kb = styleCoverSection(b.id).key;
        var oa = sectionOrder[ka] !== undefined ? sectionOrder[ka] : 99;
        var ob = sectionOrder[kb] !== undefined ? sectionOrder[kb] : 99;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });

      function oneCard(s) {
        var row = map[s.id];
        var customPreview = row && row.storage_path ? styleCoverPublicUrl(row.storage_path) : "";
        var defaultFile = STYLE_COVER_DEFAULT_FILES[s.id];
        var defaultPreview = defaultFile ? "assets/catalog/" + defaultFile : "";
        var displaySrc = customPreview || defaultPreview;
        var updated = row && row.updated_at ? formatDateTime(new Date(row.updated_at)) : "";
        var statusMeta = "";
        if (customPreview) {
          statusMeta =
            '<p class="admin-style-cover-card__meta">' +
            "Custom photo (shown on Styles page)" +
            (updated ? " · Updated " + safeText(updated) : "") +
            "</p>";
        } else if (defaultPreview) {
          statusMeta =
            '<p class="admin-style-cover-card__meta">' +
            "Current site image — bundled catalog photo (upload to replace)" +
            "</p>";
        } else {
          statusMeta =
            '<p class="admin-style-cover-card__meta">' +
            "No photo yet — Styles page shows a gray placeholder until you upload" +
            "</p>";
        }
        return (
          '<article class="admin-panel admin-style-cover-card" data-style-id="' +
          escapeAttr(s.id) +
          '">' +
          '<div class="admin-style-cover-card__head">' +
          '<h3 class="admin-style-cover-card__title">' +
          safeText(s.name) +
          "</h3>" +
          '<p class="admin-style-cover-card__id"><code>' +
          safeText(s.id) +
          "</code></p>" +
          "</div>" +
          '<div class="admin-style-cover-card__preview">' +
          (displaySrc
            ? '<img src="' +
              escapeAttr(displaySrc) +
              '" alt="" width="120" height="120" loading="lazy" class="admin-style-cover-card__img"' +
              (customPreview ? "" : ' data-admin-cover-source="bundled"') +
              " />"
            : '<div class="admin-style-cover-card__placeholder">No image file — gray tile on catalog</div>') +
          "</div>" +
          statusMeta +
          '<div class="admin-style-cover-card__actions">' +
          '<label class="admin-style-cover-file"><span class="visually-hidden">Choose image</span>' +
          '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-style-cover-input="' +
          escapeAttr(s.id) +
          '" />' +
          "</label>" +
          '<button type="button" class="btn btn-outline admin-style-cover-upload" data-style-cover-upload="' +
          escapeAttr(s.id) +
          '">Upload</button>' +
          '<button type="button" class="btn btn-outline admin-style-cover-remove" data-style-cover-remove="' +
          escapeAttr(s.id) +
          '"' +
          (row ? "" : " disabled") +
          ">Remove</button>" +
          "</div>" +
          '<p class="admin-style-cover-card__hint admin-inquiries-note">JPG, PNG, WebP, or GIF · max 6MB</p>' +
          "</article>"
        );
      }

      var parts = [];
      var lastKey = null;
      rows.forEach(function (s) {
        var sec = styleCoverSection(s.id);
        if (sec.key !== lastKey) {
          if (lastKey !== null) parts.push("</div>");
          parts.push('<h3 class="admin-style-covers-group-title">' + safeText(sec.title) + "</h3>");
          parts.push('<div class="admin-style-covers-grid">');
          lastKey = sec.key;
        }
        parts.push(oneCard(s));
      });
      if (lastKey !== null) parts.push("</div>");
      mount.innerHTML = parts.join("");

      mount.querySelectorAll("[data-style-cover-upload]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sid = btn.getAttribute("data-style-cover-upload");
          if (!sid) return;
          var card = mount.querySelector('[data-style-id="' + sid + '"]');
          var inp = card && card.querySelector('input[data-style-cover-input="' + sid + '"]');
          var file = inp && inp.files && inp.files[0] ? inp.files[0] : null;
          void uploadStyleCover(sid, file);
        });
      });
      mount.querySelectorAll("[data-style-cover-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sid = btn.getAttribute("data-style-cover-remove");
          if (!sid) return;
          void removeStyleCover(sid);
        });
      });
    });
  }

  async function styleCoverInvokeErrorDetail(error, fallback) {
    var detail = (error && error.message) || fallback;
    try {
      if (error && error.context && typeof error.context.json === "function") {
        var j = await error.context.json();
        if (j && typeof j.error === "string" && j.error.trim()) return j.error.trim();
      }
    } catch (_) {
      /* ignore */
    }
    return detail;
  }

  function networkHintMessage(raw) {
    var s = String(raw || "");
    if (
      s === "Failed to fetch" ||
      s.indexOf("Failed to fetch") >= 0 ||
      s.indexOf("NetworkError") >= 0 ||
      s.indexOf("Load failed") >= 0
    ) {
      return (
        "Could not reach the upload service. Deploy the Supabase Edge Function “admin-style-cover” " +
        "(see repo supabase/functions/admin-style-cover), set secrets on the project, then try again. " +
        "If it’s already deployed, check your network or browser extensions blocking requests to Supabase."
      );
    }
    return s || "Request failed.";
  }

  async function uploadStyleCover(styleId, file) {
    setCoversBanner("", false);
    if (!file) {
      setCoversBanner("Choose an image file first.", true);
      return;
    }
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      setCoversBanner("Supabase is not configured.", true);
      return;
    }
    var fd = new FormData();
    fd.append("admin_code", ACCESS_CODE);
    fd.append("style_id", styleId);
    fd.append("file", file);
    try {
      var inv = await sb.functions.invoke("admin-style-cover", { body: fd });
      if (inv.error) {
        var upDetail = await styleCoverInvokeErrorDetail(inv.error, inv.error.message || "Upload failed");
        throw new Error(networkHintMessage(upDetail));
      }
      var payload = inv.data;
      if (payload && typeof payload === "object" && typeof payload.error === "string") {
        throw new Error(payload.error);
      }
      setCoversBanner("Thumbnail saved.", false);
      renderAdminStyleCoversPanel();
    } catch (e) {
      setCoversBanner(networkHintMessage(e && e.message ? e.message : "Upload failed."), true);
    }
  }

  async function removeStyleCover(styleId) {
    if (!window.confirm("Remove the custom thumbnail for this style?")) return;
    setCoversBanner("", false);
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      setCoversBanner("Supabase is not configured.", true);
      return;
    }
    try {
      var inv = await sb.functions.invoke("admin-style-cover", {
        body: { admin_code: ACCESS_CODE, style_id: styleId, remove: true },
      });
      if (inv.error) {
        var rmDetail = await styleCoverInvokeErrorDetail(inv.error, inv.error.message || "Remove failed");
        throw new Error(networkHintMessage(rmDetail));
      }
      var payload = inv.data;
      if (payload && typeof payload === "object" && typeof payload.error === "string") {
        throw new Error(payload.error);
      }
      setCoversBanner("Removed custom thumbnail.", false);
      renderAdminStyleCoversPanel();
    } catch (e) {
      setCoversBanner(networkHintMessage(e && e.message ? e.message : "Remove failed."), true);
    }
  }

  function adminSanitizeFilename(name) {
    var base = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    return base || "upload";
  }

  async function adminUploadBookingPhotos(sb, bookingId, hairFile, refFile) {
    var out = { photo_hair_path: null, photo_ref_path: null };
    if (!hairFile) return out;

    var uploadOne = async function (file, kind) {
      var ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      var safeBase = adminSanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
      var path = bookingId + "/" + kind + "-" + safeBase + ext;
      var res = await sb.storage.from(ADMIN_STORAGE_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (res.error) throw res.error;
      return path;
    };

    out.photo_hair_path = await uploadOne(hairFile, "hair");
    if (refFile) out.photo_ref_path = await uploadOne(refFile, "ref");
    return out;
  }

  function adminFullSalonDayMinutes() {
    var start = BOOK_CFG.slotDayStartHour * 60 + (BOOK_CFG.slotDayStartMinute || 0);
    var lastStart = BOOK_CFG.slotDayEndHour * 60 + (BOOK_CFG.slotDayEndMinute || 0);
    var longest = 300;
    return Math.max(120, lastStart - start + longest);
  }

  function adminDurationMinutesForStyle(styleId) {
    var s = String(styleId || "");
    if (!s || s === "other") return 120;
    if (s.indexOf("house-") === 0) return adminFullSalonDayMinutes();
    if (s.indexOf("knotless") >= 0) return 180;
    if (s.indexOf("boho") >= 0) return 300;
    if (s.indexOf("passion") >= 0) return 300;
    if (s.indexOf("wig") >= 0) return 120;
    if (s.indexOf("natural") >= 0) return 60;
    if (s.indexOf("locs") >= 0) return 120;
    if (s.indexOf("fulani") >= 0 || s.indexOf("lemonade") >= 0) return 240;
    if (s.indexOf("feedin") >= 0) return 180;
    return 180;
  }

  function salonIsoFromDateAndSlot(dateIso, slotLabel) {
    var DT = window.luxon && window.luxon.DateTime;
    if (!DT || !dateIso) return null;
    var parts = String(dateIso)
      .trim()
      .split("-")
      .map(function (x) {
        return parseInt(x, 10);
      });
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) return null;
    var m = String(slotLabel || "")
      .trim()
      .match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    var h = 9;
    var mi = 0;
    if (m) {
      h = parseInt(m[1], 10);
      mi = parseInt(m[2], 10);
      var ap = m[3].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
    }
    var dt = DT.fromObject(
      { year: parts[0], month: parts[1], day: parts[2], hour: h, minute: mi },
      { zone: "America/New_York" },
    );
    return dt.isValid ? dt.toISO() : null;
  }

  function slotLabelFromIso(iso) {
    var DT = window.luxon && window.luxon.DateTime;
    if (!DT || !iso) return "";
    var t = DT.fromISO(String(iso), { zone: "America/New_York" });
    return t.isValid ? t.toFormat("h:mm a") : "";
  }

  async function fetchBlockedIntervals() {
    var sb = window.nadjaeSupabaseClient;
    var SITE = window.__NADJAE_SITE_DATA;
    if (!sb || !SITE || typeof SITE.fetchBlockedIntervalsViaClient !== "function") return [];
    return SITE.fetchBlockedIntervalsViaClient(sb);
  }

  function renderBlocksTable() {
    var tbody = document.querySelector("#admin-blocks-table tbody");
    if (!tbody) return;
    var rows = cachedBlockedIntervals || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">No blocked intervals yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        var s = r.starts_at ? new Date(r.starts_at) : null;
        var e = r.ends_at ? new Date(r.ends_at) : null;
        var sStr = s && !Number.isNaN(s.getTime()) ? s.toLocaleString("en-US", { timeZone: "America/New_York" }) : "—";
        var eStr = e && !Number.isNaN(e.getTime()) ? e.toLocaleString("en-US", { timeZone: "America/New_York" }) : "—";
        return (
          "<tr>" +
          "<td>" +
          safeText(sStr) +
          "</td><td>" +
          safeText(eStr) +
          "</td><td>" +
          safeText(r.note || "—") +
          '</td><td><button type="button" class="hero-btn hero-btn--outline-light admin-schedule-remove-btn admin-delete-block-btn" data-block-id="' +
          safeText(String(r.id || "")) +
          '">Remove</button></td></tr>'
        );
      })
      .join("");
    tbody.querySelectorAll(".admin-delete-block-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-block-id");
        if (!id) return;
        void deleteBlockById(id);
      });
    });
  }

  async function deleteBlockById(id) {
    var sb = window.nadjaeSupabaseClient;
    var SITE = window.__NADJAE_SITE_DATA;
    if (!sb || !SITE) return;
    var res = await sb.from(SITE.table).delete().eq("id", id).eq("record_type", SITE.recordType.BLOCKED_INTERVAL);
    if (res.error) {
      alert("Could not remove block: " + (res.error.message || String(res.error)));
      return;
    }
    cachedBlockedIntervals = await fetchBlockedIntervals();
    renderBlocksTable();
    updateFullCalendarEvents();
  }

  function adminManualDT() {
    return window.luxon && window.luxon.DateTime;
  }

  function adminManualNowZoned() {
    return adminManualDT().now().setZone(BOOK_CFG.salonTimeZone);
  }

  function adminManualParseIso(isoDate) {
    var parts = String(isoDate)
      .split("-")
      .map(function (x) {
        return parseInt(x, 10);
      });
    return adminManualDT().fromObject(
      { year: parts[0], month: parts[1], day: parts[2] },
      { zone: BOOK_CFG.salonTimeZone },
    );
  }

  function adminManualIsHouseStyleId(styleId) {
    return !!styleId && String(styleId).indexOf("house-") === 0;
  }

  function adminManualIsCalendarDayBlockedByLeadDays(isoDate) {
    var today = adminManualNowZoned().startOf("day");
    var day = adminManualParseIso(isoDate).startOf("day");
    var earliest = today.plus({ days: BOOKING_LEAD_DAYS });
    return day < earliest;
  }

  function adminManualIsPastCalendarDay(isoDate) {
    var today = adminManualNowZoned().startOf("day");
    var d = adminManualParseIso(isoDate).startOf("day");
    return d < today;
  }

  function adminManualIsBlackedOut(isoDate) {
    var d = adminManualParseIso(isoDate).startOf("day");
    var ranges = BOOK_CFG.blackoutRanges || [];
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (!r || !r.start || !r.end) continue;
      var a = adminManualParseIso(r.start).startOf("day");
      var b = adminManualParseIso(r.end).startOf("day");
      if (d >= a && d <= b) return true;
    }
    return false;
  }

  /** Same non-house rules as the public booking calendar (lead days, blackout). */
  function adminSharedPublicBookingCalendarDisabledReason(isoDate) {
    if (adminManualIsPastCalendarDay(isoDate)) return "Past dates cannot be booked.";
    if (adminIsClosedWeekday(isoDate)) {
      var BH = window.__NADJAE_BOOKING_HOURS;
      var lux = adminManualParseIso(isoDate).weekday;
      var jsDay = lux === 7 ? 0 : lux;
      var label = BH && BH.closedWeekdayLabel ? BH.closedWeekdayLabel(jsDay) : "This day";
      return label + " is closed.";
    }
    if (adminManualIsBlackedOut(isoDate)) return "Unavailable this week.";
    if (adminManualIsCalendarDayBlockedByLeadDays(isoDate)) {
      return "Appointments require at least " + BOOKING_LEAD_DAYS + " full days advance notice.";
    }
    return null;
  }

  function adminManualCalendarDayDisabledReason(isoDate) {
    var common = adminSharedPublicBookingCalendarDisabledReason(isoDate);
    if (common) return common;
    var styleId = (document.getElementById("admin-manual-style") || {}).value;
    if (adminManualIsHouseStyleId(styleId) && adminManualDatesWithBookings.has(isoDate)) {
      return "House calls are only available on days with no other bookings.";
    }
    return null;
  }

  function adminBlockCalendarDayDisabledReason(isoDate) {
    return adminSharedPublicBookingCalendarDisabledReason(isoDate);
  }

  function adminScheduleMonthMatrix(year, monthIndex0) {
    var DT = adminManualDT();
    var first = DT.fromObject({ year: year, month: monthIndex0 + 1, day: 1 }, { zone: BOOK_CFG.salonTimeZone });
    var startDow = first.weekday % 7;
    var gridStart = first.minus({ days: startDow });
    var cells = [];
    var cur = gridStart;
    for (var i = 0; i < 42; i++) {
      cells.push(cur);
      cur = cur.plus({ days: 1 });
    }
    return { cells: cells, monthStart: first };
  }

  function adminManualVisibleGridIsoRange() {
    var mm = adminScheduleMonthMatrix(adminManualCalYear, adminManualCalMonth);
    return {
      p_start: mm.cells[0].toFormat("yyyy-MM-dd"),
      p_end: mm.cells[41].toFormat("yyyy-MM-dd"),
    };
  }

  function refreshAdminManualBookingDatesOccupied() {
    var styleId = (document.getElementById("admin-manual-style") || {}).value;
    if (!adminManualIsHouseStyleId(styleId)) {
      adminManualDatesWithBookings = new Set();
      return Promise.resolve();
    }
    var sb = window.nadjaeSupabaseClient;
    if (!sb) return Promise.resolve();
    var range = adminManualVisibleGridIsoRange();
    return sb.rpc("booking_dates_in_range", { p_start: range.p_start, p_end: range.p_end }).then(function (res) {
      if (res.error) {
        console.warn("booking_dates_in_range", res.error);
        return;
      }
      var arr = Array.isArray(res.data) ? res.data : [];
      adminManualDatesWithBookings = new Set(arr.map(String));
    });
  }

  function renderAdminManualCalendar() {
    var DT = adminManualDT();
    var grid = document.getElementById("admin-manual-cal-grid");
    if (!grid || !DT || adminManualCalYear == null || adminManualCalMonth == null) return;

    var mm = adminScheduleMonthMatrix(adminManualCalYear, adminManualCalMonth);
    var cells = mm.cells;
    var monthStart = mm.monthStart;
    var label = document.getElementById("admin-manual-cal-month-label");
    if (label) label.textContent = monthStart.toFormat("LLLL yyyy");

    var today = adminManualNowZoned().startOf("day");
    var selDay = adminManualSelectedIsoDate
      ? adminManualParseIso(adminManualSelectedIsoDate).startOf("day")
      : null;

    grid.innerHTML = "";
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var iso = c.toFormat("yyyy-MM-dd");
      var inMonth = c.month - 1 === adminManualCalMonth;
      var isToday = c.startOf("day").equals(today);
      var reason = adminManualCalendarDayDisabledReason(iso);
      var disabled = !!reason;
      var selected = selDay && c.startOf("day").equals(selDay);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booking-calendar__day";
      btn.textContent = String(c.day);
      if (!inMonth) btn.classList.add("is-outside");
      if (disabled) {
        btn.classList.add("is-disabled");
        btn.disabled = true;
        btn.title = reason || "";
      }
      if (isToday) btn.classList.add("is-today");
      if (selected) btn.classList.add("is-selected");
      if (!disabled) {
        (function (isoCap) {
          btn.addEventListener("click", function () {
            selectAdminManualDate(isoCap);
          });
        })(iso);
      }
      grid.appendChild(btn);
    }
  }

  function updateAdminManualSelectedLine() {
    var line = document.getElementById("admin-manual-cal-selected-line");
    if (!line) return;
    if (!adminManualSelectedIsoDate) {
      line.textContent = "Selected date: —";
      return;
    }
    var d = adminManualParseIso(adminManualSelectedIsoDate);
    line.textContent = "Selected date: " + d.toFormat("cccc, LLLL d, yyyy");
  }

  function selectAdminManualDate(isoDate) {
    adminManualSelectedIsoDate = isoDate;
    var hidden = document.getElementById("admin-manual-date");
    if (hidden) hidden.value = isoDate;
    renderAdminManualCalendar();
    updateAdminManualSelectedLine();
  }

  function navigateAdminManualMonth(delta) {
    var DT = adminManualDT();
    if (!DT) return;
    var d = DT.fromObject(
      { year: adminManualCalYear, month: adminManualCalMonth + 1, day: 1 },
      { zone: BOOK_CFG.salonTimeZone },
    ).plus({ months: delta });
    adminManualCalYear = d.year;
    adminManualCalMonth = d.month - 1;
    void refreshAdminManualBookingDatesOccupied().then(function () {
      var sel = adminManualSelectedIsoDate;
      if (sel && adminManualCalendarDayDisabledReason(sel)) {
        adminManualSelectedIsoDate = null;
        var h = document.getElementById("admin-manual-date");
        if (h) h.value = "";
      }
      renderAdminManualCalendar();
      updateAdminManualSelectedLine();
    });
  }

  function resetAdminManualCalendarUi() {
    adminManualSelectedIsoDate = null;
    var hidden = document.getElementById("admin-manual-date");
    if (hidden) hidden.value = "";
    void refreshAdminManualBookingDatesOccupied().then(function () {
      renderAdminManualCalendar();
      updateAdminManualSelectedLine();
    });
  }

  function initAdminManualCalendar() {
    var DT = adminManualDT();
    if (!DT || !document.getElementById("admin-manual-cal-grid")) return;

    var n = adminManualNowZoned();
    adminManualCalYear = n.year;
    adminManualCalMonth = n.month - 1;

    void refreshAdminManualBookingDatesOccupied().then(function () {
      renderAdminManualCalendar();
      updateAdminManualSelectedLine();
    });

    var prev = document.getElementById("admin-manual-cal-prev");
    var next = document.getElementById("admin-manual-cal-next");
    if (prev && !prev.dataset.adminManualCalWired) {
      prev.dataset.adminManualCalWired = "1";
      prev.addEventListener("click", function () {
        navigateAdminManualMonth(-1);
      });
    }
    if (next && !next.dataset.adminManualCalWired) {
      next.dataset.adminManualCalWired = "1";
      next.addEventListener("click", function () {
        navigateAdminManualMonth(1);
      });
    }
  }

  function wireAdminManualStyleForCalendar() {
    var styleSel = document.getElementById("admin-manual-style");
    if (!styleSel || styleSel.dataset.adminManualCalStyleWired) return;
    styleSel.dataset.adminManualCalStyleWired = "1";
    styleSel.addEventListener("change", function () {
      syncAdminManualDependentFields();
      void refreshAdminManualBookingDatesOccupied().then(function () {
        var sel = adminManualSelectedIsoDate;
        if (sel && adminManualCalendarDayDisabledReason(sel)) {
          adminManualSelectedIsoDate = null;
          var h = document.getElementById("admin-manual-date");
          if (h) h.value = "";
        }
        renderAdminManualCalendar();
        updateAdminManualSelectedLine();
      });
    });
  }

  function renderAdminBlockCalendar() {
    var DT = adminManualDT();
    var grid = document.getElementById("admin-block-cal-grid");
    if (!grid || !DT || adminBlockCalYear == null || adminBlockCalMonth == null) return;

    var mm = adminScheduleMonthMatrix(adminBlockCalYear, adminBlockCalMonth);
    var cells = mm.cells;
    var monthStart = mm.monthStart;
    var label = document.getElementById("admin-block-cal-month-label");
    if (label) label.textContent = monthStart.toFormat("LLLL yyyy");

    var today = adminManualNowZoned().startOf("day");
    var selDay = adminBlockSelectedIsoDate
      ? adminManualParseIso(adminBlockSelectedIsoDate).startOf("day")
      : null;

    grid.innerHTML = "";
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var iso = c.toFormat("yyyy-MM-dd");
      var inMonth = c.month - 1 === adminBlockCalMonth;
      var isToday = c.startOf("day").equals(today);
      var reason = adminBlockCalendarDayDisabledReason(iso);
      var disabled = !!reason;
      var selected = selDay && c.startOf("day").equals(selDay);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booking-calendar__day";
      btn.textContent = String(c.day);
      if (!inMonth) btn.classList.add("is-outside");
      if (disabled) {
        btn.classList.add("is-disabled");
        btn.disabled = true;
        btn.title = reason || "";
      }
      if (isToday) btn.classList.add("is-today");
      if (selected) btn.classList.add("is-selected");
      if (!disabled) {
        (function (isoCap) {
          btn.addEventListener("click", function () {
            selectAdminBlockDate(isoCap);
          });
        })(iso);
      }
      grid.appendChild(btn);
    }
  }

  function updateAdminBlockSelectedLine() {
    var line = document.getElementById("admin-block-cal-selected-line");
    if (!line) return;
    if (!adminBlockSelectedIsoDate) {
      line.textContent = "Selected date: —";
      return;
    }
    var d = adminManualParseIso(adminBlockSelectedIsoDate);
    line.textContent = "Selected date: " + d.toFormat("cccc, LLLL d, yyyy");
  }

  function selectAdminBlockDate(isoDate) {
    adminBlockSelectedIsoDate = isoDate;
    var hidden = document.getElementById("admin-block-date");
    if (hidden) hidden.value = isoDate;
    renderAdminBlockCalendar();
    updateAdminBlockSelectedLine();
  }

  function navigateAdminBlockMonth(delta) {
    var DT = adminManualDT();
    if (!DT) return;
    var d = DT.fromObject(
      { year: adminBlockCalYear, month: adminBlockCalMonth + 1, day: 1 },
      { zone: BOOK_CFG.salonTimeZone },
    ).plus({ months: delta });
    adminBlockCalYear = d.year;
    adminBlockCalMonth = d.month - 1;
    var sel = adminBlockSelectedIsoDate;
    if (sel && adminBlockCalendarDayDisabledReason(sel)) {
      adminBlockSelectedIsoDate = null;
      var h = document.getElementById("admin-block-date");
      if (h) h.value = "";
    }
    renderAdminBlockCalendar();
    updateAdminBlockSelectedLine();
  }

  function resetAdminBlockCalendarUi() {
    adminBlockSelectedIsoDate = null;
    var hidden = document.getElementById("admin-block-date");
    if (hidden) hidden.value = "";
    renderAdminBlockCalendar();
    updateAdminBlockSelectedLine();
  }

  function initAdminBlockCalendar() {
    var DT = adminManualDT();
    if (!DT || !document.getElementById("admin-block-cal-grid")) return;

    var n = adminManualNowZoned();
    adminBlockCalYear = n.year;
    adminBlockCalMonth = n.month - 1;

    renderAdminBlockCalendar();
    updateAdminBlockSelectedLine();

    var prev = document.getElementById("admin-block-cal-prev");
    var next = document.getElementById("admin-block-cal-next");
    if (prev && !prev.dataset.adminBlockCalWired) {
      prev.dataset.adminBlockCalWired = "1";
      prev.addEventListener("click", function () {
        navigateAdminBlockMonth(-1);
      });
    }
    if (next && !next.dataset.adminBlockCalWired) {
      next.dataset.adminBlockCalWired = "1";
      next.addEventListener("click", function () {
        navigateAdminBlockMonth(1);
      });
    }
  }

  function populateScheduleSelects() {
    var styleSel = document.getElementById("admin-manual-style");
    var slotSel = document.getElementById("admin-manual-slot");
    if (styleSel && styleSel.options.length === 0) {
      getAdminBookingStyles().forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name;
        styleSel.appendChild(o);
      });
    }
    if (slotSel && slotSel.options.length === 0) {
      ADMIN_SLOT_OPTIONS.forEach(function (label) {
        var o = document.createElement("option");
        o.value = label;
        o.textContent = label;
        slotSel.appendChild(o);
      });
    }
    syncAdminManualDependentFields();
  }

  function wireScheduleForms() {
    populateScheduleSelects();
    initAdminBlockCalendar();
    initAdminManualCalendar();
    wireAdminManualStyleForCalendar();
    var fullday = document.getElementById("admin-block-fullday");
    var partials = document.querySelectorAll(".admin-block-partial");
    if (fullday) {
      fullday.addEventListener("change", function () {
        var on = fullday.checked;
        partials.forEach(function (el) {
          el.hidden = on;
        });
      });
    }

    var blockForm = document.getElementById("admin-block-form");
    if (blockForm) {
      blockForm.addEventListener("submit", function (e) {
        e.preventDefault();
        void submitBlockForm();
      });
    }

    var manualForm = document.getElementById("admin-manual-booking-form");
    if (manualForm) {
      manualForm.addEventListener("submit", function (e) {
        e.preventDefault();
        void submitManualBookingForm();
      });
    }
  }

  function clearScheduleToastTimer() {
    if (scheduleToastHideTimer) {
      clearTimeout(scheduleToastHideTimer);
      scheduleToastHideTimer = null;
    }
  }

  function setScheduleFeedback(kind, title, detail) {
    var wrap = document.getElementById("admin-schedule-toast");
    var el = document.getElementById("admin-schedule-toast-card");
    if (!wrap || !el) return;
    var tEl = el.querySelector(".admin-feedback-card__title");
    var dEl = el.querySelector(".admin-feedback-card__text");
    clearScheduleToastTimer();
    if (scheduleToastDomHideTimer) {
      clearTimeout(scheduleToastDomHideTimer);
      scheduleToastDomHideTimer = null;
    }
    if (kind === "hidden") {
      wrap.classList.remove("admin-schedule-toast--visible");
      wrap.setAttribute("aria-hidden", "true");
      scheduleToastDomHideTimer = setTimeout(function () {
        wrap.hidden = true;
        scheduleToastDomHideTimer = null;
      }, 320);
      el.classList.remove("admin-feedback-card--success", "admin-feedback-card--error");
      el.setAttribute("role", "status");
      if (tEl) tEl.textContent = "";
      if (dEl) dEl.textContent = "";
      return;
    }
    el.classList.remove("admin-feedback-card--success", "admin-feedback-card--error");
    if (kind === "error") {
      el.classList.add("admin-feedback-card--error");
      el.setAttribute("role", "alert");
    } else {
      el.classList.add("admin-feedback-card--success");
      el.setAttribute("role", "status");
    }
    if (tEl) tEl.textContent = title || "";
    if (dEl) dEl.textContent = detail || "";
    wrap.hidden = false;
    wrap.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.classList.add("admin-schedule-toast--visible");
      });
    });
    if (kind === "success") {
      scheduleToastHideTimer = setTimeout(function () {
        setScheduleFeedback("hidden", "", "");
      }, 6500);
    }
  }

  function wireScheduleToast() {
    var wrap = document.getElementById("admin-schedule-toast");
    var bd = wrap && wrap.querySelector(".admin-schedule-toast__backdrop");
    if (bd) {
      bd.addEventListener("click", function () {
        setScheduleFeedback("hidden", "", "");
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var w = document.getElementById("admin-schedule-toast");
      if (w && !w.hidden) setScheduleFeedback("hidden", "", "");
    });
  }

  async function submitBlockForm() {
    setScheduleFeedback("hidden", "", "");
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      setScheduleFeedback("error", "Couldn't save block", "Supabase is required.");
      return;
    }
    var DT = adminManualDT();
    if (!DT) {
      setScheduleFeedback("error", "Couldn't save block", "Luxon failed to load — refresh the page.");
      return;
    }
    var dateIso = (document.getElementById("admin-block-date") || {}).value;
    var fullday = (document.getElementById("admin-block-fullday") || {}).checked;
    var note = String((document.getElementById("admin-block-note") || {}).value || "").trim() || null;
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso))) {
      setScheduleFeedback("error", "Couldn't save block", "Pick an available date on the calendar.");
      return;
    }
    var blockDeny = adminBlockCalendarDayDisabledReason(dateIso);
    if (blockDeny) {
      setScheduleFeedback("error", "Couldn't save block", blockDeny);
      return;
    }
    var parts = String(dateIso)
      .split("-")
      .map(function (x) {
        return parseInt(x, 10);
      });
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) {
      setScheduleFeedback("error", "Couldn't save block", "Pick a valid date.");
      return;
    }
    var startDt;
    var endDt;
    var tz = BOOK_CFG.salonTimeZone || "America/New_York";
    if (fullday) {
      startDt = DT.fromObject(
        { year: parts[0], month: parts[1], day: parts[2], hour: 8, minute: 0 },
        { zone: tz },
      );
      endDt = startDt.plus({ minutes: adminFullSalonDayMinutes() });
    } else {
      var st = String((document.getElementById("admin-block-start") || {}).value || "08:00");
      var en = String((document.getElementById("admin-block-end") || {}).value || "19:30");
      var sh = parseInt(st.split(":")[0], 10);
      var sm = parseInt(st.split(":")[1] || "0", 10);
      var eh = parseInt(en.split(":")[0], 10);
      var em = parseInt(en.split(":")[1] || "0", 10);
      startDt = DT.fromObject(
        { year: parts[0], month: parts[1], day: parts[2], hour: sh, minute: sm },
        { zone: tz },
      );
      endDt = DT.fromObject(
        { year: parts[0], month: parts[1], day: parts[2], hour: eh, minute: em },
        { zone: tz },
      );
    }
    if (!startDt.isValid || !endDt.isValid || endDt <= startDt) {
      setScheduleFeedback("error", "Couldn't save block", "End time must be after start time.");
      return;
    }
    var SITE = window.__NADJAE_SITE_DATA;
    if (!SITE) {
      setScheduleFeedback("error", "Couldn't save block", "Site data module not loaded.");
      return;
    }
    var res = await sb.from(SITE.table).insert({
      record_type: SITE.recordType.BLOCKED_INTERVAL,
      record_key: null,
      data: {
        starts_at: startDt.toISO(),
        ends_at: endDt.toISO(),
        note: note,
      },
    });
    if (res.error) {
      setScheduleFeedback("error", "Couldn't save block", res.error.message || String(res.error));
      return;
    }
    setScheduleFeedback(
      "success",
      "Block saved",
      "This range is now blocked — clients cannot book overlapping times.",
    );
    var bf = document.getElementById("admin-block-form");
    if (bf) bf.reset();
    var fd = document.getElementById("admin-block-fullday");
    if (fd) fd.checked = true;
    document.querySelectorAll(".admin-block-partial").forEach(function (el) {
      el.hidden = true;
    });
    resetAdminBlockCalendarUi();
    cachedBlockedIntervals = await fetchBlockedIntervals();
    renderBlocksTable();
    updateFullCalendarEvents();
  }

  async function submitManualBookingForm() {
    setScheduleFeedback("hidden", "", "");
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      setScheduleFeedback("error", "Couldn't add appointment", "Supabase is required.");
      return;
    }
    var styleId = (document.getElementById("admin-manual-style") || {}).value;
    var styleName =
      (getAdminBookingStyles().find(function (x) {
        return x.id === styleId;
      }) || {}).name || styleId;
    var dateIso = (document.getElementById("admin-manual-date") || {}).value;
    var slot = (document.getElementById("admin-manual-slot") || {}).value;
    var name = String((document.getElementById("admin-manual-name") || {}).value || "").trim();
    var phone = String((document.getElementById("admin-manual-phone") || {}).value || "").trim();
    var email = String((document.getElementById("admin-manual-email") || {}).value || "").trim();
    if (!styleId || styleId === "other") {
      setScheduleFeedback("error", "Couldn't add appointment", "Choose a priced catalog style (not “Other”).");
      return;
    }
    var isHouseStyle = String(styleId).indexOf("house-") === 0;
    var serviceAddr = String((document.getElementById("admin-manual-service-address") || {}).value || "").trim();
    if (isHouseStyle && !serviceAddr) {
      setScheduleFeedback("error", "Couldn't add appointment", "Enter the house-call service address.");
      return;
    }
    if (!adminManualDT()) {
      setScheduleFeedback("error", "Couldn't add appointment", "Luxon failed to load — refresh the page.");
      return;
    }
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso))) {
      setScheduleFeedback("error", "Couldn't add appointment", "Pick an available date on the calendar.");
      return;
    }
    var dayDeny = adminManualCalendarDayDisabledReason(dateIso);
    if (dayDeny) {
      setScheduleFeedback("error", "Couldn't add appointment", dayDeny);
      return;
    }
    var startsIso = salonIsoFromDateAndSlot(dateIso, slot);
    if (!startsIso) {
      setScheduleFeedback("error", "Couldn't add appointment", "Invalid date or start time.");
      return;
    }
    var hk = adminManualHairLengthKey();
    var hairSel = document.getElementById("admin-manual-hair-length");
    var hairLenLabel =
      hk === ""
        ? "Standard (menu length)"
        : hairSel && hairSel.selectedOptions[0]
          ? String(hairSel.selectedOptions[0].textContent || "").trim()
          : hk;

    var hairInput = document.getElementById("admin-manual-photo-hair");
    var refInput = document.getElementById("admin-manual-photo-ref");
    var hairFile = hairInput && hairInput.files && hairInput.files[0] ? hairInput.files[0] : null;
    var refFile = refInput && refInput.files && refInput.files[0] ? refInput.files[0] : null;
    if (!hairFile) {
      setScheduleFeedback("error", "Couldn't add appointment", "Upload a current hair photo (required — same as online booking).");
      return;
    }

    var userNotes = String((document.getElementById("admin-manual-notes") || {}).value || "").trim();
    var notesCombined = userNotes ? "[admin-added]\n\n" + userNotes : "[admin-added]";

    var dur = adminDurationMinutesForStyle(styleId) + adminHairLengthExtraMinutes(hk);
    var pricing = catalogPricingForStyleId(styleId, hk);
    var bookingId = crypto.randomUUID();

    var paths = { photo_hair_path: null, photo_ref_path: null };
    try {
      paths = await adminUploadBookingPhotos(sb, bookingId, hairFile, refFile || null);
    } catch (uploadErr) {
      console.warn(uploadErr);
      setScheduleFeedback(
        "error",
        "Couldn't add appointment",
        "Photos could not be uploaded. Confirm Storage bucket booking-photos exists and policies allow uploads.",
      );
      return;
    }

    var row = {
      id: bookingId,
      full_name: name,
      phone: phone,
      email: email,
      style_id: styleId,
      style_name: styleName,
      hair_length: hairLenLabel,
      hair_option: "catalog",
      prewash: "None",
      appointment_date: dateIso,
      appointment_slot: slotLabelFromIso(startsIso) || slot,
      appointment_starts_at: startsIso,
      duration_minutes: dur,
      booking_status: "confirmed",
      notes: notesCombined,
      promo_code: null,
      estimated_total: pricing.estimated_total,
      deposit_amount: pricing.deposit_amount,
      source: "admin_dashboard",
      pricing_situation: "catalog",
      payment_status: "paid",
      photo_hair_path: paths.photo_hair_path,
      photo_ref_path: paths.photo_ref_path,
      service_address: isHouseStyle ? serviceAddr : null,
    };
    var res = await sb.from("bookings").insert(row);
    if (res.error) {
      setScheduleFeedback("error", "Couldn't add appointment", res.error.message || String(res.error));
      return;
    }
    setScheduleFeedback(
      "success",
      "Appointment saved",
      "This slot is confirmed and will block availability like any other booking.",
    );
    document.getElementById("admin-manual-booking-form").reset();
    resetAdminManualCalendarUi();
    await refreshDashboard();
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function inferBookingStatus(row) {
    var raw = row.booking_status || row.bookingStatus;
    if (raw != null && String(raw).trim() !== "") return String(raw);
    if ((row.payment_status || "") === "deposit_paid") return "confirmed";
    return "pending_payment";
  }

  function normalizeRow(row) {
    var created = row.created_at ? new Date(row.created_at) : null;
    var startsRaw = row.appointment_starts_at || row.appointmentStartsAt;
    var appointmentStartsAt = startsRaw ? new Date(startsRaw) : null;
    var date = null;
    if (row.appointment_date) {
      date = new Date(row.appointment_date + "T12:00:00");
    } else if (appointmentStartsAt && !Number.isNaN(appointmentStartsAt.getTime())) {
      date = new Date(
        appointmentStartsAt.getFullYear(),
        appointmentStartsAt.getMonth(),
        appointmentStartsAt.getDate(),
      );
    }
    var dur = Number(row.duration_minutes ?? row.durationMinutes ?? 120);
    return {
      id: row.id,
      full_name: row.full_name || row.fullName || "Unknown",
      phone: row.phone || "—",
      email: row.email || "—",
      style_id: row.style_id || row.styleId || "",
      style_name: row.style_name || row.styleName || row.style_id || "Unknown",
      hair_option: row.hair_option || "—",
      hair_length: row.hair_length || "—",
      prewash: row.prewash || "—",
      appointment_date: row.appointment_date || row.appointmentDate || "",
      appointment_slot: row.appointment_slot || row.appointmentSlot || "—",
      notes: row.notes != null ? String(row.notes) : "",
      promo_code: row.promo_code != null ? String(row.promo_code) : "",
      deposit_amount: Number(row.deposit_amount || 0),
      estimated_total: Number(row.estimated_total || 0),
      source: row.source || "website",
      payment_status: row.payment_status || "pending",
      photo_hair_path: row.photo_hair_path || "",
      photo_ref_path: row.photo_ref_path || "",
      stripe_checkout_session_id: row.stripe_checkout_session_id || "",
      created_at: created,
      appointmentDateObj: date,
      appointmentStartsAt: appointmentStartsAt,
      duration_minutes: Number.isFinite(dur) && dur > 0 ? dur : 120,
      booking_status: inferBookingStatus(row),
      pricing_situation: row.pricing_situation || "sheet-a",
      service_address: row.service_address != null ? String(row.service_address) : "",
    };
  }

  function durationFor(row) {
    var d = Number(row.duration_minutes);
    return Number.isFinite(d) && d > 0 ? d : 120;
  }

  function parseAppointmentStart(row) {
    if (row.appointmentStartsAt && !Number.isNaN(row.appointmentStartsAt.getTime())) {
      return row.appointmentStartsAt;
    }
    if (!row.appointment_date) return null;
    var slot = String(row.appointment_slot || "").trim();
    var m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    var h = 9;
    var mi = 0;
    if (m) {
      h = parseInt(m[1], 10);
      mi = parseInt(m[2], 10);
      var ap = m[3].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
    }
    var isoLocal =
      row.appointment_date +
      "T" +
      String(h).padStart(2, "0") +
      ":" +
      String(mi).padStart(2, "0") +
      ":00";
    return new Date(isoLocal);
  }

  function bookingStatusColorHex(st) {
    var s = String(st || "").toLowerCase();
    var map = {
      confirmed: "#15803d",
      pending_payment: "#ca8a04",
      pending: "#ca8a04",
      cancelled: "#dc2626",
      rescheduled: "#9333ea",
      completed: "#475569",
    };
    return map[s] || "#0369a1";
  }

  function humanBookingLifecycle(st) {
    var s = String(st || "").toLowerCase();
    if (s === "pending_payment") return "Pending payment";
    if (s === "confirmed") return "Confirmed";
    if (s === "pending") return "Pending";
    if (s === "cancelled") return "Cancelled";
    if (s === "rescheduled") return "Rescheduled";
    if (s === "completed") return "Completed";
    return st || "—";
  }

  function statusBadgeClass(st) {
    var s = String(st || "").toLowerCase().replace(/-/g, "_");
    return "status-badge status-badge--" + s;
  }

  function humanPricingSituation(v) {
    var m = {
      catalog: "Menu pricing",
      "sheet-a": "Situation A",
      "sheet-b": "Situation B",
      "sheet-c": "Situation C",
    };
    return m[v] || v || "—";
  }

  function clearDetailDl(dl) {
    if (!dl) return;
    while (dl.firstChild) dl.removeChild(dl.firstChild);
  }

  function addDetailRow(dl, label, value) {
    if (!dl) return;
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value == null || value === "" ? "—" : String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function addDetailRowHtml(dl, label, innerHtml) {
    if (!dl) return;
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.innerHTML = innerHtml;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function publicBookingPhotoUrl(path) {
    var base = window.__NADJAE_SUPABASE && window.__NADJAE_SUPABASE.url;
    if (!base || !path) return "";
    return (
      String(base).replace(/\/$/, "") +
      "/storage/v1/object/public/booking-photos/" +
      encodeURI(String(path).replace(/^\/+/, ""))
    );
  }

  function phoneLinkHtml(phone) {
    var raw = String(phone || "").trim();
    if (!raw) return "—";
    var digits = raw.replace(/\D/g, "");
    var tel = "";
    if (digits.length === 10) tel = "+1" + digits;
    else if (digits.length === 11 && digits.charAt(0) === "1") tel = "+" + digits;
    else if (digits.length) tel = "+" + digits;
    if (!tel) return safeText(raw);
    return '<a href="' + escapeAttr("tel:" + tel) + '">' + safeText(raw) + "</a>";
  }

  function emailLinkHtml(email) {
    var e = String(email || "").trim();
    if (!e) return "—";
    return '<a href="' + escapeAttr("mailto:" + e) + '">' + safeText(e) + "</a>";
  }

  function humanPaymentStatus(v) {
    var s = String(v || "pending").toLowerCase();
    if (s === "deposit_paid") return "Deposit paid";
    if (s === "pending") return "Awaiting deposit / confirmation";
    return v || "—";
  }

  function adminPaymentBannerText(row) {
    var s = row.payment_status || "pending";
    if (s === "deposit_paid") {
      return "Deposit recorded as paid. We will confirm the appointment shortly.";
    }
    return "Deposit pending — we will follow up if payment is still needed.";
  }

  function formatDateLong(d) {
    if (!d) return "—";
    var dateObj = d instanceof Date ? d : new Date(String(d) + "T12:00:00");
    if (Number.isNaN(dateObj.getTime())) return "—";
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function clearBookingDetailContent() {
    if (detailEls.bookingIdCode) detailEls.bookingIdCode.textContent = "";
    if (detailEls.bookingShort) {
      detailEls.bookingShort.textContent = "";
      detailEls.bookingShort.hidden = true;
    }
    if (detailEls.statusLine) {
      detailEls.statusLine.textContent = "";
      detailEls.statusLine.classList.remove("is-deposit-ok", "is-deposit-pending");
    }
    clearDetailDl(detailEls.dlContact);
    clearDetailDl(detailEls.dlAppointment);
    clearDetailDl(detailEls.dlService);
    clearDetailDl(detailEls.dlPayment);
    clearDetailDl(detailEls.dlExtra);
    if (detailEls.sectionExtra) detailEls.sectionExtra.hidden = true;
    if (adminCancelBtn) adminCancelBtn.hidden = true;
  }

  function openBookingDetail(bookingId) {
    if (!detailOverlay || !detailEls.bookingIdCode) return;
    var row = cachedRows.find(function (r) {
      return r.id && String(r.id) === String(bookingId);
    });
    if (!row) return;

    clearBookingDetailContent();
    currentDetailBookingId = bookingId;

    detailEls.bookingIdCode.textContent = row.id || "—";
    if (detailEls.bookingShort) {
      var short = row.id ? String(row.id).replace(/-/g, "").slice(0, 8).toUpperCase() : "";
      if (short) {
        detailEls.bookingShort.textContent = "Quick code · " + short;
        detailEls.bookingShort.hidden = false;
      }
    }

    if (detailEls.statusLine) {
      detailEls.statusLine.textContent = adminPaymentBannerText(row);
      var ok = (row.payment_status || "") === "deposit_paid";
      detailEls.statusLine.classList.toggle("is-deposit-ok", !!ok);
      detailEls.statusLine.classList.toggle("is-deposit-pending", !ok);
    }

    addDetailRow(detailEls.dlContact, "Full name", row.full_name);
    addDetailRowHtml(detailEls.dlContact, "Phone", phoneLinkHtml(row.phone));
    addDetailRowHtml(detailEls.dlContact, "Email", emailLinkHtml(row.email));

    addDetailRow(detailEls.dlAppointment, "Date", formatDateLong(row.appointmentDateObj));
    addDetailRow(detailEls.dlAppointment, "Time slot", row.appointment_slot);
    addDetailRow(detailEls.dlAppointment, "Duration", String(durationFor(row)) + " min");
    addDetailRow(detailEls.dlAppointment, "Booking status", humanBookingLifecycle(row.booking_status));
    addDetailRow(detailEls.dlAppointment, "Request received", formatDateTime(row.created_at));

    addDetailRow(detailEls.dlService, "Style", row.style_name || row.style_id || "—");
    if (String(row.style_id || "").indexOf("house-") === 0) {
      addDetailRow(detailEls.dlService, "Service address", row.service_address && String(row.service_address).trim() ? row.service_address : "—");
    }
    addDetailRow(detailEls.dlService, "Pricing", humanPricingSituation(row.pricing_situation));
    addDetailRow(detailEls.dlService, "Promo code", row.promo_code || "—");
    addDetailRow(detailEls.dlService, "Notes", row.notes || "—");

    addDetailRow(detailEls.dlPayment, "Estimated total", money(row.estimated_total));
    addDetailRow(detailEls.dlPayment, "Deposit due", money(row.deposit_amount));
    addDetailRow(detailEls.dlPayment, "Status", humanPaymentStatus(row.payment_status));

    var hasExtra = !!(
      row.stripe_checkout_session_id ||
      row.photo_hair_path ||
      row.photo_ref_path ||
      row.source
    );
    if (detailEls.sectionExtra) detailEls.sectionExtra.hidden = !hasExtra;
    if (hasExtra) {
      if (row.stripe_checkout_session_id) {
        addDetailRow(detailEls.dlExtra, "Stripe checkout session", row.stripe_checkout_session_id);
      }
      var hairPreviewUrl = row.photo_hair_path ? publicBookingPhotoUrl(row.photo_hair_path) : "";
      var refPreviewUrl = row.photo_ref_path ? publicBookingPhotoUrl(row.photo_ref_path) : "";
      if (hairPreviewUrl) {
        addDetailRowHtml(
          detailEls.dlExtra,
          "Hair photo",
          '<a href="' +
            escapeAttr(hairPreviewUrl) +
            '" target="_blank" rel="noopener" class="admin-detail-photo-link"><img src="' +
            escapeAttr(hairPreviewUrl) +
            '" alt="Current hair" class="admin-detail-photo-thumb" loading="lazy" /></a>',
        );
      } else if (row.photo_hair_path) {
        addDetailRow(detailEls.dlExtra, "Hair photo (path)", row.photo_hair_path);
      }
      if (refPreviewUrl) {
        addDetailRowHtml(
          detailEls.dlExtra,
          "Reference photo",
          '<a href="' +
            escapeAttr(refPreviewUrl) +
            '" target="_blank" rel="noopener" class="admin-detail-photo-link"><img src="' +
            escapeAttr(refPreviewUrl) +
            '" alt="Reference" class="admin-detail-photo-thumb" loading="lazy" /></a>',
        );
      } else if (row.photo_ref_path) {
        addDetailRow(detailEls.dlExtra, "Reference photo (path)", row.photo_ref_path);
      }
      if (row.source) addDetailRow(detailEls.dlExtra, "Source", row.source);
    }

    if (adminCancelBtn) {
      adminCancelBtn.hidden = (row.booking_status || "").toLowerCase() === "cancelled";
    }

    detailOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeBookingDetail() {
    if (detailOverlay) detailOverlay.hidden = true;
    document.body.style.overflow = "";
    currentDetailBookingId = null;
    clearBookingDetailContent();
  }

  function initBookingDetailPanel() {
    if (!detailOverlay) return;

    detailOverlay.addEventListener("click", function (e) {
      if (e.target === detailOverlay) closeBookingDetail();
    });

    detailOverlay.querySelectorAll("[data-admin-detail-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeBookingDetail();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && detailOverlay && !detailOverlay.hidden) {
        closeBookingDetail();
      }
    });

    document.addEventListener("click", function (e) {
      var clientBtn = e.target.closest && e.target.closest(".admin-client-row[data-client-key]");
      if (clientBtn) {
        var cKey = clientBtn.getAttribute("data-client-key");
        if (cKey) renderClientProfile(cKey);
        return;
      }

      var maybeClientCell = e.target.closest && e.target.closest(".admin-client-link[data-client-key]");
      if (maybeClientCell) {
        var cKey2 = maybeClientCell.getAttribute("data-client-key");
        if (cKey2) renderClientProfile(cKey2);
        return;
      }

      var btn = e.target.closest && e.target.closest(".admin-view-btn[data-booking-id]");
      if (btn) {
        var id = btn.getAttribute("data-booking-id");
        if (id) openBookingDetail(id);
        return;
      }
      var tr = e.target.closest && e.target.closest("#admin-all-bookings-table tr[data-booking-id]");
      if (tr) {
        var rid = tr.getAttribute("data-booking-id");
        if (rid) openBookingDetail(rid);
      }
    });

    if (adminCancelBtn) {
      adminCancelBtn.addEventListener("click", async function () {
        if (!currentDetailBookingId) return;
        var cfg = window.__NADJAE_SUPABASE;
        if (!cfg || !cfg.url || !cfg.anonKey) {
          window.alert("Configure Supabase to cancel bookings.");
          return;
        }
        if (!window.confirm("Mark this booking as cancelled?")) return;
        adminCancelBtn.disabled = true;
        try {
          var res = await fetch(cfg.url.replace(/\/$/, "") + "/functions/v1/admin-cancel-booking", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + cfg.anonKey,
              apikey: cfg.anonKey,
            },
            body: JSON.stringify({ booking_id: currentDetailBookingId, admin_code: ACCESS_CODE }),
          });
          var j = await res.json().catch(function () {
            return {};
          });
          if (!res.ok) throw new Error(j.error || res.statusText || "Cancel failed");
          closeBookingDetail();
          await refreshDashboard();
        } catch (err) {
          window.alert(err && err.message ? err.message : String(err));
        } finally {
          adminCancelBtn.disabled = false;
        }
      });
    }
  }

  function parseRangeDays() {
    if (!rangeEl || rangeEl.value === "all") return null;
    return parseInt(rangeEl.value, 10);
  }

  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(base, n) {
    var d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }

  function formatDate(d) {
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(d) {
    if (!d) return "—";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function safeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function previewEmailHtml(key) {
    var bookingId = "2f3e9a70-11bb-44cc-9a2e-88991e28a112";
    var dateLabel = "Tuesday, May 12, 2026";
    var dateLabel2 = "Thursday, May 14, 2026";
    var phone = "(860) 822-7448";
    var base = "https://hairbynadjae.com";
    var th =
      "padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);background:linear-gradient(180deg,rgba(253,242,248,0.98),rgba(252,231,243,0.75));font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#4a3728;font-weight:700;";
    function previewEyebrow(t) {
      return (
        "<p style=\"margin:0 0 12px;\"><span style=\"display:inline-block;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a83d5c;background:linear-gradient(180deg,rgba(253,242,248,0.95) 0%,rgba(252,231,243,0.65) 100%);border:1px solid rgba(219,39,119,0.18);\">" +
        t +
        "</span></p>"
      );
    }
    function previewSectionTitle(t) {
      return (
        "<p style=\"margin:0 0 8px;font-family:Georgia,'Cormorant Garamond','Times New Roman',serif;font-size:20px;font-weight:600;color:#2c2416;line-height:1.25;\">" + t + "</p>"
      );
    }
    function previewP(html, mb) {
      var m = mb == null ? 14 : mb;
      return "<p style=\"margin:0 0 " + m + "px;line-height:1.6;color:#3d3428;\">" + html + "</p>";
    }
    function previewDetailTable(rows) {
      var tbody = rows
        .map(function (r, i) {
          var isLast = i === rows.length - 1;
          var border = isLast ? "" : "border-bottom:1px solid rgba(219,39,119,0.1);";
          var bg = i % 2 === 0 ? "#fffcfa" : "#ffffff";
          return (
            "<tr><td style=\"padding:11px 14px;" +
            border +
            "vertical-align:top;width:36%;font-size:12px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#8b7355;background:" +
            bg +
            ";\">" +
            r.label +
            "</td><td style=\"padding:11px 14px;" +
            border +
            "vertical-align:top;font-size:15px;color:#2c2416;line-height:1.5;background:" +
            bg +
            ";\">" +
            r.value +
            "</td></tr>"
          );
        })
        .join("");
      return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;margin:6px 0 22px;border-radius:14px;overflow:hidden;border:1px solid rgba(219,39,119,0.16);box-shadow:0 4px 20px rgba(44,36,22,0.06);"><tbody>' +
        tbody +
        "</tbody></table>"
      );
    }
    function previewHero(dateHtml, timeLine) {
      return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;"><tr><td style="padding:18px 20px;border-radius:16px;background:linear-gradient(155deg,#fff5f9 0%,#fffdfb 55%,#faf8f4 100%);border:1px solid rgba(219,39,119,0.2);box-shadow:inset 0 1px 0 rgba(255,255,255,0.85);"><p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c45d7a;">Your appointment</p><p style="margin:0;font-family:Georgia,serif;font-size:19px;font-weight:600;color:#2c2416;line-height:1.3;">' +
        dateHtml +
        '</p><p style="margin:10px 0 0;font-size:15px;font-weight:600;color:#6b5346;">' +
        timeLine +
        "</p></td></tr></table>"
      );
    }
    function previewCallout(inner, amber) {
      var bg = amber ? "#fffbf4" : "#fff8fb";
      var border = amber ? "rgba(217,119,6,0.28)" : "rgba(219,39,119,0.22)";
      var accent = amber ? "#b45309" : "#c45d7a";
      return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 20px;"><tr><td style="width:4px;padding:0;border-radius:12px 0 0 12px;background:' +
        accent +
        ';line-height:0;font-size:0;">&nbsp;</td><td style="padding:0;border-radius:0 12px 12px 0;vertical-align:top;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:0 12px 12px 0;overflow:hidden;"><tr><td style="padding:14px 16px;background:' +
        bg +
        ";border:1px solid " +
        border +
        ';border-left:none;font-size:14px;line-height:1.55;color:#4a3f36;">' +
        inner +
        "</td></tr></table></td></tr></table>"
      );
    }
    function previewButton(href, label) {
      return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr><td align="left" style="border-radius:999px;background:linear-gradient(135deg,#d4728f 0%,#b8456a 48%,#a83d5c 100%);box-shadow:0 6px 20px rgba(168,61,92,0.28);"><a class="hm-btn-inline" href="' +
        href +
        "\" style=\"display:inline-block;padding:14px 28px;font-family:system-ui,sans-serif;font-size:14px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:999px;\">" +
        label +
        "</a></td></tr></table>"
      );
    }
    function previewSignoff() {
      return (
        "<p style=\"margin:20px 0 0;font-size:14px;line-height:1.5;color:#5c4f3f;\">With care,<br/><strong style=\"color:#2c2416;\">Hair by Nadjae</strong></p>"
      );
    }
    var digestTable =
      '<table class="data-sheet" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;font-size:14px;border-radius:14px;overflow:hidden;border:1px solid rgba(219,39,119,0.16);box-shadow:0 4px 18px rgba(44,36,22,0.06);">' +
      "<thead><tr>" +
      "<th align=\"left\" style=\"" +
      th +
      "\">Time</th>" +
      "<th align=\"left\" style=\"" +
      th +
      "\">Client</th>" +
      "<th align=\"left\" style=\"" +
      th +
      "\">Phone</th>" +
      "<th align=\"left\" style=\"" +
      th +
      "\">Style</th>" +
      "<th align=\"left\" style=\"" +
      th +
      "\">Location</th>" +
      "</tr></thead><tbody>" +
      "<tr><td style=\"padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);background:#fffcfa;vertical-align:top;\">9:00 AM</td><td style=\"padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);background:#fffcfa;vertical-align:top;font-weight:600;color:#2c2416;\">Moustapha Guye</td><td style=\"padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);background:#fffcfa;vertical-align:top;\">(860) 555-0100</td><td style=\"padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);background:#fffcfa;vertical-align:top;\">Studio · Knotless · Medium</td><td style=\"padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);background:#fffcfa;vertical-align:top;\">Studio</td></tr>" +
      "<tr><td style=\"padding:10px;background:#ffffff;vertical-align:top;\">1:00 PM</td><td style=\"padding:10px;background:#ffffff;vertical-align:top;font-weight:600;color:#2c2416;\">Kayla B.</td><td style=\"padding:10px;background:#ffffff;vertical-align:top;\">(860) 555-0199</td><td style=\"padding:10px;background:#ffffff;vertical-align:top;\">House call · Boho · Medium</td><td style=\"padding:10px;background:#ffffff;vertical-align:top;\">Norwich, CT</td></tr>" +
      "</tbody></table>";
    var detailsUrl = base + "/booking-details.html?booking_id=" + encodeURIComponent(bookingId);
    var snippets = {
      "salon-booking":
        previewEyebrow("New booking") +
        previewSectionTitle("Someone just booked online") +
        previewP("Here is everything we captured from the form. You can reply directly to the client from your inbox.") +
        previewDetailTable([
          { label: "Booking ID", value: "<code>" + bookingId + "</code>" },
          { label: "Name", value: "Moustapha Guye" },
          { label: "Email", value: "<a href=\"mailto:bizmoustaphaguye@gmail.com\">bizmoustaphaguye@gmail.com</a>" },
          { label: "Phone", value: "<a href=\"tel:+18605550100\">(860) 555-0100</a>" },
          { label: "Style", value: "Studio · Knotless · Medium" },
          { label: "Date", value: dateLabel },
          { label: "Time", value: "9:00 AM" },
          { label: "Est. total", value: "$110.00" },
          { label: "Deposit", value: "$11.00" },
        ]),
      "customer-confirmation":
        previewP("Hi Moustapha,", 12) +
        previewP(
          "Thank you for choosing <strong>Hair by Nadjae</strong>. Your request is in — we will follow up to confirm your appointment.",
        ) +
        previewHero(dateLabel, "Starting at 9:00 AM") +
        previewDetailTable([
          { label: "Booking ref", value: "<code>" + bookingId + "</code>" },
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Estimated total", value: "$110.00" },
          { label: "Deposit due", value: "$11.00" },
        ]) +
        previewCallout(
          "<strong style=\"color:#8b4513;\">Please note:</strong> All deposits are <strong>non-refundable</strong>.",
          true,
        ) +
        previewButton(detailsUrl, "View your booking details") +
        previewP("Or save this email — you will need your booking ID for <strong>Lookup Booking</strong> or changes.", 0) +
        previewP("If you pay your deposit online, you will get a separate message when payment is received.") +
        previewSignoff(),
      "customer-reminder":
        previewEyebrow("Reminder") +
        previewP("Hi Moustapha,", 10) +
        previewP(
          "This is a friendly heads-up: your appointment at <strong>Hair by Nadjae</strong> is coming up <strong>in about 24 hours</strong> (from when this email was sent).",
        ) +
        previewHero(dateLabel, "Arrive for 9:00 AM") +
        previewDetailTable([
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Studio", value: "16 Sullivan Dr, Norwich, CT 06360" },
        ]) +
        previewCallout("<p style=\"margin:0;\"><strong>Tip:</strong> Running late? Reply to this email or call us as soon as you can.</p>", false) +
        previewP("We can't wait to see you.", 0) +
        previewSignoff(),
      "daily-digest":
        previewEyebrow("Daily digest") +
        previewSectionTitle("Your day at a glance") +
        previewP("Schedule for <strong>" + dateLabel + "</strong> — all times as booked in the system.") +
        digestTable +
        previewP("Sent automatically from your Hair by Nadjae booking tools.", 0),
      "deposit-received":
        previewEyebrow("Payment received") +
        previewSectionTitle("Your deposit is in") +
        previewP(
          "Hi there — thank you! We have received your deposit for your <strong>Hair by Nadjae</strong> appointment.",
        ) +
        previewDetailTable([{ label: "Booking reference", value: "<code>" + bookingId + "</code>" }]) +
        previewCallout(
          "<p style=\"margin:0;\">Keep this ID handy for <strong>Lookup Booking</strong> or if you need to make a change.</p>",
          false,
        ) +
        previewButton(detailsUrl, "Open your booking") +
        previewSignoff(),
      "salon-cancelled":
        previewEyebrow("Cancelled") +
        previewSectionTitle("A booking was cancelled") +
        previewP("The client cancelled through the site or you updated their status. Summary below.") +
        previewDetailTable([
          { label: "Booking ID", value: "<code>" + bookingId + "</code>" },
          { label: "Client", value: "Moustapha Guye" },
          { label: "Email", value: "<a href=\"mailto:bizmoustaphaguye@gmail.com\">bizmoustaphaguye@gmail.com</a>" },
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Was scheduled", value: dateLabel + " · 9:00 AM" },
          { label: "Est. total", value: "$110.00" },
          { label: "Deposit", value: "$11.00" },
        ]),
      "customer-cancelled":
        previewP("Hi Moustapha,", 12) +
        previewP(
          "Your appointment with <strong>Hair by Nadjae</strong> has been marked as <strong>cancelled</strong>.",
        ) +
        previewDetailTable([
          { label: "Booking ref", value: "<code>" + bookingId + "</code>" },
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Cancelled slot", value: dateLabel + " · 9:00 AM" },
        ]) +
        previewP("If this was a mistake, reply to this email or call us and we will help you rebook.") +
        previewButton(detailsUrl, "View booking details") +
        previewSignoff(),
      "salon-rescheduled":
        previewEyebrow("Rescheduled") +
        previewSectionTitle("Appointment time changed") +
        previewP("A client updated their slot. Here is the before and after.") +
        previewDetailTable([
          { label: "Booking ID", value: "<code>" + bookingId + "</code>" },
          { label: "Client", value: "Moustapha Guye" },
          { label: "Email", value: "<a href=\"mailto:bizmoustaphaguye@gmail.com\">bizmoustaphaguye@gmail.com</a>" },
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Previous time", value: dateLabel + " · 9:00 AM" },
          { label: "New time", value: dateLabel2 + " · 1:00 PM" },
        ]),
      "customer-rescheduled":
        previewP("Hi Moustapha,", 12) +
        previewP(
          "Good news — your appointment with <strong>Hair by Nadjae</strong> has been <strong>updated</strong>. Here are your new details.",
        ) +
        previewHero(dateLabel2, "Now at 1:00 PM") +
        previewDetailTable([
          { label: "Booking ref", value: "<code>" + bookingId + "</code>" },
          { label: "Service", value: "Studio · Knotless · Medium" },
          { label: "Previous", value: dateLabel + " · 9:00 AM" },
          { label: "New time", value: dateLabel2 + " · 1:00 PM" },
        ]) +
        previewButton(detailsUrl, "View your updated booking") +
        previewP("Questions? Just reply to this email.") +
        previewSignoff(),
    };
    var inner = snippets[key] || snippets["salon-booking"];
    var visit = '<a href="' + base + '" style="color:#b8860b;text-decoration:none;font-weight:600;">Visit website</a>';
    var tel = '<a href="tel:+18608227448" style="color:#b8860b;text-decoration:none;font-weight:600;">' + phone + "</a>";
    return (
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>" +
      "<title>Hair by Nadjae</title><style type=\"text/css\">.hm-body a{color:#b8860b !important;font-weight:600;}.hm-body a.hm-btn-inline{color:#ffffff !important;}.hm-body code{background:linear-gradient(180deg,#fdf8f4,#faf5f0);padding:3px 8px;border-radius:6px;font-size:13px;border:1px solid rgba(219,39,119,0.14);color:#5c4f3f;font-family:ui-monospace,monospace;}</style></head>" +
      '<body style="margin:0;padding:0;background-color:#f3efe6;-webkit-font-smoothing:antialiased;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#ebe4d6 0%,#faf8f4 28%,#faf8f4 100%);"><tr><td align="center" style="padding:32px 16px 40px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(219,39,119,0.14);box-shadow:0 12px 40px rgba(44,36,22,0.1),0 2px 8px rgba(168,61,92,0.06);">' +
      '<tr><td style="height:5px;line-height:5px;font-size:0;background:linear-gradient(90deg,#fbcfe8 0%,#f472b6 25%,#c45d7a 50%,#d4a574 75%,#e8c088 100%);">&nbsp;</td></tr>' +
      '<tr><td style="padding:26px 24px 20px;text-align:center;background:linear-gradient(175deg,#fffefb 0%,#ffffff 45%,#fffdfb 100%);border-bottom:1px solid rgba(219,39,119,0.1);">' +
      '<img src="' +
      base +
      '/logo.png" alt="Hair by Nadjae" width="72" height="72" style="display:block;margin:0 auto 12px;border-radius:14px;border:1px solid rgba(219,39,119,0.2);background:#fff;box-shadow:0 4px 14px rgba(44,36,22,0.08);"/>' +
      '<p style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:600;color:#2c2416;line-height:1.15;letter-spacing:-0.02em;">Hair by Nadjae</p>' +
      '<p style="margin:12px 0 0;font-family:system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c45d7a;">Norwich, CT · By appointment</p></td></tr>' +
      '<tr><td class="hm-body" style="padding:28px 30px 24px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#3d3428;">' +
      inner +
      '</td></tr><tr><td style="padding:20px 26px 26px;text-align:center;border-top:1px solid rgba(219,39,119,0.08);background:linear-gradient(180deg,#fffdfb 0%,#faf8f4 100%);">' +
      '<p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#5c4f3f;">' +
      visit +
      ' <span style="color:#d4c4b0;">·</span> ' +
      tel +
      '</p><p style="margin:0;font-size:11px;line-height:1.5;color:#9a8b7a;">Neat, fast &amp; affordable braids · Studio details shared when you book</p></td></tr></table>' +
      '<p style="margin:16px 0 0;font-family:system-ui,sans-serif;font-size:11px;color:#9a9084;max-width:580px;">You are receiving this email in connection with a booking, payment, or message for Hair by Nadjae.</p>' +
      "</td></tr></table></body></html>"
    );
  }

  function renderEmailPreview(key) {
    if (!emailPreviewFrame) return;
    selectedEmailPreviewKey = key || selectedEmailPreviewKey;
    emailPreviewFrame.srcdoc = previewEmailHtml(selectedEmailPreviewKey);
    document.querySelectorAll("[data-email-preview-link]").forEach(function (btn) {
      var active = btn.getAttribute("data-email-preview-link") === selectedEmailPreviewKey;
      btn.classList.toggle("is-active", active);
    });
  }

  function openEmailPreviewModal(startKey) {
    if (!emailPreviewModal) return;
    renderEmailPreview(startKey || selectedEmailPreviewKey);
    emailPreviewModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeEmailPreviewModal() {
    if (emailPreviewModal) emailPreviewModal.hidden = true;
    document.body.style.overflow = "";
  }

  function initEmailPreviewModal() {
    if (!emailPreviewModal) return;
    document.querySelectorAll("[data-open-email-previews]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openEmailPreviewModal(selectedEmailPreviewKey);
      });
    });
    document.querySelectorAll("[data-email-preview-link]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-email-preview-link");
        if (key) openEmailPreviewModal(key);
      });
    });
    emailPreviewModal.querySelectorAll("[data-admin-email-preview-close]").forEach(function (btn) {
      btn.addEventListener("click", closeEmailPreviewModal);
    });
    emailPreviewModal.addEventListener("click", function (e) {
      if (e.target === emailPreviewModal) closeEmailPreviewModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && emailPreviewModal && !emailPreviewModal.hidden) closeEmailPreviewModal();
    });
  }

  function normalizeClientKey(row) {
    var email = String(row.email || "").trim().toLowerCase();
    if (email && email !== "—") return "email:" + email;
    var phoneDigits = String(row.phone || "").replace(/\D/g, "");
    if (phoneDigits) return "phone:" + phoneDigits;
    return "name:" + String(row.full_name || "unknown").trim().toLowerCase();
  }

  function makeClientKeyFromParts(name, email, phone) {
    var e = String(email || "").trim().toLowerCase();
    if (e && e !== "—") return "email:" + e;
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits) return "phone:" + digits;
    return "name:" + String(name || "unknown").trim().toLowerCase();
  }

  function groupRowsByClient(rows) {
    var m = new Map();
    rows.forEach(function (row) {
      var key = normalizeClientKey(row);
      var g = m.get(key);
      if (!g) {
        g = {
          key: key,
          full_name: row.full_name || "Unknown",
          email: row.email || "",
          phone: row.phone || "",
          rows: [],
        };
      } else {
        if ((!g.email || g.email === "—") && row.email && row.email !== "—") g.email = row.email;
        if ((!g.phone || g.phone === "—") && row.phone && row.phone !== "—") g.phone = row.phone;
      }
      g.rows.push(row);
      m.set(key, g);
    });
    return m;
  }

  function addClientDlRow(dl, label, value) {
    if (!dl) return;
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value || "—";
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function renderClientProfile(clientKey) {
    if (!clientDetailOverlay || !clientProfileWrap) return;
    var group = clientKey ? cachedClientGroups.get(clientKey) : null;
    if (!group) {
      closeClientProfileModal();
      return;
    }

    selectedClientKey = clientKey;
    clientProfileWrap.hidden = false;

    var rows = group.rows.slice().sort(function (a, b) {
      var ta = a.created_at ? a.created_at.getTime() : 0;
      var tb = b.created_at ? b.created_at.getTime() : 0;
      return tb - ta;
    });
    var paidCount = rows.filter(function (r) { return String(r.payment_status || "").toLowerCase() === "deposit_paid"; }).length;
    var cancelledCount = rows.filter(function (r) { return String(r.booking_status || "").toLowerCase() === "cancelled"; }).length;
    var totalRevenue = rows.reduce(function (sum, r) { return sum + Number(r.estimated_total || 0); }, 0);
    var totalDeposits = rows.reduce(function (sum, r) { return sum + Number(r.deposit_amount || 0); }, 0);
    var lastBooked = rows[0] && rows[0].created_at ? formatDateTime(rows[0].created_at) : "—";

    if (clientKpisEl) {
      var cards = [
        { label: "Bookings", value: String(rows.length) },
        { label: "Paid deposits", value: String(paidCount) },
        { label: "Cancelled", value: String(cancelledCount) },
        { label: "Revenue", value: money(totalRevenue) },
        { label: "Deposits", value: money(totalDeposits) },
        { label: "Last booked", value: lastBooked },
      ];
      clientKpisEl.innerHTML = cards
        .map(function (k) {
          return '<article class="admin-kpi"><p class="admin-kpi__label">' + safeText(k.label) + '</p><p class="admin-kpi__value">' + safeText(k.value) + "</p></article>";
        })
        .join("");
    }

    if (clientContactEl) {
      while (clientContactEl.firstChild) clientContactEl.removeChild(clientContactEl.firstChild);
      addClientDlRow(clientContactEl, "Name", group.full_name || "—");
      addClientDlRow(clientContactEl, "Email", group.email || "—");
      addClientDlRow(clientContactEl, "Phone", group.phone || "—");
    }

    if (clientStylesEl) {
      var byStyle = countBy(rows, function (r) { return r.style_name || r.style_id || "Unknown"; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 6);
      renderBarList(clientStylesEl, byStyle, { showRevenue: true });
    }

    if (clientHistoryBody) {
      clientHistoryBody.innerHTML = rows.length
        ? rows
            .map(function (r) {
              return (
                "<tr>" +
                "<td>" + safeText(formatDateTime(r.created_at)) + "</td>" +
                "<td>" + safeText(formatDate(r.appointmentDateObj)) + " · " + safeText(r.appointment_slot || "—") + "</td>" +
                "<td>" + safeText(r.style_name || r.style_id || "—") + "</td>" +
                '<td><span class="' + safeText(statusBadgeClass(r.booking_status)) + '">' + safeText(humanBookingLifecycle(r.booking_status)) + "</span></td>" +
                "<td>" + safeText(money(r.estimated_total)) + "</td>" +
                "<td>" + safeText(money(r.deposit_amount)) + "</td>" +
                '<td><button type="button" class="btn btn-outline admin-view-btn" data-booking-id="' +
                safeText(String(r.id || "")) +
                '"' +
                (r.id ? ' aria-label="View booking details"' : " disabled") +
                ">View</button></td>" +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="7">No bookings found for this client.</td></tr>';
    }

    clientDetailOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeClientProfileModal() {
    if (clientDetailOverlay) clientDetailOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  function initClientProfileModal() {
    if (!clientDetailOverlay) return;
    clientDetailOverlay.addEventListener("click", function (e) {
      if (e.target === clientDetailOverlay) closeClientProfileModal();
    });
    clientDetailOverlay.querySelectorAll("[data-admin-client-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeClientProfileModal();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && clientDetailOverlay && !clientDetailOverlay.hidden) {
        closeClientProfileModal();
      }
    });
  }

  function renderEmpty(el, message) {
    el.innerHTML = '<p class="admin-empty">' + safeText(message) + "</p>";
  }

  function renderKpis(allRows, scopedRows) {
    if (!kpisEl) return;
    var today = startOfToday();
    var upcoming = allRows.filter(function (r) {
      return r.appointmentDateObj && r.appointmentDateObj >= today;
    });
    var thisMonth = allRows.filter(function (r) {
      return r.appointmentDateObj && r.appointmentDateObj.getMonth() === today.getMonth() && r.appointmentDateObj.getFullYear() === today.getFullYear();
    });

    var totalRevenue = scopedRows.reduce(function (sum, r) { return sum + r.estimated_total; }, 0);
    var totalDeposits = scopedRows.reduce(function (sum, r) { return sum + r.deposit_amount; }, 0);
    var avgValue = scopedRows.length ? totalRevenue / scopedRows.length : 0;

    var cards = [
      { label: "Bookings (range)", value: String(scopedRows.length) },
      { label: "Revenue (range)", value: money(totalRevenue) },
      { label: "Deposits (range)", value: money(totalDeposits) },
      { label: "Avg Booking Value", value: money(avgValue) },
      { label: "Upcoming", value: String(upcoming.length) },
      { label: "This Month", value: String(thisMonth.length) },
      { label: "All-Time Revenue", value: money(allRows.reduce(function (s, r) { return s + r.estimated_total; }, 0)) },
      { label: "All-Time Deposits", value: money(allRows.reduce(function (s, r) { return s + r.deposit_amount; }, 0)) },
    ];

    kpisEl.innerHTML = cards
      .map(function (k) {
        return '<article class="admin-kpi"><p class="admin-kpi__label">' + safeText(k.label) + '</p><p class="admin-kpi__value">' + safeText(k.value) + "</p></article>";
      })
      .join("");
  }

  function countBy(rows, keyFn) {
    var m = new Map();
    rows.forEach(function (row) {
      var key = keyFn(row);
      var item = m.get(key) || { key: key, count: 0, total: 0 };
      item.count += 1;
      item.total += row.estimated_total;
      m.set(key, item);
    });
    return Array.from(m.values());
  }

  function renderBarList(el, items, opts) {
    if (!el) return;
    if (!items.length) {
      renderEmpty(el, "No data in selected range.");
      return;
    }
    var max = Math.max.apply(
      null,
      items.map(function (i) { return i.count; }),
    );
    el.innerHTML = items
      .map(function (i) {
        var percent = max ? Math.max(8, Math.round((i.count / max) * 100)) : 0;
        var right = opts.showRevenue ? money(i.total) : String(i.count);
        return (
          '<div class="admin-list-row">' +
          '<div class="admin-list-row__top"><strong>' +
          safeText(i.key) +
          '</strong><span>' +
          safeText(String(i.count)) +
          " bookings · " +
          safeText(right) +
          "</span></div>" +
          '<div class="admin-bar"><span style="width:' +
          percent +
          '%"></span></div>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderSimpleCounts(el, title, mapEntries) {
    if (!el) return;
    var items = (mapEntries || []).map(function (entry) {
      return { key: entry[0], count: Number(entry[1] || 0), total: Number(entry[1] || 0) };
    });
    renderBarList(el, items, { showRevenue: false });
  }

  function renderTables(allRows) {
    if (upcomingBody) {
      var today = startOfToday();
      var upcoming = allRows
        .filter(function (r) { return r.appointmentDateObj && r.appointmentDateObj >= today; })
        .sort(function (a, b) { return a.appointmentDateObj - b.appointmentDateObj; })
        .slice(0, 20);

      upcomingBody.innerHTML = upcoming.length
        ? upcoming
            .map(function (r) {
              return (
                "<tr>" +
                "<td>" + safeText(formatDate(r.appointmentDateObj)) + "</td>" +
                "<td>" + safeText(r.appointment_slot) + "</td>" +
                '<td><button type="button" class="admin-client-link" data-client-key="' +
                safeText(normalizeClientKey(r)) +
                '">' +
                safeText(r.full_name) +
                "</button></td>" +
                "<td>" + safeText(r.style_name) + "</td>" +
                "<td>" + phoneLinkHtml(r.phone) + "</td>" +
                "<td>" + safeText(money(r.deposit_amount)) + "</td>" +
                '<td><button type="button" class="btn btn-outline admin-view-btn" data-booking-id="' +
                safeText(String(r.id || "")) +
                '"' +
                (r.id ? ' aria-label="View booking details"' : " disabled") +
                ">View</button></td>" +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="7">No upcoming appointments.</td></tr>';
    }

    if (recentBody) {
      var recent = allRows
        .slice()
        .sort(function (a, b) {
          return (b.created_at ? b.created_at.getTime() : 0) - (a.created_at ? a.created_at.getTime() : 0);
        })
        .slice(0, 25);
      recentBody.innerHTML = recent.length
        ? recent
            .map(function (r) {
              return (
                "<tr>" +
                "<td>" + safeText(formatDateTime(r.created_at)) + "</td>" +
                '<td><button type="button" class="admin-client-link" data-client-key="' +
                safeText(normalizeClientKey(r)) +
                '">' +
                safeText(r.full_name) +
                "</button></td>" +
                "<td>" + safeText(r.email) + "</td>" +
                "<td>" + safeText(r.style_name) + "</td>" +
                "<td>" + safeText(money(r.estimated_total)) + "</td>" +
                "<td>" + safeText(r.source) + "</td>" +
                '<td><button type="button" class="btn btn-outline admin-view-btn" data-booking-id="' +
                safeText(String(r.id || "")) +
                '"' +
                (r.id ? ' aria-label="View booking details"' : " disabled") +
                ">View</button></td>" +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="7">No recent bookings.</td></tr>';
    }
  }

  function syncFcViewButtons(activeView) {
    document.querySelectorAll("[data-fc-view]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-fc-view") === activeView);
    });
  }

  function wireFcToolbar() {
    if (!fcCalendar) return;
    var prev = document.getElementById("fc-prev");
    var next = document.getElementById("fc-next");
    var today = document.getElementById("fc-today");
    if (prev)
      prev.addEventListener("click", function () {
        fcCalendar.prev();
      });
    if (next)
      next.addEventListener("click", function () {
        fcCalendar.next();
      });
    if (today)
      today.addEventListener("click", function () {
        fcCalendar.today();
      });
    document.querySelectorAll("[data-fc-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-fc-view");
        if (v) fcCalendar.changeView(v);
      });
    });
  }

  function updateFullCalendarEvents() {
    if (!fcCalendar || !(window.FullCalendar && window.FullCalendar.Calendar)) return;
    fcCalendar.removeAllEvents();
    cachedRows.forEach(function (row) {
      var start = parseAppointmentStart(row);
      if (!start || Number.isNaN(start.getTime())) return;
      var dur = durationFor(row);
      var end = new Date(start.getTime() + dur * 60000);
      var color = bookingStatusColorHex(row.booking_status);
      fcCalendar.addEvent({
        id: String(row.id),
        title: row.full_name + " — " + row.style_name,
        start: start,
        end: end,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { bookingId: row.id },
      });
    });
    (cachedBlockedIntervals || []).forEach(function (b) {
      if (!b || !b.starts_at || !b.ends_at) return;
      var s = new Date(b.starts_at);
      var e = new Date(b.ends_at);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;
      fcCalendar.addEvent({
        id: "block-" + String(b.id),
        title: b.note ? "Blocked — " + b.note : "Blocked",
        start: s,
        end: e,
        backgroundColor: "#64748b",
        borderColor: "#475569",
        extendedProps: { blockId: b.id },
      });
    });
  }

  function initFullCalendar() {
    var FC = window.FullCalendar;
    if (fcCalendar || !FC || !FC.Calendar) return;
    var el = document.getElementById("admin-fullcalendar");
    if (!el) return;
    fcCalendar = new FC.Calendar(el, {
      initialView: "dayGridMonth",
      headerToolbar: false,
      height: "auto",
      slotDuration: "00:30:00",
      slotMinTime: "08:00:00",
      slotMaxTime: "21:00:00",
      allDaySlot: false,
      displayEventEnd: true,
      nowIndicator: true,
      events: [],
      eventClick: function (info) {
        var id = info.event.extendedProps.bookingId || info.event.id;
        if (id) openBookingDetail(id);
      },
      datesSet: function (arg) {
        var titleEl = document.getElementById("fc-range-title");
        if (titleEl) titleEl.textContent = arg.view.title;
        syncFcViewButtons(arg.view.type);
      },
    });
    fcCalendar.render();
    wireFcToolbar();
    updateFullCalendarEvents();
  }

  function renderAllBookingsTable() {
    if (!allBookingsBody) return;
    var statusVal = adminBookingStatus ? adminBookingStatus.value : "all";
    var q = adminBookingSearch ? String(adminBookingSearch.value || "").trim().toLowerCase() : "";
    var rows = cachedRows.slice().sort(function (a, b) {
      var ta = a.created_at ? a.created_at.getTime() : 0;
      var tb = b.created_at ? b.created_at.getTime() : 0;
      return tb - ta;
    });
    rows = rows.filter(function (r) {
      if (statusVal !== "all" && String(r.booking_status || "").toLowerCase() !== statusVal) return false;
      if (!q) return true;
      var hay = (
        String(r.full_name) +
        " " +
        String(r.email) +
        " " +
        String(r.style_name) +
        " " +
        String(r.id) +
        " " +
        String(r.appointment_date)
      ).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    allBookingsBody.innerHTML = rows.length
      ? rows
          .map(function (r) {
            return (
              '<tr class="admin-row-clickable" data-booking-id="' +
              safeText(String(r.id || "")) +
              '">' +
              "<td>" +
              safeText(formatDateTime(r.created_at)) +
              "</td>" +
              '<td><button type="button" class="admin-client-link" data-client-key="' +
              safeText(normalizeClientKey(r)) +
              '">' +
              safeText(r.full_name) +
              "</button></td>" +
              "<td>" +
              safeText(r.style_name) +
              "</td>" +
              '<td><span class="' +
              safeText(statusBadgeClass(r.booking_status)) +
              '">' +
              safeText(humanBookingLifecycle(r.booking_status)) +
              "</span></td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="4">No bookings match.</td></tr>';
  }

  function setAdminPricingBanner(msg, isErr) {
    var el = document.getElementById("admin-pricing-banner");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("admin-banner--error");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("admin-banner--error", !!isErr);
  }

  function adminPricingGroupMeta(styleId) {
    var x = String(styleId || "");
    if (x.indexOf("knotless") >= 0) return { title: "Knotless", ord: 1 };
    if (x.indexOf("boho") >= 0) return { title: "Boho braids", ord: 2 };
    if (x.indexOf("passion") >= 0) return { title: "Passion twist", ord: 3 };
    if (x.indexOf("feedin") >= 0 || x.indexOf("cornrows") >= 0) return { title: "Feed-in cornrows", ord: 4 };
    if (x.indexOf("locs") >= 0) return { title: "Locs", ord: 5 };
    if (x.indexOf("wig") >= 0) return { title: "Wigs / quick weave", ord: 6 };
    if (x.indexOf("natural") >= 0) return { title: "Natural hairstyles", ord: 7 };
    if (x.indexOf("fulani") >= 0) return { title: "Fulani braids", ord: 8 };
    if (x.indexOf("lemonade") >= 0) return { title: "Lemonade braids", ord: 9 };
    return { title: "Other", ord: 99 };
  }

  function adminPricingMenuMeta(styleId) {
    var x = String(styleId || "");
    if (x.indexOf("studio-") === 0) return { label: "Studio", ord: 1 };
    if (x.indexOf("house-") === 0) return { label: "House call", ord: 2 };
    if (x.indexOf("kids-") === 0) return { label: "Kids", ord: 3 };
    return { label: "Other", ord: 99 };
  }

  function adminPricingStyleParts(row) {
    var pieces = String(row && row.name ? row.name : "")
      .split("·")
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    var menu = pieces[0] || adminPricingMenuMeta(row.id).label;
    var title = pieces[1] || pieces[0] || row.id;
    var size = pieces.slice(2).join(" · ");
    if (!size && title === "Natural") size = "Style";
    return { menu: menu, title: title, size: size };
  }

  function adminPricingPreviewUrl(styleId, coverMap) {
    var row = coverMap && coverMap[styleId];
    if (row && row.storage_path) {
      var remote = styleCoverPublicUrl(row.storage_path);
      if (remote) return remote;
    }
    var fallback = STYLE_COVER_DEFAULT_FILES[styleId];
    return fallback ? "assets/catalog/" + fallback : "";
  }

  function adminPricingAdjustInput(input, delta) {
    if (!input) return;
    var current = parseFloat(String(input.value));
    if (!isFinite(current)) current = 0;
    var next = Math.max(0, Math.round((current + delta) * 100) / 100);
    input.value = String(next);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sortAdminPricingRows(rows) {
    return rows.slice().sort(function (a, b) {
      var ma = adminPricingGroupMeta(a.id);
      var mb = adminPricingGroupMeta(b.id);
      if (ma.ord !== mb.ord) return ma.ord - mb.ord;
      return a.name.localeCompare(b.name);
    });
  }

  function adminPricingCatalogHeader(title, subtitle) {
    return (
      '<div class="catalog-section__title catalog-section__title--stack">' +
      '<span class="catalog-section__bar" aria-hidden="true"></span>' +
      '<div class="catalog-section__heading-text">' +
      "<h2>" +
      safeText(title) +
      "</h2>" +
      '<p class="catalog-section__subtitle">' +
      safeText(subtitle) +
      "</p>" +
      "</div></div>"
    );
  }

  function buildAdminPricingCardsForRows(rows, coverMap) {
    var sorted = sortAdminPricingRows(rows);
    if (!sorted.length) {
      return '<p class="admin-inquiries-note">No styles in this menu.</p>';
    }
    var curGroup = "";
    var parts = [];
    sorted.forEach(function (row) {
      var gm = adminPricingGroupMeta(row.id);
      if (gm.title !== curGroup) {
        if (curGroup) parts.push("</div>");
        curGroup = gm.title;
        parts.push('<h3 class="admin-pricing-group-title">' + safeText(curGroup) + "</h3>");
        parts.push('<div class="admin-pricing-cards">');
      }
      var styleParts = adminPricingStyleParts(row);
      var preview = adminPricingPreviewUrl(row.id, coverMap);
      parts.push('<article class="admin-pricing-card">');
      parts.push('<div class="admin-pricing-card__media" aria-hidden="true">');
      if (preview) {
        parts.push(
          '<img src="' +
            escapeAttr(preview) +
            '" alt="" width="76" height="76" loading="lazy" class="admin-pricing-card__img" />',
        );
      } else {
        parts.push('<span class="admin-pricing-card__placeholder">No image</span>');
      }
      parts.push("</div>");
      parts.push('<div class="admin-pricing-card__body">');
      parts.push('<div class="admin-pricing-card__copy">');
      parts.push('<p class="admin-pricing-card__eyebrow">' + safeText(styleParts.menu) + "</p>");
      parts.push('<h4 class="admin-pricing-card__title">' + safeText(styleParts.title) + "</h4>");
      if (styleParts.size) parts.push('<p class="admin-pricing-card__size">' + safeText(styleParts.size) + "</p>");
      parts.push("</div>");
      parts.push('<div class="admin-pricing-controls">');
      parts.push(
        '<label class="visually-hidden" for="admin-price-' +
          escapeAttr(row.id) +
          '">' +
          safeText(row.name) +
          "</label>",
      );
      parts.push(
        '<button type="button" class="admin-pricing-step" data-admin-price-step="-5" data-admin-price-target="' +
          escapeAttr(row.id) +
          '" aria-label="Decrease ' +
          escapeAttr(row.name) +
          ' by five dollars">-$5</button>',
      );
      parts.push(
        '<input id="admin-price-' +
          escapeAttr(row.id) +
          '" class="admin-pricing-input" type="number" min="0" step="1" inputmode="decimal" data-admin-style-price="' +
          escapeAttr(row.id) +
          '" value="' +
          escapeAttr(String(row.base)) +
          '" />',
      );
      parts.push(
        '<button type="button" class="admin-pricing-step" data-admin-price-step="5" data-admin-price-target="' +
          escapeAttr(row.id) +
          '" aria-label="Increase ' +
          escapeAttr(row.name) +
          ' by five dollars">+$5</button>',
      );
      parts.push("</div>");
      parts.push("</div>");
      parts.push("</article>");
    });
    if (curGroup) parts.push("</div>");
    return parts.join("");
  }

  function initAdminPricingTabs(root) {
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
    if (!tabs.length || tabs.length !== panels.length) return;

    function select(index) {
      tabs.forEach(function (tab, j) {
        var selected = j === index;
        tab.setAttribute("aria-selected", selected);
        tab.tabIndex = selected ? 0 : -1;
        panels[j].hidden = !selected;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i);
      });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          select(next);
          tabs[next].focus();
        }
      });
    });
  }

  function collectAllAdminStylePrices(mount) {
    var sp = window.__NADJAE_STYLE_PRICING;
    if (!sp || !mount) return {};
    var all = {};
    sp.getDefaults().forEach(function (d) {
      if (d.id === "other") return;
      var inp = mount.querySelector('[data-admin-style-price="' + escapeAttr(d.id) + '"]');
      var v = inp ? parseFloat(String(inp.value)) : NaN;
      if (!isFinite(v) || v < 0) v = d.base;
      all[d.id] = Math.round(v * 100) / 100;
    });
    return all;
  }

  function buildDefaultsPriceMap(sp) {
    var map = {};
    sp.getDefaults().forEach(function (d) {
      if (d.id === "other") return;
      map[d.id] = d.base;
    });
    return map;
  }

  async function saveAdminStylePricing(mount, resetAll) {
    setAdminPricingBanner("", false);
    var sp = window.__NADJAE_STYLE_PRICING;
    var sb = window.nadjaeSupabaseClient;
    if (!sp) {
      setAdminPricingBanner("Pricing script not loaded.", true);
      return;
    }
    if (!sb) {
      setAdminPricingBanner("Connect Supabase (local config) before saving prices.", true);
      return;
    }
    var payload = resetAll ? buildDefaultsPriceMap(sp) : collectAllAdminStylePrices(mount);
    var inv = await sb.functions.invoke("admin-salon-site-kv", {
      body: {
        admin_code: ACCESS_CODE,
        key: sp.kvKey || "style_price_overrides",
        value: payload,
      },
    });
    if (inv.error) {
      setAdminPricingBanner(
        (inv.error && inv.error.message) ||
          "Save failed. Deploy the admin-salon-site-kv Edge Function and ensure hairbynadjae_site is configured.",
        true,
      );
      return;
    }
    var data = inv.data;
    var nextVal = data && data.value && typeof data.value === "object" ? data.value : payload;
    sp.applyRemoteOverrideMap(nextVal);
    setAdminPricingBanner(resetAll ? "All prices reset to bundled defaults and saved." : "Prices saved — live site updated.", false);
    renderAdminStylePricingPanel();
  }

  function renderAdminStylePricingPanel() {
    var mount = document.getElementById("admin-style-pricing-mount");
    if (!mount) return;
    var sp = window.__NADJAE_STYLE_PRICING;
    if (!sp) {
      mount.innerHTML = '<p class="admin-banner admin-banner--error">Missing js/style-pricing.js.</p>';
      return;
    }
    mount.innerHTML = '<p class="admin-banner">Loading prices…</p>';
    void Promise.all([sp.fetchRemoteStylePriceOverrides(), fetchStyleCoverMap()]).then(function (result) {
      var coverMap = result[1] || {};
      var merged = sp.getMergedStyles();
      var studioRows = merged.filter(function (r) {
        return r.id !== "other" && r.id.indexOf("studio-") === 0;
      });
      var houseRows = merged.filter(function (r) {
        return r.id !== "other" && r.id.indexOf("house-") === 0;
      });
      var kidsRows = merged.filter(function (r) {
        return r.id !== "other" && r.id.indexOf("kids-") === 0;
      });
      var parts = [];
      parts.push('<div class="admin-pricing-toolbar">');
      parts.push(
        '<button type="button" class="btn btn-primary" id="admin-pricing-save">Save changes</button> ',
      );
      parts.push(
        '<button type="button" class="btn btn-outline" id="admin-pricing-reset">Reset all to defaults</button>',
      );
      parts.push("</div>");
      parts.push('<section class="pricing-tabs admin-pricing-tabs" data-admin-pricing-tabs aria-label="Price menus">');
      parts.push('<div class="pricing-tabs__list" role="tablist" aria-label="Choose a price menu">');
      parts.push(
        '<button type="button" class="pricing-tabs__tab" role="tab" id="admin-tab-pricing-studio" aria-selected="true" aria-controls="admin-panel-pricing-studio" tabindex="0">Studio</button>',
      );
      parts.push(
        '<button type="button" class="pricing-tabs__tab" role="tab" id="admin-tab-pricing-house" aria-selected="false" aria-controls="admin-panel-pricing-house" tabindex="-1">House call</button>',
      );
      parts.push(
        '<button type="button" class="pricing-tabs__tab" role="tab" id="admin-tab-pricing-kids" aria-selected="false" aria-controls="admin-panel-pricing-kids" tabindex="-1">Kids · 12 &amp; under</button>',
      );
      parts.push("</div>");
      parts.push(
        '<div id="admin-panel-pricing-studio" class="pricing-tabs__panel price-menu price-menu--studio" role="tabpanel" aria-labelledby="admin-tab-pricing-studio">',
      );
      parts.push(adminPricingCatalogHeader("Studio price list", "In-person appointments"));
      parts.push(buildAdminPricingCardsForRows(studioRows, coverMap));
      parts.push("</div>");
      parts.push(
        '<div id="admin-panel-pricing-house" class="pricing-tabs__panel price-menu price-menu--house" role="tabpanel" aria-labelledby="admin-tab-pricing-house" hidden>',
      );
      parts.push(adminPricingCatalogHeader("House-call price list", "We come to you"));
      parts.push(buildAdminPricingCardsForRows(houseRows, coverMap));
      parts.push("</div>");
      parts.push(
        '<div id="admin-panel-pricing-kids" class="pricing-tabs__panel price-menu price-menu--kids" role="tabpanel" aria-labelledby="admin-tab-pricing-kids" hidden>',
      );
      parts.push(adminPricingCatalogHeader("Kids — 12 & under", "Studio pricing · ages 12 and under"));
      parts.push(buildAdminPricingCardsForRows(kidsRows, coverMap));
      parts.push("</div>");
      parts.push("</section>");
      mount.innerHTML = parts.join("");
      initAdminPricingTabs(mount.querySelector("[data-admin-pricing-tabs]"));
      var saveBtn = document.getElementById("admin-pricing-save");
      var resetBtn = document.getElementById("admin-pricing-reset");
      if (saveBtn) {
        saveBtn.addEventListener("click", function () {
          void saveAdminStylePricing(mount, false);
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          if (!window.confirm("Reset every style price to the built-in defaults?")) return;
          void saveAdminStylePricing(mount, true);
        });
      }
      mount.querySelectorAll("[data-admin-price-step]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sid = btn.getAttribute("data-admin-price-target");
          var delta = parseFloat(btn.getAttribute("data-admin-price-step") || "0");
          var input = mount.querySelector('[data-admin-style-price="' + escapeAttr(sid) + '"]');
          adminPricingAdjustInput(input, isFinite(delta) ? delta : 0);
        });
      });
    });
  }

  function setAdminHoursBanner(msg, isErr) {
    var el = document.getElementById("admin-hours-banner");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("admin-banner--error");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("admin-banner--error", !!isErr);
  }

  function hoursTimeValue(hour, minute) {
    var h = String(hour).padStart(2, "0");
    var m = String(minute).padStart(2, "0");
    return h + ":" + m;
  }

  function parseHoursTimeInput(val) {
    var m = String(val || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
    return { hour: h, minute: min };
  }

  function currentBookingHoursMerged() {
    var BH = window.__NADJAE_BOOKING_HOURS;
    var base = BH && BH.getDefaults ? BH.getDefaults() : {};
    return Object.assign({}, base, window.__NADJAE_BOOKING || {});
  }

  function collectWorkingHoursFromMount(mount) {
    var BH = window.__NADJAE_BOOKING_HOURS;
    var base = BH && BH.getDefaults ? BH.getDefaults() : {};
    var open = parseHoursTimeInput((mount.querySelector("#admin-hours-open") || {}).value);
    var last = parseHoursTimeInput((mount.querySelector("#admin-hours-last") || {}).value);
    var sat = parseHoursTimeInput((mount.querySelector("#admin-hours-sat-last") || {}).value);
    var publicText = String((mount.querySelector("#admin-hours-public-text") || {}).value || "").trim();
    var closed = [];
    mount.querySelectorAll("[data-admin-hours-closed]").forEach(function (cb) {
      if (cb.checked) closed.push(parseInt(cb.getAttribute("data-admin-hours-closed"), 10));
    });
    closed.sort(function (a, b) { return a - b; });
    return {
      slotDayStartHour: open ? open.hour : base.slotDayStartHour,
      slotDayStartMinute: open ? open.minute : base.slotDayStartMinute,
      slotDayEndHour: last ? last.hour : base.slotDayEndHour,
      slotDayEndMinute: last ? last.minute : base.slotDayEndMinute,
      saturdayLastStartHour: sat ? sat.hour : base.saturdayLastStartHour,
      saturdayLastStartMinute: sat ? sat.minute : base.saturdayLastStartMinute,
      slotStepMinutes: base.slotStepMinutes,
      sameDayLeadMinutes: base.sameDayLeadMinutes,
      concurrentAppointmentCapacity: base.concurrentAppointmentCapacity,
      closedWeekdays: closed,
      publicHoursText: publicText || base.publicHoursText,
    };
  }

  async function saveAdminWorkingHours(mount, resetAll) {
    setAdminHoursBanner("", false);
    var BH = window.__NADJAE_BOOKING_HOURS;
    var sb = window.nadjaeSupabaseClient;
    if (!BH) {
      setAdminHoursBanner("Working hours module not loaded.", true);
      return;
    }
    if (!sb) {
      setAdminHoursBanner("Connect Supabase before saving hours.", true);
      return;
    }
    var payload = resetAll ? BH.getDefaults() : collectWorkingHoursFromMount(mount);
    var sanitized = BH.sanitizeHours(payload);
    if (!sanitized) {
      setAdminHoursBanner("Invalid hours — check that last slot is after opening and Saturday cutoff is in range.", true);
      return;
    }
    var inv = await sb.functions.invoke("admin-salon-site-kv", {
      body: {
        admin_code: ACCESS_CODE,
        key: BH.settingKey || "booking_hours",
        value: sanitized,
      },
    });
    if (inv.error) {
      setAdminHoursBanner((inv.error && inv.error.message) || "Save failed.", true);
      return;
    }
    var data = inv.data;
    var nextVal = data && data.value && typeof data.value === "object" ? data.value : sanitized;
    BH.mergeIntoBookingConfig(nextVal);
    BH.applyPublicHoursDom(nextVal.publicHoursText);
    reloadBookCfg();
    renderAdminManualCalendar();
    renderAdminBlockCalendar();
    setAdminHoursBanner(resetAll ? "Hours reset to defaults and saved." : "Working hours saved — booking calendar updated.", false);
    renderAdminWorkingHoursPanel();
  }

  function renderAdminWorkingHoursPanel() {
    var mount = document.getElementById("admin-working-hours-mount");
    if (!mount) return;
    var BH = window.__NADJAE_BOOKING_HOURS;
    if (!BH) {
      mount.innerHTML = '<p class="admin-banner admin-banner--error">Missing js/booking-hours.js.</p>';
      return;
    }
    mount.innerHTML = '<p class="admin-banner">Loading hours…</p>';
    void BH.fetchRemoteBookingHours()
      .catch(function () {})
      .finally(function () {
        var h = currentBookingHoursMerged();
        var labels = BH.weekdayLabels || ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        var closed = h.closedWeekdays || [];
        var parts = [];
        parts.push('<form id="admin-hours-form" class="admin-schedule-form admin-hours-form">');
        parts.push('<div class="admin-grid-2 admin-hours-form__times">');
        parts.push('<div class="admin-control"><label for="admin-hours-open">Opening time (first slot)</label>');
        parts.push(
          '<input id="admin-hours-open" type="time" value="' +
            escapeAttr(hoursTimeValue(h.slotDayStartHour, h.slotDayStartMinute)) +
            '" required />',
        );
        parts.push("</div>");
        parts.push('<div class="admin-control"><label for="admin-hours-last">Weekday last slot start</label>');
        parts.push(
          '<input id="admin-hours-last" type="time" value="' +
            escapeAttr(hoursTimeValue(h.slotDayEndHour, h.slotDayEndMinute)) +
            '" required />',
        );
        parts.push('<p class="admin-inquiries-note">Mon–Fri (and days not closed below). Slots every ' + safeText(String(h.slotStepMinutes || 30)) + " min.</p>");
        parts.push("</div>");
        parts.push('<div class="admin-control"><label for="admin-hours-sat-last">Saturday last slot start</label>');
        parts.push(
          '<input id="admin-hours-sat-last" type="time" value="' +
            escapeAttr(hoursTimeValue(h.saturdayLastStartHour, h.saturdayLastStartMinute)) +
            '" required />',
        );
        parts.push("</div>");
        parts.push("</div>");
        parts.push('<fieldset class="admin-control admin-hours-closed"><legend>Closed days (no booking)</legend>');
        parts.push('<div class="admin-hours-closed__grid">');
        for (var d = 0; d < 7; d++) {
          parts.push(
            '<label class="admin-schedule__checkbox-label"><input type="checkbox" data-admin-hours-closed="' +
              d +
              '"' +
              (closed.indexOf(d) >= 0 ? " checked" : "") +
              " /> " +
              safeText(labels[d]) +
              "</label>",
          );
        }
        parts.push("</div></fieldset>");
        parts.push('<div class="admin-control"><label for="admin-hours-public-text">Homepage hours line</label>');
        parts.push(
          '<input id="admin-hours-public-text" type="text" maxlength="500" value="' +
            escapeAttr(h.publicHoursText || "") +
            '" placeholder="e.g. Monday–Saturday: 8:00 AM – 7:30 PM" />',
        );
        parts.push("</div>");
        parts.push('<div class="admin-schedule-actions">');
        parts.push('<button type="submit" class="btn btn-primary">Save working hours</button> ');
        parts.push('<button type="button" class="btn btn-outline" id="admin-hours-reset">Reset to defaults</button>');
        parts.push("</div></form>");
        mount.innerHTML = parts.join("");
        var form = document.getElementById("admin-hours-form");
        if (form) {
          form.addEventListener("submit", function (e) {
            e.preventDefault();
            void saveAdminWorkingHours(mount, false);
          });
        }
        var resetBtn = document.getElementById("admin-hours-reset");
        if (resetBtn) {
          resetBtn.addEventListener("click", function () {
            if (!window.confirm("Reset working hours to site defaults and save to Supabase?")) return;
            void saveAdminWorkingHours(mount, true);
          });
        }
      });
  }

  function initAdminTabs() {
    document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-admin-tab");
        document.querySelectorAll("[data-admin-tab]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        document.querySelectorAll('[data-admin-panel="stats"]').forEach(function (p) {
          p.hidden = tab !== "stats";
        });
        var scheduleWrap = document.getElementById("admin-panel-schedule-wrap");
        if (scheduleWrap) scheduleWrap.hidden = tab !== "schedule";
        var calWrap = document.getElementById("admin-panel-calendar-wrap");
        if (calWrap) calWrap.hidden = tab !== "calendar";
        var pricesWrap = document.getElementById("admin-panel-prices-wrap");
        if (pricesWrap) pricesWrap.hidden = tab !== "prices";
        var coversWrap = document.getElementById("admin-panel-covers-wrap");
        if (coversWrap) coversWrap.hidden = tab !== "covers";
        if (tab === "schedule") {
          populateScheduleSelects();
          renderBlocksTable();
          renderAdminWorkingHoursPanel();
        }
        if (tab === "calendar") {
          if (!fcCalendar) initFullCalendar();
          else {
            updateFullCalendarEvents();
            fcCalendar.updateSize();
          }
          renderAllBookingsTable();
        }
        if (tab === "prices") {
          renderAdminStylePricingPanel();
        }
        if (tab === "covers") {
          renderAdminStyleCoversPanel();
        }
      });
    });
  }

  function filterByRange(rows) {
    var days = parseRangeDays();
    if (!days) return rows.slice();
    var cutoff = startOfToday();
    cutoff.setDate(cutoff.getDate() - days);
    return rows.filter(function (r) {
      return r.created_at && r.created_at >= cutoff;
    });
  }

  async function fetchInquiries() {
    var sb = window.nadjaeSupabaseClient;
    if (!sb) return [];
    var res = await sb
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    return res.data || [];
  }

  function renderInquiries(rows) {
    if (!inquiriesBody) return;
    var list = rows || [];
    if (!list.length) {
      inquiriesBody.innerHTML = "<tr><td colspan=\"5\">No inquiries yet.</td></tr>";
      return;
    }
    inquiriesBody.innerHTML = list
      .map(function (r) {
        var msg = r.message != null ? String(r.message) : "";
        var shortMsg = msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
        var created = r.created_at ? new Date(r.created_at) : null;
        var when =
          created && !Number.isNaN(created.getTime())
            ? created.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—";
        return (
          "<tr><td>" +
          safeText(when) +
          '</td><td><button type="button" class="admin-client-link" data-client-key="' +
          safeText(makeClientKeyFromParts(r.full_name, r.email, r.phone || "")) +
          '">' +
          safeText(r.full_name) +
          "</button></td><td>" +
          safeText(r.email) +
          "</td><td>" +
          phoneLinkHtml(r.phone || "") +
          "</td><td>" +
          safeText(shortMsg) +
          "</td></tr>"
        );
      })
      .join("");
  }

  async function fetchBookings() {
    var sb = window.nadjaeSupabaseClient;
    if (!sb) {
      throw new Error("Supabase is required — configure js/supabase-config.local.js so bookings load from the database.");
    }

    var all = [];
    var page = 0;
    var pageSize = 1000;
    while (true) {
      var from = page * pageSize;
      var to = from + pageSize - 1;
      var res = await sb
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (res.error) throw res.error;
      var rows = res.data || [];
      all = all.concat(rows);
      if (rows.length < pageSize) break;
      page += 1;
      if (page > 9) break;
    }
    return all.map(normalizeRow);
  }

  async function refreshDashboard() {
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) errorEl.hidden = true;

    try {
      var allRows = await fetchBookings();
      cachedRows = allRows;
      var scopedRows = filterByRange(allRows);
      var usingSupabase = !!window.nadjaeSupabaseClient;

      if (loadingEl) {
        loadingEl.hidden = false;
        loadingEl.textContent = "Loaded live Supabase booking metrics.";
      }

      renderKpis(allRows, scopedRows);

      var services = countBy(scopedRows, function (r) { return r.style_name; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 8);
      renderBarList(servicesEl, services, { showRevenue: true });

      cachedClientGroups = groupRowsByClient(allRows);
      var clients = Array.from(cachedClientGroups.values())
        .map(function (g) {
          var scoped = g.rows.filter(function (r) { return scopedRows.indexOf(r) >= 0; });
          return {
            key: g.key,
            label: g.full_name || "Unknown",
            count: scoped.length,
            total: scoped.reduce(function (sum, r) { return sum + Number(r.estimated_total || 0); }, 0),
          };
        })
        .filter(function (x) { return x.count > 0; })
        .sort(function (a, b) { return b.total - a.total; })
        .slice(0, 8);
      if (clientsEl) {
        if (!clients.length) {
          renderEmpty(clientsEl, "No data in selected range.");
        } else {
          var maxClientTotal = Math.max.apply(
            null,
            clients.map(function (i) { return Number(i.total || 0); }),
          );
          clientsEl.innerHTML = clients
            .map(function (i, idx) {
              var pct = maxClientTotal ? Math.max(8, Math.round((Number(i.total || 0) / maxClientTotal) * 100)) : 8;
              return (
                '<div class="admin-top-client-row">' +
                '<span class="admin-top-client-rank">#' +
                safeText(String(idx + 1)) +
                "</span>" +
                '<button type="button" class="admin-client-link admin-top-client-name" data-client-key="' +
                safeText(i.key) +
                '">' +
                safeText(i.label) +
                "</button>" +
                '<span class="admin-top-client-meta">' +
                safeText(String(i.count)) +
                " booking" +
                (i.count === 1 ? "" : "s") +
                "</span>" +
                '<span class="admin-top-client-value">' +
                safeText(money(i.total)) +
                "</span>" +
                '<span class="admin-top-client-bar admin-bar"><span style="width:' +
                pct +
                '%"></span></span>' +
                "</div>"
              );
            })
            .join("");
        }
      }

      var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      var dayCounts = dayNames.map(function (d) { return [d, 0]; });
      scopedRows.forEach(function (r) {
        if (!r.appointmentDateObj) return;
        dayCounts[r.appointmentDateObj.getDay()][1] += 1;
      });
      renderSimpleCounts(daysEl, "Appointment day distribution", dayCounts);

      function menuKind(styleId) {
        var s = String(styleId || "");
        if (s.indexOf("house-") === 0) return "House call menu";
        if (s.indexOf("kids-") === 0) return "Kids menu";
        if (s.indexOf("studio-") === 0) return "Studio menu";
        return "Other / unspecified";
      }
      var optionCounts = [
        ["Studio menu", scopedRows.filter(function (r) { return menuKind(r.style_id) === "Studio menu"; }).length],
        ["House call menu", scopedRows.filter(function (r) { return menuKind(r.style_id) === "House call menu"; }).length],
        ["Kids menu", scopedRows.filter(function (r) { return menuKind(r.style_id) === "Kids menu"; }).length],
        ["Other / consultation", scopedRows.filter(function (r) { return menuKind(r.style_id) === "Other / unspecified"; }).length],
      ];
      renderSimpleCounts(optionsEl, "Bookings by menu", optionCounts);

      renderTables(allRows);

      cachedBlockedIntervals = usingSupabase ? await fetchBlockedIntervals() : [];
      renderBlocksTable();
      updateFullCalendarEvents();
      renderAllBookingsTable();
      if (selectedClientKey && clientDetailOverlay && !clientDetailOverlay.hidden) {
        renderClientProfile(selectedClientKey);
      }

      var inquiries = [];
      if (usingSupabase) {
        try {
          inquiries = await fetchInquiries();
        } catch (inqErr) {
          inquiries = [];
          console.warn(inqErr);
        }
      }
      renderInquiries(inquiries);

      if (loadingEl && usingSupabase) loadingEl.hidden = true;
    } catch (err) {
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) {
        var msg = err && err.message ? err.message : String(err || "Unknown error");
        errorEl.hidden = false;
        errorEl.textContent =
          "Could not load admin data. " +
          msg +
          " If this is an RLS error, add a SELECT policy for admins in Supabase.";
      }
    }
  }

  function unlockDashboard() {
    document.body.classList.add("admin-unlocked");
    if (gate) gate.hidden = true;
    refreshDashboard();
  }

  function passcodeFromQuery() {
    var params = new URLSearchParams(window.location.search);
    return params.get("code") || "";
  }

  function initGate() {
    if (!gateForm || !gateInput) {
      unlockDashboard();
      return;
    }

    var queryCode = passcodeFromQuery();
    if (queryCode === ACCESS_CODE) {
      unlockDashboard();
      return;
    }

    gateInput.focus();
    gateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (gateInput.value === ACCESS_CODE) {
        if (gateError) gateError.textContent = "";
        unlockDashboard();
      } else if (gateError) {
        gateError.textContent = "Incorrect code.";
      }
    });
  }

  function initControls() {
    if (refreshBtn) refreshBtn.addEventListener("click", refreshDashboard);
    if (rangeEl) rangeEl.addEventListener("change", refreshDashboard);
    if (adminBookingStatus) adminBookingStatus.addEventListener("change", renderAllBookingsTable);
    if (adminBookingSearch) adminBookingSearch.addEventListener("input", renderAllBookingsTable);
    wireScheduleForms();
    wireScheduleToast();
    initAdminTabs();
    document.addEventListener("nadjae-booking-hours-updated", function () {
      reloadBookCfg();
      renderAdminManualCalendar();
      renderAdminBlockCalendar();
    });
  }

  initControls();
  initGate();
  initBookingDetailPanel();
  initClientProfileModal();
  initEmailPreviewModal();
})();
