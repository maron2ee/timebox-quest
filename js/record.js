/* ===========================================================
   record.js — '오늘의 기록' 허브
   숫자는 2층(구글시트), 서술은 3층(노션 데일리 노트)에 있다.
   앱은 그 둘로 가는 길 + 시트가 못 하는 '언제 확정했는가'만 담당한다.
   Exposes: window.App.record
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  // 가설·매매계획을 확정하는 구간 (기본 pre3 = 08:30~09:00)
  const STAMP_PHASE = "pre3";

  function isUrl(v) { return /^https?:\/\//i.test((v || "").trim()); }

  function stampEl(ds) {
    const st = S().phaseStamp(ds, STAMP_PHASE);
    const row = U.el("div", "rec-row");
    row.appendChild(U.el("span", "rec-k", "가설 확정"));

    if (!st) { row.appendChild(U.el("span", "rec-v muted", "구간 없음")); return row; }

    if (!st.at) {
      const late = U.isToday(ds) && U.nowMin() >= st.phase.endMin;
      const v = U.el("span", "rec-stamp " + (late ? "bad" : "todo"),
        late ? `미확정 — ${st.phase.end} 지남` : `${st.phase.start}~${st.phase.end}`);
      row.appendChild(v);
      row.appendChild(U.el("span", "rec-sub", "시트 O·P·R 칸을 채우고 체크하세요"));
      return row;
    }

    const hhmm = U.toHHMM(st.atMin);
    const v = U.el("span", "rec-stamp " + (st.late ? "bad" : "ok"),
      st.late ? `${hhmm} · 장 시작 후` : `${hhmm} 확정`);
    v.title = st.late
      ? "장이 열린 뒤에 확정했어요. 가설이 아니라 사후 해석입니다."
      : "장 시작 전에 확정했어요.";
    row.appendChild(v);
    row.appendChild(U.el("span", "rec-sub",
      st.complete ? `${st.done}/${st.total} 완료` : `${st.done}/${st.total} — 아직 남았어요`));
    return row;
  }

  function linkRow(ds, entry) {
    const row = U.el("div", "rec-row");
    row.appendChild(U.el("span", "rec-k", U.esc(entry.label)));
    const cur = S().linkUrl(ds, entry);
    const inp = U.el("input", "rec-link" + (cur && !isUrl(cur) ? " bad" : ""));
    inp.value = cur;
    inp.placeholder = entry.daily ? "오늘 페이지 링크 (날짜별)" : "https://...";
    inp.onchange = () => { S().setLinkUrl(ds, entry, inp.value); render(ds); };
    row.appendChild(inp);
    if (entry.daily) row.appendChild(U.el("span", "rec-daily", "날짜별"));
    if (isUrl(cur)) {
      const a = U.el("a", "btn sm", "열기");
      a.href = cur; a.target = "_blank"; a.rel = "noopener noreferrer";
      row.appendChild(a);
    }
    return row;
  }

  function render(ds) {
    const host = U.byId("recordBox");
    if (!host) return;
    host.innerHTML = "";
    const head = U.el("div", "row");
    head.innerHTML = `<div class="card-label" style="margin:0">오늘의 기록</div>`;
    head.appendChild(U.el("span", "rec-note ml-auto", "숫자는 시트 · 문장은 노션"));
    host.appendChild(head);

    host.appendChild(stampEl(ds));
    S().links().forEach((e) => host.appendChild(linkRow(ds, e)));
    if (!S().links().length) {
      host.appendChild(U.el("div", "rec-sub", "설정 → 외부 기록에서 링크를 추가하세요"));
    }
  }

  App.record = { render, STAMP_PHASE, isUrl };
})();
