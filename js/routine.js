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
    input:   { label: "입력",      tone: "blue",   hint: "정보 수집은 제한하고, 09:00에 가설과 계획을 확정합니다." },
    plan:    { label: "계획",      tone: "indigo", hint: "09:00에 가설을 잠급니다. 이후엔 고치지 않아요." },
    observe: { label: "매매 금지", tone: "red",    hint: "관찰만. 신규 진입 금지 — 시장 강도만 확인합니다." },
    exec:    { label: "집행",      tone: "green",  hint: "우선순위는 계획 매매 → 관찰 → 입력 순입니다." },
    rest:    { label: "휴식",      tone: "gray",   hint: "쉬는 시간입니다." },   // 예전 저장본 호환용(이제 어떤 기본 구간도 쓰지 않음)
    manage:  { label: "관리",      tone: "amber",  hint: "신규 진입 금지. 보유 종목만 관리합니다." },
    record:  { label: "기록",      tone: "purple", hint: "순서는 사실 기록 → 내 판정 → 남의 해석입니다." },
    watch:   { label: "관찰",      tone: "gray",   hint: "종배 후보를 지켜보는 시간입니다." },
    learn:   { label: "학습",      tone: "teal",   hint: "산업 리포트·독서·기업 분석 — 하루를 마무리합니다." },
  };

  let selected = null;   // 사용자가 눌러서 보고 있는 구간 id (null이면 '지금')

  function enabled() { return (S().state.settings.routine || {}).enabled !== false; }
  function nowPhase() { return S().phaseAt(U.nowMin()); }
  function viewPhase(ds) {
    if (selected) {
      // 다른 날짜로 넘어가면서 선택이 그 날엔 적용되지 않는 구간일 수 있다(요일 제한) — 그럴 땐 버린다.
      const p = S().phasesOn(ds).find((x) => x.id === selected);
      if (p) return p;
      selected = null;
    }
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

    S().phasesOn(ds).forEach((p) => {
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
    const nowP = nowPhase();
    const isNow = U.isToday(ds) && nowP && nowP.id === p.id;
    let leftHtml = "";
    if (isNow) {
      const left = p.endMin - U.nowMin();
      const cls = left <= 5 ? " urgent" : left <= 15 ? " soon" : "";
      leftHtml = `<span class="mode-left${cls}">${U.minToKo(left)} 남음</span>`;
    }
    host.innerHTML =
      `<span class="mode-tag">${m.label}</span>` +
      `<b>${U.esc(p.name)}</b>` +
      `<span class="mode-time">${p.start}~${p.end}</span>` +
      leftHtml +
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
      host.appendChild(U.el("div", "ro-note",
        p.note ? U.esc(p.note) : "장중에는 기록하지 않고 <b>읽기만</b> 합니다"));
      p.items.forEach((it) => host.appendChild(U.el("div", "ro-item", U.esc(it.text))));
      return;
    }

    if (p.note) host.appendChild(U.el("div", "ro-note", U.esc(p.note)));

    const budget = S().phaseBudget(p);
    if (budget.alloc) {
      host.appendChild(U.el("div", "ro-note" + (budget.over ? " bad" : ""),
        `배분 <b>${budget.alloc}분</b> / 구간 ${budget.len}분` +
        (budget.over ? " — 배분이 구간보다 깁니다" : "")));
    }

    p.items.forEach((it, i) => {
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
      row.appendChild(U.el("span", "task-text", U.esc(it.text)));

      if (it.min > 0) {
        const t = U.el("span", "it-timer");
        t.dataset.pomoKey = key;
        t.dataset.pomoIdle = it.min + "분";
        t.textContent = it.min + "분";
        row.appendChild(t);

        // 오늘·현재 구간에서만 타이머를 돌린다 (지난 날짜엔 의미 없음)
        if (U.isToday(ds)) {
          const btn = U.el("button", "it-play", "▶");
          btn.dataset.pomoBtn = key;
          btn.title = "이 항목 타이머 시작";
          btn.onclick = () => App.pomo.toggleItem(key, it.min, p.catId, it.text);
          row.appendChild(btn);
        }
      }
      host.appendChild(row);
    });
    if (U.isToday(ds)) App.pomo.paint();   // 돌고 있는 타이머 상태 반영

  }

  /* ---------- 루틴을 타임라인 PLAN에 깔기 ----------
     구간 경계가 slotMin 격자(dayStartHour 기준 10분 단위 등)에 안 맞을 수 있다
     (예: 08:15는 10분 격자가 아님). 안 맞춰 그대로 칠하면 격자에 없는 키("08:15")에
     써서 타임라인에는 안 보이고, 그 자리를 이전 구간이 밀고 들어가며 과대 점유한다.
     그래서 여기서만 경계를 가장 가까운 격자로 스냅한다 — phaseAt/phaseStamp 등
     실제 시각 판정 로직은 원래의(스냅 안 한) startMin/endMin 을 그대로 쓴다. */
  function applyToTimeline(ds) {
    const day = S().getDay(ds);
    const step = S().slotMin();
    const snap = (min) => Math.round(min / step) * step;
    let painted = 0;
    S().phasesOn(ds).forEach((p) => {
      const cat = S().catById(p.catId) ? p.catId : (S().state.categories[0] || {}).id;
      const start = Math.max(S().startMin(), snap(p.startMin));
      const end = Math.min(S().endMin(), snap(p.endMin));
      for (let m = start; m < end; m += step) {
        day.plan[U.toHHMM(m)] = { c: cat, t: p.name };
        painted += step;
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
    }, 20000);
  }

  App.routine = { init, render, applyToTimeline, MODE, nowPhase, viewPhase,
                  reset() { selected = null; } };
})();
