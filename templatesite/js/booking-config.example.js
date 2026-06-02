/** Copy to `booking-config.local.js` (untracked) to override salon booking defaults. */
window.__SALON_SITE_BOOKING = Object.assign({}, window.__SALON_SITE_BOOKING || {}, {
  salonPhoneDisplay: "(555) 010-0199",
  salonPhoneTel: "+15550100199",
  blackoutRanges: [],
  // googleMapsApiKey: "YOUR_BROWSER_RESTRICTED_KEY",
});
