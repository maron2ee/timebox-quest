/* ===========================================================
   character.js — cute mascot you raise.
   Evolves by level, reacts to today's progress (mood),
   can be petted & fed, unlocks decorations, has a 도감 (codex).
   Exposes: window.App.character
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  /* ---------- evolution stages ---------- */
  const STAGES = [
    { name: "알",       minLevel: 1,  color: "#ffe6a8", desc: "이제 막 태어나려 해요" },
    { name: "새싹이",   minLevel: 2,  color: "#2fe07a", desc: "쑥쑥 자라는 중!" },
    { name: "꼬마",     minLevel: 4,  color: "#21d9d9", desc: "호기심 가득한 꼬마" },
    { name: "주린이",   minLevel: 7,  color: "#48a0ff", desc: "차트를 배우기 시작했어요" },
    { name: "트레이더", minLevel: 11, color: "#a06bff", desc: "제법 트레이더 티가 나요" },
    { name: "마스터",   minLevel: 16, color: "#ffcf2e", desc: "전설의 투자 마스터!" },
  ];

  /* ---------- decorations (cosmetic, unlockable) ---------- */
  const DECOS = [
    { id: "balloon",  name: "풍선",     emoji: "🎈", slot: "hand", cond: { blocks: 1 },     hint: "첫 칸 완료" },
    { id: "ribbon",   name: "리본",     emoji: "🎀", slot: "hat",  cond: { level: 2 },      hint: "Lv.2 달성" },
    { id: "cap",      name: "야구모자", emoji: "🧢", slot: "hat",  cond: { fed: 5 },        hint: "밥 5번 주기" },
    { id: "coffee",   name: "커피",     emoji: "☕", slot: "hand", cond: { hours: 10 },     hint: "누적 10시간 실천" },
    { id: "headphone",name: "헤드폰",   emoji: "🎧", slot: "hat",  cond: { streak: 3 },     hint: "3일 연속 달성" },
    { id: "grad",     name: "학사모",   emoji: "🎓", slot: "hat",  cond: { level: 5 },      hint: "Lv.5 달성" },
    { id: "moneybag", name: "돈자루",   emoji: "💰", slot: "hand", cond: { stockHours: 5 }, hint: "주식공부 5시간" },
    { id: "candy",    name: "막대사탕", emoji: "🍭", slot: "hand", cond: { fed: 15 },       hint: "밥 15번 주기" },
    { id: "star",     name: "별모자",   emoji: "🌟", slot: "hat",  cond: { streak: 7 },     hint: "7일 연속 달성" },
    { id: "crownDeco",name: "왕관",     emoji: "👑", slot: "hat",  cond: { level: 12 },     hint: "Lv.12 달성" },
    { id: "chart",    name: "차트판",   emoji: "📈", slot: "hand", cond: { hours: 30 },     hint: "누적 30시간 실천" },
    { id: "trophy",   name: "트로피",   emoji: "🏆", slot: "hand", cond: { streak: 14 },    hint: "14일 연속 달성" },
  ];

  const xpAt = (L) => 50 * L * (L - 1); // cumulative XP to reach level L

  function stageForLevel(level) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) if (level >= STAGES[i].minLevel) idx = i;
    return idx;
  }

  /* ---------- pets / snacks / affection ---------- */
  const PET_LEVELS = [1, 5, 12, 20]; // levels that unlock a new pet slot

  function game() { return App.state.game; }
  function pets() { return game().pets || []; }
  function activePet() { return pets().find((p) => p.id === game().activePet) || pets()[0]; }
  function maxPets(level) { return PET_LEVELS.filter((l) => level >= l).length; }
  function totalFed() { return pets().reduce((a, p) => a + (p.fed || 0), 0); }
  function snacksEarned() { return App.stats.totalDoneBlocks(); } // 1 per completed block
  function snacksLeft() { return Math.max(0, snacksEarned() - totalFed()); }
  function affection() { const p = activePet(); return p ? p.fed || 0 : 0; }

  /* ---------- background themes (unlockable) ---------- */
  const NAVY_BG =
    "radial-gradient(1200px 600px at 80% -10%, #1b2c70 0%, transparent 60%)," +
    "radial-gradient(900px 520px at 0% 110%, #122252 0%, transparent 55%)," +
    "linear-gradient(180deg, #0e1840, #05071c)";
  const TAMA_BG =
    "radial-gradient(rgba(255,255,255,.5) 1.4px, transparent 1.5px) 0 0/22px 22px," +
    "radial-gradient(880px 600px at 12% -10%, #ffd6ec 0%, transparent 55%)," +
    "radial-gradient(820px 560px at 104% 0%, #cdebff 0%, transparent 52%)," +
    "radial-gradient(760px 700px at 50% 122%, #d7f3df 0%, transparent 55%)," +
    "linear-gradient(180deg,#eef4ea,#e6eefb)";
  const THEMES = [
    { id: "navy",   name: "한밤의 트레이더", cond: null,             hint: "기본 제공", bg: NAVY_BG },
    { id: "tama",   name: "타마 파스텔",     cond: null,             hint: "기본 제공", bg: TAMA_BG },
    { id: "sunset", name: "노을",           cond: { level: 3 },     hint: "Lv.3 달성", bg: "radial-gradient(700px 500px at 10% -6%, rgba(255,94,142,.5),transparent 56%),radial-gradient(700px 480px at 100% 4%, rgba(255,160,60,.42),transparent 55%),linear-gradient(180deg,#3a1840,#1a0d26)" },
    { id: "ocean",  name: "딥오션",         cond: { streak: 5 },    hint: "5일 연속", bg: "radial-gradient(720px 480px at 8% -8%, rgba(0,209,180,.42),transparent 58%),radial-gradient(700px 460px at 104% 4%, rgba(0,140,255,.4),transparent 56%),linear-gradient(180deg,#082b4a,#04141f)" },
    { id: "sakura", name: "벚꽃밤",         cond: { level: 6 },     hint: "Lv.6 달성", bg: "radial-gradient(700px 480px at 12% -6%, rgba(255,140,200,.5),transparent 56%),radial-gradient(680px 460px at 100% 6%, rgba(180,120,255,.4),transparent 55%),linear-gradient(180deg,#3a1530,#1c0e24)" },
    { id: "forest", name: "포레스트",       cond: { hours: 20 },    hint: "누적 20시간", bg: "radial-gradient(700px 480px at 8% -8%, rgba(40,210,120,.4),transparent 58%),radial-gradient(700px 460px at 104% 6%, rgba(0,180,160,.36),transparent 55%),linear-gradient(180deg,#0e3324,#06170f)" },
    { id: "galaxy", name: "갤럭시",         cond: { level: 10 },    hint: "Lv.10 달성", bg: "radial-gradient(640px 460px at 12% -6%, rgba(150,80,255,.5),transparent 56%),radial-gradient(620px 440px at 100% 8%, rgba(0,200,255,.34),transparent 55%),radial-gradient(700px 600px at 50% 120%, rgba(255,80,200,.28),transparent 60%),linear-gradient(180deg,#16092e,#05030f)" },
    { id: "gold",   name: "골드나이트",     cond: { level: 14 },    hint: "Lv.14 달성", bg: "radial-gradient(700px 480px at 10% -6%, rgba(255,205,40,.4),transparent 56%),radial-gradient(680px 460px at 102% 6%, rgba(255,140,40,.3),transparent 55%),linear-gradient(180deg,#2a2410,#120f06)" },
    { id: "candy",  name: "캔디팝",         cond: { fed: 20 },      hint: "밥 20번 주기", bg: "radial-gradient(700px 480px at 8% -6%, rgba(255,60,170,.5),transparent 56%),radial-gradient(700px 460px at 104% 6%, rgba(150,80,255,.42),transparent 55%),linear-gradient(180deg,#3a1038,#1a0820)" },
  ];
  // accent colors per theme: [primary, primary-d, primary-soft]
  const ACCENTS = {
    tama: ["#ff6f91", "#ec5578", "#ffe1ec"],
    navy: ["#ffce3a", "#e0a400", "#4a3a0a"], // navy theme = yellow accent

    sunset: ["#ff5e8e", "#e23b6d", "#ffe0ea"],
    ocean: ["#0098e8", "#0078c4", "#d6f1ff"],
    sakura: ["#ff5fa6", "#e84f93", "#ffe1ee"],
    forest: ["#10b557", "#0a9648", "#d7f7e4"],
    galaxy: ["#9b5cff", "#7a36e0", "#ece0ff"],
    gold: ["#ef8e00", "#cf7700", "#ffeccb"],
    candy: ["#ff2d8e", "#e01f76", "#ffd9ea"],
  };
  function applyThemeNow() {
    const t = THEMES.find((x) => x.id === game().theme) || THEMES[0];
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--app-bg", t.bg);
    const a = ACCENTS[t.id] || ACCENTS.navy;
    root.style.setProperty("--primary", a[0]);
    root.style.setProperty("--primary-d", a[1]);
    root.style.setProperty("--primary-soft", a[2]);
  }
  function applyTheme(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return;
    if (t.cond && !isUnlocked(t, unlockCtx())) return;
    game().theme = id;
    App.store.save();
    applyThemeNow();
    App.gamify.sfx.paint();
    if (isVisible("view-codex")) renderThemes();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- unlock context ---------- */
  function unlockCtx() {
    const ctx = App.gamify.context(); // {totalBlocks,bestStreak,maxStudyMin,...}
    const info = App.gamify.levelInfo(game().xp || 0);
    return {
      level: info.level,
      blocks: ctx.totalBlocks,
      streak: ctx.bestStreak,
      hours: App.stats.totalDoneMinutes() / 60,
      stockHours: ctx.maxStudyMin / 60,
      fed: totalFed(),
    };
  }
  function isUnlocked(d, ctx) {
    ctx = ctx || unlockCtx();
    const c = d.cond;
    if (c.level != null) return ctx.level >= c.level;
    if (c.blocks != null) return ctx.blocks >= c.blocks;
    if (c.streak != null) return ctx.streak >= c.streak;
    if (c.hours != null) return ctx.hours >= c.hours;
    if (c.stockHours != null) return ctx.stockHours >= c.stockHours;
    if (c.fed != null) return ctx.fed >= c.fed;
    return false;
  }

  /* ---------- fullness / hunger (decays over time, restored by feeding) ---------- */
  const HUNGER_PER_HOUR = 7;   // ~14h to empty
  const FEED_LIMIT = 95;       // can't feed past this (natural daily-ish limit)
  function nowMs() { return Date.now(); }
  function fullness(p) {
    p = p || activePet();
    if (!p) return 100;
    if (!p.lastFed) return 65; // never fed → a bit peckish
    const hrs = (nowMs() - p.lastFed) / 3600000;
    return Math.max(0, Math.min(100, Math.round(100 - hrs * HUNGER_PER_HOUR)));
  }

  /* ---------- mood (today's progress, overridden when very hungry) ---------- */
  function moodForPet(p) {
    if (fullness(p) < 25) return { mood: "sleepy", text: "배고파요… 밥 주세요! 🍖" };
    const d = App.stats.deriveDay(U.today());
    const streak = App.stats.currentStreak();
    if (d.plannedBlocks === 0) return { mood: "ok", text: "오늘의 퀘스트를 계획해 줘요! 🗓️" };
    if (d.doneBlocks === 0) return { mood: "sleepy", text: "아직 시작 전이에요… 같이 해봐요! 💤" };
    if (d.isWin) return { mood: "star", text: streak >= 3 ? `오늘도 최고! 🔥${streak}일 연속이에요!` : "오늘 목표 달성! 기분 최고예요! ✨" };
    return { mood: "happy", text: `잘하고 있어요! 목표까지 ${App.state.settings.completionTarget - d.pct}% 남았어요 💪` };
  }
  function moodInfo() { return moodForPet(activePet()); }

  /* ---------- current activity (what today's timebox says you're doing right now) ---------- */
  function currentActivityCat() {
    const id = App.stats.currentCategory && App.stats.currentCategory();
    return id ? App.catById(id) : null;
  }

  /* ---------- SVG ---------- */
  let uid = 0;

  function shade(hex, amt) {
    const h = hex.replace("#", "");
    let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const f = (x) => Math.max(0, Math.min(255, x + amt));
    return "#" + [f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  function face(mood) {
    const cheeks =
      '<ellipse cx="37" cy="85" rx="9" ry="6" fill="#ff5da2" opacity=".55"/>' +
      '<ellipse cx="83" cy="85" rx="9" ry="6" fill="#ff5da2" opacity=".55"/>';
    let eyes, mouth;
    if (mood === "happy") {
      eyes = '<path d="M40 76 q9 -12 18 0" stroke="#3a2b52" stroke-width="4.2" fill="none" stroke-linecap="round"/>' +
             '<path d="M62 76 q9 -12 18 0" stroke="#3a2b52" stroke-width="4.2" fill="none" stroke-linecap="round"/>';
    } else if (mood === "sleepy") {
      eyes = '<path d="M41 76 q8 6 16 0" stroke="#3a2b52" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
             '<path d="M63 76 q8 6 16 0" stroke="#3a2b52" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
             '<text x="85" y="55" font-size="12" fill="#9a93c4">z</text>';
    } else if (mood === "star") {
      const st = (cx) => `<path d="M${cx} 62 l2.1 5.6 5.9.4 -4.6 3.9 1.5 5.7 -4.9 -3.2 -4.9 3.2 1.5 -5.7 -4.6 -3.9 5.9 -.4z" fill="#ffd21f" stroke="#f5a800" stroke-width="1"/>`;
      eyes = st(49) + st(71);
    } else {
      // big sparkly kawaii eyes
      eyes =
        '<ellipse cx="48" cy="75" rx="8.4" ry="10" fill="#3a2b52"/>' +
        '<ellipse cx="72" cy="75" rx="8.4" ry="10" fill="#3a2b52"/>' +
        '<circle cx="44.6" cy="71" r="3.4" fill="#fff"/><circle cx="68.6" cy="71" r="3.4" fill="#fff"/>' +
        '<circle cx="51" cy="79" r="1.7" fill="#fff" opacity=".9"/><circle cx="75" cy="79" r="1.7" fill="#fff" opacity=".9"/>';
    }
    if (mood === "star") mouth = '<path d="M55 87 q5 6 10 0 z" fill="#ff5274"/>';
    else if (mood === "sleepy") mouth = '<path d="M57.5 88 q2.5 3 5 0" stroke="#3a2b52" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    else mouth = '<path d="M56 87 q4 4.5 8 0" stroke="#3a2b52" stroke-width="2.8" fill="none" stroke-linecap="round"/>';
    return cheeks + eyes + mouth;
  }

  function accessories(idx) {
    if (idx === 1)
      return '<line x1="60" y1="44" x2="60" y2="33" stroke="#1c9a4e" stroke-width="3.5" stroke-linecap="round"/>' +
             '<path d="M60 35 q-12 -2 -13 -13 q12 1 13 13" fill="#2ec46a"/>' +
             '<path d="M60 37 q12 -4 14 -14 q-12 2 -14 14" fill="#39d877"/>';
    if (idx === 2)
      return '<line x1="60" y1="44" x2="60" y2="34" stroke="#0a9a9a" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="31" r="4.5" fill="#ffd21f" stroke="#e0a800" stroke-width="1"/>';
    if (idx === 3)
      return '<path d="M30 56 q30 -16 60 0" stroke="#ff3b3b" stroke-width="7" fill="none" stroke-linecap="round"/>' +
             '<path d="M30 56 l-6 3 6 4 z" fill="#ff3b3b"/>';
    if (idx === 4)
      return '<g stroke="#2b2440" stroke-width="3" fill="rgba(255,255,255,.3)"><circle cx="49" cy="73" r="9.5"/><circle cx="71" cy="73" r="9.5"/><path d="M58.5 73 h3" stroke-linecap="round"/></g>' +
             '<path d="M60 106 l-6 9 6 9 6 -9 z" fill="#ff3b3b" stroke="#c92a2a" stroke-width="1.5"/>';
    if (idx === 5)
      return '<path d="M42 44 l5 -15 7 11 6 -15 6 15 7 -11 5 15 z" fill="#ffd21f" stroke="#e0a800" stroke-width="2" stroke-linejoin="round"/>' +
             '<circle cx="47" cy="29" r="2.6" fill="#ff3b3b"/><circle cx="60" cy="25" r="2.6" fill="#2e8bff"/><circle cx="73" cy="29" r="2.6" fill="#22d36a"/>' +
             '<g fill="#2b2440"><path d="M37 67 h21 a3 3 0 0 1 3 3 v3 a8.5 8.5 0 0 1 -17 1 l-1 -4 a3 3 0 0 0 -6 0z"/><path d="M83 67 h-21 a3 3 0 0 0 -3 3 v3 a8.5 8.5 0 0 0 17 1 l1 -4 a3 3 0 0 1 6 0z"/></g>';
    return "";
  }

  /* ---------- species features (cat / dog) ---------- */
  function species() { const p = activePet(); return (p && p.species) || "cat"; }

  function ears(idx, c, dark, sp) {
    const ht = 76 - (33 + idx); // head top y
    if (sp === "cat") {
      return (
        `<path d="M52 ${ht + 7} L41 ${ht - 13} L59 ${ht + 1} Z" fill="${c}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M51 ${ht + 2} L45 ${ht - 7} L55 ${ht - 1} Z" fill="#ff9ec4"/>` +
        `<path d="M68 ${ht + 7} L79 ${ht - 13} L61 ${ht + 1} Z" fill="${c}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M69 ${ht + 2} L75 ${ht - 7} L65 ${ht - 1} Z" fill="#ff9ec4"/>`
      );
    }
    if (sp === "monkey") {
      // round ears on the sides of the head (money monkey 🐵)
      const r = 33 + idx;
      const lx = 60 - r + 3, rx = 60 + r - 3, ey = 70;
      return (
        `<circle cx="${lx}" cy="${ey}" r="10" fill="${c}" stroke="${dark}" stroke-width="2"/>` +
        `<circle cx="${lx}" cy="${ey}" r="5" fill="${shade(c, -22)}"/>` +
        `<circle cx="${rx}" cy="${ey}" r="10" fill="${c}" stroke="${dark}" stroke-width="2"/>` +
        `<circle cx="${rx}" cy="${ey}" r="5" fill="${shade(c, -22)}"/>`
      );
    }
    // dog: floppy ears at sides
    const r = 33 + idx;
    const lx = 60 - r + 5, rx = 60 + r - 5, ey = 76 - r + 20;
    return (
      `<ellipse cx="${lx}" cy="${ey}" rx="9" ry="17" fill="${shade(c, -20)}" stroke="${dark}" stroke-width="2" transform="rotate(-20 ${lx} ${ey})"/>` +
      `<ellipse cx="${rx}" cy="${ey}" rx="9" ry="17" fill="${shade(c, -20)}" stroke="${dark}" stroke-width="2" transform="rotate(20 ${rx} ${ey})"/>`
    );
  }

  function tail(idx, c, dark, sp) {
    const r = 33 + idx;
    if (sp === "cat")
      return `<path d="M${60 + r - 6} 94 q28 8 24 -20 q-3 -16 -13 -13" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`;
    if (sp === "monkey")
      // long curly monkey tail
      return `<path d="M${60 + r - 6} 96 q30 4 26 -22 q-3 -15 -14 -9 q9 -1 10 8 q1 12 -12 12" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
    return `<path d="M${60 + r - 8} 98 q20 4 22 -14" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`;
  }

  function speciesFace(sp) {
    if (sp === "cat")
      return (
        '<path d="M56 80 l4 4.5 4 -4.5 z" fill="#ff7eb0"/>' +
        '<g stroke="#c7b8e6" stroke-width="1.6" stroke-linecap="round" opacity=".9">' +
        '<line x1="33" y1="79" x2="45" y2="82"/><line x1="33" y1="86" x2="45" y2="84"/>' +
        '<line x1="87" y1="79" x2="75" y2="82"/><line x1="87" y1="86" x2="75" y2="84"/></g>'
      );
    if (sp === "monkey")
      // 콧구멍만 (하트 얼굴 패치는 creature에서 그림)
      return (
        '<ellipse cx="55" cy="85" rx="2" ry="2.7" fill="#7a5518"/>' +
        '<ellipse cx="65" cy="85" rx="2" ry="2.7" fill="#7a5518"/>'
      );
    return '<ellipse cx="60" cy="81" rx="5" ry="3.6" fill="#3a2b52"/>';
  }

  function decoLayer(idx, equip) {
    if (!equip) return "";
    let s = "";
    const r = idx === 0 ? 27 : 33 + idx;
    const hatY = idx === 0 ? 30 : 76 - r + 6;
    if (equip.hat) {
      const d = DECOS.find((x) => x.id === equip.hat);
      if (d) s += `<text x="60" y="${hatY}" font-size="27" text-anchor="middle">${d.emoji}</text>`;
    }
    if (equip.hand) {
      const d = DECOS.find((x) => x.id === equip.hand);
      if (d) s += `<text x="${60 + r + 3}" y="102" font-size="23" text-anchor="middle">${d.emoji}</text>`;
    }
    return s;
  }

  /* ---------- activity pose: literally act out today's "right now" category ---------- */
  function activityKind(name) {
    name = name || "";
    if (/운동|헬스|요가|러닝|스쿼트|필라테스|홈트/.test(name)) return "exercise";
    if (/독서|책|리딩/.test(name)) return "reading";
    if (/공부|언어|주식|스터디|학습|암기|강의|리서치|조사|분석/.test(name)) return "study";
    if (/휴식|힐링|수면|잠|낮잠|티타임|명상/.test(name)) return "rest";
    return null;
  }

  function activityPose(kind, idx, c, dark) {
    const r = 33 + idx;
    const lx = 60 - r + 6, rx = 60 + r - 6, sy = 76 + r * 0.15;
    if (kind === "exercise") {
      const hy = 76 - r - 4;
      return (
        `<path d="M${lx} ${sy} Q${lx - 5} ${sy - r * 0.7} 51 ${hy}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M${rx} ${sy} Q${rx + 5} ${sy - r * 0.7} 69 ${hy}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<rect x="49" y="${hy - 2}" width="22" height="4" rx="2" fill="${dark}"/>` +
        `<circle cx="48" cy="${hy}" r="6.5" fill="#6b7280" stroke="#33383f" stroke-width="1.5"/>` +
        `<circle cx="72" cy="${hy}" r="6.5" fill="#6b7280" stroke="#33383f" stroke-width="1.5"/>`
      );
    }
    if (kind === "reading") {
      const by = 101;
      return (
        `<path d="M${lx} ${sy} Q${lx + 7} ${by - 7} 49 ${by}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M${rx} ${sy} Q${rx - 7} ${by - 7} 71 ${by}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<rect x="46" y="${by - 9}" width="28" height="17" rx="2" fill="#fffaf0" stroke="${dark}" stroke-width="2"/>` +
        `<line x1="60" y1="${by - 9}" x2="60" y2="${by + 8}" stroke="${dark}" stroke-width="1.5"/>` +
        `<line x1="50" y1="${by - 4}" x2="57" y2="${by - 4}" stroke="${dark}" stroke-width="1" opacity=".5"/>` +
        `<line x1="63" y1="${by - 4}" x2="70" y2="${by - 4}" stroke="${dark}" stroke-width="1" opacity=".5"/>`
      );
    }
    if (kind === "study") {
      const by = 103;
      return (
        `<path d="M${lx} ${sy} Q${lx + 7} ${by - 6} 51 ${by - 2}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M${rx} ${sy} Q${rx - 9} ${by - 12} 76 ${by - 12}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<rect x="43" y="${by - 6}" width="20" height="12" rx="1.5" fill="#fffaf0" stroke="${dark}" stroke-width="1.5"/>` +
        `<path d="M76 ${by - 12} l7 -7 3.3 3.3 -7 7 -4.3 1z" fill="#ffd21f" stroke="${dark}" stroke-width="1"/>`
      );
    }
    if (kind === "rest") {
      return (
        `<path d="M${lx} ${sy} Q60 ${sy + 8} ${rx} ${sy}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<text x="${rx + 4}" y="${sy - 16}" font-size="12" fill="#9a93c4">z</text>` +
        `<text x="${rx + 12}" y="${sy - 25}" font-size="8" fill="#9a93c4">z</text>`
      );
    }
    return "";
  }

  // 머니몽키(monkey)는 로고 그대로 골드 고정 — 진화해도 색 대신 크기·왕관으로 성장
  const MONKEY_GOLD = "#f0a91a";
  function monkeyHeartFace() {
    // 로고의 하트형 얼굴 패치 (크림색), face(mood)의 눈/입 좌표에 맞춤
    return '<path d="M60,64 C60,56 53,52 47,52 C38,52 34,60 34,67 C34,78 47,90 60,99 C73,90 86,78 86,67 C86,60 82,52 73,52 C67,52 60,56 60,64 Z" fill="#fff2c4" stroke="#eab308" stroke-width="1.4"/>';
  }
  function monkeyCrown() {
    return '<path d="M45,44 l4,-11 6,7 5,-9 5,9 6,-7 4,11 z" fill="#ffd21f" stroke="#e0a800" stroke-width="1.4" stroke-linejoin="round"/><circle cx="60" cy="33" r="2" fill="#ff5da2"/>';
  }

  function creature(idx, mood, equip, sp, activityCat) {
    sp = sp || species();
    const c = sp === "monkey" ? MONKEY_GOLD : STAGES[idx].color;
    const id = ++uid;
    const light = shade(c, 50), dark = shade(c, -42);
    let s = '<svg viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg">';
    s += '<ellipse cx="60" cy="124" rx="28" ry="6" fill="#000" opacity=".16"/>';

    if (idx === 0) {
      // egg — species not visible until it hatches
      s += `<defs><radialGradient id="e${id}" cx="42%" cy="30%" r="82%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#ffe2a6"/></radialGradient></defs>`;
      s += `<path d="M60 24 C38 24 32 64 32 82 a28 28 0 0 0 56 0 C88 64 82 24 60 24 Z" fill="url(#e${id})" stroke="#f0cf84" stroke-width="2.5"/>`;
      s += '<path d="M44 72 l7 -6 7 7 7 -7 7 6" stroke="#e9c573" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      s += face(mood);
      s += decoLayer(idx, equip);
      s += '<text x="25" y="44" font-size="12">✨</text>';
      return s + "</svg>";
    }

    const r = 33 + idx;
    if (activityCat) s += `<circle cx="60" cy="76" r="${r + 15}" fill="${activityCat.color}" opacity=".16"/>`;
    s += `<defs><radialGradient id="g${id}" cx="42%" cy="30%" r="78%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>`;
    s += tail(idx, c, dark, sp);          // behind body
    s += ears(idx, c, dark, sp);          // behind/around head
    if (idx >= 2) {
      s += `<ellipse cx="${60 - r + 2}" cy="92" rx="8" ry="9" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
      s += `<ellipse cx="${60 + r - 2}" cy="92" rx="8" ry="9" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    }
    s += `<ellipse cx="49" cy="${76 + r - 5}" rx="9" ry="6" fill="${dark}"/>`;
    s += `<ellipse cx="71" cy="${76 + r - 5}" rx="9" ry="6" fill="${dark}"/>`;
    s += `<ellipse cx="60" cy="76" rx="${r}" ry="${r - 2}" fill="url(#g${id})" stroke="${dark}" stroke-width="2.5"/>`;
    s += '<ellipse cx="49" cy="61" rx="12" ry="9" fill="#fff" opacity=".22"/>';
    if (sp === "monkey") {
      s += monkeyHeartFace();       // 로고 하트 얼굴 (눈/입 뒤)
      s += face(mood);              // 표정
      s += speciesFace(sp);         // 콧구멍
      if (idx >= 5) s += monkeyCrown(); // 최종 진화 왕관
    } else {
      if (idx !== 5) s += face(mood);
      s += speciesFace(sp);
      s += accessories(idx);
    }
    s += decoLayer(idx, equip);
    // acting out what you're scheduled to do right now: real arm pose for known activities,
    // a simple held emoji badge as a fallback for custom categories we can't recognize
    if (activityCat) {
      const kind = activityKind(activityCat.name);
      s += kind
        ? activityPose(kind, idx, c, dark)
        : `<text x="${60 - r - 3}" y="102" font-size="20" text-anchor="middle">${activityCat.emoji}</text>`;
    }
    return s + "</svg>";
  }

  /* ---------- announce helpers ---------- */
  let lastStage = null;
  let lastDecos = null;
  let lastThemes = null;

  function announceUnlocks() {
    const ctx = unlockCtx();
    const now = DECOS.filter((d) => isUnlocked(d, ctx)).map((d) => d.id);
    if (lastDecos) {
      now.filter((id) => !lastDecos.includes(id)).forEach((id) => {
        const d = DECOS.find((x) => x.id === id);
        if (d) App.gamify.toast(`🎁 새 아이템 잠금해제! ${d.emoji} ${d.name}`);
      });
    }
    lastDecos = now;

    const nowT = THEMES.filter((t) => !t.cond || isUnlocked(t, ctx)).map((t) => t.id);
    if (lastThemes) {
      nowT.filter((id) => !lastThemes.includes(id)).forEach((id) => {
        const t = THEMES.find((x) => x.id === id);
        if (t) App.gamify.toast(`🎨 새 배경 테마 잠금해제! ${t.name}`);
      });
    }
    lastThemes = nowT;
  }

  /* ---------- render: planner hero ---------- */
  function render(announce = true) {
    applyThemeNow();
    const info = App.gamify.levelInfo(game().xp || 0);
    const idx = stageForLevel(info.level);
    const stage = STAGES[idx];
    const { mood, text } = moodInfo();

    if (announce && lastStage !== null && idx > lastStage) {
      App.gamify.toast(`✨ ${name()} 진화! → ${stage.name}`, "levelup");
      App.gamify.confetti();
      App.gamify.sfx.levelup();
    }
    lastStage = idx;
    game().lastStage = idx;
    announceUnlocks();

    const activityCat = currentActivityCat();
    setHTML("charArt", creature(idx, mood, activePet().equip, null, activityCat));
    setText("tamaName", name());
    setText("charName", name());
    setText("charStage", `Lv.${info.level} · ${stage.name}`);
    setText("charMood", text);
    setText("charActivity", activityCat ? `${activityCat.emoji} 지금은 ${activityCat.name} 시간이에요!` : "");

    const evoFill = document.getElementById("charEvoFill");
    const next = STAGES[idx + 1];
    if (next) {
      const startX = xpAt(stage.minLevel), endX = xpAt(next.minLevel);
      const frac = Math.max(0, Math.min(1, (game().xp - startX) / (endX - startX)));
      if (evoFill) evoFill.style.width = (frac * 100).toFixed(1) + "%";
      setText("charEvoText", `다음 진화 → ${next.name} (Lv.${next.minLevel})`);
    } else {
      if (evoFill) evoFill.style.width = "100%";
      setText("charEvoText", "최종 진화 완료! 👑");
    }

    const d = App.stats.deriveDay(U.today());
    setText("charFeed", `오늘 ${d.doneBlocks}칸 완료 · 누적 ${U.minToH(App.stats.totalDoneMinutes())} · 🔥${App.stats.currentStreak()}일`);
    updateSnackUI();
    renderParty(idx);
    renderMini(info, stage);
    if (isVisible("view-codex")) renderCollection();
  }

  function updateSnackUI() {
    setText("charSnack", `🍪 ${snacksLeft()}`);
    setText("charAffection", `❤ ${affection()}`);
    const f = fullness();
    const fill = document.getElementById("charFullFill");
    if (fill) {
      fill.style.width = f + "%";
      fill.style.background = f >= 60 ? "var(--green)" : f >= 30 ? "var(--orange)" : "var(--red)";
    }
    setText("charFullText", f + "%");
    const btn = document.getElementById("charFeedBtn");
    if (btn) {
      const can = snacksLeft() > 0 && f < FEED_LIMIT;
      btn.disabled = !can;
      btn.title = snacksLeft() <= 0 ? "간식이 없어요 (칸 완료 시 적립)" : f >= FEED_LIMIT ? "이미 배불러요" : "밥주기";
    }
  }

  /* ---------- companion strip (all pets together) ---------- */
  function renderParty(curIdx) {
    const wrap = document.getElementById("charParty");
    if (!wrap) return;
    const ps = pets();
    if (ps.length <= 1) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = "";
    ps.forEach((p) => {
      const m = moodForPet(p).mood;
      const b = document.createElement("button");
      b.className = "party-pet" + (p.id === game().activePet ? " active" : "");
      b.title = p.name;
      b.innerHTML = creature(curIdx, m, p.equip, p.species || "cat");
      b.onclick = () => setActivePet(p.id);
      wrap.appendChild(b);
    });
  }

  /* ---------- render: stats-tab mini ---------- */
  function renderMini(info, stage) {
    if (!document.getElementById("charMiniArt")) return;
    info = info || App.gamify.levelInfo(game().xp || 0);
    const idx = stageForLevel(info.level);
    stage = stage || STAGES[idx];
    const { mood } = moodInfo();
    setHTML("charMiniArt", creature(idx, mood, activePet().equip, null, currentActivityCat()));
    setText("charMiniName", name());
    setText("charMiniBadge", `Lv.${info.level} · ${stage.name}`);
    const d7 = App.stats.deriveRange(U.ymd(U.addDays(new Date(), -6)), U.today());
    setText("charMiniInfo", `최근 7일 ${U.minToH(d7.doneMin)} 함께했어요 · 🔥${App.stats.currentStreak()}일 · ❤${affection()}`);
  }

  /* ---------- render: 도감 (codex) ---------- */
  function renderCollection() {
    const info = App.gamify.levelInfo(game().xp || 0);
    const curIdx = stageForLevel(info.level);
    const { mood } = moodInfo();

    setHTML("codexArt", creature(curIdx, mood, activePet().equip, null, currentActivityCat()));
    setText("codexName", name());
    setText("codexStat",
      `Lv.${info.level} · ${STAGES[curIdx].name} · 🍪 간식 ${snacksLeft()} · ❤ 친밀도 ${affection()} · 🍖 밥 ${totalFed()}번`);
    renderPets(info, mood, curIdx);
    renderThemes();

    // evolution dex
    const evo = document.getElementById("evoDex");
    if (evo) {
      evo.innerHTML = "";
      STAGES.forEach((st, i) => {
        const unlocked = curIdx >= i;
        const card = document.createElement("div");
        card.className = "dex-cell" + (unlocked ? "" : " locked") + (i === curIdx ? " current" : "");
        card.innerHTML =
          `<div class="dex-art">${unlocked ? creature(i, "happy", null) : '<div class="dex-lock">🔒</div>'}</div>` +
          `<div class="dex-name">${unlocked ? st.name : "???"}</div>` +
          `<div class="dex-sub">Lv.${st.minLevel}${i === curIdx ? " · 지금" : ""}</div>`;
        evo.appendChild(card);
      });
      setText("codexEvoCount", `${curIdx + 1}/${STAGES.length}`);
    }

    // decoration dex
    const deco = document.getElementById("decoDex");
    if (deco) {
      deco.innerHTML = "";
      const ctx = unlockCtx();
      let unlockedCount = 0;
      DECOS.forEach((d) => {
        const unlocked = isUnlocked(d, ctx);
        if (unlocked) unlockedCount++;
        const equipped = activePet().equip && activePet().equip[d.slot] === d.id;
        const card = document.createElement("div");
        card.className = "deco-cell" + (unlocked ? "" : " locked") + (equipped ? " equipped" : "");
        card.innerHTML =
          `<div class="deco-emoji">${unlocked ? d.emoji : "🔒"}</div>` +
          `<div class="deco-name">${d.name}</div>` +
          `<div class="deco-sub">${unlocked ? (equipped ? "장착 중 ✓" : (d.slot === "hat" ? "모자" : "손")) : d.hint}</div>`;
        if (unlocked) {
          card.onclick = () => toggleEquip(d);
          card.style.cursor = "pointer";
        }
        deco.appendChild(card);
      });
      setText("codexDecoCount", `${unlockedCount}/${DECOS.length}`);
    }
  }

  function toggleEquip(d) {
    const p = activePet();
    if (!p.equip) p.equip = { hat: null, hand: null };
    p.equip[d.slot] = p.equip[d.slot] === d.id ? null : d.id;
    App.store.save();
    App.gamify.sfx.paint();
    render(false);
    if (isVisible("view-codex")) renderCollection();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- pets section (도감) ---------- */
  function renderPets(info, mood, curIdx) {
    const list = document.getElementById("petsList");
    if (!list) return;
    info = info || App.gamify.levelInfo(game().xp || 0);
    mood = mood || moodInfo().mood;
    curIdx = curIdx == null ? stageForLevel(info.level) : curIdx;
    const slots = maxPets(info.level);
    const ps = pets();
    list.innerHTML = "";

    ps.forEach((p) => {
      const isActive = p.id === game().activePet;
      const m = moodForPet(p).mood;
      const card = document.createElement("div");
      card.className = "pet-cell" + (isActive ? " active" : "");
      card.innerHTML =
        `<div class="pet-art">${creature(curIdx, m, p.equip, p.species || "cat")}</div>` +
        `<div class="pet-name">${p.species === "dog" ? "🐶" : p.species === "monkey" ? "🐵" : "🐱"} ${escapeName(p.name)}</div>` +
        `<div class="dex-sub">${isActive ? '<span class="pet-badge">메인 ✓</span>' : "눌러서 메인으로"} · 🍖${fullness(p)}%</div>`;
      card.onclick = () => setActivePet(p.id);
      list.appendChild(card);
    });

    for (let i = ps.length; i < slots; i++) {
      const card = document.createElement("div");
      card.className = "pet-cell adopt";
      card.innerHTML = '<div style="font-size:30px">＋</div><div class="pet-name">새 친구 입양</div>';
      card.onclick = openAdopt;
      list.appendChild(card);
    }
    for (let i = slots; i < PET_LEVELS.length; i++) {
      const card = document.createElement("div");
      card.className = "pet-cell locked";
      card.innerHTML = `<div style="font-size:28px">🔒</div><div class="dex-sub">Lv.${PET_LEVELS[i]}에서 잠금해제</div>`;
      list.appendChild(card);
    }
    setText("petsCount", `${ps.length}마리`);
  }

  function setActivePet(id) {
    if (!pets().some((p) => p.id === id)) return;
    game().activePet = id;
    App.store.save();
    App.gamify.sfx.paint();
    render(false);
    if (isVisible("view-codex")) renderCollection();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- themes section (도감) ---------- */
  function renderThemes() {
    const wrap = document.getElementById("themeDex");
    if (!wrap) return;
    const ctx = unlockCtx();
    let unlocked = 0;
    wrap.innerHTML = "";
    THEMES.forEach((t) => {
      const ok = !t.cond || isUnlocked(t, ctx);
      if (ok) unlocked++;
      const equipped = (game().theme || "navy") === t.id;
      const card = document.createElement("div");
      card.className = "theme-cell" + (ok ? "" : " locked") + (equipped ? " equipped" : "");
      card.innerHTML =
        `<div class="theme-prev" style="background:${t.bg}"></div>` +
        `<div class="theme-meta"><div class="theme-name">${ok ? t.name : "???"}</div>` +
        `<div class="theme-sub">${equipped ? "사용 중 ✓" : ok ? "탭하여 적용" : t.hint}</div></div>`;
      if (ok) card.onclick = () => applyTheme(t.id);
      wrap.appendChild(card);
    });
    setText("codexThemeCount", `${unlocked}/${THEMES.length}`);
  }

  function escapeName(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  /* ---------- interactions ---------- */
  function setText(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
  function setHTML(id, h) { const e = document.getElementById(id); if (e) e.innerHTML = h; }
  function isVisible(id) { const e = document.getElementById(id); return e && e.classList.contains("active"); }

  function bounce(id) {
    const art = document.getElementById(id);
    if (art) { art.classList.remove("pet"); void art.offsetWidth; art.classList.add("pet"); }
  }
  function floatEmoji(cardSel, emoji, e) {
    const card = document.querySelector(cardSel);
    if (!card) return;
    const h = document.createElement("span");
    h.className = "heart-float";
    h.textContent = emoji;
    const rect = card.getBoundingClientRect();
    h.style.left = (e && e.clientX ? e.clientX - rect.left : rect.width * 0.25) + "px";
    h.style.top = (e && e.clientY ? e.clientY - rect.top : 70) + "px";
    card.appendChild(h);
    setTimeout(() => h.remove(), 1000);
  }

  function pet(e) {
    bounce("charArt");
    App.gamify.sfx.complete();
    floatEmoji(".char-card", ["💖", "💕", "⭐", "✨"][affection() % 4], e);
  }

  function feed() {
    if (snacksLeft() <= 0) {
      flashMood("간식이 없어요! 칸을 완료하면 간식이 생겨요 🍪");
      return;
    }
    if (fullness() >= FEED_LIMIT) {
      flashMood("이미 배불러요~ 나중에 또 주세요 😊");
      return;
    }
    const p = activePet();
    p.fed = (p.fed || 0) + 1;
    p.lastFed = nowMs();
    App.store.save();
    bounce("charArt");
    App.gamify.sfx.complete();
    floatEmoji(".char-card", ["🍖", "🍙", "😋", "🍪"][p.fed % 4]);
    updateSnackUI();
    announceUnlocks();
    if (isVisible("view-codex")) renderCollection();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
    flashMood("냠냠 맛있어! 😋 (친밀도 +1)");
  }

  let flashTimer = null;
  function flashMood(msg) {
    setText("charMood", msg);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => render(false), 1800);
  }

  function name() { return (activePet() && activePet().name) || "퀘스토"; }
  function rename() {
    const input = document.getElementById("renameInput");
    if (input) input.value = name();
    App.ui.openModal("renameModal");
  }
  function renameSave() {
    const input = document.getElementById("renameInput");
    activePet().name = (input.value || "").trim().slice(0, 8) || "퀘스토";
    App.store.save();
    App.ui.closeModals();
    render(false);
    if (isVisible("view-codex")) renderCollection();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  /* ---------- species selection / adoption ---------- */
  let adoptMode = false;
  function needsSpecies() { const p = activePet(); return !p || !p.species; }

  function openAdopt() {
    adoptMode = true;
    App.ui.openModal("speciesModal");
  }

  const SP_LABEL = { monkey: "머니몽키", dog: "강아지", cat: "고양이" };
  function chooseSpecies(sp) {
    sp = sp === "dog" ? "dog" : sp === "monkey" ? "monkey" : "cat";
    if (adoptMode) {
      const p = App.newPet("친구 " + (pets().length + 1));
      p.species = sp;
      pets().push(p);
      game().activePet = p.id;
      adoptMode = false;
      App.gamify.toast(`🐣 새 친구를 입양했어요! (${SP_LABEL[sp]})`);
    } else {
      activePet().species = sp;
    }
    App.store.save();
    App.ui.closeModals();
    App.gamify.sfx.levelup();
    App.gamify.confetti();
    render(false);
    updateSpeciesButtons();
    if (isVisible("view-codex")) renderCollection();
    if (App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  }

  function fillSpeciesPreviews() {
    setHTML("spMonkeyPrev", creature(2, "happy", null, "monkey"));
    setHTML("spCatPrev", creature(2, "happy", null, "cat"));
    setHTML("spDogPrev", creature(2, "happy", null, "dog"));
  }
  function updateSpeciesButtons() {
    const map = { codexMonkey: "monkey", codexCat: "cat", codexDog: "dog" };
    for (const id in map) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("active", species() === map[id]);
    }
  }

  function init() {
    applyThemeNow();
    const art = document.getElementById("charArt");
    if (art) art.addEventListener("click", pet);
    const rn = document.getElementById("charRename");
    if (rn) rn.addEventListener("click", rename);
    const rs = document.getElementById("renameSave");
    if (rs) rs.addEventListener("click", renameSave);
    const ri = document.getElementById("renameInput");
    if (ri) ri.addEventListener("keydown", (e) => { if (e.key === "Enter") renameSave(); });
    const fb = document.getElementById("charFeedBtn");
    if (fb) fb.addEventListener("click", feed);
    const codexArt = document.getElementById("codexArt");
    if (codexArt) codexArt.addEventListener("click", (e) => { bounce("codexArt"); App.gamify.sfx.complete(); floatEmoji(".codex-hero", "💖", e); });

    // tamagotchi device buttons: A=쓰다듬기 B=밥주기 C=도감
    bindClick("tamaA", (e) => pet(e));
    bindClick("tamaB", () => feed());
    bindClick("tamaC", () => { const t = document.querySelector('.tab[data-view="codex"]'); if (t) t.click(); });

    fillSpeciesPreviews();
    bindClick("spMonkey", () => chooseSpecies("monkey"));
    bindClick("spCat", () => chooseSpecies("cat"));
    bindClick("spDog", () => chooseSpecies("dog"));
    bindClick("codexMonkey", () => chooseSpecies("monkey"));
    bindClick("codexCat", () => chooseSpecies("cat"));
    bindClick("codexDog", () => chooseSpecies("dog"));
    updateSpeciesButtons();
  }
  function bindClick(id, fn) { const e = document.getElementById(id); if (e) e.addEventListener("click", fn); }

  App.character = { init, render, renderCollection, renderMini, needsSpecies, chooseSpecies, STAGES, DECOS };
})();
