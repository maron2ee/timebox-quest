/* ===========================================================
   record.js — 링크 허브(아이콘 버튼 줄) + 확정 도장 구간 id
   숫자는 2층(구글시트), 서술은 3층(노션 데일리 노트)에 있다.
   앱은 그 둘로 가는 길 + 시트가 못 하는 '언제 확정했는가'만 담당한다.
   링크는 전부 아이콘 버튼으로만 보인다 — 주소는 화면에 노출하지 않는다.
   Exposes: window.App.record
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  // 가설·매매계획을 확정하는 구간 (기본 pre = 장 시작 전 07:30~09:00, 09:00에 잠김 — 꼭 항목을 다 하면 확정)
  const STAMP_PHASE = "pre";

  function isUrl(v) { return /^https?:\/\//i.test((v || "").trim()); }

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

  // 링크 버튼 줄 — 박스·제목 없이 아이콘 버튼만 (2026-11-19: '오늘의 기록' 박스와 가설 확정 박스를 걷어냄)
  function render(ds) {
    const host = U.byId("linkRow");
    if (!host) return;
    host.innerHTML = "";
    S().links().forEach((e) => host.appendChild(linkButton(ds, e)));
    host.hidden = !host.children.length;
  }

  App.record = { render, STAMP_PHASE, isUrl };
})();
