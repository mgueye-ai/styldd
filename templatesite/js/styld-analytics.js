/**
 * Styld Analytics — lightweight page view tracker.
 * Fires once per page load, fire-and-forget (never blocks rendering).
 * Sends: subdomain, path, referrer, device type, session ID.
 */
(function () {
  try {
    var cfg = window.__STYLD_TENANT__ || {};
    var supabaseUrl = cfg.supabaseUrl;
    if (!supabaseUrl) return;

    var endpoint = supabaseUrl + '/functions/v1/analytics-ingest';

    // Subdomain: extract from hostname (e.g. "pearson" from "pearson.styldd.com")
    var hostname = window.location.hostname;
    var rootDomain = cfg.rootDomain || 'styldd.com';
    var subdomain = '';
    if (hostname.endsWith('.' + rootDomain)) {
      subdomain = hostname.slice(0, -(rootDomain.length + 1));
    } else if (hostname !== rootDomain && hostname !== 'localhost') {
      // Possibly a custom domain — use full hostname as identifier
      subdomain = hostname;
    }
    if (!subdomain) return;

    // Device type from viewport width (fast, no UA parsing)
    var w = window.innerWidth || 0;
    var device = w <= 480 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';

    // Session ID: persist in sessionStorage so multiple page views in the same
    // browsing session share an ID (allows unique visitor counting)
    var sessionKey = '__styld_sid__';
    var sessionId = '';
    try {
      sessionId = sessionStorage.getItem(sessionKey) || '';
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(sessionKey, sessionId);
      }
    } catch (_) {
      // sessionStorage blocked (private browsing edge cases)
    }

    var payload = JSON.stringify({
      subdomain: subdomain,
      path: window.location.pathname || '/',
      referrer: document.referrer || '',
      device: device,
      sessionId: sessionId,
    });

    // Use sendBeacon if available (survives page unload, no CORS preflight)
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback: async fetch, ignore errors
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    }
  } catch (_) {
    // Never let analytics crash the page
  }
})();
