/* ===========================================================
   planner.js — timebox grid: paint plans, check completion, summary
   Exposes: window.App.planner
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  let curDate = U.today();
  let brush = null; // categoryId | 'eraser'
  let painting = false;
  let lastPaintTime = null;
  let snappedThisGesture = false;
  let lastScrolledDate = null;
  let modalTime = null;
  let gesture = null; // { time, empty, moved, pt } — current pointer gesture
  let focusTime = null; // roving keyboard focus

  /* ---------- day helpers ---------- */
  function getDay() {
    const s = App.state;
    if (!s.days[curDate]) s.days[curDate] = { blocks: {} };
    if (!s.days[curDate].blocks) s.days[curDate].blocks = {};
    return s.days[curDate];
  }
  function block(time) { return (App.state.days[curDate] && App.state.days[curDate].blocks || {})[time] || null; }
  function setBlock(time, data) {
    const day = getDay();
    if (data === null) delete day.blocks[time];
    else day.blocks[time] = data;
  }

  function commit(sfx) {
    if (App.state.days[curDate]) App.state.days[curDate].mtime = Date.now(); // for day-level sync merge
    App.store.save();
    if (sfx) sfx();
    App.refreshAll();
  }

  /* ---------- brushes ---------- */
  function renderBrushes() {
    const bar = document.getElementById("brushBar");
    bar.innerHTML = "";
    if (!brush) brush = App.state.categories[0] ? App.state.categories[0].id : "eraser";
    App.state.categories.forEach((c) => {
      const b = document.createElement("button");
      b.className = "brush" + (brush === c.id ? " active" : "");
      b.style.background = c.color;
      b.style.color = U.textOn(c.color);
      b.style.textShadow = "none";
      b.innerHTML = `<span class="b-emoji">${c.emoji}</span>${c.name}`;
      b.onclick = () => { brush = c.id; renderBrushes(); };
      bar.appendChild(b);
    });
    const er = document.createElement("button");
    er.className = "brush eraser" + (brush === "eraser" ? " active" : "");
    er.innerHTML = "🧽 지우개";
    er.onclick = () => { brush = "eraser"; renderBrushes(); };
    bar.appendChild(er);
  }

  /* ---------- paint actions ---------- */
  function applyBrush(time) {
    if (brush === "eraser") { setBlock(time, null); return; }
    const existing = block(time);
    if (existing && existing.categoryId === brush) return; // no churn while dragging
    setBlock(time, { categoryId: brush, note: existing && existing.categoryId === brush ? existing.note : "", done: false });
  }

  function toggleDone(time) {
    const b = block(time);
    if (!b) return;
    App.history.snapshot();
    b.done = !b.done;
    updateCell(time);
    if (b.done) {
      const cell = document.querySelector(`#timeGrid .cell[data-time="${time}"]`);
      if (cell) { cell.classList.remove("juststamped"); void cell.offsetWidth; cell.classList.add("juststamped"); }
    }
    commit(b.done ? App.gamify.sfx.complete : App.gamify.sfx.uncheck);
  }

  /* ---------- grid render ---------- */
  function nowTimeSlot() {
    if (curDate !== U.today()) return null;
    const n = new Date();
    const slots = U.slotsFor(App.state.settings);
    const mins = n.getHours() * 60 + n.getMinutes();
    let best = null;
    for (const s of slots) {
      const [h, m] = s.time.split(":").map(Number);
      if (h * 60 + m <= mins) best = s.time;
    }
    return best;
  }

  function fillCell(cell, time, onHour, nowT) {
    cell.className = "cell" + (onHour ? " hour" : "") + (time === nowT ? " now" : "");
    cell.dataset.time = time;
    cell.style.background = ""; cell.style.color = ""; cell.style.textShadow = "";
    cell.setAttribute("role", "button");
    cell.tabIndex = time === focusTime ? 0 : -1;
    const b = block(time);
    const aCat = b && b.categoryId ? App.catById(b.categoryId) : null;
    cell.setAttribute("aria-label", `${time} ${aCat ? aCat.name + (b.done ? " 완료" : " 계획") : "비어 있음"}`);
    if (b && b.categoryId) {
      const cat = App.catById(b.categoryId);
      if (cat) {
        const actualCat = b.done && b.actual && b.actual !== b.categoryId ? App.catById(b.actual) : null;
        const shown = actualCat || cat;
        cell.classList.add("filled", b.done ? "done" : "notdone");
        cell.style.background = shown.color;
        if (b.done) { cell.style.color = U.textOn(shown.color); cell.style.textShadow = "none"; }
        const note = b.note || cat.name;
        cell.innerHTML =
          `<span class="c-emoji">${shown.emoji}</span>` +
          `<span class="c-note">${escapeHtml(note)}${actualCat ? ` <small class="c-plan-note">(계획:${escapeHtml(cat.name)})</small>` : ""}</span>` +
          `<span class="c-check${b.done ? " on" : ""}" aria-label="${b.done ? "완료됨" : "미완료"}"></span>` +
          `<span class="edit-dot" data-edit="${time}">⋯</span>`;
        return;
      }
    }
    cell.classList.add("empty");
    cell.innerHTML = `<span class="edit-dot" data-edit="${time}">⋯</span>`;
  }

  function updateCell(time) {
    const cell = document.querySelector(`#timeGrid .cell[data-time="${time}"]`);
    if (cell) fillCell(cell, time, time.endsWith(":00"), nowTimeSlot());
  }

  function renderGrid() {
    const grid = document.getElementById("timeGrid");
    grid.className = "time-grid" + (App.state.settings.compact ? " compact" : "");
    grid.innerHTML = "";
    const slots = U.slotsFor(App.state.settings);
    const nowT = nowTimeSlot();
    if (!focusTime || !slots.some((s) => s.time === focusTime)) focusTime = nowT || (slots[0] && slots[0].time) || null;
    slots.forEach((s) => {
      const row = document.createElement("div");
      row.className = "slot" + (s.onHour ? " hour" : "");
      const label = document.createElement("div");
      label.className = "t-label";
      label.textContent = s.onHour ? s.time : "";
      const cell = document.createElement("div");
      fillCell(cell, s.time, s.onHour, nowT);
      row.appendChild(label);
      row.appendChild(cell);
      grid.appendChild(row);
    });
  }

  function scrollToNow() {
    if (curDate !== U.today() || curDate === lastScrolledDate) return;
    lastScrolledDate = curDate;
    const nowT = nowTimeSlot();
    if (!nowT) return;
    const grid = document.getElementById("timeGrid");
    const cell = grid.querySelector(`.cell[data-time="${nowT}"]`);
    if (cell && cell.parentElement) {
      grid.scrollTop = Math.max(0, cell.parentElement.offsetTop - grid.clientHeight / 2);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  /* ---------- grid events (pointer paint, touch-friendly) ---------- */
  function paintAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el && el.closest ? el.closest(".cell") : null;
    if (!cell || !cell.dataset.time) return;
    const time = cell.dataset.time;
    if (time === lastPaintTime) return;
    lastPaintTime = time;
    if (!snappedThisGesture) { App.history.snapshot(); snappedThisGesture = true; }
    applyBrush(time);
    updateCell(time);
  }

  // Modeless: tap empty cell = plan, tap filled cell = toggle done, drag (mouse) = paint range.
  function bindGrid() {
    const grid = document.getElementById("timeGrid");

    grid.addEventListener("pointerdown", (e) => {
      const editDot = e.target.closest("[data-edit]");
      if (editDot) { gesture = null; openBlockModal(editDot.dataset.edit); return; }
      const cell = e.target.closest(".cell");
      if (!cell) return;
      gesture = { time: cell.dataset.time, empty: !block(cell.dataset.time), moved: false, pt: e.pointerType };
      painting = false;
      snappedThisGesture = false;
      lastPaintTime = null;
    });

    grid.addEventListener("pointermove", (e) => {
      if (!gesture) return;
      if (gesture.pt === "touch") { gesture.moved = true; return; } // let touch scroll the grid
      gesture.moved = true;       // mouse drag = paint
      painting = true;
      paintAt(e.clientX, e.clientY);
      e.preventDefault();
    }, { passive: false });

    function endGesture() {
      if (!gesture) { if (painting) { painting = false; commit(); } return; }
      const g = gesture; gesture = null;
      if (painting) { painting = false; lastPaintTime = null; commit(); return; }
      if (g.moved) return; // touch scroll — no edit
      if (g.empty) {
        App.history.snapshot();
        applyBrush(g.time);
        updateCell(g.time);
        App.gamify.sfx.paint();
        commit();
      } else {
        toggleDone(g.time); // filled cell tap = check/uncheck
      }
    }
    window.addEventListener("pointerup", endGesture);
    window.addEventListener("pointercancel", () => { gesture = null; if (painting) { painting = false; commit(); } });

    // --- keyboard operability (roving tabindex) ---
    function focusCell(time) {
      if (!time) return;
      const old = grid.querySelector('.cell[tabindex="0"]');
      if (old) old.tabIndex = -1;
      focusTime = time;
      const el = grid.querySelector(`.cell[data-time="${time}"]`);
      if (el) { el.tabIndex = 0; el.focus(); }
    }
    function refocus(time) { const el = grid.querySelector(`.cell[data-time="${time}"]`); if (el) { el.tabIndex = 0; el.focus(); } }
    grid.addEventListener("keydown", (e) => {
      const cell = e.target.closest && e.target.closest(".cell");
      if (!cell) return;
      const time = cell.dataset.time;
      const slots = U.slotsFor(App.state.settings).map((s) => s.time);
      const i = slots.indexOf(time);
      const k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); focusCell(slots[Math.min(slots.length - 1, i + 1)]); }
      else if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); focusCell(slots[Math.max(0, i - 1)]); }
      else if (k === "Home") { e.preventDefault(); focusCell(slots[0]); }
      else if (k === "End") { e.preventDefault(); focusCell(slots[slots.length - 1]); }
      else if (k === "Enter" || k === " ") {
        e.preventDefault();
        if (block(time)) toggleDone(time);
        else { App.history.snapshot(); applyBrush(time); updateCell(time); App.gamify.sfx.paint(); commit(); }
        refocus(time);
      } else if (k === "Delete" || k === "Backspace") {
        e.preventDefault();
        if (block(time)) { App.history.snapshot(); setBlock(time, null); updateCell(time); commit(); refocus(time); }
      } else if (k === "e" || k === "E") { e.preventDefault(); openBlockModal(time); }
    });
  }

  /* ---------- block modal (with actual-vs-planned) ---------- */
  function renderModalPicker(containerId, selectedId, withDefault) {
    const pick = document.getElementById(containerId);
    pick.innerHTML = "";
    App.state.categories.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "brush" + (selectedId === c.id ? " active" : "");
      btn.style.background = c.color;
      btn.style.color = U.textOn(c.color);
      btn.style.textShadow = "none";
      btn.dataset.cat = c.id;
      btn.innerHTML = `<span class="b-emoji">${c.emoji}</span>${c.name}`;
      btn.onclick = () => {
        pick.querySelectorAll(".brush").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
      };
      pick.appendChild(btn);
    });
  }

  function openBlockModal(time) {
    modalTime = time;
    const b = block(time) || { categoryId: (App.state.categories[0] || {}).id, note: "", done: false };
    document.getElementById("blockModalTitle").textContent = `${time} 칸 편집`;
    renderModalPicker("blockCatPick", b.categoryId, false);
    renderModalPicker("blockActualPick", b.actual || b.categoryId, false);
    document.getElementById("blockNote").value = b.note || "";
    document.getElementById("blockDone").checked = !!b.done;
    App.ui.openModal("blockModal");
  }

  function saveBlockModal() {
    const planned = (document.querySelector("#blockCatPick .brush.active") || {}).dataset;
    const actualEl = document.querySelector("#blockActualPick .brush.active");
    const catId = planned ? planned.cat : App.state.categories[0].id;
    const actualId = actualEl ? actualEl.dataset.cat : catId;
    App.history.snapshot();
    const data = {
      categoryId: catId,
      note: document.getElementById("blockNote").value.trim(),
      done: document.getElementById("blockDone").checked,
    };
    if (actualId && actualId !== catId) data.actual = actualId;
    setBlock(modalTime, data);
    App.ui.closeModals();
    updateCell(modalTime);
    commit();
  }
  function deleteBlockModal() {
    App.history.snapshot();
    setBlock(modalTime, null);
    App.ui.closeModals();
    updateCell(modalTime);
    commit();
  }

  /* ---------- copy day / weekday templates ---------- */
  function blocksToTemplate(blocks) {
    const map = {};
    for (const t in blocks) {
      const b = blocks[t];
      if (b && b.categoryId) map[t] = { categoryId: b.categoryId, note: b.note || "" };
    }
    return map;
  }
  function applyMap(map) {
    const day = getDay();
    let n = 0;
    for (const t in map) { day.blocks[t] = { categoryId: map[t].categoryId, note: map[t].note || "", done: false }; n++; }
    return n;
  }
  function hasBlocks() { const b = (App.state.days[curDate] || {}).blocks || {}; return Object.keys(b).length > 0; }

  function copyYesterday() {
    const prev = U.ymd(U.addDays(U.parseYmd(curDate), -1));
    const src = (App.state.days[prev] || {}).blocks || {};
    if (!Object.keys(src).length) { App.gamify.toast("어제 계획이 없어요"); return; }
    if (hasBlocks() && !confirm("오늘 계획을 어제 것으로 덮어쓸까요?")) return;
    App.history.snapshot();
    const n = applyMap(blocksToTemplate(src));
    render(); commit();
    App.gamify.toast(`📋 어제 계획 ${n}칸을 복사했어요`);
  }
  function tplSave() {
    const wd = U.parseYmd(curDate).getDay();
    const map = blocksToTemplate((App.state.days[curDate] || {}).blocks || {});
    if (!Object.keys(map).length) { App.gamify.toast("저장할 계획이 없어요"); return; }
    App.state.templates[wd] = map;
    App.store.save();
    App.gamify.toast(`💾 ${U.KDOW[wd]}요일 템플릿으로 저장했어요`);
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }
  function tplApply() {
    const wd = U.parseYmd(curDate).getDay();
    const map = App.state.templates[wd];
    if (!map || !Object.keys(map).length) { App.gamify.toast(`${U.KDOW[wd]}요일 템플릿이 없어요`); return; }
    if (hasBlocks() && !confirm("오늘 계획을 템플릿으로 덮어쓸까요?")) return;
    App.history.snapshot();
    const n = applyMap(map);
    render(); commit();
    App.gamify.toast(`⭐ ${U.KDOW[wd]}요일 템플릿 ${n}칸을 적용했어요`);
  }

  /* ---------- summary panel ---------- */
  function renderSummary() {
    const d = App.stats.deriveDay(curDate);
    document.getElementById("ringPct").textContent = d.pct + "%";
    document.querySelector(".completion-ring").style.setProperty("--pct", d.pct + "%");
    document.getElementById("sumPlanned").textContent = d.plannedBlocks;
    document.getElementById("sumDone").textContent = d.doneBlocks;
    document.getElementById("sumHours").textContent = U.minToH(d.doneMin);

    const slotMin = App.state.settings.slotMinutes;
    const perCat = {};
    for (const cid in d.perCat) {
      perCat[cid] = { plannedMin: d.perCat[cid].planned * slotMin, doneMin: d.perCat[cid].done * slotMin };
    }
    App.charts.catBars(document.getElementById("catBars"), perCat);

    const badge = document.getElementById("dayBadge");
    if (d.plannedBlocks === 0) { badge.textContent = "오늘의 퀘스트를 계획해 보세요!"; badge.className = "day-badge meh"; }
    else if (d.isWin) { badge.textContent = "🏆 성공한 하루! 스트릭 유지 중"; badge.className = "day-badge win"; }
    else { badge.textContent = `목표까지 ${App.state.settings.completionTarget - d.pct}% 남았어요`; badge.className = "day-badge meh"; }
  }

  /* ---------- header / nav ---------- */
  function renderHeader() {
    document.getElementById("dayTitle").textContent = U.fmtDayTitle(curDate);
    document.getElementById("daySub").textContent = U.fmtDaySub(curDate);
    document.getElementById("modeHint").textContent =
      "색을 골라 칸을 칠해 계획하고, 칸의 네모(☐)를 눌러 완료 체크하세요";
  }

  // auto-apply this weekday's template to an untouched today/future day
  function maybeAutoTemplate() {
    const s = App.state;
    if (!s.settings.autoTemplate) return;
    if (s.days[curDate]) return;          // day already has a record
    if (curDate < U.today()) return;      // don't fabricate past days
    const wd = U.parseYmd(curDate).getDay();
    const map = s.templates[wd];
    if (!map || !Object.keys(map).length) return;
    applyMap(map);
    if (App.state.days[curDate]) App.state.days[curDate].mtime = Date.now();
    App.store.save();
    if (curDate === U.today()) App.gamify.toast(`⭐ ${U.KDOW[wd]}요일 템플릿 자동 적용`);
  }

  function render() {
    maybeAutoTemplate();
    renderHeader();
    renderBrushes();
    renderGrid();
    renderSummary();
    scrollToNow();
  }

  function setDate(ds) { curDate = ds; render(); }
  function shift(n) { curDate = U.ymd(U.addDays(U.parseYmd(curDate), n)); render(); }

  /* ---------- pomodoro → timebox reflection ----------
     Mark every of TODAY's slots that overlaps [startMs, endMs) as done.
     Empty slots are created (planned=actual=categoryId); already-planned
     slots are just completed (recording a different actual if it differs). */
  function reflectRange(categoryId, startMs, endMs) {
    if (!categoryId || !(endMs > startMs)) return 0;
    const s = App.state;
    const ds = U.today();
    if (!s.days[ds]) s.days[ds] = { blocks: {} };
    if (!s.days[ds].blocks) s.days[ds].blocks = {};
    const blocks = s.days[ds].blocks;
    const slotLen = s.settings.slotMinutes;
    const dayBase = U.parseYmd(ds).getTime();
    let n = 0;
    U.slotsFor(s.settings).forEach((sl) => {
      const [h, m] = sl.time.split(":").map(Number);
      const slotStart = dayBase + (h * 60 + m) * 60000;
      const slotEnd = slotStart + slotLen * 60000;
      if (slotStart < endMs && slotEnd > startMs) { // any overlap
        const ex = blocks[sl.time];
        if (!ex) blocks[sl.time] = { categoryId, note: "🍅 집중", done: true };
        else {
          if (ex.categoryId !== categoryId && !ex.actual) ex.actual = categoryId;
          ex.done = true;
        }
        n++;
      }
    });
    if (n) {
      s.days[ds].mtime = Date.now();
      App.store.save();
      if (curDate === ds) render();
      App.refreshAll();
    }
    return n;
  }

  /* ---------- init ---------- */
  function init() {
    bindGrid();
    document.getElementById("prevDay").onclick = () => shift(-1);
    document.getElementById("nextDay").onclick = () => shift(1);
    document.getElementById("todayBtn").onclick = () => { lastScrolledDate = null; setDate(U.today()); };

    document.getElementById("blockSave").onclick = saveBlockModal;
    document.getElementById("blockDelete").onclick = deleteBlockModal;

    const cy = document.getElementById("copyYesterday"); if (cy) cy.onclick = copyYesterday;
    const ta = document.getElementById("tplApply"); if (ta) ta.onclick = tplApply;
    const ts = document.getElementById("tplSave"); if (ts) ts.onclick = tplSave;
  }

  App.planner = { init, render, setDate, getDate: () => curDate, renderSummary, reflectRange };
})();
