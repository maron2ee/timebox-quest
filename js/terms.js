/* ===========================================================
   terms.js — 경제용어 노트 (경제신문 보다 모르는 말 모아두기)
   term = {id, word, mean, memo, date, star}
   Exposes: window.App.terms
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let q = "", filter = "all";

  function list() {
    return S().state.terms
      .filter((t) => (filter === "star" ? t.star : true))
      .filter((t) => {
        if (!q) return true;
        const hay = [t.word, t.mean, t.memo].join(" ").toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  function add() {
    const w = (U.byId("termWord").value || "").trim();
    const m = (U.byId("termMean").value || "").trim();
    if (!w) { App.ui.toast("용어를 입력해 주세요"); return; }
    S().state.terms.push({ id: U.uid("tm"), word: w, mean: m, memo: "", date: U.today(), star: false });
    S().save();
    U.byId("termWord").value = "";
    U.byId("termMean").value = "";
    U.byId("termWord").focus();
    render();
    App.ui.toast("용어를 추가했어요");
  }

  function render() {
    const host = U.byId("termList");
    if (!host) return;
    const rows = list();
    const total = S().state.terms.length;
    if (!rows.length) {
      host.innerHTML = `<div class="card card-pad"><div class="empty">${
        total ? "조건에 맞는 용어가 없어요" : "경제신문을 읽다 모르는 용어를 적어두세요. 용어가 8할이에요."
      }</div></div>`;
      return;
    }
    host.innerHTML = rows.map((t) => `
      <div class="card card-pad term" style="margin-bottom:8px" data-id="${t.id}">
        <div class="row" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:7px">
              <div class="card-title">${U.esc(t.word)}</div>
              <span class="stat-sub">${U.esc(t.date || "")}</span>
            </div>
            <input class="term-mean" value="${U.esc(t.mean || "")}" placeholder="뜻 — 내 말로 한 줄">
            <input class="term-memo" value="${U.esc(t.memo || "")}" placeholder="예문 · 어디서 봤는지">
          </div>
          <button class="icon-btn term-star" title="복습 표시">${t.star ? "★" : "☆"}</button>
          <button class="icon-btn term-del" title="삭제">✕</button>
        </div>
      </div>`).join("");

    U.$$("#termList .term").forEach((card) => {
      const id = card.dataset.id;
      const t = S().state.terms.find((x) => x.id === id);
      if (!t) return;
      card.querySelector(".term-mean").onchange = (e) => { t.mean = e.target.value; S().save(); };
      card.querySelector(".term-memo").onchange = (e) => { t.memo = e.target.value; S().save(); };
      card.querySelector(".term-star").onclick = () => { t.star = !t.star; S().save(); render(); };
      card.querySelector(".term-del").onclick = () => {
        if (!confirm(`“${t.word}” 삭제할까요?`)) return;
        S().state.terms = S().state.terms.filter((x) => x.id !== id);
        S().save(); render();
      };
    });
  }

  function init() {
    U.on("termAdd", "click", add);
    U.on("termWord", "keydown", (e) => { if (e.key === "Enter") U.byId("termMean").focus(); });
    U.on("termMean", "keydown", (e) => { if (e.key === "Enter") add(); });
    U.on("termQ", "input", (e) => { q = e.target.value; render(); });
    U.$$("#termFilter .subtab").forEach((b) => {
      b.onclick = () => {
        filter = b.dataset.f;
        U.$$("#termFilter .subtab").forEach((x) => x.classList.toggle("active", x === b));
        render();
      };
    });
  }

  App.terms = { init, render };
})();
