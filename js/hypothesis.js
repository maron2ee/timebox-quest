/* ===========================================================
   hypothesis.js — 아침 가설 → 장 마감 판정 루프
   "순서가 반대가 되면 가설이 아니라 사후 합리화" — 09:00 이후 수정은 기록에 남긴다.
   정책(settings.hypothesisPolicy): free(자유) / mark(수정 표시·원본 보존) / lock(잠금)
   Exposes: window.App.hypo
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  const BIAS = [
    { id: "bull",    label: "강세", tone: "up" },
    { id: "neutral", label: "중립", tone: "flat" },
    { id: "bear",    label: "약세", tone: "down" },
  ];

  function openMin() {
    const r = App.market.sessions().find((s) => s.id === "regular");
    return r ? r.startMin : 9 * 60;
  }
  function closeMin() {
    const r = App.market.sessions().find((s) => s.id === "regular");
    return r ? r.endMin : 15 * 60 + 30;
  }
  function policy() { return S().state.settings.hypothesisPolicy || "mark"; }

  function afterOpen(ds) {
    if (ds < U.today()) return true;
    if (ds > U.today()) return false;
    return U.nowMin() >= openMin();
  }
  function afterClose(ds) {
    if (ds < U.today()) return true;
    if (ds > U.today()) return false;
    return U.nowMin() >= closeMin();
  }

  function get(ds) { return S().peekDay(ds).hypothesis; }

  function patch(ds, changes) {
    const d = S().getDay(ds);
    if (!d.hypothesis) d.hypothesis = S().blankHypothesis();
    const h = d.hypothesis;
    const late = afterOpen(ds);
    const hadContent = !!(h.bias || (h.reason || "").trim());

    // 장 시작 후 첫 수정이면 09:00 시점 원본을 보존한다
    if (late && policy() === "mark" && hadContent && !h.openSnapshot) {
      h.openSnapshot = { bias: h.bias, reason: h.reason, sectors: (h.sectors || []).slice() };
    }
    if (late && hadContent) h.editedAfterOpen = true;
    // 장 시작 후에 '처음' 쓴 가설은 가설이 아니라 사후 해석 — 따로 표시한다
    if (late && !hadContent && !h.savedAt) h.lateFirstWrite = true;

    Object.assign(h, changes);
    h.savedAt = Date.now();
    S().touch(ds);
  }

  function patchVerdict(ds, changes) {
    const d = S().getDay(ds);
    if (!d.hypothesis) d.hypothesis = S().blankHypothesis();
    if (!d.hypothesis.verdict) d.hypothesis.verdict = { hit: null, sectorHit: null, note: "" };
    Object.assign(d.hypothesis.verdict, changes);
    S().touch(ds);
  }

  /* ---------- 렌더 ---------- */
  function render(ds) {
    const host = U.byId("hypoBox");
    if (!host) return;
    const h = get(ds) || S().blankHypothesis();
    const locked = policy() === "lock" && afterOpen(ds);
    const late = afterOpen(ds);
    host.innerHTML = "";

    /* 머리말 */
    const head = U.el("div", "row");
    head.innerHTML = `<div class="card-label" style="margin:0">오늘의 가설</div>`;
    const badge = U.el("span", "hypo-badge ml-auto");
    if (!h.bias && !(h.reason || "").trim()) {
      badge.className += late ? " warn" : " todo";
      badge.textContent = late ? "미작성 (장 시작 지남)" : `${U.toHHMM(openMin())} 전에 작성`;
    } else if (h.lateFirstWrite) {
      badge.className += " warn";
      badge.textContent = "장 시작 후 작성됨";
      badge.title = "장이 열린 뒤에 쓴 건 가설이 아니라 사후 해석이에요. 적중률 집계에서 구분됩니다.";
    } else if (h.editedAfterOpen) {
      badge.className += " edited";
      badge.textContent = "장 시작 후 수정됨";
      badge.title = "09:00 시점 원본이 아래에 보존돼 있어요";
    } else {
      badge.className += " ok";
      badge.textContent = `${U.toHHMM(openMin())} 전 확정`;
    }
    head.appendChild(badge);
    host.appendChild(head);

    /* 방향 */
    const biasRow = U.el("div", "bias-row");
    BIAS.forEach((b) => {
      const btn = U.el("button", "bias " + b.tone + (h.bias === b.id ? " on" : ""), b.label);
      btn.disabled = locked;
      btn.onclick = () => { patch(ds, { bias: b.id }); App.day.refresh(); };
      biasRow.appendChild(btn);
    });
    host.appendChild(biasRow);

    /* 근거 */
    const reason = U.el("input", "hypo-inp");
    reason.placeholder = "근거 한 줄 — 왜 그렇게 보는가";
    reason.value = h.reason || "";
    reason.disabled = locked;
    reason.onchange = () => { patch(ds, { reason: reason.value }); App.day.refresh(); };
    host.appendChild(reason);

    /* 예상 주도 섹터 */
    const secRow = U.el("div", "sec-row");
    secRow.appendChild(U.el("span", "sec-k", "주도 섹터"));
    [0, 1].forEach((i) => {
      const s = U.el("input", "sec-inp");
      s.placeholder = i === 0 ? "예상 1" : "예상 2";
      s.value = (h.sectors || [])[i] || "";
      s.disabled = locked;
      s.onchange = () => {
        const arr = (get(ds) && get(ds).sectors ? get(ds).sectors.slice() : ["", ""]);
        arr[i] = s.value;
        patch(ds, { sectors: arr });
      };
      secRow.appendChild(s);
    });
    host.appendChild(secRow);

    /* 원본 보존 표시 */
    if (h.openSnapshot) {
      const o = h.openSnapshot;
      const ob = BIAS.find((b) => b.id === o.bias);
      host.appendChild(U.el("div", "hypo-orig",
        `09:00 원본 — <b>${ob ? ob.label : "미선택"}</b>${o.reason ? " · " + U.esc(o.reason) : ""}`));
    }

    /* 판정 (장 마감 후) */
    if (afterClose(ds)) host.appendChild(verdictEl(ds, h));
    else if (h.bias) host.appendChild(U.el("div", "hypo-wait", `판정은 ${U.toHHMM(closeMin())} 이후에 열려요`));
  }

  function verdictEl(ds, h) {
    const v = h.verdict || { hit: null, sectorHit: null, note: "" };
    const wrap = U.el("div", "verdict");
    wrap.appendChild(U.el("div", "card-label", "판정"));

    const mk = (key, label) => {
      const row = U.el("div", "verdict-row");
      row.appendChild(U.el("span", "verdict-k", label));
      [["적중", true], ["빗나감", false]].forEach(([t, val]) => {
        const b = U.el("button", "vbtn" + (v[key] === val ? (val ? " hit" : " miss") : ""), t);
        b.onclick = () => { patchVerdict(ds, { [key]: v[key] === val ? null : val }); App.day.refresh(); };
        row.appendChild(b);
      });
      return row;
    };
    wrap.appendChild(mk("hit", "방향"));
    wrap.appendChild(mk("sectorHit", "섹터"));

    const note = U.el("input", "hypo-inp");
    note.placeholder = "달랐다면 왜 달랐는지 한 줄";
    note.value = v.note || "";
    note.onchange = () => patchVerdict(ds, { note: note.value });
    wrap.appendChild(note);
    return wrap;
  }

  /* ---------- 통계용 ---------- */
  // 기간 내 가설 적중률
  function accuracy(from, to) {
    let total = 0, hit = 0, secTotal = 0, secHit = 0;
    let written = 0, edited = 0, lateFirst = 0;
    let cleanJudged = 0, cleanHit = 0;   // 09:00 전에 확정된 '진짜 가설'만
    U.rangeDays(from, to).forEach((ds) => {
      const h = S().peekDay(ds).hypothesis;
      if (!h || (!h.bias && !(h.reason || "").trim())) return;
      written++;
      if (h.lateFirstWrite) lateFirst++;
      else if (h.editedAfterOpen) edited++;
      const v = h.verdict || {};
      if (v.hit != null) {
        total++; if (v.hit) hit++;
        if (!h.lateFirstWrite && !h.editedAfterOpen) { cleanJudged++; if (v.hit) cleanHit++; }
      }
      if (v.sectorHit != null) { secTotal++; if (v.sectorHit) secHit++; }
    });
    return {
      written, edited, lateFirst,
      judged: total,
      rate: total ? Math.round((hit / total) * 100) : null,
      cleanJudged,
      cleanRate: cleanJudged ? Math.round((cleanHit / cleanJudged) * 100) : null,
      sectorRate: secTotal ? Math.round((secHit / secTotal) * 100) : null,
    };
  }

  App.hypo = { render, accuracy, BIAS, afterOpen, afterClose, openMin, closeMin };
})();
