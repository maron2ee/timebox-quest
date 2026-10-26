/* ===========================================================
   routine.js — 전업투자자 데일리 루틴 구간 엔진
   시각에 따라 앱의 '모드'가 바뀌고, 구간별 체크리스트를 보여준다.
   장중(observe/exec/manage) 체크리스트는 읽기 전용 — "장중엔 읽기만" 원칙.
   Exposes: window.App.routine
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  const MODE = {
    input:   { label: "입력",      tone: "blue",   hint: "정보 수집은 제한하고, 09:00 전에 가설과 위험 한도를 확정합니다." },
    plan:    { label: "계획",      tone: "indigo", hint: "오늘의 마지막 5분이 오전의 목적입니다. 가설을 먼저 적으세요." },
    observe: { label: "매매 금지", tone: "red",    hint: "관찰만. 신규 진입 금지 — 시장 강도와 주도 섹터만 확인합니다." },
    exec:    { label: "집행",      tone: "green",  hint: "08:30에 적어둔 것만 실행합니다. 새로운 분석은 하지 않습니다." },
    rest:    { label: "강제 휴식", tone: "gray",   hint: "화면을 끄세요. 이 시간의 매매는 계획이 아니라 충동입니다." },
    manage:  { label: "관리",      tone: "amber",  hint: "보유 종목만. 신규 진입 금지." },
    record:  { label: "기록",      tone: "purple", hint: "당일 입력 원칙 — 미루면 기억이 아니라 추정이 됩니다." },
    learn:   { label: "학습",      tone: "teal",   hint: "산업 리포트·독서·시나리오 점검. 텔레그램은 하루 1회 여기서." },
  };

  let selected = null;   // 사용자가 눌러서 보고 있는 구간 id (null이면 '지금')

  function enabled() { return (S().state.settings.routine || {}).enabled !== false; }
  function nowPhase() { return S().phaseAt(U.nowMin()); }
  function viewPhase(ds) {
    if (selected) return S().phaseById(selected);
    if (U.isToday(ds)) return nowPhase();
    return null;
  }

  /* ---------- 구간 레일 ---------- */
  function renderRail(ds) {
    const host = U.byId("phaseRail");
    if (!host) return;
    if (!enabled()) { host.innerHTML = ""; return; }

    const now = U.isToday(ds) ? nowPhase() : null;
    const shown = viewPhase(ds);
    host.innerHTML = "";

    S().phases().forEach((p) => {
      const pr = S().phaseProgress(ds, p);
      const isNow = now && now.id === p.id;
      const isSel = shown && shown.id === p.id;
      const past = U.isToday(ds) && U.nowMin() >= p.endMin;
      const missed = past && pr.total > 0 && pr.done === 0 && !p.readonly;

      const b = U.el("button", "ph" + (isNow ? " now" : "") + (isSel ? " sel" : "") + (missed ? " missed" : ""));
      b.innerHTML =
        `<span class="ph-t">${p.start}</span>` +
        `<span class="ph-n">${U.esc(p.name)}</span>` +
        (p.items.length && !p.readonly ? `<span class="ph-p">${pr.done}/${pr.total}</span>` : "") +
        (missed ? `<span class="ph-x">누락</span>` : "");
      b.title = `${p.start}~${p.end} · ${MODE[p.mode].label}`;
      b.onclick = () => { selected = (selected === p.id ? null : p.id); render(ds); };
      host.appendChild(b);
    });
  }

  /* ---------- 모드 배너 ---------- */
  function renderBanner(ds) {
    const host = U.byId("modeBanner");
    if (!host) return;
    const p = viewPhase(ds);
    if (!enabled() || !p) { host.innerHTML = ""; host.className = "mode-banner off"; return; }
    const m = MODE[p.mode];
    host.className = "mode-banner tone-" + m.tone;
    const isNow = U.isToday(ds) && nowPhase() && nowPhase().id === p.id;
    host.innerHTML =
      `<span class="mode-tag">${m.label}</span>` +
      `<b>${U.esc(p.name)}</b>` +
      `<span class="mode-time">${p.start}~${p.end}</span>` +
      `<span class="mode-hint">${U.esc(m.hint)}</span>`;
    if (!isNow) {
      const back = U.el("button", "btn sm ml-auto", "지금 구간으로");
      back.onclick = () => { selected = null; render(ds); };
      host.appendChild(back);
    }
  }

  /* ---------- 구간 체크리스트 ---------- */
  function renderChecklist(ds) {
    const host = U.byId("phaseChecks");
    if (!host) return;
    const p = viewPhase(ds);
    if (!enabled()) { host.innerHTML = `<div class="empty">루틴이 꺼져 있어요 (설정에서 켜기)</div>`; return; }
    if (!p) {
      host.innerHTML = `<div class="empty">${U.isToday(ds) ? "지금은 루틴 구간이 아니에요" : "위에서 구간을 선택해 보세요"}</div>`;
      return;
    }
    if (!p.items.length) {
      host.innerHTML = `<div class="empty">${U.esc(MODE[p.mode].hint)}</div>`;
      return;
    }

    const day = S().peekDay(ds);
    const checks = day.checks || {};
    host.innerHTML = "";

    if (p.readonly) {
      host.appendChild(U.el("div", "ro-note", "장중에는 기록하지 않고 <b>읽기만</b> 합니다"));
      p.items.forEach((text) => host.appendChild(U.el("div", "ro-item", U.esc(text))));
      // 장중 구간엔 계획외 매매 건수를 라이브로
      const st = S().tradeStats(ds);
      if (p.mode !== "observe") {
        const line = U.el("div", "ro-live" + (st.offPlan ? " bad" : ""),
          st.offPlan ? `계획에 없던 매매 <b>${st.offPlan}건</b> — 오늘은 여기까지` : `계획에 없던 매매 <b>0건</b> · 좋습니다`);
        host.appendChild(line);
      }
      return;
    }

    p.items.forEach((text, i) => {
      const key = p.id + ":" + i;
      const on = !!checks[key];
      const row = U.el("div", "task" + (on ? " done" : ""));
      const cb = U.el("button", "cb", "✓");
      cb.onclick = () => {
        const d = S().getDay(ds);
        if (d.checks[key]) delete d.checks[key]; else d.checks[key] = Date.now();
        S().touch(ds);
        App.day.refresh();
      };
      row.appendChild(cb);
      row.appendChild(U.el("span", "task-text", U.esc(text)));
      host.appendChild(row);
    });

  }

  /* ---------- 루틴을 타임라인 PLAN에 깔기 ---------- */
  function applyToTimeline(ds) {
    const day = S().getDay(ds);
    let painted = 0;
    S().phases().forEach((p) => {
      const cat = S().catById(p.catId) ? p.catId : (S().state.categories[0] || {}).id;
      for (let m = p.startMin; m < p.endMin; m += S().slotMin()) {
        const k = U.toHHMM(m);
        if (m < S().startMin() || m >= S().endMin()) continue;
        day.plan[k] = { c: cat, t: p.name };
        painted += S().slotMin();
      }
    });
    S().touch(ds);
    return painted;
  }

  /* ---------- 전체 ---------- */
  function render(ds) {
    renderRail(ds);
    renderBanner(ds);
    renderChecklist(ds);
  }

  function init() {
    U.on("applyRoutineBtn", "click", () => {
      const ds = App.day.date();
      if (!confirm("오늘 PLAN 타임라인을 루틴 구간으로 채울까요? (기존 계획은 덮어씁니다)")) return;
      const min = applyToTimeline(ds);
      App.day.refresh();
      App.ui.toast(`루틴 ${U.minToKo(min)}를 계획에 깔았어요`);
    });
    // 구간이 바뀌면 화면 갱신
    setInterval(() => {
      if (!selected && U.isToday(App.day.date()) && App.nav.current === "day") render(App.day.date());
    }, 30000);
  }

  App.routine = { init, render, applyToTimeline, MODE, nowPhase, viewPhase,
                  reset() { selected = null; } };
})();
