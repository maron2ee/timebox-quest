/* ===========================================================
   market.js — 국내 주식시장(KRX) 거래시간 정의
   2026.09.14 개편 반영: 시간외단일가(16~18시) 폐지 → 애프터마켓 16~20시 신설
   Exposes: window.App.market
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  // 기본값. settings.market 으로 덮어쓸 수 있음(설정 탭에서 수정).
  const DEFAULT_SESSIONS = [
    { id: "preCall",    name: "장전 동시호가", short: "동시호가", start: "08:30", end: "09:00", tone: "pre" },
    { id: "regular",    name: "정규장",        short: "정규장",   start: "09:00", end: "15:30", tone: "core" },
    { id: "afterClose", name: "시간외 종가",   short: "시간외",   start: "15:40", end: "16:00", tone: "pre" },
    { id: "after",      name: "애프터마켓",    short: "애프터",   start: "16:00", end: "20:00", tone: "after" },
  ];

  function sessions() {
    const s = App.store && App.store.state && App.store.state.settings;
    const custom = s && s.market && s.market.sessions;
    return (custom && custom.length ? custom : DEFAULT_SESSIONS).map((x) => ({
      ...x, startMin: U.toMin(x.start), endMin: U.toMin(x.end),
    }));
  }

  function enabled() {
    const s = App.store && App.store.state && App.store.state.settings;
    return !(s && s.market && s.market.show === false);
  }

  // 특정 분(min-of-day)이 속한 세션
  function sessionAt(min) {
    return sessions().find((s) => min >= s.startMin && min < s.endMin) || null;
  }

  // 주말이면 장이 안 열림
  function isTradingDay(ds) {
    const d = U.parseYmd(ds).getDay();
    return d !== 0 && d !== 6;
  }

  // 타임라인 한 슬롯(min~min+len)에 걸치는 세션 tone 반환
  function toneFor(ds, min, len) {
    if (!enabled() || !isTradingDay(ds)) return null;
    const s = sessionAt(min) || sessionAt(min + Math.max(0, len - 1));
    return s ? s.tone : null;
  }

  // "지금 장 상태" 한 줄 요약
  function statusNow(ds) {
    ds = ds || U.today();
    if (!isTradingDay(ds)) return { label: "휴장", tone: null };
    const m = U.nowMin();
    const s = sessionAt(m);
    if (s) {
      const left = s.endMin - m;
      return { label: `${s.name} · ${U.minToKo(left)} 남음`, tone: s.tone, session: s };
    }
    const next = sessions().find((x) => x.startMin > m);
    if (next) return { label: `${next.name}까지 ${U.minToKo(next.startMin - m)}`, tone: null };
    return { label: "장 종료", tone: null };
  }

  App.market = { DEFAULT_SESSIONS, sessions, enabled, sessionAt, isTradingDay, toneFor, statusNow };
})();
