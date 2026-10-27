/* ===========================================================
   record.js — '오늘의 기록' 허브
   숫자는 2층(구글시트), 서술은 3층(노션 데일리 노트)에 있다.
   앱은 그 둘로 가는 길 + 시트가 못 하는 '언제 확정했는가'만 담당한다.
   링크는 전부 아이콘 버튼으로만 보인다 — 주소는 화면에 노출하지 않는다.
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

  // 주소를 입력받아 저장한다. 비우면 취소.
  function promptUrl(ds, entry) {
    const cur = S().linkUrl(ds, entry);
    const v = window.prompt(`${entry.label} 링크`, cur || "https://");
    if (v == null) return;
    S().setLinkUrl(ds, entry, v.trim());
    render(ds);
  }

  // 링크 하나 = 아이콘 버튼 하나(+ 작은 수정 버튼). 주소는 화면에 노출하지 않는다.
  function linkButton(ds, entry) {
    const url = S().linkUrl(ds, entry);
    const label = `${entry.icon || "🔗"} ${entry.label}`;
    const group = U.el("span", "link-btn-group");

    const btn = U.el("button", "quick-btn" + (isUrl(url) ? "" : " off"), U.esc(label));
    if (isUrl(url)) {
      btn.title = entry.daily ? "오늘 링크 열기" : "열기";
      btn.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
    } else {
      btn.title = "눌러서 링크 추가";
      btn.onclick = () => promptUrl(ds, entry);
    }
    group.appendChild(btn);

    const edit = U.el("button", "link-edit-btn", "✎");
    edit.title = "링크 바꾸기";
    edit.onclick = (e) => { e.stopPropagation(); promptUrl(ds, entry); };
    group.appendChild(edit);

    return group;
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

    const all = S().links();
    if (!all.length) {
      host.appendChild(U.el("div", "rec-sub", "설정 → 외부 기록 링크에서 추가하세요"));
      return;
    }
    const links = U.el("div", "rec-links");
    all.forEach((e) => links.appendChild(linkButton(ds, e)));
    host.appendChild(links);
  }

  App.record = { render, STAMP_PHASE, isUrl };
})();
