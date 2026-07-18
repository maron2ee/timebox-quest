/* ===========================================================
   state.js — data model, persistence, date utils, derived stats
   Exposes: window.App.{state, store, util, stats, CONST}
   Offline-first: everything lives in localStorage.
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  const STORAGE_KEY = "timeboxQuest.v1";
  const SCHEMA_VERSION = 5;

  // retro (PICO-8-ish) palette — reads cohesive on the navy theme
  const PALETTE = [
    "#ffec27", "#ffa300", "#ff004d", "#ff77a8", "#ff6fd8", "#c77dff",
    "#7c83ff", "#29adff", "#00c2d4", "#2fd3b6", "#00e436", "#a0e85b",
  ];

  App.CONST = { STORAGE_KEY, SCHEMA_VERSION, PALETTE };

  /* ---------- default seed ---------- */
  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      updatedAt: Date.now(),
      settings: {
        dayStartHour: 6,
        dayEndHour: 24,
        slotMinutes: 15,
        completionTarget: 70, // % for a "win" day
        sound: false,
        weekStart: 1,   // 1=Monday, 0=Sunday
        lastBackup: 0,  // ts of last JSON export
        compact: false, // denser planner rows
        pixel: true,    // retro pixel skin
        skin: "default", // modern UI skin (applies when pixel is off): default|soft|glass|pastel|editorial
        autoTemplate: false, // auto-apply weekday template to empty today/future days
        seenTip: false, // shown the first-run usage tip
        reminderEnabled: false,    // daily reminder
        reminderTime: "21:00",
        reminderLastShown: "",     // ymd of last reminder fired
        pomoFocus: 25,             // 뽀모도로 집중 길이(분)
        pomoBreak: 5,              // 짧은 휴식(분)
        pomoLongBreak: 15,         // 긴 휴식(분, 4세션마다)
        pomoAutofill: true,        // 집중 완료 시 타임박스 자동 반영
        pomoCat: null,             // 마지막으로 고른 뽀모도로 카테고리
        focusCat: null,            // 성과 탭 "집중 시간 추이"에서 볼 카테고리 (기본 주식공부)
      },
      categories: [
        { id: cid(), name: "주식공부", emoji: "📈", color: "#ffec27", target: 120 },
        { id: cid(), name: "운동", emoji: "💪", color: "#ff004d", target: 60 },
        { id: cid(), name: "언어공부", emoji: "🗣️", color: "#29adff", target: 60 },
        { id: cid(), name: "독서", emoji: "📖", color: "#00e436", target: 30 },
        { id: cid(), name: "리서치", emoji: "🔍", color: "#c77dff", target: 0 },
        { id: cid(), name: "휴식", emoji: "☕", color: "#ffa300", target: 0 },
      ],
      days: {}, // 'YYYY-MM-DD' -> { blocks: { 'HH:MM': {categoryId, note, done, actual} } }
      templates: {}, // weekday(0-6) -> { 'HH:MM': {categoryId, note} }
      game: gameDefaults(),
    };
  }

  function newPet(name) {
    return { id: cid(), species: null, name: name || "퀘스토", equip: { hat: null, hand: null }, fed: 0, lastFed: 0 };
  }
  function gameDefaults() {
    const p = newPet("머니몽키");
    p.species = "monkey"; // 기본 캐릭터 = 머니몽키 🐵
    return { xp: 0, achievements: [], lastStage: 0, theme: "navy", pets: [p], activePet: p.id };
  }
  App.newPet = newPet;

  function cid() {
    return "c" + Math.random().toString(36).slice(2, 9);
  }
  App.cid = cid;

  /* ---------- persistence ---------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) {
      console.warn("load failed, using defaults", e);
      return defaultState();
    }
  }

  function migrate(s) {
    if (!s || typeof s !== "object") return defaultState();
    const fromV = s.version || 1;
    s.settings = Object.assign(defaultState().settings, s.settings || {});
    if (fromV < 2) s.settings.slotMinutes = 15; // v2: switch to 15-min blocks
    s.version = SCHEMA_VERSION;
    if (!Array.isArray(s.categories) || !s.categories.length)
      s.categories = defaultState().categories;
    s.days = s.days || {};
    s.templates = s.templates && typeof s.templates === "object" ? s.templates : {};
    s.game = migrateGame(s.game || {});
    if (fromV < 4) s.game.theme = "navy"; // v4: dark navy background by default
    if (fromV < 5) {
      // v5: refresh untouched default category colors to the retro palette
      const RECOLOR = {
        "주식공부": ["#5ef08a", "#ffec27"], "운동": ["#ff7ec8", "#ff004d"],
        "언어공부": ["#57e6ff", "#29adff"], "독서": ["#ffd45e", "#00e436"],
        "리서치": ["#b388ff", "#c77dff"], "휴식": ["#ff9d4d", "#ffa300"],
      };
      s.categories.forEach((c) => {
        const r = RECOLOR[c.name];
        if (r && c.color && c.color.toLowerCase() === r[0].toLowerCase()) c.color = r[1];
      });
    }
    return s;
  }

  // Build the pets/theme game shape, migrating older single-character data.
  function migrateGame(g) {
    const ng = {
      xp: g.xp || 0,
      achievements: Array.isArray(g.achievements) ? g.achievements : [],
      lastStage: g.lastStage || 0,
      theme: g.theme || "navy",
      pets: null,
      activePet: g.activePet || null,
    };
    if (Array.isArray(g.pets) && g.pets.length) {
      ng.pets = g.pets;
    } else {
      // older flat fields -> first pet
      ng.pets = [{
        id: cid(),
        species: g.species != null ? g.species : null,
        name: g.charName || "퀘스토",
        equip: g.equip && typeof g.equip === "object" ? g.equip : { hat: null, hand: null },
        fed: g.fed || 0,
      }];
      ng.activePet = ng.pets[0].id;
    }
    ng.pets.forEach((p) => {
      if (!p.id) p.id = cid();
      if (!p.name) p.name = "퀘스토";
      if (p.species === undefined) p.species = null;
      if (!p.equip || typeof p.equip !== "object") p.equip = { hat: null, hand: null };
      if (p.fed == null) p.fed = 0;
      if (p.lastFed == null) p.lastFed = 0;
    });
    if (!ng.activePet || !ng.pets.some((p) => p.id === ng.activePet)) ng.activePet = ng.pets[0].id;
    return ng;
  }

  let saveTimer = null;
  let onChange = null;

  function save(touch = true) {
    if (touch) state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("save failed", e);
    }
    if (onChange) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => onChange(state), 250);
    }
  }

  function replaceState(next) {
    state = migrate(next);
    App.state = state;
    save(false);
  }

  App.state = state;
  App.store = {
    get: () => state,
    save,
    replaceState,
    onChange: (fn) => (onChange = fn),
    reset: () => {
      state = defaultState();
      App.state = state;
      save();
    },
    raw: () => JSON.stringify(state, null, 2),
  };

  /* ---------- date utils ---------- */
  const KDOW = ["일", "월", "화", "수", "목", "금", "토"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseYmd(s) { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); }
  function today() { return ymd(new Date()); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) {
    const x = new Date(d);
    const ws = (App.state && App.state.settings && App.state.settings.weekStart) || 0; // 1=Mon, 0=Sun
    const wd = (x.getDay() - ws + 7) % 7;
    return addDays(x, -wd);
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function sameYmd(a, b) { return ymd(a) === ymd(b); }

  function fmtDayTitle(dateStr) {
    const d = parseYmd(dateStr);
    const t = today();
    if (dateStr === t) return "오늘";
    if (dateStr === ymd(addDays(new Date(), -1))) return "어제";
    if (dateStr === ymd(addDays(new Date(), 1))) return "내일";
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  function fmtDaySub(dateStr) {
    const d = parseYmd(dateStr);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${KDOW[d.getDay()]})`;
  }

  // slot times for a day, e.g. ["06:00","06:30",...]
  function slotsFor(settings) {
    const { dayStartHour, dayEndHour, slotMinutes } = settings;
    const out = [];
    let total = dayStartHour * 60;
    const end = dayEndHour * 60;
    while (total < end) {
      out.push({ time: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`, onHour: total % 60 === 0 });
      total += slotMinutes;
    }
    return out;
  }

  // readable ink/white text for a given background color (relative luminance)
  function textOn(hex) {
    const h = String(hex).replace("#", "");
    if (h.length < 6) return "#2c2545";
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.55 ? "#2c2545" : "#ffffff";
  }

  App.util = {
    KDOW, pad, ymd, parseYmd, today, addDays, startOfWeek,
    startOfMonth, endOfMonth, sameYmd, fmtDayTitle, fmtDaySub, slotsFor, textOn,
    minToH: (m) => (m % 60 === 0 ? `${m / 60}h` : `${(m / 60).toFixed(1)}h`),
  };

  /* ---------- category helpers ---------- */
  function catById(id) { return state.categories.find((c) => c.id === id) || null; }
  App.catById = catById;

  /* ---------- derived stats ---------- */
  function dayBlocks(dateStr) {
    const d = state.days[dateStr];
    return d && d.blocks ? d.blocks : {};
  }

  function deriveDay(dateStr) {
    const blocks = dayBlocks(dateStr);
    const slotMin = state.settings.slotMinutes;
    let planned = 0, done = 0;
    const perCat = {};
    for (const time in blocks) {
      const b = blocks[time];
      if (!b || !b.categoryId) continue;
      planned++;
      const pc = b.categoryId;             // planned category
      const dc = b.actual || b.categoryId; // actual category (credited when done)
      if (!perCat[pc]) perCat[pc] = { planned: 0, done: 0 };
      perCat[pc].planned++;
      if (b.done) {
        done++;
        if (!perCat[dc]) perCat[dc] = { planned: 0, done: 0 };
        perCat[dc].done++;
      }
    }
    return {
      plannedBlocks: planned,
      doneBlocks: done,
      plannedMin: planned * slotMin,
      doneMin: done * slotMin,
      pct: planned ? Math.round((done / planned) * 100) : 0,
      perCat, // catId -> {planned, done} (in blocks)
      isWin: planned > 0 && Math.round((done / planned) * 100) >= state.settings.completionTarget,
    };
  }

  // inclusive range [startStr, endStr]
  function deriveRange(startStr, endStr) {
    const slotMin = state.settings.slotMinutes;
    let cur = parseYmd(startStr);
    const end = parseYmd(endStr);
    const perDay = [];
    const perCat = {}; // catId -> {plannedMin, doneMin}
    let plannedMin = 0, doneMin = 0, winDays = 0, activeDays = 0;
    while (cur <= end) {
      const ds = ymd(cur);
      const d = deriveDay(ds);
      perDay.push({ date: ds, pct: d.pct, plannedMin: d.plannedMin, doneMin: d.doneMin, isWin: d.isWin });
      plannedMin += d.plannedMin;
      doneMin += d.doneMin;
      if (d.plannedBlocks > 0) activeDays++;
      if (d.isWin) winDays++;
      for (const catId in d.perCat) {
        if (!perCat[catId]) perCat[catId] = { plannedMin: 0, doneMin: 0 };
        perCat[catId].plannedMin += d.perCat[catId].planned * slotMin;
        perCat[catId].doneMin += d.perCat[catId].done * slotMin;
      }
      cur = addDays(cur, 1);
    }
    return {
      perDay, perCat, plannedMin, doneMin, winDays, activeDays,
      pct: plannedMin ? Math.round((doneMin / plannedMin) * 100) : 0,
    };
  }

  // streak: consecutive win-days ending today.
  // Today is allowed to be "in progress": if today isn't a win yet, we start
  // counting from yesterday so an ongoing streak still shows.
  function currentStreak() {
    let n = 0;
    let cur = new Date();
    if (!deriveDay(ymd(cur)).isWin) cur = addDays(cur, -1);
    for (let i = 0; i < 400; i++) {
      if (deriveDay(ymd(cur)).isWin) { n++; cur = addDays(cur, -1); }
      else break;
    }
    return n;
  }

  function totalDoneMinutes() {
    let m = 0;
    const slotMin = state.settings.slotMinutes;
    for (const ds in state.days) {
      const blocks = state.days[ds].blocks || {};
      for (const t in blocks) if (blocks[t] && blocks[t].done) m += slotMin;
    }
    return m;
  }

  function totalDoneBlocks() {
    let n = 0;
    for (const ds in state.days) {
      const blocks = state.days[ds].blocks || {};
      for (const t in blocks) if (blocks[t] && blocks[t].done) n++;
    }
    return n;
  }

  // per-day done/planned minutes for one category over [startStr, endStr] (inclusive)
  function categorySeries(catId, startStr, endStr) {
    const slotMin = state.settings.slotMinutes;
    let cur = parseYmd(startStr);
    const end = parseYmd(endStr);
    const out = [];
    while (cur <= end) {
      const ds = ymd(cur);
      const pc = deriveDay(ds).perCat[catId];
      out.push({ date: ds, doneMin: pc ? pc.done * slotMin : 0, plannedMin: pc ? pc.planned * slotMin : 0 });
      cur = addDays(cur, 1);
    }
    return out;
  }

  // categoryId of the block scheduled for "right now" today (null if none planned)
  function currentCategory() {
    const ds = today();
    const blocks = dayBlocks(ds);
    const slots = slotsFor(state.settings);
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    let best = null;
    for (const s of slots) {
      const [h, m] = s.time.split(":").map(Number);
      if (h * 60 + m <= mins) best = s.time; else break;
    }
    const b = best && blocks[best];
    return b ? b.categoryId : null;
  }

  App.stats = {
    deriveDay, deriveRange, currentStreak, totalDoneMinutes, totalDoneBlocks, dayBlocks, currentCategory, categorySeries,
  };
})();
