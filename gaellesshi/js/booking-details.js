/**
 * Confirmation page: load booking by ?booking_id=, optional ?paid=1 after Stripe.
 * "Save as PNG" uses html2canvas on #booking-details-capture (script on booking-details.html).
 */
(function () {
  var LOCAL_BOOKINGS_KEY = "nadjae_bookings_local";
  var BOOKING_NOTICE_KEY = "nadjae_booking_notice";
  /** Must match js/booking.js — used when the confirmation URL arrives without ?booking_id=. */
  var DETAILS_BOOKING_KEY = "nadjae_details_booking_id";
  var STRIPE_RETURN_BOOKING_KEY = "nadjae_stripe_booking_id";

  var resolvedBookingId = "";

  var els = {
    capture: document.getElementById("booking-details-capture"),
    bookingIdCode: document.getElementById("receipt-booking-id"),
    bookingShort: document.getElementById("receipt-booking-short"),
    dlContact: document.getElementById("receipt-dl-contact"),
    dlAppointment: document.getElementById("receipt-dl-appointment"),
    dlService: document.getElementById("receipt-dl-service"),
    dlPayment: document.getElementById("receipt-dl-payment"),
    dlExtra: document.getElementById("receipt-dl-extra"),
    sectionExtra: document.getElementById("receipt-section-extra"),
    statusLine: document.getElementById("receipt-status-line"),
    error: document.getElementById("booking-details-error"),
    errorMsg: document.getElementById("booking-details-error-msg"),
    notice: document.getElementById("booking-details-notice"),
    actions: document.getElementById("booking-details-actions"),
    btnPng: document.getElementById("btn-download-png"),
  };

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
  }

  function formatDate(v) {
    if (!v) return "—";
    var d = new Date(String(v) + "T12:00:00");
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  function formatDateTime(v) {
    if (!v) return "—";
    var d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function readLocalBookings() {
    try {
      var raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function humanPricingSituation(v) {
    var m = {
      catalog: "Menu pricing (styles catalog)",
      "sheet-a": "Situation A",
      "sheet-b": "Situation B",
      "sheet-c": "Situation C",
    };
    return m[v] || v || "—";
  }

  function paymentSummary(row, urlPaid) {
    var s = row.payment_status || "pending";
    if (urlPaid) {
      return "Online deposit submitted through Stripe. Watch your email for a receipt; we will confirm your appointment shortly.";
    }
    if (s === "deposit_paid") {
      return "Deposit recorded as paid. We will confirm your appointment shortly.";
    }
    return "Deposit pending — we will follow up if payment is still needed.";
  }

  function clearDl(dl) {
    while (dl && dl.firstChild) dl.removeChild(dl.firstChild);
  }

  function addRow(dl, label, value) {
    if (!dl) return;
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    var t = value == null || value === "" ? "—" : String(value);
    dd.textContent = t;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  /** Public URL for `booking-photos` bucket — matches js/booking.js uploads. */
  function publicBookingPhotoUrl(path) {
    var base = window.__NADJAE_SUPABASE && window.__NADJAE_SUPABASE.url;
    if (!base || !path) return "";
    return (
      String(base).replace(/\/$/, "") +
      "/storage/v1/object/public/booking-photos/" +
      encodeURI(String(path).replace(/^\/+/, ""))
    );
  }

  function addPhotoRow(dl, label, path) {
    if (!dl || !path) return;
    var url = publicBookingPhotoUrl(path);
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    if (url) {
      dd.innerHTML =
        '<a href="' +
        escapeAttr(url) +
        '" target="_blank" rel="noopener" class="booking-details-photo-link">' +
        '<img src="' +
        escapeAttr(url) +
        '" alt="' +
        escapeAttr(label) +
        '" class="booking-details-photo-thumb" loading="lazy" decoding="async" />' +
        "</a>";
    } else {
      dd.textContent = String(path);
    }
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function humanPaymentStatus(v) {
    var s = String(v || "pending").toLowerCase();
    if (s === "deposit_paid") return "Deposit paid";
    if (s === "pending") return "Awaiting deposit / confirmation";
    return v || "—";
  }

  function renderReceipt(row, urlPaid) {
    if (!els.capture) return;

    if (els.bookingIdCode) els.bookingIdCode.textContent = row.id || "—";
    if (els.bookingShort) {
      var short = row.id ? String(row.id).replace(/-/g, "").slice(0, 8).toUpperCase() : "";
      if (short) {
        els.bookingShort.textContent = "Quick code · " + short;
        els.bookingShort.hidden = false;
      } else {
        els.bookingShort.textContent = "";
        els.bookingShort.hidden = true;
      }
    }

    clearDl(els.dlContact);
    clearDl(els.dlAppointment);
    clearDl(els.dlService);
    clearDl(els.dlPayment);
    clearDl(els.dlExtra);

    if (els.statusLine) {
      els.statusLine.textContent = paymentSummary(row, urlPaid);
      var ok = urlPaid || (row.payment_status || "") === "deposit_paid";
      els.statusLine.classList.toggle("is-deposit-ok", !!ok);
      els.statusLine.classList.toggle("is-deposit-pending", !ok);
    }

    addRow(els.dlContact, "Full name", row.full_name);
    addRow(els.dlContact, "Phone", row.phone);
    addRow(els.dlContact, "Email", row.email);

    addRow(els.dlAppointment, "Date", formatDate(row.appointment_date));
    addRow(els.dlAppointment, "Time slot", row.appointment_slot || "—");
    addRow(els.dlAppointment, "Request received", formatDateTime(row.created_at));

    addRow(els.dlService, "Style", row.style_name || row.style_id || "—");
    var sid = String(row.style_id || "");
    if (sid.indexOf("house-") === 0) {
      addRow(
        els.dlService,
        "Service address",
        row.service_address && String(row.service_address).trim() ? row.service_address : "—",
      );
    }
    addRow(els.dlService, "Pricing", humanPricingSituation(row.pricing_situation));
    addRow(els.dlService, "Promo code", row.promo_code || "—");
    addRow(els.dlService, "Notes", row.notes || "—");

    addRow(els.dlPayment, "Estimated total", money(row.estimated_total));
    addRow(els.dlPayment, "Deposit due", money(row.deposit_amount));
    addRow(els.dlPayment, "Status", humanPaymentStatus(row.payment_status));

    var hasExtra = !!(row.photo_hair_path || row.photo_ref_path || row.source);
    if (els.sectionExtra) els.sectionExtra.hidden = !hasExtra;
    if (hasExtra) {
      if (row.photo_hair_path) addPhotoRow(els.dlExtra, "Hair photo", row.photo_hair_path);
      if (row.photo_ref_path) addPhotoRow(els.dlExtra, "Reference photo", row.photo_ref_path);
      if (row.source) addRow(els.dlExtra, "Source", row.source);
    }

    els.capture.hidden = false;
  }

  function showError(msg) {
    if (els.error) els.error.hidden = false;
    if (els.errorMsg) els.errorMsg.textContent = msg;
    if (els.actions) els.actions.hidden = true;
    if (els.capture) els.capture.hidden = true;
  }

  async function fetchBooking(id) {
    var sb = window.nadjaeSupabaseClient;
    if (sb) {
      var res = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
      if (res.error) {
        console.warn(res.error);
        return null;
      }
      return res.data || null;
    }
    var local = readLocalBookings();
    return local.find(function (r) {
      return r.id === id;
    }) || null;
  }

  function readNotice() {
    try {
      var n = sessionStorage.getItem(BOOKING_NOTICE_KEY);
      if (n) sessionStorage.removeItem(BOOKING_NOTICE_KEY);
      return n || "";
    } catch (e) {
      return "";
    }
  }

  function cleanUrl(bookingId) {
    try {
      var u = new URL(window.location.href);
      u.searchParams.delete("session_id");
      u.searchParams.delete("canceled");
      if (bookingId) u.searchParams.set("booking_id", bookingId);
      window.history.replaceState({}, "", u.pathname + u.search);
    } catch (e) {
      /* ignore */
    }
  }

  async function downloadPng() {
    if (typeof html2canvas !== "function") {
      window.alert("Image export is not available. Try a different browser or connection.");
      return;
    }
    var target = els.capture;
    if (!target || target.hidden) return;
    var btn = els.btnPng;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating image…";
    }
    try {
      var canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      var id = resolvedBookingId || new URLSearchParams(window.location.search).get("booking_id") || "booking";
      var short = String(id).replace(/[^0-9a-z-]/gi, "").slice(0, 8) || "ref";
      var a = document.createElement("a");
      a.download = "nadjae-booking-" + short + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (err) {
      console.error(err);
      window.alert("Could not create the PNG. You can use your browser Print to PDF instead.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save as PNG";
      }
    }
  }

  function recoverBookingIdFromSession() {
    var id = "";
    try {
      id = (sessionStorage.getItem(DETAILS_BOOKING_KEY) || "").trim();
    } catch (e) {
      id = "";
    }
    if (!id) {
      try {
        id = (sessionStorage.getItem(STRIPE_RETURN_BOOKING_KEY) || "").trim();
      } catch (e2) {
        id = "";
      }
    }
    return id;
  }

  function clearBookingSessionKeys() {
    try {
      sessionStorage.removeItem(DETAILS_BOOKING_KEY);
      sessionStorage.removeItem(STRIPE_RETURN_BOOKING_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function syncBookingIdInUrl(bookingId) {
    if (!bookingId) return;
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.get("booking_id")) return;
      u.searchParams.set("booking_id", bookingId);
      window.history.replaceState({}, "", u.pathname + u.search);
    } catch (e) {
      /* ignore */
    }
  }

  async function init() {
    var params = new URLSearchParams(window.location.search);
    var urlPaid = params.get("paid") === "1" || !!params.get("session_id");
    var bookingId = (params.get("booking_id") || "").trim();

    if (!bookingId) {
      bookingId = recoverBookingIdFromSession();
    }

    if (bookingId) {
      resolvedBookingId = bookingId;
      syncBookingIdInUrl(bookingId);
    }

    var notice = readNotice();
    if (notice && els.notice) {
      els.notice.hidden = false;
      els.notice.textContent =
        "Note: Your booking is saved, but the online deposit step did not finish: " + notice + " We will follow up for payment.";
      els.notice.classList.add("booking-details-notice--warn");
    }

    if (!bookingId) {
      showError(
        "No booking reference was found on this link. Go back to the booking form to submit again, or open Lookup Booking with the same name and email or phone you used. If you just finished paying, refresh once after updating the site.",
      );
      return;
    }

    var row = await fetchBooking(bookingId);
    if (!row) {
      showError(
        "We could not find that booking. If you just paid, wait a few seconds and refresh. Otherwise confirm your Supabase connection or use Lookup Booking with your name and email.",
      );
      return;
    }

    clearBookingSessionKeys();
    renderReceipt(row, urlPaid);
    cleanUrl(bookingId);

    if (els.btnPng) els.btnPng.addEventListener("click", downloadPng);
  }

  init();
})();
