(function () {
  if (!window.StyldTenant) return;

  var subdomain = window.StyldTenant.getSubdomain();
  if (!subdomain) return;

  var statusEl = document.getElementById('tenant-status');
  if (statusEl) statusEl.hidden = false;

  function showError(message) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
  }

  function applyBrandToPage(content, theme, cfg) {
    if (content.brandName) {
      document.querySelectorAll('.hero-brand__text').forEach(function (el) {
        el.textContent = content.brandName;
      });
      document.title = (content.brandName || 'Book') + ' | Book online';
    }

    var logo = document.querySelector('.hero-brand__logo');
    if (logo && theme.logoImagePath && cfg.supabaseUrl) {
      logo.src =
        cfg.supabaseUrl.replace(/\/$/, '') +
        '/storage/v1/object/public/style-covers/' +
        String(theme.logoImagePath).replace(/^\/+/, '');
    }

    if (theme.primaryColor || theme.secondaryColor) {
      var primary = theme.primaryColor || '#db2777';
      var secondary = theme.secondaryColor || '#0a0a0a';
      document.documentElement.style.setProperty('--pink', primary);
      document.documentElement.style.setProperty('--ink', secondary);
      document.documentElement.style.setProperty('--nav-text', secondary);
    }

    var navBg = (theme.navbarColor || '').trim();
    if (navBg && /^#[0-9a-fA-F]{6}$/.test(navBg)) {
      document.documentElement.style.setProperty('--nav-bg', navBg);
      document.documentElement.style.setProperty('--nav-bg-solid', navBg);
    }

    var bg = (theme.backgroundColor || '').trim();
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
      document.documentElement.style.setProperty('--cream', bg);
      document.documentElement.style.setProperty('--white', bg);
      document.body.style.backgroundColor = bg;
    }

    if (window.StyldTenant.applySiteFooter) {
      window.StyldTenant.applySiteFooter(content);
    }
  }

  function patchNavPaths() {
    document.querySelectorAll('.hero-brand[href]').forEach(function (a) {
      a.setAttribute('href', '/');
    });
    document.querySelectorAll('.hero-nav__links a[href="index.html"], .hero-nav__links a[href="/"]').forEach(
      function (a) {
        a.setAttribute('href', '/');
      },
    );
    document.querySelectorAll('a[href="booking.html"]').forEach(function (a) {
      a.setAttribute('href', '/booking');
    });
  }

  function startBooking(site) {
    var cfg = window.__STYLD_TENANT__ || {};
    var hours = site.bookingHours || {};

    window.__SALON_SITE_SUPABASE = {
      url: cfg.supabaseUrl,
      anonKey: cfg.supabaseAnonKey,
    };

    window.__STYLD_TENANT_BOOKING__ = {
      subdomain: site.subdomain,
      userId: site.userId,
      styles: site.bookingStyles,
    };

    function normalizeBookingPayment(raw) {
      var defaults = {
        mode: 'deposit',
        depositKind: 'percent',
        depositValue: 10,
        depositIncludedInPrice: true,
        requireCurrentHairPhoto: true,
        requireReferencePhoto: false,
      };
      if (!raw || typeof raw !== 'object') return defaults;
      var mode = raw.mode === 'full' || raw.mode === 'deposit' || raw.mode === 'in_person' ? raw.mode : defaults.mode;
      var depositKind =
        raw.depositKind === 'fixed' || raw.depositKind === 'percent' ? raw.depositKind : defaults.depositKind;
      var depositValue =
        typeof raw.depositValue === 'number' && !Number.isNaN(raw.depositValue)
          ? raw.depositValue
          : defaults.depositValue;
      if (depositKind === 'percent') {
        depositValue = Math.min(100, Math.max(1, Math.round(depositValue)));
      } else {
        depositValue = Math.max(0, Math.round(depositValue * 100) / 100);
      }
      var requireCurrentHairPhoto =
        typeof raw.requireCurrentHairPhoto === 'boolean'
          ? raw.requireCurrentHairPhoto
          : defaults.requireCurrentHairPhoto;
      var requireReferencePhoto =
        typeof raw.requireReferencePhoto === 'boolean'
          ? raw.requireReferencePhoto
          : defaults.requireReferencePhoto;
      var depositIncludedInPrice =
        typeof raw.depositIncludedInPrice === 'boolean'
          ? raw.depositIncludedInPrice
          : defaults.depositIncludedInPrice;
      return {
        mode: mode,
        depositKind: depositKind,
        depositValue: depositValue,
        depositIncludedInPrice: depositIncludedInPrice,
        requireCurrentHairPhoto: requireCurrentHairPhoto,
        requireReferencePhoto: requireReferencePhoto,
      };
    }

    var cancellationPolicy =
      site.cancellationPolicy && typeof site.cancellationPolicy === 'object'
        ? site.cancellationPolicy
        : {
            fullRefundNoticeHours: 24,
            refundAppliesTo: 'both',
            policySummary:
              'You may cancel online anytime before your appointment. Online deposits and full payments are fully refunded when you cancel at least 24 hours before your appointment. Cancellations after that deadline are non-refundable.',
          };

    window.__SALON_SITE_BOOKING = Object.assign({}, window.__SALON_SITE_BOOKING || {}, {
      payment: normalizeBookingPayment(site.bookingPayment),
      cancellationPolicy: cancellationPolicy,
      salonTimeZone: site.content.timezone || 'America/New_York',
      salonPhoneDisplay: site.content.phoneDisplay || '',
      salonPhoneTel: site.content.phoneTel || '',
      slotDayStartHour: hours.slotDayStartHour,
      slotDayStartMinute: hours.slotDayStartMinute,
      slotDayEndHour: hours.slotDayEndHour,
      slotDayEndMinute: hours.slotDayEndMinute,
      slotStepMinutes: hours.slotStepMinutes,
      saturdayLastStartHour: hours.saturdayLastStartHour,
      saturdayLastStartMinute: hours.saturdayLastStartMinute,
      sameDayLeadMinutes: hours.sameDayLeadMinutes,
      concurrentAppointmentCapacity: hours.concurrentAppointmentCapacity,
      closedWeekdays: hours.closedWeekdays,
      weekdayHours: hours.weekdayHours,
      strictNoOverlap: true,
    });

    applyBrandToPage(site.content, site.theme, cfg);
    patchNavPaths();

    if (statusEl) statusEl.hidden = true;

    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(function (mod) {
        var sb = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        window.salonSupabaseClient = sb;

        // Initialize Stripe for card payments
        var stripePk = cfg.stripePk || '';
        if (stripePk && window.Stripe) {
          window.__STYLD_STRIPE__ = window.Stripe(stripePk);
          window.__STYLD_STRIPE_READY__ = true;
        } else {
          window.__STYLD_STRIPE_READY__ = false;
        }

        var availScript = document.createElement('script');
        availScript.src = '/js/booking-availability.js?v=3';
        availScript.onload = function () {
          var script = document.createElement('script');
          script.src = '/js/booking.js?v=57';
          script.defer = true;
          document.body.appendChild(script);
        };
        document.body.appendChild(availScript);
      })
      .catch(function (err) {
        showError(err && err.message ? err.message : 'Could not start booking.');
      });
  }

  window.StyldTenant.loadPublishedSite()
    .then(startBooking)
    .catch(function (err) {
      showError(err && err.message ? err.message : 'Site not found.');
    });
})();






