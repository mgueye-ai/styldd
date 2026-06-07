/**
 * Booking: catalog-priced styles, custom month calendar + fixed slots (salon TZ),
 * overlap checks via Supabase RPC `get_unavailable_times_for_day`.
 */
(function () {
  const STORAGE_BUCKET = "booking-photos";
  const GCAL = window.__SALON_SITE_GOOGLE_CALENDAR || {};
  const LOCAL_BOOKINGS_KEY = "salon_site_bookings_local";
  const MIN_ONLINE_PAYMENT_CENTS = 50;
  const BOOKING_NOTICE_KEY = "salon_site_booking_notice";
  const DETAILS_BOOKING_KEY = "salon_site_details_booking_id";

  const DT = window.luxon && window.luxon.DateTime ? window.luxon.DateTime : null;
  if (!DT) {
    console.error("Luxon is required for salon timezone scheduling (see booking.html).");
  }

  const CFG = Object.assign(
    {
      salonTimeZone: "America/New_York",
      salonPhoneDisplay: "(555) 010-0199",
      salonPhoneTel: "+15550100199",
      slotDayStartHour: 8,
      slotDayStartMinute: 0,
      slotDayEndHour: 19,
      slotDayEndMinute: 30,
      slotStepMinutes: 30,
      saturdayLastStartHour: 14,
      saturdayLastStartMinute: 0,
      sameDayLeadMinutes: 30,
      concurrentAppointmentCapacity: 2,
      closedWeekdays: [],
      blackoutRanges: [],
      googleMapsApiKey: null,
    },
    window.__SALON_SITE_BOOKING || {},
  );

  let googleMapsLoadPromise = null;

  /** Old lookbook ?style= slugs → catalog row ids */
  const STYLE_ALIASES = {
    "boho-bob-knotless": "studio-boho-md",
    "boho-knotless-box": "studio-boho-lg",
    "curly-knotless-boho-full": "studio-boho-lg",
    "goddess-knotless": "studio-knotless-md",
    "passion-havana": "studio-passion-md",
    "soft-locs-faux": "studio-locs-half-up",
    "straight-braid-ends": "studio-knotless-lg",
    fulanipassiontwists: "studio-fulani-passion-twists",
    fulaniquickweave: "studio-wig-fulani-quickweave",
  };

  const TENANT_BOOKING = window.__STYLD_TENANT_BOOKING__ || null;

  const PAYMENT = Object.assign(
    {
      mode: "deposit",
      depositKind: "percent",
      depositValue: 10,
      requireCurrentHairPhoto: true,
      requireReferencePhoto: false,
    },
    CFG.payment || {},
  );

  const USE_LEGACY_DEPOSIT_RULES = !TENANT_BOOKING && !CFG.payment;

  function catalogStyles() {
    if (TENANT_BOOKING && Array.isArray(TENANT_BOOKING.styles) && TENANT_BOOKING.styles.length) {
      return TENANT_BOOKING.styles.concat([
        { id: "other", name: "Other / custom quote (price TBD)", base: 0 },
      ]);
    }
    return STYLES;
  }

  const STYLES = [
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

  /** Must match booking lookup / reschedule minimum (calendar days). */
  const BOOKING_LEAD_DAYS = 3;

  /** Minutes from first bookable slot start through scheduled closing (house calls block the full window). */
  function fullSalonDayMinutes() {
    const start = CFG.slotDayStartHour * 60 + CFG.slotDayStartMinute;
    const lastSlotStart = CFG.slotDayEndHour * 60 + CFG.slotDayEndMinute;
    const longestScheduledStyleMin = 300;
    return Math.max(120, lastSlotStart - start + longestScheduledStyleMin);
  }

  function isHouseStyleId(styleId) {
    return !!styleId && styleId.indexOf("house-") === 0;
  }

  /** Extra length add-ons: enabled when style id matches keywords in booking.js — adjust ids or logic when you rename services. */
  function styleSupportsExtraHairLength(styleId) {
    if (!styleId || styleId === "other") return false;
    const s = String(styleId).toLowerCase();
    if (s.includes("knotless")) return true;
    if (s.includes("boho")) return true;
    if (s.includes("fulani")) return true;
    if (s.includes("feedin") || s.includes("cornrows")) return true;
    return false;
  }

  /**
   * Fixed service durations (minutes) per boss pricing — studio, house, and kids menus use the same family rules.
   * House-call rows override with fullSalonDayMinutes() so the entire working day is blocked.
   */
  function baseDurationMinutesForStyle(styleId) {
    if (!styleId || styleId === "other") return 90;
    if (isHouseStyleId(styleId)) return fullSalonDayMinutes();
    if (styleId.includes("knotless")) return 180;
    if (styleId.includes("boho")) return 300;
    if (styleId.includes("passion")) return 300;
    if (styleId.includes("wig")) return 120;
    if (styleId.includes("natural")) return 60;
    if (styleId.includes("locs")) return 120;
    if (styleId.includes("fulani") || styleId.includes("lemonade")) return 240;
    if (styleId.includes("feedin")) return 180;
    return 180;
  }

  /** @type {{ start: number, end: number, label: string }[]} */
  let cachedUnavailable = [];
  /** Dates (YYYY-MM-DD) that already have at least one booking — used for house-call calendar rule. */
  let datesWithBookings = new Set();
  let pollTimer = null;
  let viewYear;
  let viewMonth;
  let selectedIsoDate = null;
  let selectedSlotIso = null;
  let stripeCardElement = null;
  let stripeElementsMounted = false;
  let pendingBookingId = "";

  const els = {
    form: document.getElementById("booking-form"),
    styleSelect: document.getElementById("style-select"),
    hairLength: document.getElementById("hair-length-select"),
    subtotalOut: document.getElementById("line-subtotal"),
    lengthAddonOut: document.getElementById("line-length-addon"),
    totalOut: document.getElementById("line-total"),
    depositOut: document.getElementById("line-deposit"),
    depositDetailOut: document.getElementById("line-deposit-detail"),
    sideSubtotal: document.getElementById("side-subtotal"),
    sideLengthAddon: document.getElementById("side-length-addon"),
    sideTotal: document.getElementById("side-total"),
    sideDeposit: document.getElementById("side-deposit"),
    paymentBox: document.getElementById("payment-section"),
    photoHair: document.getElementById("photo-hair"),
    photoRef: document.getElementById("photo-ref"),
    photoHairPreview: document.getElementById("photo-hair-preview"),
    photoRefPreview: document.getElementById("photo-ref-preview"),
    feedback: document.getElementById("booking-feedback"),
    durationStrip: document.getElementById("duration-strip"),
    calMonthLabel: document.getElementById("booking-cal-month-label"),
    calPrev: document.getElementById("booking-cal-prev"),
    calNext: document.getElementById("booking-cal-next"),
    calWeekdays: document.getElementById("booking-cal-weekdays"),
    calGrid: document.getElementById("booking-cal-grid"),
    calSelectedLine: document.getElementById("booking-cal-selected-line"),
    slotsWrap: document.getElementById("time-slots-container"),
    styleGate: document.getElementById("style-gate-alert"),
    slotsSection: document.getElementById("slots-panel"),
    hiddenAppt: document.getElementById("appointment-starts-at"),
    hiddenDur: document.getElementById("duration-minutes-input"),
    hairLengthWrap: document.getElementById("hair-length-field-wrap"),
    houseAddressWrap: document.getElementById("house-address-field-wrap"),
    houseAddrStreet: document.getElementById("house-addr-street"),
    houseAddrUnit: document.getElementById("house-addr-unit"),
    houseAddrCity: document.getElementById("house-addr-city"),
    houseAddrState: document.getElementById("house-addr-state"),
    houseAddrZip: document.getElementById("house-addr-zip"),
    depositNoteStudio: document.getElementById("deposit-note-studio"),
    depositNoteHouseCall: document.getElementById("deposit-note-house-call"),
    depositNoteInPerson: document.getElementById("deposit-note-in-person"),
    depositPolicyAlert: document.getElementById("deposit-policy-alert"),
    sideDepositNote: document.getElementById("side-deposit-note"),
    lineOnlineLabel: document.getElementById("line-online-label"),
    sideOnlineLabel: document.getElementById("side-online-label"),
    submitBtn: document.getElementById("booking-submit-btn"),
  };

  function getBookingSubdomain() {
    var t = window.__STYLD_TENANT_BOOKING__;
    return t && t.subdomain ? String(t.subdomain).trim().toLowerCase() : "";
  }

  function setStripeCardError(message) {
    var el = document.getElementById("stripe-card-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function clearStripePaymentState() {
    setStripeCardError("");
  }

  function trimAddr(el) {
    return (el && el.value && String(el.value).trim()) || "";
  }

  function clearHouseAddressFields() {
    [els.houseAddrStreet, els.houseAddrUnit, els.houseAddrCity, els.houseAddrState, els.houseAddrZip].forEach((el) => {
      if (el) el.value = "";
    });
  }

  function isHouseAddressComplete() {
    const street = trimAddr(els.houseAddrStreet);
    const city = trimAddr(els.houseAddrCity);
    const state = trimAddr(els.houseAddrState).toUpperCase();
    const zipRaw = trimAddr(els.houseAddrZip).replace(/\s/g, "");
    if (!street || !city || !state || !zipRaw) return false;
    if (!/^[A-Z]{2}$/.test(state)) return false;
    if (!/^\d{5}(-\d{4})?$/.test(zipRaw)) return false;
    return true;
  }

  function formatServiceAddressForStorage() {
    const street = trimAddr(els.houseAddrStreet);
    const unit = trimAddr(els.houseAddrUnit);
    const city = trimAddr(els.houseAddrCity);
    const state = trimAddr(els.houseAddrState).toUpperCase();
    const zip = trimAddr(els.houseAddrZip).replace(/\s/g, "");
    const line1 = unit ? `${street}, ${unit}` : street;
    return `${line1}\n${city}, ${state} ${zip}`;
  }

  function applyGoogleAddressComponents(comps) {
    let streetNum = "";
    let route = "";
    let sub = "";
    let city = "";
    let state = "";
    let zip = "";
    let zip4 = "";
    for (const c of comps) {
      const t = c.types;
      if (t.includes("street_number")) streetNum = c.long_name;
      if (t.includes("route")) route = c.long_name;
      if (t.includes("subpremise")) sub = c.long_name;
      if (t.includes("administrative_area_level_1")) state = c.short_name;
      if (t.includes("postal_code")) zip = c.long_name;
      if (t.includes("postal_code_suffix")) zip4 = c.long_name;
    }
    for (const c of comps) {
      if (c.types.includes("locality")) {
        city = c.long_name;
        break;
      }
    }
    if (!city) {
      for (const c of comps) {
        const t = c.types;
        if (t.includes("sublocality") || t.includes("neighborhood")) {
          city = c.long_name;
          break;
        }
      }
    }
    if (zip && zip4) zip = `${zip}-${zip4}`;
    const street = [streetNum, route].filter(Boolean).join(" ").trim();
    if (els.houseAddrStreet) els.houseAddrStreet.value = street;
    if (els.houseAddrUnit) els.houseAddrUnit.value = sub;
    if (els.houseAddrCity) els.houseAddrCity.value = city;
    if (els.houseAddrState) els.houseAddrState.value = (state || "").toUpperCase().slice(0, 2);
    if (els.houseAddrZip) els.houseAddrZip.value = zip;
    void renderPricing();
  }

  function loadGoogleMapsScript() {
    if (window.google?.maps?.places) return Promise.resolve();
    const key = CFG.googleMapsApiKey;
    if (!key) return Promise.reject(new Error("no Google Maps API key"));
    if (googleMapsLoadPromise) return googleMapsLoadPromise;
    googleMapsLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.dataset.salonSiteMaps = "1";
      s.async = true;
      s.defer = true;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
      s.onload = () => resolve();
      s.onerror = () => {
        googleMapsLoadPromise = null;
        reject(new Error("maps script failed"));
      };
      document.head.appendChild(s);
    });
    return googleMapsLoadPromise;
  }

  function attachPlacesAutocomplete() {
    const input = els.houseAddrStreet;
    if (!input || !window.google?.maps?.places || input.dataset.salonSiteAc === "1") return;
    input.dataset.salonSiteAc = "1";
    const ac = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "us" },
      fields: ["address_components"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place && place.address_components) {
        applyGoogleAddressComponents(place.address_components);
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });
  }

  function initHouseAddressUI() {
    const hint = document.getElementById("house-addr-maps-hint");
    if (hint) hint.hidden = !!CFG.googleMapsApiKey;
    if (els.houseAddrState) {
      els.houseAddrState.addEventListener("input", () => {
        const v = (els.houseAddrState.value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
        els.houseAddrState.value = v;
      });
    }
    if (CFG.googleMapsApiKey) {
      loadGoogleMapsScript()
        .then(() => {
          attachPlacesAutocomplete();
        })
        .catch(() => {
          /* suggestions unavailable; manual entry still works */
        });
    }
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function populateStyles() {
    if (!els.styleSelect) return;
    els.styleSelect.innerHTML =
      '<option value="">Choose a style</option>' +
      catalogStyles().map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  }

  function getSelectedStyle() {
    const opt = els.styleSelect?.selectedOptions[0];
    if (!opt || !opt.value) return null;
    const def = catalogStyles().find((s) => s.id === opt.value);
    const base = def && Number.isFinite(def.base) ? def.base : 0;
    return { id: opt.value, name: opt.textContent, base };
  }

  function getHairLengthKey() {
    const style = getSelectedStyle();
    if (!style || !styleSupportsExtraHairLength(style.id)) return "";
    const v = (els.hairLength?.value || "").trim();
    if (v === "lower-back" || v === "butt" || v === "knee") return v;
    return "";
  }

  function syncBookingDependentFields() {
    const style = getSelectedStyle();
    const sid = style?.id || "";

    const showLen = styleSupportsExtraHairLength(sid);
    if (els.hairLengthWrap) els.hairLengthWrap.hidden = !showLen;
    if (!showLen && els.hairLength) els.hairLength.value = "";

    const showAddr = !!sid && isHouseStyleId(sid);
    if (els.houseAddressWrap) els.houseAddressWrap.hidden = !showAddr;
    if (!showAddr) clearHouseAddressFields();

    renderPricing();
  }

  function hairLengthAddonUsd() {
    const k = getHairLengthKey();
    if (k === "lower-back") return 15;
    if (k === "butt") return 25;
    if (k === "knee") return 35;
    return 0;
  }

  function hairLengthExtraMinutes() {
    const k = getHairLengthKey();
    if (k === "lower-back") return 30;
    if (k === "butt") return 60;
    if (k === "knee") return 90;
    return 0;
  }

  function durationMinutesForStyle(style) {
    if (!style || style.id === "other") return null;
    if (style.id && isHouseStyleId(style.id)) return fullSalonDayMinutes();
    if (typeof style.durationMinutes === "number" && style.durationMinutes > 0) {
      return style.durationMinutes;
    }
    if (style.id) return baseDurationMinutesForStyle(style.id);
    return 90;
  }

  function totalDurationMinutes() {
    const style = getSelectedStyle();
    if (!style || style.id === "other") return null;
    return Math.max(30, durationMinutesForStyle(style) + hairLengthExtraMinutes());
  }

  function formatDurationHuman(mins) {
    if (mins == null) return "TBD";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function nowZoned() {
    return DT.now().setZone(CFG.salonTimeZone);
  }

  function parseIsoDateLocal(isoDate) {
    const [y, mo, d] = isoDate.split("-").map(Number);
    return DT.fromObject({ year: y, month: mo, day: d }, { zone: CFG.salonTimeZone });
  }

  /** Online bookings/reschedules must be at least BOOKING_LEAD_DAYS full calendar days after today. */
  function isCalendarDayBlockedByLeadDays(isoDate) {
    const today = nowZoned().startOf("day");
    const day = parseIsoDateLocal(isoDate).startOf("day");
    const earliest = today.plus({ days: BOOKING_LEAD_DAYS });
    return day < earliest;
  }

  function isPastCalendarDay(isoDate) {
    const today = nowZoned().startOf("day");
    const d = parseIsoDateLocal(isoDate).startOf("day");
    return d < today;
  }

  function isBlackedOut(isoDate) {
    const d = parseIsoDateLocal(isoDate).startOf("day");
    for (const r of CFG.blackoutRanges || []) {
      if (!r || !r.start || !r.end) continue;
      const a = parseIsoDateLocal(r.start).startOf("day");
      const b = parseIsoDateLocal(r.end).startOf("day");
      if (d >= a && d <= b) return true;
    }
    return false;
  }

  function isClosedWeekday(isoDate) {
    const closed = Array.isArray(CFG.closedWeekdays) ? CFG.closedWeekdays : [];
    if (!closed.length) return false;
    const dow = parseIsoDateLocal(isoDate).weekday % 7;
    return closed.includes(dow);
  }

  function calendarDayDisabledReason(isoDate) {
    if (isPastCalendarDay(isoDate)) return "Past dates cannot be booked.";
    if (isClosedWeekday(isoDate)) return "Closed this day.";
    if (isBlackedOut(isoDate)) return "Unavailable this week.";
    if (isCalendarDayBlockedByLeadDays(isoDate))
      return `Appointments require at least ${BOOKING_LEAD_DAYS} full days advance notice.`;
    const selStyle = getSelectedStyle();
    if (selStyle && isHouseStyleId(selStyle.id) && datesWithBookings.has(isoDate))
      return "House calls are only available on days with no other bookings.";
    return null;
  }

  function visibleGridIsoRange() {
    const { cells } = monthMatrix(viewYear, viewMonth);
    const first = cells[0].toFormat("yyyy-MM-dd");
    const last = cells[41].toFormat("yyyy-MM-dd");
    return { p_start: first, p_end: last };
  }

  async function refreshBookingDatesOccupied() {
    const style = getSelectedStyle();
    if (!style || !isHouseStyleId(style.id)) {
      datesWithBookings = new Set();
      return;
    }
    const sb = window.salonSupabaseClient;
    if (!sb) return;
    const range = visibleGridIsoRange();
    const rpcName = TENANT_BOOKING?.subdomain
      ? "styld_tenant_booking_dates_in_range"
      : "booking_dates_in_range";
    const rpcArgs = TENANT_BOOKING?.subdomain
      ? { p_subdomain: TENANT_BOOKING.subdomain, p_start: range.p_start, p_end: range.p_end }
      : { p_start: range.p_start, p_end: range.p_end };
    const { data, error } = await sb.rpc(rpcName, rpcArgs);
    if (error) {
      console.warn("booking_dates_in_range", error);
      return;
    }
    const arr = Array.isArray(data) ? data : [];
    datesWithBookings = new Set(arr.map(String));
  }

  function monthMatrix(year, monthIndex0) {
    const first = DT.fromObject({ year, month: monthIndex0 + 1, day: 1 }, { zone: CFG.salonTimeZone });
    const startDow = first.weekday % 7;
    const gridStart = first.minus({ days: startDow });
    const cells = [];
    let cur = gridStart;
    for (let i = 0; i < 42; i++) {
      cells.push(cur);
      cur = cur.plus({ days: 1 });
    }
    return { cells, monthStart: first };
  }

  function renderCalendar() {
    if (!els.calGrid || !DT) return;
    const { cells, monthStart } = monthMatrix(viewYear, viewMonth);
    if (els.calMonthLabel) {
      els.calMonthLabel.textContent = monthStart.toFormat("LLLL yyyy");
    }
    const today = nowZoned().startOf("day");
    const selDay = selectedIsoDate ? parseIsoDateLocal(selectedIsoDate).startOf("day") : null;

    els.calGrid.innerHTML = "";
    for (const c of cells) {
      const iso = c.toFormat("yyyy-MM-dd");
      const inMonth = c.month - 1 === viewMonth;
      const isToday = c.startOf("day").equals(today);
      const reason = calendarDayDisabledReason(iso);
      const disabled = !!reason;
      const selected = selDay && c.startOf("day").equals(selDay);

      const btn = document.createElement("button");
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
        btn.addEventListener("click", () => selectDate(iso));
      }
      els.calGrid.appendChild(btn);
    }
  }

  function updateSelectedDateLine() {
    if (!els.calSelectedLine) return;
    const dur = totalDurationMinutes();
    const style = getSelectedStyle();
    if (!selectedIsoDate) {
      els.calSelectedLine.textContent = "Selected Date: —";
      return;
    }
    const d = parseIsoDateLocal(selectedIsoDate);
    let line =
      "Selected Date: " +
      d.toFormat("cccc, LLLL d, yyyy");
    if (selectedSlotIso && dur && style && style.id !== "other") {
      const start = DT.fromISO(selectedSlotIso, { zone: CFG.salonTimeZone });
      const end = start.plus({ minutes: dur });
      line +=
        " · " + start.toFormat("h:mm a") + " – " + end.toFormat("h:mm a");
    }
    els.calSelectedLine.textContent = line;
  }

  function selectDate(isoDate) {
    selectedIsoDate = isoDate;
    selectedSlotIso = null;
    if (els.hiddenAppt) {
      els.hiddenAppt.value = "";
      els.hiddenAppt.dispatchEvent(new Event("change", { bubbles: true }));
    }
    renderCalendar();
    updateSelectedDateLine();
    renderSlots();
    void refreshUnavailableForSelection();
  }

  function intervalsOverlap(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
  }

  function isoBusyIntervals(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((x) => {
        const start = x.start ?? x.Start;
        const end = x.end ?? x.End;
        if (!start || !end) return null;
        const s = new Date(String(start)).getTime();
        const e = new Date(String(end)).getTime();
        if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
        const kind = x.kind ?? x.type ?? "booking";
        return { start: s, end: e, isBlock: kind === "block" };
      })
      .filter(Boolean);
  }

  async function fetchUnavailableIntervals(dateIso) {
    const sb = window.salonSupabaseClient;
    if (!sb || !dateIso) return [];
    const rpcName = TENANT_BOOKING?.subdomain
      ? "styld_tenant_get_unavailable_times_for_day"
      : "get_unavailable_times_for_day";
    const rpcArgs = TENANT_BOOKING?.subdomain
      ? { p_subdomain: TENANT_BOOKING.subdomain, p_date: dateIso }
      : { p_date: dateIso };
    const { data, error } = await sb.rpc(rpcName, rpcArgs);
    if (error) {
      console.warn("get_unavailable_times_for_day", error);
      return [];
    }
    return isoBusyIntervals(data);
  }

  async function refreshUnavailableForSelection() {
    if (!selectedIsoDate || !getSelectedStyle() || getSelectedStyle().id === "other") {
      cachedUnavailable = [];
      return;
    }
    cachedUnavailable = await fetchUnavailableIntervals(selectedIsoDate);
    renderSlots();
  }

  function slotInstantOnDay(isoDate, hour, minute) {
    const [y, mo, d] = isoDate.split("-").map(Number);
    return DT.fromObject({ year: y, month: mo, day: d, hour, minute, second: 0, millisecond: 0 }, {
      zone: CFG.salonTimeZone,
    });
  }

  function saturdayCutoff(isoDate) {
    const [y, mo, d] = isoDate.split("-").map(Number);
    return DT.fromObject(
      {
        year: y,
        month: mo,
        day: d,
        hour: CFG.saturdayLastStartHour,
        minute: CFG.saturdayLastStartMinute,
        second: 0,
        millisecond: 0,
      },
      { zone: CFG.salonTimeZone },
    );
  }

  function generateSlotTimes(isoDate) {
    const slots = [];
    const step = CFG.slotStepMinutes;
    let t = slotInstantOnDay(isoDate, CFG.slotDayStartHour, CFG.slotDayStartMinute);
    const endLimit = slotInstantOnDay(isoDate, CFG.slotDayEndHour, CFG.slotDayEndMinute);
    const isSat = parseIsoDateLocal(isoDate).weekday === 6;
    const satCut = isSat ? saturdayCutoff(isoDate) : null;

    while (t <= endLimit) {
      if (isSat && t >= satCut) break;
      slots.push(t);
      t = t.plus({ minutes: step });
    }
    return slots;
  }

  function overlapCount(candidateStartMs, candidateEndMs) {
    let n = 0;
    for (const u of cachedUnavailable) {
      if (!intervalsOverlap(candidateStartMs, candidateEndMs, u.start, u.end)) continue;
      if (u.isBlock) return Math.max(1, CFG.concurrentAppointmentCapacity || 1);
      n++;
    }
    return n;
  }

  function classifySlot(slotStart, durationMin) {
    const startMs = slotStart.toMillis();
    const endMs = slotStart.plus({ minutes: durationMin }).toMillis();
    const nowMs = Date.now();
    const isSat = slotStart.weekday === 6;
    const satClose = saturdayCutoff(slotStart.toFormat("yyyy-MM-dd"));
    if (isSat) {
      if (slotStart >= satClose)
        return { kind: "full", reason: "Saturday appointments cannot start at or after 2:00 PM." };
      const endDt = slotStart.plus({ minutes: durationMin });
      if (endDt > satClose)
        return { kind: "full", reason: "Service would extend past closing (2:00 PM Saturday)." };
    }
    const today = nowZoned().startOf("day");
    if (slotStart.startOf("day").equals(today) && startMs < nowMs + CFG.sameDayLeadMinutes * 60 * 1000) {
      return { kind: "full", reason: "Too soon — allow at least 30 minutes lead time today." };
    }

    const cap = Math.max(1, CFG.concurrentAppointmentCapacity | 0);
    const overlaps = overlapCount(startMs, endMs);
    if (overlaps >= cap) return { kind: "full", reason: "Fully booked." };
    if (overlaps === cap - 1 && cap > 1) return { kind: "limited", reason: "Limited — one seat left for this window." };
    return { kind: "open", reason: "" };
  }

  function renderSlots() {
    if (!els.slotsWrap) return;
    els.slotsWrap.innerHTML = "";
    const style = getSelectedStyle();
    const dur = totalDurationMinutes();

    if (!style || style.id === "other") {
      if (els.styleGate) els.styleGate.hidden = false;
      return;
    }
    if (els.styleGate) els.styleGate.hidden = true;

    if (!selectedIsoDate || dur == null) {
      els.slotsWrap.innerHTML =
        '<p class="booking-slots-placeholder">Pick a date on the calendar to load times.</p>';
      return;
    }

    const slots = generateSlotTimes(selectedIsoDate);
    const selMs =
      selectedSlotIso && DT.fromISO(selectedSlotIso).isValid ? DT.fromISO(selectedSlotIso).toMillis() : null;
    for (const st of slots) {
      const cls = classifySlot(st, dur);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot";
      btn.textContent = st.toFormat("h:mm a");
      if (cls.kind === "open") btn.classList.add("time-slot--open");
      else if (cls.kind === "limited") btn.classList.add("time-slot--limited");
      else btn.classList.add("time-slot--full");

      if (cls.kind === "full") {
        btn.disabled = true;
        btn.title = cls.reason || "";
      } else {
        btn.addEventListener("click", () => {
          selectedSlotIso = st.toISO();
          if (els.hiddenAppt) {
            els.hiddenAppt.value = selectedSlotIso;
            els.hiddenAppt.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (els.hiddenDur) {
            els.hiddenDur.value = String(dur);
            els.hiddenDur.dispatchEvent(new Event("change", { bubbles: true }));
          }
          updateSelectedDateLine();
          renderSlots();
          renderPricing();
        });
      }

      if (selMs != null && Math.abs(st.toMillis() - selMs) < 500) {
        btn.classList.add("selected");
      }

      els.slotsWrap.appendChild(btn);
    }
  }

  // Styld service fee grossup: customer pays this on top so the stylist gets their full amount.
  // Matches the backend formula in stripe-booking-pay.
  const STYLD_PLATFORM_RATE = 0.01; // 1% gross-up → ~$1.50 profit on $150, covers Stripe fees
  function computeServiceFee(depositDollars) {
    if (!depositDollars || depositDollars <= 0) return 0;
    const amountCents = Math.round(depositDollars * 100);
    const chargeAmount = Math.round((amountCents * (1 + STYLD_PLATFORM_RATE) + 30) / (1 - 0.029));
    return round2((chargeAmount - amountCents) / 100);
  }
  function totalChargeWithFee(depositDollars) {
    if (!depositDollars || depositDollars <= 0) return 0;
    return round2(depositDollars + computeServiceFee(depositDollars));
  }

  function onlineChargeForTotal(total, style) {
    const mode = PAYMENT.mode || "deposit";
    if (mode === "in_person") return 0;
    if (mode === "full") return round2(total);

    let amount;
    if (PAYMENT.depositKind === "fixed") {
      amount = round2(Number(PAYMENT.depositValue) || 0);
    } else {
      const pct = Math.min(100, Math.max(0, Number(PAYMENT.depositValue) || 10));
      amount = round2(total * (pct / 100));
    }

    if (USE_LEGACY_DEPOSIT_RULES && style && isHouseStyleId(style.id)) {
      amount = round2(amount + 15);
    }

    return round2(Math.min(total, amount));
  }

  function paymentMode() {
    return PAYMENT.mode || "deposit";
  }

  function wantsOnlinePayment() {
    const { deposit, mode } = computeTotals();
    if (mode === "in_person") return false;
    const cents = Math.round(Number(deposit || 0) * 100);
    return cents >= MIN_ONLINE_PAYMENT_CENTS;
  }

  function needsOnlinePayment() {
    return wantsOnlinePayment() && !!window.__STYLD_STRIPE_READY__;
  }

  function merchantPaymentsNotReady() {
    return wantsOnlinePayment() && !window.__STYLD_STRIPE_READY__;
  }

  function computeTotals() {
    const style = getSelectedStyle();
    const base = style ? style.base : 0;
    const lengthUsd = hairLengthAddonUsd();

    const total = Math.max(0, round2(base + lengthUsd));
    const pctDeposit = round2(total * 0.1);
    const houseFee = style && isHouseStyleId(style.id) ? 15 : 0;
    const deposit = onlineChargeForTotal(total, style);
    const balanceDue = round2(Math.max(0, total - deposit));

    return {
      base,
      lengthUsd,
      subtotal: base,
      total,
      deposit,
      balanceDue,
      pctDeposit,
      houseFee,
      style,
      mode: paymentMode(),
    };
  }

  function renderPricing() {
    const { base, lengthUsd, total, deposit, balanceDue, pctDeposit, houseFee, style, mode } = computeTotals();
    const dur = totalDurationMinutes();
    const online = needsOnlinePayment();
    const hasPricedStyle = !!(style && style.id !== "other");
    const isHouseBooking = houseFee > 0 && USE_LEGACY_DEPOSIT_RULES;

    if (els.durationStrip) {
      if (!style || style.id === "other") {
        els.durationStrip.textContent = "ESTIMATED DURATION TBD";
      } else {
        els.durationStrip.textContent = "ESTIMATED DURATION: " + formatDurationHuman(dur);
      }
    }

    if (els.subtotalOut) els.subtotalOut.textContent = money(base);
    if (els.lengthAddonOut) els.lengthAddonOut.textContent = lengthUsd > 0 ? money(lengthUsd) : "—";
    if (els.totalOut) els.totalOut.textContent = money(total);
    if (els.depositOut) {
      if (mode === "in_person") {
        els.depositOut.textContent = "$0.00";
      } else {
        const fee = computeServiceFee(deposit);
        const chargeTotal = totalChargeWithFee(deposit);
        els.depositOut.textContent = money(chargeTotal);
        // Show fee breakdown beneath if a style is selected
        if (hasPricedStyle && fee > 0) {
          els.depositOut.title = `${money(deposit)} + ${money(fee)} service fee`;
        }
      }
    }

    const onlineLabel =
      mode === "full"
        ? "Due when booking (full price):"
        : mode === "in_person"
          ? "Due when booking:"
          : "Deposit due when booking:";
    if (els.lineOnlineLabel) els.lineOnlineLabel.textContent = onlineLabel;
    if (els.sideOnlineLabel) {
      els.sideOnlineLabel.textContent =
        mode === "full" ? "Due when booking" : mode === "in_person" ? "Due when booking" : "Deposit due";
    }

    if (els.depositDetailOut) {
      const serviceFee = mode !== "in_person" ? computeServiceFee(deposit) : 0;
      const feeNote = serviceFee > 0 ? ` Includes ${money(serviceFee)} service fee.` : "";
      if (!hasPricedStyle) {
        els.depositDetailOut.textContent = "";
      } else if (mode === "in_person") {
        els.depositDetailOut.textContent =
          balanceDue > 0
            ? `Estimated total ${money(total)} — pay in person at your appointment.`
            : "";
      } else if (mode === "full") {
        els.depositDetailOut.textContent =
          `Pay ${money(totalChargeWithFee(deposit))} online to secure your appointment (includes ${money(serviceFee)} service fee). Final price may be adjusted after consultation.`;
      } else if (USE_LEGACY_DEPOSIT_RULES && isHouseBooking) {
        let detail = `Includes ${money(pctDeposit)} (10% of your estimate) plus ${money(15)} house-call deposit.${feeNote} `;
        detail += `Remaining balance ${money(balanceDue)} due in person at your appointment. All deposits are non-refundable.`;
        els.depositDetailOut.textContent = detail;
      } else if (PAYMENT.depositKind === "fixed") {
        els.depositDetailOut.textContent =
          `${money(totalChargeWithFee(deposit))} due now (includes ${money(serviceFee)} service fee). Remaining balance ${money(balanceDue)} due in person at your appointment.`;
      } else {
        const pct = Math.min(100, Math.max(0, Number(PAYMENT.depositValue) || 10));
        els.depositDetailOut.textContent =
          `${money(totalChargeWithFee(deposit))} due now — ${money(deposit)} deposit (${pct}% of estimate) + ${money(serviceFee)} service fee. Remaining balance ${money(balanceDue)} due at appointment.`;
      }
    }

    if (els.sideSubtotal) els.sideSubtotal.textContent = money(base);
    if (els.sideLengthAddon) els.sideLengthAddon.textContent = lengthUsd > 0 ? money(lengthUsd) : "—";
    if (els.sideTotal) els.sideTotal.textContent = money(total);
    if (els.sideDeposit) {
      els.sideDeposit.textContent = mode === "in_person" ? "$0.00" : money(deposit);
    }

    if (els.depositNoteInPerson) {
      els.depositNoteInPerson.hidden = !hasPricedStyle || mode !== "in_person";
    }
    if (els.depositNoteStudio) {
      els.depositNoteStudio.hidden = !hasPricedStyle || mode !== "deposit" || isHouseBooking;
    }
    if (els.depositNoteHouseCall) {
      els.depositNoteHouseCall.hidden = !hasPricedStyle || !isHouseBooking;
    }

    if (els.depositPolicyAlert) {
      if (!hasPricedStyle) {
        els.depositPolicyAlert.textContent =
          mode === "in_person"
            ? "Final price may be adjusted after consultation. Pay in person at your appointment."
            : "Final price may be adjusted after consultation.";
      } else if (mode === "in_person") {
        els.depositPolicyAlert.textContent =
          `No online payment required. Estimated total ${money(total)} — pay in person when you arrive.`;
      } else if (mode === "full") {
        els.depositPolicyAlert.textContent =
          "Full payment online secures your appointment. Final price may be adjusted after consultation.";
      } else if (isHouseBooking) {
        els.depositPolicyAlert.textContent =
          "Deposits are non-refundable (including style portion and house-call deposit). Balance due in person at your appointment.";
      } else {
        els.depositPolicyAlert.textContent =
          `Deposit due online now; remaining balance ${money(balanceDue)} due in person at your appointment. Deposits are non-refundable.`;
      }
    }

    if (els.sideDepositNote) {
      if (mode === "in_person") {
        els.sideDepositNote.textContent = "Pay in person at your appointment.";
      } else if (mode === "full") {
        els.sideDepositNote.textContent = "Full price charged when you book.";
      } else if (isHouseBooking) {
        els.sideDepositNote.textContent =
          "10% style deposit plus $15 for house calls. Balance due in person.";
      } else {
        els.sideDepositNote.textContent = `Balance ${money(balanceDue)} due in person at your appointment.`;
      }
    }

    const complete = isFormCompleteForBooking();
    const paymentsBlocked = merchantPaymentsNotReady();
    const showPayment = complete && online;
    if (els.paymentBox) {
      els.paymentBox.classList.toggle("hidden", !showPayment && !paymentsBlocked);
      els.paymentBox.setAttribute(
        "aria-hidden",
        showPayment || paymentsBlocked ? "false" : "true",
      );
    }

    var paymentsBlockedEl = document.getElementById("payments-not-ready");
    if (!paymentsBlockedEl && els.paymentBox) {
      paymentsBlockedEl = document.createElement("p");
      paymentsBlockedEl.id = "payments-not-ready";
      paymentsBlockedEl.className = "booking-feedback booking-feedback--error";
      paymentsBlockedEl.hidden = true;
      els.paymentBox.insertBefore(paymentsBlockedEl, els.paymentBox.firstChild?.nextSibling || null);
    }
    if (paymentsBlockedEl) {
      paymentsBlockedEl.hidden = !paymentsBlocked;
      paymentsBlockedEl.textContent = paymentsBlocked
        ? "Online payments are not active for this business yet. The owner must connect a payment account in the Styld app (Profile → Payments), or you can contact them to book another way."
        : "";
    }

    const cardTrust = document.getElementById("payment-card-trust");
    if (cardTrust) {
      cardTrust.hidden = !showPayment;
      cardTrust.textContent = showPayment
        ? mode === "full"
          ? "Pay the full estimated price securely with your card."
          : "Pay your deposit securely with your card."
        : "";
    }

    const depOut = document.getElementById("pay-deposit-preview");
    if (depOut) depOut.textContent = mode === "in_person" ? "$0.00" : money(deposit);

    if (els.submitBtn) {
      els.submitBtn.textContent = online
        ? mode === "full"
          ? "Pay full price & book"
          : "Pay deposit & book"
        : "Book appointment";
    }

    if (!showPayment) {
      clearStripePaymentState();
      if (!complete) pendingBookingId = "";
    } else {
      initStripeCardElement();
    }
  }

  function applyBookingFormOptions() {
    const requireHair = PAYMENT.requireCurrentHairPhoto !== false;
    const requireRef = PAYMENT.requireReferencePhoto === true;
    const hairLabel = document.querySelector('label[for="photo-hair"]');
    const refLabel = document.querySelector('label[for="photo-ref"]');

    if (els.photoHair) {
      if (requireHair) els.photoHair.setAttribute("required", "");
      else els.photoHair.removeAttribute("required");
    }
    if (hairLabel) {
      hairLabel.textContent = requireHair ? "Current hair photo *" : "Current hair photo (optional)";
    }

    if (els.photoRef) {
      if (requireRef) els.photoRef.setAttribute("required", "");
      else els.photoRef.removeAttribute("required");
    }
    if (refLabel) {
      refLabel.textContent = requireRef ? "Reference image *" : "Reference image (optional)";
    }
  }

  function isFormCompleteForBooking() {
    const style = getSelectedStyle();
    const name = document.getElementById("full-name")?.value?.trim();
    const phone = document.getElementById("phone")?.value?.trim();
    const email = document.getElementById("email")?.value?.trim();
    const photoHairOk = PAYMENT.requireCurrentHairPhoto === false || els.photoHair?.files?.length > 0;
    const photoRefOk = !PAYMENT.requireReferencePhoto || els.photoRef?.files?.length > 0;
    const slotOk = !!(els.hiddenAppt?.value && style && style.id !== "other");
    const needHouseAddr = !!(style && isHouseStyleId(style.id));
    const addrOk = !needHouseAddr || isHouseAddressComplete();
    return !!(
      style &&
      style.id !== "other" &&
      name &&
      phone &&
      email &&
      photoHairOk &&
      photoRefOk &&
      slotOk &&
      addrOk
    );
  }

  function initStripeCardElement() {
    const stripe = window.__STYLD_STRIPE__;
    if (!stripe || stripeElementsMounted) return;

    const container = document.getElementById("stripe-card-element");
    if (!container) return;

    const elements = stripe.elements();
    stripeCardElement = elements.create("card", {
      style: {
        base: {
          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
          fontSize: "16px",
          color: "#1a1a1a",
          "::placeholder": { color: "#aab7c4" },
        },
        invalid: { color: "#e53e3e" },
      },
    });
    stripeCardElement.mount(container);
    stripeCardElement.on("change", function (event) {
      setStripeCardError(event.error ? event.error.message : "");
    });
    stripeElementsMounted = true;
  }

  async function payBookingWithStripe(sb, payload) {
    const stripe = window.__STYLD_STRIPE__;
    if (!stripe || !stripeCardElement) {
      return { ok: false, error: "Card form not ready. Please refresh and try again." };
    }

    // Step 1: Create a PaymentIntent on the backend (returns clientSecret).
    // The backend routes the charge to the site owner's connected account.
    const { data: piData, error: piError } = await sb.functions.invoke("stripe-booking-pay", {
      body: {
        amountCents: payload.amountCents,
        subdomain: payload.subdomain,
        bookingId: payload.bookingId,
        customerEmail: payload.customerEmail,
        customerName: payload.customerName,
      },
    });

    if (piError) {
      var piDetail = piError.message || "Payment setup failed";
      try {
        if (piError.context && typeof piError.context.json === "function") {
          var pj = await piError.context.json();
          if (pj && typeof pj.error === "string") piDetail = pj.error;
        }
      } catch (_) { /* ignore */ }
      return { ok: false, error: piDetail };
    }

    if (!piData || piData.error || !piData.clientSecret) {
      return { ok: false, error: (piData && piData.error) || "Payment setup failed." };
    }

    // Step 2: Confirm the payment client-side using the card element.
    // This creates and attaches the PaymentMethod in one step, avoiding
    // any mismatch between the PM owner and the account being charged.
    var confirmResult = await stripe.confirmCardPayment(piData.clientSecret, {
      payment_method: {
        card: stripeCardElement,
        billing_details: {
          name: payload.customerName || "",
          email: payload.customerEmail || "",
        },
      },
    });

    if (confirmResult.error) {
      return { ok: false, error: confirmResult.error.message || "Card was declined." };
    }

    var intent = confirmResult.paymentIntent;
    var success = intent && intent.status === "succeeded";

    // Mark the booking as paid in the DB before redirecting.
    // Must be awaited — fire-and-forget gets cancelled when the page navigates away.
    if (success && intent.id && payload.bookingId && payload.subdomain) {
      try {
        await sb.functions.invoke("stripe-booking-confirm", {
          body: {
            bookingId: payload.bookingId,
            subdomain: payload.subdomain,
            paymentIntentId: intent.id,
          },
        });
      } catch (e) {
        console.warn("stripe-booking-confirm:", e);
      }
    }

    return { ok: !!success, paymentId: intent && intent.id, status: intent && intent.status };
  }

  function buildBookingDetailsUrl(params) {
    const url = new URL("booking-details.html", window.location.href);
    if (params instanceof URLSearchParams) {
      url.search = params.toString();
    }
    return url.href;
  }

  function buildBookingSuccessUrl(params) {
    const url = new URL("booking-success.html", window.location.href);
    if (params instanceof URLSearchParams) {
      url.search = params.toString();
    }
    return url.href;
  }

  async function invokeNotifySalon(sb, body) {
    try {
      const { error } = await sb.functions.invoke("notify-salon", { body });
      if (error) console.warn("notify-salon:", error);
    } catch (err) {
      console.warn("notify-salon:", err);
    }
  }

  function setBookingFeedback(message, kind) {
    const el = els.feedback;
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.remove("booking-feedback--error", "booking-feedback--success");
    if (message && kind === "error") el.classList.add("booking-feedback--error");
    if (message && kind === "success") el.classList.add("booking-feedback--success");
  }

  function readPaidReturnParams() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("paid") !== "1") return;
    const bookingId = (p.get("booking_id") || "").trim();
    if (!bookingId) return;
    try {
      sessionStorage.setItem(DETAILS_BOOKING_KEY, bookingId);
    } catch (_) {
      /* ignore */
    }
    const q = new URLSearchParams();
    q.set("booking_id", bookingId);
    q.set("paid", "1");
    window.location.replace(buildBookingDetailsUrl(q));
  }

  function sanitizeFilename(name) {
    const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    return base || "upload";
  }

  function saveLocalBooking(row) {
    try {
      const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? list : [];
      next.unshift({
        ...row,
        id: row.id || crypto.randomUUID(),
        created_at: row.created_at || new Date().toISOString(),
      });
      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(next.slice(0, 500)));
    } catch (e) {
      console.warn("Local booking save failed:", e);
    }
  }

  async function uploadBookingFiles(sb, bookingId, hairFile, refFile) {
    const out = { photo_hair_path: null, photo_ref_path: null };
    if (!hairFile) return out;

    const uploadOne = async (file, kind) => {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const safeBase = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
      const path = `${bookingId}/${kind}-${safeBase}${ext}`;
      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw error;
      return path;
    };

    out.photo_hair_path = await uploadOne(hairFile, "hair");
    if (refFile) out.photo_ref_path = await uploadOne(refFile, "ref");
    return out;
  }

  function appointmentSlotLabelFromIso(iso) {
    if (!iso || !DT) return "";
    const t = DT.fromISO(iso, { zone: CFG.salonTimeZone });
    return t.toFormat("h:mm a");
  }

  function appointmentDateFromIso(iso) {
    if (!iso || !DT) return "";
    return DT.fromISO(iso, { zone: CFG.salonTimeZone }).toFormat("yyyy-MM-dd");
  }

  function buildRowPayload(bookingId, paths, apptIso, durationMinutes, unitPaymentId) {
    const style = getSelectedStyle();
    const notes = document.getElementById("notes")?.value?.trim() || null;
    const { total, deposit, mode } = computeTotals();
    const payInPerson = mode === "in_person";

    const hk = getHairLengthKey();
    const hairLenLabel =
      hk === ""
        ? "Standard (menu length)"
        : els.hairLength?.selectedOptions?.[0]?.textContent?.trim() || hk;

    const service_address =
      style && isHouseStyleId(style.id) && isHouseAddressComplete() ? formatServiceAddressForStorage() : null;

    return {
      id: bookingId,
      full_name: document.getElementById("full-name")?.value?.trim(),
      phone: document.getElementById("phone")?.value?.trim(),
      email: document.getElementById("email")?.value?.trim(),
      style_id: style.id,
      style_name: style.name,
      hair_length: hairLenLabel,
      service_address,
      hair_option: "catalog",
      prewash: "None",
      appointment_date: appointmentDateFromIso(apptIso),
      appointment_slot: appointmentSlotLabelFromIso(apptIso),
      appointment_starts_at: apptIso,
      duration_minutes: durationMinutes,
      booking_status: payInPerson ? "confirmed" : "pending_payment",
      notes,
      promo_code: null,
      estimated_total: total,
      deposit_amount: payInPerson ? 0 : deposit,
      payment_status: payInPerson ? "in_person" : "pending",
      source: "website",
      google_calendar_id: GCAL.calendarId || null,
      pricing_situation: "catalog",
      unit_payment_id: unitPaymentId || null,
      ...paths,
    };
  }

  async function submitBookingRequest(sb, apptIso, durationMinutes, bookingId, unitPaymentId) {
    const style = getSelectedStyle();
    if (!style || style.id === "other") throw new Error("Choose a priced style to book.");
    const hairFile = els.photoHair?.files?.[0];
    const refFile = els.photoRef?.files?.[0] || null;

    let paths = { photo_hair_path: null, photo_ref_path: null };
    try {
      paths = await uploadBookingFiles(sb, bookingId, hairFile, refFile);
    } catch (uploadErr) {
      console.warn(uploadErr);
      throw new Error(
        "Your hair photo could not be uploaded. Please check your connection and try again.",
      );
    }

    const row = buildRowPayload(bookingId, paths, apptIso, durationMinutes, unitPaymentId);

    if (TENANT_BOOKING?.subdomain) {
      const { data: tenantId, error: tenantErr } = await sb.rpc("styld_tenant_insert_booking", {
        p_subdomain: TENANT_BOOKING.subdomain,
        p_booking: row,
      });
      if (tenantErr) {
        // Surface conflict errors clearly — the server detected a double-booking
        const msg = tenantErr.message || "";
        if (msg.includes("no longer available") || msg.includes("blocked")) {
          throw new Error(msg);
        }
        throw tenantErr;
      }
      const id = tenantId || row.id;
      if (!id) throw new Error("No booking id returned");
      return { id, paths };
    }

    const { data, error } = await sb.from("bookings").insert(row).select("id").single();
    if (error) throw error;
    const id = data?.id;
    if (!id) throw new Error("No booking id returned");
    return { id, paths };
  }

  function bindFilePreview(input, previewEl) {
    if (!input || !previewEl) return;
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      previewEl.textContent = f ? `Selected: ${f.name}` : "";
      renderPricing();
    });
  }

  function bindForm() {
    [
      els.hairLength,
      document.getElementById("full-name"),
      document.getElementById("phone"),
      document.getElementById("email"),
      els.houseAddrStreet,
      els.houseAddrUnit,
      els.houseAddrCity,
      els.houseAddrState,
      els.houseAddrZip,
    ]
      .filter(Boolean)
      .forEach((el) => {
        el.addEventListener("input", () => {
          renderPricing();
          renderSlots();
          void refreshUnavailableForSelection();
        });
        el.addEventListener("change", () => {
          renderPricing();
          renderSlots();
          void refreshUnavailableForSelection();
        });
      });

    if (els.styleSelect) {
      const onStyleFields = () => {
        syncBookingDependentFields();
        renderSlots();
        void refreshUnavailableForSelection();
      };
      els.styleSelect.addEventListener("input", onStyleFields);
      els.styleSelect.addEventListener("change", () => {
        onStyleFields();
        void refreshBookingDatesOccupied().then(() => {
          const st = getSelectedStyle();
          if (
            selectedIsoDate &&
            st &&
            isHouseStyleId(st.id) &&
            datesWithBookings.has(selectedIsoDate)
          ) {
            selectedIsoDate = null;
            selectedSlotIso = null;
            if (els.hiddenAppt) els.hiddenAppt.value = "";
          }
          renderCalendar();
          updateSelectedDateLine();
        });
      });
    }

    if (els.calPrev) els.calPrev.addEventListener("click", () => navigateMonth(-1));
    if (els.calNext) els.calNext.addEventListener("click", () => navigateMonth(1));

    if (els.form) {
      els.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setBookingFeedback("", null);

        const apptIso = els.hiddenAppt?.value?.trim();
        const durStr = els.hiddenDur?.value?.trim();
        let durationMinutes = durStr ? parseInt(durStr, 10) : totalDurationMinutes();
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) durationMinutes = totalDurationMinutes();

        if (!isFormCompleteForBooking() || !apptIso) {
          const st = getSelectedStyle();
          if (st && isHouseStyleId(st.id) && !isHouseAddressComplete()) {
            alert(
              "House-call bookings need a full address: street, city, state (2 letters), and ZIP. Please complete each field.",
            );
            return;
          }
          alert("Please complete all required fields, choose a style, upload any required photos, and select an available time slot.");
          return;
        }

        const sb = window.salonSupabaseClient;
        const submitBtn = els.form.querySelector('button[type="submit"]');

        if (!sb) {
          setBookingFeedback("Supabase is required to save your appointment.", "error");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = "Sending…";
        }

        try {
          if (merchantPaymentsNotReady()) {
            throw new Error(
              "Online payments are not set up for this business yet. Ask the owner to connect payments in the Styld app.",
            );
          }

          const online = needsOnlinePayment();
          const bookingId = pendingBookingId || crypto.randomUUID();
          pendingBookingId = bookingId;

          const { id, paths } = await submitBookingRequest(sb, apptIso, durationMinutes, bookingId, null);
          if (!id) throw new Error("Could not save booking id.");

          if (!online) {
            void invokeNotifySalon(sb, { booking_id: bookingId });
            // Send confirmation email for in-person bookings
            void sb.functions.invoke("booking-client-email", {
              body: { bookingId, subdomain: getBookingSubdomain() },
            }).catch(function(e) { console.warn("booking-client-email:", e); });
            saveLocalBooking({
              ...buildRowPayload(bookingId, paths, apptIso, durationMinutes, null),
              created_at: new Date().toISOString(),
              source: "website",
            });
            try {
              sessionStorage.setItem(DETAILS_BOOKING_KEY, bookingId);
              sessionStorage.removeItem(BOOKING_NOTICE_KEY);
            } catch (_) {
              /* ignore */
            }
            const detailsQ = new URLSearchParams();
            detailsQ.set("booking_id", bookingId);
            window.location.assign(buildBookingSuccessUrl(detailsQ));
            return;
          }

          if (submitBtn) submitBtn.textContent = "Processing payment…";

          const { deposit } = computeTotals();
          const amountCents = Math.round(Number(deposit || 0) * 100);
          const subdomain = getBookingSubdomain();
          const nameEl = document.getElementById("full-name");
          const emailEl = document.getElementById("email");
          const payResult = await payBookingWithStripe(sb, {
            subdomain,
            bookingId,
            amountCents,
            customerName: (nameEl && nameEl.value && nameEl.value.trim()) || "",
            customerEmail: (emailEl && emailEl.value && emailEl.value.trim()) || "",
          });

          if (!payResult.ok) {
            setStripeCardError(payResult.error || "Payment failed.");
            throw new Error(payResult.error || "Payment failed.");
          }

          void invokeNotifySalon(sb, { booking_id: bookingId });
          saveLocalBooking({
            ...buildRowPayload(bookingId, paths, apptIso, durationMinutes, payResult.paymentId || null),
            created_at: new Date().toISOString(),
            source: "website",
            payment_status: "deposit_paid",
          });

          try {
            sessionStorage.setItem(DETAILS_BOOKING_KEY, bookingId);
            sessionStorage.removeItem(BOOKING_NOTICE_KEY);
          } catch (_) {
            /* ignore */
          }

          const successQ = new URLSearchParams();
          successQ.set("booking_id", bookingId);
          successQ.set("paid", "1");
          window.location.assign(buildBookingSuccessUrl(successQ));
          return;
        } catch (err) {
          console.error(err);
          const msg =
            err && typeof err === "object" && "message" in err && err.message
              ? String(err.message)
              : String(err || "Unknown error");

          // If the slot was just taken by someone else, refresh the slot picker
          // so it disappears and the customer can pick another time.
          if (msg.includes("no longer available") || msg.includes("blocked")) {
            pendingBookingId = null;
            void refreshUnavailableForSelection().then(() => renderSlots());
            setBookingFeedback(msg, "error");
          } else {
            const hint = msg.includes("not configured")
              ? " The business owner must finish payment setup."
              : "";
            setBookingFeedback(`Could not complete your booking. ${msg}${hint}`, "error");
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              submitBtn.dataset.originalText || (needsOnlinePayment() ? "Confirm payment" : "Book appointment");
          }
        }
      });
    }
  }

  function navigateMonth(delta) {
    const d = DT.fromObject({ year: viewYear, month: viewMonth + 1, day: 1 }, { zone: CFG.salonTimeZone }).plus({
      months: delta,
    });
    viewYear = d.year;
    viewMonth = d.month - 1;
    void refreshBookingDatesOccupied().then(() => {
      renderCalendar();
      void refreshUnavailableForSelection();
    });
  }

  function initCalendarNav() {
    const n = nowZoned();
    viewYear = n.year;
    viewMonth = n.month - 1;
    void refreshBookingDatesOccupied().then(() => {
      renderCalendar();
      updateSelectedDateLine();
    });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = window.setInterval(
      () => {
        void refreshUnavailableForSelection();
      },
      60 * 1000,
    );
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && selectedIsoDate) {
        void refreshUnavailableForSelection();
      }
    });
  }

  readPaidReturnParams();
  populateStyles();

  const presetRaw = new URLSearchParams(window.location.search).get("style");
  const preset = presetRaw ? STYLE_ALIASES[presetRaw] || presetRaw : "";
  if (preset && els.styleSelect) {
    const hasOption = Array.from(els.styleSelect.options).some((o) => o.value === preset);
    if (hasOption) els.styleSelect.value = preset;
  }

  applyBookingFormOptions();
  bindFilePreview(els.photoHair, els.photoHairPreview);
  bindFilePreview(els.photoRef, els.photoRefPreview);
  bindForm();
  initHouseAddressUI();

  if (DT) {
    initCalendarNav();
    startPolling();
  }

  syncBookingDependentFields();
  renderSlots();

  (function supabaseHint() {
    var hint = document.getElementById("booking-supabase-hint");
    if (hint && !window.salonSupabaseClient) hint.removeAttribute("hidden");
  })();

  (function syncBannerPhones() {
    var tel = CFG.salonPhoneTel || "";
    var disp = CFG.salonPhoneDisplay || tel;
    var hrefTel = tel.replace(/[^\d+]/g, "");
    document.querySelectorAll(".booking-footer-phone").forEach(function (el) {
      el.href = "tel:" + hrefTel;
      el.textContent = disp;
    });
  })();
})();






