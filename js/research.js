/* ===========================================================
   research.js — 종목 리서치 메모
   item = {id, ticker, name, body, date, updated}
   Exposes: window.App.research
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let q = "";

  const TEMPLATE =
    "## 무엇을 하는 회사인가\n\n" +
    "## 왜 지금인가 (촉매)\n\n" +
    "## 숫자 (매출/이익/밸류)\n\n" +
    "## 리스크\n\n" +
    "## 내 결론 / 매매 근거\n";

  function list() {
    return S().state.research
      .filter((r) => {
        if (!q) return true;
        return [r.ticker, r.name, r.body].join(" ").toLowerCase().includes(q.toLowerCase());
      })
      .sort((a, b) => (b.updated || b.date || "").localeCompare(a.updated || a.date || ""));
  }

  function add() {
    const ticker = (U.byId("rsTicker").value || "").trim().toUpperCase();
    const name = (U.byId("rsName").value || "").trim();
    if (!ticker && !name) { App.ui.toast("티커 또는 종목명을 입력해 주세요"); return; }
    S().state.research.unshift({
      id: U.uid("rs"), ticker, name, body: TEMPLATE,
      date: U.today(), updated: U.today(),
    });
    S().save();
    U.byId("rsTicker").value = "";
    U.byId("rsName").value = "";
    render();
    App.ui.toast("리서치 메모를 만들었어요");
  }

  function render() {
    const host = U.byId("rsList");
    if (!host) return;
    const rows = list();
    if (!rows.length) {
      host.innerHTML = `<div class="card card-pad"><div class="empty">${
        S().state.research.length ? "검색 결과가 없어요" : "종목별로 매매 근거를 쌓아두면 복기할 때 큰 자산이 돼요."
      }</div></div>`;
      return;
    }
    host.innerHTML = rows.map((r) => `
      <div class="card card-pad rs" style="margin-bottom:10px" data-id="${r.id}">
        <div class="row" style="margin-bottom:8px">
          <div class="card-title">${U.esc(r.ticker || "")} ${U.esc(r.name || "")}</div>
          <span class="stat-sub">수정 ${U.esc(r.updated || r.date || "")}</span>
          <button class="icon-btn ml-auto rs-fold" title="접기/펼치기">▾</button>
          <button class="icon-btn rs-del" title="삭제">✕</button>
        </div>
        <textarea class="ta rs-body" style="min-height:190px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px">${U.esc(r.body || "")}</textarea>
      </div>`).join("");

    U.$$("#rsList .rs").forEach((card) => {
      const id = card.dataset.id;
      const r = S().state.research.find((x) => x.id === id);
      if (!r) return;
      const ta = card.querySelector(".rs-body");
      const save = U.debounce(() => { r.body = ta.value; r.updated = U.today(); S().save(); }, 400);
      ta.addEventListener("input", save);
      card.querySelector(".rs-fold").onclick = () => {
        ta.style.display = ta.style.display === "none" ? "" : "none";
      };
      card.querySelector(".rs-del").onclick = () => {
        if (!confirm(`“${r.ticker || r.name}” 메모를 삭제할까요?`)) return;
        S().state.research = S().state.research.filter((x) => x.id !== id);
        S().save(); render();
      };
    });
  }

  function init() {
    U.on("rsAdd", "click", add);
    U.on("rsName", "keydown", (e) => { if (e.key === "Enter") add(); });
    U.on("rsQ", "input", (e) => { q = e.target.value; render(); });
  }

  App.research = { init, render };
})();
