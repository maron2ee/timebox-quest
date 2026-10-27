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
["util.js", "store.js", "market.js", "judge.js"].forEach((f) => {
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
t("studyMin 은 '투자공부' 대분류만 합산", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  d.done["09:00"] = { c: "study", t: "" };     // 투자공부
  d.done["09:10"] = { c: "research", t: "" };  // 투자공부
  d.done["09:20"] = { c: "english", t: "" };   // 자기계발 — 안 섞인다
  d.done["09:30"] = { c: "rest", t: "" };      // 휴식
  eq(S.studyMin("2026-07-17", "done"), 20);
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

/* ---------- 구간 '도장' — 언제 확정했는가 ---------- */
t("phaseStamp 는 마지막 체크 시각을 쓴다", () => {
  S.reset();
  const ds = "2026-07-17";
  const d = S.getDay(ds);
  const at = (h, m) => new Date(2026, 6, 17, h, m).getTime();
  d.checks["pre3:0"] = at(8, 35);
  d.checks["pre3:1"] = at(8, 42);
  const st = S.phaseStamp(ds, "pre3");
  eq(st.done, 2);
  eq(st.total, 4);
  eq(st.complete, false, "4개 중 2개면 미완료");
  eq(U.toHHMM(st.atMin), "08:42", "가장 늦은 체크 시각");
  eq(st.late, false, "구간(~09:00) 안이면 제시간");
});
t("구간 종료 후 체크하면 late", () => {
  S.reset();
  const ds = "2026-07-17";
  const d = S.getDay(ds);
  d.checks["pre3:0"] = new Date(2026, 6, 17, 9, 14).getTime();
  const st = S.phaseStamp(ds, "pre3");
  ok(st.late, "09:14 는 09:00 구간을 넘김 — 사후 작성");
  eq(U.toHHMM(st.atMin), "09:14");
});
t("체크가 없으면 도장도 없다", () => {
  S.reset();
  const st = S.phaseStamp("2026-07-17", "pre3");
  eq(st.at, null);
  eq(st.late, false);
  eq(st.done, 0);
});
t("없는 구간은 null", () => {
  eq(S.phaseStamp("2026-07-17", "없는구간"), null);
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


/* ---------- 리서치 링크 인덱스 마이그레이션 ---------- */
t("예전 리서치 메모(body)는 지우지 않고 보존한다", () => {
  const old = Object.assign(S.defaults(), {
    research: [{ id: "rs1", ticker: "005930", name: "삼성전자", body: "## 무엇을 하는 회사인가\n반도체", date: "2026-10-01" }],
  });
  const fixed = S.migrate(old);
  const r = fixed.research[0];
  eq(r.ticker, "005930");
  eq(r.sector, "", "새 필드는 빈 값으로 생긴다");
  eq(r.url, "");
  eq(r.note, "");
  ok(r.body.includes("반도체"), "예전 메모 보존");
  eq(r.updated, "2026-10-01", "updated 없으면 date 를 쓴다");
});
t("id 없는 리서치 항목도 복구된다", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), { research: [{ name: "SK하이닉스" }] }));
  ok(fixed.research[0].id, "id 생성");
  eq(fixed.research[0].name, "SK하이닉스");
});


/* ---------- 외부 기록 링크 (이름까지 편집) ---------- */
t("기본 링크 5개, 3층 노트만 날짜별", () => {
  S.load();
  const l = S.links();
  eq(l.length, 5);
  eq(l.map((e) => e.label), ["2층 시트", "3층 노트", "노트 DB", "1층 규칙", "매매일지"]);
  eq(l.filter((e) => e.daily).map((e) => e.id), ["note"], "날짜별은 3층 노트 하나");
});
t("예전 객체형 {sheet,notes,rules} 을 목록으로 올린다", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { links: { sheet: "https://sheet", rules: "https://rules" } },
  }));
  ok(Array.isArray(fixed.settings.links), "목록형이 된다");
  const by = {};
  fixed.settings.links.forEach((e) => (by[e.id] = e.url));
  eq(by.sheet, "https://sheet", "URL 보존");
  eq(by.rules, "https://rules");
  eq(by.notes, "", "없던 건 빈 값");
});
t("이름은 20자로 자르고 빈 이름은 보정", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { links: [{ id: "x", label: "가".repeat(40), url: "" }, { id: "y", label: "" }] },
  }));
  eq(fixed.settings.links[0].label.length, 20);
  eq(fixed.settings.links[1].label, "링크");
});
t("linkUrl — 전역은 entry.url, 날짜별은 day.links[id]", () => {
  S.reset();
  const ds = "2026-07-17";
  const sheet = S.linkById("sheet"), note = S.linkById("note");
  S.setLinkUrl(ds, sheet, "https://sheet");
  S.setLinkUrl(ds, note, "https://note-0717");
  eq(S.linkUrl(ds, sheet), "https://sheet");
  eq(S.linkUrl(ds, note), "https://note-0717");
  eq(S.linkUrl("2026-07-18", sheet), "https://sheet", "전역은 날짜와 무관");
  eq(S.linkUrl("2026-07-18", note), "", "날짜별은 그날만");
});
t("이름을 바꿔도 링크는 유지된다", () => {
  S.reset();
  const e = S.linkById("sheet");
  S.setLinkUrl("2026-07-17", e, "https://keep");
  e.label = "내 매매시트";
  eq(S.linkById("sheet").label, "내 매매시트");
  eq(S.linkUrl("2026-07-17", S.linkById("sheet")), "https://keep");
});


/* ---------- 링크 아이콘 · 바로가기 ---------- */
t("기본 아이콘과 바로가기 구성", () => {
  S.load();
  const by = {};
  S.links().forEach((e) => (by[e.id] = e));
  eq(by.sheet.icon, "📊");
  eq(by.journal.icon, "📒");
  eq(S.links().filter((e) => e.quick).map((e) => e.id), ["notes", "rules", "journal"],
     "노트DB·규칙·매매일지는 바로가기 버튼");
  eq(by.sheet.quick, false);
  eq(by.note.quick, false, "날짜별 항목은 주소칸이 필요하므로 바로가기 아님");
});
t("아이콘 없는 예전 데이터는 기본 아이콘으로 복구", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { links: [{ id: "journal", label: "매매일지", url: "https://j" }] },
  }));
  eq(fixed.settings.links[0].icon, "📒", "기본값에서 아이콘을 가져온다");
  eq(fixed.settings.links[0].quick, true, "quick 기본값도 가져온다");
  eq(fixed.settings.links[0].url, "https://j");
});
t("모르는 id 는 기본 아이콘 🔗 / 일반 행", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { links: [{ id: "custom", label: "내 링크", url: "" }] },
  }));
  eq(fixed.settings.links[0].icon, "🔗");
  eq(fixed.settings.links[0].quick, false);
});
t("아이콘은 4자로 자른다", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { links: [{ id: "x", label: "a", icon: "📊📊📊📊📊", url: "" }] },
  }));
  ok(fixed.settings.links[0].icon.length <= 4);
});


/* ---------- 구간 항목 배분 시간 ---------- */
t("기본 배분이 구간 길이와 정확히 맞는다", () => {
  S.load();
  S.phases().filter((p) => !p.readonly && p.items.length).forEach((p) => {
    const b = S.phaseBudget(p);
    eq(b.alloc, b.len, `${p.name} 배분`);
    ok(!b.over, `${p.name} 초과 아님`);
  });
});
t("장중 구간은 배분 0 (타이머 없음)", () => {
  ["obs", "exec", "hold", "close"].forEach((id) => {
    eq(S.phaseBudget(S.phaseById(id)).alloc, 0, id);
  });
});
t("배분이 구간보다 길면 over", () => {
  S.load();
  const p = S.state.settings.routine.phases.find((x) => x.id === "pre2");
  p.items[0].min = 999;
  const b = S.phaseBudget(S.phaseById("pre2"));
  ok(b.over, "초과 감지");
  ok(b.alloc > b.len);
});
t("예전 문자열 항목을 {text,min} 으로 올린다", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { routine: { enabled: true, phases: [
      { id: "pre1", name: "a", start: "07:00", end: "08:00", mode: "input", catId: "market",
        items: ["문자열 항목", "또 다른 항목"] },
    ] } },
  }));
  const items = fixed.settings.routine.phases[0].items;
  eq(items.length, 2);
  eq(items[0], { text: "문자열 항목", min: 0 }, "문자열 → 객체, 배분은 0");
  eq(S.phaseBudget({ items, startMin: 420, endMin: 480 }).alloc, 0);
});
t("빈 항목과 이상한 min 은 보정", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { routine: { enabled: true, phases: [
      { id: "x", name: "a", start: "07:00", end: "08:00", mode: "input", catId: "market",
        items: [{ text: "정상", min: "12.6" }, { text: "", min: 5 }, { text: "음수", min: -3 }] },
    ] } },
  }));
  const items = fixed.settings.routine.phases[0].items;
  eq(items.length, 2, "빈 텍스트 항목은 버린다");
  eq(items[0].min, 13, "문자열 숫자는 반올림");
  eq(items[1].min, 0, "음수는 0");
});


/* ---------- 카테고리 대분류 · 생산 시간 ---------- */
t("기본 카테고리의 대분류 배치", () => {
  S.load();
  const by = {};
  S.state.categories.forEach((c) => (by[c.id] = c.group));
  eq(by.study, "invest"); eq(by.research, "invest"); eq(by.market, "invest");
  eq(by.read, "invest", "독서는 대부분 투자 서적 → 투자공부");
  eq(by.trade, "exec");
  eq(by.english, "growth"); eq(by.japanese, "growth"); eq(by.read2, "growth");
  const nameOf = (id) => S.state.categories.find((c) => c.id === id).name;
  eq(nameOf("read"), "투자독서"); eq(nameOf("read2"), "독서");
  eq(by.exercise, "body");
  eq(by.routine, "life"); eq(by.rest, "rest");
});
t("생산 집계 대상은 투자공부·매매·자기계발·운동", () => {
  eq(S.CAT_GROUPS.filter((g) => g.productive).map((g) => g.id), ["invest", "exec", "growth", "body"]);
  eq(S.CAT_GROUPS.filter((g) => !g.productive).map((g) => g.id), ["life", "rest"]);
});
t("minutesByGroup / productiveMin", () => {
  S.reset();
  const d = S.getDay("2026-07-17");
  const put = (cat, n) => { for (let i = 0; i < n; i++) d.done[U.toHHMM(9 * 60 + Object.keys(d.done).length * 10)] = { c: cat, t: "" }; };
  put("study", 6);     // 투자공부 60분
  put("english", 3);   // 자기계발 30분
  put("japanese", 3);  // 자기계발 30분
  put("exercise", 3);  // 운동 30분
  put("rest", 6);      // 휴식 60분
  eq(S.minutesByGroup("2026-07-17", "done"), { invest: 60, growth: 60, body: 30, rest: 60 });
  eq(S.productiveMin("2026-07-17", "done"), 150, "휴식 60분은 빠진다");
  eq(S.groupMin("2026-07-17", "growth", "done"), 60, "영어+일본어");
  eq(S.studyMin("2026-07-17", "done"), 60, "학습시간은 투자공부만");
});
t("예전 study 플래그를 대분류로 올린다", () => {
  const fixed = S.migrate(Object.assign(S.defaults(), {
    settings: { dayStartHour: 7 },          // seed 가 없는 옛 저장본
    categories: [
      { id: "study", name: "주식공부", color: "#fff", study: true },
      { id: "custom1", name: "내 공부", color: "#fff", study: true },
      { id: "custom2", name: "딴짓", color: "#fff", study: false },
    ],
  }));
  const by = {};
  fixed.categories.forEach((c) => (by[c.id] = c.group));
  eq(by.study, "invest", "알려진 id 는 기본 배치를 따른다");
  eq(by.custom1, "invest", "study:true 커스텀 → 투자공부");
  eq(by.custom2, "life", "study:false 커스텀 → 생활");
  ok(fixed.categories.some((c) => c.id === "english"), "영어 카테고리가 보강된다");
  ok(fixed.categories.some((c) => c.id === "japanese"), "일본어도");
  ok(fixed.categories.some((c) => c.id === "read2"), "일반독서도");
});

/* ---------- 기본값 보강(SEED) ---------- */
t("seed 가 최신이면 지운 기본 카테고리를 되살리지 않는다", () => {
  const d = S.defaults();
  const once = S.migrate(Object.assign(d, {
    settings: { seed: 3 },
    categories: [{ id: "study", name: "주식공부", color: "#fff", group: "invest" }],
  }));
  eq(once.categories.length, 1, "되살아나지 않음");
});
t("seed 필드가 아예 없던 저장본도 정정된다", () => {
  const d0 = S.defaults();
  const none = S.migrate(Object.assign(d0, {
    settings: { dayStartHour: 7 },                                   // seed 없음 = 현재 배포본
    categories: [{ id: "read", name: "독서", color: "#fff", group: "growth" }],
  }));
  const byN = {};
  none.categories.forEach((c) => (byN[c.id] = c.group));
  eq(byN.read, "invest", "독서 정정");
  eq(byN.read2, "growth", "일반독서 추가");
  eq(none.settings.seed, 3);
});
t("seed 1 → 2 업그레이드: 일반독서 추가 + 독서 대분류 정정", () => {
  const d = S.defaults();
  const old = S.migrate(Object.assign(d, {
    settings: { seed: 1 },
    categories: [
      { id: "study", name: "주식공부", color: "#fff", group: "invest" },
      { id: "read",  name: "독서",    color: "#fff", group: "growth" },  // seed1 마이그레이션 산물
    ],
  }));
  const by = {};
  old.categories.forEach((c) => (by[c.id] = c.group));
  eq(by.read, "invest", "독서는 투자공부로 정정");
  eq(by.read2, "growth", "일반독서가 추가됨");
  eq(old.settings.seed, 3, "seed 가 올라간다");
});
t("seed 보강은 두 번 돌지 않는다", () => {
  const d = S.defaults();
  const first = S.migrate(Object.assign(d, {
    settings: { seed: 1 },
    categories: [{ id: "read", name: "독서", color: "#fff", group: "growth" }],
  }));
  first.categories = first.categories.filter((c) => c.id !== "read2");   // 사용자가 일반독서를 지움
  const second = S.migrate(first);
  ok(!second.categories.some((c) => c.id === "read2"), "다시 추가되지 않는다");
});
t("기본 할일 그룹에 일본어가 있다", () => {
  S.load();
  ok(S.state.projects.some((p) => p.name === "일본어"), "일본어 그룹");
  ok(S.state.projects.some((p) => p.name === "영어공부"), "영어공부 그룹");
});


t("seed 3: 독서 이름 정리", () => {
  const d = S.defaults();
  const up = S.migrate(Object.assign(d, {
    settings: { seed: 2 },
    categories: [
      { id: "read",  name: "독서",     color: "#fff", group: "invest" },
      { id: "read2", name: "일반독서", color: "#fff", group: "growth" },
    ],
  }));
  const by = {};
  up.categories.forEach((c) => (by[c.id] = { name: c.name, group: c.group }));
  eq(by.read, { name: "투자독서", group: "invest" });
  eq(by.read2, { name: "독서", group: "growth" });
});
t("직접 고친 이름은 건드리지 않는다", () => {
  const d = S.defaults();
  const up = S.migrate(Object.assign(d, {
    settings: { seed: 2 },
    categories: [
      { id: "read",  name: "투자서적", color: "#fff", group: "invest" },
      { id: "read2", name: "소설",    color: "#fff", group: "growth" },
    ],
  }));
  const by = {};
  up.categories.forEach((c) => (by[c.id] = c.name));
  eq(by.read, "투자서적", "사용자 이름 보존");
  eq(by.read2, "소설");
});

/* ---------- 결과 ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
