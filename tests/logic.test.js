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

["util.js", "store.js", "market.js"].forEach((f) => {
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

/* ---------- 결과 ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
