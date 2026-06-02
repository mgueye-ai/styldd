/**
 * Admin dashboard for bookings.
 * Access code is UI-only and not secure; use proper auth for production.
 */
(function () {
  var ACCESS_CODE = "0000";
  var LOCAL_BOOKINGS_KEY = "salon_site_bookings_local";
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
  var BOOK_CFG = Object.assign(
    {
      salonTimeZone: "America/New_York",
      blackoutRanges: [],
    },
    window.__SALON_SITE_BOOKING || {},
  );

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

  /** Mirrors `js/booking.js` STYLES (id, name, base) — keep `base` in sync when menu prices change. */
  var ADMIN_BOOKING_STYLES = [
    { id: "studio-knotless-sm", name: "Studio · Your service · Small", base: 155 },
    { id: "studio-knotless-md", name: "Studio · Your service · Medium", base: 110 },
    { id: "studio-knotless-lg", name: "Studio · Your service · Large", base: 95 },
    { id: "studio-passion-sm", name: "Studio · Your service · Smedium", base: 175 },
    { id: "studio-passion-md", name: "Studio · Your service · Medium", base: 135 },
    { id: "studio-wig-install", name: "Studio · Your service · Install & style", base: 120 },
    { id: "studio-wig-pony", name: "Studio · Your service · Ponytail", base: 90 },
    { id: "studio-wig-qw", name: "Studio · Your service · Q/W", base: 100 },
    { id: "studio-wig-fulani-quickweave", name: "Studio · Your service · Your add-on label", base: 110 },
    { id: "studio-natural-2strand", name: "Studio · Your service · 2 strand", base: 50 },
    { id: "studio-natural-cornrows", name: "Studio · Your service · Your option (add-on note)", base: 35 },
    { id: "studio-natural-fulani", name: "Studio · Your service · Your option label", base: 45 },
    { id: "studio-natural-box", name: "Studio · Your service · Your option label", base: 40 },
    { id: "studio-natural-twist", name: "Studio · Your service · Regular twist", base: 35 },
    { id: "studio-boho-sm", name: "Studio · Your service · Smedium", base: 185 },
    { id: "studio-boho-md", name: "Studio · Your service · Medium", base: 135 },
    { id: "studio-boho-lg", name: "Studio · Your service · Large", base: 100 },
    { id: "studio-feedin-2", name: "Studio · Your service · 2", base: 75 },
    { id: "studio-feedin-4", name: "Studio · Your service · 4", base: 85 },
    { id: "studio-feedin-8", name: "Studio · Your service · 8", base: 100 },
    { id: "studio-feedin-10plus", name: "Studio · Your service · 10+", base: 110 },
    { id: "studio-locs-2strand", name: "Studio · Your service · 2 strand", base: 90 },
    { id: "studio-locs-retwist", name: "Studio · Your service · Retwist", base: 70 },
    { id: "studio-locs-barrels", name: "Studio · Your service · Barrels", base: 80 },
    { id: "studio-locs-half-up", name: "Studio · Your service · Half up half down", base: 65 },
    { id: "studio-locs-starter", name: "Studio · Your service · Starter loc", base: 100 },
    { id: "studio-fulani-one", name: "Studio · Your service · One size", base: 155 },
    { id: "studio-fulani-passion-twists", name: "Studio · Your combo service (edit)", base: 165 },
    { id: "house-knotless-sm", name: "House call · Your service · Small", base: 185 },
    { id: "house-knotless-md", name: "House call · Your service · Medium", base: 135 },
    { id: "house-knotless-lg", name: "House call · Your service · Large", base: 110 },
    { id: "house-passion-sm", name: "House call · Your service · Smedium", base: 175 },
    { id: "house-passion-md", name: "House call · Your service · Medium", base: 145 },
    { id: "house-boho-sm", name: "House call · Your service · Smedium", base: 200 },
    { id: "house-boho-md", name: "House call · Your service · Medium", base: 160 },
    { id: "house-boho-lg", name: "House call · Your service · Large", base: 115 },
    { id: "house-feedin-2", name: "House call · Your service · 2", base: 90 },
    { id: "house-feedin-4", name: "House call · Your service · 4", base: 100 },
    { id: "house-feedin-8", name: "House call · Your service · 8", base: 115 },
    { id: "house-feedin-10plus", name: "House call · Your service · 10+", base: 125 },
    { id: "house-fulani-one", name: "House call · Your service · One size", base: 170 },
    { id: "house-fulani-passion-twists", name: "House call · Your combo service (edit)", base: 185 },
    { id: "house-wig-install", name: "House call · Your service · Install & style", base: 135 },
    { id: "house-wig-pony", name: "House call · Your service · Ponytail", base: 100 },
    { id: "house-wig-qw", name: "House call · Your service · Q/W", base: 115 },
    { id: "house-wig-fulani-quickweave", name: "House call · Your service · Your add-on label", base: 125 },
    { id: "kids-knotless-md", name: "Kids (12 & under) · Your service · Medium", base: 110 },
    { id: "kids-knotless-lg", name: "Kids (12 & under) · Your service · Large", base: 85 },
    { id: "kids-passion-sm", name: "Kids (12 & under) · Your service · Smedium", base: 135 },
    { id: "kids-passion-md", name: "Kids (12 & under) · Your service · Medium", base: 115 },
    { id: "kids-natural-2strand", name: "Kids (12 & under) · Your service · 2 strand", base: 40 },
    { id: "kids-natural-cornrows", name: "Kids (12 & under) · Your service · Your option label", base: 25 },
    { id: "kids-natural-box", name: "Kids (12 & under) · Your service · Your option label", base: 40 },
    { id: "kids-natural-twist", name: "Kids (12 & under) · Your service · Regular twist", base: 35 },
    { id: "kids-boho-md", name: "Kids (12 & under) · Your service · Medium", base: 120 },
    { id: "kids-boho-lg", name: "Kids (12 & under) · Your service · Large", base: 100 },
    { id: "kids-feedin-2", name: "Kids (12 & under) · Your service · 2", base: 55 },
    { id: "kids-feedin-4", name: "Kids (12 & under) · Your service · 4", base: 65 },
    { id: "kids-feedin-8", name: "Kids (12 & under) · Your service · 8", base: 90 },
    { id: "kids-feedin-10plus", name: "Kids (12 & under) · Your service · 10+", base: 100 },
    { id: "kids-fulani-one", name: "Kids (12 & under) · Your service · One size", base: 140 },
    { id: "kids-fulani-passion-twists", name: "Kids (12 & under) · Your combo service (edit)", base: 150 },
    { id: "kids-lemonade-one", name: "Kids (12 & under) · Your service · One size", base: 125 },
    { id: "other", name: "Other / custom quote (price TBD)", base: 0 },
  ];

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
    var def = ADMIN_BOOKING_STYLES.find(function (x) {
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
    var start = 8 * 60;
    var lastStart = 19 * 60 + 30;
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
    var sb = window.salonSupabaseClient;
    if (!sb) return [];
    var res = await sb.from("blocked_intervals").select("*").order("starts_at", { ascending: false }).limit(200);
    if (res.error) {
      console.warn("blocked_intervals", res.error);
      return [];
    }
    return res.data || [];
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
    var sb = window.salonSupabaseClient;
    if (!sb) return;
    var res = await sb.from("blocked_intervals").delete().eq("id", id);
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
    var sb = window.salonSupabaseClient;
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
      ADMIN_BOOKING_STYLES.forEach(function (s) {
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
    var sb = window.salonSupabaseClient;
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
    var res = await sb.from("blocked_intervals").insert({
      starts_at: startDt.toISO(),
      ends_at: endDt.toISO(),
      note: note,
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
    var sb = window.salonSupabaseClient;
    if (!sb) {
      setScheduleFeedback("error", "Couldn't add appointment", "Supabase is required.");
      return;
    }
    var styleId = (document.getElementById("admin-manual-style") || {}).value;
    var styleName =
      (ADMIN_BOOKING_STYLES.find(function (x) {
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
    var base = window.__SALON_SITE_SUPABASE && window.__SALON_SITE_SUPABASE.url;
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
        var cfg = window.__SALON_SITE_SUPABASE;
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
    var phone = "(555) 010-0199";
    var base = "https://yoursalon.com";
    var table =
      '<table cellpadding="8" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;font-size:13px;">' +
      "<tr><th align='left'>Time</th><th align='left'>Client</th><th align='left'>Style</th><th align='left'>Location</th></tr>" +
      "<tr><td>9:00 AM</td><td>Sample Client</td><td>Studio · Your service · Medium</td><td>Studio</td></tr>" +
      "<tr><td>1:00 PM</td><td>Alex K.</td><td>House call · Your service · Medium</td><td>Your City, ST</td></tr>" +
      "</table>";
    var snippets = {
      "salon-booking":
        "<p><strong>New online booking</strong></p><ul><li><strong>Booking ID:</strong> " + bookingId + "</li><li><strong>Name:</strong> Sample Client</li><li><strong>Email:</strong> client@example.com</li><li><strong>Style:</strong> Studio · Your service · Medium</li><li><strong>Date:</strong> " + dateLabel + "</li><li><strong>Deposit:</strong> $11.00</li></ul>",
      "customer-confirmation":
        "<p>Hi Alex,</p><p>Thank you for booking with <strong>Your brand name</strong>. We received your request.</p><p><strong>Booking reference:</strong> " + bookingId + "</p><ul><li><strong>Appointment:</strong> " + dateLabel + " at 9:00 AM</li><li><strong>Service:</strong> Studio · Your service · Medium</li><li><strong>Estimated total:</strong> $110.00</li><li><strong>Deposit due:</strong> $11.00</li></ul>",
      "customer-reminder":
        "<p>Hi Alex,</p><p>Reminder: your appointment is coming up in about 24 hours.</p><ul><li><strong>When:</strong> " + dateLabel + " at 9:00 AM</li><li><strong>Service:</strong> Studio · Your service · Medium</li><li><strong>Studio address:</strong> Your City, ST</li></ul>",
      "daily-digest":
        "<p><strong>Daily schedule — " + dateLabel + "</strong></p>" + table,
      "deposit-received":
        "<p>Hi — we received your deposit for your appointment with Your brand name.</p><p><strong>Booking reference:</strong> " + bookingId + "</p><p>Keep this ID for Lookup Booking or changes.</p>",
      "salon-cancelled":
        "<p><strong>Booking cancelled</strong></p><ul><li><strong>Booking ID:</strong> " + bookingId + "</li><li><strong>Client:</strong> Sample Client</li><li><strong>Service:</strong> Studio · Your service · Medium</li><li><strong>Original appointment:</strong> " + dateLabel + " at 9:00 AM</li></ul>",
      "customer-cancelled":
        "<p>Hi Alex,</p><p>Your appointment has been marked as cancelled.</p><ul><li><strong>Booking reference:</strong> " + bookingId + "</li><li><strong>Cancelled appointment:</strong> " + dateLabel + " at 9:00 AM</li></ul>",
      "salon-rescheduled":
        "<p><strong>Booking rescheduled</strong></p><ul><li><strong>Booking ID:</strong> " + bookingId + "</li><li><strong>Client:</strong> Sample Client</li><li><strong>Previous:</strong> Tuesday, May 12, 2026 at 9:00 AM</li><li><strong>New:</strong> Thursday, May 14, 2026 at 1:00 PM</li></ul>",
      "customer-rescheduled":
        "<p>Hi Alex,</p><p>Your appointment has been updated.</p><ul><li><strong>Booking reference:</strong> " + bookingId + "</li><li><strong>Previous appointment:</strong> Tuesday, May 12, 2026 at 9:00 AM</li><li><strong>New appointment:</strong> Thursday, May 14, 2026 at 1:00 PM</li></ul>",
    };
    var inner = snippets[key] || snippets["salon-booking"];
    return (
      "<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/>" +
      "<style>body{margin:0;background:#faf8f4;font-family:Arial,sans-serif;color:#332;} .wrap{max-width:620px;margin:20px auto;background:#fff;border:1px solid #efd9bf;border-radius:14px;overflow:hidden;} .head{padding:18px 18px 12px;border-bottom:1px solid #f0e5d9;text-align:center;} .head img{width:54px;height:54px;border-radius:10px;border:1px solid #f0e5d9;} .head h1{margin:8px 0 0;font-size:24px;font-family:Georgia,serif;} .body{padding:18px;line-height:1.45;font-size:14px;} .body ul{margin:10px 0 0 18px;} .foot{padding:12px 18px;border-top:1px solid #f0e5d9;font-size:12px;color:#7a6e62;}</style></head><body>" +
      "<div class='wrap'><div class='head'><img src='" + base + "/assets/placeholders/logo.svg' alt='logo'/><h1>Your brand name</h1></div><div class='body'>" + inner + "</div><div class='foot'>Visit website · " + phone + "</div></div></body></html>"
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
        if (tab === "schedule") {
          populateScheduleSelects();
          renderBlocksTable();
        }
        if (tab === "calendar") {
          if (!fcCalendar) initFullCalendar();
          else {
            updateFullCalendarEvents();
            fcCalendar.updateSize();
          }
          renderAllBookingsTable();
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
    var sb = window.salonSupabaseClient;
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
    var sb = window.salonSupabaseClient;
    if (!sb) return readLocalBookings();

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

  function readLocalBookings() {
    try {
      var raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.map(normalizeRow);
    } catch (e) {
      return [];
    }
  }

  async function refreshDashboard() {
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) errorEl.hidden = true;

    try {
      var allRows = await fetchBookings();
      cachedRows = allRows;
      var scopedRows = filterByRange(allRows);
      var usingSupabase = !!window.salonSupabaseClient;

      if (loadingEl) {
        loadingEl.hidden = false;
        loadingEl.textContent = usingSupabase
          ? "Loaded live Supabase booking metrics."
          : "Supabase not configured. Showing locally saved bookings on this browser.";
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
  }

  initControls();
  initGate();
  initBookingDetailPanel();
  initClientProfileModal();
  initEmailPreviewModal();
})();
