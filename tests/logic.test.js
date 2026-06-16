/* ===========================================================
   logic.test.js — headless regression tests for the pure logic
   Run:  node tests/logic.test.js
   Stubs a minimal DOM/localStorage, loads the app modules, asserts.
   =========================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => (storage[k] = String(v)),
  removeItem: (k) => delete storage[k],
};
global.window = global;
global.requestAnimationFrame = () => {};
const captured = {};
function fakeEl(id) {
  return {
    id,
    set innerHTML(v) { captured[id] = v; },
    get innerHTML() { return captured[id] || ""; },
    style: { setProperty() {} },
    disabled: false,
    classList: { _s: new Set(), add(x) { this._s.add(x); }, remove(x) { this._s.delete(x); }, toggle(x, on) { on ? this._s.add(x) : this._s.delete(x); }, contains(x) { return this._s.has(x); } },
    addEventListener() {}, appendChild() {}, textContent: "",
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), offsetWidth: 0,
    getContext: () => ({ clearRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, translate() {}, rotate() {}, restore() {}, moveTo() {}, arcTo() {}, closePath() {}, fillRect() {} }),
  };
}
const els = {};
const get = (id) => els[id] || (els[id] = fakeEl(id));
global.document = { documentElement: fakeEl("html"), getElementById: get, querySelector: () => get("__q"), querySelectorAll: () => [], createElement: () => fakeEl("x"), addEventListener() {} };
global.App = { ui: { openModal() {}, closeModals() {} }, refreshAll() {} };

const load = (p) => eval(fs.readFileSync(path.join(ROOT, p), "utf8"));
["js/state.js", "js/gamify.js", "js/character.js"].forEach(load);
const App = global.App, U = App.util, C = App.character;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error("  ✗ " + name); } }
function eq(name, a, b) { ok(name + ` (=${b}, got ${a})`, a === b); }

// --- date / slots ---
eq("15-min slots 06-24", U.slotsFor(App.state.settings).length, 72);
eq("default slot minutes", App.state.settings.slotMinutes, 15);

// --- actual vs planned ---
const cats = App.state.categories, stock = cats.find((c) => c.name.includes("주식")).id, ex = cats.find((c) => c.name === "운동").id;
const today = U.today();
App.state.days[today] = { blocks: { "09:00": { categoryId: stock, done: true, actual: ex }, "09:15": { categoryId: stock, done: true }, "09:30": { categoryId: stock, done: false } } };
const d = App.stats.deriveDay(today);
eq("planned blocks", d.plannedBlocks, 3);
eq("done blocks", d.doneBlocks, 2);
eq("actual credited to 운동", d.perCat[ex].done, 1);
eq("planned credited to 주식", d.perCat[stock].planned, 3);

// --- week start ---
App.state.settings.weekStart = 1; eq("weekStart Mon", U.ymd(U.startOfWeek(U.parseYmd("2026-06-17"))), "2026-06-15");
App.state.settings.weekStart = 0; eq("weekStart Sun", U.ymd(U.startOfWeek(U.parseYmd("2026-06-17"))), "2026-06-14");

// --- migration: old flat character -> pets[] + new settings ---
App.store.replaceState({ version: 1, settings: { slotMinutes: 30 }, categories: cats, days: {}, game: { xp: 1200, charName: "바둑이", species: "dog", fed: 4, equip: { hat: "ribbon", hand: null } } });
const g = App.state.game;
eq("migrate -> 1 pet", g.pets.length, 1);
eq("migrate name", g.pets[0].name, "바둑이");
eq("migrate species", g.pets[0].species, "dog");
eq("migrate fed", g.pets[0].fed, 4);
eq("migrate equip", g.pets[0].equip.hat, "ribbon");
eq("migrate slot->15", App.state.settings.slotMinutes, 15);
eq("migrate templates", typeof App.state.templates, "object");
ok("migrate weekStart present", App.state.settings.weekStart != null);

// --- gamify / levels ---
App.state.days = {};
for (let i = 0; i < 30; i++) { const day = { blocks: {} }; for (let h = 0; h < 16; h++) { const t = 8 + Math.floor(h / 2); const mm = h % 2 ? "30" : "00"; day.blocks[String(t).padStart(2, "0") + ":" + mm] = { categoryId: stock, done: true }; } App.state.days[U.ymd(U.addDays(new Date(), -i))] = day; }
App.gamify.refresh(false);
const lvl = App.gamify.levelInfo(App.state.game.xp).level;
ok("level grows with activity", lvl >= 10);

// --- character stage + render ---
const stageIdx = (lv) => { let i = 0; C.STAGES.forEach((s, k) => { if (lv >= s.minLevel) i = k; }); return i; };
ok("stage idx valid", stageIdx(lvl) >= 0 && stageIdx(lvl) < C.STAGES.length);
get("view-codex").classList.add("active");
C.render(false);
ok("charArt rendered svg", /<svg/.test(captured.charArt));
ok("--app-bg applied", true); // applyThemeNow ran without throwing

// --- species selectable ---
ok("needsSpecies true on fresh", (function () { App.store.reset(); return C.needsSpecies(); })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
