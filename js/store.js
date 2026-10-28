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
  const SEED = 3;   // 기본 카테고리·할일그룹 보강 버전 (올리면 누락분을 1회 추가)

  /* ---------- 카테고리 대분류 ----------
     productive:true = '생산 시간'에 합산 */
  const CAT_GROUPS = [
    { id: "invest", name: "투자공부", productive: true },
    { id: "exec",   name: "매매",     productive: true },
    { id: "growth", name: "자기계발", productive: true },
    { id: "body",   name: "운동",     productive: true },
    { id: "life",   name: "생활",     productive: false },
    { id: "rest",   name: "휴식",     productive: false },
  ];
  const catGroup = (id) => CAT_GROUPS.find((g) => g.id === id) || CAT_GROUPS[CAT_GROUPS.length - 1];

  /* ---------- 기본 카테고리 (타임박스 색) ---------- */
  const CATS = [
    { id: "study",    name: "주식공부", color: "#fde68a", group: "invest" },
    { id: "research", name: "리서치",   color: "#ddd6fe", group: "invest" },
    { id: "market",   name: "시황체크", color: "#bfdbfe", group: "invest" },
    { id: "trade",    name: "매매",     color: "#fecaca", group: "exec" },
    { id: "english",  name: "영어",     color: "#a7f3d0", group: "growth" },
    { id: "japanese", name: "일본어",   color: "#f9a8d4", group: "growth" },
    { id: "read",     name: "투자독서", color: "#d9f99d", group: "invest" },
    { id: "read2",    name: "독서",     color: "#a5f3fc", group: "growth" },
    { id: "exercise", name: "운동",     color: "#fdba74", group: "body" },
    { id: "routine",  name: "루틴",     color: "#cbd5e1", group: "life" },
    { id: "rest",     name: "휴식",     color: "#e5e7eb", group: "rest" },
  ];

  const PROJECTS = [
    { id: "p_stock",  name: "주식공부", tab: "study", collapsed: false },
    { id: "p_eng",    name: "영어공부", tab: "study", collapsed: false },
    { id: "p_jp",     name: "일본어",   tab: "study", collapsed: false },
    { id: "p_review", name: "회고",     tab: "study", collapsed: false },
    { id: "p_life",   name: "일정",     tab: "plan",  collapsed: false },
  ];

  /* ---------- 전업투자자 데일리 루틴 구간 (2026-10-28 최종본) ----------
     mode: input(입력) / plan(계획) / observe(매매금지) / exec(집행)
           manage(관리) / record(기록) / watch(저녁관찰) / learn(학습)
     장중(observe·exec·manage) 체크리스트는 읽기 전용 — "장중엔 기록하지 않고 읽기만" 원칙.
     note: 체크 항목이 아닌 한 줄 원칙 — 구간 상단에 그대로 보여준다.
     매매 계획·집행·종가배팅 조건·중단 규칙은 전부 '읽기용 리마인드'다.
     (매매 계획/계획외 카운터를 추적하는 자동화는 2026-10-27에 걷어냈다 — 되살리지 말 것) */
  const PHASES = [
    { id: "pre1", name: "뉴스·미국장", start: "07:30", end: "07:50", mode: "input", catId: "market",
      items: [
        { text: "전일 미국 뉴스·미국장 숫자 확인 → 시트 AM 숫자, 미국 주도섹터, 오늘 일정", min: 20 },
      ] },
    { id: "pre2", name: "리포트·관심종목", start: "07:50", end: "08:15", mode: "input", catId: "research",
      items: [
        { text: "돈 몰릴 뉴스 예고 + 모닝 리포트 원문 → 환경 예상·예상 섹터·아침 가설", min: 15 },
        { text: "텔레그램 스크리너 + 경제뉴스 제목만 → 관심종목 Top3", min: 10 },
      ] },
    { id: "pre3", name: "매매 계획 확정", start: "08:15", end: "08:30", mode: "plan", catId: "research",
      note: "08:30에 가설을 잠급니다. 이후엔 고치지 않아요.",
      items: [
        { text: "가설 확정·무효화 조건·매매 계획(진입가·손절가·수량) → 시트 기록", min: 15 },
      ] },
    { id: "obs", name: "관찰만", start: "09:00", end: "09:30", mode: "observe", catId: "market", readonly: true,
      items: [
        { text: "코스피·코스닥 방향, 거래대금 상위 확인 (입력 없음)", min: 0 },
      ] },
    { id: "exec", name: "집행·입력", start: "09:30", end: "13:00", mode: "exec", catId: "trade", readonly: true,
      note: "우선순위: 계획 매매 → 관찰 → 입력. 계획 외 매매는 1건만 나와도 그날 종료예요 — 수익이어도.",
      items: [
        { text: "매매할 게 없으면: 증권사 리포트 1개 + 뉴스레터·경제뉴스·유튜브(30분 이내) + 남으면 독서 — 합계 90분 이내", min: 0 },
        { text: "읽은 것 3줄 기록 — 스터디는 Study Archive, 뉴스는 데일리 노트 뉴스 칸", min: 0 },
        { text: "체결 즉시 매매일지 한 줄", min: 0 },
      ] },
    { id: "hold", name: "보유 종목 관리", start: "13:00", end: "14:50", mode: "manage", catId: "trade", readonly: true,
      note: "연속 3회 손절 또는 하루 −2%(약 9만원)면 그날 종료예요.",
      items: [
        { text: "신규 진입 금지", min: 0 },
      ] },
    { id: "close", name: "마감 대응", start: "14:50", end: "15:30", mode: "manage", catId: "trade", readonly: true,
      note: "종가배팅 최종 판단 — 계획에 있던 후보만, 4조건을 모두 확인하세요.",
      items: [
        { text: "① 외국인 코스피 순매수", min: 0 },
        { text: "② 전일까지 외국인 3일 연속 매도가 아닐 것", min: 0 },
        { text: "③ 종가위치 95% 이상", min: 0 },
        { text: "④ 1회 비중 5% 이하", min: 0 },
      ] },
    { id: "rec", name: "기록·마감 분석", start: "15:40", end: "16:40", mode: "record", catId: "research",
      note: "순서: 사실 기록 → 내 판정 → 남의 해석. 텔레그램·마감 리포트는 판정을 쓴 뒤에 — 다른 점은 가설 DB 후보로만.",
      items: [
        { text: "당일 체결 매매일지: 계획 여부 O/X, 손절 준수 → 매매일지", min: 10 },
        { text: "마감 숫자: 지수, 투자자별 매매동향, 거래대금 → 시트 PM", min: 15 },
        { text: "개별종목 수급, 섹터 특이사항 → 시트 PM", min: 10 },
        { text: "가설 판정: 환경 실제, 핵심 결론 (틀렸으면 이유 한 줄) → 시트 PM", min: 10 },
        { text: "데일리 노트 4블록 + 뉴스 칸 → 노션", min: 15 },
      ] },
    { id: "evening1", name: "종배 후보 관찰", start: "19:00", end: "20:00", mode: "watch", catId: "research",
      items: [
        { text: "종배 후보 관찰 — 8501 대시보드 한 곳에만", min: 40 },
        { text: "내일 관찰 가격대 → 데일리 노트 4번 블록", min: 10 },
        { text: "텔레그램 새 실적·뉴스 → 가설로 키울 만하면 가설 DB, 아니면 뉴스 칸 한 줄", min: 10 },
      ] },
    { id: "learn", name: "리포트·독서", start: "21:00", end: "22:00", mode: "learn", catId: "read",
      items: [
        { text: "산업 리포트·독서·기업 분석 → Study Archive", min: 60 },
      ] },
  ];

  /* ---------- 리서치 인덱스 2축 ---------- */
  // 구분 — 무엇에 대한 메모인가
  const RS_KINDS = [
    { id: "stock",  name: "종목" },
    { id: "theme",  name: "테마·섹터" },
    { id: "macro",  name: "매크로" },
    { id: "report", name: "리포트" },
    { id: "event",  name: "이벤트" },
  ];
  // 스탠스 — 지금 내 판단
  const RS_STANCES = [
    { id: "watch", name: "관심" },
    { id: "cand",  name: "후보" },
    { id: "hold",  name: "보유" },
    { id: "pause", name: "보류" },
    { id: "drop",  name: "폐기" },
  ];
  const rsKind = (id) => RS_KINDS.find((x) => x.id === id) || RS_KINDS[0];
  const rsStance = (id) => RS_STANCES.find((x) => x.id === id) || RS_STANCES[0];

  function defaults() {
    return {
      version: SCHEMA,
      settings: {
        dayStartHour: 7,     // 타임라인 시작 시각
        dayEndHour: 24,      // 타임라인 끝 시각(이 시각 직전까지 표시)
        slotMin: 10,         // 한 칸 = 10분
        market: { show: true, sessions: null },
        carryOver: true,     // 어제 미완료 할일 이어받기 제안
        seed: SEED,          // 기본값 보강이 어디까지 적용됐는지
        routine: { enabled: true, phases: PHASES.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })) },
        // 외부 기록 링크 — 이름·URL 모두 편집 가능. daily:true 면 URL 을 날짜별(day.links[id])로 저장
        // quick:true 면 주소칸 없이 '바로가기' 아이콘 버튼으로만 보인다
        links: [
          { id: "sheet",   label: "2층 시트", icon: "📊", url: "", daily: false, quick: false },
          { id: "note",    label: "3층 노트", icon: "📝", url: "", daily: true,  quick: false },
          { id: "notes",   label: "노트 DB",  icon: "📚", url: "", daily: false, quick: true  },
          { id: "rules",   label: "1층 규칙", icon: "📌", url: "", daily: false, quick: true  },
          { id: "journal", label: "매매일지", icon: "📒", url: "", daily: false, quick: true  },
        ],
        // 구간 알림 — 탭이 열려 있을 때만 동작한다 (서버 푸시 없음)
        notify: { enabled: false, lead: 3, sound: false },
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
    // seed 는 defaults 를 덮어씌우기 '전에' 읽어야 한다 — 안 그러면 옛 저장본도 최신 seed 로 보여 보강이 건너뛰어진다
    const rawSeed = s.settings && s.settings.seed != null ? +s.settings.seed || 0 : 0;
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.settings.market = Object.assign({}, d.settings.market, s.settings.market || {});
    s.settings.routine = Object.assign({}, d.settings.routine, s.settings.routine || {});
    // 링크: 예전 객체형 {sheet,notes,rules} 을 목록형으로 올린다
    if (!Array.isArray(s.settings.links)) {
      const old = s.settings.links || {};
      s.settings.links = d.settings.links.map((e) => ({ ...e, url: old[e.id] || "" }));
    }
    s.settings.links = s.settings.links
      .filter((e) => e && typeof e === "object")
      .map((e) => {
        const def = d.settings.links.find((x) => x.id === e.id);
        return {
          id: e.id || U.uid("lk"),
          label: (e.label || "링크").toString().slice(0, 20),
          icon: (e.icon != null ? e.icon : (def ? def.icon : "🔗")).toString().slice(0, 4) || "🔗",
          url: e.url || "",
          daily: !!e.daily,
          quick: e.quick != null ? !!e.quick : !!(def && def.quick),
        };
      });
    s.settings.notify = Object.assign({}, d.settings.notify, s.settings.notify || {});
    if (!Array.isArray(s.settings.routine.phases) || !s.settings.routine.phases.length) {
      s.settings.routine.phases = d.settings.routine.phases;
    }
    // 구간 항목: 예전 문자열 배열 → {text, min} 객체 배열
    s.settings.routine.phases.forEach((p) => {
      p.items = (Array.isArray(p.items) ? p.items : []).map((it) =>
        typeof it === "string"
          ? { text: it, min: 0 }
          : { text: (it && it.text) || "", min: Math.max(0, Math.round(+(it && it.min) || 0)) }
      ).filter((it) => it.text);
    });
    if (!Array.isArray(s.categories) || !s.categories.length) s.categories = d.categories;
    // 카테고리 대분류: 예전 study(boolean) → group(id). 멱등.
    s.categories = s.categories.map((c) => {
      if (c.group) return c;
      const def = CATS.find((x) => x.id === c.id);
      return { ...c, group: def ? def.group : (c.study ? "invest" : "life") };
    });

    // 기본값 보강 — SEED 를 올렸을 때 한 번만. 사용자가 지운 건 되살리지 않는다.
    if (rawSeed < SEED) {
      CATS.forEach((def) => {
        if (!s.categories.some((c) => c.id === def.id)) s.categories.push({ ...def });
      });
      PROJECTS.forEach((def) => {
        if (!s.projects.some((p) => p.id === def.id)) s.projects.push({ ...def });
      });
      // seed 2 이전에 '독서'가 자기계발로 들어갔던 것 정정.
      // 그 값은 사용자가 고른 게 아니라 마이그레이션 산물이라 되돌려도 된다.
      {
        const r = s.categories.find((c) => c.id === "read");
        if (r && r.group === "growth") r.group = "invest";
      }
      // seed 3: 이름 정리 — 독서(투자) → 투자독서, 일반독서 → 독서
      // 기본 이름 그대로일 때만 바꾼다. 직접 고쳐 쓰던 이름은 건드리지 않는다.
      if (rawSeed < 3) {
        const r1 = s.categories.find((c) => c.id === "read");
        if (r1 && r1.name === "독서") r1.name = "투자독서";
        const r2 = s.categories.find((c) => c.id === "read2");
        if (r2 && r2.name === "일반독서") r2.name = "독서";
      }
      s.settings.seed = SEED;
    }

    if (!s.days || typeof s.days !== "object") s.days = {};
    ["ddays", "terms", "research"].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    // 리서치는 '링크 인덱스'로 바뀌었다. 예전 앱 내 메모(body)는 지우지 않고 보존한다.
    s.research = s.research.map((r) => ({
      id: r.id || U.uid("rs"),
      ticker: r.ticker || "", name: r.name || "",
      sector: r.sector || "", url: r.url || "", note: r.note || "",
      kind: rsKind(r.kind).id, stance: rsStance(r.stance).id,
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
      judged: {},           // 계획 블록 판정 {startKey: 'done'|'skip'|'other'}
      checks: {},           // 구간 체크리스트 {'phaseId:index': true}
      links: {},            // 날짜별 외부 링크 {linkId: url}
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
    if (!d.checks) d.checks = {};
    if (!d.judged) d.judged = {};
    if (!d.links) d.links = {};
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
  // 대분류별 분 { groupId: min }
  function minutesByGroup(ds, side) {
    const by = minutesByCat(ds, side || "done");
    const out = {};
    for (const id in by) {
      const c = catById(id);
      const g = c ? (c.group || "life") : "life";
      out[g] = (out[g] || 0) + by[id];
    }
    return out;
  }
  // 한 대분류의 분
  function groupMin(ds, groupId, side) { return minutesByGroup(ds, side)[groupId] || 0; }
  // '학습시간' = 투자공부 그룹 (언어·독서는 자기계발로 분리)
  function studyMin(ds, side) { return groupMin(ds, "invest", side || "done"); }
  // 생산 시간 = productive:true 인 대분류 합계
  function productiveMin(ds, side) {
    const by = minutesByGroup(ds, side);
    let sum = 0;
    for (const g in by) if (catGroup(g).productive) sum += by[g];
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

  /* ---------- 외부 기록 링크 ---------- */
  function links() { return state.settings.links || []; }
  function linkById(id) { return links().find((e) => e.id === id) || null; }
  // daily 항목은 그날의 day.links[id], 아니면 전역 url
  function linkUrl(ds, entry) {
    if (!entry) return "";
    return entry.daily ? ((peekDay(ds).links || {})[entry.id] || "") : (entry.url || "");
  }
  function setLinkUrl(ds, entry, url) {
    url = (url || "").trim();
    if (entry.daily) { getDay(ds).links[entry.id] = url; touch(ds); }
    else { entry.url = url; save(); }
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
  // 항목 배분 시간 합계 vs 구간 길이
  function phaseBudget(p) {
    const alloc = (p.items || []).reduce((a, it) => a + (+it.min || 0), 0);
    const len = p.endMin - p.startMin;
    return { alloc, len, over: alloc > len };
  }
  // 한 구간의 체크 진행도
  function phaseProgress(ds, p) {
    const checks = peekDay(ds).checks || {};
    const total = (p.items || []).length;
    let done = 0;
    for (let i = 0; i < total; i++) if (checks[p.id + ":" + i]) done++;
    return { done, total };
  }

  // 구간을 언제 끝냈는지. checks 에 저장된 timestamp 를 읽는다.
  // late = 구간 종료 시각을 넘겨서 체크함 → 사후 기록
  function phaseStamp(ds, phaseId) {
    const p = phaseById(phaseId);
    if (!p) return null;
    const checks = peekDay(ds).checks || {};
    const total = (p.items || []).length;
    let done = 0, last = 0;
    for (let i = 0; i < total; i++) {
      const v = checks[p.id + ":" + i];
      if (!v) continue;
      done++;
      if (typeof v === "number" && v > last) last = v;
    }
    let late = false, atMin = null;
    if (last) {
      const t = new Date(last);
      atMin = t.getHours() * 60 + t.getMinutes();
      late = atMin >= p.endMin;
    }
    return { phase: p, done, total, complete: total > 0 && done === total, at: last || null, atMin, late };
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
    CAT_GROUPS, catGroup, minutesByGroup, groupMin, productiveMin,
    blocksOf, verdictOf, judgeProgress,
    tasksOf, taskStats, upcomingDdays,
    phases, phaseAt, phaseById, phaseProgress,
    phaseStamp, phaseBudget,
    links, linkById, linkUrl, setLinkUrl,
    RS_KINDS, RS_STANCES, rsKind, rsStance,
  };
})();
