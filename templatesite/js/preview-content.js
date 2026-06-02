(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function heroImageStyle(url) {
    if (!url) return '';
    return (
      " style=\"background-image:url('" +
      String(url).replace(/'/g, '%27') +
      "');background-size:cover;background-position:center;\""
    );
  }

  function buildHeroCtasHtml() {
    return (
      '<div class="hero-ctas hero-ctas--landing hero-ctas--scale">' +
      '<a class="hero-btn hero-btn--outline-light hero-btn--lg" href="#preview-menu-section">Browse menu &amp; prices</a>' +
      '<a class="hero-btn hero-btn--gold hero-btn--lg" href="#preview-visit-section">Book now</a>' +
      '</div>'
    );
  }

  function buildHeroInnerHtml(content, theme) {
    var brand = escapeHtml(content.brandName || 'Your brand name');
    var left = escapeHtml(content.taglineLeft || 'Put your');
    var r1 = escapeHtml(content.taglineRightLine1 || 'style');
    var r2 = escapeHtml(content.taglineRightLine2 || 'here');
    var layout = (theme && theme.heroLayout) || 'split';
    var heroUrl = theme && theme.heroImageUrl ? theme.heroImageUrl : null;
    var photoClass = heroUrl ? ' hero-scale-visual--photo' : '';
    var photoStyle = heroImageStyle(heroUrl);
    var ctas = buildHeroCtasHtml();
    var placeholderImg =
      '<img class="hero-scale-visual__img" src="/assets/placeholders/hero.svg" alt="" width="560" height="840" decoding="async" />';

    if (layout === 'minimal') {
      return (
        '<div class="hero-scale-layout hero-layout--minimal">' +
        '<h1 class="hero-scale-title"><span class="hero-scale-title__grid">' +
        '<span class="hero-scale-col hero-scale-col--center">' +
        '<span class="hero-scale-kicker" id="preview-kicker">' +
        brand +
        '</span>' +
        '<span class="hero-scale-display hero-scale-display--ink" id="preview-tagline-left">' +
        left +
        '</span>' +
        '<span class="hero-scale-display hero-scale-display--brand">' +
        '<span class="hero-scale-display__line" id="preview-tagline-right-1">' +
        r1 +
        '</span>' +
        '<span class="hero-scale-display__line" id="preview-tagline-right-2">' +
        r2 +
        '</span>' +
        '</span></span></span></h1>' +
        ctas +
        '</div>'
      );
    }

    if (layout === 'image-below') {
      return (
        '<div class="hero-scale-layout hero-layout--image-below">' +
        '<span class="hero-scale-visual' +
        photoClass +
        '"' +
        photoStyle +
        '>' +
        (heroUrl ? '' : placeholderImg) +
        '</span>' +
        '<h1 class="hero-scale-title">' +
        '<span class="hero-scale-col hero-scale-col--center">' +
        '<span class="hero-scale-kicker" id="preview-kicker">' +
        brand +
        '</span>' +
        '<span class="hero-scale-display hero-scale-display--ink" id="preview-tagline-left">' +
        left +
        '</span>' +
        '<span class="hero-scale-display hero-scale-display--brand">' +
        '<span class="hero-scale-display__line" id="preview-tagline-right-1">' +
        r1 +
        '</span>' +
        '<span class="hero-scale-display__line" id="preview-tagline-right-2">' +
        r2 +
        '</span>' +
        '</span></span></h1>' +
        ctas +
        '</div>'
      );
    }

    return (
      '<div class="hero-scale-layout hero-layout--split">' +
      '<h1 class="hero-scale-title">' +
      '<span class="hero-scale-title__grid">' +
      '<span class="hero-scale-col hero-scale-col--left">' +
      '<span class="hero-scale-kicker" id="preview-kicker">' +
      brand +
      '</span>' +
      '<span class="hero-scale-display hero-scale-display--ink" id="preview-tagline-left">' +
      left +
      '</span>' +
      '</span>' +
      '<span class="hero-scale-visual' +
      photoClass +
      '"' +
      photoStyle +
      '>' +
      (heroUrl ? '' : placeholderImg) +
      '</span>' +
      '<span class="hero-scale-col hero-scale-col--right">' +
      '<span class="hero-scale-display hero-scale-display--brand">' +
      '<span class="hero-scale-display__line" id="preview-tagline-right-1">' +
      r1 +
      '</span>' +
      '<span class="hero-scale-display__line" id="preview-tagline-right-2">' +
      r2 +
      '</span>' +
      '</span></span></span></h1>' +
      ctas +
      '</div>'
    );
  }

  function buildInstagramReelsHtml(content) {
    var handle = (content.instagramHandle || 'yourhandle').replace(/^@/, '');
    var igUrl = 'https://www.instagram.com/' + encodeURIComponent(handle) + '/';
    var slides = [
      { title: 'Recent work', caption: 'Tap to view on Instagram' },
      { title: 'Client features', caption: 'Fresh styles & transformations' },
      { title: 'Behind the chair', caption: 'Process, prep, and finished looks' },
      { title: 'Book from Instagram', caption: 'DM or link in bio to schedule' },
    ];

    return slides
      .map(function (slide) {
        return (
          '<div class="reels-carousel__slide">' +
          '<a class="ig-reel-card" href="' +
          escapeHtml(igUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="ig-reel-card__media" aria-hidden="true">' +
          '<img class="ig-reel-card__thumb" src="/assets/placeholders/reel.svg" alt="" width="640" height="1136" loading="lazy" decoding="async" />' +
          '<span class="ig-reel-card__play">▶</span>' +
          '</span>' +
          '<span class="ig-reel-card__body">' +
          '<span class="ig-reel-card__handle">@' +
          escapeHtml(handle) +
          '</span>' +
          '<strong>' +
          escapeHtml(slide.title) +
          '</strong>' +
          '<span>' +
          escapeHtml(slide.caption) +
          '</span>' +
          '</span></a></div>'
        );
      })
      .join('');
  }

  function buildMenuStyleCardsHtml(styles) {
    if (!styles || !styles.length) {
      return (
        '<div class="style-card-wrap"><article class="style-card">' +
        '<div class="style-card__media"></div>' +
        '<div class="style-card__body"><h3>Add styles</h3>' +
        '<p>Your service menu appears here once you add styles in the app.</p></div>' +
        '</article></div>'
      );
    }

    return styles
      .slice(0, 12)
      .map(function (style) {
        var media = style.imageUrl
          ? ' style="background-image:url(\'' +
            String(style.imageUrl).replace(/'/g, '%27') +
            '\');background-size:cover;background-position:center;"'
          : '';
        var desc = style.description || 'Book this style online.';
        var price = style.priceLabel || '';
        return (
          '<a class="style-card-wrap" href="#">' +
          '<article class="style-card">' +
          '<div class="style-card__media"' +
          media +
          '></div>' +
          '<div class="style-card__body">' +
          '<h3>' +
          escapeHtml(style.title || '') +
          '</h3>' +
          '<p>' +
          escapeHtml(desc) +
          '</p>' +
          (price ? '<p class="price">' + escapeHtml(price) + '</p>' : '') +
          '</div></article></a>'
        );
      })
      .join('');
  }

  window.applyStyldPreviewContent = function applyStyldPreviewContent() {
    var content = window.__STYLD_SITE_CONTENT__;
    if (!content || typeof content !== 'object') return;

    function setText(id, value) {
      var el = document.getElementById(id);
      if (el && value != null) el.textContent = String(value);
    }

    setText('preview-brand', content.brandName);
    setText('preview-reels-title', content.reelsTitle);
    setText('preview-reels-blurb', content.reelsBlurb);
    setText('preview-menu-title', content.menuTitle || 'Menu');
    setText('preview-menu-blurb', content.menuBlurb || 'Browse our services & prices — book online.');
    setText('preview-about-title', content.aboutTitle);
    setText('preview-about-body', content.aboutBody);
    setText('preview-visit-title', content.visitTitle);
    setText('preview-visit-body', content.visitBody);
    setText('preview-address', content.addressLine1);
    setText('preview-city-line', [content.city, content.state, content.zip].filter(Boolean).join(', '));
    setText('preview-phone', content.phoneDisplay);
    setText('preview-email', content.email || 'hello@yoursite.com');
    setText('preview-footer-text', content.footerText);
    setText('preview-footer-brand', content.brandName);
    setText('preview-footer-tagline', content.metaDescription);

    var handle = (content.instagramHandle || 'yourhandle').replace(/^@/, '');
    setText('preview-instagram', '@' + handle);

    var reelsNote = document.getElementById('preview-reels-note');
    if (reelsNote) {
      var igUrl = 'https://www.instagram.com/' + encodeURIComponent(handle) + '/';
      reelsNote.innerHTML =
        'Follow <a href="' +
        escapeHtml(igUrl) +
        '" target="_blank" rel="noopener noreferrer">@' +
        escapeHtml(handle) +
        '</a> for the latest work.';
    }

    var mapFrame = document.getElementById('preview-map');
    if (mapFrame && content.mapEmbedUrl) {
      mapFrame.src = content.mapEmbedUrl;
    }

    document.title = (content.brandName || 'Your site') + ' | Book online';

    var theme = window.__STYLD_SITE_THEME__ || { heroLayout: 'split', heroImageUrl: null, logoImageUrl: null };
    var heroInner = document.getElementById('preview-hero-inner');
    if (heroInner) {
      if (window.__STYLD_HERO_HTML__) {
        heroInner.innerHTML = window.__STYLD_HERO_HTML__;
      } else {
        heroInner.innerHTML = buildHeroInnerHtml(content, theme);
      }
    }

    var logo = document.querySelector('.hero-brand__logo');
    if (logo && theme.logoImageUrl) {
      logo.src = theme.logoImageUrl;
    }

    var reelsTrack = document.getElementById('preview-reels-track');
    if (reelsTrack) {
      reelsTrack.innerHTML = buildInstagramReelsHtml(content);
    }

    var grid = document.getElementById('preview-style-grid');
    if (grid) {
      grid.innerHTML = buildMenuStyleCardsHtml(window.__STYLD_SITE_STYLES__ || []);
    }
  };

  if (window.__STYLD_SITE_CONTENT__) {
    window.applyStyldPreviewContent();
  }
})();
