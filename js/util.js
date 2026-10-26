/* ===========================================================
   util.js — 날짜 / 시간 / DOM 공용 헬퍼
   Exposes: window.App.util (U)
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});

  const pad = (n) => String(n).padStart(2, "0");
  const WD = ["일", "월", "화", "수", "목", "금", "토"];

  /* ---------- 날짜 ---------- */
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseYmd(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
  function addDays(ds, n) { const d = parseYmd(ds); d.setDate(d.getDate() + n); return ymd(d); }
  function today() { return ymd(new Date()); }
  function weekday(ds) { return WD[parseYmd(ds).getDay()]; }
  function isToday(ds) { return ds === today(); }

  // "2026년 7월 17일 금"
  function fmtFull(ds) {
    const d = parseYmd(ds);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}`;
  }
  // "7월 17일 금"
  function fmtMD(ds) {
    const d = parseYmd(ds);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}`;
  }
  // "7/17"
  function fmtSlash(ds) { const d = parseYmd(ds); return `${d.getMonth() + 1}/${d.getDate()}`; }

  // 두 날짜 차이(일). b - a
  function diffDays(a, b) {
    return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  }
  // D-day 표기: 미래 "D-7", 오늘 "D-DAY", 과거 "D+3"
  function dday(target, from) {
    const n = diffDays(from || today(), target);
    if (n === 0) return "D-DAY";
    return n > 0 ? "D-" + n : "D+" + -n;
  }

  // 이번 주 월요일
  function weekStart(ds) {
    const d = parseYmd(ds);
    const off = (d.getDay() + 6) % 7; // 월=0
    d.setDate(d.getDate() - off);
    return ymd(d);
  }
  function monthStart(ds) { const d = parseYmd(ds); d.setDate(1); return ymd(d); }
  function monthEnd(ds) { const d = parseYmd(ds); d.setMonth(d.getMonth() + 1, 0); return ymd(d); }
  // from~to 사이 날짜 배열
  function rangeDays(from, to) {
    const out = [];
    for (let ds = from; ds <= to; ds = addDays(ds, 1)) out.push(ds);
    return out;
  }

  /* ---------- 시간 (분 단위 정수 ↔ "HH:MM") ---------- */
  function toMin(hhmm) { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; }
  function toHHMM(min) { const m = ((min % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  // 320 -> "5시간 20분" / 60 -> "1시간" / 40 -> "40분" / 0 -> "0분"
  function minToKo(min) {
    min = Math.max(0, Math.round(min));
    const h = Math.floor(min / 60), m = min % 60;
    if (h && m) return `${h}시간 ${m}분`;
    if (h) return `${h}시간`;
    return `${m}분`;
  }
  // 320 -> "5.3h"
  function minToH(min) { return (Math.max(0, min) / 60).toFixed(1) + "h"; }

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);
  function setText(id, t) { const e = byId(id); if (e) e.textContent = t; }
  function setHTML(id, h) { const e = byId(id); if (e) e.innerHTML = h; }
  function on(id, ev, fn) { const e = byId(id); if (e) e.addEventListener(ev, fn); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  /* ---------- 기타 ---------- */
  function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 9); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); const a = arguments, s = this; t = setTimeout(() => fn.apply(s, a), ms); };
  }

  App.util = {
    pad, WD,
    ymd, parseYmd, addDays, today, weekday, isToday,
    fmtFull, fmtMD, fmtSlash, diffDays, dday,
    weekStart, monthStart, monthEnd, rangeDays,
    toMin, toHHMM, nowMin, minToKo, minToH,
    $, $$, byId, setText, setHTML, on, el, esc,
    uid, clamp, debounce,
  };
})();
