/* ===========================================================
   ui.js — 토스트 / 모달 공용
   Exposes: window.App.ui
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  function toast(msg, ms) {
    const wrap = U.byId("toastWrap");
    if (!wrap) return;
    const t = U.el("div", "toast", U.esc(msg));
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .2s";
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 220);
    }, ms || 1800);
  }

  function openModal(id) {
    const m = U.byId(id);
    if (m) m.hidden = false;
  }
  function closeModal(id) {
    const m = U.byId(id);
    if (m) m.hidden = true;
  }
  function closeAll() {
    U.$$(".modal-bg").forEach((m) => (m.hidden = true));
  }

  // 배경 클릭 / ESC 로 닫기
  function initModals() {
    U.$$(".modal-bg").forEach((bg) => {
      bg.addEventListener("mousedown", (e) => { if (e.target === bg) bg.hidden = true; });
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  }

  // 카테고리 팔레트 칩 렌더 (지우개 포함)
  function renderPalette(hostId, activeId, onPick, opts) {
    const host = U.byId(hostId);
    if (!host) return;
    opts = opts || {};
    host.innerHTML = "";
    App.store.state.categories.forEach((c) => {
      const b = U.el("button", "chip" + (c.id === activeId ? " active" : ""),
        `<span class="sw" style="background:${U.esc(c.color)}"></span>${U.esc(c.name)}`);
      b.onclick = () => onPick(c.id);
      host.appendChild(b);
    });
    if (!opts.noEraser) {
      const e = U.el("button", "chip eraser" + (activeId === "__erase" ? " active" : ""), "지우개");
      e.onclick = () => onPick("__erase");
      host.appendChild(e);
    }
  }

  App.ui = { toast, openModal, closeModal, closeAll, initModals, renderPalette };
})();
