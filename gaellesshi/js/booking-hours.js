/**
 * Salon working hours — loaded from Supabase `hairbynadjae_site` (booking_hours).
 * Merges into `window.__NADJAE_BOOKING` for booking + admin calendars.
 */
(function () {
  var SETTING_KEY = "booking_hours";

  var DEFAULT_HOURS = {
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
    publicHoursText: "Monday–Sunday: 8:00 AM – 7:30 PM",
  };

  var WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function clampInt(n, min, max, fallback) {
    var v = typeof n === "number" ? n : parseInt(String(n), 10);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(v)));
  }

  function sanitizeHours(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var o = raw;
    var out = {
      slotDayStartHour: clampInt(o.slotDayStartHour, 0, 23, DEFAULT_HOURS.slotDayStartHour),
      slotDayStartMinute: clampInt(o.slotDayStartMinute, 0, 59, DEFAULT_HOURS.slotDayStartMinute),
      slotDayEndHour: clampInt(o.slotDayEndHour, 0, 23, DEFAULT_HOURS.slotDayEndHour),
      slotDayEndMinute: clampInt(o.slotDayEndMinute, 0, 59, DEFAULT_HOURS.slotDayEndMinute),
      slotStepMinutes: clampInt(o.slotStepMinutes, 15, 120, DEFAULT_HOURS.slotStepMinutes),
      saturdayLastStartHour: clampInt(o.saturdayLastStartHour, 0, 23, DEFAULT_HOURS.saturdayLastStartHour),
      saturdayLastStartMinute: clampInt(o.saturdayLastStartMinute, 0, 59, DEFAULT_HOURS.saturdayLastStartMinute),
      sameDayLeadMinutes: clampInt(o.sameDayLeadMinutes, 0, 360, DEFAULT_HOURS.sameDayLeadMinutes),
      concurrentAppointmentCapacity: clampInt(
        o.concurrentAppointmentCapacity,
        1,
        6,
        DEFAULT_HOURS.concurrentAppointmentCapacity,
      ),
      closedWeekdays: [],
      publicHoursText:
        o.publicHoursText != null && String(o.publicHoursText).trim()
          ? String(o.publicHoursText).trim().slice(0, 500)
          : DEFAULT_HOURS.publicHoursText,
    };
    if (Array.isArray(o.closedWeekdays)) {
      o.closedWeekdays.forEach(function (d) {
        var n = clampInt(d, 0, 6, -1);
        if (n >= 0 && out.closedWeekdays.indexOf(n) < 0) out.closedWeekdays.push(n);
      });
      out.closedWeekdays.sort();
    }
    var startM = out.slotDayStartHour * 60 + out.slotDayStartMinute;
    var endM = out.slotDayEndHour * 60 + out.slotDayEndMinute;
    if (endM <= startM) return null;
    var satM = out.saturdayLastStartHour * 60 + out.saturdayLastStartMinute;
    if (satM < startM || satM > endM) return null;
    return out;
  }

  function mergeIntoBookingConfig(hours) {
    var clean = sanitizeHours(hours) || DEFAULT_HOURS;
    window.__NADJAE_BOOKING = Object.assign({}, window.__NADJAE_BOOKING || {}, clean);
    return clean;
  }

  function formatTime12(hour, minute) {
    var h = clampInt(hour, 0, 23, 0);
    var m = clampInt(minute, 0, 59, 0);
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + String(m).padStart(2, "0") + " " + ap;
  }

  function applyPublicHoursDom(text) {
    document.querySelectorAll("[data-nadjae-public-hours]").forEach(function (el) {
      el.textContent = text || DEFAULT_HOURS.publicHoursText;
    });
  }

  function dispatchUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("nadjae-booking-hours-updated"));
    } catch (_) {
      /* ignore */
    }
  }

  function fetchRemoteBookingHours() {
    var SITE = window.__NADJAE_SITE_DATA;
    if (SITE && typeof SITE.fetchSiteSettingValue === "function") {
      return SITE.fetchSiteSettingValue(SETTING_KEY).then(function (val) {
        var merged = mergeIntoBookingConfig(val);
        applyPublicHoursDom(merged.publicHoursText);
        dispatchUpdated();
        return merged;
      });
    }
    mergeIntoBookingConfig(DEFAULT_HOURS);
    applyPublicHoursDom(DEFAULT_HOURS.publicHoursText);
    return Promise.resolve(DEFAULT_HOURS);
  }

  /** Luxon weekday (1=Mon … 7=Sun) → JS getDay (0=Sun … 6=Sat) */
  function jsWeekdayFromLuxon(luxonWeekday) {
    return luxonWeekday === 7 ? 0 : luxonWeekday;
  }

  function isClosedWeekdayJs(jsDay, cfg) {
    var closed = (cfg && cfg.closedWeekdays) || [];
    return closed.indexOf(jsDay) >= 0;
  }

  function closedWeekdayLabel(jsDay) {
    return WEEKDAY_LABELS[jsDay] || "This day";
  }

  window.__NADJAE_BOOKING_HOURS = {
    settingKey: SETTING_KEY,
    defaults: DEFAULT_HOURS,
    weekdayLabels: WEEKDAY_LABELS,
    getDefaults: function () {
      return Object.assign({}, DEFAULT_HOURS);
    },
    sanitizeHours: sanitizeHours,
    mergeIntoBookingConfig: mergeIntoBookingConfig,
    fetchRemoteBookingHours: fetchRemoteBookingHours,
    applyPublicHoursDom: applyPublicHoursDom,
    formatTime12: formatTime12,
    jsWeekdayFromLuxon: jsWeekdayFromLuxon,
    isClosedWeekdayJs: isClosedWeekdayJs,
    closedWeekdayLabel: closedWeekdayLabel,
  };

  mergeIntoBookingConfig(DEFAULT_HOURS);
  void fetchRemoteBookingHours();
})();
