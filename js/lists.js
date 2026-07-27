/* ===========================================================
   lists.js — 여러 프로젝트 리스트(TickTick 스타일).
   날짜와 무관하게 지속되는 할 일 리스트. 각 리스트에 태그·하위 할 일 지원.
   Exposes: window.App.lists
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  let curId = null;              // 선택된 리스트 id
  const expanded = new Set();    // 하위 할 일 펼친 task id

  const el = (id) => document.getElementById(id);
  function lists() { return App.state.lists || (App.state.lists = []); }
  function curList() {
    const ls = lists();
    if (!ls.length) return null;
    let l = ls.find((x) => x.id === curId);
    if (!l) { l = ls[0]; curId = l.id; }
    return l;
  }
  function save() {
    App.store.save();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function parseTags(raw) {
    const tags = [];
    const text = String(raw).replace(/#(\S+)/g, (m, g) => { const t = g.slice(0, 16); if (t && !tags.includes(t)) tags.push(t); return ""; }).replace(/\s+/g, " ").trim();
    return { text, tags };
  }

  /* ---------- list mutations ---------- */
  function addList() {
    const name = (prompt("새 리스트 이름", "") || "").trim().slice(0, 20);
    if (!name) return;
    const emoji = (prompt("이모지 (선택, 예: 📈)", "📋") || "📋").trim().slice(0, 2) || "📋";
    const l = { id: App.cid(), name, emoji, tasks: [] };
    lists().push(l);
    curId = l.id;
    save();
    render();
  }
  function renameList() {
    const l = curList(); if (!l) return;
    const v = prompt("리스트 이름", l.name);
    if (v == null) return;
    l.name = v.trim().slice(0, 20) || l.name;
    const e = prompt("이모지", l.emoji);
    if (e != null) l.emoji = e.trim().slice(0, 2) || l.emoji;
    save(); render();
  }
  function delList() {
    const l = curList(); if (!l) return;
    if (!confirm(`리스트 "${l.name}"과(와) 그 안의 할 일을 모두 삭제할까요?`)) return;
    App.state.lists = lists().filter((x) => x.id !== l.id);
    curId = (App.state.lists[0] && App.state.lists[0].id) || null;
    save(); render();
  }

  /* ---------- task mutations ---------- */
  function addTask(raw) {
    const l = curList(); if (!l) return;
    const { text, tags } = parseTags((raw || "").trim());
    const clipped = text.slice(0, 80);
    if (!clipped) return;
    l.tasks.push({ id: App.cid(), text: clipped, done: false, tags, subs: [] });
    save(); render();
  }
  function findTask(id) { const l = curList(); return l && l.tasks.find((t) => t.id === id); }
  function toggleTask(id) { const t = findTask(id); if (t) { t.done = !t.done; save(); render(); } }
  function delTask(id) { const l = curList(); if (l) { l.tasks = l.tasks.filter((t) => t.id !== id); save(); render(); } }
  function toggleExpand(id) { if (expanded.has(id)) expanded.delete(id); else expanded.add(id); render(); }
  function addSub(id, raw) {
    const t = findTask(id); if (!t) return;
    const text = (raw || "").trim().slice(0, 80); if (!text) return;
    if (!Array.isArray(t.subs)) t.subs = [];
    t.subs.push({ id: App.cid(), text, done: false });
    expanded.add(id); save(); render();
  }
  function toggleSub(id, subId) { const t = findTask(id); const s = t && (t.subs || []).find((x) => x.id === subId); if (s) { s.done = !s.done; save(); render(); } }
  function delSub(id, subId) { const t = findTask(id); if (t && t.subs) { t.subs = t.subs.filter((x) => x.id !== subId); save(); render(); } }

  /* ---------- render ---------- */
  function taskHTML(t) {
    const subs = Array.isArray(t.subs) ? t.subs : [];
    const doneSubs = subs.filter((s) => s.done).length;
    const isExp = expanded.has(t.id);
    const tagsHtml = (t.tags || []).map((tg) => `<span class="tag-chip in-todo">#${esc(tg)}</span>`).join("");
    let h = `<div class="todo-item${t.done ? " done" : ""}" data-id="${t.id}">`;
    h += `<div class="todo-row">`;
    h += `<span class="todo-check" data-act="done" title="완료 체크">${t.done ? "☑" : "☐"}</span>`;
    h += `<span class="todo-text">${esc(t.text)}${tagsHtml}</span>`;
    h += `<button type="button" class="todo-mini${isExp ? " on" : ""}" data-act="expand" title="하위 할 일">▸${subs.length ? " " + doneSubs + "/" + subs.length : ""}</button>`;
    h += `<button type="button" class="todo-del" data-act="del" title="삭제">✕</button>`;
    h += `</div>`;
    if (isExp) {
      h += `<div class="todo-subs">`;
      subs.forEach((s) => {
        h += `<div class="sub-item${s.done ? " done" : ""}" data-sub="${s.id}">` +
          `<span class="sub-check" data-act="sub-done">${s.done ? "☑" : "☐"}</span>` +
          `<span class="sub-text">${esc(s.text)}</span>` +
          `<button type="button" class="sub-del" data-act="sub-del" title="삭제">✕</button>` +
          `</div>`;
      });
      h += `<div class="sub-add"><input type="text" class="sub-add-input" placeholder="하위 할 일 추가" maxlength="80" /><button type="button" class="sub-add-btn pixel-btn tiny">＋</button></div>`;
      h += `</div>`;
    }
    h += `</div>`;
    return h;
  }

  function render() {
    const chips = el("listChips");
    if (!chips) return;
    const ls = lists();
    chips.innerHTML = ls.map((l) => {
      const open = l.tasks.filter((t) => !t.done).length;
      return `<button class="list-chip${l.id === (curList() || {}).id ? " active" : ""}" data-id="${l.id}">${esc(l.emoji)} ${esc(l.name)} <span class="list-count">${open}</span></button>`;
    }).join("") + `<button class="list-chip add" data-add="1">＋ 리스트</button>`;

    const head = el("listHead");
    const tasksWrap = el("listTasks");
    const addRow = el("listAddRow");
    const l = curList();
    if (!l) {
      if (head) head.style.display = "none";
      if (addRow) addRow.style.display = "none";
      tasksWrap.innerHTML = '<p class="hint">리스트를 추가해 프로젝트별로 할 일을 관리하세요 📋</p>';
      return;
    }
    if (head) { head.style.display = ""; el("listTitle").textContent = `${l.emoji} ${l.name}`; }
    if (addRow) addRow.style.display = "";
    if (!l.tasks.length) { tasksWrap.innerHTML = '<p class="todo-empty hint">할 일을 추가해 보세요 ✏️ (#태그 · ▸ 하위 할 일)</p>'; return; }
    // 미완료 먼저, 완료는 아래로
    const sorted = l.tasks.slice().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
    tasksWrap.innerHTML = sorted.map(taskHTML).join("");
  }

  /* ---------- init ---------- */
  function init() {
    const chips = el("listChips");
    if (!chips) return;
    chips.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { addList(); return; }
      const chip = e.target.closest(".list-chip[data-id]");
      if (chip) { curId = chip.dataset.id; render(); }
    });
    const rn = el("listRename"); if (rn) rn.onclick = renameList;
    const dl = el("listDelete"); if (dl) dl.onclick = delList;

    const tasks = el("listTasks");
    tasks.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".sub-add-btn");
      if (addBtn) { const item = addBtn.closest(".todo-item"); const inp = item.querySelector(".sub-add-input"); addSub(item.dataset.id, inp.value); return; }
      const item = e.target.closest(".todo-item");
      const act = e.target.closest("[data-act]");
      if (!item || !act) return;
      const id = item.dataset.id, a = act.dataset.act;
      if (a === "done") toggleTask(id);
      else if (a === "del") delTask(id);
      else if (a === "expand") toggleExpand(id);
      else if (a === "sub-done") { const s = e.target.closest("[data-sub]"); if (s) toggleSub(id, s.dataset.sub); }
      else if (a === "sub-del") { const s = e.target.closest("[data-sub]"); if (s) delSub(id, s.dataset.sub); }
    });
    tasks.addEventListener("keydown", (e) => {
      const inp = e.target.closest(".sub-add-input");
      if (inp && e.key === "Enter" && !e.isComposing) { const item = inp.closest(".todo-item"); addSub(item.dataset.id, inp.value); }
    });

    const input = el("listTaskInput");
    const add = () => { addTask(input.value); input.value = ""; input.focus(); };
    el("listTaskAdd").onclick = add;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) add(); });

    render();
  }

  App.lists = { init, render };
})();
