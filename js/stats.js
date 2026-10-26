/* ===========================================================
   stats.js — 주간 / 월간 통계
   Exposes: window.App.stats
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let range = "week";

  function bounds() {
    const base = App.day.date();
    if (range === "month") return [U.monthStart(base), U.monthEnd(base)];
    const from = U.weekStart(base);
    return [from, U.addDays(from, 6)];
  }

  function series() {
    const [from, to] = bounds();
    return U.rangeDays(from, to).map((ds) => ({
      ds,
      study: S().studyMin(ds, "done"),
      done: S().filledMin(ds, "done"),
      plan: S().filledMin(ds, "plan"),
      adh: S().adherence(ds),
    }));
  }

  // 오늘부터 거꾸로, 공부 1분 이상 기록된 연속 일수
  function streak() {
    let n = 0, ds = U.today();
    for (let i = 0; i < 400; i++) {
      if (S().studyMin(ds, "done") > 0) { n++; ds = U.addDays(ds, -1); }
      else if (i === 0) { ds = U.addDays(ds, -1); }  // 오늘은 아직 안 했을 수 있으니 한 번 봐줌
      else break;
    }
    return n;
  }

  function renderCards(rows) {
    const host = U.byId("statsCards");
    if (!host) return;
    const totalStudy = rows.reduce((a, r) => a + r.study, 0);
    const activeDays = rows.filter((r) => r.study > 0).length;
    const avg = activeDays ? Math.round(totalStudy / activeDays) : 0;
    const adhs = rows.map((r) => r.adh).filter((x) => x != null);
    const adh = adhs.length ? Math.round(adhs.reduce((a, b) => a + b, 0) / adhs.length) : null;

    const card = (k, v, sub) =>
      `<div class="card stat"><div class="stat-k">${k}</div><div class="stat-v">${v}</div><div class="stat-sub">${sub}</div></div>`;

    host.innerHTML =
      card("총 공부시간", U.minToKo(totalStudy), `${range === "week" ? "이번 주" : "이번 달"} · ${activeDays}일 기록`) +
      card("하루 평균", U.minToKo(avg), "기록한 날 기준") +
      card("계획 실천율", adh == null ? "—" : adh + "%", "계획한 칸 중 실행된 비율") +
      card("연속 기록", streak() + "일", "공부 1분 이상");
  }

  function renderChart(rows) {
    const host = U.byId("statsChart");
    if (!host) return;
    const max = Math.max(60, ...rows.map((r) => Math.max(r.study, r.plan)));
    host.innerHTML = `<div class="chart">${rows.map((r) => {
      const hp = (r.plan / max) * 100, hd = (r.study / max) * 100;
      const isToday = r.ds === U.today();
      return `<div class="chart-col${isToday ? " today" : ""}" title="${U.fmtMD(r.ds)} · 공부 ${U.minToKo(r.study)} / 계획 ${U.minToKo(r.plan)}">
        <div class="chart-bars">
          <div class="chart-bar plan" style="height:${hp}%"></div>
          <div class="chart-bar done" style="height:${hd}%"></div>
        </div>
        <div class="chart-x">${U.parseYmd(r.ds).getDate()}</div>
      </div>`;
    }).join("")}</div>
    <div class="tl-legend" style="padding-left:0">
      <span><i style="background:#dfe3ea"></i>계획</span>
      <span><i style="background:#4f6ef7"></i>공부(실행)</span>
    </div>`;
  }

  function renderCats(rows) {
    const host = U.byId("statsCats");
    if (!host) return;
    const [from, to] = bounds();
    const total = {};
    U.rangeDays(from, to).forEach((ds) => {
      const by = S().minutesByCat(ds, "done");
      for (const id in by) total[id] = (total[id] || 0) + by[id];
    });
    const list = Object.keys(total).map((id) => ({ cat: S().catById(id), min: total[id] }))
      .filter((x) => x.cat).sort((a, b) => b.min - a.min);
    if (!list.length) { host.innerHTML = `<div class="empty">아직 기록이 없어요</div>`; return; }
    const max = list[0].min;
    host.innerHTML = list.map((x) => `
      <div class="barrow">
        <span class="barrow-n">${U.esc(x.cat.name)}</span>
        <span class="barrow-t"><i style="width:${(x.min / max) * 100}%;background:${U.esc(x.cat.color)}"></i></span>
        <span class="barrow-v">${U.minToKo(x.min)}</span>
      </div>`).join("");
  }

  function renderAdh(rows) {
    const host = U.byId("statsAdh");
    if (!host) return;
    const list = rows.filter((r) => r.adh != null);
    if (!list.length) { host.innerHTML = `<div class="empty">계획을 세운 날이 없어요</div>`; return; }
    host.innerHTML = list.map((r) => `
      <div class="barrow">
        <span class="barrow-n">${U.fmtMD(r.ds)}</span>
        <span class="barrow-t"><i style="width:${r.adh}%;background:${r.adh >= 80 ? "#34d399" : r.adh >= 50 ? "#fbbf24" : "#f87171"}"></i></span>
        <span class="barrow-v">${r.adh}%</span>
      </div>`).join("");
  }

  // 가설 적중률 + 계획 준수
  function renderHypo() {
    const host = U.byId("hypoStats");
    if (!host) return;
    const [from, to] = bounds();
    const a = App.hypo.accuracy(from, to);
    const days = U.rangeDays(from, to);
    let trades = 0, offPlan = 0, planDays = 0;
    days.forEach((ds) => {
      const st = S().tradeStats(ds);
      trades += st.count; offPlan += st.offPlan;
      if ((S().peekDay(ds).plans || []).length) planDays++;
    });

    const pct = (v) => (v == null ? "—" : v + "%");
    host.innerHTML = `
      <div class="row" style="margin-bottom:12px">
        <div class="card-title">가설 · 계획 준수</div>
        <div class="stat-sub ml-auto">${range === "week" ? "이번 주" : "이번 달"}</div>
      </div>
      <div class="hypo-stats">
        <div class="hs"><div class="hs-v">${pct(a.cleanRate)}</div><div class="hs-k">가설 적중률</div>
          <div class="hs-s">장 시작 전 확정분 ${a.cleanJudged}건</div></div>
        <div class="hs"><div class="hs-v">${pct(a.sectorRate)}</div><div class="hs-k">섹터 적중률</div>
          <div class="hs-s">예상 주도 섹터</div></div>
        <div class="hs"><div class="hs-v">${a.written}일</div><div class="hs-k">가설 작성</div>
          <div class="hs-s">${a.lateFirst ? `사후 작성 ${a.lateFirst}일 · ` : ""}수정 ${a.edited}일</div></div>
        <div class="hs${offPlan ? " bad" : ""}"><div class="hs-v">${offPlan}건</div><div class="hs-k">계획외 매매</div>
          <div class="hs-s">전체 ${trades}건 · 계획 세운 날 ${planDays}일</div></div>
      </div>
      ${a.lateFirst ? `<div class="stat-sub" style="margin-top:10px;color:var(--danger)">
        장이 열린 뒤에 처음 쓴 가설 ${a.lateFirst}일 — 적중률 집계에서 제외했어요.</div>` : ""}`;
  }

  function render() {
    const rows = series();
    renderCards(rows);
    renderHypo();
    renderChart(rows);
    renderCats(rows);
    renderAdh(rows);
  }

  function init() {
    U.$$("#statsRange .subtab").forEach((b) => {
      b.onclick = () => {
        range = b.dataset.range;
        U.$$("#statsRange .subtab").forEach((x) => x.classList.toggle("active", x === b));
        render();
      };
    });
  }

  App.stats = { init, render, streak };
})();
