/* ===========================================================
   app.js — 부트스트랩 · 탭 전환
   Exposes: window.App.nav
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  const VIEWS = {
    day: () => App.day.refresh(),
    trade: () => App.trades.render(App.day.date()),
    stats: () => App.stats.render(),
    archive: () => App.archive.render(),
    terms: () => App.terms.render(),
    research: () => App.research.render(),
    settings: () => App.settings.render(),
  };

  let current = "day";

  function show(name) {
    if (!VIEWS[name]) name = "day";
    current = name;
    U.$$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    U.$$("#tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    try { location.hash = name === "day" ? "" : "#" + name; } catch (e) { /* noop */ }
    VIEWS[name]();
    window.scrollTo(0, 0);
  }

  function initTabs() {
    U.$$("#tabs .tab").forEach((b) => { b.onclick = () => show(b.dataset.view); });
    window.addEventListener("hashchange", () => {
      const h = (location.hash || "").replace("#", "");
      if (h !== current) show(h || "day");
    });
  }

  function boot() {
    App.store.load();
    App.ui.initModals();

    App.timeline.init();
    App.routine.init();
    App.trades.init();
    App.judge.init();
    App.tasks.init();
    App.pomo.init();
    App.day.init();
    App.stats.init();
    App.archive.init();
    App.terms.init();
    App.research.init();
    App.settings.init();

    initTabs();
    show((location.hash || "").replace("#", "") || "day");

    // 자정을 넘기면 '오늘'을 다시 맞춰줌
    let lastDay = U.today();
    setInterval(() => {
      const t = U.today();
      if (t !== lastDay) { lastDay = t; if (current === "day") App.day.refresh(); }
    }, 60000);

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* noop */ });
    }
  }

  App.nav = { show, get current() { return current; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
