/**
 * Instagram reels carousel used on the home page.
 */
(function () {
  document.querySelectorAll("[data-reels-carousel]").forEach(function (root) {
    var viewport = root.querySelector(".reels-carousel__viewport");
    var track = root.querySelector(".reels-carousel__track");
    var slides = track ? track.querySelectorAll(".reels-carousel__slide") : [];
    var prev = root.querySelector(".reels-carousel__btn--prev");
    var next = root.querySelector(".reels-carousel__btn--next");
    if (!viewport || !track || slides.length === 0) return;

    var index = 0;
    var count = slides.length;
    var perView = 1;
    var slideWidth = 0;
    var maxIndex = 0;

    function getPerView() {
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      if (w >= 1180) return 3;
      if (w >= 760) return 2;
      return 1;
    }

    function goTo(i) {
      if (maxIndex <= 0) {
        index = 0;
      } else if (i < 0) {
        index = maxIndex;
      } else if (i > maxIndex) {
        index = 0;
      } else {
        index = i;
      }
      track.style.transform = "translateX(-" + index * slideWidth + "px)";
    }

    function layout() {
      perView = Math.min(getPerView(), count);
      slideWidth = viewport.clientWidth / perView;
      maxIndex = Math.max(0, count - perView);
      track.style.width = slideWidth * count + "px";
      slides.forEach(function (slide) {
        slide.style.flex = "0 0 " + slideWidth + "px";
        slide.style.width = slideWidth + "px";
      });
      if (index > maxIndex) index = 0;
      goTo(index);
      if (prev) prev.hidden = maxIndex <= 0;
      if (next) next.hidden = maxIndex <= 0;
    }

    if (count <= 1) {
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      return;
    }

    layout();
    window.addEventListener("resize", layout);

    if (prev) {
      prev.addEventListener("click", function () {
        goTo(index - 1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        goTo(index + 1);
      });
    }

    var autoplay = null;

    function startAutoplay() {
      if (autoplay) return;
      autoplay = window.setInterval(function () {
        goTo(index + 1);
      }, 6500);
    }

    function stopAutoplay() {
      if (!autoplay) return;
      window.clearInterval(autoplay);
      autoplay = null;
    }

    startAutoplay();

    root.addEventListener("mouseenter", function () {
      stopAutoplay();
    });

    root.addEventListener("mouseleave", function () {
      startAutoplay();
    });
  });
})();
