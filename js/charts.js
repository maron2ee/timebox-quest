/* ===========================================================
   charts.js — pixel-style chart renderers (DOM based, no libs)
   Exposes: window.App.charts
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const { minToH } = App.util;

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* per-category planned-vs-done bars (used in today summary + range) */
  function catBars(container, perCat, opts = {}) {
    container.innerHTML = "";
    const cats = App.state.categories;
    const unit = opts.unit || "min"; // "min" => values are minutes
    // max for scaling
    let max = 1;
    cats.forEach((c) => {
      const d = perCat[c.id];
      if (d) max = Math.max(max, d.plannedMin || 0, d.doneMin || 0, c.target || 0);
    });
    let any = false;
    cats.forEach((c) => {
      const d = perCat[c.id];
      if (!d || (!d.plannedMin && !d.doneMin)) return;
      any = true;
      const row = el("div", "cat-bar-row");
      const head = el("div", "cat-bar-head");
      head.appendChild(el("span", "cb-name", `${c.emoji} ${c.name}`));
      head.appendChild(el("span", "cb-val", `${minToH(d.doneMin)} / ${minToH(d.plannedMin)}`));
      row.appendChild(head);

      const track = el("div", "cat-bar-track");
      const plan = el("div", "cat-bar-plan");
      plan.style.width = (d.plannedMin / max) * 100 + "%";
      plan.style.background = c.color;
      const done = el("div", "cat-bar-done");
      done.style.width = (d.doneMin / max) * 100 + "%";
      done.style.background = c.color;
      track.appendChild(plan); track.appendChild(done);
      if (c.target > 0) {
        const tgt = el("div", "cat-bar-target");
        tgt.style.left = Math.min(100, (c.target / max) * 100) + "%";
        tgt.title = `목표 ${minToH(c.target)}`;
        track.appendChild(tgt);
      }
      row.appendChild(track);
      container.appendChild(row);
    });
    if (!any) container.appendChild(el("p", "hint", "아직 계획한 칸이 없어요."));
  }

  /* horizontal category chart for stats view (bigger) */
  function catChart(container, perCat) {
    container.innerHTML = "";
    const cats = App.state.categories;
    let max = 1;
    cats.forEach((c) => { const d = perCat[c.id]; if (d) max = Math.max(max, d.plannedMin, d.doneMin); });
    let any = false;
    cats.forEach((c) => {
      const d = perCat[c.id];
      if (!d || (!d.plannedMin && !d.doneMin)) return;
      any = true;
      const pct = d.plannedMin ? Math.round((d.doneMin / d.plannedMin) * 100) : 0;
      const row = el("div", "cc-row");
      const head = el("div", "cc-head");
      const name = el("div", "cc-name");
      name.appendChild(el("span", null, `${c.emoji} ${c.name}`));
      head.appendChild(name);
      head.appendChild(el("span", "cc-val", `${minToH(d.doneMin)} / ${minToH(d.plannedMin)} · ${pct}%`));
      row.appendChild(head);
      const track = el("div", "cc-track");
      const plan = el("div", "cc-plan"); plan.style.width = (d.plannedMin / max) * 100 + "%"; plan.style.background = c.color;
      const done = el("div", "cc-done"); done.style.width = (d.doneMin / max) * 100 + "%"; done.style.background = c.color;
      track.appendChild(plan); track.appendChild(done);
      row.appendChild(track);
      container.appendChild(row);
    });
    if (!any) container.appendChild(el("p", "hint", "이 기간에 기록이 없어요."));
  }

  /* trend bars: array of {label, pct} */
  function trend(container, items) {
    container.innerHTML = "";
    if (!items.length) { container.appendChild(el("p", "hint", "데이터 없음")); return; }
    items.forEach((it) => {
      const col = el("div", "trend-col");
      col.appendChild(el("span", "trend-v", it.pct + "%"));
      const bar = el("div", "trend-bar" + (it.pct >= App.state.settings.completionTarget ? "" : it.pct >= 40 ? " mid" : " low"));
      bar.style.height = Math.max(2, it.pct) + "%";
      bar.title = `${it.label}: ${it.pct}%`;
      col.appendChild(bar);
      col.appendChild(el("span", "trend-x", it.label));
      container.appendChild(col);
    });
  }

  /* heatmap: last N days, colored by completion pct.
     grid fills columns of 7 rows (weeks), Monday top. */
  function heatmap(container, weeks = 18) {
    container.innerHTML = "";
    const days = weeks * 7;
    const todayD = new Date();
    // align end to current week's Sunday so columns are clean weeks
    const start = App.util.startOfWeek(App.util.addDays(todayD, -(days - 7)));
    let cur = new Date(start);
    for (let i = 0; i < days; i++) {
      const ds = App.util.ymd(cur);
      const d = App.stats.deriveDay(ds);
      let lvl = 0;
      if (d.plannedBlocks > 0) {
        if (d.pct >= 90) lvl = 4;
        else if (d.pct >= 70) lvl = 3;
        else if (d.pct >= 40) lvl = 2;
        else lvl = 1;
      }
      const cell = el("i", "heat-cell l" + lvl);
      const future = cur > todayD;
      if (future) cell.style.opacity = ".25";
      cell.title = `${ds} · ${d.plannedBlocks ? d.pct + "% (" + minToH(d.doneMin) + ")" : "기록 없음"}`;
      container.appendChild(cell);
      cur = App.util.addDays(cur, 1);
    }
  }

  App.charts = { catBars, catChart, trend, heatmap };
})();
