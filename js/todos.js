/* ===========================================================
   todos.js — "오늘 할 일" 목록 (+ ☆ 눌러 TOP3 우선순위 메달 지정).
   현재 플래너가 보고 있는 날짜(App.planner.getDate())에 종속.
   항목을 드래그해서 왼쪽 타임박스 칸에 놓으면 계획으로 반영됩니다.
   Exposes: window.App.todos
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const MEDALS = ["🥇", "🥈", "🥉"];

  /* ---------- day-scoped data ---------- */
  function curDate() { return App.planner.getDate(); }
  function day() {
    const ds = curDate();
    if (!App.state.days[ds]) App.state.days[ds] = { blocks: {} };
    const d = App.state.days[ds];
    if (!Array.isArray(d.todos)) d.todos = [];
    return d;
  }
  function firstCat() { return App.state.categories[0] || null; }
  function catOrFallback(id) { return App.catById(id) || firstCat(); }
  function nextCat(id) {
    const cats = App.state.categories;
    if (!cats.length) return null;
    const i = cats.findIndex((c) => c.id === id);
    return cats[(i + 1 + cats.length) % cats.length].id;
  }
  function sortedTodos() {
    return day().todos.slice().sort((a, b) => (a.medal || 99) - (b.medal || 99));
  }

  function touch() {
    App.state.days[curDate()].mtime = Date.now();
    App.store.save();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- mutations ---------- */
  function addTodo(text) {
    text = (text || "").trim().slice(0, 60);
    if (!text) return;
    const c = firstCat();
    day().todos.push({ id: App.cid(), text, done: false, categoryId: c ? c.id : null, placed: 0, medal: null });
    touch();
    render();
  }
  function delTodo(id) { const d = day(); d.todos = d.todos.filter((t) => t.id !== id); touch(); render(); }
  function toggleTodoDone(id) { const t = day().todos.find((x) => x.id === id); if (t) { t.done = !t.done; touch(); render(); } }
  function cycleTodoCat(id) { const t = day().todos.find((x) => x.id === id); if (t) { t.categoryId = nextCat(t.categoryId); touch(); render(); } }

  // ☆ → 🥇 → 🥈 → 🥉 → ☆ ; assigning a medal already held by another item takes it from them
  function cycleMedal(id) {
    const list = day().todos;
    const t = list.find((x) => x.id === id);
    if (!t) return;
    const next = t.medal == null ? 1 : t.medal === 3 ? null : t.medal + 1;
    if (next != null) {
      const other = list.find((x) => x.medal === next && x.id !== id);
      if (other) other.medal = null;
    }
    t.medal = next;
    touch();
    render();
  }

  /* ---------- drop handling (called by planner.js) ---------- */
  function handleDrop(payload, time) {
    if (!time || payload.src !== "todo") return;
    const item = day().todos.find((t) => t.id === payload.id);
    if (!item) return;
    const cat = catOrFallback(item.categoryId);
    if (!cat) { App.gamify.toast("먼저 설정에서 카테고리를 만들어 주세요"); return; }
    // 드롭하면 편집 모달을 열어 시간·메모·길이를 바로 조정할 수 있게
    App.planner.openBlockModal(time, {
      categoryId: cat.id,
      note: item.text,
      onSaved: () => {
        item.placed = (item.placed || 0) + 1;
        App.store.save();
        App.gamify.toast(`📌 "${item.text}" 를 일정에 넣었어요`);
        render();
      },
    });
  }

  /* ---------- render ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function render() {
    const wrap = document.getElementById("todoList");
    if (!wrap) return;
    const items = sortedTodos();
    if (!items.length) { wrap.innerHTML = '<p class="todo-empty hint">할 일을 추가해 보세요 ✏️ (☆를 눌러 TOP3 우선순위도 정해보세요)</p>'; return; }
    wrap.innerHTML = items.map((t) => {
      const cat = catOrFallback(t.categoryId);
      const medalIcon = t.medal ? MEDALS[t.medal - 1] : "☆";
      return (
        `<div class="todo-item${t.done ? " done" : ""}${t.medal ? " medal-" + t.medal : ""}" draggable="true" data-id="${t.id}">` +
        `<button type="button" class="todo-medal${t.medal ? " set" : ""}" data-act="medal" title="${t.medal ? "TOP " + t.medal + " (눌러서 변경/해제)" : "우선순위 TOP3로 지정"}">${medalIcon}</button>` +
        `<span class="todo-check" data-act="done" title="완료 체크">${t.done ? "☑" : "☐"}</span>` +
        `<button type="button" class="todo-dot" data-act="cat" style="background:${cat ? cat.color : "#ccc"}" title="카테고리: ${cat ? cat.name : "-"} (눌러서 변경)"></button>` +
        `<span class="todo-text">${escapeHtml(t.text)}</span>` +
        (t.placed ? `<span class="todo-placed" title="스케줄에 ${t.placed}번 배치됨">📌${t.placed}</span>` : "") +
        `<button type="button" class="todo-del" data-act="del" title="삭제">✕</button>` +
        `</div>`
      );
    }).join("");
  }

  /* ---------- wiring (delegated, attached once) ---------- */
  function init() {
    const wrap = document.getElementById("todoList");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      const row = e.target.closest(".todo-item");
      const act = e.target.closest("[data-act]");
      if (!row || !act) return;
      const id = row.dataset.id;
      if (act.dataset.act === "done") toggleTodoDone(id);
      else if (act.dataset.act === "cat") cycleTodoCat(id);
      else if (act.dataset.act === "del") delTodo(id);
      else if (act.dataset.act === "medal") cycleMedal(id);
    });
    wrap.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".todo-item");
      if (!row) return;
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ tbqDrag: true, src: "todo", id: row.dataset.id }));
      row.classList.add("dragging");
    });
    wrap.addEventListener("dragend", (e) => {
      const row = e.target.closest(".todo-item");
      if (row) row.classList.remove("dragging");
    });

    const input = document.getElementById("todoInput");
    const add = () => { addTodo(input.value); input.value = ""; input.focus(); };
    document.getElementById("todoAddBtn").onclick = add;
    // e.isComposing: 한글 조합 중 Enter로 마지막 글자만 추가되던 버그 방지
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) add(); });

    render();
  }

  App.todos = { init, render, handleDrop };
})();
