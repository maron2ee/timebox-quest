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
  function phasesRaw() { return S().state.settings.routine.phases; }

  function renderPhases() {
    const host = U.byId("phaseRows");
    if (!host) return;
    const cb = U.byId("setRoutine");
    if (cb) cb.checked = S().state.settings.routine.enabled !== false;

    const cats = S().state.categories;
    host.innerHTML = phasesRaw().map((p, i) => `
      <div class="row" style="gap:8px;margin-bottom:6px;flex-wrap:wrap" data-i="${i}">
        <input class="inp p-name" value="${U.esc(p.name)}" style="max-width:150px">
        <input class="inp p-s" type="time" value="${U.esc(p.start)}" style="max-width:116px">
        <span style="color:var(--faint)">~</span>
        <input class="inp p-e" type="time" value="${U.esc(p.end)}" style="max-width:116px">
        <select class="inp p-cat" style="max-width:130px">
          ${cats.map((c) => `<option value="${U.esc(c.id)}"${c.id === p.catId ? " selected" : ""}>${U.esc(c.name)}</option>`).join("")}
        </select>
        <span class="mode-tag sm">${U.esc((App.routine.MODE[p.mode] || {}).label || p.mode)}</span>
        ${p.readonly ? `<span class="stat-sub">읽기 전용</span>` : ""}
      </div>`).join("");

    U.$$("#phaseRows .row").forEach((row) => {
      const i = +row.dataset.i;
      row.querySelector(".p-name").onchange = (e) => { phasesRaw()[i].name = e.target.value.trim() || "구간"; S().save(); App.day.refresh(); };
      row.querySelector(".p-s").onchange = (e) => { phasesRaw()[i].start = e.target.value; S().save(); App.day.refresh(); };
      row.querySelector(".p-e").onchange = (e) => { phasesRaw()[i].end = e.target.value; S().save(); App.day.refresh(); };
      row.querySelector(".p-cat").onchange = (e) => { phasesRaw()[i].catId = e.target.value; S().save(); App.day.refresh(); };
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

  /* ---------- 가설 · 가드레일 ---------- */
  function renderGuard() {
    const s = S().state.settings;
    const L = s.links || {};
    [["setLinkSheet", "sheet"], ["setLinkNotes", "notes"], ["setLinkRules", "rules"]].forEach(([id, k]) => {
      const e = U.byId(id); if (e) e.value = L[k] || "";
    });
    const gm = U.byId("setGuardMode");  if (gm) gm.value = s.guard.planViolation || "warn";
    const mt = U.byId("setMaxTrades");  if (mt) mt.value = s.guard.maxTrades || 0;
    const ml = U.byId("setMaxLoss");    if (ml) ml.value = s.guard.maxLossPct || 0;
  }

  /* ---------- 카테고리 ---------- */
  function renderCats() {
    const host = U.byId("catRows");
    if (!host) return;
    host.innerHTML = S().state.categories.map((c) => `
      <div class="row" style="gap:8px;margin-bottom:6px" data-id="${c.id}">
        <input type="color" class="c-color" value="${U.esc(c.color)}" style="width:38px;height:32px;border:1px solid var(--line);border-radius:8px;background:none;padding:2px">
        <input class="inp c-name" value="${U.esc(c.name)}" style="max-width:190px">
        <label class="row" style="gap:5px;font-size:12.5px;color:var(--muted)">
          <input type="checkbox" class="c-study" ${c.study ? "checked" : ""}> 공부시간에 포함
        </label>
        <button class="icon-btn ml-auto c-del" title="삭제">✕</button>
      </div>`).join("");

    U.$$("#catRows .row").forEach((row) => {
      const id = row.dataset.id;
      const c = S().catById(id);
      if (!c) return;
      row.querySelector(".c-color").onchange = (e) => { c.color = e.target.value; S().save(); App.day.refresh(); };
      row.querySelector(".c-name").onchange = (e) => { c.name = e.target.value.trim() || "카테고리"; S().save(); App.day.refresh(); };
      row.querySelector(".c-study").onchange = (e) => { c.study = e.target.checked; S().save(); App.day.refresh(); };
      row.querySelector(".c-del").onclick = () => {
        if (S().state.categories.length <= 1) { App.ui.toast("최소 하나는 있어야 해요"); return; }
        if (!confirm(`“${c.name}” 카테고리를 삭제할까요? (이미 칠한 칸은 그대로 남아요)`)) return;
        S().state.categories = S().state.categories.filter((x) => x.id !== id);
        S().save(); renderCats(); App.day.refresh();
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
          App.day.refresh(); render();
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
    renderPhases();
    renderNotify();
    renderGuard();
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
      if (!confirm("루틴 구간을 기본 시간표로 되돌릴까요? (이름·시간·카테고리가 초기화돼요)")) return;
      S().state.settings.routine.phases = S().defaults().settings.routine.phases;
      S().save(); renderPhases(); App.day.refresh();
      App.ui.toast("기본 시간표로 되돌렸어요");
    });
    U.on("setRoutine", "change", (e) => {
      S().state.settings.routine.enabled = e.target.checked;
      S().save(); App.day.refresh();
    });
    [["setLinkSheet", "sheet"], ["setLinkNotes", "notes"], ["setLinkRules", "rules"]].forEach(([id, k]) => {
      U.on(id, "change", (e) => {
        S().state.settings.links[k] = e.target.value.trim();
        S().save(); App.day.refresh();
      });
    });
    U.on("setGuardMode", "change", (e) => {
      S().state.settings.guard.planViolation = e.target.value;
      S().save(); App.trades.render(App.day.date());
    });
    U.on("setMaxTrades", "change", (e) => {
      S().state.settings.guard.maxTrades = Math.max(0, +e.target.value || 0);
      S().save(); App.trades.render(App.day.date());
    });
    U.on("setMaxLoss", "change", (e) => {
      S().state.settings.guard.maxLossPct = Math.max(0, +e.target.value || 0);
      S().save(); App.trades.render(App.day.date());
    });
    U.on("catAdd", "click", () => {
      S().state.categories.push({ id: U.uid("c"), name: "새 카테고리", color: "#dbeafe", study: false });
      S().save(); renderCats(); App.day.refresh();
    });
    U.on("dataExport", "click", exportJson);
    U.on("dataCsv", "click", exportCsv);
    U.on("dataImport", "click", importJson);
    U.on("dataReset", "click", () => {
      if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
      if (!confirm("한 번 더 확인합니다. 전부 삭제할까요?")) return;
      S().reset();
      App.day.refresh(); render();
      App.ui.toast("초기화했어요");
    });
  }

  App.settings = { init, render };
})();
