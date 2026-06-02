/** Copy to `booking-config.local.js` (untracked) to override salon booking defaults. */
window.__NADJAE_BOOKING = Object.assign({}, window.__NADJAE_BOOKING || {}, {
  salonPhoneDisplay: "(860) 822-7448",
  salonPhoneTel: "+18608227448",
  blackoutRanges: [],
  // googleMapsApiKey: "YOUR_BROWSER_RESTRICTED_KEY",
});
