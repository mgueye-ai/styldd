/**
 * Post-Stripe checkout landing: show booking reference and link to full receipt.
 * Keeps sessionStorage in sync with booking-details.js / booking.js.
 */
(function () {
  var DETAILS_BOOKING_KEY = "nadjae_details_booking_id";

  var els = {
    idCard: document.getElementById("success-id-card"),
    generic: document.getElementById("success-generic"),
    idCode: document.getElementById("success-booking-id"),
    linkDetails: document.getElementById("success-link-details"),
    linkLookup: document.getElementById("success-link-lookup"),
    btnCopy: document.getElementById("success-copy-id"),
  };

  var p = new URLSearchParams(window.location.search);
  var id = (p.get("booking_id") || "").trim();

  function buildDetailsUrl() {
    var u = new URL("booking-details.html", window.location.href);
    u.searchParams.set("booking_id", id);
    u.searchParams.set("paid", "1");
    return u.href;
  }

  function cleanUrlInBar() {
    if (!id) return;
    try {
      var clean = new URL(window.location.href);
      clean.searchParams.set("booking_id", id);
      clean.searchParams.set("paid", "1");
      clean.searchParams.delete("session_id");
      window.history.replaceState({}, "", clean.pathname + clean.search);
    } catch (e) {
      /* ignore */
    }
  }

  if (id) {
    try {
      sessionStorage.setItem(DETAILS_BOOKING_KEY, id);
    } catch (e) {
      /* ignore */
    }
    if (els.idCard) els.idCard.hidden = false;
    if (els.generic) els.generic.hidden = true;
    if (els.idCode) els.idCode.textContent = id;
    if (els.linkDetails) {
      els.linkDetails.href = buildDetailsUrl();
      els.linkDetails.textContent = "View full confirmation";
    }
    if (els.linkLookup) els.linkLookup.hidden = false;
    cleanUrlInBar();
  } else {
    if (els.idCard) els.idCard.hidden = true;
    if (els.generic) els.generic.hidden = false;
    if (els.linkDetails) {
      els.linkDetails.href = "booking-lookup.html";
      els.linkDetails.textContent = "Find my booking";
    }
    if (els.linkLookup) els.linkLookup.hidden = true;
  }

  if (els.btnCopy && els.idCode) {
    els.btnCopy.addEventListener("click", function () {
      var text = els.idCode.textContent || "";
      if (!text) return;
      function ok() {
        var prev = els.btnCopy.textContent;
        els.btnCopy.textContent = "Copied!";
        window.setTimeout(function () {
          els.btnCopy.textContent = prev;
        }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(function () {
          fallbackCopy(text, ok);
        });
      } else {
        fallbackCopy(text, ok);
      }
    });
  }

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      if (done) done();
    } catch (e) {
      /* ignore */
    }
  }
})();
