/* ===========================================================
   habits.js — 습관 트래커: 매일 반복 습관을 체크하고
   연속(스트릭)·최근 7일·30일 달성률을 추적.
   습관 정의는 전역(App.state.habits), 완료는 날짜별(days[ds].habitDone).
   Exposes: window.App.habits
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  const el = (id) => document.getElementById(id);
  function habits() { return App.state.habits || (App.state.habits = []); }
  function doneMap(ds) { const d = App.state.days[ds]; return (d && d.habitDone) || {}; }
  function isDone(id, ds) { return !!doneMap(ds)[id]; }

  function save() {
    App.store.save();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- stats ---------- */
  function streak(id) {
    let n = 0;
    let cur = new Date();
    if (!isDone(id, U.ymd(cur))) cur = U.addDays(cur, -1); // 오늘은 진행 중일 수 있음
    for (let i = 0; i < 400; i++) {
      if (isDone(id, U.ymd(cur))) { n++; cur = U.addDays(cur, -1); } else break;
    }
    return n;
  }
  function rate(id, days) {
    days = days || 30;
    let done = 0;
    for (let i = 0; i < days; i++) if (isDone(id, U.ymd(U.addDays(new Date(), -i)))) done++;
    return Math.round((done / days) * 100);
  }

  /* ---------- mutations ---------- */
  function addHabit(name, emoji) {
    name = (name || "").trim().slice(0, 20);
    if (!name) return;
    emoji = (emoji || "").trim().slice(0, 2) || "✅";
    habits().push({ id: App.cid(), name, emoji });
    save();
    render();
  }
  function delHabit(id) {
    if (!confirm("이 습관을 삭제할까요? (기록도 함께 사라져요)")) return;
    App.state.habits = habits().filter((h) => h.id !== id);
    for (const ds in App.state.days) { const hd = App.state.days[ds].habitDone; if (hd && hd[id]) delete hd[id]; }
    save();
    render();
  }
  function renameHabit(id) {
    const h = habits().find((x) => x.id === id);
    if (!h) return;
    const v = prompt("습관 이름", h.name);
    if (v == null) return;
    h.name = v.trim().slice(0, 20) || h.name;
    save();
    render();
  }
  function toggleToday(id) {
    const ds = U.today();
    if (!App.state.days[ds]) App.state.days[ds] = { blocks: {} };
    const d = App.state.days[ds];
    if (!d.habitDone) d.habitDone = {};
    const was = !!d.habitDone[id];
    if (was) delete d.habitDone[id]; else d.habitDone[id] = true;
    d.mtime = Date.now();
    save();
    if (!was && App.gamify && App.gamify.sfx) App.gamify.sfx.complete();
    render();
  }

  /* ---------- render ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  function dots7(id) {
    let s = "";
    for (let i = 6; i >= 0; i--) {
      const on = isDone(id, U.ymd(U.addDays(new Date(), -i)));
      s += `<i class="hd${on ? " on" : ""}"></i>`;
    }
    return s;
  }

  function render() {
    const list = el("habitList");
    if (!list) return;
    const sub = el("habitDate");
    if (sub) sub.textContent = U.fmtDaySub(U.today());
    const hs = habits();
    if (!hs.length) {
      list.innerHTML = '<p class="hint">매일 반복하고 싶은 습관을 추가해 보세요 🌱 (예: 운동, 물 마시기, 독서)</p>';
      return;
    }
    const today = U.today();
    list.innerHTML = hs.map((h) => {
      const done = isDone(h.id, today);
      const st = streak(h.id);
      return (
        `<div class="habit-item${done ? " done" : ""}" data-id="${h.id}">` +
        `<button type="button" class="habit-check${done ? " on" : ""}" data-act="toggle" aria-label="오늘 완료">${done ? "✓" : ""}</button>` +
        `<span class="habit-emoji">${esc(h.emoji)}</span>` +
        `<div class="habit-main">` +
        `<div class="habit-name" data-act="rename" title="이름 변경">${esc(h.name)}</div>` +
        `<div class="habit-dots" title="최근 7일">${dots7(h.id)}</div>` +
        `</div>` +
        `<div class="habit-stat"><span class="habit-streak" title="연속 달성일">🔥${st}</span><span class="habit-rate" title="최근 30일 달성률">${rate(h.id)}%</span></div>` +
        `<button type="button" class="habit-del" data-act="del" title="삭제">✕</button>` +
        `</div>`
      );
    }).join("");
  }

  /* ---------- init ---------- */
  function init() {
    const list = el("habitList");
    if (!list) return;
    list.addEventListener("click", (e) => {
      const item = e.target.closest(".habit-item");
      const act = e.target.closest("[data-act]");
      if (!item || !act) return;
      const id = item.dataset.id;
      const a = act.dataset.act;
      if (a === "toggle") toggleToday(id);
      else if (a === "del") delHabit(id);
      else if (a === "rename") renameHabit(id);
    });
    const nameIn = el("habitName");
    const emojiIn = el("habitEmoji");
    const add = () => { addHabit(nameIn.value, emojiIn.value); nameIn.value = ""; emojiIn.value = ""; nameIn.focus(); };
    el("habitAddBtn").onclick = add;
    nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) add(); });
    render();
  }

  App.habits = { init, render };
})();
