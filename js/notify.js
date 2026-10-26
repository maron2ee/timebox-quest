/* ===========================================================
   notify.js — 구간 알림 (비서 역할)
   한계: 서버 푸시가 없는 정적 앱이라 **이 탭이 열려 있을 때만** 동작한다.
   Exposes: window.App.notify
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let lastPhaseId = null;     // 마지막으로 알린 구간
  let leadFired = {};         // 미리알림 중복 방지 {phaseId: 'YYYY-MM-DD'}
  let timer = null;

  function cfg() { return S().state.settings.notify || { enabled: false, lead: 3, sound: false }; }
  function supported() { return typeof Notification !== "undefined"; }
  function permission() { return supported() ? Notification.permission : "unsupported"; }

  function beep() {
    if (!cfg().sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.55);
      setTimeout(() => ctx.close && ctx.close(), 900);
    } catch (e) { /* 무음 환경 */ }
  }

  function fire(title, body) {
    App.ui.toast(`🔔 ${title}`, 4000);
    beep();
    if (permission() !== "granted") return;
    try {
      const n = new Notification(title, { body, tag: "phase", renotify: true, icon: "icon.svg" });
      n.onclick = () => { try { window.focus(); n.close(); } catch (e) { /* noop */ } };
    } catch (e) { /* 일부 브라우저는 SW 필요 */ }
  }

  /* ---------- 틱 ---------- */
  function tick() {
    const c = cfg();
    if (!c.enabled) return;
    if (!(S().state.settings.routine || {}).enabled) return;

    const ds = U.today();
    if (!App.market.isTradingDay(ds)) return;   // 주말엔 조용히

    const now = U.nowMin();
    const phases = S().phases();
    const cur = phases.find((p) => now >= p.startMin && now < p.endMin) || null;

    // 1) 구간 시작
    if (cur && cur.id !== lastPhaseId) {
      // 최초 실행(= 앱을 켠 순간)은 기준만 잡고 넘어간다
      if (lastPhaseId !== null) {
        const m = App.routine.MODE[cur.mode] || {};
        fire(`${cur.start} ${cur.name}`, `${m.label || ""} — ${m.hint || ""}`);
      }
      lastPhaseId = cur.id;
    } else if (!cur && lastPhaseId !== null) {
      lastPhaseId = null;
    }

    // 2) N분 전 미리 알림
    const lead = +c.lead || 0;
    if (lead > 0) {
      const next = phases.find((p) => p.startMin > now && p.startMin - now <= lead);
      if (next && leadFired[next.id] !== ds) {
        leadFired[next.id] = ds;
        fire(`곧 ${next.name}`, `${next.start}부터예요 (${next.startMin - now}분 뒤)`);
      }
    }
  }

  function start() {
    clearInterval(timer);
    lastPhaseId = null;   // 다음 틱에서 기준만 잡음
    tick();
    timer = setInterval(tick, 20000);
  }

  async function enable(on) {
    const c = S().state.settings.notify;
    if (on && supported() && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch (e) { /* noop */ }
    }
    c.enabled = !!on;
    S().save();
    if (c.enabled) start(); else clearInterval(timer);
    return permission();
  }

  function test() {
    const p = App.routine.nowPhase();
    const m = p ? (App.routine.MODE[p.mode] || {}) : {};
    fire(p ? `${p.start} ${p.name}` : "알림 테스트",
         p ? `${m.label} — ${m.hint}` : "구간 알림이 이렇게 표시됩니다");
  }

  function init() {
    if (cfg().enabled) start();
  }

  App.notify = { init, enable, test, permission, supported, start };
})();
