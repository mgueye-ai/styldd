(function () {
  document.querySelectorAll("[data-pricing-tabs]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
    if (!tabs.length || tabs.length !== panels.length) return;

    function select(index) {
      tabs.forEach(function (tab, j) {
        var selected = j === index;
        tab.setAttribute("aria-selected", selected);
        tab.tabIndex = selected ? 0 : -1;
        panels[j].hidden = !selected;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i);
      });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          select(next);
          tabs[next].focus();
        }
      });
    });
  });
})();
