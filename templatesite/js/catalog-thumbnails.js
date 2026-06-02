/**
 * Maps booking style ids → assets/catalog/*.jpg from imported menu photos.
 * Only entries present here get thumbnails; all others keep the default placeholder.
 * Template ships with an empty map so only neutral catalog placeholders are shown.
 */
(function () {
  var PREFIX = "assets/catalog/";
  var FILES = {};

  document.querySelectorAll('a.catalog-service-card[href*="style="]').forEach(function (a) {
    var href = a.getAttribute("href") || "";
    var match = href.match(/(?:\?|&)style=([^&]+)/);
    if (!match) return;
    var id = decodeURIComponent(match[1].replace(/\+/g, " "));
    var file = FILES[id];
    if (!file) return;
    var media = a.querySelector(".catalog-service-card__media");
    if (!media) return;
    media.classList.add("catalog-service-card__media--photo");
    media.style.backgroundImage = 'url("' + PREFIX + file + '")';
  });
})();
