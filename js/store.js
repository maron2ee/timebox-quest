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

  function defaults() {
    return {
      version: SCHEMA,
      settings: {
        dayStartHour: 7,     // 타임라인 시작 시각
        dayEndHour: 24,      // 타임라인 끝 시각(이 시각 직전까지 표시)
        slotMin: 10,         // 한 칸 = 10분
        market: { show: true, sessions: null },
        carryOver: true,     // 어제 미완료 할일 이어받기 제안
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
    if (!Array.isArray(s.categories) || !s.categories.length) s.categories = d.categories;
    if (!Array.isArray(s.projects) || !s.projects.length) s.projects = d.projects;
    if (!s.days || typeof s.days !== "object") s.days = {};
    ["ddays", "terms", "research"].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    s.pomo = Object.assign({}, d.pomo, s.pomo || {});
    s.version = SCHEMA;
    return s;
  }

  function reset() { state = defaults(); save(); return state; }

  /* ---------- 하루 ---------- */
  function blankDay() {
    return { goal: "", big3: ["", "", ""], plan: {}, done: {}, tasks: [], review: { k: "", p: "", t: "" }, mtime: 0 };
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
  // 계획 대비 실천율(%) — 계획한 슬롯 중 같은 슬롯이 실행에도 찍힌 비율
  function adherence(ds) {
    const d = peekDay(ds), plan = d.plan || {}, done = d.done || {};
    const keys = Object.keys(plan);
    if (!keys.length) return null;
    let hit = 0;
    keys.forEach((k) => { if (done[k]) hit++; });
    return Math.round((hit / keys.length) * 100);
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
    filledMin, minutesByCat, studyMin, adherence,
    tasksOf, taskStats, upcomingDdays,
  };
})();
