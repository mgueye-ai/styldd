/**
 * Image carousel for style detail pages. Hides controls when only one slide.
 */
(function () {
  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var viewport = root.querySelector(".style-detail-carousel__viewport");
    var track = root.querySelector(".style-detail-carousel__track");
    var slides = track ? track.querySelectorAll(".style-detail-carousel__slide") : [];
    var prev = root.querySelector(".style-detail-carousel__btn--prev");
    var next = root.querySelector(".style-detail-carousel__btn--next");
    var dotsContainer = root.querySelector(".style-detail-carousel__dots");
    if (!viewport || !track || slides.length === 0) return;

    var index = 0;
    var n = slides.length;

    function slideWidth() {
      return viewport.offsetWidth;
    }

    function layoutAndGo(i) {
      index = ((i % n) + n) % n;
      var w = slideWidth();
      var k = 0;
      slides.forEach(function (slide) {
        slide.style.flex = "0 0 " + w + "px";
        slide.style.width = w + "px";
        k++;
      });
      track.style.width = w * n + "px";
      track.style.transform = "translateX(-" + index * w + "px)";
      if (dotsContainer) {
        dotsContainer.querySelectorAll("button").forEach(function (btn, j) {
          btn.setAttribute("aria-selected", j === index ? "true" : "false");
          btn.classList.toggle("is-active", j === index);
        });
      }
    }

    if (n <= 1) {
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      if (dotsContainer) dotsContainer.hidden = true;
      return;
    }

    slides.forEach(function (_, j) {
      if (!dotsContainer) return;
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "style-detail-carousel__dot";
      dot.setAttribute("aria-label", "Photo " + (j + 1));
      dot.addEventListener("click", function () {
        layoutAndGo(j);
      });
      dotsContainer.appendChild(dot);
    });

    layoutAndGo(0);
    window.addEventListener("resize", function () {
      layoutAndGo(index);
    });

    if (prev) prev.addEventListener("click", function () { layoutAndGo(index - 1); });
    if (next) next.addEventListener("click", function () { layoutAndGo(index + 1); });
  });
})();
