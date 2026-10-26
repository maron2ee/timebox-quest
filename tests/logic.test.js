/* ===========================================================
   logic.test.js — 순수 로직 회귀 테스트 (DOM 스텁)
   실행: node tests/logic.test.js
   =========================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* ---------- 최소 DOM / 저장소 스텁 ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const noopEl = () => ({
  className: "", innerHTML: "", textContent: "", value: "", style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, addEventListener() {}, querySelector: () => null,
  querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, width: 100 }),
});
const document = {
  createElement: noopEl,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};
const sandbox = {
  window: {}, document, localStorage, console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Blob: function () {}, alert() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

sandbox.window.App = sandbox.window.App || {};
["util.js", "store.js", "market.js", "hypothesis.js", "judge.js"].forEach((f) => {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
});

const App = sandbox.window.App;
const U = App.util;
const S = App.store;

/* ---------- 테스트 러너 ---------- */
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
function eq(a, b, msg) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg || ""} expected ${y}, got ${x}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }

/* ---------- util: 날짜 ---------- */
t("ymd/parseYmd 왕복", () => {
  const ds = "2026-07-17";
  eq(U.ymd(U.parseYmd(ds)), ds);
});
t("addDays 월 경계", () => {
  eq(U.addDays("2026-07-31", 1), "2026-08-01");
  eq(U.addDays("2026-01-01", -1), "2025-12-31");
});
t("weekday / fmtMD", () => {
  eq(U.weekday("2026-07-17"), "금");
  eq(U.fmtMD("2026-07-17"), "7월 17일 금");
});
t("diffDays / dday", () => {
  eq(U.diffDays("2026-07-10", "2026-07-17"), 7);
  eq(U.dday("2026-07-17", "2026-07-10"), "D-7");
  eq(U.dday("2026-07-10", "2026-07-10"), "D-DAY");
  eq(U.dday("2026-07-03", "2026-07-10"), "D+7");
});
t("weekStart 는 월요일", () => {
  eq(U.weekStart("2026-07-17"), "2026-07-13");   // 금 → 그 주 월
  eq(U.weekStart("2026-07-13"), "2026-07-13");
});
t("monthStart / monthEnd", () => {
  eq(U.monthStart("2026-07-17"), "2026-07-01");
  eq(U.monthEnd("2026-07-17"), "2026-07-31");
  eq(U.monthEnd("2026-02-10"), "2026-02-28");
});
t("rangeDays 개수", () => {
  eq(U.rangeDays("2026-07-01", "2026-07-07").length, 7);
});

/* ---------- util: 시간 ---------- */
t("toMin / toHHMM 왕복", () => {
  eq(U.toMin("09:30"), 570);
  eq(U.toHHMM(570), "09:30");
  eq(U.toHHMM(0), "00:00");
  eq(U.toHHMM(1440), "00:00");
});
t("minToKo 표기", () => {
  eq(U.minToKo(320), "5시간 20분");
  eq(U.minToKo(60), "1시간");
  eq(U.minToKo(40), "40분");
  eq(U.minToKo(0), "0분");
});
t("clamp", () => {
  eq(U.clamp(5, 0, 3), 3);
  eq(U.clamp(-1, 0, 3), 0);
});
t("esc 는 HTML 이스케이프", () => {
  eq(U.esc('<b>"x"</b>'), "&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
});

/* ---------- store ---------- */
t("load 하면 기본 카테고리/프로젝트", () => {
  S.load();
  ok(S.state.categories.length >= 4, "카테고리 기본값");
  ok(S.state.projects.length >= 3, "프로젝트 기본값");
  eq(S.state.version, S.SCHEMA);
});
t("slotKeys 개수 = (끝-시작)*60/slot", () => {
  S.load();
  const s = S.state.settings;
  const expect = ((s.dayEndHour - s.dayStartHour) * 60) / s.slotMin;
  eq(S.slotKeys().length, expect);
});
t("peekDay 는 저장소를 더럽히지 않는다", () => {
  S.reset();
  S.peekDay("2026-07-17");
  eq(Object.keys(S.state.days).length, 0);
  S.getDay("2026-07-17");
  eq(Object.keys(S.state.days).length, 1);
});
t("filledMin / minutesByCat", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.plan["09:00"] = { c: "study", t: "" };
  d.plan["09:10"] = { c: "study", t: "" };
  d.plan["09:20"] = { c: "rest", t: "" };
  eq(S.filledMin("2026-07-17", "plan"), 30);
  eq(S.minutesByCat("2026-07-17", "plan"), { study: 20, rest: 10 });
});
t("studyMin 은 study:true 만 합산", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.done["09:00"] = { c: "study", t: "" };   // study:true
  d.done["09:10"] = { c: "rest", t: "" };    // study:false
  eq(S.studyMin("2026-07-17", "done"), 10);
});
t("adherence = 계획 칸 중 실행된 비율", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.plan["09:00"] = { c: "study", t: "" };
  d.plan["09:10"] = { c: "study", t: "" };
  d.plan["09:20"] = { c: "study", t: "" };
  d.plan["09:30"] = { c: "study", t: "" };
  d.done["09:00"] = { c: "study", t: "" };
  d.done["09:10"] = { c: "study", t: "" };
  eq(S.adherence("2026-07-17"), 50);
  eq(S.adherence("2026-07-18"), null, "계획 없으면 null");
});
t("taskStats 집계", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.tasks = [
    { id: "a", projectId: "p_stock", text: "x", done: true },
    { id: "b", projectId: "p_stock", text: "y", done: false },
    { id: "c", projectId: "p_life", text: "z", done: true },
  ];
  eq(S.taskStats("2026-07-17"), { done: 2, total: 3 });
  eq(S.taskStats("2026-07-17", "study"), { done: 1, total: 2 });
  eq(S.taskStats("2026-07-17", "plan"), { done: 1, total: 1 });
});
t("migrate 는 누락 필드를 복구", () => {
  const broken = { version: 0, days: null, categories: [], settings: { dayStartHour: 5 } };
  const fixed = S.migrate(Object.assign(S.defaults(), broken));
  eq(fixed.version, S.SCHEMA);
  eq(fixed.settings.dayStartHour, 5, "사용자 값은 보존");
  ok(fixed.categories.length > 0, "빈 카테고리는 기본값으로");
  ok(fixed.days && typeof fixed.days === "object");
  ok(Array.isArray(fixed.terms) && Array.isArray(fixed.research));
});
t("저장 후 load 하면 복원", () => {
  S.reset();
  S.getDay("2026-07-17").goal = "테스트 목표";
  localStorage.setItem(S.KEY, JSON.stringify(S.state));  // debounce 우회
  S.load();
  eq(S.peekDay("2026-07-17").goal, "테스트 목표");
});

/* ---------- market (2026.09.14 개편) ---------- */
t("정규장 09:00~15:30", () => {
  S.load();
  const s = App.market.sessionAt(U.toMin("10:00"));
  eq(s && s.id, "regular");
  eq(App.market.sessionAt(U.toMin("15:35")), null, "15:35 는 공백");
});
t("애프터마켓 16:00~20:00 신설", () => {
  const a = App.market.sessionAt(U.toMin("18:00"));
  eq(a && a.id, "after");
  eq(a && a.end, "20:00");
  eq(App.market.sessionAt(U.toMin("20:00")), null, "20:00 이후는 장 마감");
});
t("장전 동시호가 / 시간외 종가", () => {
  eq(App.market.sessionAt(U.toMin("08:45")).id, "preCall");
  eq(App.market.sessionAt(U.toMin("15:45")).id, "afterClose");
});
t("주말은 비거래일", () => {
  ok(App.market.isTradingDay("2026-07-17"), "금요일은 거래일");
  ok(!App.market.isTradingDay("2026-07-18"), "토요일");
  ok(!App.market.isTradingDay("2026-07-19"), "일요일");
});
t("toneFor 는 비거래일에 null", () => {
  eq(App.market.toneFor("2026-07-18", U.toMin("10:00"), 60), null);
  eq(App.market.toneFor("2026-07-17", U.toMin("10:00"), 60), "core");
  eq(App.market.toneFor("2026-07-17", U.toMin("17:00"), 60), "after");
});


/* ---------- 루틴 구간 ---------- */
t("기본 구간은 10개, 시간순", () => {
  S.load();
  const ps = S.phases();
  eq(ps.length, 10);
  for (let i = 1; i < ps.length; i++) ok(ps[i].startMin >= ps[i - 1].endMin, "구간이 겹치지 않음");
});
t("phaseAt 이 맞는 구간을 찾는다", () => {
  eq(S.phaseAt(U.toMin("09:15")).id, "obs");
  eq(S.phaseAt(U.toMin("10:00")).id, "exec");
  eq(S.phaseAt(U.toMin("12:00")).id, "rest");
  eq(S.phaseAt(U.toMin("16:00")).id, "rec");
  eq(S.phaseAt(U.toMin("03:00")), null, "구간 밖은 null");
});
t("장중 구간은 읽기 전용", () => {
  ["obs", "exec", "hold", "close"].forEach((id) => ok(S.phaseById(id).readonly, id));
  ["pre1", "pre3", "rec", "learn"].forEach((id) => ok(!S.phaseById(id).readonly, id));
});
t("phaseProgress 체크 집계", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.checks["pre1:0"] = Date.now();
  d.checks["pre1:2"] = Date.now();
  const pr = S.phaseProgress("2026-07-17", S.phaseById("pre1"));
  eq(pr, { done: 2, total: 3 });
});

/* ---------- 매매: 손익비 · 가드레일 ---------- */
t("손익비 계산", () => {
  eq(S.riskReward({ entry: 70000, stop: 68000, target: 76000 }), 3);
  eq(S.riskReward({ entry: 200000, stop: 195000, target: 205000 }), 1);
  eq(S.riskReward({ entry: 100, stop: 100, target: 120 }), null, "손절=진입이면 계산 불가");
  eq(S.riskReward({ entry: "", stop: 1, target: 2 }), null);
});
t("계획외 매매 집계", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.plans.push({ id: "p1", ticker: "005930" });
  d.trades.push({ id: "t1", planId: "p1", ticker: "005930" });
  d.trades.push({ id: "t2", planId: null, ticker: "알테오젠" });
  eq(S.tradeStats("2026-07-17").offPlan, 1);
  eq(S.tradeStats("2026-07-17").count, 2);
});
t("가드레일 — 계획외 매매", () => {
  S.reset();
  S.state.settings.guard.planViolation = "warn";
  const d = S.getDay("2026-07-17");
  d.trades.push({ id: "t1", planId: null, ticker: "X" });
  let g = S.guardState("2026-07-17");
  eq(g.hits.length, 1);
  ok(!g.blocked, "warn 모드는 차단 안 함");
  S.state.settings.guard.planViolation = "block";
  ok(S.guardState("2026-07-17").blocked, "block 모드는 차단");
  S.state.settings.guard.planViolation = "off";
  eq(S.guardState("2026-07-17").hits.length, 0, "off 모드는 무시");
});
t("가드레일 — 매매 횟수 상한", () => {
  S.reset();
  S.state.settings.guard.planViolation = "off";
  S.state.settings.guard.maxTrades = 2;
  const d = S.getDay("2026-07-17");
  d.plans.push({ id: "p1" });
  d.trades.push({ id: "t1", planId: "p1" });
  eq(S.guardState("2026-07-17").hits.length, 0, "1건은 통과");
  d.trades.push({ id: "t2", planId: "p1" });
  eq(S.guardState("2026-07-17").hits.length, 1, "2건이면 상한 도달");
  S.state.settings.guard.maxTrades = 0;
});

/* ---------- 가설 적중률 ---------- */
t("가설 적중률은 장 시작 전 확정분만 집계", () => {
  S.reset();
  const mk = (ds, over) => {
    const h = S.blankHypothesis();
    h.bias = "bull"; h.reason = "x"; h.savedAt = 1;
    h.verdict = { hit: true, sectorHit: null, note: "" };
    Object.assign(h, over || {});
    S.getDay(ds).hypothesis = h;
  };
  mk("2026-07-13");                                  // 정상 적중
  mk("2026-07-14", { verdict: { hit: false, sectorHit: null, note: "" } }); // 정상 빗나감
  mk("2026-07-15", { lateFirstWrite: true });        // 사후 작성 → clean 에서 제외
  mk("2026-07-16", { editedAfterOpen: true });       // 장중 수정 → clean 에서 제외

  const a = App.hypo.accuracy("2026-07-13", "2026-07-17");
  eq(a.written, 4);
  eq(a.lateFirst, 1);
  eq(a.edited, 1);
  eq(a.judged, 4, "전체 판정 건수");
  eq(a.rate, 75, "전체 적중률 3/4");
  eq(a.cleanJudged, 2, "깨끗한 가설만 2건");
  eq(a.cleanRate, 50, "그 중 1건 적중");
});


/* ---------- 실천율: 카테고리 분 vs 슬롯 ---------- */
t("실천율은 시간이 밀려도 한 걸 인정한다", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  // 계획: 13:00~14:00 리서치 6칸
  for (let m = 13 * 60; m < 14 * 60; m += 10) d.plan[U.toHHMM(m)] = { c: "research", t: "리서치" };
  // 실제: 같은 걸 1시간 밀려서 14:00~15:00 에 함
  for (let m = 14 * 60; m < 15 * 60; m += 10) d.done[U.toHHMM(m)] = { c: "research", t: "리서치" };
  eq(S.adherence("2026-07-17"), 100, "카테고리 분 기준이면 100%");
  eq(S.onTimeRate("2026-07-17"), 0, "제시간 기준이면 0%");
});
t("다른 카테고리를 했으면 실천율이 깎인다", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  for (let m = 13 * 60; m < 14 * 60; m += 10) d.plan[U.toHHMM(m)] = { c: "research", t: "" };
  // 절반만 리서치, 절반은 휴식
  for (let m = 13 * 60; m < 13 * 60 + 30; m += 10) d.done[U.toHHMM(m)] = { c: "research", t: "" };
  for (let m = 13 * 60 + 30; m < 14 * 60; m += 10) d.done[U.toHHMM(m)] = { c: "rest", t: "" };
  eq(S.adherence("2026-07-17"), 50);
});
t("계획보다 더 해도 100%를 넘지 않는다", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  for (let m = 13 * 60; m < 13 * 60 + 30; m += 10) d.plan[U.toHHMM(m)] = { c: "research", t: "" };
  for (let m = 13 * 60; m < 14 * 60; m += 10) d.done[U.toHHMM(m)] = { c: "research", t: "" };
  eq(S.adherence("2026-07-17"), 100);
});
t("계획이 없으면 null", () => {
  S.reset();
  eq(S.adherence("2026-07-17"), null);
  eq(S.onTimeRate("2026-07-17"), null);
});

/* ---------- 블록 병합 · 판정 ---------- */
t("연속 같은 (카테고리,제목) 슬롯은 한 블록", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.plan["09:00"] = { c: "market", t: "시황" };
  d.plan["09:10"] = { c: "market", t: "시황" };
  d.plan["09:20"] = { c: "market", t: "다른제목" };   // 제목이 다르면 끊김
  d.plan["09:40"] = { c: "market", t: "시황" };       // 09:30 비어서 끊김
  const b = S.blocksOf("2026-07-17", "plan");
  eq(b.length, 3);
  eq(b[0].slots.length, 2);
  eq(b[0].startMin, U.toMin("09:00"));
  eq(b[0].endMin, U.toMin("09:20"));
});
t("판정: 했음 → DONE 채움 / 안 함 → 비움", () => {
  S.reset();
  const ds = "2026-07-17";
  const d = S.getDay(ds);
  for (let m = 13 * 60; m < 14 * 60; m += 10) d.plan[U.toHHMM(m)] = { c: "research", t: "리서치" };
  const block = S.blocksOf(ds, "plan")[0];

  App.judge.apply(ds, block, "done");
  eq(S.filledMin(ds, "done"), 60);
  eq(S.verdictOf(ds, block.key), "done");

  App.judge.apply(ds, block, "skip");
  eq(S.filledMin(ds, "done"), 0, "안 함이면 DONE 을 비운다");
  eq(S.verdictOf(ds, block.key), "skip");

  App.judge.apply(ds, block, "other", "rest");
  eq(S.minutesByCat(ds, "done"), { rest: 60 }, "다른 걸 함 → 그 카테고리로");
  eq(S.verdictOf(ds, block.key), "other");

  App.judge.apply(ds, block, null);
  eq(S.verdictOf(ds, block.key), null, "판정 취소");
  eq(S.filledMin(ds, "done"), 0);
});
t("judgeProgress 집계", () => {
  S.reset();
  const ds = "2026-07-17";
  const d = S.getDay(ds);
  d.plan["09:00"] = { c: "market", t: "a" };
  d.plan["10:00"] = { c: "study", t: "b" };
  eq(S.judgeProgress(ds), { done: 0, total: 2 });
  App.judge.apply(ds, S.blocksOf(ds, "plan")[0], "done");
  eq(S.judgeProgress(ds), { done: 1, total: 2 });
});

/* ---------- 결과 ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
