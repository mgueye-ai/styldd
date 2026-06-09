(function () {
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var els = {
    status: document.getElementById('tenant-status'),
    heading: document.getElementById('manage-page-heading'),
    lead: document.getElementById('manage-page-lead'),
    feedback: document.getElementById('manage-feedback'),
    card: document.getElementById('manage-card'),
    serviceName: document.getElementById('manage-service-name'),
    statusPill: document.getElementById('manage-status-pill'),
    details: document.getElementById('manage-details'),
    actions: document.getElementById('manage-actions'),
    cancelBtn: document.getElementById('manage-cancel-btn'),
    policyNote: document.getElementById('manage-policy-note'),
    brandName: document.getElementById('profile-brand-name'),
    logo: document.getElementById('profile-logo-placeholder'),
  };

  var state = {
    subdomain: '',
    bookingId: '',
    contact: '',
    name: '',
    row: null,
    context: null,
    salonTimeZone: null,
  };

  function normalizeText(v) {
    return String(v || '').trim().toLowerCase();
  }

  function money(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  }

  function moneyFromCents(cents) {
    return money(Number(cents || 0) / 100);
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    var opts = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    if (state.salonTimeZone) opts.timeZone = state.salonTimeZone;
    return d.toLocaleString('en-US', opts);
  }

  function isCancelled(row) {
    var status = normalizeText(row.booking_status);
    if (status === 'cancelled' || status === 'canceled') return true;
    return normalizeText(row.appointment_slot) === 'cancelled';
  }

  function setLoading(show, message) {
    if (!els.status) return;
    if (show) {
      els.status.hidden = false;
      if (message) els.status.textContent = message;
    } else {
      els.status.hidden = true;
    }
  }

  function setFeedback(message, kind) {
    if (!els.feedback) return;
    els.feedback.hidden = !message;
    els.feedback.textContent = message || '';
    els.feedback.classList.remove('is-error', 'is-success');
    if (message && kind === 'error') els.feedback.classList.add('is-error');
    if (message && kind === 'success') els.feedback.classList.add('is-success');
  }

  function applyTheme(site) {
    var content = site.content || {};
    state.salonTimeZone = content.timezone || null;

    if (window.StyldTenant && typeof window.StyldTenant.applySiteTheme === 'function') {
      window.StyldTenant.applySiteTheme(site.theme);
    }
    if (window.StyldTenant && typeof window.StyldTenant.applyPageBranding === 'function') {
      window.StyldTenant.applyPageBranding(site, {
        documentTitleSuffix: 'Your appointment',
        brandNameEl: els.brandName,
        logoEl: els.logo,
      });
    }
  }

  function rpcHeaders() {
    var cfg = window.__STYLD_TENANT__ || {};
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: 'Bearer ' + cfg.supabaseAnonKey,
      'Content-Type': 'application/json',
    };
  }

  async function tenantGetCancelContext(subdomain, bookingId, contact) {
    var cfg = window.__STYLD_TENANT__ || {};
    var url = cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/styld_tenant_get_cancel_context';
    var res = await fetch(url, {
      method: 'POST',
      headers: rpcHeaders(),
      body: JSON.stringify({
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_contact: contact,
      }),
    });
    if (!res.ok) {
      var errText = await res.text();
      console.warn('Cancel context failed', errText);
      return null;
    }
    var body = await res.json();
    return body && typeof body === 'object' ? body : null;
  }

  async function invokeBookingCancel(subdomain, bookingId, contact) {
    var cfg = window.__STYLD_TENANT__ || {};
    var url = cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/booking-cancel';
    var res = await fetch(url, {
      method: 'POST',
      headers: rpcHeaders(),
      body: JSON.stringify({
        bookingId: bookingId,
        subdomain: subdomain,
        contact: contact,
        cancelledBy: 'client',
      }),
    });
    var data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok || !data || !data.ok) {
      return {
        ok: false,
        error: (data && data.error) || 'Could not cancel this appointment.',
      };
    }
    return { ok: true, data: data };
  }

  function addDetail(label, value) {
    return (
      '<div class="manage-booking-dl__row"><dt>' +
      label +
      '</dt><dd>' +
      value +
      '</dd></div>'
    );
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function refundConfirmNote(ctx, row) {
    if (!ctx) return '';
    if (ctx.qualifies_for_refund === true) {
      return ' A full refund of your online payment will be issued.';
    }
    var paid =
      row &&
      (String(row.payment_status || '').toLowerCase() === 'deposit_paid' ||
        String(row.payment_status || '').toLowerCase() === 'paid');
    if (paid) {
      return ' No refund will be issued for this cancellation based on the booking policy.';
    }
    return '';
  }

  function renderBooking(row, ctx) {
    if (!els.card || !els.details) return;

    var cancelled = isCancelled(row);
    if (els.serviceName) {
      els.serviceName.textContent = row.style_name || 'Appointment';
    }
    if (els.statusPill) {
      els.statusPill.textContent = cancelled ? 'Cancelled' : 'Active';
      els.statusPill.className =
        'manage-booking-status ' + (cancelled ? 'is-cancelled' : 'is-active');
    }

    var when = formatDateTime(row.appointment_starts_at);
    var duration = row.duration_minutes ? row.duration_minutes + ' min' : '—';
    var shortId = String(row.id || '').slice(0, 8).toUpperCase();
    var refundStatus = String(row.refund_status || ctx?.refund_status || 'none').toLowerCase();
    var refundCents = Number(row.refund_amount_cents || ctx?.refund_amount_cents || 0);

    var detailsHtml =
      addDetail('Client', escapeHtml(row.full_name || '—')) +
      addDetail('When', escapeHtml(when)) +
      addDetail('Duration', escapeHtml(duration)) +
      (row.service_address ? addDetail('Location', escapeHtml(row.service_address)) : '') +
      addDetail('Total', escapeHtml(money(row.estimated_total))) +
      (Number(row.deposit_amount) > 0
        ? addDetail('Deposit', escapeHtml(money(row.deposit_amount)))
        : '') +
      addDetail('Reference', '#' + escapeHtml(shortId));

    if (cancelled && refundStatus !== 'none') {
      var refundLabel =
        refundStatus === 'succeeded'
          ? 'Refunded'
          : refundStatus === 'pending'
            ? 'Refund processing'
            : refundStatus === 'skipped'
              ? 'No refund'
              : 'Refund';
      detailsHtml += addDetail('Refund', escapeHtml(refundLabel));
      if (refundCents > 0) {
        detailsHtml += addDetail('Refund amount', escapeHtml(moneyFromCents(refundCents)));
      }
    }

    els.details.innerHTML = detailsHtml;

    if (els.heading) {
      els.heading.textContent = cancelled ? 'Appointment cancelled' : 'Your appointment';
    }
    if (els.lead) {
      els.lead.textContent = cancelled
        ? 'This booking has been cancelled. Book again anytime.'
        : 'Review your booking details below.';
    }

    var canCancel = !cancelled && ctx && ctx.can_cancel === true;
    var policySummary = (ctx && ctx.policy && ctx.policy.policySummary) || '';

    if (els.policyNote) {
      if (cancelled || !policySummary) {
        els.policyNote.hidden = true;
        els.policyNote.textContent = '';
      } else {
        els.policyNote.hidden = false;
        var refundHint =
          ctx && ctx.qualifies_for_refund === false && canCancel
            ? ' You can still cancel, but no refund applies for this timing or payment type.'
            : '';
        els.policyNote.textContent = policySummary + refundHint;
      }
    }

    if (els.cancelBtn) {
      els.cancelBtn.hidden = cancelled || !canCancel;
      els.cancelBtn.disabled = cancelled || !canCancel;
      els.cancelBtn.textContent = 'Cancel appointment';
    }

    els.card.hidden = false;
  }

  function readParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      bookingId: (p.get('booking_id') || '').trim(),
      contact: (p.get('contact') || p.get('email') || '').trim(),
      name: (p.get('name') || '').trim(),
    };
  }

  function getSubdomain() {
    if (window.StyldTenant && typeof window.StyldTenant.getSubdomain === 'function') {
      return window.StyldTenant.getSubdomain();
    }
    return '';
  }

  async function handleCancel() {
    if (!state.row || isCancelled(state.row)) return;
    if (state.context && state.context.can_cancel !== true) {
      setFeedback('This appointment can no longer be cancelled online.', 'error');
      return;
    }

    var refundNote = refundConfirmNote(state.context, state.row);
    var okay = window.confirm('Cancel this appointment? This cannot be undone.' + refundNote);
    if (!okay) return;

    if (els.cancelBtn) {
      els.cancelBtn.disabled = true;
      els.cancelBtn.textContent = 'Cancelling…';
    }

    var result = await invokeBookingCancel(state.subdomain, state.bookingId, state.contact);
    if (!result.ok) {
      setFeedback(result.error || 'Could not cancel right now. Please contact the salon.', 'error');
      if (els.cancelBtn) {
        els.cancelBtn.disabled = false;
        els.cancelBtn.textContent = 'Cancel appointment';
      }
      return;
    }

    state.row.booking_status = 'cancelled';
    if (result.data) {
      state.row.refund_status = result.data.refundStatus || 'none';
      state.row.refund_amount_cents = result.data.refundAmountCents || 0;
    }
    renderBooking(state.row, state.context);

    var successMsg = 'Your appointment has been cancelled.';
    if (result.data && result.data.refundStatus === 'succeeded') {
      successMsg += ' Your refund has been initiated.';
    } else if (result.data && result.data.refundStatus === 'pending') {
      successMsg += ' Your refund is being processed.';
    }
    setFeedback(successMsg, 'success');
    if (els.cancelBtn) {
      els.cancelBtn.hidden = true;
    }
  }

  async function init() {
    if (!window.StyldTenant || typeof window.StyldTenant.loadPublishedSite !== 'function') {
      setLoading(false);
      setFeedback('This page is not configured yet.', 'error');
      return;
    }

    var params = readParams();
    state.bookingId = params.bookingId;
    state.contact = params.contact;
    state.name = params.name;
    state.subdomain = getSubdomain();

    if (!state.subdomain) {
      setLoading(false);
      setFeedback('Site not found.', 'error');
      return;
    }
    if (!state.bookingId || !UUID_RE.test(state.bookingId)) {
      setLoading(false);
      setFeedback('This appointment link is invalid.', 'error');
      return;
    }
    if (!state.contact) {
      setLoading(false);
      setFeedback('This appointment link is incomplete.', 'error');
      return;
    }

    try {
      var site = await window.StyldTenant.loadPublishedSite();
      applyTheme(site);

      var ctx = await tenantGetCancelContext(state.subdomain, state.bookingId, state.contact);
      if (!ctx || !ctx.booking) {
        setLoading(false);
        setFeedback('We could not find this appointment. The link may have expired or is incorrect.', 'error');
        return;
      }

      var row = ctx.booking;
      if (state.name && normalizeText(row.full_name) !== normalizeText(state.name)) {
        setLoading(false);
        setFeedback('This appointment link does not match the booking on file.', 'error');
        return;
      }

      state.row = row;
      state.context = ctx;
      renderBooking(row, ctx);
      setLoading(false);

      if (els.cancelBtn) {
        els.cancelBtn.addEventListener('click', handleCancel);
      }
    } catch (err) {
      setLoading(false);
      setFeedback((err && err.message) || 'Could not load your appointment.', 'error');
    }
  }

  init();
})();
