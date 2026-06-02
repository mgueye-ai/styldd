/**
 * Site booking defaults (override in booking-config.local.js if present).
 * All appointment slot math uses salonTimeZone — not the visitor's browser zone.
 */
window.__SALON_SITE_BOOKING = {
  /** IANA time zone for your business (e.g. America/New_York) */
  salonTimeZone: "America/New_York",
  /** Shown in policy banner + slot footer (E.164 for tel: links) */
  salonPhoneDisplay: "(555) 010-0199",
  salonPhoneTel: "+15550100199",
  /** First slot start (24h clock, salon local) */
  slotDayStartHour: 8,
  slotDayStartMinute: 0,
  /** Last slot start (30-min steps; closes after final appointments — same calendar window through 7:30 PM starts) */
  slotDayEndHour: 19,
  slotDayEndMinute: 30,
  slotStepMinutes: 30,
  /**
   * Saturday: no new appointments starting at or after this hour (salon local).
   * Also rejects slots whose end extends past this cutoff.
   */
  saturdayLastStartHour: 14,
  saturdayLastStartMinute: 0,
  /** Earliest bookable wall time on *today* if booking same calendar day (minutes from now). */
  sameDayLeadMinutes: 30,
  /**
   * Concurrent appointments allowed before a start time is "fully booked".
   * 1 = only green/red; 2 = green/yellow/red (yellow = one overlap).
   */
  concurrentAppointmentCapacity: 2,
  /** Optional ISO date ranges [start,end] inclusive calendar blackout (YYYY-MM-DD), salon-local interpretation */
  blackoutRanges: [],
  /**
   * Optional Google Maps Platform API key (Places + Geocoding).
   * Enables address suggestions on the street field and more reliable “current location” parsing.
   * Restrict the key to your domain and enable Places API + Geocoding API. Leave unset to use basic fields + OSM fallback for location only.
   */
  googleMapsApiKey: null,
};
