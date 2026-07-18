/* ===========================================================
   calendar.js — 달력 탭: 월간 현황을 한눈에.
   날짜 칸을 누르면 그 날의 플래너(오늘 탭)로 이동합니다.
   Exposes: window.App.calendar
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  let anchor = new Date(); // any date within the displayed month

  /* ---------- date range for the 7-col grid (full weeks, spills into adjacent months) ---------- */
  function monthGridDates() {
    const first = U.startOfMonth(anchor);
    const last = U.endOfMonth(anchor);
    const gridStart = U.startOfWeek(first);
    const gridEnd = U.addDays(U.startOfWeek(last), 6);
    const days = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd) { days.push(new Date(cur)); cur = U.addDays(cur, 1); }
    return days;
  }

  function levelFor(dd) {
    if (!dd.plannedBlocks) return 0;
    if (dd.pct >= 90) return 4;
    if (dd.pct >= 70) return 3;
    if (dd.pct >= 40) return 2;
    return 1;
  }

  /* ---------- render ---------- */
  function renderHeader() {
    const isThis = anchor.getMonth() === new Date().getMonth() && anchor.getFullYear() === new Date().getFullYear();
    document.getElementById("calTitle").textContent = (isThis ? "이번 달 · " : "") + `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;
  }

  function renderDow() {
    const wrap = document.getElementById("calDow");
    wrap.innerHTML = "";
    const ws = App.state.settings.weekStart || 0;
    for (let i = 0; i < 7; i++) {
      const dow = (ws + i) % 7;
      const el = document.createElement("div");
      el.className = "cal-dow" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "");
      el.textContent = U.KDOW[dow];
      wrap.appendChild(el);
    }
  }

  function renderGrid() {
    const wrap = document.getElementById("calGrid");
    wrap.innerHTML = "";
    const todayStr = U.today();
    monthGridDates().forEach((d) => {
      const ds = U.ymd(d);
      const inMonth = d.getMonth() === anchor.getMonth();
      const dd = App.stats.deriveDay(ds);
      const lvl = levelFor(dd);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `cal-day l${lvl}` + (inMonth ? "" : " outmonth") + (ds === todayStr ? " today" : "");
      cell.dataset.date = ds;
      cell.innerHTML =
        `<span class="cal-daynum">${d.getDate()}</span>` +
        (dd.plannedBlocks ? `<span class="cal-pct">${dd.pct}%</span>` : "");
      cell.title = `${ds}${dd.plannedBlocks ? " · " + dd.pct + "% (" + U.minToH(dd.doneMin) + ")" : " · 계획 없음"}`;
      cell.setAttribute("aria-label", cell.title);
      cell.onclick = () => {
        App.planner.setDate(ds);
        const tab = document.querySelector('.tab[data-view="planner"]');
        if (tab) tab.click();
      };
      wrap.appendChild(cell);
    });
  }

  function renderSummary() {
    const r = { start: U.ymd(U.startOfMonth(anchor)), end: U.ymd(U.endOfMonth(anchor)) };
    const data = App.stats.deriveRange(r.start, r.end);
    document.getElementById("calSub").textContent = data.activeDays
      ? `평균 달성률 ${data.pct}% · 성공한 날 ${data.winDays}일 · 실천 ${U.minToH(data.doneMin)} / 계획 ${U.minToH(data.plannedMin)}`
      : "이 달엔 아직 계획한 기록이 없어요";
  }

  function render() {
    renderHeader();
    renderDow();
    renderGrid();
    renderSummary();
  }

  function shift(n) {
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    render();
  }

  function init() {
    document.getElementById("calPrev").onclick = () => shift(-1);
    document.getElementById("calNext").onclick = () => shift(1);
    document.getElementById("calTodayBtn").onclick = () => { anchor = new Date(); render(); };
  }

  App.calendar = { init, render };
})();
