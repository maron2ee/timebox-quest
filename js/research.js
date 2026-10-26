/* ===========================================================
   research.js — 종목 리서치 '링크 인덱스'
   본문 분석은 노션에서 쓴다. 여기엔 종목·섹터·링크·한 줄 결론만 둔다.
   item = {id, ticker, name, sector, url, note, body?, date, updated}
     body 는 예전(앱 내 작성) 메모. 읽기 전용으로 보존만 한다.
   Exposes: window.App.research
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let q = "";
  let sector = "";          // 섹터 필터 ("" = 전체)
  const openBody = {};      // 예전 메모 펼침 상태

  function all() { return S().state.research; }

  function isUrl(v) { return /^https?:\/\//i.test((v || "").trim()); }

  function sectors() {
    const set = new Set();
    all().forEach((r) => { const s = (r.sector || "").trim(); if (s) set.add(s); });
    return Array.from(set).sort();
  }

  function match(r) {
    if (sector && (r.sector || "").trim() !== sector) return false;
    if (!q) return true;
    return [r.ticker, r.name, r.sector, r.note].join(" ").toLowerCase().includes(q.toLowerCase());
  }

  function list() {
    return all().filter(match)
      .sort((a, b) => (b.updated || b.date || "").localeCompare(a.updated || a.date || ""));
  }

  /* ---------- 추가 ---------- */
  function add() {
    const g = (id) => (U.byId(id).value || "").trim();
    const ticker = g("rsTicker").toUpperCase(), name = g("rsName");
    if (!ticker && !name) { App.ui.toast("티커 또는 종목명을 입력해 주세요"); return; }
    all().unshift({
      id: U.uid("rs"), ticker, name,
      sector: g("rsSector"), url: g("rsUrl"), note: "", body: "",
      date: U.today(), updated: U.today(),
    });
    S().save();
    ["rsTicker", "rsName", "rsSector", "rsUrl"].forEach((id) => (U.byId(id).value = ""));
    U.byId("rsTicker").focus();
    render();
    App.ui.toast("인덱스에 추가했어요");
  }

  function touch(r) { r.updated = U.today(); S().save(); }

  /* ---------- 렌더 ---------- */
  function renderFilters() {
    const host = U.byId("rsSectors");
    if (!host) return;
    const list = sectors();
    if (!list.length) { host.innerHTML = ""; return; }
    host.innerHTML = "";
    const mk = (label, val) => {
      const b = U.el("button", "chip" + (sector === val ? " active" : ""), U.esc(label));
      b.onclick = () => { sector = sector === val ? "" : val; render(); };
      return b;
    };
    host.appendChild(mk("전체", ""));
    list.forEach((s) => host.appendChild(mk("#" + s, s)));
  }

  function render() {
    renderFilters();
    const host = U.byId("rsList");
    if (!host) return;
    const rows = list();

    U.setText("rsCount", all().length ? `${rows.length} / ${all().length}종목` : "");

    if (!rows.length) {
      host.innerHTML = `<div class="card card-pad"><div class="empty">${
        all().length ? "조건에 맞는 종목이 없어요"
                     : "분석은 노션에 쓰고, 여기엔 <b>종목 · 섹터 · 링크</b>만 쌓아두세요.<br>매매 계획 세울 때 “이 종목 리서치가 있었나”를 바로 확인할 수 있어요."
      }</div></div>`;
      return;
    }

    host.innerHTML = "";
    rows.forEach((r) => {
      const card = U.el("div", "rsrow card");

      /* 윗줄: 티커 · 종목명 · 섹터 · 수정일 · 버튼 */
      const head = U.el("div", "rsrow-head");
      head.appendChild(U.el("span", "rs-ticker", U.esc(r.ticker || "")));

      const name = U.el("input", "rs-name");
      name.value = r.name || "";
      name.placeholder = "종목명";
      name.onchange = () => { r.name = name.value.trim(); touch(r); render(); };
      head.appendChild(name);

      const sec = U.el("input", "rs-sector");
      sec.value = r.sector || "";
      sec.placeholder = "섹터";
      sec.onchange = () => { r.sector = sec.value.trim(); touch(r); render(); };
      head.appendChild(sec);

      head.appendChild(U.el("span", "rs-when", U.esc(r.updated || r.date || "")));

      if (isUrl(r.url)) {
        const go = U.el("a", "btn sm", "노션 열기");
        go.href = r.url; go.target = "_blank"; go.rel = "noopener noreferrer";
        head.appendChild(go);
      }

      const del = U.el("button", "icon-btn", "✕");
      del.title = "삭제";
      del.onclick = () => {
        if (!confirm(`“${r.ticker || r.name}” 를 인덱스에서 지울까요? (노션 문서는 그대로 있어요)`)) return;
        S().state.research = all().filter((x) => x.id !== r.id);
        S().save(); render();
      };
      head.appendChild(del);
      card.appendChild(head);

      /* 아랫줄: 링크 + 한 줄 결론 */
      const url = U.el("input", "rs-url" + (r.url && !isUrl(r.url) ? " bad" : ""));
      url.value = r.url || "";
      url.placeholder = "노션 링크 (https://...)";
      url.onchange = () => { r.url = url.value.trim(); touch(r); render(); };
      card.appendChild(url);

      const note = U.el("input", "rs-note");
      note.value = r.note || "";
      note.placeholder = "한 줄 결론 — 지금 내 스탠스 (관심 / 분할매수 / 보류 / 폐기)";
      note.onchange = () => { r.note = note.value.trim(); touch(r); };
      card.appendChild(note);

      /* 예전 앱 메모가 있으면 보존해서 보여준다 */
      if ((r.body || "").trim()) {
        const t = U.el("button", "rs-oldtoggle", openBody[r.id] ? "예전 메모 접기" : "예전 메모 보기");
        t.onclick = () => { openBody[r.id] = !openBody[r.id]; render(); };
        card.appendChild(t);
        if (openBody[r.id]) {
          const pre = U.el("pre", "rs-old", U.esc(r.body));
          card.appendChild(pre);
          const mv = U.el("div", "rs-oldhint", "노션으로 옮긴 뒤 아래 버튼으로 정리하세요");
          card.appendChild(mv);
          const clr = U.el("button", "btn sm", "예전 메모 지우기");
          clr.onclick = () => {
            if (!confirm("예전 메모를 지울까요? 되돌릴 수 없어요.")) return;
            r.body = ""; touch(r); render();
          };
          card.appendChild(clr);
        }
      }

      host.appendChild(card);
    });
  }

  function init() {
    U.on("rsAdd", "click", add);
    ["rsTicker", "rsName", "rsSector", "rsUrl"].forEach((id) =>
      U.on(id, "keydown", (e) => { if (e.key === "Enter") add(); }));
    U.on("rsQ", "input", (e) => { q = e.target.value; render(); });
  }

  App.research = { init, render, match, isUrl };
})();
