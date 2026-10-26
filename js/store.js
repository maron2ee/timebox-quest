/* ===========================================================
   store.js — 데이터 모델 · 저장 · 마이그레이션 · 파생값
   localStorage 키: tbxPlanner.v1
   Exposes: window.App.store
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  const KEY = "tbxPlanner.v1";
  const SCHEMA = 1;

  /* ---------- 기본 카테고리 (타임박스 색) ---------- */
  const CATS = [
    { id: "study",    name: "주식공부",  color: "#fde68a", study: true },
    { id: "research", name: "리서치",    color: "#ddd6fe", study: true },
    { id: "market",   name: "시황체크",  color: "#bfdbfe", study: true },
    { id: "trade",    name: "매매",      color: "#fecaca", study: false },
    { id: "read",     name: "독서",      color: "#bbf7d0", study: true },
    { id: "exercise", name: "운동",      color: "#fbcfe8", study: false },
    { id: "routine",  name: "루틴",      color: "#fed7aa", study: false },
    { id: "rest",     name: "휴식",      color: "#e5e7eb", study: false },
  ];

  const PROJECTS = [
    { id: "p_stock",  name: "주식공부", tab: "study", collapsed: false },
    { id: "p_eng",    name: "영어공부", tab: "study", collapsed: false },
    { id: "p_review", name: "회고",     tab: "study", collapsed: false },
    { id: "p_life",   name: "일정",     tab: "plan",  collapsed: false },
  ];

  /* ---------- 전업투자자 데일리 루틴 구간 ----------
     mode: input(입력) / plan(계획) / observe(매매금지) / exec(집행)
           rest(휴식) / manage(관리) / record(기록) / learn(학습)
     장중(observe·exec·manage) 체크리스트는 읽기 전용 — "장중엔 기록하지 않고 읽기만" 원칙 */
  const PHASES = [
    { id: "pre1", name: "뉴스·미국장", start: "07:30", end: "08:00", mode: "input", catId: "market",
      items: ["전일 미국장 3지수·금리·환율·원자재 확인",
              "경제뉴스 제목만 훑고 정독은 5개까지",
              "오늘 유리한 요인 1개 / 불리한 요인 1개 적기"] },
    { id: "pre2", name: "리포트·관심종목", start: "08:00", end: "08:30", mode: "input", catId: "research",
      items: ["증권사 신규 리포트 2개 (관심종목·섹터 관련만)",
              "오늘 예정된 지표·실적·정책 일정 확인",
              "밤사이 공시 확인 (보유 종목 중심)",
              "전일 관찰목록에서 오늘 볼 종목 3~5개만 남기기"] },
    { id: "pre3", name: "매매 계획 확정", start: "08:30", end: "09:00", mode: "plan", catId: "research",
      items: ["종목별 진입가·손절가·목표가·수량을 숫자로 적기",
              "손익비 1:2 미만이면 후보에서 제외",
              "‘오늘 매매하지 않는 조건’ 적기",
              "아침 가설 한 줄(강세/중립/약세)과 근거"] },
    { id: "obs", name: "관찰만", start: "09:00", end: "09:30", mode: "observe", catId: "market", readonly: true,
      items: ["코스피·코스닥 방향과 상승/하락 종목 수로 시장 강도 확인",
              "거래대금 상위에 어떤 섹터가 반복해서 올라오는지",
              "아침 가설이 맞는지 한 줄로 판정",
              "계획한 종목이 계획한 가격대에 왔는지만 확인"] },
    { id: "exec", name: "계획대로 집행", start: "09:30", end: "11:00", mode: "exec", catId: "trade", readonly: true,
      items: ["진입 전 — 08:30에 적어둔 종목인가",
              "진입 전 — 진입가·손절가·수량이 적어둔 그대로인가",
              "진입 전 — 매수 근거를 한 문장으로 말할 수 있는가",
              "진입 직후 — 손절 주문을 바로 걸어둔다",
              "적어두지 않은 종목이 눈에 들어오면 → 내일 관찰목록에만"] },
    { id: "rest", name: "강제 휴식", start: "11:00", end: "13:00", mode: "rest", catId: "rest", items: [] },
    { id: "hold", name: "보유 종목 관리", start: "13:00", end: "14:30", mode: "manage", catId: "trade", readonly: true,
      items: ["손절가 이탈 종목이 있는가 → 있으면 고민 없이 실행",
              "주도 섹터가 오전 강도를 유지하는가",
              "신규 진입 금지 — 보유 종목만"] },
    { id: "close", name: "마감 대응", start: "14:30", end: "15:30", mode: "manage", catId: "trade", readonly: true,
      items: ["마감 대응 · 종가 베팅",
              "종가 기준 내일 관찰목록 정리"] },
    { id: "rec", name: "기록·마감 분석", start: "15:30", end: "16:30", mode: "record", catId: "research",
      items: ["오늘 체결 거래를 매매일지에 입력 (당일 입력 원칙)",
              "마감 숫자 4종 — 투자자별 수급·개별 수급·섹터·매크로",
              "아침 가설 판정 + 달랐다면 왜 달랐는지 한 줄",
              "오늘 손익·누적 손익 → 중단 규칙에 걸리는지 확인",
              "내일 관찰목록 / 오늘 안 할 것 정리"] },
    { id: "learn", name: "학습", start: "16:30", end: "18:00", mode: "learn", catId: "read",
      items: ["증권사 산업 리포트 → 업종 노트 1개",
              "독서·경제 공부 → 공부 로그 한 줄",
              "투자 시나리오 점검 → 유지/폐기",
              "텔레그램 분석 → 채널별 적중/실패 (하루 1회)"] },
  ];

  function defaults() {
    return {
      version: SCHEMA,
      settings: {
        dayStartHour: 7,     // 타임라인 시작 시각
        dayEndHour: 24,      // 타임라인 끝 시각(이 시각 직전까지 표시)
        slotMin: 10,         // 한 칸 = 10분
        market: { show: true, sessions: null },
        carryOver: true,     // 어제 미완료 할일 이어받기 제안
        routine: { enabled: true, phases: PHASES.map((p) => ({ ...p, items: p.items.slice() })) },
        // 가설 수정 정책: free(자유) / mark(수정 표시·원본 보존) / lock(09:00 이후 잠금)
        hypothesisPolicy: "mark",
        // 가드레일: 계획외 매매 발생 시 off(무시) / warn(경고 배너) / block(매매 입력 차단)
        guard: { planViolation: "warn", maxTrades: 0, maxLossPct: 0 },
      },
      categories: CATS.map((c) => ({ ...c })),
      projects: PROJECTS.map((p) => ({ ...p })),
      days: {},
      ddays: [],
      terms: [],      // 경제용어 노트
      research: [],   // 종목 리서치 메모
      pomo: { focusMin: 25, breakMin: 5, catId: "study" },
    };
  }

  let state = defaults();

  /* ---------- 저장 / 로드 ---------- */
  let saveWarned = false;
  const persist = U.debounce(function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        alert("⚠️ 저장에 실패했어요. 브라우저 저장공간이 가득 찼거나 시크릿 모드일 수 있어요.");
      }
    }
  }, 150);

  function save() { persist(); }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 접근 불가 */ }
    if (!raw) { state = defaults(); return state; }
    try {
      const parsed = JSON.parse(raw);
      state = migrate(Object.assign(defaults(), parsed));
    } catch (e) {
      state = defaults();
    }
    return state;
  }

  function migrate(s) {
    // 누락 필드 보정 (부분 저장본 대비)
    const d = defaults();
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.settings.market = Object.assign({}, d.settings.market, s.settings.market || {});
    s.settings.guard = Object.assign({}, d.settings.guard, s.settings.guard || {});
    s.settings.routine = Object.assign({}, d.settings.routine, s.settings.routine || {});
    if (!Array.isArray(s.settings.routine.phases) || !s.settings.routine.phases.length) {
      s.settings.routine.phases = d.settings.routine.phases;
    }
    if (!Array.isArray(s.categories) || !s.categories.length) s.categories = d.categories;
    if (!Array.isArray(s.projects) || !s.projects.length) s.projects = d.projects;
    if (!s.days || typeof s.days !== "object") s.days = {};
    ["ddays", "terms", "research"].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    // 리서치는 '링크 인덱스'로 바뀌었다. 예전 앱 내 메모(body)는 지우지 않고 보존한다.
    s.research = s.research.map((r) => ({
      id: r.id || U.uid("rs"),
      ticker: r.ticker || "", name: r.name || "",
      sector: r.sector || "", url: r.url || "", note: r.note || "",
      body: r.body || "",
      date: r.date || U.today(),
      updated: r.updated || r.date || U.today(),
    }));
    s.pomo = Object.assign({}, d.pomo, s.pomo || {});
    s.version = SCHEMA;
    return s;
  }

  function reset() { state = defaults(); save(); return state; }

  /* ---------- 하루 ---------- */
  function blankDay() {
    return {
      goal: "", big3: ["", "", ""],
      plan: {}, done: {}, tasks: [],
      review: { k: "", p: "", t: "" },
      hypothesis: null,     // {bias, reason, sectors[], savedAt, openSnapshot, editedAfterOpen, verdict{...}}
      plans: [],            // 매매 계획 [{id, ticker, name, entry, stop, target, qty, reason}]
      trades: [],           // 체결 [{id, planId|null, ticker, side, price, qty, time, pnl, emotion, note}]
      noTradeIf: "",        // 오늘 매매하지 않는 조건
      pnl: "",              // 하루 손익 (선택 — 상세는 구글시트 매매일지)
      judged: {},           // 계획 블록 판정 {startKey: 'done'|'skip'|'other'}
      checks: {},           // 구간 체크리스트 {'phaseId:index': true}
      links: {},            // 외부 문서 {am:'url', pm:'url'}
      watch: { today: [], tomorrow: [] },
      mtime: 0,
    };
  }
  // 읽기 전용 조회(없으면 빈 객체 — 저장소를 더럽히지 않음)
  function peekDay(ds) { return state.days[ds] || blankDay(); }
  // 쓰기용 조회(없으면 생성)
  function getDay(ds) {
    if (!state.days[ds]) state.days[ds] = blankDay();
    const d = state.days[ds];
    if (!d.plan) d.plan = {};
    if (!d.done) d.done = {};
    if (!Array.isArray(d.tasks)) d.tasks = [];
    if (!Array.isArray(d.big3)) d.big3 = ["", "", ""];
    if (!d.review) d.review = { k: "", p: "", t: "" };
    if (!Array.isArray(d.plans)) d.plans = [];
    if (!Array.isArray(d.trades)) d.trades = [];
    if (typeof d.noTradeIf !== "string") d.noTradeIf = "";
    if (d.pnl == null) d.pnl = "";
    if (!d.checks) d.checks = {};
    if (!d.judged) d.judged = {};
    if (!d.links) d.links = {};
    if (!d.watch || !Array.isArray(d.watch.today)) d.watch = { today: [], tomorrow: [] };
    if (!Array.isArray(d.watch.tomorrow)) d.watch.tomorrow = [];
    return d;
  }
  function touch(ds) { getDay(ds).mtime = Date.now(); save(); }

  /* ---------- 카테고리 ---------- */
  function catById(id) { return state.categories.find((c) => c.id === id) || null; }
  function projectById(id) { return state.projects.find((p) => p.id === id) || null; }

  /* ---------- 타임라인 슬롯 ---------- */
  function slotMin() { return state.settings.slotMin || 10; }
  function startMin() { return (state.settings.dayStartHour || 0) * 60; }
  function endMin() { return (state.settings.dayEndHour || 24) * 60; }
  function slotKeys() {
    const out = [], step = slotMin();
    for (let m = startMin(); m < endMin(); m += step) out.push(U.toHHMM(m));
    return out;
  }

  // side: "plan" | "done" — 채워진 분 합계
  function filledMin(ds, side) {
    const map = peekDay(ds)[side] || {};
    return Object.keys(map).length * slotMin();
  }
  // 카테고리별 분 합계 { catId: min }
  function minutesByCat(ds, side) {
    const map = peekDay(ds)[side] || {};
    const step = slotMin(), out = {};
    for (const k in map) {
      const c = map[k] && map[k].c;
      if (!c) continue;
      out[c] = (out[c] || 0) + step;
    }
    return out;
  }
  // 공부(study:true) 카테고리 누적 분
  function studyMin(ds, side) {
    const by = minutesByCat(ds, side || "done");
    let sum = 0;
    for (const id in by) { const c = catById(id); if (c && c.study) sum += by[id]; }
    return sum;
  }
  // 제시간 실천율(%) — 계획한 슬롯 '그 시간에' 실행된 비율. 시간이 밀리면 떨어진다.
  function onTimeRate(ds) {
    const d = peekDay(ds), plan = d.plan || {}, done = d.done || {};
    const keys = Object.keys(plan);
    if (!keys.length) return null;
    let hit = 0;
    keys.forEach((k) => { if (done[k]) hit++; });
    return Math.round((hit / keys.length) * 100);
  }

  // 실천율(%) — 카테고리별 '분' 기준. 시간이 밀려도 한 건 한 걸로 인정한다.
  // Σ min(계획분, 실제분) / Σ 계획분
  function adherence(ds) {
    const p = minutesByCat(ds, "plan"), d = minutesByCat(ds, "done");
    let planTotal = 0, overlap = 0;
    for (const c in p) { planTotal += p[c]; overlap += Math.min(p[c], d[c] || 0); }
    if (!planTotal) return null;
    return Math.round((overlap / planTotal) * 100);
  }

  // 연속된 같은 (카테고리, 제목) 슬롯을 하나의 블록으로 묶는다
  function blocksOf(ds, side) {
    const map = peekDay(ds)[side || "plan"] || {};
    const step = slotMin();
    const out = [];
    let cur = null;
    slotKeys().forEach((k) => {
      const v = map[k];
      if (!v) { cur = null; return; }
      if (cur && cur.c === v.c && cur.t === (v.t || "")) {
        cur.slots.push(k); cur.endMin += step;
      } else {
        cur = { key: k, c: v.c, t: v.t || "", slots: [k], startMin: U.toMin(k), endMin: U.toMin(k) + step };
        out.push(cur);
      }
    });
    return out;
  }

  // 계획 블록별 판정 상태: done(했음) / skip(안 함) / other(다른 걸 함) / null(미판정)
  function verdictOf(ds, blockKey) { return (peekDay(ds).judged || {})[blockKey] || null; }
  function judgeProgress(ds) {
    const blocks = blocksOf(ds, "plan");
    const judged = peekDay(ds).judged || {};
    return { done: blocks.filter((b) => judged[b.key]).length, total: blocks.length };
  }

  /* ---------- 할일 ---------- */
  function tasksOf(ds, tab) {
    const all = peekDay(ds).tasks || [];
    if (!tab) return all;
    return all.filter((t) => {
      const p = projectById(t.projectId);
      return p && p.tab === tab;
    });
  }
  function taskStats(ds, tab) {
    const list = tasksOf(ds, tab);
    return { done: list.filter((t) => t.done).length, total: list.length };
  }

  /* ---------- 루틴 구간 ---------- */
  function phases() {
    const r = state.settings.routine || {};
    return (r.phases || []).map((p) => ({ ...p, startMin: U.toMin(p.start), endMin: U.toMin(p.end) }));
  }
  function phaseAt(min) {
    return phases().find((p) => min >= p.startMin && min < p.endMin) || null;
  }
  function phaseById(id) { return phases().find((p) => p.id === id) || null; }
  // 한 구간의 체크 진행도
  function phaseProgress(ds, p) {
    const checks = peekDay(ds).checks || {};
    const total = (p.items || []).length;
    let done = 0;
    for (let i = 0; i < total; i++) if (checks[p.id + ":" + i]) done++;
    return { done, total };
  }

  /* ---------- 매매 ---------- */
  // 손익비 = (목표가-진입가) / (진입가-손절가), 매도 방향이면 부호 반전
  function riskReward(p) {
    const e = +p.entry, s = +p.stop, t = +p.target;
    if (!e || !s || !t) return null;
    const risk = Math.abs(e - s), reward = Math.abs(t - e);
    if (!risk) return null;
    return reward / risk;
  }
  // 계획에 없던 매매 건수
  function offPlanTrades(ds) {
    return (peekDay(ds).trades || []).filter((t) => !t.planId);
  }
  // 손익/승률은 구글시트의 매매일지에서 관리한다. 여기선 '계획대로 했는가'만 센다.
  function tradeStats(ds) {
    const trades = peekDay(ds).trades || [];
    const raw = peekDay(ds).pnl;
    const pnl = raw === "" || raw == null ? null : Number(raw);
    return {
      count: trades.length,
      offPlan: offPlanTrades(ds).length,
      pnl: Number.isFinite(pnl) ? pnl : null,   // 하루 손익 (선택 입력, 중단 규칙용)
    };
  }
  // 가드레일 상태: 계획외 매매 / 매매 횟수 / 손실 한도
  function guardState(ds) {
    const g = state.settings.guard || {};
    const st = tradeStats(ds);
    const hits = [];
    if (g.planViolation !== "off" && st.offPlan > 0) {
      hits.push({ kind: "offPlan", msg: `계획에 없던 매매 ${st.offPlan}건 — 오늘은 여기까지` });
    }
    if (g.maxTrades > 0 && st.count >= g.maxTrades) {
      hits.push({ kind: "maxTrades", msg: `오늘 매매 ${st.count}건 — 상한(${g.maxTrades}건) 도달` });
    }
    if (g.maxLossPct > 0 && st.pnl != null && st.pnl < 0 && Math.abs(st.pnl) >= g.maxLossPct) {
      hits.push({ kind: "maxLoss", msg: `오늘 손익 ${st.pnl} — 하루 손실 한도(${g.maxLossPct}) 도달` });
    }
    return { hits, blocked: hits.length > 0 && g.planViolation === "block", stats: st };
  }

  /* ---------- 가설 ---------- */
  function blankHypothesis() {
    return { bias: "", reason: "", sectors: ["", ""], savedAt: 0,
             openSnapshot: null, editedAfterOpen: false, lateFirstWrite: false,
             verdict: { hit: null, sectorHit: null, note: "" } };
  }

  /* ---------- D-day ---------- */
  function upcomingDdays(limit) {
    const t = U.today();
    return state.ddays
      .slice()
      .sort((a, b) => U.diffDays(t, a.date) - U.diffDays(t, b.date))
      .filter((x) => U.diffDays(t, x.date) >= 0)
      .slice(0, limit || 3);
  }

  App.store = {
    KEY, SCHEMA,
    get state() { return state; },
    load, save, reset, migrate, defaults,
    blankDay, peekDay, getDay, touch,
    catById, projectById,
    slotMin, startMin, endMin, slotKeys,
    filledMin, minutesByCat, studyMin, adherence, onTimeRate,
    blocksOf, verdictOf, judgeProgress,
    tasksOf, taskStats, upcomingDdays,
    phases, phaseAt, phaseById, phaseProgress,
    riskReward, offPlanTrades, tradeStats, guardState, blankHypothesis,
  };
})();
