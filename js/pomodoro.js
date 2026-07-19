/* ===========================================================
   pomodoro.js — 뽀모도로 집중 타이머.
   집중 세션을 마치면 그 시간에 걸친 오늘의 타임박스 칸이
   자동으로 "완료"로 반영됩니다 (설정으로 끌 수 있음).
   Exposes: window.App.pomodoro
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  let phase = "focus";   // focus | break | long
  let running = false;
  let endAt = 0;         // ms timestamp when the current phase ends (while running)
  let remaining = 0;     // ms left (while paused / idle)
  let focusStartMs = 0;  // wall-clock start of the current focus phase (0 = fresh)
  let cycle = 0;         // completed focus sessions (every 4th → long break)
  let ticker = null;

  const META = {
    focus: { label: "🍅 집중", cls: "focus" },
    break: { label: "☕ 휴식", cls: "rest" },
    long:  { label: "🌴 긴 휴식", cls: "rest" },
  };

  const el = (id) => document.getElementById(id);
  function S() { return App.state.settings; }
  function phaseLen(p) {
    const s = S();
    const min = p === "focus" ? s.pomoFocus : p === "long" ? s.pomoLongBreak : s.pomoBreak;
    return Math.max(1, min || 1) * 60000;
  }
  function full() { return phaseLen(phase); }

  /* ---------- today's completed-pomodoro count (travels with the day) ---------- */
  function todayPomos() { const d = App.state.days[U.today()]; return (d && d.pomos) || 0; }
  function addPomo() {
    const ds = U.today();
    if (!App.state.days[ds]) App.state.days[ds] = { blocks: {} };
    App.state.days[ds].pomos = todayPomos() + 1;
    App.state.days[ds].mtime = Date.now();
  }

  /* ---------- render ---------- */
  function fillCats() {
    const sel = el("pomoCat");
    if (!sel) return;
    const cats = App.state.categories;
    const cur = sel.value || S().pomoCat || (cats[0] && cats[0].id);
    if (+sel.dataset.n !== cats.length) {
      sel.innerHTML = "";
      cats.forEach((c) => sel.add(new Option(`${c.emoji} ${c.name}`, c.id)));
      sel.dataset.n = cats.length;
    }
    if (cats.some((c) => c.id === cur)) sel.value = cur;
    else if (cats[0]) sel.value = cats[0].id;
  }

  function fmt(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    return U.pad(Math.floor(t / 60)) + ":" + U.pad(t % 60);
  }

  function render() {
    if (!el("pomoClock")) return;
    fillCats();
    const total = full();
    const rem = running ? endAt - Date.now() : (remaining || total);
    const pct = Math.max(0, Math.min(100, (1 - rem / total) * 100));
    el("pomoClock").textContent = fmt(rem);
    const timer = el("pomoTimer");
    if (timer) { timer.style.setProperty("--pct", pct.toFixed(1) + "%"); timer.className = "pomo-timer " + META[phase].cls; }
    el("pomoPhase").textContent = META[phase].label;
    const startBtn = el("pomoStart");
    if (startBtn) startBtn.textContent = running ? "⏸ 일시정지" : (remaining && remaining < total ? "▶ 계속" : "▶ 시작");
    el("pomoCount").textContent = `오늘 🍅 ${todayPomos()}`;
    const auto = el("pomoAutofill");
    if (auto) auto.checked = S().pomoAutofill !== false;
  }

  /* ---------- transport ---------- */
  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      if (!running) return;
      if (Date.now() >= endAt) complete();
      else render();
    }, 500);
  }

  function start() {
    if (running) { pause(); return; }
    if (window.Notification && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) {}
    }
    const total = full();
    const fresh = !remaining || remaining >= total;
    if (fresh) remaining = total;
    endAt = Date.now() + remaining;
    if (phase === "focus" && !focusStartMs) focusStartMs = Date.now();
    running = true;
    startTicker();
    render();
    if (fresh && phase === "focus") {
      const sel = el("pomoCat");
      const c = sel && App.catById(sel.value);
      notify("🍅 집중 시작!", `${c ? c.name + " " : ""}${Math.round(total / 60000)}분 집중 시작! 화이팅 💪`);
    }
  }
  function pause() {
    if (!running) return;
    remaining = Math.max(0, endAt - Date.now());
    running = false;
    render();
  }
  function reset() {
    running = false;
    remaining = full();
    focusStartMs = 0;
    render();
  }
  function setPhase(p, autorun) {
    phase = p;
    remaining = full();
    running = false;
    if (p === "focus") focusStartMs = 0;
    render();
    if (autorun) start();
  }
  function skip() {
    running = false;
    setPhase(phase === "focus" ? "break" : "focus", false);
  }

  function notify(title, body) {
    if (window.Notification && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "icon.svg" }); return; } catch (e) {}
    }
    App.gamify.toast(body);
  }

  function complete() {
    running = false;
    remaining = 0;
    if (phase === "focus") {
      const sel = el("pomoCat");
      const cat = (sel && sel.value) || S().pomoCat || (App.state.categories[0] && App.state.categories[0].id);
      const from = focusStartMs || (Date.now() - full());
      let filled = 0;
      if (S().pomoAutofill !== false && App.planner.reflectRange) {
        App.history.snapshot();
        filled = App.planner.reflectRange(cat, from, Date.now());
      }
      addPomo();
      App.store.save();
      cycle++;
      App.gamify.sfx.levelup();
      App.gamify.confetti();
      const c = App.catById(cat);
      notify("🍅 집중 완료!",
        filled ? `${c ? c.name + " " : ""}${filled}칸이 타임박스에 완료로 반영됐어요! ✅`
               : "집중 세션을 마쳤어요! 잠깐 쉬어요 ☕");
      App.refreshAll();
      setPhase(cycle % 4 === 0 ? "long" : "break", true);
    } else {
      App.gamify.sfx.complete();
      notify("휴식 끝!", "다시 집중해볼까요? 🍅");
      setPhase("focus", true);
    }
  }

  /* ---------- init ---------- */
  function init() {
    const startBtn = el("pomoStart"); if (startBtn) startBtn.onclick = start;
    const resetBtn = el("pomoReset"); if (resetBtn) resetBtn.onclick = reset;
    const skipBtn = el("pomoSkip"); if (skipBtn) skipBtn.onclick = skip;
    const sel = el("pomoCat");
    if (sel) sel.onchange = () => { S().pomoCat = sel.value; App.store.save(); };
    const auto = el("pomoAutofill");
    if (auto) auto.onchange = () => { S().pomoAutofill = auto.checked; App.store.save(); App.gamify.toast(auto.checked ? "🍅 집중 완료 시 타임박스 자동 반영 ON" : "자동 반영 OFF"); };
    remaining = full();
    render();
  }

  App.pomodoro = { init, render };
})();
