(function () {
  function getSubdomain() {
    var cfg = window.__STYLD_TENANT__ || {};
    var rootDomain = (cfg.rootDomain || 'styldd.com').toLowerCase();
    var host = (window.location.hostname || '').toLowerCase();
    var fromQuery = new URLSearchParams(window.location.search).get('subdomain');
    if (fromQuery) return fromQuery.trim().toLowerCase();

    if (host.endsWith('.' + rootDomain) && host !== rootDomain && host !== 'www.' + rootDomain) {
      return host.slice(0, -(rootDomain.length + 1));
    }
    return '';
  }

  function settingValue(row) {
    if (!row || !row.data || typeof row.data !== 'object') return null;
    if (row.data.value != null) return row.data.value;
    return row.data;
  }

  var DEFAULT_BOOKING_HOURS = {
    closedWeekdays: [],
    slotDayStartHour: 8,
    slotDayStartMinute: 0,
    slotDayEndHour: 19,
    slotDayEndMinute: 30,
    slotStepMinutes: 30,
    sameDayLeadMinutes: 4320,
    saturdayLastStartHour: 14,
    saturdayLastStartMinute: 0,
    concurrentAppointmentCapacity: 2,
  };

  function normalizeNumber(value, fallback) {
    var n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeWeekdays(value) {
    if (!Array.isArray(value)) return DEFAULT_BOOKING_HOURS.closedWeekdays.slice();
    return value
      .map(function (d) {
        return Number(d);
      })
      .filter(function (d) {
        return Number.isInteger(d) && d >= 0 && d <= 6;
      });
  }

  function normalizeHour(value, fallback) {
    var n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.min(23, Math.max(0, Math.round(n))) : fallback;
  }

  function normalizeMinute(value, fallback) {
    var n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.min(59, Math.max(0, Math.round(n))) : fallback;
  }

  function normalizeWeekdayHours(raw, fallback) {
    if (!raw || typeof raw !== 'object') return undefined;
    var next = {};
    Object.keys(raw).forEach(function (key) {
      var weekday = Number(key);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return;
      var entry = raw[key];
      if (!entry || typeof entry !== 'object') return;
      next[weekday] = {
        startHour: normalizeHour(entry.startHour, fallback.slotDayStartHour),
        startMinute: normalizeMinute(entry.startMinute, fallback.slotDayStartMinute),
        endHour: normalizeHour(entry.endHour, fallback.slotDayEndHour),
        endMinute: normalizeMinute(entry.endMinute, fallback.slotDayEndMinute),
      };
    });
    return Object.keys(next).length > 0 ? next : undefined;
  }

  function normalizeBookingHours(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var base = {
      closedWeekdays: normalizeWeekdays(source.closedWeekdays),
      slotDayStartHour: normalizeNumber(source.slotDayStartHour, DEFAULT_BOOKING_HOURS.slotDayStartHour),
      slotDayStartMinute: normalizeNumber(source.slotDayStartMinute, DEFAULT_BOOKING_HOURS.slotDayStartMinute),
      slotDayEndHour: normalizeNumber(source.slotDayEndHour, DEFAULT_BOOKING_HOURS.slotDayEndHour),
      slotDayEndMinute: normalizeNumber(source.slotDayEndMinute, DEFAULT_BOOKING_HOURS.slotDayEndMinute),
      slotStepMinutes: normalizeNumber(source.slotStepMinutes, DEFAULT_BOOKING_HOURS.slotStepMinutes),
      sameDayLeadMinutes: normalizeNumber(source.sameDayLeadMinutes, DEFAULT_BOOKING_HOURS.sameDayLeadMinutes),
      saturdayLastStartHour: normalizeNumber(
        source.saturdayLastStartHour,
        DEFAULT_BOOKING_HOURS.saturdayLastStartHour,
      ),
      saturdayLastStartMinute: normalizeNumber(
        source.saturdayLastStartMinute,
        DEFAULT_BOOKING_HOURS.saturdayLastStartMinute,
      ),
      concurrentAppointmentCapacity: normalizeNumber(
        source.concurrentAppointmentCapacity,
        DEFAULT_BOOKING_HOURS.concurrentAppointmentCapacity,
      ),
    };
    var weekdayHours = normalizeWeekdayHours(source.weekdayHours, base);
    if (weekdayHours) base.weekdayHours = weekdayHours;
    return base;
  }

  function coverStoragePath(value) {
    if (!value || typeof value !== 'object') {
      return typeof value === 'string' ? value : null;
    }
    return value.storage_path || value.storagePath || null;
  }

  function sizeLabelFromStyleId(styleId) {
    var parts = String(styleId || '').split('-');
    var last = parts[parts.length - 1];
    var sizes = { sm: 'SMALL', md: 'MEDIUM', lg: 'LARGE' };
    return sizes[last] || '';
  }

  function styleBookingName(item, styleId) {
    var title = item.title || styleId;
    var variant = item.sizeLabel || item.variant || sizeLabelFromStyleId(styleId);
    var name = title;
    if (variant && variant !== 'STANDARD') name += ' · ' + variant;
    return name;
  }

  function normalizeDurationMinutes(value) {
    var parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 120;
    return Math.min(720, Math.max(15, Math.round(parsed)));
  }

  function formatStyleDuration(minutes) {
    var mins = normalizeDurationMinutes(minutes);
    var hours = Math.floor(mins / 60);
    var remainder = mins % 60;
    if (hours <= 0) return remainder + ' min';
    if (remainder === 0) return hours === 1 ? '1 hr' : hours + ' hrs';
    if (hours === 1) return '1 hr ' + remainder + ' min';
    return hours + ' hrs ' + remainder + ' min';
  }

  function buildBookingStyles(meta, prices) {
    var styleIds = {};
    Object.keys(meta || {}).forEach(function (id) {
      styleIds[id] = true;
    });
    Object.keys(prices || {}).forEach(function (id) {
      styleIds[id] = true;
    });

    return Object.keys(styleIds)
      .map(function (styleId) {
        var item = meta[styleId] || {};
        var name = styleBookingName(item, styleId);
        var base = prices[styleId];
        if (typeof base !== 'number' || Number.isNaN(base)) base = 0;
        return {
          id: styleId,
          name: name,
          base: base,
          durationMinutes: normalizeDurationMinutes(item.durationMinutes),
        };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  function buildCatalogCards(meta, prices, covers, supabaseUrl) {
    var styleIds = {};
    Object.keys(meta || {}).forEach(function (id) {
      styleIds[id] = true;
    });
    Object.keys(prices || {}).forEach(function (id) {
      styleIds[id] = true;
    });
    Object.keys(covers || {}).forEach(function (id) {
      styleIds[id] = true;
    });

    function coverUrl(path) {
      if (!path || !supabaseUrl) return null;
      return supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/style-covers/' + String(path).replace(/^\/+/, '');
    }

    function formatPrice(amount) {
      if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) return 'Price TBD';
      return '$' + Math.round(amount);
    }

    return Object.keys(styleIds).map(function (styleId) {
      var item = meta[styleId] || {};
      var variant = item.sizeLabel || item.variant || sizeLabelFromStyleId(styleId);
      return {
        id: styleId,
        title: item.title || styleId,
        sizeLabel: variant || '',
        durationLabel: formatStyleDuration(item.durationMinutes),
        priceLabel: formatPrice(prices[styleId]),
        imageUrl: coverUrl(covers[styleId]),
        category: (item.category && String(item.category).trim()) || 'SERVICES',
      };
    });
  }

  function applySiteFooter(content) {
    var brandName = content && content.brandName ? String(content.brandName).trim() : '';
    var brandEl = document.getElementById('preview-footer-brand');
    if (brandEl && brandName) {
      brandEl.textContent = '\u00A9 ' + brandName;
    }
    var styldLink = document.getElementById('preview-footer-styld-link');
    if (styldLink) {
      var cfg = window.__STYLD_TENANT__ || {};
      styldLink.href = cfg.marketingUrl || 'https://styldd.com';
    }
  }

  /** Same theme tokens as tenant-site.js — colors, fonts, dark/light surfaces. */
  function applySiteTheme(theme) {
    theme = theme || {};
    var primary = theme.primaryColor || '#db2777';
    var secondary = theme.secondaryColor || '#0a0a0a';

    function hexToRgb(hex) {
      var clean = String(hex).replace('#', '');
      if (clean.length !== 6) return null;
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }
    function darken(hex, factor) {
      var rgb = hexToRgb(hex);
      if (!rgb) return hex;
      return (
        '#' +
        rgb
          .map(function (c) {
            return Math.max(0, Math.round(c * factor)).toString(16).padStart(2, '0');
          })
          .join('')
      );
    }
    function lighten(hex, factor) {
      var rgb = hexToRgb(hex);
      if (!rgb) return hex;
      return (
        '#' +
        rgb
          .map(function (c) {
            return Math.min(255, Math.round(c + (255 - c) * factor)).toString(16).padStart(2, '0');
          })
          .join('')
      );
    }
    function surfaceLuminance(hex) {
      var rgb = hexToRgb(hex);
      if (!rgb) return 1;
      return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    }

    var root = document.documentElement;
    root.style.setProperty('--pink', primary);
    root.style.setProperty('--pink-dark', darken(primary, 0.68));
    root.style.setProperty('--pink-heading', lighten(primary, 0.1));
    root.style.setProperty('--hero-pink', lighten(primary, 0.22));
    root.style.setProperty('--hero-pink-deep', darken(primary, 0.68));
    root.style.setProperty('--pink-light', lighten(primary, 0.22));
    root.style.setProperty('--ink', secondary);
    root.style.setProperty('--nav-text', secondary);

    var secRgb = hexToRgb(secondary);
    if (secRgb) {
      root.style.setProperty(
        '--muted',
        'rgba(' + secRgb[0] + ',' + secRgb[1] + ',' + secRgb[2] + ',0.62)',
      );
      root.style.setProperty(
        '--muted-soft',
        'rgba(' + secRgb[0] + ',' + secRgb[1] + ',' + secRgb[2] + ',0.46)',
      );
    }

    var bg = (theme.backgroundColor || '').trim();
    if (!bg || !/^#[0-9a-fA-F]{6}$/.test(bg)) {
      if (secRgb && surfaceLuminance(secondary) > 0.62) {
        bg = '#0a0a0a';
      }
    }
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
      root.style.setProperty('--cream', bg);
      root.style.setProperty('--white', bg);
      root.style.setProperty('--card-surface', bg);
      document.body.style.backgroundColor = bg;
      var darkSurface = surfaceLuminance(bg) < 0.45;
      root.style.setProperty(
        '--card-border',
        darkSurface ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      );
      root.style.setProperty(
        '--card-border-hover',
        darkSurface ? 'rgba(255, 255, 255, 0.2)' : 'rgba(219, 39, 119, 0.22)',
      );
      root.dataset.surfaceMode = darkSurface ? 'dark' : 'light';
    }

    var primRgb = hexToRgb(primary);
    if (primRgb) {
      var lum = (0.299 * primRgb[0] + 0.587 * primRgb[1] + 0.114 * primRgb[2]) / 255;
      root.style.setProperty('--filter-active-text', lum > 0.5 ? '#000000' : '#ffffff');
    }

    var navBg = (theme.navbarColor || '').trim();
    if (navBg && /^#[0-9a-fA-F]{6}$/.test(navBg)) {
      root.style.setProperty('--nav-bg', navBg);
      root.style.setProperty('--nav-bg-solid', navBg);
    }

    var cardOutline = (theme.cardOutlineColor || '').trim();
    if (cardOutline && /^#[0-9a-fA-F]{6}$/.test(cardOutline)) {
      root.style.setProperty('--card-outline', cardOutline);
    }

    var fontDisplayMap = {
      cormorant: '"Cormorant Garamond", Georgia, serif',
      playfair: '"Playfair Display", Georgia, serif',
      lora: '"Lora", Georgia, serif',
      inter: 'Inter, system-ui, sans-serif',
      'dm-sans': '"DM Sans", system-ui, sans-serif',
      poppins: 'Poppins, system-ui, sans-serif',
      nunito: '"Nunito", system-ui, sans-serif',
      montserrat: 'Montserrat, system-ui, sans-serif',
    };
    var fontBodyMap = {
      cormorant: '"Source Sans 3", system-ui, sans-serif',
      playfair: '"Source Sans 3", system-ui, sans-serif',
      lora: '"Source Sans 3", system-ui, sans-serif',
      inter: 'Inter, system-ui, sans-serif',
      'dm-sans': '"DM Sans", system-ui, sans-serif',
      poppins: 'Poppins, system-ui, sans-serif',
      nunito: '"Nunito", system-ui, sans-serif',
      montserrat: 'Montserrat, system-ui, sans-serif',
    };
    var fontId = theme.fontFamily || 'cormorant';
    root.style.setProperty('--font-display', fontDisplayMap[fontId] || fontDisplayMap.cormorant);
    root.style.setProperty('--font-body', fontBodyMap[fontId] || fontBodyMap.cormorant);
  }

  function applyPageBranding(site, options) {
    options = options || {};
    var content = (site && site.content) || {};
    var theme = (site && site.theme) || {};
    var cfg = window.__STYLD_TENANT__ || {};
    var brandName = content.brandName ? String(content.brandName).trim() : '';

    var brandEl = options.brandNameEl || document.getElementById('profile-brand-name');
    if (brandEl && brandName) brandEl.textContent = brandName;

    if (options.documentTitleSuffix && brandName) {
      document.title = brandName + ' | ' + options.documentTitleSuffix;
    }

    var logoEl = options.logoEl || document.getElementById('profile-logo-placeholder');
    if (logoEl && theme.logoImagePath && cfg.supabaseUrl) {
      var logoUrl =
        cfg.supabaseUrl.replace(/\/$/, '') +
        '/storage/v1/object/public/style-covers/' +
        String(theme.logoImagePath).replace(/^\/+/, '');
      logoEl.style.backgroundImage = 'url("' + logoUrl + '")';
      logoEl.style.backgroundSize = 'cover';
      logoEl.style.backgroundPosition = 'center';
    }

    var bookBtn = document.querySelector('.profile-book-btn');
    if (bookBtn) bookBtn.hidden = theme.hideBookNowButton === true;

    applySiteFooter(content);

    var statusOverlay = document.getElementById('tenant-status');
    if (statusOverlay) {
      statusOverlay.style.background = 'var(--cream, #faf8f4)';
      statusOverlay.style.color = 'var(--muted, #525252)';
    }
  }

  window.StyldTenant = {
    getSubdomain: getSubdomain,
    applySiteFooter: applySiteFooter,
    applySiteTheme: applySiteTheme,
    applyPageBranding: applyPageBranding,
    normalizeBookingHours: normalizeBookingHours,

    loadPublishedSite: function () {
      var cfg = window.__STYLD_TENANT__ || {};
      var subdomain = getSubdomain();
      if (!subdomain) {
        return Promise.reject(new Error('Site not found.'));
      }
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        return Promise.reject(new Error('Site host is not configured yet.'));
      }

      var headers = {
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + cfg.supabaseAnonKey,
      };

      function rest(path) {
        return fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, { headers: headers }).then(
          function (res) {
            if (!res.ok) throw new Error('Could not load site data.');
            return res.json();
          },
        );
      }

      return rest(
        'styld_site_subdomains?subdomain=eq.' + encodeURIComponent(subdomain) + '&select=user_id,published_at',
      )
        .then(function (rows) {
          var row = rows && rows[0];
          if (!row || !row.published_at) {
            throw new Error(
              'This site is temporarily offline. The owner needs an active Styld subscription to keep their booking site live.',
            );
          }
          return rest(
            'styld_site_records?user_id=eq.' +
              encodeURIComponent(row.user_id) +
              '&select=record_type,record_key,data',
          ).then(function (records) {
            var content = null;
            var theme = { heroLayout: 'split' };
            var meta = {};
            var prices = {};
            var covers = {};
            var bookingHours = null;
            var bookingPayment = null;
            var cancellationPolicy = null;

            records.forEach(function (record) {
              var value = settingValue(record);
              if (record.record_type === 'site_setting' && record.record_key === 'site_content') content = value;
              if (record.record_type === 'site_setting' && record.record_key === 'site_theme') {
                theme = Object.assign(theme, value || {});
              }
              if (record.record_type === 'site_setting' && record.record_key === 'style_catalog_meta') {
                meta = value || {};
              }
              if (record.record_type === 'site_setting' && record.record_key === 'style_price_overrides') {
                prices = value || {};
              }
              if (record.record_type === 'site_setting' && record.record_key === 'booking_hours') {
                bookingHours = value;
              }
              if (record.record_type === 'site_setting' && record.record_key === 'booking_payment') {
                bookingPayment = value;
              }
              if (record.record_type === 'site_setting' && record.record_key === 'cancellation_policy') {
                cancellationPolicy = value;
              }
              if (record.record_type === 'style_cover_image' && record.record_key) {
                var coverPath = coverStoragePath(value);
                if (typeof coverPath === 'string') covers[record.record_key] = coverPath;
              }
            });

            if (!content) throw new Error('Site content not found.');

            return {
              subdomain: subdomain,
              userId: row.user_id,
              content: content,
              theme: theme,
              meta: meta,
              prices: prices,
              covers: covers,
              bookingHours: normalizeBookingHours(bookingHours),
              bookingPayment: bookingPayment,
              cancellationPolicy: cancellationPolicy,
              bookingStyles: buildBookingStyles(meta, prices),
              catalogCards: buildCatalogCards(meta, prices, covers, cfg.supabaseUrl),
            };
          });
        });
    },
  };
})();
