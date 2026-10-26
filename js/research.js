/* ===========================================================
   research.js — 종목 리서치 '링크 인덱스' (2축 분류)
   본문 분석은 노션. 여기엔 분류 · 링크 · 한 줄 결론만.
   축① 구분(kind)   — 종목 / 테마·섹터 / 매크로 / 리포트 / 이벤트
   축② 스탠스(stance) — 관심 / 후보 / 보유 / 보류 / 폐기
   Exposes: window.App.research
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let q = "", fKind = "", fStance = "", fSector = "";
  const openBody = {};

  function all() { return S().state.research; }
  function isUrl(v) { return /^https?:\/\//i.test((v || "").trim()); }

  function sectors() {
    const set = new Set();
    all().forEach((r) => { const s = (r.sector || "").trim(); if (s) set.add(s); });
    return Array.from(set).sort();
  }

  function match(r) {
    if (fKind && r.kind !== fKind) return false;
    if (fStance && r.stance !== fStance) return false;
    if (fSector && (r.sector || "").trim() !== fSector) return false;
    if (!q) return true;
    return [r.ticker, r.name, r.sector, r.note].join(" ").toLowerCase().includes(q.toLowerCase());
  }

  // 스탠스 순서대로(후보·보유 먼저), 그다음 최근 수정순
  const STANCE_ORDER = { cand: 0, hold: 1, watch: 2, pause: 3, drop: 4 };
  function list() {
    return all().filter(match).sort((a, b) => {
      const d = (STANCE_ORDER[a.stance] ?? 9) - (STANCE_ORDER[b.stance] ?? 9);
      if (d) return d;
      return (b.updated || b.date || "").localeCompare(a.updated || a.date || "");
    });
  }

  function add() {
    const g = (id) => (U.byId(id).value || "").trim();
    const ticker = g("rsTicker").toUpperCase(), name = g("rsName");
    if (!ticker && !name) { App.ui.toast("종목명 또는 티커를 입력해 주세요"); return; }
    all().unshift({
      id: U.uid("rs"), ticker, name,
      kind: g("rsKind") || "stock", stance: g("rsStance") || "watch",
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

  /* ---------- 필터 ---------- */
  function chipRow(hostId, label, items, cur, onPick) {
    const host = U.byId(hostId);
    if (!host) return;
    host.innerHTML = "";
    host.appendChild(U.el("span", "filter-k", label));
    const mk = (text, val) => {
      const b = U.el("button", "chip" + (cur === val ? " active" : ""), U.esc(text));
      b.onclick = () => onPick(cur === val ? "" : val);
      return b;
    };
    host.appendChild(mk("전체", ""));
    items.forEach((it) => host.appendChild(mk(it.name, it.id)));
  }

  function renderFilters() {
    chipRow("rsKinds", "구분", S().RS_KINDS, fKind, (v) => { fKind = v; render(); });
    chipRow("rsStances", "스탠스", S().RS_STANCES, fStance, (v) => { fStance = v; render(); });
    const secs = sectors().map((s) => ({ id: s, name: "#" + s }));
    const host = U.byId("rsSectors");
    if (host) {
      if (!secs.length) host.innerHTML = "";
      else chipRow("rsSectors", "섹터", secs, fSector, (v) => { fSector = v; render(); });
    }
  }

  /* ---------- 목록 ---------- */
  function selectEl(cls, options, value, onChange) {
    const sel = U.el("select", cls);
    options.forEach((o) => {
      const op = U.el("option", null, U.esc(o.name));
      op.value = o.id;
      if (o.id === value) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = () => onChange(sel.value);
    return sel;
  }

  function render() {
    renderFilters();
    const host = U.byId("rsList");
    if (!host) return;
    const rows = list();
    U.setText("rsCount", all().length ? `${rows.length} / ${all().length}건` : "");

    if (!rows.length) {
      host.innerHTML = `<div class="card card-pad"><div class="empty">${
        all().length ? "조건에 맞는 항목이 없어요"
                     : "분석은 노션에 쓰고, 여기엔 <b>분류 · 링크 · 한 줄 결론</b>만 쌓아두세요.<br>08:30 매매 계획 세울 때 <b>스탠스 = 후보</b>만 눌러 보면 됩니다."
      }</div></div>`;
      return;
    }

    host.innerHTML = "";
    rows.forEach((r) => {
      const card = U.el("div", "rsrow card st-" + r.stance);

      const head = U.el("div", "rsrow-head");
      if (r.ticker) head.appendChild(U.el("span", "rs-ticker", U.esc(r.ticker)));

      const name = U.el("input", "rs-name");
      name.value = r.name || "";
      name.placeholder = "이름";
      name.onchange = () => { r.name = name.value.trim(); touch(r); render(); };
      head.appendChild(name);

      head.appendChild(selectEl("rs-kind", S().RS_KINDS, r.kind,
        (v) => { r.kind = v; touch(r); render(); }));
      head.appendChild(selectEl("rs-stance s-" + r.stance, S().RS_STANCES, r.stance,
        (v) => { r.stance = v; touch(r); render(); }));

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
        if (!confirm(`“${r.ticker || r.name}” 를 인덱스에서 지울까요? (노션 문서는 그대로예요)`)) return;
        S().state.research = all().filter((x) => x.id !== r.id);
        S().save(); render();
      };
      head.appendChild(del);
      card.appendChild(head);

      const url = U.el("input", "rs-url" + (r.url && !isUrl(r.url) ? " bad" : ""));
      url.value = r.url || "";
      url.placeholder = "노션 링크 (https://...)";
      url.onchange = () => { r.url = url.value.trim(); touch(r); render(); };
      card.appendChild(url);

      const note = U.el("input", "rs-note");
      note.value = r.note || "";
      note.placeholder = "한 줄 결론 — 왜 이 스탠스인가";
      note.onchange = () => { r.note = note.value.trim(); touch(r); };
      card.appendChild(note);

      if ((r.body || "").trim()) {
        const t = U.el("button", "rs-oldtoggle", openBody[r.id] ? "예전 메모 접기" : "예전 메모 보기");
        t.onclick = () => { openBody[r.id] = !openBody[r.id]; render(); };
        card.appendChild(t);
        if (openBody[r.id]) {
          card.appendChild(U.el("pre", "rs-old", U.esc(r.body)));
          card.appendChild(U.el("div", "rs-oldhint", "노션으로 옮긴 뒤 아래 버튼으로 정리하세요"));
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
    // 새 항목 폼의 구분/스탠스 드롭다운 채우기
    const k = U.byId("rsKind"), st = U.byId("rsStance");
    if (k) k.innerHTML = S().RS_KINDS.map((x) => `<option value="${x.id}">${U.esc(x.name)}</option>`).join("");
    if (st) st.innerHTML = S().RS_STANCES.map((x) => `<option value="${x.id}">${U.esc(x.name)}</option>`).join("");
  }

  App.research = { init, render, match, isUrl };
})();
