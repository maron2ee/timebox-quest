/* ===========================================================
   archive.js — 회고(K/P/T) 모아보기
   Exposes: window.App.archive
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let q = "";

  function entries() {
    const days = S().state.days;
    return Object.keys(days)
      .map((ds) => ({ ds, d: days[ds] }))
      .filter(({ d }) => {
        const r = d.review || {};
        return (d.goal || "").trim() || (r.k || "").trim() || (r.p || "").trim() || (r.t || "").trim();
      })
      .filter(({ ds, d }) => {
        if (!q) return true;
        const r = d.review || {};
        const hay = [ds, d.goal, r.k, r.p, r.t].join(" ").toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => b.ds.localeCompare(a.ds));
  }

  function render() {
    const host = U.byId("archiveList");
    if (!host) return;
    const list = entries();
    if (!list.length) {
      host.innerHTML = `<div class="card card-pad"><div class="empty">${q ? "검색 결과가 없어요" : "아직 작성한 회고가 없어요"}</div></div>`;
      return;
    }
    host.innerHTML = list.map(({ ds, d }) => {
      const r = d.review || {};
      const study = S().studyMin(ds, "done");
      const adh = S().adherence(ds);
      const line = (cls, label, text) => text && text.trim()
        ? `<div class="review-row"><span class="review-k ${cls}">${label}</span><div style="flex:1;font-size:13.5px">${U.esc(text)}</div></div>` : "";
      return `<div class="card card-pad" style="margin-bottom:10px">
        <div class="row" style="margin-bottom:8px">
          <div class="card-title">${U.fmtFull(ds)}</div>
          <div class="stat-sub ml-auto">공부 ${U.minToKo(study)}${adh == null ? "" : " · 실천율 " + adh + "%"}</div>
        </div>
        ${(d.goal || "").trim() ? `<div class="stat-sub" style="white-space:pre-wrap;margin-bottom:8px">${U.esc(d.goal)}</div>` : ""}
        ${line("k", "K", r.k)}${line("p", "P", r.p)}${line("t", "T", r.t)}
        <button class="btn sm" style="margin-top:8px" data-go="${ds}">그날로 이동</button>
      </div>`;
    }).join("");

    U.$$("#archiveList [data-go]").forEach((b) => {
      b.onclick = () => { App.nav.show("day"); App.day.goto(b.dataset.go); };
    });
  }

  function init() {
    U.on("archiveQ", "input", (e) => { q = e.target.value; render(); });
  }

  App.archive = { init, render };
})();
