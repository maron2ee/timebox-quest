/* ===========================================================
   settings.js — 타임라인 / 장 시간 / 카테고리 / 데이터
   Exposes: window.App.settings
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  /* ---------- 장 시간 ---------- */
  function sessionsRaw() {
    const m = S().state.settings.market;
    if (!m.sessions || !m.sessions.length) m.sessions = App.market.DEFAULT_SESSIONS.map((s) => ({ ...s }));
    return m.sessions;
  }

  function renderMarket() {
    const host = U.byId("marketRows");
    if (!host) return;
    const cb = U.byId("setMarket");
    if (cb) cb.checked = S().state.settings.market.show !== false;

    host.innerHTML = sessionsRaw().map((s, i) => `
      <div class="row" style="gap:8px;margin-bottom:6px" data-i="${i}">
        <span class="mk-dot ${s.tone}"></span>
        <span style="flex:1;min-width:120px;font-size:13px;font-weight:600">${U.esc(s.name)}</span>
        <input class="inp mk-s" type="time" value="${U.esc(s.start)}" style="max-width:118px">
        <span style="color:var(--faint)">~</span>
        <input class="inp mk-e" type="time" value="${U.esc(s.end)}" style="max-width:118px">
      </div>`).join("");

    U.$$("#marketRows .row").forEach((row) => {
      const i = +row.dataset.i;
      row.querySelector(".mk-s").onchange = (e) => { sessionsRaw()[i].start = e.target.value; S().save(); App.day.refresh(); };
      row.querySelector(".mk-e").onchange = (e) => { sessionsRaw()[i].end = e.target.value; S().save(); App.day.refresh(); };
    });
  }

  /* ---------- 루틴 구간 ---------- */
  // activeScheduleId: 지금 설정 화면에서 편집 중인 대상. null = 기본 시간표.
  // 실제 하루 화면에 뭐가 적용되는지는 '보는 날짜'가 그 세트 기간(from~to) 안인지로 정해진다
  // (store.phasesOn) — 여기서 뭘 선택해 편집 중이든 오늘 화면엔 영향 없다.
  let activeScheduleId = null;
  function phasesRaw() {
    if (activeScheduleId) {
      const sc = S().scheduleById(activeScheduleId);
      if (sc) return sc.phases;
      activeScheduleId = null;
    }
    return S().state.settings.routine.phases;
  }
  function cloneBasePhases() {
    return S().state.settings.routine.phases.map((p) => ({ ...p, items: (p.items || []).map((i) => ({ ...i })) }));
  }

  function renderScheduleChips() {
    const host = U.byId("schedChips");
    if (!host) return;
    host.innerHTML = "";
    const base = U.el("button", "chip" + (!activeScheduleId ? " active" : ""), "기본");
    base.onclick = () => { activeScheduleId = null; openPhase = null; render2(); };
    host.appendChild(base);
    S().schedules().forEach((sc) => {
      const chip = U.el("button", "chip" + (activeScheduleId === sc.id ? " active" : ""), U.esc(sc.name));
      chip.title = `${sc.from} ~ ${sc.to}`;
      chip.onclick = () => { activeScheduleId = sc.id; openPhase = null; render2(); };
      host.appendChild(chip);
    });
  }
  function renderScheduleEditRow() {
    const wrap = U.byId("schedEdit");
    if (!wrap) return;
    const sc = activeScheduleId ? S().scheduleById(activeScheduleId) : null;
    wrap.hidden = !sc;
    if (!sc) return;
    const nm = U.byId("schedName"), fr = U.byId("schedFrom"), to = U.byId("schedTo");
    if (nm && !nm.matches(":focus")) nm.value = sc.name;
    if (fr) fr.value = sc.from;
    if (to) to.value = sc.to;
  }
  // 세트 선택/추가/삭제 뒤 전부 다시 그린다 (체인 전체를 매번 호출하면 순서 실수를 막기 쉽다)
  function render2() { renderScheduleChips(); renderScheduleEditRow(); renderPhases(); App.day.refresh(); }

  function monthRange(ds) { return { from: U.monthStart(ds), to: U.monthEnd(ds) }; }
  function monthName(ds) { const d = U.parseYmd(ds); return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; }
  function quarterRange(ds) {
    const d = U.parseYmd(ds);
    const startMonth = Math.floor(d.getMonth() / 3) * 3;
    return {
      from: U.ymd(new Date(d.getFullYear(), startMonth, 1)),
      to: U.ymd(new Date(d.getFullYear(), startMonth + 3, 0)),
    };
  }
  function quarterName(ds) { const d = U.parseYmd(ds); return `${d.getFullYear()}년 ${Math.floor(d.getMonth() / 3) + 1}분기`; }
  function addSchedule(name, range) {
    const sc = { id: U.uid("sch"), name, from: range.from, to: range.to, phases: cloneBasePhases() };
    S().schedules().push(sc);
    activeScheduleId = sc.id;
    openPhase = null;
    S().save();
    render2();
    App.ui.toast(`"${name}" 시간표를 만들었어요 — 지금의 기본 시간표를 복사해서 시작합니다`);
  }

  let openPhase = null;   // 항목을 펼쳐 둔 구간 id

  function renderPhases() {
    const host = U.byId("phaseRows");
    if (!host) return;
    const cb = U.byId("setRoutine");
    if (cb) cb.checked = S().state.settings.routine.enabled !== false;
    const resetBtn = U.byId("phaseReset");
    if (resetBtn) resetBtn.textContent = activeScheduleId ? "이 세트를 기본 시간표로 다시 복사" : "기본 시간표로 되돌리기";

    const cats = S().state.categories;
    host.innerHTML = "";

    phasesRaw().forEach((p, i) => {
      const wrap = U.el("div", "phase-edit");
      const row = U.el("div", "row");
      row.style.cssText = "gap:8px;flex-wrap:wrap";

      const mk = (cls, val, type, w) => {
        const e = U.el("input", "inp " + cls);
        if (type) e.type = type;
        e.value = val;
        e.style.maxWidth = w;
        return e;
      };
      const name = mk("p-name", p.name, "", "140px");
      name.onchange = () => { p.name = name.value.trim() || "구간"; S().save(); renderPhases(); App.day.refresh(); };
      row.appendChild(name);

      const st = mk("p-s", p.start, "time", "116px");
      st.onchange = () => { p.start = st.value; S().save(); renderPhases(); App.day.refresh(); };
      row.appendChild(st);
      row.appendChild(U.el("span", null, "~"));
      const en = mk("p-e", p.end, "time", "116px");
      en.onchange = () => { p.end = en.value; S().save(); renderPhases(); App.day.refresh(); };
      row.appendChild(en);

      const sel = U.el("select", "inp p-cat");
      sel.style.maxWidth = "120px";
      cats.forEach((c) => {
        const o = U.el("option", null, U.esc(c.name));
        o.value = c.id;
        if (c.id === p.catId) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => { p.catId = sel.value; S().save(); App.day.refresh(); };
      row.appendChild(sel);

      row.appendChild(U.el("span", "mode-tag sm", U.esc((App.routine.MODE[p.mode] || {}).label || p.mode)));

      if (p.readonly) {
        row.appendChild(U.el("span", "stat-sub", "읽기 전용 · 타이머 없음"));
      } else {
        // phaseById(기본 시간표 전용)를 쓰면 세트 편집 중엔 엉뚱한(기본) 구간 길이로 배분을 계산하게
        // 된다 — p 자신의 start/end 로 직접 계산한다.
        const b = S().phaseBudget({ items: p.items, startMin: U.toMin(p.start), endMin: U.toMin(p.end) });
        row.appendChild(U.el("span", "budget" + (b.over ? " over" : ""), `배분 ${b.alloc}/${b.len}분`));
      }

      const tog = U.el("button", "btn sm ml-auto",
        `항목 ${(p.items || []).length} ${openPhase === p.id ? "▴" : "▾"}`);
      tog.onclick = () => { openPhase = openPhase === p.id ? null : p.id; renderPhases(); };
      row.appendChild(tog);
      wrap.appendChild(row);
      wrap.appendChild(daysRow(p));

      if (openPhase === p.id) wrap.appendChild(itemEditor(p));
      host.appendChild(wrap);
    });
  }

  // 요일 선택 — 생략(undefined)이면 매일. 전부 선택된 상태로 되돌아가면 다시 '매일'로 접는다.
  const WD_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  function daysRow(p) {
    const row = U.el("div", "row p-days");
    row.appendChild(U.el("span", "stat-sub", "요일"));
    const active = Array.isArray(p.days) && p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6];
    WD_LABELS.forEach((label, dow) => {
      const b = U.el("button", "wd-btn" + (active.includes(dow) ? " on" : ""), label);
      b.onclick = () => {
        const cur = (Array.isArray(p.days) && p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6]).slice();
        const idx = cur.indexOf(dow);
        if (idx >= 0) cur.splice(idx, 1); else cur.push(dow);
        if (!cur.length) { App.ui.toast("최소 하루는 남겨야 해요"); return; }
        if (cur.length === 7) delete p.days; else p.days = cur.sort((a, b2) => a - b2);
        S().save(); renderPhases(); App.day.refresh();
      };
      row.appendChild(b);
    });
    row.appendChild(U.el("span", "stat-sub",
      Array.isArray(p.days) && p.days.length ? "" : "매일"));
    return row;
  }

  // 구간 항목 편집 — 텍스트 + 배분 시간(분)
  function itemEditor(p) {
    const box = U.el("div", "phase-items");
    if (p.readonly) {
      box.appendChild(U.el("div", "stat-sub",
        "장중 구간이라 체크박스·타이머 없이 읽기만 합니다. 문구만 고칠 수 있어요."));
    }
    (p.items || []).forEach((it, i) => {
      const r = U.el("div", "row");
      r.style.cssText = "gap:6px;margin-bottom:5px";

      const text = U.el("input", "inp");
      text.value = it.text;
      text.style.flex = "1";
      text.style.minWidth = "180px";
      text.onchange = () => { it.text = text.value.trim(); S().save(); App.day.refresh(); };
      r.appendChild(text);

      if (!p.readonly) {
        const min = U.el("input", "inp it-min");
        min.type = "number"; min.min = "0"; min.max = "240";
        min.value = it.min || 0;
        min.title = "배분 시간(분) · 0이면 타이머 없음";
        min.onchange = () => {
          it.min = Math.max(0, Math.min(240, Math.round(+min.value || 0)));
          min.value = it.min;
          S().save(); renderPhases(); App.day.refresh();
        };
        r.appendChild(min);
        r.appendChild(U.el("span", "stat-sub", "분"));
      }

      const del = U.el("button", "icon-btn", "✕");
      del.title = "항목 삭제";
      del.onclick = () => {
        p.items.splice(i, 1);
        S().save(); renderPhases(); App.day.refresh();
      };
      r.appendChild(del);
      box.appendChild(r);
    });

    const add = U.el("button", "btn sm", "＋ 항목 추가");
    add.onclick = () => {
      p.items.push({ text: "새 항목", min: 0 });
      S().save(); renderPhases(); App.day.refresh();
    };
    box.appendChild(add);
    return box;
  }

  /* ---------- 외부 기록 링크 ---------- */
  function renderLinks() {
    const host = U.byId("linkRows");
    if (!host) return;
    const list = S().links();
    host.innerHTML = "";
    if (!list.length) {
      host.appendChild(U.el("div", "empty", "링크가 없어요. 아래에서 추가하세요."));
      return;
    }
    list.forEach((e, i) => {
      const row = U.el("div", "link-edit");

      const up = U.el("button", "icon-btn", "↑");
      up.title = "위로"; up.disabled = i === 0;
      up.onclick = () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); S().save(); renderLinks(); App.day.refresh(); };
      row.appendChild(up);

      const down = U.el("button", "icon-btn", "↓");
      down.title = "아래로"; down.disabled = i === list.length - 1;
      down.onclick = () => { list.splice(i + 1, 0, list.splice(i, 1)[0]); S().save(); renderLinks(); App.day.refresh(); };
      row.appendChild(down);

      const icon = U.el("input", "inp le-icon");
      icon.value = e.icon || "🔗";
      icon.maxLength = 4;
      icon.title = "아이콘 (이모지)";
      icon.onchange = () => { e.icon = icon.value.trim().slice(0, 4) || "🔗"; S().save(); renderLinks(); App.day.refresh(); };
      row.appendChild(icon);

      const label = U.el("input", "inp le-label");
      label.value = e.label;
      label.placeholder = "이름";
      label.onchange = () => { e.label = label.value.trim().slice(0, 20) || "링크"; S().save(); renderLinks(); App.day.refresh(); };
      row.appendChild(label);

      const url = U.el("input", "inp le-url");
      url.value = e.daily ? "" : e.url || "";
      url.placeholder = e.daily ? "날짜별 — 하루 탭에서 입력" : "https://...";
      url.disabled = !!e.daily;
      url.onchange = () => { e.url = url.value.trim(); S().save(); App.day.refresh(); };
      row.appendChild(url);

      const dayWrap = U.el("label", "row le-daily");
      const cb = U.el("input");
      cb.type = "checkbox"; cb.checked = !!e.daily;
      cb.disabled = !!e.quick;
      cb.title = e.quick ? "바로가기는 날짜별로 쓸 수 없어요" : "";
      cb.onchange = () => { e.daily = cb.checked; S().save(); renderLinks(); App.day.refresh(); };
      dayWrap.appendChild(cb);
      dayWrap.appendChild(U.el("span", null, "날짜별"));
      row.appendChild(dayWrap);

      const qWrap = U.el("label", "row le-daily");
      const qcb = U.el("input");
      qcb.type = "checkbox"; qcb.checked = !!e.quick;
      qcb.title = "주소칸 없이 아이콘 버튼으로만 표시";
      qcb.onchange = () => {
        e.quick = qcb.checked;
        if (e.quick) e.daily = false;   // 바로가기는 전역 주소만
        S().save(); renderLinks(); App.day.refresh();
      };
      qWrap.appendChild(qcb);
      qWrap.appendChild(U.el("span", null, "바로가기"));
      row.appendChild(qWrap);

      const del = U.el("button", "icon-btn", "✕");
      del.title = "삭제";
      del.onclick = () => {
        if (!confirm(`“${e.label}” 링크 항목을 지울까요?`)) return;
        S().state.settings.links = list.filter((x) => x.id !== e.id);
        S().save(); renderLinks(); App.day.refresh();
      };
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  /* ---------- 알림 ---------- */
  function renderNotify() {
    const n = S().state.settings.notify || {};
    const cb = U.byId("setNotify");       if (cb) cb.checked = !!n.enabled;
    const ld = U.byId("setNotifyLead");   if (ld) ld.value = String(n.lead == null ? 3 : n.lead);
    const sd = U.byId("setNotifySound");  if (sd) sd.checked = !!n.sound;

    const perm = App.notify.permission();
    const msg = !App.notify.supported()
      ? "이 브라우저는 데스크톱 알림을 지원하지 않아요 (앱 안 토스트는 동작합니다)."
      : perm === "granted"
        ? "구간이 바뀔 때 알려드려요. ⚠️ 이 탭이 열려 있을 때만 동작합니다 (서버 푸시가 없어요)."
        : perm === "denied"
          ? "브라우저에서 알림이 차단돼 있어요. 주소창 자물쇠 → 알림 허용으로 바꿔주세요."
          : "‘사용’을 켜면 알림 권한을 요청합니다.";
    U.setText("notifyState", msg);
  }

  /* ---------- 카테고리 ---------- */
  function renderCats() {
    const host = U.byId("catRows");
    if (!host) return;
    const groups = S().CAT_GROUPS;
    host.innerHTML = S().state.categories.map((c) => `
      <div class="row" style="gap:8px;margin-bottom:6px;flex-wrap:wrap" data-id="${c.id}">
        <input type="color" class="c-color" value="${U.esc(c.color)}" style="width:38px;height:32px;border:1px solid var(--line);border-radius:8px;background:none;padding:2px">
        <input class="inp c-name" value="${U.esc(c.name)}" style="max-width:150px">
        <select class="inp c-group" style="max-width:130px">
          ${groups.map((g) => `<option value="${g.id}"${g.id === c.group ? " selected" : ""}>${U.esc(g.name)}</option>`).join("")}
        </select>
        <span class="stat-sub">${S().catGroup(c.group).productive ? "생산 시간에 포함" : "생산 집계 제외"}</span>
        <button class="icon-btn ml-auto c-del" title="삭제">✕</button>
      </div>`).join("");

    U.$$("#catRows .row").forEach((row) => {
      const id = row.dataset.id;
      const c = S().catById(id);
      if (!c) return;
      row.querySelector(".c-color").onchange = (e) => { c.color = e.target.value; S().save(); App.timeline.refreshPalette(); App.day.refresh(); };
      row.querySelector(".c-name").onchange = (e) => { c.name = e.target.value.trim() || "카테고리"; S().save(); App.timeline.refreshPalette(); App.day.refresh(); };
      row.querySelector(".c-group").onchange = (e) => { c.group = e.target.value; S().save(); renderCats(); App.day.refresh(); };
      row.querySelector(".c-del").onclick = () => {
        if (S().state.categories.length <= 1) { App.ui.toast("최소 하나는 있어야 해요"); return; }
        if (!confirm(`“${c.name}” 카테고리를 삭제할까요? (이미 칠한 칸은 그대로 남아요)`)) return;
        S().state.categories = S().state.categories.filter((x) => x.id !== id);
        S().save(); renderCats(); App.timeline.refreshPalette(); App.day.refresh();
      };
    });
  }

  /* ---------- 데이터 ---------- */
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function exportJson() {
    download(`plan-backup-${U.today()}.json`, JSON.stringify(S().state, null, 2));
    App.ui.toast("백업 파일을 내려받았어요");
  }

  function exportCsv() {
    const rows = [["날짜", "구분", "시작", "분", "카테고리", "내용"]];
    const step = S().slotMin();
    const days = S().state.days;
    Object.keys(days).sort().forEach((ds) => {
      ["plan", "done"].forEach((side) => {
        const map = days[ds][side] || {};
        Object.keys(map).sort().forEach((k) => {
          const v = map[k], cat = S().catById(v.c);
          rows.push([ds, side === "plan" ? "계획" : "실행", k, step, cat ? cat.name : v.c, (v.t || "").replace(/"/g, '""')]);
        });
      });
    });
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    download(`plan-${U.today()}.csv`, csv, "text/csv");
    App.ui.toast("CSV를 내려받았어요");
  }

  function importJson() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const parsed = JSON.parse(rd.result);
          if (!parsed || typeof parsed !== "object") throw new Error("형식 오류");
          if (!confirm("현재 데이터를 덮어씁니다. 계속할까요?")) return;
          Object.assign(S().state, S().migrate(Object.assign(S().defaults(), parsed)));
          S().save();
          App.timeline.refreshPalette(); App.day.refresh(); render();
          App.ui.toast("가져왔어요");
        } catch (e) {
          App.ui.toast("읽을 수 없는 파일이에요");
        }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  function info() {
    let bytes = 0;
    try { bytes = new Blob([JSON.stringify(S().state)]).size; } catch (e) { /* noop */ }
    const days = Object.keys(S().state.days).length;
    U.setText("dataInfo",
      `기록 ${days}일 · 용어 ${S().state.terms.length}개 · 리서치 ${S().state.research.length}개 · 저장용량 ${(bytes / 1024).toFixed(1)}KB`);
  }

  /* ---------- 렌더 / 바인딩 ---------- */
  function render() {
    const s = S().state.settings;
    const st = U.byId("setStart"), en = U.byId("setEnd"), sl = U.byId("setSlot");
    if (st) st.value = s.dayStartHour;
    if (en) en.value = s.dayEndHour;
    if (sl) sl.value = String(s.slotMin);
    renderMarket();
    renderScheduleChips();
    renderScheduleEditRow();
    renderPhases();
    renderNotify();
    renderLinks();
    renderCats();
    info();
  }

  function init() {
    U.on("setStart", "change", (e) => {
      const v = U.clamp(+e.target.value || 0, 0, 23);
      const s = S().state.settings;
      s.dayStartHour = Math.min(v, s.dayEndHour - 1);
      e.target.value = s.dayStartHour;
      S().save(); App.day.refresh();
    });
    U.on("setEnd", "change", (e) => {
      const v = U.clamp(+e.target.value || 24, 1, 24);
      const s = S().state.settings;
      s.dayEndHour = Math.max(v, s.dayStartHour + 1);
      e.target.value = s.dayEndHour;
      S().save(); App.day.refresh();
    });
    U.on("setSlot", "change", (e) => {
      S().state.settings.slotMin = +e.target.value || 10;
      S().save(); App.day.refresh();
    });
    U.on("setMarket", "change", (e) => {
      S().state.settings.market.show = e.target.checked;
      S().save(); App.day.refresh();
    });
    U.on("setNotify", "change", async (e) => {
      await App.notify.enable(e.target.checked);
      renderNotify();
      const p = App.notify.permission();
      if (e.target.checked && p !== "granted" && App.notify.supported()) {
        App.ui.toast(p === "denied" ? "브라우저가 알림을 막고 있어요" : "알림 권한이 필요해요");
      }
    });
    U.on("setNotifyLead", "change", (e) => {
      S().state.settings.notify.lead = +e.target.value || 0;
      S().save(); App.notify.start();
    });
    U.on("setNotifySound", "change", (e) => {
      S().state.settings.notify.sound = e.target.checked;
      S().save();
    });
    U.on("notifyTest", "click", () => App.notify.test());
    U.on("phaseReset", "click", () => {
      if (activeScheduleId) {
        const sc = S().scheduleById(activeScheduleId);
        if (!sc) return;
        if (!confirm(`"${sc.name}" 세트를 지금의 기본 시간표로 다시 복사할까요? (이 세트에서 고친 내용은 사라져요)`)) return;
        sc.phases = cloneBasePhases();
        S().save(); renderPhases(); App.day.refresh();
        App.ui.toast("기본 시간표로 다시 복사했어요");
        return;
      }
      if (!confirm("루틴 구간을 기본 시간표로 되돌릴까요? (이름·시간·카테고리가 초기화돼요)")) return;
      S().state.settings.routine.phases = S().defaults().settings.routine.phases;
      S().save(); renderPhases(); App.day.refresh();
      App.ui.toast("기본 시간표로 되돌렸어요");
    });
    U.on("schedAddMonth", "click", () => addSchedule(monthName(U.today()), monthRange(U.today())));
    U.on("schedAddQuarter", "click", () => addSchedule(quarterName(U.today()), quarterRange(U.today())));
    U.on("schedName", "change", (e) => {
      const sc = S().scheduleById(activeScheduleId);
      if (!sc) return;
      sc.name = e.target.value.trim().slice(0, 30) || "시간표";
      e.target.value = sc.name;
      S().save(); renderScheduleChips();
    });
    U.on("schedFrom", "change", (e) => {
      const sc = S().scheduleById(activeScheduleId);
      if (!sc) return;
      if (e.target.value > sc.to) { App.ui.toast("시작일이 종료일보다 늦을 수 없어요"); e.target.value = sc.from; return; }
      sc.from = e.target.value;
      S().save(); App.day.refresh();
    });
    U.on("schedTo", "change", (e) => {
      const sc = S().scheduleById(activeScheduleId);
      if (!sc) return;
      if (e.target.value < sc.from) { App.ui.toast("종료일이 시작일보다 빠를 수 없어요"); e.target.value = sc.to; return; }
      sc.to = e.target.value;
      S().save(); App.day.refresh();
    });
    U.on("schedDel", "click", () => {
      const sc = S().scheduleById(activeScheduleId);
      if (!sc) return;
      if (!confirm(`"${sc.name}" 시간표 세트를 삭제할까요?`)) return;
      S().state.settings.routine.schedules = S().schedules().filter((x) => x.id !== sc.id);
      activeScheduleId = null;
      S().save(); render2();
      App.ui.toast("삭제했어요");
    });
    U.on("setRoutine", "change", (e) => {
      S().state.settings.routine.enabled = e.target.checked;
      S().save(); App.day.refresh();
    });
    U.on("linkAdd", "click", () => {
      S().links().push({ id: U.uid("lk"), label: "새 링크", icon: "🔗", url: "", daily: false, quick: false });
      S().save(); renderLinks(); App.day.refresh();
    });
    U.on("catAdd", "click", () => {
      S().state.categories.push({ id: U.uid("c"), name: "새 카테고리", color: "#dbeafe", group: "life" });
      S().save(); renderCats(); App.timeline.refreshPalette(); App.day.refresh();
    });
    U.on("dataExport", "click", exportJson);
    U.on("dataCsv", "click", exportCsv);
    U.on("dataImport", "click", importJson);
    U.on("dataReset", "click", () => {
      if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
      if (!confirm("한 번 더 확인합니다. 전부 삭제할까요?")) return;
      S().reset();
      App.timeline.refreshPalette(); App.day.refresh(); render();
      App.ui.toast("초기화했어요");
    });
  }

  App.settings = { init, render };
})();
