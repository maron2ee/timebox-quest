/* ===========================================================
   todos.js — "오늘 할 일" 목록.
   기능: ☆ TOP3 우선순위 메달 · 카테고리 색 · 타임박스로 드래그
        + 하위 할 일(체크리스트) · #태그 & 필터 · 🔁 매일 반복
   현재 플래너가 보고 있는 날짜(App.planner.getDate())에 종속.
   Exposes: window.App.todos
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const MEDALS = ["🥇", "🥈", "🥉"];

  let filterTag = null;              // 선택된 태그 필터 (null = 전체)
  const expanded = new Set();        // 하위 할 일 펼친 항목 id

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

  /* ---------- tags ---------- */
  function parseTags(raw) {
    const tags = [];
    const text = String(raw).replace(/#(\S+)/g, (m, g) => {
      const t = g.slice(0, 16);
      if (t && !tags.includes(t)) tags.push(t);
      return "";
    }).replace(/\s+/g, " ").trim();
    return { text, tags };
  }
  function allTags() {
    const s = new Set();
    day().todos.forEach((t) => (t.tags || []).forEach((x) => s.add(x)));
    return [...s];
  }

  /* ---------- recurring (매일 반복) — generate once per day ---------- */
  function ensureRecurring() {
    if (curDate() !== U.today()) return; // 오늘에만 생성
    const d = day();
    if (!Array.isArray(d.recurGen)) d.recurGen = [];
    const defs = App.state.recurring || [];
    let added = false;
    defs.forEach((def) => {
      if (d.recurGen.includes(def.id)) return;
      d.recurGen.push(def.id);
      d.todos.push({ id: App.cid(), text: def.text, done: false, categoryId: def.categoryId, placed: 0, medal: null, tags: (def.tags || []).slice(), subs: [], recurId: def.id });
      added = true;
    });
    if (added) { d.mtime = Date.now(); App.store.save(); }
  }

  /* ---------- mutations ---------- */
  function addTodo(raw) {
    const { text, tags } = parseTags((raw || "").trim());
    const clipped = text.slice(0, 60);
    if (!clipped) return;
    const c = firstCat();
    day().todos.push({ id: App.cid(), text: clipped, done: false, categoryId: c ? c.id : null, placed: 0, medal: null, tags, subs: [] });
    touch();
    render();
  }
  function findTodo(id) { return day().todos.find((x) => x.id === id); }
  function delTodo(id) { const d = day(); d.todos = d.todos.filter((t) => t.id !== id); touch(); render(); }
  function toggleTodoDone(id) { const t = findTodo(id); if (t) { t.done = !t.done; touch(); render(); } }
  function cycleTodoCat(id) { const t = findTodo(id); if (t) { t.categoryId = nextCat(t.categoryId); touch(); render(); } }

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

  function toggleRecur(id) {
    const t = findTodo(id);
    if (!t) return;
    App.state.recurring = App.state.recurring || [];
    if (t.recurId) {
      App.state.recurring = App.state.recurring.filter((r) => r.id !== t.recurId);
      t.recurId = null;
      App.gamify.toast("🔁 매일 반복 해제");
    } else {
      const def = { id: App.cid(), text: t.text, categoryId: t.categoryId, tags: (t.tags || []).slice() };
      App.state.recurring.push(def);
      t.recurId = def.id;
      const d = day();
      if (!Array.isArray(d.recurGen)) d.recurGen = [];
      if (!d.recurGen.includes(def.id)) d.recurGen.push(def.id);
      App.gamify.toast("🔁 매일 반복으로 설정했어요 (매일 아침 자동 추가)");
    }
    touch(); // saves whole state incl. recurring
    render();
  }

  /* ---------- subtasks ---------- */
  function toggleExpand(id) { if (expanded.has(id)) expanded.delete(id); else expanded.add(id); render(); }
  function addSub(id, raw) {
    const text = (raw || "").trim().slice(0, 60);
    if (!text) return;
    const t = findTodo(id);
    if (!t) return;
    if (!Array.isArray(t.subs)) t.subs = [];
    t.subs.push({ id: App.cid(), text, done: false });
    expanded.add(id);
    touch(); render();
  }
  function toggleSub(id, subId) { const t = findTodo(id); const s = t && (t.subs || []).find((x) => x.id === subId); if (s) { s.done = !s.done; touch(); render(); } }
  function delSub(id, subId) { const t = findTodo(id); if (t && t.subs) { t.subs = t.subs.filter((x) => x.id !== subId); touch(); render(); } }

  /* ---------- drop handling (called by planner.js) ---------- */
  function handleDrop(payload, time) {
    if (!time || payload.src !== "todo") return;
    const item = findTodo(payload.id);
    if (!item) return;
    const cat = catOrFallback(item.categoryId);
    if (!cat) { App.gamify.toast("먼저 설정에서 카테고리를 만들어 주세요"); return; }
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

  function itemHTML(t) {
    const cat = catOrFallback(t.categoryId);
    const medalIcon = t.medal ? MEDALS[t.medal - 1] : "☆";
    const subs = Array.isArray(t.subs) ? t.subs : [];
    const doneSubs = subs.filter((s) => s.done).length;
    const isExp = expanded.has(t.id);
    const tagsHtml = (t.tags || []).map((tg) => `<span class="tag-chip in-todo">#${escapeHtml(tg)}</span>`).join("");
    let h = `<div class="todo-item${t.done ? " done" : ""}${t.medal ? " medal-" + t.medal : ""}" data-id="${t.id}">`;
    h += `<div class="todo-row" draggable="true">`;
    h += `<button type="button" class="todo-medal${t.medal ? " set" : ""}" data-act="medal" title="${t.medal ? "TOP " + t.medal + " (변경/해제)" : "우선순위 TOP3로 지정"}">${medalIcon}</button>`;
    h += `<span class="todo-check" data-act="done" title="완료 체크">${t.done ? "☑" : "☐"}</span>`;
    h += `<button type="button" class="todo-dot" data-act="cat" style="background:${cat ? cat.color : "#ccc"}" title="카테고리: ${cat ? cat.name : "-"}"></button>`;
    h += `<span class="todo-text">${escapeHtml(t.text)}${tagsHtml}</span>`;
    if (t.placed) h += `<span class="todo-placed" title="배치 ${t.placed}회">📌${t.placed}</span>`;
    h += `<button type="button" class="todo-mini${t.recurId ? " on" : ""}" data-act="recur" title="매일 반복">🔁</button>`;
    h += `<button type="button" class="todo-mini${isExp ? " on" : ""}" data-act="expand" title="하위 할 일">▸${subs.length ? " " + doneSubs + "/" + subs.length : ""}</button>`;
    h += `<button type="button" class="todo-del" data-act="del" title="삭제">✕</button>`;
    h += `</div>`;
    if (isExp) {
      h += `<div class="todo-subs">`;
      subs.forEach((s) => {
        h += `<div class="sub-item${s.done ? " done" : ""}" data-sub="${s.id}">` +
          `<span class="sub-check" data-act="sub-done">${s.done ? "☑" : "☐"}</span>` +
          `<span class="sub-text">${escapeHtml(s.text)}</span>` +
          `<button type="button" class="sub-del" data-act="sub-del" title="삭제">✕</button>` +
          `</div>`;
      });
      h += `<div class="sub-add"><input type="text" class="sub-add-input" placeholder="하위 할 일 추가" maxlength="60" /><button type="button" class="sub-add-btn pixel-btn tiny">＋</button></div>`;
      h += `</div>`;
    }
    h += `</div>`;
    return h;
  }

  function renderFilters() {
    const wrap = document.getElementById("todoFilters");
    if (!wrap) return;
    const tags = allTags();
    if (filterTag && !tags.includes(filterTag)) filterTag = null;
    if (!tags.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML =
      `<button class="tag-chip filter${filterTag ? "" : " active"}" data-tag="">전체</button>` +
      tags.map((t) => `<button class="tag-chip filter${filterTag === t ? " active" : ""}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join("");
  }

  function render() {
    const wrap = document.getElementById("todoList");
    if (!wrap) return;
    ensureRecurring();
    renderFilters();
    let items = sortedTodos();
    if (filterTag) items = items.filter((t) => (t.tags || []).includes(filterTag));
    if (!items.length) {
      wrap.innerHTML = filterTag
        ? `<p class="todo-empty hint">#${escapeHtml(filterTag)} 태그의 할 일이 없어요</p>`
        : '<p class="todo-empty hint">할 일을 추가해 보세요 ✏️ (#태그 · ☆ 우선순위 · ▸ 하위 할 일 · 🔁 반복)</p>';
      return;
    }
    wrap.innerHTML = items.map(itemHTML).join("");
  }

  /* ---------- wiring (delegated, attached once) ---------- */
  function init() {
    const wrap = document.getElementById("todoList");
    if (!wrap) return;

    wrap.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".sub-add-btn");
      if (addBtn) { const item = addBtn.closest(".todo-item"); const inp = item.querySelector(".sub-add-input"); addSub(item.dataset.id, inp.value); return; }
      const item = e.target.closest(".todo-item");
      const act = e.target.closest("[data-act]");
      if (!item || !act) return;
      const id = item.dataset.id;
      const a = act.dataset.act;
      if (a === "done") toggleTodoDone(id);
      else if (a === "cat") cycleTodoCat(id);
      else if (a === "del") delTodo(id);
      else if (a === "medal") cycleMedal(id);
      else if (a === "recur") toggleRecur(id);
      else if (a === "expand") toggleExpand(id);
      else if (a === "sub-done") { const s = e.target.closest("[data-sub]"); if (s) toggleSub(id, s.dataset.sub); }
      else if (a === "sub-del") { const s = e.target.closest("[data-sub]"); if (s) delSub(id, s.dataset.sub); }
    });

    wrap.addEventListener("keydown", (e) => {
      const inp = e.target.closest(".sub-add-input");
      if (inp && e.key === "Enter" && !e.isComposing) { const item = inp.closest(".todo-item"); addSub(item.dataset.id, inp.value); }
    });

    wrap.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".todo-row");
      if (!row) return;
      const item = row.closest(".todo-item");
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ tbqDrag: true, src: "todo", id: item.dataset.id }));
      item.classList.add("dragging");
    });
    wrap.addEventListener("dragend", (e) => {
      const item = e.target.closest(".todo-item");
      if (item) item.classList.remove("dragging");
    });

    const filters = document.getElementById("todoFilters");
    if (filters) filters.addEventListener("click", (e) => {
      const chip = e.target.closest(".tag-chip");
      if (!chip) return;
      filterTag = chip.dataset.tag || null;
      render();
    });

    const input = document.getElementById("todoInput");
    const add = () => { addTodo(input.value); input.value = ""; input.focus(); };
    document.getElementById("todoAddBtn").onclick = add;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) add(); });

    render();
  }

  App.todos = { init, render, handleDrop };
})();
