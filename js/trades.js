/* ===========================================================
   trades.js — 매매 계획 + 집행 체크 + 계획외 카운터 + 관찰목록
   상세 매매일지(가격·수수료·누적손익·복기)는 구글시트에서 관리.
   여기서는 '계획대로 했는가'를 판정할 최소 정보만 다룬다.
   Exposes: window.App.trades
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  const MAX_PLANS = 5;   // "오늘 볼 종목 3~5개만"
  const MIN_RR = 2;      // "손익비 1:2 미만이면 후보에서 제외"

  function day(ds) { return S().peekDay(ds); }

  /* ---------- 가드레일 배너 ---------- */
  function renderGuard(ds) {
    const host = U.byId("guardBanner");
    if (!host) return;
    const g = S().guardState(ds);
    const mode = (S().state.settings.guard || {}).planViolation;
    if (!g.hits.length) {
      const st = g.stats;
      host.className = "guard ok";
      host.innerHTML = st.count
        ? `오늘 매매 <b>${st.count}건</b> · 계획외 <b>0건</b> — 계획대로 가고 있어요`
        : `아직 매매 없음 · <span style="color:var(--muted)">매매하지 않은 날도 기록을 마쳤다면 성공한 하루입니다</span>`;
      return;
    }
    host.className = "guard hit";
    host.innerHTML =
      `<div class="guard-title">⛔ 오늘 매매 종료</div>` +
      g.hits.map((h) => `<div class="guard-line">${U.esc(h.msg)}</div>`).join("") +
      (mode === "block" ? `<div class="guard-sub">매매 입력이 차단됐어요 (설정에서 변경 가능)</div>`
                        : `<div class="guard-sub">경고만 표시 중 — 설정에서 ‘입력 차단’으로 올릴 수 있어요</div>`);
  }

  function blocked(ds) {
    const g = S().guardState(ds);
    return g.blocked;
  }

  /* ---------- 매매 계획 ---------- */
  function renderPlans(ds) {
    const host = U.byId("planList");
    if (!host) return;
    const d = day(ds);
    const plans = d.plans || [];
    host.innerHTML = "";

    if (!plans.length) {
      host.appendChild(U.el("div", "empty", "08:30~09:00 사이에 오늘 매매할 종목을 적어두세요. 여기 없는 종목은 ‘계획외’로 집계됩니다."));
      return;
    }

    plans.forEach((p) => {
      const rr = S().riskReward(p);
      const excluded = rr != null && rr < MIN_RR;
      const executed = (d.trades || []).some((t) => t.planId === p.id);

      const card = U.el("div", "plan" + (excluded ? " excluded" : "") + (executed ? " executed" : ""));
      card.innerHTML =
        `<div class="plan-head">
           <b>${U.esc(p.ticker || "")}</b>
           <span class="plan-name">${U.esc(p.name || "")}</span>
           ${rr == null ? `<span class="rr none">손익비 —</span>`
             : `<span class="rr ${excluded ? "bad" : "good"}">손익비 1:${rr.toFixed(1)}</span>`}
           ${executed ? `<span class="plan-done">집행함</span>` : ""}
         </div>
         <div class="plan-nums">
           진입 <b>${U.esc(p.entry || "-")}</b> · 손절 <b>${U.esc(p.stop || "-")}</b> ·
           목표 <b>${U.esc(p.target || "-")}</b> · 수량 <b>${U.esc(p.qty || "-")}</b>
         </div>
         ${p.reason ? `<div class="plan-why">${U.esc(p.reason)}</div>` : ""}
         ${excluded ? `<div class="plan-warn">손익비 1:${MIN_RR} 미만 — 후보에서 제외하세요</div>` : ""}`;

      const act = U.el("div", "plan-act");
      if (!executed) {
        const go = U.el("button", "btn sm primary", "집행");
        go.disabled = blocked(ds);
        go.title = blocked(ds) ? "가드레일에 걸려 입력이 차단됐어요" : "계획대로 진입했음을 기록";
        go.onclick = () => execute(ds, p);
        act.appendChild(go);
      }
      const del = U.el("button", "btn sm ghost", "삭제");
      del.onclick = () => {
        const dd = S().getDay(ds);
        dd.plans = dd.plans.filter((x) => x.id !== p.id);
        S().touch(ds); App.trades.render(ds);
      };
      act.appendChild(del);
      card.appendChild(act);
      host.appendChild(card);
    });

    if (plans.length > MAX_PLANS) {
      host.appendChild(U.el("div", "plan-warn", `종목이 ${plans.length}개예요 — 3~5개로 압축하는 게 원칙입니다`));
    }
  }

  function addPlan(ds) {
    const g = (id) => (U.byId(id).value || "").trim();
    const ticker = g("plTicker"), name = g("plName");
    if (!ticker && !name) { App.ui.toast("종목을 입력해 주세요"); return; }
    const d = S().getDay(ds);
    d.plans.push({
      id: U.uid("pl"), ticker, name,
      entry: g("plEntry"), stop: g("plStop"), target: g("plTarget"),
      qty: g("plQty"), reason: g("plReason"),
    });
    S().touch(ds);
    ["plTicker", "plName", "plEntry", "plStop", "plTarget", "plQty", "plReason"].forEach((id) => (U.byId(id).value = ""));
    U.byId("plTicker").focus();
    render(ds);
  }

  function execute(ds, p) {
    const d = S().getDay(ds);
    d.trades.push({
      id: U.uid("tr"), planId: p.id, ticker: p.ticker || p.name,
      at: U.toHHMM(U.nowMin()), entry: p.entry,
    });
    S().touch(ds);
    render(ds);
    App.ui.toast("계획대로 집행 기록했어요");
  }

  /* ---------- 계획외 매매 ---------- */
  function addOffPlan(ds) {
    const inp = U.byId("offTicker");
    const ticker = (inp.value || "").trim();
    if (!ticker) { App.ui.toast("종목을 입력해 주세요"); return; }
    if (!confirm(`“${ticker}” 은 오늘 계획에 없던 종목입니다.\n계획외 매매로 기록할까요?`)) return;
    const d = S().getDay(ds);
    d.trades.push({ id: U.uid("tr"), planId: null, ticker, at: U.toHHMM(U.nowMin()) });
    S().touch(ds);
    inp.value = "";
    render(ds);
    App.ui.toast("계획외 매매로 기록했어요");
  }

  function toTomorrow(ds) {
    const inp = U.byId("offTicker");
    const ticker = (inp.value || "").trim();
    if (!ticker) { App.ui.toast("종목을 입력해 주세요"); return; }
    const d = S().getDay(ds);
    if (!d.watch.tomorrow.includes(ticker)) d.watch.tomorrow.push(ticker);
    S().touch(ds);
    inp.value = "";
    render(ds);
    App.ui.toast(`“${ticker}” 내일 관찰목록으로 보냈어요`);
  }

  /* ---------- 오늘 체결 ---------- */
  function renderTrades(ds) {
    const host = U.byId("tradeList");
    if (!host) return;
    const d = day(ds);
    const trades = d.trades || [];
    host.innerHTML = "";
    if (!trades.length) { host.appendChild(U.el("div", "empty", "오늘 집행한 매매가 없어요")); return; }

    trades.forEach((t) => {
      const row = U.el("div", "trade" + (t.planId ? "" : " off"));
      row.innerHTML =
        `<span class="trade-at">${U.esc(t.at)}</span>` +
        `<span class="trade-tk">${U.esc(t.ticker)}</span>` +
        `<span class="trade-tag">${t.planId ? "계획대로" : "계획외"}</span>`;
      const del = U.el("button", "task-del", "✕");
      del.style.opacity = "1";
      del.onclick = () => {
        const dd = S().getDay(ds);
        dd.trades = dd.trades.filter((q) => q.id !== t.id);
        S().touch(ds); render(ds);
      };
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  /* ---------- 관찰목록 ---------- */
  function renderWatch(ds) {
    const d = day(ds);
    [["watchToday", "today"], ["watchTomorrow", "tomorrow"]].forEach(([hostId, key]) => {
      const host = U.byId(hostId);
      if (!host) return;
      const list = (d.watch || {})[key] || [];
      host.innerHTML = "";
      if (!list.length) { host.appendChild(U.el("div", "empty", "비어 있음")); return; }
      list.forEach((tk, i) => {
        const chip = U.el("span", "wchip", U.esc(tk));
        const x = U.el("button", "wx", "✕");
        x.onclick = () => {
          const dd = S().getDay(ds);
          dd.watch[key].splice(i, 1);
          S().touch(ds); render(ds);
        };
        chip.appendChild(x);
        host.appendChild(chip);
      });
    });
  }

  function addWatch(key) {
    const ds = App.day.date();
    const inp = U.byId(key === "today" ? "watchTodayInp" : "watchTomorrowInp");
    const v = (inp.value || "").trim();
    if (!v) return;
    const d = S().getDay(ds);
    if (!d.watch[key].includes(v)) d.watch[key].push(v);
    S().touch(ds);
    inp.value = "";
    render(ds);
  }

  // 어제의 '내일 관찰목록' → 오늘의 관찰목록
  function carryWatch(ds) {
    const prev = S().peekDay(U.addDays(ds, -1));
    const from = (prev.watch && prev.watch.tomorrow) || [];
    if (!from.length) { App.ui.toast("어제 남긴 관찰목록이 없어요"); return; }
    const d = S().getDay(ds);
    let n = 0;
    from.forEach((tk) => { if (!d.watch.today.includes(tk)) { d.watch.today.push(tk); n++; } });
    S().touch(ds);
    render(ds);
    App.ui.toast(n ? `${n}개 가져왔어요 — 3~5개로 압축하세요` : "이미 다 가져왔어요");
  }

  /* ---------- 기타 ---------- */
  function renderNoTrade(ds) {
    const inp = U.byId("noTradeIf");
    if (!inp) return;
    inp.value = day(ds).noTradeIf || "";
  }

  function renderHeader(ds) {
    U.setText("tradeDate", U.fmtFull(ds));
    const st = S().tradeStats(ds);
    U.setText("tradeSummary",
      `계획 ${(day(ds).plans || []).length}종목 · 집행 ${st.count}건 · 계획외 ${st.offPlan}건` +
      (st.pnl == null ? "" : ` · 손익 ${st.pnl}`));
  }

  function render(ds) {
    ds = ds || App.day.date();
    renderHeader(ds);
    renderGuard(ds);
    renderNoTrade(ds);
    renderPlans(ds);
    renderTrades(ds);
    renderWatch(ds);
    const link = U.byId("tradeSheetLink");
    if (link) link.value = (day(ds).links || {}).journal || "";
    const pnl = U.byId("dayPnl");
    if (pnl) pnl.value = day(ds).pnl || "";
  }

  function init() {
    U.on("plAdd", "click", () => addPlan(App.day.date()));
    U.on("plReason", "keydown", (e) => { if (e.key === "Enter") addPlan(App.day.date()); });
    U.on("offAdd", "click", () => addOffPlan(App.day.date()));
    U.on("offTomorrow", "click", () => toTomorrow(App.day.date()));
    U.on("watchCarry", "click", () => carryWatch(App.day.date()));
    U.on("watchTodayAdd", "click", () => addWatch("today"));
    U.on("watchTomorrowAdd", "click", () => addWatch("tomorrow"));
    U.on("watchTodayInp", "keydown", (e) => { if (e.key === "Enter") addWatch("today"); });
    U.on("watchTomorrowInp", "keydown", (e) => { if (e.key === "Enter") addWatch("tomorrow"); });
    U.on("noTradeIf", "change", (e) => {
      const ds = App.day.date();
      S().getDay(ds).noTradeIf = e.target.value;
      S().touch(ds);
    });
    U.on("dayPnl", "change", (e) => {
      const ds = App.day.date();
      S().getDay(ds).pnl = e.target.value.trim();
      S().touch(ds); render(ds);
    });
    U.on("tradeSheetLink", "change", (e) => {
      const ds = App.day.date();
      S().getDay(ds).links.journal = e.target.value.trim();
      S().touch(ds); render(ds);
    });
  }

  App.trades = { init, render, blocked, MAX_PLANS, MIN_RR };
})();
