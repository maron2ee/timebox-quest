/* ===========================================================
   tasks.js — 프로젝트 그룹별 오늘 할 일
   day.tasks = [{id, projectId, text, done}]  (하루 단위)
   projects   = 전역 그룹 정의 [{id, name, tab:'study'|'plan', collapsed}]
   Exposes: window.App.tasks
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let tab = "study";

  function groupsOfTab() { return S().state.projects.filter((p) => p.tab === tab); }

  function render(ds) {
    const host = U.byId("groupList");
    if (!host) return;
    const day = S().peekDay(ds);
    const all = day.tasks || [];
    host.innerHTML = "";

    const groups = groupsOfTab();
    if (!groups.length) {
      host.appendChild(U.el("div", "empty", "그룹이 없어요. 아래에서 추가해 보세요."));
      return;
    }

    groups.forEach((p) => {
      const list = all.filter((t) => t.projectId === p.id);
      const done = list.filter((t) => t.done).length;

      const g = U.el("div", "group" + (p.collapsed ? " collapsed" : ""));

      /* 머리말 */
      const head = U.el("div", "group-head");
      head.appendChild(U.el("span", "group-dot"));
      const name = U.el("input", "group-name");
      name.value = p.name;
      name.onchange = () => { p.name = name.value.trim() || "그룹"; S().save(); };
      name.onclick = (e) => e.stopPropagation();
      head.appendChild(name);
      head.appendChild(U.el("span", "group-count", `${done}/${list.length}`));
      head.appendChild(U.el("span", "chev", "▾"));
      head.onclick = () => { p.collapsed = !p.collapsed; S().save(); render(ds); };
      g.appendChild(head);

      /* 본문 */
      const bodyEl = U.el("div", "group-body");
      list.forEach((t) => bodyEl.appendChild(taskRow(ds, t)));
      bodyEl.appendChild(addRow(ds, p.id));
      g.appendChild(bodyEl);

      host.appendChild(g);
    });
  }

  function taskRow(ds, t) {
    const row = U.el("div", "task" + (t.done ? " done" : ""));
    row.draggable = true;

    const grip = U.el("span", "task-grip", "⠿");
    row.appendChild(grip);

    const cb = U.el("button", "cb", "✓");
    cb.onclick = () => {
      const day = S().getDay(ds);
      const x = day.tasks.find((q) => q.id === t.id);
      if (x) x.done = !x.done;
      S().touch(ds);
      App.day.refresh();
    };
    row.appendChild(cb);

    const inp = U.el("input", "task-text");
    inp.value = t.text;
    inp.onchange = () => {
      const day = S().getDay(ds);
      const x = day.tasks.find((q) => q.id === t.id);
      if (x) x.text = inp.value;
      S().touch(ds);
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); };
    row.appendChild(inp);

    const del = U.el("button", "task-del", "✕");
    del.title = "삭제";
    del.onclick = () => {
      const day = S().getDay(ds);
      day.tasks = day.tasks.filter((q) => q.id !== t.id);
      S().touch(ds);
      App.day.refresh();
    };
    row.appendChild(del);

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", t.text);
      e.dataTransfer.effectAllowed = "copy";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));

    return row;
  }

  function addRow(ds, projectId) {
    const row = U.el("div", "add-row");
    row.appendChild(U.el("span", null, "＋"));
    const inp = U.el("input");
    inp.placeholder = "할 일 추가";

    // Enter 또는 포커스 아웃 시 저장 (둘 다 지원)
    function commit(keepFocus) {
      const text = inp.value.trim();
      if (!text) return;
      inp.value = "";
      const day = S().getDay(ds);
      day.tasks.push({ id: U.uid("t"), projectId, text, done: false });
      S().touch(ds);
      App.day.refresh();
      if (!keepFocus) return;
      // 연속 입력을 위해 같은 그룹의 입력칸으로 포커스 복귀
      setTimeout(() => {
        const idx = groupsOfTab().findIndex((p) => p.id === projectId);
        const next = U.$$(".group-body .add-row input")[idx];
        if (next) next.focus();
      }, 0);
    }

    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(true); } };
    inp.onblur = () => commit(false);
    row.appendChild(inp);
    return row;
  }

  /* ---------- 어제 미완료 가져오기 ---------- */
  function carryOver(ds) {
    const prev = U.addDays(ds, -1);
    const from = S().peekDay(prev).tasks || [];
    const open = from.filter((t) => !t.done);
    if (!open.length) { App.ui.toast("어제 남은 할 일이 없어요"); return; }
    const day = S().getDay(ds);
    const existing = new Set(day.tasks.map((t) => t.projectId + "|" + t.text));
    let n = 0;
    open.forEach((t) => {
      const k = t.projectId + "|" + t.text;
      if (existing.has(k)) return;
      day.tasks.push({ id: U.uid("t"), projectId: t.projectId, text: t.text, done: false });
      n++;
    });
    S().touch(ds);
    App.day.refresh();
    App.ui.toast(n ? `${n}개를 가져왔어요` : "이미 다 가져왔어요");
  }

  /* ---------- 그룹 추가 ---------- */
  function addGroup(ds) {
    const name = prompt("새 그룹 이름", "");
    if (name == null) return;
    const n = name.trim();
    if (!n) return;
    S().state.projects.push({ id: U.uid("p"), name: n, tab, collapsed: false });
    S().save();
    render(ds);
  }

  function init() {
    U.$$("#taskTabs .subtab").forEach((b) => {
      b.onclick = () => {
        tab = b.dataset.tab;
        U.$$("#taskTabs .subtab").forEach((x) => x.classList.toggle("active", x === b));
        App.day.refresh();
      };
    });
    U.on("addGroupBtn", "click", () => addGroup(App.day.date()));
    U.on("carryBtn", "click", () => carryOver(App.day.date()));
  }

  App.tasks = { init, render, carryOver, get tab() { return tab; } };
})();
