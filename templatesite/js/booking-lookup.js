/**
 * Booking lookup page: search, view, cancel, reschedule.
 */
(function () {
  var LOCAL_BOOKINGS_KEY = "salon_site_bookings_local";
  /** Must match js/booking.js — earliest day clients may pick for a new appointment (local calendar). */
  var BOOKING_LEAD_DAYS = 3;
  var SALON_PHONE_TEL = "+15550100199";
  var SALON_PHONE_DISPLAY = "(555) 010-0199";
  var SLOT_OPTIONS = (function () {
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

  var els = {
    form: document.getElementById("lookup-form"),
    name: document.getElementById("lookup-name"),
    contact: document.getElementById("lookup-contact"),
    bookingId: document.getElementById("lookup-booking-id"),
    feedback: document.getElementById("lookup-feedback"),
    results: document.getElementById("lookup-results"),
  };

  var lastQuery = { name: "", contact: "", bookingId: "" };

  function getTenantSubdomain() {
    if (window.StyldTenant && typeof window.StyldTenant.getSubdomain === "function") {
      return window.StyldTenant.getSubdomain();
    }
    var cfg = window.__STYLD_TENANT__ || {};
    var rootDomain = (cfg.rootDomain || "styldd.com").toLowerCase();
    var host = (window.location.hostname || "").toLowerCase();
    var fromQuery = new URLSearchParams(window.location.search).get("subdomain");
    if (fromQuery) return fromQuery.trim().toLowerCase();
    if (host.endsWith("." + rootDomain) && host !== rootDomain && host !== "www." + rootDomain) {
      return host.slice(0, -(rootDomain.length + 1));
    }
    return "";
  }

  function tenantRpcHeaders() {
    var cfg = window.__STYLD_TENANT__ || {};
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: "Bearer " + cfg.supabaseAnonKey,
      "Content-Type": "application/json",
    };
  }

  async function tenantLookupBooking(subdomain, bookingId, contact) {
    var cfg = window.__STYLD_TENANT__ || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    var url = cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/styld_tenant_lookup_booking";
    var res = await fetch(url, {
      method: "POST",
      headers: tenantRpcHeaders(),
      body: JSON.stringify({
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_contact: contact,
      }),
    });
    if (!res.ok) {
      console.warn("Tenant lookup failed", await res.text());
      return null;
    }
    var body = await res.json();
    return body && typeof body === "object" ? body : null;
  }

  async function tenantCancelBooking(subdomain, bookingId, contact) {
    var cfg = window.__STYLD_TENANT__ || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
    var url = cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/styld_tenant_cancel_booking";
    var res = await fetch(url, {
      method: "POST",
      headers: tenantRpcHeaders(),
      body: JSON.stringify({
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_contact: contact,
      }),
    });
    if (!res.ok) {
      console.warn("Tenant cancel failed", await res.text());
      return false;
    }
    var body = await res.json();
    return body === true;
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
  }

  function safeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normalizeText(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizePhone(v) {
    return String(v || "").replace(/\D/g, "");
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

  function writeLocalBookings(list) {
    try {
      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not update local bookings", e);
    }
  }

  function formatDate(v) {
    if (!v) return "—";
    var d = new Date(v + "T12:00:00");
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(v) {
    if (!v) return "—";
    var d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function minBookableDateStr() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + BOOKING_LEAD_DAYS);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  /** Whole calendar days from local today to appointment date (0 = today). */
  function calendarDaysFromToday(appointmentDateStr) {
    if (!appointmentDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDateStr))) return -999;
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    var a = new Date(String(appointmentDateStr) + "T12:00:00");
    a.setHours(0, 0, 0, 0);
    return Math.round((a - t) / 86400000);
  }

  /** If true, online reschedule is not offered — client must call. */
  function mustCallToReschedule(row) {
    if (isCancelled(row)) return false;
    return calendarDaysFromToday(row.appointment_date) < BOOKING_LEAD_DAYS;
  }

  function isCancelled(row) {
    var status = normalizeText(row.booking_status);
    if (status === "cancelled" || status === "canceled") return true;
    var slot = normalizeText(row.appointment_slot);
    var notes = normalizeText(row.notes);
    return slot === "cancelled" || notes.indexOf("[cancelled]") >= 0;
  }

  function setFeedback(message, kind) {
    if (!els.feedback) return;
    els.feedback.hidden = !message;
    els.feedback.textContent = message || "";
    els.feedback.classList.remove("booking-feedback--error", "booking-feedback--success");
    if (message && kind === "error") els.feedback.classList.add("booking-feedback--error");
    if (message && kind === "success") els.feedback.classList.add("booking-feedback--success");
  }

  function isBookingUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "").trim());
  }

  function matchesContact(row, contact) {
    var rowEmail = normalizeText(row.email);
    var rowPhone = normalizePhone(row.phone);
    var qContactText = normalizeText(contact);
    var qContactPhone = normalizePhone(contact);
    return qContactText.indexOf("@") >= 0 ? rowEmail === qContactText : !!qContactPhone && rowPhone === qContactPhone;
  }

  async function lookupByBookingId(bookingId, contact) {
    if (!bookingId) return [];
    var tenantSubdomain = getTenantSubdomain();
    if (tenantSubdomain) {
      var tenantRow = await tenantLookupBooking(tenantSubdomain, bookingId, contact);
      return tenantRow ? [tenantRow] : [];
    }

    var local = readLocalBookings();
    var localRow = local.find(function (r) {
      return r.id === bookingId;
    });
    if (localRow && matchesContact(localRow, contact)) return [localRow];

    var sb = window.salonSupabaseClient;
    if (!sb) return [];

    var res = await sb.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (res.error) {
      console.warn("Lookup by id failed", res.error);
      return [];
    }
    var row = res.data;
    if (!row || !matchesContact(row, contact)) return [];
    return [row];
  }

  function renderDetailGrid(row) {
    return (
      '<div class="lookup-detail__grid">' +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Booking ID</span><span class="lookup-detail__value"><code>' +
      safeText(row.id) +
      "</code></span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Date</span><span class="lookup-detail__value">' +
      safeText(formatDate(row.appointment_date)) +
      " at " +
      safeText(row.appointment_slot || "—") +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Name</span><span class="lookup-detail__value">' +
      safeText(row.full_name) +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Email</span><span class="lookup-detail__value">' +
      safeText(row.email || "—") +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Phone</span><span class="lookup-detail__value">' +
      safeText(row.phone || "—") +
      "</span></div>" +
      (String(row.style_id || "").indexOf("house-") === 0 && row.service_address && String(row.service_address).trim()
        ? '<div class="lookup-detail__row"><span class="lookup-detail__label">Service address</span><span class="lookup-detail__value">' +
          safeText(row.service_address) +
          "</span></div>"
        : "") +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Total</span><span class="lookup-detail__value">' +
      safeText(money(row.estimated_total)) +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Deposit</span><span class="lookup-detail__value">' +
      safeText(money(row.deposit_amount)) +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Payment status</span><span class="lookup-detail__value">' +
      safeText(row.payment_status || "—") +
      "</span></div>" +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Booked</span><span class="lookup-detail__value">' +
      safeText(formatDateTime(row.created_at)) +
      "</span></div>" +
      "</div>" +
      '<div class="lookup-detail__divider" aria-hidden="true"></div>' +
      '<div class="lookup-detail__options">' +
      '<h4 class="lookup-detail__options-heading">Notes</h4>' +
      '<div class="lookup-detail__grid lookup-detail__grid--options">' +
      '<div class="lookup-detail__row"><span class="lookup-detail__label">Your notes</span><span class="lookup-detail__value"><span class="lookup-notes-value">' +
      safeText(row.notes && String(row.notes).trim() ? row.notes : "None") +
      "</span></span></div>" +
      "</div></div>" +
      '<p class="lookup-policy-note"><small>Cancellations are available anytime below. Online reschedule requires a new date at least ' +
      BOOKING_LEAD_DAYS +
      " full days from today. For shorter notice, call <a href=\"tel:" +
      SALON_PHONE_TEL +
      '">' +
      safeText(SALON_PHONE_DISPLAY) +
      "</a>.</small></p>" +
      (mustCallToReschedule(row)
        ? '<p class="lookup-reschedule-call-notice" role="status"><strong>Reschedule by phone:</strong> Your appointment is within the next ' +
          BOOKING_LEAD_DAYS +
          " days — call <a href=\"tel:" +
          SALON_PHONE_TEL +
          '">' +
          safeText(SALON_PHONE_DISPLAY) +
          "</a> to change it.</p>"
        : "") +
      (mustCallToReschedule(row)
        ? ""
        : '<form class="lookup-reschedule-form" hidden>' +
          '<div class="field-row">' +
          '<div class="field"><label>New date</label><input type="date" name="new-date" required min="' +
          safeText(minBookableDateStr()) +
          '" /></div>' +
          '<div class="field"><label>New time slot</label><select name="new-slot">' +
          SLOT_OPTIONS.map(function (slot) {
            return '<option value="' + safeText(slot) + '">' + safeText(slot) + "</option>";
          }).join("") +
          "</select></div>" +
          "</div>" +
          '<button type="submit" class="btn btn-primary">Save new appointment</button>' +
          "</form>")
    );
  }

  function renderResults(rows) {
    if (!els.results) return;
    if (!rows.length) {
      els.results.innerHTML =
        '<p class="lookup-empty">No booking matches that ID and contact information. Check your booking ID and the email or phone used when you booked.</p>';
      return;
    }

    els.results.innerHTML = rows
      .map(function (row) {
        var cancelled = isCancelled(row);
        var rescheduleBlocked = !cancelled && mustCallToReschedule(row);
        return (
          '<article class="lookup-card" data-booking-id="' +
          safeText(row.id) +
          '" data-appointment-date="' +
          safeText(row.appointment_date || "") +
          '" data-appointment-slot="' +
          safeText(row.appointment_slot || "") +
          '">' +
          '<div class="lookup-card__top">' +
          "<h3>" +
          safeText(row.style_name || "Appointment") +
          "</h3>" +
          '<span class="lookup-status ' +
          (cancelled ? "is-cancelled" : "is-active") +
          '">' +
          (cancelled ? "Cancelled" : "Active") +
          "</span>" +
          "</div>" +
          '<p class="lookup-card__teaser">Use <strong>View appointment</strong> to see full booking details and style options.</p>' +
          '<div class="lookup-actions">' +
          '<button type="button" class="btn btn-outline lookup-view-btn" aria-expanded="false">View appointment</button>' +
          '<button type="button" class="btn btn-outline lookup-cancel-btn" ' +
          (cancelled ? "disabled" : "") +
          ">Cancel</button>" +
          '<button type="button" class="btn btn-primary lookup-reschedule-toggle"' +
          (cancelled || rescheduleBlocked ? " disabled" : "") +
          (rescheduleBlocked ? ' title="Call to reschedule within the 3-day window"' : "") +
          ">Reschedule</button>" +
          "</div>" +
          '<div class="lookup-detail lookup-detail-panel" id="lookup-detail-' +
          safeText(row.id) +
          '" hidden>' +
          renderDetailGrid(row) +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function updateLocalBooking(bookingId, changes) {
    var list = readLocalBookings();
    var next = list.map(function (row) {
      if (row.id !== bookingId) return row;
      return Object.assign({}, row, changes);
    });
    writeLocalBookings(next);
  }

  async function updateRemoteBooking(bookingId, changes) {
    var tenantSubdomain = getTenantSubdomain();
    if (
      tenantSubdomain &&
      changes &&
      (changes.booking_status === "cancelled" || changes.appointment_slot === "Cancelled")
    ) {
      return tenantCancelBooking(tenantSubdomain, bookingId, lastQuery.contact);
    }

    var sb = window.salonSupabaseClient;
    if (!sb) return false;
    var res = await sb.from("bookings").update(changes).eq("id", bookingId);
    return !res.error;
  }

  async function notifyBookingStatusEmail(bookingId, kind, prevDate, prevSlot) {
    var sb = window.salonSupabaseClient;
    if (!sb) return false;
    try {
      var res = await sb.functions.invoke("notify-booking-status", {
        body: {
          booking_id: bookingId,
          kind: kind,
          prev_date: prevDate || "",
          prev_slot: prevSlot || "",
        },
      });
      return !res.error;
    } catch (e) {
      console.warn("notify-booking-status failed", e);
      return false;
    }
  }

  function appendNotes(existing, marker) {
    var base = String(existing || "").trim();
    if (base.toLowerCase().indexOf(marker.toLowerCase()) >= 0) return base;
    return base ? base + " " + marker : marker;
  }

  async function rerunLookup() {
    if (!lastQuery.bookingId || !lastQuery.contact) return;
    var byId = await lookupByBookingId(lastQuery.bookingId, lastQuery.contact);
    renderResults(byId);
  }

  async function handleActionClick(e) {
    var card = e.target.closest(".lookup-card");
    if (!card) return;
    var bookingId = card.getAttribute("data-booking-id");

    if (e.target.classList.contains("lookup-view-btn")) {
      var detail = card.querySelector(".lookup-detail");
      if (!detail) return;
      detail.hidden = !detail.hidden;
      var isOpen = !detail.hidden;
      e.target.setAttribute("aria-expanded", isOpen ? "true" : "false");
      e.target.textContent = isOpen ? "Hide details" : "View appointment";
      return;
    }

    if (e.target.classList.contains("lookup-reschedule-toggle")) {
      var detail = card.querySelector(".lookup-detail");
      var form = card.querySelector(".lookup-reschedule-form");
      if (detail && detail.hidden) {
        detail.hidden = false;
        var viewBtn = card.querySelector(".lookup-view-btn");
        if (viewBtn) {
          viewBtn.setAttribute("aria-expanded", "true");
          viewBtn.textContent = "Hide details";
        }
      }
      if (form) form.hidden = !form.hidden;
      return;
    }

    if (e.target.classList.contains("lookup-cancel-btn")) {
      var okay = window.confirm("Cancel this appointment?");
      if (!okay) return;

      var notesSpan = card.querySelector(".lookup-notes-value");
      var notesText = notesSpan ? notesSpan.textContent.trim() : "";
      if (notesText === "None") notesText = "";
      var changes = {
        appointment_slot: "Cancelled",
        booking_status: "cancelled",
        notes: appendNotes(notesText, "[CANCELLED]"),
      };
      var prevDate = card.getAttribute("data-appointment-date") || "";
      var prevSlot = card.getAttribute("data-appointment-slot") || "";

      updateLocalBooking(bookingId, changes);
      var remoteOk = await updateRemoteBooking(bookingId, changes);
      if (remoteOk) await notifyBookingStatusEmail(bookingId, "cancelled", prevDate, prevSlot);
      setFeedback(remoteOk ? "Appointment cancelled." : "Cancelled locally. Remote update may require additional database policy.", remoteOk ? "success" : "error");
      await rerunLookup();
    }
  }

  async function handleRescheduleSubmit(e) {
    if (!e.target.classList.contains("lookup-reschedule-form")) return;
    e.preventDefault();
    var card = e.target.closest(".lookup-card");
    if (!card) return;
    var bookingId = card.getAttribute("data-booking-id");
    var dateInput = e.target.querySelector('input[name="new-date"]');
    var slotInput = e.target.querySelector('select[name="new-slot"]');
    var newDate = dateInput ? dateInput.value : "";
    var newSlot = slotInput ? slotInput.value : "";
    if (!newDate || !newSlot) return;

    var minD = minBookableDateStr();
    if (newDate < minD) {
      setFeedback(
        "That date is too soon — new appointments must be at least " +
          BOOKING_LEAD_DAYS +
          " days from today. For sooner times, call " +
          SALON_PHONE_DISPLAY +
          ".",
        "error",
      );
      return;
    }

    var prevDate = card.getAttribute("data-appointment-date") || "";
    var prevSlot = card.getAttribute("data-appointment-slot") || "";
    var changes = { appointment_date: newDate, appointment_slot: newSlot, booking_status: "rescheduled" };
    updateLocalBooking(bookingId, changes);
    var remoteOk = await updateRemoteBooking(bookingId, changes);
    if (remoteOk) await notifyBookingStatusEmail(bookingId, "rescheduled", prevDate, prevSlot);
    setFeedback(
      remoteOk
        ? "Appointment rescheduled."
        : "Rescheduled locally. Remote update may require additional database policy.",
      remoteOk ? "success" : "error",
    );
    await rerunLookup();
  }

  async function onSubmit(e) {
    e.preventDefault();
    var name = (els.name && els.name.value ? els.name.value : "").trim();
    var contact = (els.contact && els.contact.value ? els.contact.value : "").trim();
    var bookingIdRaw = (els.bookingId && els.bookingId.value ? els.bookingId.value : "").trim();

    if (!name) {
      setFeedback("Please enter your full name as it appears on the booking.", "error");
      return;
    }
    if (!contact) {
      setFeedback("Please enter the email or phone used when you booked.", "error");
      return;
    }
    if (!bookingIdRaw) {
      setFeedback("Booking ID is required. Paste the full ID from your confirmation email or page.", "error");
      return;
    }
    if (!isBookingUuid(bookingIdRaw)) {
      setFeedback("Booking ID must be the full UUID from your confirmation (8-4-4-4-12 characters).", "error");
      return;
    }

    lastQuery = { name: name, contact: contact, bookingId: bookingIdRaw };
    setFeedback("", null);
    var byIdRows = await lookupByBookingId(bookingIdRaw, contact);

    if (byIdRows.length) {
      var row = byIdRows[0];
      if (normalizeText(row.full_name) !== normalizeText(name)) {
        setFeedback("That booking ID does not match this full name. Check your name spelling or booking ID.", "error");
        els.results.innerHTML =
          '<p class="lookup-empty">No booking displayed — name did not match the record for this ID.</p>';
        return;
      }
    }

    renderResults(byIdRows);
    if (byIdRows.length) {
      setFeedback("Booking found. Use View appointment for full details and style options.", "success");
    } else {
      setFeedback("No booking matches that ID and email or phone. Check for typos.", "error");
    }
  }

  function applyUrlPrefill() {
    var p = new URLSearchParams(window.location.search);
    var bookingId = (p.get("booking_id") || "").trim();
    var contact = (p.get("contact") || p.get("email") || "").trim();
    var name = (p.get("name") || "").trim();
    if (els.bookingId && bookingId) els.bookingId.value = bookingId;
    if (els.contact && contact) els.contact.value = contact;
    if (els.name && name) els.name.value = name;
    return {
      bookingId: bookingId,
      contact: contact,
      name: name,
      autoSubmit: !!(bookingId && contact && name),
    };
  }

  async function init() {
    if (!els.form || !els.results) return;
    els.form.addEventListener("submit", onSubmit);
    els.results.addEventListener("click", handleActionClick);
    els.results.addEventListener("submit", handleRescheduleSubmit);

    var prefill = applyUrlPrefill();
    if (prefill.autoSubmit) {
      await onSubmit({ preventDefault: function () {} });
    }
  }

  init();
})();
