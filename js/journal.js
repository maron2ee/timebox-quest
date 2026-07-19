/* ===========================================================
   journal.js — 오늘의 다짐(Goal) + 하루 회고(Daily Review · K/P/T).
   현재 플래너가 보고 있는 날짜(App.planner.getDate())에 종속.
   입력 중 포커스가 튀지 않도록 조용히 저장(디바운스)하고, 날짜를 바꾸면 다시 채웁니다.
   Exposes: window.App.journal
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  const el = (id) => document.getElementById(id);
  function curDate() { return App.planner.getDate(); }
  function day() {
    const ds = curDate();
    if (!App.state.days[ds]) App.state.days[ds] = { blocks: {} };
    const d = App.state.days[ds];
    if (!d.journal || typeof d.journal !== "object") d.journal = { goal: "", review: { k: "", p: "", t: "" } };
    if (!d.journal.review || typeof d.journal.review !== "object") d.journal.review = { k: "", p: "", t: "" };
    return d;
  }

  let saveTimer = null;
  function scheduleSave() {
    App.state.days[curDate()].mtime = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      App.store.save();
      if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
    }, 400);
  }

  /* ---------- render: pull current day's values into the fields ---------- */
  function render() {
    if (!el("goalInput")) return;
    const j = day().journal;
    // don't clobber a field the user is actively typing in
    const active = document.activeElement;
    const set = (id, val) => { const e = el(id); if (e && e !== active) e.value = val || ""; };
    set("goalInput", j.goal);
    set("reviewK", j.review.k);
    set("reviewP", j.review.p);
    set("reviewT", j.review.t);
  }

  /* ---------- wiring ---------- */
  function bind(id, apply) {
    const e = el(id);
    if (!e) return;
    e.addEventListener("input", () => { apply(e.value); scheduleSave(); });
  }

  function init() {
    bind("goalInput", (v) => { day().journal.goal = v; });
    bind("reviewK", (v) => { day().journal.review.k = v; });
    bind("reviewP", (v) => { day().journal.review.p = v; });
    bind("reviewT", (v) => { day().journal.review.t = v; });
    render();
  }

  App.journal = { init, render };
})();
