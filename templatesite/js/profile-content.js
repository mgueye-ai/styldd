(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatSiteAddress(content) {
    if (!content) return '';
    return [content.addressLine1, content.addressLine2, content.city, content.state, content.zip]
      .filter(Boolean)
      .join(', ');
  }

  function buildGoogleMapsSearchUrl(address) {
    var query = String(address || '').trim();
    if (!query) return 'https://www.google.com/maps';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  function buildGoogleMapsEmbedUrl(content) {
    if (!content) return null;
    var custom = content.mapEmbedUrl ? String(content.mapEmbedUrl).trim() : '';
    if (custom) return custom;
    var address = formatSiteAddress(content).trim();
    if (!address) return null;
    return 'https://www.google.com/maps?q=' + encodeURIComponent(address) + '&output=embed';
  }

  function isSectionHidden(content, section) {
    if (!content || !Array.isArray(content.hiddenSections)) return false;
    return content.hiddenSections.indexOf(section) !== -1;
  }

  function isLocationPartHidden(content, part) {
    if (!content || !Array.isArray(content.hiddenLocationParts)) return false;
    return content.hiddenLocationParts.indexOf(part) !== -1;
  }

  function buildServiceCard(style, cardClass) {
    var cls = cardClass || 'profile-service-card';
    var imgStyle = style.imageUrl
      ? ' style="background-image:url(\'' +
        String(style.imageUrl).replace(/'/g, '%27') +
        '\');background-size:cover;background-position:center;"'
      : '';
    var bookHref = style.id
      ? '/booking?style=' + encodeURIComponent(style.id)
      : '/booking';
    return (
      '<a class="' + cls + '" href="' +
      escapeHtml(bookHref) +
      '">' +
      '<div class="profile-service-card__img" aria-hidden="true"' +
      imgStyle +
      '></div>' +
      '<div class="profile-service-card__body">' +
      '<div class="profile-service-card__name">' +
      escapeHtml(style.title || '') +
      '</div>' +
      (style.priceLabel
        ? '<div class="profile-service-card__price">' +
          escapeHtml(style.priceLabel) +
          '</div>'
        : '') +
      (style.durationLabel
        ? '<div class="profile-service-card__duration">' +
          escapeHtml(style.durationLabel) +
          '</div>'
        : '') +
      '</div></a>'
    );
  }

  function buildServiceCardWithCategory(style, cardClass) {
    var cat = (style.category || '').trim();
    var desc = (style.description || '').trim();
    var imgStyle = style.imageUrl
      ? ' style="background-image:url(\'' +
        String(style.imageUrl).replace(/'/g, '%27') +
        '\');background-size:cover;background-position:center;"'
      : '';
    var bookHref = style.id ? '/booking?style=' + encodeURIComponent(style.id) : '/booking';

    var cardHtml =
      '<a class="' + cardClass + '" href="' + escapeHtml(bookHref) + '">' +
      '<div class="profile-service-card__img" aria-hidden="true"' + imgStyle + '></div>' +
      '<div class="profile-service-card__body">' +
      '<div class="profile-service-card__name">' + escapeHtml(style.title || '') + '</div>' +
      (style.priceLabel ? '<div class="profile-service-card__price">' + escapeHtml(style.priceLabel) + '</div>' : '') +
      (style.durationLabel ? '<div class="profile-service-card__duration">' + escapeHtml(style.durationLabel) + '</div>' : '') +
      '</div>' +
      (desc ? '<span class="profile-service-card__has-desc" aria-hidden="true"></span>' : '') +
      '</a>';

    var expandHtml = desc
      ? '<button class="profile-service-card__expand-btn" type="button" aria-expanded="false">' +
        '<span class="profile-service-card__expand-label">About this service</span>' +
        '<svg class="profile-service-card__expand-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="profile-service-card__desc" hidden>' + escapeHtml(desc) + '</div>'
      : '';

    return '<div class="profile-service-card-wrap"' +
      (cat ? ' data-category="' + escapeHtml(cat) + '"' : '') +
      '>' +
      cardHtml +
      expandHtml +
      '</div>';
  }

  function buildProfileServiceCards(styles, theme) {
    var layout = theme && theme.styleCardLayout;
    var cardClass = layout === 'outlined'
      ? 'profile-service-card profile-service-card--outlined'
      : 'profile-service-card';

    if (!styles || !styles.length) {
      return (
        '<a class="' + cardClass + '" href="/booking">' +
        '<div class="profile-service-card__img"></div>' +
        '<div class="profile-service-card__body">' +
        '<div class="profile-service-card__name">Add your services</div>' +
        '<div class="profile-service-card__price">in the Styld app</div>' +
        '</div></a>'
      );
    }

    var styleCardLayout = layout === 'pill' ? 'pill' : layout === 'outlined' ? 'outlined' : 'card';

    if (styleCardLayout === 'pill') {
      return buildProfileStylePills(styles);
    }

    // Collect ordered unique categories
    var categoryOrder = [];
    var grouped = {};
    styles.slice(0, 24).forEach(function (style) {
      var cat = (style.category || '').trim();
      if (!grouped[cat]) {
        grouped[cat] = [];
        categoryOrder.push(cat);
      }
      grouped[cat].push(style);
    });

    var namedCategories = categoryOrder.filter(function (c) { return c !== ''; });

    // Render all cards with data-category, letting the filter handle visibility
    var allCards = styles.slice(0, 24)
      .map(function (s) { return buildServiceCardWithCategory(s, cardClass); })
      .join('');

    // Build category filter tabs if there are named categories
    if (namedCategories.length > 0) {
      var filtersEl = document.getElementById('profile-menu-filters');
      if (filtersEl) {
        var tabsHtml = '<button class="profile-menu-filter profile-menu-filter--active" data-filter="__all__">All</button>';
        namedCategories.forEach(function (cat) {
          tabsHtml += '<button class="profile-menu-filter" data-filter="' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</button>';
        });
        filtersEl.innerHTML = tabsHtml;
        filtersEl.hidden = false;

        filtersEl.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest ? e.target.closest('.profile-menu-filter') : e.target;
          if (!btn || !btn.dataset || !btn.dataset.filter) return;
          var filter = btn.dataset.filter;

          // Update active tab
          filtersEl.querySelectorAll('.profile-menu-filter').forEach(function (b) {
            b.classList.toggle('profile-menu-filter--active', b === btn);
          });

          // Show / hide card wrappers
          var grid = document.getElementById('profile-service-grid');
          if (!grid) return;
          grid.querySelectorAll('.profile-service-card-wrap').forEach(function (wrap) {
            if (filter === '__all__') {
              wrap.hidden = false;
            } else {
              wrap.hidden = (wrap.dataset.category || '') !== filter;
            }
          });
        });
      }
    }

    return allCards;
  }

  function buildProfileStylePills(styles) {
    return (
      '<div class="style-pill-list" style="grid-column:1/-1">' +
      styles
        .slice(0, 20)
        .map(function (style) {
          var imgHtml = style.imageUrl
            ? '<div class="style-pill__img--bg" style="background-image:url(\'' +
              String(style.imageUrl).replace(/'/g, '%27') +
              '\')"></div>'
            : '<div class="style-pill__img"></div>';
          var bookHref = style.id
            ? '/booking?style=' + encodeURIComponent(style.id)
            : '/booking';
          var desc = style.durationLabel ? escapeHtml(style.durationLabel) : '';
          var price = style.priceLabel
            ? '<span class="style-pill__price">' + escapeHtml(style.priceLabel) + '</span>'
            : '';
          return (
            '<a class="style-pill" href="' +
            escapeHtml(bookHref) +
            '">' +
            imgHtml +
            '<div class="style-pill__body">' +
            '<div class="style-pill__name">' +
            escapeHtml(style.title || '') +
            '</div>' +
            (desc
              ? '<div class="style-pill__desc">' + desc + '</div>'
              : '') +
            '</div>' +
            price +
            '</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function populateLocationInfo(content) {
    var infoEl = document.getElementById('profile-location-info');
    if (!infoEl) return;

    var html = '';
    var address = formatSiteAddress(content).trim();
    var addressHidden = isLocationPartHidden(content, 'address');
    var contactHidden = isLocationPartHidden(content, 'contact');
    var socialHidden = isLocationPartHidden(content, 'social');

    var hasAddress = false;
    if (!addressHidden && address) {
      hasAddress = true;
      var mapsUrl = buildGoogleMapsSearchUrl(address);
      html +=
        '<div class="profile-location-col"><h3>Address</h3>' +
        '<p><a href="' + escapeHtml(mapsUrl) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(address) + '</a></p></div>';
    }

    var hasContact = false;
    if (!contactHidden) {
      var contactHtml =
        (content.phoneDisplay ? '<p>' + escapeHtml(content.phoneDisplay) + '</p>' : '') +
        (content.email
          ? '<p><a href="mailto:' + escapeHtml(content.email) + '">' + escapeHtml(content.email) + '</a></p>'
          : '');
      if (contactHtml) {
        hasContact = true;
        html += '<div class="profile-location-col"><h3>Contact</h3>' + contactHtml + '</div>';
      }
    }

    var hasSocial = false;
    if (!socialHidden) {
      var handle = (content.instagramHandle || '').replace(/^@/, '').trim();
      if (handle) {
        hasSocial = true;
        var igUrl = 'https://www.instagram.com/' + encodeURIComponent(handle) + '/';
        html +=
          '<div class="profile-location-col"><h3>Social</h3>' +
          '<p class="profile-ig-link">' +
          '<a href="' + escapeHtml(igUrl) + '" target="_blank" rel="noopener noreferrer">' +
          '<svg class="profile-ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' +
          '@' + escapeHtml(handle) +
          '</a></p></div>';
      }
    }

    infoEl.innerHTML = html;

    // Smart section title based on what's actually visible
    var visitSection = document.querySelector('[data-site-section="visit"]');
    var visitTitleEl = document.getElementById('profile-visit-title');

    if (!hasAddress && !hasContact && !hasSocial) {
      if (visitSection) visitSection.hidden = true;
    } else {
      if (visitSection) visitSection.hidden = false;
      if (visitTitleEl) {
        if (!hasAddress) {
          visitTitleEl.textContent = 'Connect';
        } else if (!hasContact && !hasSocial) {
          visitTitleEl.textContent = 'Visit';
        } else {
          visitTitleEl.textContent = content.visitTitle || 'Visit & Connect';
        }
      }
    }
  }

  window.applyStyldPreviewContent = function applyStyldPreviewContent() {
    var content = window.__STYLD_SITE_CONTENT__;
    if (!content || typeof content !== 'object') return;

    var theme = window.__STYLD_SITE_THEME__ || {};
    var styles = window.__STYLD_SITE_STYLES__ || [];

    // Brand name
    var brandNameEl = document.getElementById('profile-brand-name');
    if (brandNameEl) brandNameEl.textContent = content.brandName || '';

    document.title = (content.brandName || 'Your Brand') + ' | Book online';

    // Logo
    if (theme.logoImageUrl) {
      var logoPlaceholder = document.getElementById('profile-logo-placeholder');
      if (logoPlaceholder) {
        var logoImg = document.createElement('img');
        logoImg.className = 'profile-brand__logo-img';
        logoImg.src = theme.logoImageUrl;
        logoImg.alt = '';
        logoImg.width = 38;
        logoImg.height = 38;
        logoImg.decoding = 'async';
        logoPlaceholder.replaceWith(logoImg);
      }
    }

    // Hero layout — apply cover/stack class and inject overlays if needed
    var heroSection = document.querySelector('.profile-hero');
    var heroPhoto = document.getElementById('profile-hero-photo');
    var isCover = theme.heroLayout === 'cover';
    var isStack = theme.heroLayout === 'stack';

    if (isCover && heroSection) {
      heroSection.classList.add('profile-hero--cover');

      // Inject overlay with brand name + Book Now inside the photo div
      if (heroPhoto) {
        heroPhoto.style.position = 'relative';
        var overlay = document.createElement('div');
        overlay.className = 'profile-cover-overlay';
        var brandSpan = document.createElement('span');
        brandSpan.className = 'profile-brand';
        brandSpan.textContent = content.brandName || '';
        var bookBtn = document.createElement('a');
        bookBtn.className = 'profile-book-btn';
        bookBtn.href = '/booking';
        bookBtn.textContent = 'Book Now';
        overlay.appendChild(brandSpan);
        overlay.appendChild(bookBtn);
        heroPhoto.appendChild(overlay);
      }

      // Hide the nav brand name (shown in overlay instead)
      var navBrand = document.querySelector('.profile-brand');
      if (navBrand && navBrand !== heroPhoto) {
        navBrand.style.visibility = 'hidden';
      }
    }

    if (isStack && heroSection) {
      heroSection.classList.add('profile-hero--stack');
      var stackUrls = Array.isArray(theme.heroStackImageUrls) ? theme.heroStackImageUrls : [];
      if (stackUrls.length > 0) {
        // Build the stack gallery and insert before .profile-hero__grid
        var stackEl = document.createElement('div');
        stackEl.className = 'profile-hero-stack';
        stackUrls.forEach(function(url) {
          var img = document.createElement('img');
          img.src = url;
          img.className = 'profile-hero-stack__img';
          img.alt = '';
          img.loading = 'lazy';
          stackEl.appendChild(img);
        });
        var heroGrid = heroSection.querySelector('.profile-hero__grid');
        if (heroGrid) {
          heroSection.insertBefore(stackEl, heroGrid);
        } else {
          heroSection.prepend(stackEl);
        }
        // Hide the single hero photo slot — stack replaces it
        if (heroPhoto) heroPhoto.style.display = 'none';
      }
    }

    if (!isStack && heroPhoto && theme.heroImageUrl) {
      heroPhoto.style.backgroundImage =
        "url('" + String(theme.heroImageUrl).replace(/'/g, '%27') + "')";
    }

    // About & policy sections — only visible for the "split" hero layout
    var isSplit = theme.heroLayout === 'split';
    var profileInfo = document.querySelector('.profile-info');
    if (profileInfo) profileInfo.style.display = isSplit ? '' : 'none';

    // About title — always "About Me"
    var aboutTitleEl = document.getElementById('profile-about-title');
    if (aboutTitleEl) aboutTitleEl.textContent = 'About Me';

    // About text
    var aboutEl = document.getElementById('profile-about-body');
    if (aboutEl) {
      aboutEl.textContent = content.heroDescription || '';
    }

    // Policy bullets — bookingPolicy is newline-separated; render as <ul><li> list
    var policyEl = document.getElementById('profile-policy-body');
    var policyBlock = document.getElementById('profile-policy-block');
    if (policyEl) {
      var policyText = (content.bookingPolicy || '').trim();
      var bullets = policyText
        ? policyText.split('\n').map(function(l){ return l.trim(); }).filter(Boolean)
        : [];
      policyEl.innerHTML = '';
      bullets.forEach(function(bullet) {
        var li = document.createElement('li');
        li.textContent = bullet;
        policyEl.appendChild(li);
      });
      if (policyBlock) {
        policyBlock.hidden = !isSplit || bullets.length === 0;
      }
    }

    // Menu title & blurb
    var menuTitleEl = document.getElementById('profile-menu-title');
    if (menuTitleEl) menuTitleEl.textContent = content.menuTitle || 'Menu';
    var menuBlurbEl = document.getElementById('profile-menu-blurb');
    if (menuBlurbEl) menuBlurbEl.textContent = content.menuBlurb || '';

    // Service cards
    var serviceGrid = document.getElementById('profile-service-grid');
    if (serviceGrid) {
      serviceGrid.innerHTML = buildProfileServiceCards(styles, theme);

      // Description expand/collapse via event delegation
      serviceGrid.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest
          ? e.target.closest('.profile-service-card__expand-btn')
          : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        var wrap = btn.closest('.profile-service-card-wrap');
        if (!wrap) return;
        var descEl = wrap.querySelector('.profile-service-card__desc');
        if (!descEl) return;
        var opening = descEl.hidden;
        descEl.hidden = !opening;
        btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
        btn.classList.toggle('is-open', opening);
      });
    }

    // Location info columns (also handles visit title + section visibility)
    populateLocationInfo(content);

    // Map
    var mapFrame = document.getElementById('profile-map');
    if (mapFrame) {
      var embedUrl = buildGoogleMapsEmbedUrl(content);
      if (embedUrl && !isLocationPartHidden(content, 'map')) {
        mapFrame.src = embedUrl;
        mapFrame.title = 'Map to ' + formatSiteAddress(content);
        mapFrame.style.display = '';
      } else {
        mapFrame.style.display = 'none';
      }
    }

    // Section visibility
    document.querySelectorAll('[data-site-section]').forEach(function (el) {
      var sectionId = el.getAttribute('data-site-section');
      if (sectionId) el.hidden = isSectionHidden(content, sectionId);
    });

    // Footer
    if (window.StyldTenant && window.StyldTenant.applySiteFooter) {
      window.StyldTenant.applySiteFooter(content);
    } else {
      var footerBrand = document.getElementById('preview-footer-brand');
      if (footerBrand && content.brandName) {
        footerBrand.textContent = '\u00A9 ' + content.brandName;
      }
    }
  };

  if (window.__STYLD_SITE_CONTENT__) {
    window.applyStyldPreviewContent();
  }
})();
