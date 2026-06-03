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

    window.__SALON_SITE_BOOKING = Object.assign({}, window.__SALON_SITE_BOOKING || {}, {
      salonTimeZone: site.content.timezone || 'America/New_York',
      salonPhoneDisplay: site.content.phoneDisplay || '',
      salonPhoneTel: site.content.phoneTel || '',
      slotDayStartHour: hours.slotDayStartHour != null ? hours.slotDayStartHour : 8,
      slotDayStartMinute: hours.slotDayStartMinute != null ? hours.slotDayStartMinute : 0,
      slotDayEndHour: hours.slotDayEndHour != null ? hours.slotDayEndHour : 19,
      slotDayEndMinute: hours.slotDayEndMinute != null ? hours.slotDayEndMinute : 30,
      slotStepMinutes: hours.slotStepMinutes != null ? hours.slotStepMinutes : 30,
      saturdayLastStartHour: hours.saturdayLastStartHour != null ? hours.saturdayLastStartHour : 14,
      saturdayLastStartMinute: hours.saturdayLastStartMinute != null ? hours.saturdayLastStartMinute : 0,
      sameDayLeadMinutes: hours.sameDayLeadMinutes != null ? hours.sameDayLeadMinutes : 30,
      concurrentAppointmentCapacity:
        hours.concurrentAppointmentCapacity != null ? hours.concurrentAppointmentCapacity : 2,
      closedWeekdays: Array.isArray(hours.closedWeekdays) ? hours.closedWeekdays : [],
    });

    applyBrandToPage(site.content, site.theme, cfg);
    patchNavPaths();

    if (statusEl) statusEl.hidden = true;

    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(function (mod) {
        window.salonSupabaseClient = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        var script = document.createElement('script');
        script.src = '/js/booking.js?v=36';
        script.defer = true;
        document.body.appendChild(script);
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
