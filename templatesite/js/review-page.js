(function () {
  var els = {
    statusOverlay: document.getElementById('tenant-status'),
    brandName: document.getElementById('profile-brand-name'),
    logo: document.getElementById('profile-logo-placeholder'),
    status: document.getElementById('review-status'),
    form: document.getElementById('review-form'),
    name: document.getElementById('review-name'),
    message: document.getElementById('review-message'),
    stars: document.getElementById('review-stars'),
    submit: document.getElementById('review-submit'),
    sub: document.getElementById('review-page-sub'),
    title: document.getElementById('review-page-title'),
  };

  var cfg = window.__STYLD_TENANT__ || {};
  var rootDomain = cfg.rootDomain || 'styldd.com';
  var params = new URLSearchParams(window.location.search);
  var token = (params.get('token') || '').trim();
  var subdomain = (params.get('subdomain') || '').trim();
  var selectedRating = 5;

  if (!subdomain && window.StyldTenant && typeof window.StyldTenant.getSubdomain === 'function') {
    subdomain = window.StyldTenant.getSubdomain() || '';
  }
  if (!subdomain) {
    var host = (window.location.hostname || '').toLowerCase();
    if (host.endsWith('.' + rootDomain) && host !== rootDomain) {
      subdomain = host.slice(0, -(rootDomain.length + 1));
    }
  }

  function setLoading(show, message) {
    if (!els.statusOverlay) return;
    if (show) {
      els.statusOverlay.hidden = false;
      if (message) els.statusOverlay.textContent = message;
    } else {
      els.statusOverlay.hidden = true;
    }
  }

  function setFeedback(message, kind) {
    if (!els.status) return;
    els.status.hidden = !message;
    els.status.textContent = message || '';
    els.status.classList.remove('is-error', 'is-success');
    if (message && kind === 'error') els.status.classList.add('is-error');
    if (message && kind === 'success') els.status.classList.add('is-success');
  }

  function paintStars() {
    if (!els.stars) return;
    els.stars.querySelectorAll('button[data-star]').forEach(function (btn) {
      var star = Number(btn.getAttribute('data-star'));
      btn.classList.toggle('is-active', star <= selectedRating);
    });
  }

  function applyTheme(site) {
    var content = site.content || {};
    var theme = site.theme || {};
    var root = document.documentElement;

    if (content.brandName && els.brandName) {
      els.brandName.textContent = content.brandName;
      document.title = (content.brandName || 'Leave a review') + ' | Leave a review';
    }

    if (els.logo && theme.logoImagePath && cfg.supabaseUrl) {
      var logoUrl =
        cfg.supabaseUrl.replace(/\/$/, '') +
        '/storage/v1/object/public/style-covers/' +
        String(theme.logoImagePath).replace(/^\/+/, '');
      els.logo.style.backgroundImage = 'url("' + logoUrl + '")';
      els.logo.style.backgroundSize = 'cover';
      els.logo.style.backgroundPosition = 'center';
    }

    var primary = theme.primaryColor || '#db2777';
    var secondary = theme.secondaryColor || '#0a0a0a';
    root.style.setProperty('--pink', primary);
    root.style.setProperty('--pink-dark', primary);
    root.style.setProperty('--ink', secondary);
    root.style.setProperty('--nav-text', secondary);

    var navBg = (theme.navbarColor || '').trim();
    if (navBg && /^#[0-9a-fA-F]{6}$/.test(navBg)) {
      root.style.setProperty('--nav-bg', navBg);
      root.style.setProperty('--nav-bg-solid', navBg);
    }

    var bg = (theme.backgroundColor || '').trim();
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
      root.style.setProperty('--cream', bg);
      root.style.setProperty('--white', bg);
      document.body.style.backgroundColor = bg;
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

    if (window.StyldTenant && window.StyldTenant.applySiteFooter) {
      window.StyldTenant.applySiteFooter(content);
    }
  }

  function rpcHeaders() {
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: 'Bearer ' + cfg.supabaseAnonKey,
      'Content-Type': 'application/json',
    };
  }

  function getReviewContext() {
    var rpcUrl = cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/styld_tenant_get_review_context';
    return fetch(rpcUrl, {
      method: 'POST',
      headers: rpcHeaders(),
      body: JSON.stringify({ p_subdomain: subdomain, p_token: token }),
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var msg = body.message || body.error || body.hint || 'Could not open review link';
          throw new Error(msg);
        }
        return body;
      });
    });
  }

  if (els.stars) {
    els.stars.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-star]') : null;
      if (!btn) return;
      selectedRating = Number(btn.getAttribute('data-star')) || 5;
      paintStars();
    });
    paintStars();
  }

  async function init() {
    if (!token) {
      setLoading(false);
      setFeedback('This review link is invalid.', 'error');
      return;
    }
    if (!subdomain) {
      setLoading(false);
      setFeedback('Site not found.', 'error');
      return;
    }
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      setLoading(false);
      setFeedback('This site is not configured yet.', 'error');
      return;
    }
    if (!window.StyldTenant || typeof window.StyldTenant.loadPublishedSite !== 'function') {
      setLoading(false);
      setFeedback('This page is not configured yet.', 'error');
      return;
    }

    try {
      var site = await window.StyldTenant.loadPublishedSite();
      applyTheme(site);

      var ctx = await getReviewContext();
      if (els.form) els.form.hidden = false;
      if (els.name && ctx.client_name) els.name.value = ctx.client_name;
      if (els.sub && ctx.service) {
        els.sub.textContent = 'How was your ' + ctx.service + '?';
      }
      if (els.title && site.content && site.content.brandName) {
        els.title.textContent = 'Review ' + site.content.brandName;
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setFeedback(err && err.message ? err.message : 'Could not open review link', 'error');
    }
  }

  if (els.form) {
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!els.message || !els.message.value.trim()) {
        setFeedback('Please write a short message.', 'error');
        return;
      }

      els.submit.disabled = true;
      setFeedback('Submitting…');

      fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/styld_tenant_submit_review', {
        method: 'POST',
        headers: rpcHeaders(),
        body: JSON.stringify({
          p_subdomain: subdomain,
          p_token: token,
          p_rating: selectedRating,
          p_message: els.message.value.trim(),
          p_client_name: els.name ? els.name.value.trim() : null,
        }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) {
              var msg = body.message || body.error || body.hint || 'Could not submit review';
              throw new Error(msg);
            }
            return body;
          });
        })
        .then(function () {
          els.form.hidden = true;
          setFeedback('Thank you! Your review has been published on the site.', 'success');
        })
        .catch(function (err) {
          els.submit.disabled = false;
          setFeedback(err && err.message ? err.message : 'Could not submit review', 'error');
        });
    });
  }

  init();
})();
