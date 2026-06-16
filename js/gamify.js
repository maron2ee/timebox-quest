/* ===========================================================
   gamify.js — XP/level math, achievements, toasts, 8-bit SFX, confetti
   Exposes: window.App.gamify
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  /* ---------- level math ----------
     cumulative XP to *reach* level L = 50 * L * (L-1)
     => level 1 starts at 0, lvl2 at 100, lvl3 at 300, lvl4 at 600 ... */
  function levelInfo(xp) {
    let level = 1;
    while (50 * (level + 1) * level <= xp) level++;
    const cur = 50 * level * (level - 1);
    const next = 50 * (level + 1) * level;
    return {
      level,
      into: xp - cur,
      span: next - cur,
      pct: Math.round(((xp - cur) / (next - cur)) * 100),
      nextAt: next,
    };
  }

  /* ---------- XP derivation ----------
     XP is fully derived from history so it never drifts:
       +10 per completed block
       +40 bonus per day that is a "win"
       +20 bonus per category/day that meets its daily target */
  function computeXp() {
    const s = App.state;
    const slotMin = s.settings.slotMinutes;
    let xp = 0;
    for (const ds in s.days) {
      const day = App.stats.deriveDay(ds);
      xp += day.doneBlocks * 10;
      if (day.isWin) xp += 40;
      for (const catId in day.perCat) {
        const cat = App.catById(catId);
        if (cat && cat.target > 0 && day.perCat[catId].done * slotMin >= cat.target) xp += 20;
      }
    }
    return xp;
  }

  /* ---------- achievements (derived) ---------- */
  const ACHIEVEMENTS = [
    { id: "first", ico: "🌱", name: "첫 발걸음", desc: "첫 칸 완료", test: (ctx) => ctx.totalBlocks >= 1 },
    { id: "win1", ico: "✨", name: "성공한 하루", desc: "하루 목표 달성 1회", test: (ctx) => ctx.winDays >= 1 },
    { id: "streak3", ico: "🔥", name: "불씨", desc: "3일 연속 달성", test: (ctx) => ctx.bestStreak >= 3 },
    { id: "streak7", ico: "🔥", name: "일주일 전사", desc: "7일 연속 달성", test: (ctx) => ctx.bestStreak >= 7 },
    { id: "streak30", ico: "🏆", name: "한 달의 규율", desc: "30일 연속 달성", test: (ctx) => ctx.bestStreak >= 30 },
    { id: "blocks50", ico: "⏱️", name: "시간 수집가", desc: "누적 50칸 완료", test: (ctx) => ctx.totalBlocks >= 50 },
    { id: "blocks200", ico: "💎", name: "루틴 마스터", desc: "누적 200칸 완료", test: (ctx) => ctx.totalBlocks >= 200 },
    { id: "stock10h", ico: "📈", name: "차트 워리어", desc: "주식공부 누적 10시간", test: (ctx) => ctx.maxStudyMin >= 600 },
    { id: "balanced", ico: "⚖️", name: "균형 잡힌 트레이더", desc: "하루에 4개 카테고리 실천", test: (ctx) => ctx.maxCatsInDay >= 4 },
    { id: "perfect", ico: "👑", name: "완벽한 하루", desc: "하루 달성률 100%", test: (ctx) => ctx.hadPerfect },
  ];

  function achievementContext() {
    const s = App.state;
    const slotMin = s.settings.slotMinutes;
    let totalBlocks = 0, winDays = 0, bestStreak = 0, run = 0, hadPerfect = false, maxCatsInDay = 0;
    const studyMinByCat = {};

    const dates = Object.keys(s.days).sort();
    // best streak over all win days
    let prev = null;
    for (const ds of dates) {
      const d = App.stats.deriveDay(ds);
      totalBlocks += d.doneBlocks;
      if (d.pct === 100 && d.plannedBlocks > 0) hadPerfect = true;
      const cats = Object.values(d.perCat).filter((c) => c.done > 0).length;
      if (cats > maxCatsInDay) maxCatsInDay = cats;
      for (const cid in d.perCat) studyMinByCat[cid] = (studyMinByCat[cid] || 0) + d.perCat[cid].done * slotMin;
      if (d.isWin) {
        if (prev && isPrevDay(prev, ds)) run++; else run = 1;
        if (run > bestStreak) bestStreak = run;
        prev = ds;
      } else {
        prev = null; run = 0;
      }
    }
    winDays = dates.filter((ds) => App.stats.deriveDay(ds).isWin).length;
    // study cat = the category named 주식공부 if present, else max
    let maxStudyMin = 0;
    const stockCat = s.categories.find((c) => c.name.includes("주식"));
    if (stockCat && studyMinByCat[stockCat.id]) maxStudyMin = studyMinByCat[stockCat.id];
    else maxStudyMin = Math.max(0, ...Object.values(studyMinByCat));

    return { totalBlocks, winDays, bestStreak, hadPerfect, maxCatsInDay, maxStudyMin };
  }

  function isPrevDay(a, b) {
    const da = App.util.parseYmd(a), db = App.util.parseYmd(b);
    return (db - da) === 86400000;
  }

  function earnedAchievements() {
    const ctx = achievementContext();
    return ACHIEVEMENTS.map((a) => ({ ...a, earned: a.test(ctx) }));
  }

  /* ---------- toasts ---------- */
  function toast(msg, kind = "") {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  /* ---------- 8-bit SFX (WebAudio, no assets) ---------- */
  let actx = null;
  function beep(freqs, dur = 0.09) {
    if (!App.state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + dur);
        t += dur;
      });
    } catch (e) { /* ignore */ }
  }
  const sfx = {
    complete: () => beep([880, 1320]),
    uncheck: () => beep([440]),
    levelup: () => beep([660, 880, 1100, 1320], 0.11),
    paint: () => beep([520], 0.04),
  };

  /* ---------- confetti (pixel squares) ---------- */
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.getElementById("fxCanvas");
    if (!cv || typeof cv.getContext !== "function") return;
    const ctx = cv.getContext("2d");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    const colors = App.CONST.PALETTE;
    const parts = [];
    const shapes = ["circle", "circle", "round"]; // mostly soft dots
    for (let i = 0; i < 90; i++) {
      parts.push({
        x: cv.width / 2 + (Math.random() - 0.5) * cv.width * 0.6,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 3.4, vy: 2 + Math.random() * 4,
        s: 5 + Math.random() * 7, c: colors[(Math.random() * colors.length) | 0],
        shape: shapes[(Math.random() * shapes.length) | 0],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        life: 70 + Math.random() * 50,
      });
    }
    let frame = 0;
    function rr(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
    }
    function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.11; p.rot += p.vr; p.life--;
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.c;
        if (p.shape === "circle") {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          rr(ctx, -p.s / 2, -p.s / 2, p.s, p.s, p.s * 0.35); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      frame++;
      if (alive && frame < 200) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    }
    tick();
  }

  /* ---------- main: recompute & detect level-up ---------- */
  let lastLevel = null;
  let lastAch = null;

  function refresh(announce = true) {
    const xp = computeXp();
    App.state.game.xp = xp;
    const info = levelInfo(xp);

    if (announce && lastLevel !== null && info.level > lastLevel) {
      sfx.levelup();
      toast(`LEVEL UP!  Lv.${info.level}`, "levelup");
      confetti();
    }
    lastLevel = info.level;

    // newly earned achievements
    const earned = earnedAchievements().filter((a) => a.earned).map((a) => a.id);
    if (announce && lastAch) {
      const fresh = earned.filter((id) => !lastAch.includes(id));
      fresh.forEach((id) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) toast(`업적 달성! ${a.ico} ${a.name}`);
      });
    }
    lastAch = earned;
    App.state.game.achievements = earned;

    return info;
  }

  App.gamify = {
    levelInfo, computeXp, refresh, earnedAchievements, ACHIEVEMENTS,
    context: achievementContext,
    toast, sfx, confetti,
  };
})();
