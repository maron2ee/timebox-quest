/* ===========================================================
   pomodoro.js — 집중 타이머. 끝나면 그 시간대를 DONE 타임라인에 자동 기록.
   Exposes: window.App.pomo
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let run = null;   // {startMs, endMs, catId, title}
  let tick = null;

  function cfg() { return S().state.pomo; }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return U.pad(Math.floor(s / 60)) + ":" + U.pad(s % 60);
  }

  function paint() {
    const t = U.byId("pomoTime"), b = U.byId("pomoToggle");
    if (!t || !b) return;
    if (!run) {
      t.textContent = U.pad(cfg().focusMin) + ":00";
      t.style.color = "";
      b.textContent = "🍅 집중";
      b.classList.remove("primary");
      return;
    }
    t.textContent = fmt(run.endMs - Date.now());
    t.style.color = "var(--danger)";
    b.textContent = "중단";
    b.classList.add("primary");
  }

  function start() {
    const mins = cfg().focusMin || 25;
    const catId = App.timeline.activeCat === "__erase" ? cfg().catId : App.timeline.activeCat;
    run = { startMs: Date.now(), endMs: Date.now() + mins * 60000, catId, title: "" };
    cfg().catId = catId;
    S().save();
    clearInterval(tick);
    tick = setInterval(() => {
      paint();
      if (Date.now() >= run.endMs) finish(true);
    }, 500);
    paint();
    App.ui.toast(`${mins}분 집중 시작!`);
  }

  // done=true 면 완주, false 면 중단(경과분만 기록)
  function finish(done) {
    if (!run) return;
    clearInterval(tick); tick = null;
    const startedMin = new Date(run.startMs).getHours() * 60 + new Date(run.startMs).getMinutes();
    const elapsed = Math.round((Date.now() - run.startMs) / 60000);
    const catId = run.catId;
    const ds = U.today();
    run = null;
    paint();

    if (elapsed < 1) { App.ui.toast("기록하기엔 너무 짧아요"); return; }

    // 오늘 화면이 아니면 오늘로 이동해서 반영
    if (App.day.date() !== ds) App.day.goto(ds);

    const written = App.timeline.applyMinutes(ds, "done", startedMin, startedMin + elapsed, catId, "");
    App.day.refresh();

    const cat = S().catById(catId);
    App.ui.toast(done
      ? `집중 완료! ${U.minToKo(written)} 기록했어요 (${cat ? cat.name : ""})`
      : `${U.minToKo(written)} 기록했어요`);

    if (done && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("집중 완료 🍅", { body: `${U.minToKo(written)} 기록했어요` }); } catch (e) { /* noop */ }
    }
  }

  function toggle() {
    if (run) {
      if (confirm("집중을 중단할까요? 지금까지 경과한 시간은 기록돼요.")) finish(false);
    } else {
      if ("Notification" in window && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch (e) { /* noop */ }
      }
      start();
    }
  }

  function init() {
    U.on("pomoToggle", "click", toggle);
    paint();
    window.addEventListener("beforeunload", (e) => {
      if (!run) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  App.pomo = { init, toggle, get running() { return !!run; } };
})();
