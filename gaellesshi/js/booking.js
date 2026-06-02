/**
 * Booking: catalog-priced styles, custom month calendar + fixed slots (salon TZ),
 * overlap checks via Supabase RPC `get_unavailable_times_for_day`.
 */
(function () {
  const STORAGE_BUCKET = "booking-photos";
  const GCAL = window.__NADJAE_GOOGLE_CALENDAR || {};
  const LOCAL_BOOKINGS_KEY = "nadjae_bookings_local";
  const STRIPE_RETURN_BOOKING_KEY = "nadjae_stripe_booking_id";
  const BOOKING_NOTICE_KEY = "nadjae_booking_notice";
  const DETAILS_BOOKING_KEY = "nadjae_details_booking_id";

  const DT = window.luxon && window.luxon.DateTime ? window.luxon.DateTime : null;
  if (!DT) {
    console.error("Luxon is required for salon timezone scheduling (see booking.html).");
  }

  function buildCfg() {
    return Object.assign(
      {
        salonTimeZone: "America/New_York",
        salonPhoneDisplay: "(860) 822-7448",
        salonPhoneTel: "+18608227448",
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
      window.__NADJAE_BOOKING || {},
    );
  }

  let CFG = buildCfg();

  function reloadBookingCfg() {
    CFG = buildCfg();
    if (selectedIsoDate) void refreshUnavailableForSelection();
    else {
      renderCalendar();
      renderSlots();
    }
  }

  document.addEventListener("nadjae-booking-hours-updated", reloadBookingCfg);

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

  const SP = window.__NADJAE_STYLE_PRICING;
  if (!SP || typeof SP.getMergedStyles !== "function") {
    console.error("Missing js/style-pricing.js (must load before booking.js).");
    return;
  }

  function stylesList() {
    return SP.getMergedStyles();
  }

  const MIN_STRIPE_DEPOSIT_CENTS = 50;
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

  /** Extra length add-ons apply only to knotless, boho, Fulani, and cornrow families (studio, house, kids). */
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
  let stripeClient = null;
  let stripeElements = null;
  let stripePaymentElement = null;
  let stripeIntentFingerprint = "";
  let pendingBookingId = "";
  let pendingPaymentIntentId = "";

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
    depositPolicyAlert: document.getElementById("deposit-policy-alert"),
    sideDepositNote: document.getElementById("side-deposit-note"),
  };

  document.addEventListener("nadjae-pricing-updated", () => {
    const prev = els.styleSelect?.value || "";
    populateStyles();
    if (prev && els.styleSelect) {
      const has = Array.from(els.styleSelect.options).some((o) => o.value === prev);
      if (has) els.styleSelect.value = prev;
    }
    syncBookingDependentFields();
    renderPricing();
  });

  function setInlinePaymentError(message) {
    var el = document.getElementById("stripe-payment-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function clearEmbeddedPaymentElement() {
    if (stripePaymentElement && typeof stripePaymentElement.unmount === "function") {
      try {
        stripePaymentElement.unmount();
      } catch (_) {
        /* ignore */
      }
    }
    stripePaymentElement = null;
    stripeElements = null;
    stripeIntentFingerprint = "";
    pendingPaymentIntentId = "";
    setInlinePaymentError("");
    var host = document.getElementById("stripe-payment-element");
    if (host) host.innerHTML = "";
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
      s.dataset.nadjaeMaps = "1";
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
    if (!input || !window.google?.maps?.places || input.dataset.nadjaeAc === "1") return;
    input.dataset.nadjaeAc = "1";
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
      stylesList().map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  }

  function getSelectedStyle() {
    const opt = els.styleSelect?.selectedOptions[0];
    if (!opt || !opt.value) return null;
    const def = stylesList().find((s) => s.id === opt.value);
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

  function totalDurationMinutes() {
    const style = getSelectedStyle();
    if (!style || style.id === "other") return null;
    return Math.max(30, baseDurationMinutesForStyle(style.id) + hairLengthExtraMinutes());
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
    const closed = CFG.closedWeekdays || [];
    if (!closed.length) return false;
    const lux = parseIsoDateLocal(isoDate).weekday;
    const jsDay = lux === 7 ? 0 : lux;
    return closed.includes(jsDay);
  }

  function calendarDayDisabledReason(isoDate) {
    if (isPastCalendarDay(isoDate)) return "Past dates cannot be booked.";
    if (isClosedWeekday(isoDate)) {
      const BH = window.__NADJAE_BOOKING_HOURS;
      const lux = parseIsoDateLocal(isoDate).weekday;
      const jsDay = lux === 7 ? 0 : lux;
      const label = BH && BH.closedWeekdayLabel ? BH.closedWeekdayLabel(jsDay) : "This day";
      return `${label} is closed — choose another date.`;
    }
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
    const sb = window.nadjaeSupabaseClient;
    if (!sb) return;
    const range = visibleGridIsoRange();
    const { data, error } = await sb.rpc("booking_dates_in_range", {
      p_start: range.p_start,
      p_end: range.p_end,
    });
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
        return { start: s, end: e };
      })
      .filter(Boolean);
  }

  async function fetchUnavailableIntervals(dateIso) {
    const sb = window.nadjaeSupabaseClient;
    if (!sb || !dateIso) return [];
    const { data, error } = await sb.rpc("get_unavailable_times_for_day", { p_date: dateIso });
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
      if (intervalsOverlap(candidateStartMs, candidateEndMs, u.start, u.end)) n++;
    }
    return n;
  }

  function formatCfgTime12(hour, minute) {
    const BH = window.__NADJAE_BOOKING_HOURS;
    if (BH && typeof BH.formatTime12 === "function") return BH.formatTime12(hour, minute);
    const h = hour % 12 || 12;
    const ap = hour >= 12 ? "PM" : "AM";
    return `${h}:${String(minute).padStart(2, "0")} ${ap}`;
  }

  function classifySlot(slotStart, durationMin) {
    const startMs = slotStart.toMillis();
    const endMs = slotStart.plus({ minutes: durationMin }).toMillis();
    const nowMs = Date.now();
    const isSat = slotStart.weekday === 6;
    const satClose = saturdayCutoff(slotStart.toFormat("yyyy-MM-dd"));
    const satLabel = formatCfgTime12(CFG.saturdayLastStartHour, CFG.saturdayLastStartMinute);
    if (isSat) {
      if (slotStart >= satClose)
        return { kind: "full", reason: `Saturday appointments cannot start at or after ${satLabel}.` };
      const endDt = slotStart.plus({ minutes: durationMin });
      if (endDt > satClose)
        return { kind: "full", reason: `Service would extend past Saturday closing (${satLabel}).` };
    }
    const today = nowZoned().startOf("day");
    if (slotStart.startOf("day").equals(today) && startMs < nowMs + CFG.sameDayLeadMinutes * 60 * 1000) {
      return { kind: "full", reason: `Too soon — allow at least ${CFG.sameDayLeadMinutes} minutes lead time today.` };
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

  function computeTotals() {
    const style = getSelectedStyle();
    const base = style ? style.base : 0;
    const lengthUsd = hairLengthAddonUsd();

    const total = Math.max(0, round2(base + lengthUsd));
    const pctDeposit = round2(total * 0.1);
    const houseFee = style && isHouseStyleId(style.id) ? 15 : 0;
    const deposit = round2(pctDeposit + houseFee);

    return {
      base,
      lengthUsd,
      subtotal: base,
      total,
      deposit,
      pctDeposit,
      houseFee,
      style,
    };
  }

  function renderPricing() {
    const { base, lengthUsd, total, deposit, pctDeposit, houseFee, style } = computeTotals();
    const dur = totalDurationMinutes();

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
    if (els.depositOut) els.depositOut.textContent = money(deposit);
    if (els.depositDetailOut) {
      if (!style || style.id === "other") {
        els.depositDetailOut.textContent = "";
      } else {
        let detail =
          houseFee > 0
            ? `Includes ${money(pctDeposit)} (10% of your estimate) plus ${money(15)} house-call deposit. `
            : `${money(pctDeposit)} is 10% of your estimated total. `;
        detail += "All deposits are non-refundable.";
        els.depositDetailOut.textContent = detail;
      }
    }
    if (els.sideSubtotal) els.sideSubtotal.textContent = money(base);
    if (els.sideLengthAddon) els.sideLengthAddon.textContent = lengthUsd > 0 ? money(lengthUsd) : "—";
    if (els.sideTotal) els.sideTotal.textContent = money(total);
    if (els.sideDeposit) els.sideDeposit.textContent = money(deposit);

    const hasPricedStyle = !!(style && style.id !== "other");
    const isHouseBooking = houseFee > 0;

    if (els.depositNoteStudio) {
      els.depositNoteStudio.hidden = !hasPricedStyle || isHouseBooking;
    }
    if (els.depositNoteHouseCall) {
      els.depositNoteHouseCall.hidden = !hasPricedStyle || !isHouseBooking;
    }

    if (els.depositPolicyAlert) {
      if (!hasPricedStyle) {
        els.depositPolicyAlert.textContent =
          "All deposits are non-refundable. Final price may be adjusted after consultation.";
      } else if (isHouseBooking) {
        els.depositPolicyAlert.textContent =
          "All deposits are non-refundable (including style portion and house-call deposit). Final price may be adjusted after consultation.";
      } else {
        els.depositPolicyAlert.textContent =
          "All deposits are non-refundable. Final price may be adjusted after consultation.";
      }
    }

    if (els.sideDepositNote) {
      if (!hasPricedStyle) {
        els.sideDepositNote.textContent = "All deposits non-refundable.";
      } else if (isHouseBooking) {
        els.sideDepositNote.textContent =
          "10% style deposit plus $15 for house calls. All deposits non-refundable.";
      } else {
        els.sideDepositNote.textContent = "10% style deposit. All deposits non-refundable.";
      }
    }
    const complete = isFormCompleteForPayment();
    if (els.paymentBox) {
      els.paymentBox.classList.toggle("hidden", !complete);
      els.paymentBox.setAttribute("aria-hidden", complete ? "false" : "true");
    }

    const stripeTrust = document.getElementById("payment-stripe-trust");
    if (stripeTrust) {
      stripeTrust.hidden = !complete;
      stripeTrust.textContent = complete
        ? "Enter your card details below, then use the bottom button to confirm payment."
        : "";
    }

    const depOut = document.getElementById("pay-deposit-preview");
    if (depOut) depOut.textContent = money(deposit);

    if (!complete) {
      clearEmbeddedPaymentElement();
      pendingBookingId = "";
    } else {
      void ensureEmbeddedPaymentReady();
    }
  }

  function isFormCompleteForPayment() {
    const style = getSelectedStyle();
    const name = document.getElementById("full-name")?.value?.trim();
    const phone = document.getElementById("phone")?.value?.trim();
    const email = document.getElementById("email")?.value?.trim();
    const photoOk = els.photoHair?.files?.length > 0;
    const slotOk = !!(els.hiddenAppt?.value && style && style.id !== "other");
    const needHouseAddr = !!(style && isHouseStyleId(style.id));
    const addrOk = !needHouseAddr || isHouseAddressComplete();
    return !!(style && style.id !== "other" && name && phone && email && photoOk && slotOk && addrOk);
  }

  function embeddedPaymentFingerprint(bookingId, email, styleId, deposit) {
    return [bookingId, String(email || "").toLowerCase(), styleId || "", Number(deposit || 0).toFixed(2)].join("|");
  }

  async function invokeEmbeddedPaymentIntent(sb, payload) {
    const { data, error } = await sb.functions.invoke("create-checkout-session", {
      body: {
        mode: "embedded",
        booking_id: payload.bookingId,
        email: payload.email,
        style_id: payload.styleId,
        style_name: payload.styleName,
        deposit_amount: payload.deposit,
      },
    });

    if (error) {
      let detail = error.message || "Payment could not be started";
      try {
        if (error.context && typeof error.context.json === "function") {
          const j = await error.context.json();
          if (j && typeof j.error === "string") detail = j.error;
          if (j && typeof j.hint === "string" && j.hint.trim()) detail = `${detail} — ${j.hint.trim()}`;
        }
      } catch (_) {
        /* ignore */
      }
      if (String(detail).includes("booking_id, success_url, and cancel_url are required")) {
        detail =
          "Payment backend is on an older version. Redeploy Supabase function `create-checkout-session`, then refresh this page.";
      }
      return { ok: false, error: detail };
    }

    if (!data || typeof data.client_secret !== "string" || !data.client_secret) {
      return { ok: false, error: "Stripe did not return a payment client secret." };
    }

    return {
      ok: true,
      clientSecret: data.client_secret,
      paymentIntentId: typeof data.payment_intent_id === "string" ? data.payment_intent_id : "",
    };
  }

  async function ensureEmbeddedPaymentReady() {
    const sb = window.nadjaeSupabaseClient;
    const stripeCfg = window.__NADJAE_STRIPE || {};
    const pk = stripeCfg.publishableKey && String(stripeCfg.publishableKey).trim();
    const style = getSelectedStyle();
    const email = (document.getElementById("email")?.value || "").trim();
    const { deposit } = computeTotals();
    const depositCents = Math.round(Number(deposit || 0) * 100);

    if (!sb || !style || style.id === "other" || depositCents < MIN_STRIPE_DEPOSIT_CENTS) return;

    if (!pk) {
      const cfg = window.__NADJAE_STRIPE || {};
      const liveHint = cfg.stripePublishableKeyMissingAtBuild
        ? "Set Vercel environment variable STRIPE_PUBLISHABLE_KEY to your pk_test_… or pk_live_… (same mode as STRIPE_SECRET_KEY in Supabase), then redeploy."
        : "Add your Stripe publishable key: on Vercel use STRIPE_PUBLISHABLE_KEY, or create js/stripe-config.local.js from js/stripe-config.example.js for local testing.";
      setInlinePaymentError(
        "Card form did not load — publishable key is missing. " + liveHint,
      );
      return;
    }

    if (!window.Stripe) {
      setInlinePaymentError("Stripe.js did not load. Check your connection, disable blockers, and refresh.");
      return;
    }

    if (!pendingBookingId) pendingBookingId = crypto.randomUUID();
    const fingerprint = embeddedPaymentFingerprint(pendingBookingId, email, style.id, deposit);
    if (stripeIntentFingerprint === fingerprint && stripePaymentElement) return;

    clearEmbeddedPaymentElement();
    setInlinePaymentError("");

    const intent = await invokeEmbeddedPaymentIntent(sb, {
      bookingId: pendingBookingId,
      email,
      styleId: style.id,
      styleName: style.name,
      deposit,
    });

    if (!intent.ok) {
      setInlinePaymentError(intent.error || "Unable to load secure payment form.");
      return;
    }

    try {
      stripeClient = stripeClient || window.Stripe(pk);
      stripeElements = stripeClient.elements({ clientSecret: intent.clientSecret });
      stripePaymentElement = stripeElements.create("payment");
      stripePaymentElement.mount("#stripe-payment-element");
      pendingPaymentIntentId = intent.paymentIntentId || "";
      stripeIntentFingerprint = fingerprint;
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
      console.error("Stripe Payment Element mount failed:", e);
      clearEmbeddedPaymentElement();
      setInlinePaymentError(
        `Could not start the card form (${msg}). Common fix: use pk_test_… in the site build with sk_test_… in Supabase (or both live) — keys must be the same Stripe mode.`,
      );
    }
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

  function readStripeReturnParams() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("canceled") === "1") {
      setBookingFeedback(
        "Payment canceled. If you already submitted a booking, we still have it — you can try paying the deposit again from the link we email, or contact the salon.",
        "error",
      );
      const style = p.get("style");
      const path = window.location.pathname || "/booking.html";
      window.history.replaceState(
        {},
        "",
        style ? `${path}?style=${encodeURIComponent(style)}` : path,
      );
      return;
    }
    if (p.get("paid") === "1" || p.get("session_id")) {
      let bookingId = (p.get("booking_id") || "").trim();
      if (!bookingId) {
        try {
          bookingId = (sessionStorage.getItem(STRIPE_RETURN_BOOKING_KEY) || "").trim();
        } catch (_) {
          bookingId = "";
        }
      }

      if (bookingId) {
        try {
          sessionStorage.setItem(DETAILS_BOOKING_KEY, bookingId);
        } catch (_) {
          /* ignore */
        }
        const q = new URLSearchParams(window.location.search);
        q.set("booking_id", bookingId);
        q.set("paid", "1");
        window.location.replace(buildBookingDetailsUrl(q));
        return;
      }

      try {
        sessionStorage.removeItem(STRIPE_RETURN_BOOKING_KEY);
      } catch (_) {
        /* ignore */
      }

      const idLine =
        " Save your confirmation email; use Lookup Booking with the same name and email or phone you used here.";
      setBookingFeedback(
        `Deposit received. Thank you — you should get a Stripe receipt by email; we will confirm your appointment shortly.${idLine}`,
        "success",
      );
      const style = p.get("style");
      const path = window.location.pathname || "/booking.html";
      const next = style ? `${path}?style=${encodeURIComponent(style)}` : path;
      window.history.replaceState({}, "", next);
    }
  }

  function sanitizeFilename(name) {
    const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    return base || "upload";
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

  function buildRowPayload(bookingId, paths, apptIso, durationMinutes, stripePaymentIntentId) {
    const style = getSelectedStyle();
    const notes = document.getElementById("notes")?.value?.trim() || null;
    const { total, deposit } = computeTotals();

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
      booking_status: "pending_payment",
      notes,
      promo_code: null,
      estimated_total: total,
      deposit_amount: deposit,
      source: "website",
      google_calendar_id: GCAL.calendarId || null,
      pricing_situation: "catalog",
      stripe_payment_intent_id: stripePaymentIntentId || null,
      ...paths,
    };
  }

  async function submitBookingRequest(sb, apptIso, durationMinutes, bookingId, stripePaymentIntentId) {
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
        "Photos could not be uploaded. Create the Storage bucket and policies in Supabase (see supabase/schema.sql), or try again.",
      );
    }

    const row = buildRowPayload(bookingId, paths, apptIso, durationMinutes, stripePaymentIntentId);

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

        if (!isFormCompleteForPayment() || !apptIso) {
          const st = getSelectedStyle();
          if (st && isHouseStyleId(st.id) && !isHouseAddressComplete()) {
            alert(
              "House-call bookings need a full address: street, city, state (2 letters), and ZIP. Please complete each field.",
            );
            return;
          }
          alert("Please complete all required fields, choose a style, upload your hair photo, and select an available time slot.");
          return;
        }

        const sb = window.nadjaeSupabaseClient;
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
          await ensureEmbeddedPaymentReady();

          const pkCheck = (window.__NADJAE_STRIPE || {}).publishableKey;
          if (!pkCheck || !String(pkCheck).trim()) {
            throw new Error("Stripe publishable key is missing — set STRIPE_PUBLISHABLE_KEY on deploy (pk_test_… or pk_live_…).");
          }

          if (!pendingBookingId || !stripeClient || !stripeElements) {
            throw new Error("Secure payment form is not ready yet. Please wait a moment and try again.");
          }

          const paymentMounted = stripeElements.getElement && stripeElements.getElement("payment");
          if (!paymentMounted) {
            throw new Error(
              "Payment form is still loading. Wait until you see the card fields below, then try again.",
            );
          }

          const bookingId = pendingBookingId;
          const { id, paths } = await submitBookingRequest(
            sb,
            apptIso,
            durationMinutes,
            bookingId,
            pendingPaymentIntentId,
          );
          if (!id) throw new Error("Could not save booking id.");
          // Await so POST finishes: fire-and-forget can abort the request after OPTIONS (no POST in Edge logs).
          await invokeNotifySalon(sb, { booking_id: bookingId });
          // Booking row is persisted in Supabase `bookings` — no localStorage duplicate.
          if (submitBtn) submitBtn.textContent = "Confirming payment…";

          try {
            sessionStorage.setItem(DETAILS_BOOKING_KEY, bookingId);
            sessionStorage.setItem(STRIPE_RETURN_BOOKING_KEY, bookingId);
            sessionStorage.removeItem(BOOKING_NOTICE_KEY);
          } catch (_) {
            /* ignore */
          }

          const successQ = new URLSearchParams();
          successQ.set("booking_id", bookingId);
          successQ.set("paid", "1");
          const returnUrl = buildBookingSuccessUrl(successQ);

          const submitPayment = await stripeElements.submit();
          if (submitPayment.error) {
            throw new Error(submitPayment.error.message || "Please check your payment details and try again.");
          }

          const result = await stripeClient.confirmPayment({
            elements: stripeElements,
            confirmParams: { return_url: returnUrl },
            redirect: "if_required",
          });

          if (result.error) {
            throw new Error(result.error.message || "Payment confirmation failed.");
          }
          if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
            window.location.assign(returnUrl);
            return;
          }
          window.location.assign(returnUrl);
          return;
        } catch (err) {
          console.error(err);
          const msg =
            err && typeof err === "object" && "message" in err && err.message
              ? String(err.message)
              : String(err || "Unknown error");
          setBookingFeedback(
            `Could not save your booking. ${msg}. If this persists, confirm the \`bookings\` table and RLS in Supabase (see supabase/schema.sql).`,
            "error",
          );
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || "Submit booking request";
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
      5 * 60 * 1000,
    );
  }

  readStripeReturnParams();
  populateStyles();

  const presetRaw = new URLSearchParams(window.location.search).get("style");
  const preset = presetRaw ? STYLE_ALIASES[presetRaw] || presetRaw : "";
  if (preset && els.styleSelect) {
    const hasOption = Array.from(els.styleSelect.options).some((o) => o.value === preset);
    if (hasOption) els.styleSelect.value = preset;
  }

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
    if (hint && !window.nadjaeSupabaseClient) hint.removeAttribute("hidden");
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
