/* ===========================================================
   timeline.js — PLAN | DONE 2열 타임라인
   한 행 = 1시간, 한 칸 = settings.slotMin(기본 10분)
   데이터: day.plan / day.done  →  { "HH:MM": {c: catId, t: "제목"} }
   Exposes: window.App.timeline
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  let activeCat = "study";      // 현재 선택된 팔레트 색
  let drag = null;              // {side, from, to}
  let editing = null;           // {side, keys:[], ds}
  let rowH = 28;

  const S = () => App.store;
  const perHour = () => Math.round(60 / S().slotMin());

  /* ---------- 슬롯 유틸 ---------- */
  function keyAt(idx) { return U.toHHMM(S().startMin() + idx * S().slotMin()); }
  function idxOfMin(min) { return Math.floor((min - S().startMin()) / S().slotMin()); }
  function totalSlots() { return Math.round((S().endMin() - S().startMin()) / S().slotMin()); }

  function sameBlock(a, b) {
    if (!a || !b) return false;
    return a.c === b.c && (a.t || "") === (b.t || "");
  }

  /* ---------- 렌더 ---------- */
  function render(ds) {
    const body = U.byId("tlBody");
    if (!body) return;
    const day = S().peekDay(ds);
    const cols = perHour();
    const startH = S().state.settings.dayStartHour;
    const endH = S().state.settings.dayEndHour;

    body.innerHTML = "";

    for (let h = startH; h < endH; h++) {
      const row = U.el("div", "tl-row");
      const isNowRow = U.isToday(ds) && new Date().getHours() === h;
      if (isNowRow) row.classList.add("now");

      row.appendChild(sideEl(ds, day.plan || {}, h, cols, "plan"));

      // 가운데 시각 열 (장 시간 음영)
      const tone = App.market.toneFor(ds, h * 60, 60);
      const hour = U.el("div", "tl-hour" + (tone ? " mk-" + tone : ""));
      const hv = h % 24;
      const disp = hv === 0 ? 12 : hv > 12 ? hv - 12 : hv;
      hour.appendChild(U.el("div", "hn", String(disp)));
      hour.title = `${U.pad(hv)}:00`;
      row.appendChild(hour);

      row.appendChild(sideEl(ds, day.done || {}, h, cols, "done"));
      body.appendChild(row);
    }

    // 현재 시각 선
    if (U.isToday(ds)) {
      const m = U.nowMin();
      if (m >= S().startMin() && m < S().endMin()) {
        const first = body.querySelector(".tl-row");
        rowH = (first && first.offsetHeight) || rowH;
        const line = U.el("div", "tl-nowline");
        line.style.top = ((m - S().startMin()) / 60) * rowH + "px";
        body.appendChild(line);
      }
    }

    renderScales(cols);
    renderLegend(ds);
    renderFoot(ds);
  }

  // 한쪽(plan/done)의 한 시간 행
  function sideEl(ds, map, h, cols, side) {
    const base = idxOfMin(h * 60);

    const wrap = U.el("div", "tl-side " + side);
    wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    wrap.dataset.side = side;
    wrap.dataset.base = base;

    // 바닥 셀 (격자 + 히트영역)
    for (let i = 0; i < cols; i++) {
      const c = U.el("div", "tl-cell");
      c.dataset.idx = base + i;
      c.dataset.side = side;
      wrap.appendChild(c);
    }

    // 세그먼트 오버레이
    let i = 0;
    while (i < cols) {
      const cur = map[keyAt(base + i)];
      if (!cur) { i++; continue; }
      let j = i;
      while (j + 1 < cols && sameBlock(map[keyAt(base + j + 1)], cur)) j++;

      const prev = base + i - 1 >= 0 ? map[keyAt(base + i - 1)] : null;
      const next = base + j + 1 < totalSlots() ? map[keyAt(base + j + 1)] : null;
      const isCont = sameBlock(prev, cur);
      const hasMore = sameBlock(next, cur);

      const cat = S().catById(cur.c);
      const seg = U.el("div", "tl-seg" + (isCont ? " cont" : "") + (hasMore ? " contend" : ""));
      seg.style.left = (i / cols) * 100 + "%";
      seg.style.width = ((j - i + 1) / cols) * 100 + "%";
      seg.style.background = (cat && cat.color) || "#e5e7eb";
      seg.dataset.side = side;
      seg.dataset.from = base + i;
      if (!isCont) seg.textContent = cur.t || (cat ? cat.name : "");
      const mins = (j - i + 1) * S().slotMin();
      seg.title = `${cur.t || (cat ? cat.name : "")} · ${keyAt(base + i)} (${mins}분)`;
      wrap.appendChild(seg);
      i = j + 1;
    }
    return wrap;
  }

  function renderScales(cols) {
    const step = S().slotMin();
    const html = Array.from({ length: cols }, (_, i) => `<span>${(i + 1) * step}</span>`).join("");
    U.setHTML("scaleL", html);
    U.setHTML("scaleR", html);
  }

  function renderLegend(ds) {
    const host = U.byId("tlLegend");
    if (!host) return;
    if (!App.market.enabled()) { host.innerHTML = ""; return; }
    const st = App.market.statusNow(ds);
    const toneColor = { core: "var(--mk-core)", pre: "var(--mk-pre)", after: "var(--mk-after)" };
    let h = App.market.sessions()
      .map((s) => `<span><i style="background:${toneColor[s.tone] || "#eee"}"></i>${U.esc(s.name)} ${s.start}~${s.end}</span>`)
      .join("");
    if (U.isToday(ds)) {
      h += `<span style="margin-left:auto;font-weight:700;color:var(--ink-2)">
        <span class="mk-dot ${st.tone || "off"}"></span>${U.esc(st.label)}</span>`;
    }
    host.innerHTML = h;
  }

  function renderFoot(ds) {
    const host = U.byId("tlFoot");
    if (!host) return;
    const planMin = S().filledMin(ds, "plan");
    const doneMin = S().filledMin(ds, "done");
    const adh = S().adherence(ds);
    const onTime = S().onTimeRate(ds);
    const study = S().studyMin(ds, "done");
    host.innerHTML =
      `<span>계획 <b>${U.minToKo(planMin)}</b></span>` +
      `<span>실행 <b>${U.minToKo(doneMin)}</b></span>` +
      `<span>공부 <b>${U.minToKo(study)}</b></span>` +
      (adh == null ? "" : `<span>실천율 <b>${adh}%</b></span>`) +
      (onTime == null ? "" : `<span style="color:var(--muted)">제시간 ${onTime}%</span>`) +
      `<span style="margin-left:auto;color:var(--faint)">DONE은 아래에서 탭으로 판정하세요</span>`;
  }

  /* ---------- 칠하기 ---------- */
  function paintRange(ds, side, from, to, catId, title) {
    const day = S().getDay(ds);
    const map = day[side];
    const a = Math.min(from, to), b = Math.max(from, to);
    for (let i = a; i <= b; i++) {
      const k = keyAt(i);
      if (catId === "__erase") delete map[k];
      else map[k] = { c: catId, t: title || (map[k] && map[k].t) || "" };
    }
    S().touch(ds);
  }

  // 외부(뽀모도로 등)에서 분 단위로 기록
  function applyMinutes(ds, side, fromMin, toMin, catId, title) {
    const a = idxOfMin(Math.max(fromMin, S().startMin()));
    const b = idxOfMin(Math.min(toMin, S().endMin()) - 1);
    if (b < a) return 0;
    paintRange(ds, side, a, b, catId, title);
    return (b - a + 1) * S().slotMin();
  }

  function copyPlanToDone(ds) {
    const day = S().getDay(ds);
    let n = 0;
    for (const k in day.plan) {
      if (!day.done[k]) { day.done[k] = { ...day.plan[k] }; n++; }
    }
    S().touch(ds);
    return n * S().slotMin();
  }

  /* ---------- 블록 편집 모달 ---------- */
  function openEditor(ds, side, idx) {
    const map = S().peekDay(ds)[side] || {};
    const cur = map[keyAt(idx)];
    if (!cur) return;
    // 같은 블록의 전체 범위 찾기
    let a = idx, b = idx;
    while (a - 1 >= 0 && sameBlock(map[keyAt(a - 1)], cur)) a--;
    while (b + 1 < totalSlots() && sameBlock(map[keyAt(b + 1)], cur)) b++;

    const keys = [];
    for (let i = a; i <= b; i++) keys.push(keyAt(i));
    editing = { ds, side, keys, cat: cur.c };

    U.setText("blockModalTitle",
      `${side === "plan" ? "계획" : "실행"} · ${keyAt(a)}~${U.toHHMM(U.toMin(keyAt(b)) + S().slotMin())}`);
    const inp = U.byId("blockTitle");
    if (inp) { inp.value = cur.t || ""; }
    rebindBlockPalette();
    App.ui.openModal("blockModal");
    setTimeout(() => inp && inp.focus(), 30);
  }

  function rebindBlockPalette() {
    if (!editing) return;
    App.ui.renderPalette("blockPalette", editing.cat, (id) => {
      editing.cat = id;
      rebindBlockPalette();
    }, { noEraser: true });
  }

  function saveEditor() {
    if (!editing) return;
    const t = (U.byId("blockTitle").value || "").trim();
    const day = S().getDay(editing.ds);
    editing.keys.forEach((k) => { day[editing.side][k] = { c: editing.cat, t }; });
    S().touch(editing.ds);
    App.ui.closeModal("blockModal");
    editing = null;
    App.day.refresh();
  }

  function deleteEditor() {
    if (!editing) return;
    const day = S().getDay(editing.ds);
    editing.keys.forEach((k) => { delete day[editing.side][k]; });
    S().touch(editing.ds);
    App.ui.closeModal("blockModal");
    editing = null;
    App.day.refresh();
  }

  /* ---------- 이벤트 ---------- */
  // 포인터 위치로 슬롯 인덱스 계산 (세그먼트 위를 지나도 정확하게)
  function hitSlot(e) {
    const side = e.target.closest(".tl-side");
    if (!side) return null;
    const r = side.getBoundingClientRect();
    const cols = perHour();
    const col = U.clamp(Math.floor(((e.clientX - r.left) / r.width) * cols), 0, cols - 1);
    return { side: side.dataset.side, idx: +side.dataset.base + col };
  }

  function init() {
    const body = U.byId("tlBody");
    if (!body) return;

    rebindPalette();

    body.addEventListener("mousedown", (e) => {
      const hit = hitSlot(e);
      if (!hit) return;
      // 이미 칠해진 블록을 '지우개가 아닌 상태'로 클릭하면 편집
      const seg = e.target.closest(".tl-seg");
      if (seg && activeCat !== "__erase") {
        openEditor(App.day.date(), hit.side, hit.idx);
        return;
      }
      e.preventDefault();
      drag = { side: hit.side, from: hit.idx, to: hit.idx };
      paintRange(App.day.date(), drag.side, hit.idx, hit.idx, activeCat);
      render(App.day.date());
    });

    body.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const hit = hitSlot(e);
      if (!hit || hit.side !== drag.side || hit.idx === drag.to) return;
      drag.to = hit.idx;
      paintRange(App.day.date(), drag.side, drag.from, drag.to, activeCat);
      render(App.day.date());
    });

    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      App.day.refresh();
    });

    // 할일 드래그 → 타임라인 드롭
    body.addEventListener("dragover", (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("text/plain")) e.preventDefault();
    });
    body.addEventListener("drop", (e) => {
      const hit = hitSlot(e);
      if (!hit) return;
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;
      const span = Math.max(1, Math.round(30 / S().slotMin())); // 기본 30분
      paintRange(App.day.date(), hit.side, hit.idx, hit.idx + span - 1, activeCat, text);
      App.day.refresh();
      App.ui.toast(`“${text}” 배치했어요`);
    });

    U.on("copyPlan", "click", () => {
      const added = copyPlanToDone(App.day.date());
      App.day.refresh();
      App.ui.toast(added ? `계획 ${U.minToKo(added)}를 실행으로 복사했어요` : "복사할 계획이 없어요");
    });

    U.on("blockSave", "click", saveEditor);
    U.on("blockDelete", "click", deleteEditor);
    U.on("blockCancel", "click", () => { App.ui.closeModal("blockModal"); editing = null; });
    U.on("blockTitle", "keydown", (e) => { if (e.key === "Enter") saveEditor(); });
  }

  function rebindPalette() {
    const cats = S().state.categories;
    if (activeCat !== "__erase" && !cats.some((c) => c.id === activeCat)) {
      activeCat = (cats[0] || {}).id || "__erase";
    }
    App.ui.renderPalette("palette", activeCat, (id) => {
      activeCat = id;
      rebindPalette();
    });
  }

  App.timeline = {
    init, render, applyMinutes, copyPlanToDone,
    refreshPalette: rebindPalette,          // 카테고리가 바뀌면 설정에서 호출
    get activeCat() { return activeCat; },
  };
})();
