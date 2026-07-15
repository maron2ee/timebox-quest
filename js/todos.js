/* ===========================================================
   todos.js — "오늘 할 일" 목록 + TOP 3 우선순위.
   현재 플래너가 보고 있는 날짜(App.planner.getDate())에 종속.
   항목을 드래그해서 왼쪽 타임박스 칸에 놓으면 계획으로 반영됩니다.
   Exposes: window.App.todos
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  /* ---------- day-scoped data ---------- */
  function curDate() { return App.planner.getDate(); }
  function day() {
    const ds = curDate();
    if (!App.state.days[ds]) App.state.days[ds] = { blocks: {} };
    const d = App.state.days[ds];
    if (!Array.isArray(d.todos)) d.todos = [];
    if (!Array.isArray(d.top3) || d.top3.length !== 3) d.top3 = [null, null, null];
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

  function touch() {
    App.state.days[curDate()].mtime = Date.now();
    App.store.save();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- todo list mutations ---------- */
  function addTodo(text) {
    text = (text || "").trim().slice(0, 60);
    if (!text) return;
    const c = firstCat();
    day().todos.push({ id: App.cid(), text, done: false, categoryId: c ? c.id : null, placed: 0 });
    touch();
    render();
  }
  function delTodo(id) { const d = day(); d.todos = d.todos.filter((t) => t.id !== id); touch(); render(); }
  function toggleTodoDone(id) { const t = day().todos.find((x) => x.id === id); if (t) { t.done = !t.done; touch(); render(); } }
  function cycleTodoCat(id) { const t = day().todos.find((x) => x.id === id); if (t) { t.categoryId = nextCat(t.categoryId); touch(); render(); } }

  /* ---------- top3 mutations ---------- */
  function top3Slot(i) {
    const d = day();
    if (!d.top3[i]) d.top3[i] = { id: App.cid(), text: "", done: false, categoryId: firstCat() ? firstCat().id : null };
    return d.top3[i];
  }
  function setTop3Text(i, text) {
    const slot = top3Slot(i);
    slot.text = (text || "").slice(0, 40);
    App.state.days[curDate()].mtime = Date.now();
    App.store.save(); // silent — no full render (keeps input focus)
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }
  function clearTop3(i) { day().top3[i] = null; touch(); render(); }
  function toggleTop3Done(i) { const s = top3Slot(i); s.done = !s.done; touch(); render(); }
  function cycleTop3Cat(i) { const s = top3Slot(i); s.categoryId = nextCat(s.categoryId); touch(); render(); }

  /* ---------- drop handling (called by planner.js) ---------- */
  function handleDrop(payload, time) {
    if (!time) return;
    let item, cat, note;
    if (payload.src === "todo") {
      item = day().todos.find((t) => t.id === payload.id);
      if (!item) return;
      cat = catOrFallback(item.categoryId);
      note = item.text;
    } else if (payload.src === "top3") {
      item = day().top3[payload.idx];
      if (!item || !item.text) return;
      cat = catOrFallback(item.categoryId);
      note = item.text;
    } else return;
    if (!cat) { App.gamify.toast("먼저 설정에서 카테고리를 만들어 주세요"); return; }
    const ok = App.planner.placeAt(time, cat.id, note);
    if (ok) {
      item.placed = (item.placed || 0) + 1;
      App.store.save();
      App.gamify.toast(`📌 ${time}에 "${note}" 를 넣었어요`);
      render();
    }
  }

  /* ---------- render ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function render() {
    if (!document.getElementById("todoList")) return;
    renderTodoList();
    renderTop3();
  }

  function renderTodoList() {
    const wrap = document.getElementById("todoList");
    const items = day().todos;
    if (!items.length) { wrap.innerHTML = '<p class="todo-empty hint">할 일을 추가해 보세요 ✏️</p>'; return; }
    wrap.innerHTML = items.map((t) => {
      const cat = catOrFallback(t.categoryId);
      return (
        `<div class="todo-item${t.done ? " done" : ""}" draggable="true" data-id="${t.id}">` +
        `<span class="todo-check" data-act="done" title="완료 체크">${t.done ? "☑" : "☐"}</span>` +
        `<button type="button" class="todo-dot" data-act="cat" style="background:${cat ? cat.color : "#ccc"}" title="카테고리: ${cat ? cat.name : "-"} (눌러서 변경)"></button>` +
        `<span class="todo-text">${escapeHtml(t.text)}</span>` +
        (t.placed ? `<span class="todo-placed" title="스케줄에 ${t.placed}번 배치됨">📌${t.placed}</span>` : "") +
        `<button type="button" class="todo-del" data-act="del" title="삭제">✕</button>` +
        `</div>`
      );
    }).join("");
  }

  function renderTop3() {
    const wrap = document.getElementById("top3List");
    const RANKS = ["🥇", "🥈", "🥉"];
    const d = day();
    wrap.innerHTML = [0, 1, 2].map((i) => {
      const slot = d.top3[i];
      const text = slot ? slot.text : "";
      const done = !!(slot && slot.done);
      const cat = catOrFallback(slot ? slot.categoryId : null);
      return (
        `<div class="top3-item${done ? " done" : ""}" draggable="${text ? "true" : "false"}" data-idx="${i}">` +
        `<span class="top3-rank">${RANKS[i]}</span>` +
        `<button type="button" class="todo-dot" data-act="cat" style="background:${cat ? cat.color : "#ccc"}" title="카테고리: ${cat ? cat.name : "-"} (눌러서 변경)"></button>` +
        `<input type="text" class="top3-input" data-idx="${i}" placeholder="우선순위 ${i + 1}" maxlength="40" value="${escapeHtml(text)}" />` +
        `<span class="todo-check" data-act="done" title="완료 체크">${done ? "☑" : "☐"}</span>` +
        `<button type="button" class="todo-del" data-act="clear" title="비우기">✕</button>` +
        `</div>`
      );
    }).join("");
  }

  /* ---------- wiring (delegated, attached once) ---------- */
  function initTodoList() {
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
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  }

  function initTop3() {
    const wrap = document.getElementById("top3List");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      const row = e.target.closest(".top3-item");
      const act = e.target.closest("[data-act]");
      if (!row || !act) return;
      const idx = +row.dataset.idx;
      if (act.dataset.act === "done") toggleTop3Done(idx);
      else if (act.dataset.act === "cat") cycleTop3Cat(idx);
      else if (act.dataset.act === "clear") clearTop3(idx);
    });
    wrap.addEventListener("input", (e) => {
      const inp = e.target.closest(".top3-input");
      if (!inp) return;
      const idx = +inp.dataset.idx;
      setTop3Text(idx, inp.value);
      const row = inp.closest(".top3-item");
      if (row) row.draggable = inp.value.trim().length > 0;
    });
    wrap.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".top3-item");
      if (!row || row.draggable !== true) return;
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ tbqDrag: true, src: "top3", idx: +row.dataset.idx }));
      row.classList.add("dragging");
    });
    wrap.addEventListener("dragend", (e) => {
      const row = e.target.closest(".top3-item");
      if (row) row.classList.remove("dragging");
    });
  }

  function init() {
    initTodoList();
    initTop3();
    render();
  }

  App.todos = { init, render, handleDrop };
})();
