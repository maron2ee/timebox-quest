/* ===========================================================
   analytics.js — stats view (day / week / month) + achievements
   Exposes: window.App.analytics
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  let period = "week"; // 'day' | 'week' | 'month'
  let anchor = new Date(); // reference date inside the period

  /* ---------- range resolution ---------- */
  function range(a) {
    a = a || anchor;
    if (period === "day") {
      const ds = U.ymd(a);
      return { start: ds, end: ds };
    }
    if (period === "week") {
      const s = U.startOfWeek(a);
      return { start: U.ymd(s), end: U.ymd(U.addDays(s, 6)) };
    }
    const s = U.startOfMonth(a);
    return { start: U.ymd(s), end: U.ymd(U.endOfMonth(a)) };
  }
  function prevAnchor() {
    if (period === "day") return U.addDays(anchor, -1);
    if (period === "week") return U.addDays(anchor, -7);
    return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  }
  function periodLabel() { return period === "day" ? "어제" : period === "week" ? "지난주" : "지난달"; }

  function titleText() {
    if (period === "day") return U.fmtDayTitle(U.ymd(anchor)) + " (" + U.fmtDaySub(U.ymd(anchor)).split(" ")[1] + ")";
    if (period === "week") {
      const s = U.startOfWeek(anchor), e = U.addDays(s, 6);
      const same = s.getMonth() === e.getMonth();
      const isThis = U.ymd(s) === U.ymd(U.startOfWeek(new Date()));
      return (isThis ? "이번 주 · " : "") + `${s.getMonth() + 1}.${s.getDate()} ~ ${same ? "" : (e.getMonth() + 1) + "."}${e.getDate()}`;
    }
    const isThis = anchor.getMonth() === new Date().getMonth() && anchor.getFullYear() === new Date().getFullYear();
    return (isThis ? "이번 달 · " : "") + `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;
  }

  /* ---------- render ---------- */
  function render() {
    const r = range();
    const data = App.stats.deriveRange(r.start, r.end);

    document.getElementById("periodTitle").textContent = titleText();
    document.getElementById("periodSub").textContent =
      `평균 달성률 ${data.pct}%  ·  실천 ${U.minToH(data.doneMin)} / 계획 ${U.minToH(data.plannedMin)}  ·  성공한 날 ${data.winDays}일`;

    // trend chart
    const trendItems = buildTrend(r, data);
    App.charts.trend(document.getElementById("trendChart"), trendItems);

    // category chart
    App.charts.catChart(document.getElementById("catChart"), data.perCat);

    // heatmap (always last ~18 weeks regardless of period)
    App.charts.heatmap(document.getElementById("heatmap"), 18);

    renderInsights(r, data);
    renderAchievements();
  }

  /* ---------- insights ---------- */
  function bestWeekday() {
    const sum = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 56; i++) {
      const d = U.addDays(new Date(), -i);
      const dd = App.stats.deriveDay(U.ymd(d));
      if (dd.plannedBlocks > 0) { const w = d.getDay(); sum[w] += dd.pct; cnt[w]++; }
    }
    let best = -1, bestAvg = -1;
    for (let w = 0; w < 7; w++) if (cnt[w] && sum[w] / cnt[w] > bestAvg) { bestAvg = Math.round(sum[w] / cnt[w]); best = w; }
    return best < 0 ? null : { w: best, avg: bestAvg };
  }

  function renderInsights(r, data) {
    const wrap = document.getElementById("insights");
    if (!wrap) return;
    const pr = range(prevAnchor());
    const prev = App.stats.deriveRange(pr.start, pr.end);
    const delta = prev ? data.pct - prev.pct : 0;
    const deltaTxt = prev && prev.plannedMin
      ? `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%p (${periodLabel()} 대비)`
      : "비교할 이전 기록 없음";

    // top category this range
    let topCat = null, topMin = -1;
    for (const cid in data.perCat) if (data.perCat[cid].doneMin > topMin) { topMin = data.perCat[cid].doneMin; topCat = cid; }
    const tc = topCat ? App.catById(topCat) : null;
    const bw = bestWeekday();

    const items = [
      { ico: "📈", label: "평균 달성률", val: `${data.pct}%`, sub: deltaTxt, cls: delta >= 0 ? "up" : "down" },
      { ico: "⭐", label: "최다 실천", val: tc ? `${tc.emoji} ${tc.name}` : "—", sub: tc ? U.minToH(topMin) : "기록 없음" },
      { ico: "🏆", label: "베스트 요일", val: bw ? U.KDOW[bw.w] + "요일" : "—", sub: bw ? `평균 ${bw.avg}%` : "기록 없음" },
      { ico: "🔥", label: "연속 달성", val: `${App.stats.currentStreak()}일`, sub: `성공한 날 ${data.winDays}일` },
    ];
    wrap.innerHTML = "";
    items.forEach((it) => {
      const el = document.createElement("div");
      el.className = "insight" + (it.cls ? " " + it.cls : "");
      el.innerHTML =
        `<span class="ins-ico">${it.ico}</span>` +
        `<div class="ins-body"><div class="ins-label">${it.label}</div><div class="ins-val">${it.val}</div><div class="ins-sub">${it.sub}</div></div>`;
      wrap.appendChild(el);
    });
  }

  /* ---------- CSV export ---------- */
  function exportCsv() {
    const r = range();
    const slotMin = App.state.settings.slotMinutes;
    const rows = [["date", "weekday", "category", "plannedMin", "doneMin"]];
    let cur = U.parseYmd(r.start);
    const end = U.parseYmd(r.end);
    while (cur <= end) {
      const ds = U.ymd(cur);
      const d = App.stats.deriveDay(ds);
      const wd = U.KDOW[cur.getDay()];
      for (const cid in d.perCat) {
        const c = App.catById(cid);
        rows.push([ds, wd, c ? c.name : cid, d.perCat[cid].planned * slotMin, d.perCat[cid].done * slotMin]);
      }
      cur = U.addDays(cur, 1);
    }
    const csv = "﻿" + rows.map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timebox-quest-${r.start}_${r.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    App.gamify.toast("⬇ CSV를 내보냈어요");
  }

  function buildTrend(r, data) {
    if (period === "day") {
      // show the 7 days ending at anchor
      const out = [];
      for (let i = 6; i >= 0; i--) {
        const d = U.addDays(anchor, -i);
        const dd = App.stats.deriveDay(U.ymd(d));
        out.push({ label: U.KDOW[d.getDay()], pct: dd.pct });
      }
      return out;
    }
    if (period === "week") {
      return data.perDay.map((p) => ({ label: U.KDOW[U.parseYmd(p.date).getDay()], pct: p.pct }));
    }
    // month: group by ISO-ish weeks within the month
    const weeks = [];
    let bucket = null, wkIdx = 0;
    data.perDay.forEach((p) => {
      const dow = (U.parseYmd(p.date).getDay() + 6) % 7; // Mon=0
      if (dow === 0 || !bucket) { wkIdx++; bucket = { label: "W" + wkIdx, sumPlan: 0, sumDone: 0 }; weeks.push(bucket); }
      bucket.sumPlan += p.plannedMin; bucket.sumDone += p.doneMin;
    });
    return weeks.map((w) => ({ label: w.label, pct: w.sumPlan ? Math.round((w.sumDone / w.sumPlan) * 100) : 0 }));
  }

  function renderAchievements() {
    const wrap = document.getElementById("achievements");
    wrap.innerHTML = "";
    App.gamify.earnedAchievements().forEach((a) => {
      const el = document.createElement("div");
      el.className = "ach" + (a.earned ? "" : " locked");
      el.innerHTML =
        `<span class="a-ico">${a.earned ? a.ico : "🔒"}</span>` +
        `<div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div>`;
      wrap.appendChild(el);
    });
  }

  /* ---------- nav ---------- */
  function shift(n) {
    if (period === "day") anchor = U.addDays(anchor, n);
    else if (period === "week") anchor = U.addDays(anchor, n * 7);
    else anchor = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
    render();
  }

  function init() {
    document.querySelectorAll(".period-toggle .period").forEach((btn) => {
      btn.onclick = () => {
        period = btn.dataset.period;
        anchor = new Date();
        document.querySelectorAll(".period-toggle .period").forEach((b) => b.classList.toggle("active", b === btn));
        render();
      };
    });
    document.getElementById("prevPeriod").onclick = () => shift(-1);
    document.getElementById("nextPeriod").onclick = () => shift(1);
    const csv = document.getElementById("csvBtn");
    if (csv) csv.onclick = exportCsv;
  }

  App.analytics = { init, render };
})();
