(function () {
  if (!window.StyldTenant) return;
  if (!window.StyldTenant.getSubdomain()) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cardHtml(card) {
    var mediaClass = card.imageUrl
      ? 'catalog-service-card__media catalog-service-card__media--photo'
      : 'catalog-service-card__media';
    var media = card.imageUrl
      ? ' style="background-image:url(\'' + String(card.imageUrl).replace(/'/g, '%27') + '\');"'
      : '';
    var sizeHtml = card.sizeLabel
      ? '<span class="catalog-service-card__size">' + escapeHtml(card.sizeLabel) + '</span>'
      : '';
    var durationHtml = card.durationLabel
      ? '<span class="catalog-service-card__duration">' + escapeHtml(card.durationLabel) + '</span>'
      : '';
    var priceHtml = card.priceLabel
      ? '<span class="catalog-service-card__price">' + escapeHtml(card.priceLabel) + '</span>'
      : '';
    return (
      '<a class="catalog-service-card" href="/booking?style=' +
      encodeURIComponent(card.id) +
      '">' +
      '<div class="' +
      mediaClass +
      '" aria-hidden="true"' +
      media +
      '></div>' +
      '<div class="catalog-service-card__body">' +
      '<span class="catalog-service-card__title">' +
      escapeHtml(card.title) +
      '</span>' +
      '<div class="catalog-service-card__mid">' +
      sizeHtml +
      durationHtml +
      priceHtml +
      '</div></div></a>'
    );
  }

  function patchNav(content) {
    document.querySelectorAll('.hero-brand__text').forEach(function (el) {
      if (content.brandName) el.textContent = content.brandName;
    });
    document.querySelectorAll('.hero-brand[href]').forEach(function (a) {
      a.setAttribute('href', '/');
    });
    document.querySelectorAll('a[href="index.html"]').forEach(function (a) {
      a.setAttribute('href', '/');
    });
    document.querySelectorAll('a[href="booking.html"]').forEach(function (a) {
      a.setAttribute('href', '/booking');
    });
    document.querySelectorAll('a[href="styles-catalog.html"]').forEach(function (a) {
      a.setAttribute('href', '/styles-catalog');
    });
    if (content.brandName) {
      document.title = (content.brandName || 'Menu') + ' | Services & pricing';
    }
  }

  window.StyldTenant.loadPublishedSite()
    .then(function (site) {
      patchNav(site.content);
      if (window.StyldTenant.applySiteFooter) {
        window.StyldTenant.applySiteFooter(site.content);
      }
      var wrap = document.querySelector('.catalog-pricing-wrap');
      if (!wrap) return;

      var cards = site.catalogCards || [];
      if (!cards.length) {
        wrap.innerHTML =
          '<div class="container"><p>Add styles in the Styld app to show your menu here.</p></div>';
        return;
      }

      wrap.innerHTML =
        '<div class="container">' +
        '<div class="section-head section-head--popular" style="margin-bottom:1.5rem">' +
        '<h2>' +
        escapeHtml(site.content.menuTitle || 'Menu') +
        '</h2>' +
        '<p>' +
        escapeHtml(site.content.menuBlurb || 'Tap a style to book online.') +
        '</p></div>' +
        '<div class="catalog-service-cards catalog-service-cards--popular">' +
        cards.map(cardHtml).join('') +
        '</div></div>';
    })
    .catch(function () {
      /* static template catalog remains */
    });
})();
