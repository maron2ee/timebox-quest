/* ===========================================================
   pomodoro.js — 집중 타이머
   두 가지로 쓴다.
     ① 자유 집중(헤더 🍅) — 기본 25분. 학습 구간처럼 깊게 파는 시간용
     ② 구간 항목 타이머(체크리스트 ▶) — 그 항목에 배분된 분만큼
   끝나거나 중단하면 그 시간대를 DONE 타임라인에 기록한다.
   Exposes: window.App.pomo
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let run = null;   // {startMs, endMs, catId, title, key}
  let tick = null;

  function cfg() { return S().state.pomo; }
  function leftMs() { return run ? Math.max(0, run.endMs - Date.now()) : 0; }
  function current() { return run ? { key: run.key, title: run.title, leftMs: leftMs() } : null; }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return U.pad(Math.floor(s / 60)) + ":" + U.pad(s % 60);
  }

  /* ---------- 화면 갱신 ---------- */
  function paint() {
    const t = U.byId("pomoTime"), b = U.byId("pomoToggle");
    if (t && b) {
      if (!run) {
        t.textContent = U.pad(cfg().focusMin) + ":00";
        t.style.color = "";
        t.title = "";
        b.textContent = "🍅 집중";
        b.classList.remove("primary");
      } else {
        t.textContent = fmt(leftMs());
        t.style.color = "var(--danger)";
        t.title = run.title || "집중 중";
        b.textContent = "중단";
        b.classList.add("primary");
      }
    }
    // 체크리스트 항목 타이머 인라인 표시 (전체 리렌더 없이)
    U.$$("[data-pomo-key]").forEach((el) => {
      const on = run && el.dataset.pomoKey === run.key;
      el.textContent = on ? fmt(leftMs()) : el.dataset.pomoIdle || "";
      el.classList.toggle("running", !!on);
    });
    const btns = U.$$("[data-pomo-btn]");
    btns.forEach((el) => {
      const on = run && el.dataset.pomoBtn === run.key;
      el.textContent = on ? "■" : "▶";
      el.title = on ? "중단하고 기록" : "이 항목 타이머 시작";
      el.classList.toggle("running", !!on);
    });
  }

  /* ---------- 시작 / 종료 ---------- */
  function start(opts) {
    opts = opts || {};
    const mins = Math.max(1, Math.round(+opts.mins || cfg().focusMin || 25));
    const active = App.timeline.activeCat;
    const catId = opts.catId || (active && active !== "__erase" ? active : cfg().catId);
    run = {
      startMs: Date.now(), endMs: Date.now() + mins * 60000,
      catId, title: opts.title || "", key: opts.key || "",
    };
    cfg().catId = catId;
    S().save();
    clearInterval(tick);
    tick = setInterval(() => {
      paint();
      if (Date.now() >= run.endMs) finish(true);
    }, 500);
    paint();
    App.ui.toast(`${mins}분 집중 시작${opts.title ? " — " + opts.title : ""}`);
  }

  // done=true 완주 / false 중단 — 어느 쪽이든 경과한 만큼 기록한다
  function finish(done) {
    if (!run) return;
    clearInterval(tick); tick = null;
    const st = new Date(run.startMs);
    const startedMin = st.getHours() * 60 + st.getMinutes();
    const elapsed = Math.round((Date.now() - run.startMs) / 60000);
    const { catId, title } = run;
    const ds = U.today();
    run = null;
    paint();

    if (elapsed < 1) { App.ui.toast("기록하기엔 너무 짧아요"); return; }
    if (App.day.date() !== ds) App.day.goto(ds);

    const written = App.timeline.applyMinutes(ds, "done", startedMin, startedMin + elapsed, catId, title);
    App.day.refresh();

    const cat = S().catById(catId);
    App.ui.toast(done
      ? `집중 완료! ${U.minToKo(written)} 기록했어요 (${cat ? cat.name : ""})`
      : `${U.minToKo(written)} 기록했어요`);

    if (done && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("집중 완료 🍅", { body: `${title || (cat ? cat.name : "")} · ${U.minToKo(written)}` }); }
      catch (e) { /* noop */ }
    }
  }

  function toggle() {
    if (run) {
      if (confirm("집중을 중단할까요? 지금까지 경과한 시간은 기록돼요.")) finish(false);
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) { /* noop */ }
    }
    start({});
  }

  // 체크리스트 항목에서 호출 — 같은 항목을 다시 누르면 중단
  function toggleItem(key, mins, catId, title) {
    if (run && run.key === key) { finish(false); return; }
    if (run && !confirm("다른 타이머가 돌고 있어요. 그걸 멈추고 시작할까요?")) return;
    if (run) finish(false);
    start({ mins, catId, title, key });
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

  App.pomo = { init, toggle, toggleItem, start, current, paint, get running() { return !!run; } };
})();
