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

  function buildServiceCard(style) {
    var imgStyle = style.imageUrl
      ? ' style="background-image:url(\'' +
        String(style.imageUrl).replace(/'/g, '%27') +
        '\');background-size:cover;background-position:center;"'
      : '';
    var bookHref = style.id
      ? '/booking?style=' + encodeURIComponent(style.id)
      : '/booking';
    return (
      '<a class="profile-service-card" href="' +
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

  function buildProfileServiceCards(styles, theme) {
    if (!styles || !styles.length) {
      return (
        '<a class="profile-service-card" href="/booking">' +
        '<div class="profile-service-card__img"></div>' +
        '<div class="profile-service-card__body">' +
        '<div class="profile-service-card__name">Add your services</div>' +
        '<div class="profile-service-card__price">in the Styld app</div>' +
        '</div></a>'
      );
    }

    var styleCardLayout =
      theme && theme.styleCardLayout === 'pill' ? 'pill' : 'card';

    if (styleCardLayout === 'pill') {
      return buildProfileStylePills(styles);
    }

    // Group by category — styles without a category go into an unnamed group
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

    var hasCategories = categoryOrder.some(function (c) { return c !== ''; });

    if (!hasCategories) {
      return styles.slice(0, 24).map(buildServiceCard).join('');
    }

    return categoryOrder.map(function (cat) {
      var cards = grouped[cat].map(buildServiceCard).join('');
      var header = cat
        ? '<div class="catalog-section" style="grid-column:1/-1">' +
          '<div class="catalog-section__header">' +
          '<span class="catalog-section__title">' + escapeHtml(cat) + '</span>' +
          '<span class="catalog-section__rule"></span>' +
          '</div></div>'
        : '';
      return header + cards;
    }).join('');
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

    if (!isLocationPartHidden(content, 'address') && address) {
      var mapsUrl = buildGoogleMapsSearchUrl(address);
      html +=
        '<div class="profile-location-col"><h3>Address</h3>' +
        '<p><a href="' +
        escapeHtml(mapsUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(address) +
        '</a></p></div>';
    }

    if (!isLocationPartHidden(content, 'contact')) {
      var handle = (content.instagramHandle || '').replace(/^@/, '').trim();
      var igUrl = handle
        ? 'https://www.instagram.com/' + encodeURIComponent(handle) + '/'
        : '';
      var contactHtml =
        (content.phoneDisplay
          ? '<p>' + escapeHtml(content.phoneDisplay) + '</p>'
          : '') +
        (content.email
          ? '<p><a href="mailto:' +
            escapeHtml(content.email) +
            '">' +
            escapeHtml(content.email) +
            '</a></p>'
          : '') +
        (handle
          ? '<p><a href="' +
            escapeHtml(igUrl) +
            '" target="_blank" rel="noopener noreferrer">@' +
            escapeHtml(handle) +
            '</a></p>'
          : '');
      if (contactHtml) {
        html +=
          '<div class="profile-location-col"><h3>Contact</h3>' +
          contactHtml +
          '</div>';
      }
    }

    infoEl.innerHTML = html;
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

    // Hero photo
    var heroPhoto = document.getElementById('profile-hero-photo');
    if (heroPhoto && theme.heroImageUrl) {
      heroPhoto.style.backgroundImage =
        "url('" + String(theme.heroImageUrl).replace(/'/g, '%27') + "')";
    }

    // About text
    var aboutEl = document.getElementById('profile-about-body');
    if (aboutEl) {
      aboutEl.textContent = content.heroDescription || '';
    }

    // Policy text
    var policyEl = document.getElementById('profile-policy-body');
    var policyBlock = document.getElementById('profile-policy-block');
    if (policyEl) {
      var policyText = content.bookingPolicy || '';
      policyEl.textContent = policyText;
      if (policyBlock) {
        policyBlock.hidden = !policyText;
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
    }

    // Visit title
    var visitTitleEl = document.getElementById('profile-visit-title');
    if (visitTitleEl) visitTitleEl.textContent = content.visitTitle || 'Location';

    // Location info columns
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
