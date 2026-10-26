/* ===========================================================
   day.js — 하루 계획 화면 (날짜네비 · 스탯 · Goal · Big3 · Review)
   Exposes: window.App.day
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let ds = U.today();

  function date() { return ds; }
  function goto(next) { ds = next; refresh(); }

  /* ---------- 상단 스탯 ---------- */
  function renderHeader() {
    const d = U.parseYmd(ds);
    U.setText("dYear", d.getFullYear() + "년");
    U.setText("dDate", U.fmtMD(ds));
    const chip = U.byId("dToday");
    if (chip) chip.classList.toggle("on", U.isToday(ds));

    // D-day
    const up = S().upcomingDdays(1)[0];
    if (up) {
      U.setText("ddayLabel", up.label);
      U.setText("ddayValue", U.dday(up.date, ds));
      U.setText("ddaySub", U.fmtSlash(up.date));
    } else {
      U.setText("ddayLabel", "D-day");
      U.setText("ddayValue", "＋");
      U.setText("ddaySub", "눌러서 추가");
    }

    // 학습시간
    const doneStudy = S().studyMin(ds, "done");
    const planStudy = S().studyMin(ds, "plan");
    U.setText("studyVal", U.minToKo(doneStudy));
    U.setText("studySub", `계획 ${U.minToKo(planStudy)}`);

    // Todo
    const st = S().taskStats(ds);
    U.setText("todoVal", `${st.done}/${st.total}`);
    const seg = U.byId("todoSeg");
    if (seg) {
      const n = Math.min(st.total, 14);
      seg.innerHTML = n
        ? Array.from({ length: n }, (_, i) => `<span class="seg${i < st.done ? " on" : ""}"></span>`).join("")
        : `<span class="seg"></span>`;
    }
  }

  /* ---------- Goal ---------- */
  function renderGoal() {
    const ta = U.byId("goalText");
    if (!ta) return;
    ta.value = S().peekDay(ds).goal || "";
  }
  function bindGoal() {
    const ta = U.byId("goalText");
    if (!ta) return;
    const save = U.debounce(() => { S().getDay(ds).goal = ta.value; S().touch(ds); }, 350);
    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = Math.max(76, ta.scrollHeight) + "px";
      save();
    });
  }

  /* ---------- Big 3 ---------- */
  function renderBig3() {
    const host = U.byId("big3List");
    if (!host) return;
    const big3 = S().peekDay(ds).big3 || ["", "", ""];
    host.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const row = U.el("div", "big3-row" + (big3[i] ? " filled" : ""));
      row.appendChild(U.el("span", "big3-n", String(i + 1)));
      const inp = U.el("input");
      inp.value = big3[i] || "";
      inp.placeholder = i === 0 ? "오늘 반드시 끝낼 일" : "";
      inp.onchange = () => {
        const d = S().getDay(ds);
        d.big3[i] = inp.value;
        S().touch(ds);
        row.classList.toggle("filled", !!inp.value);
      };
      inp.onkeydown = (e) => {
        if (e.key !== "Enter") return;
        inp.blur();
        const next = host.querySelectorAll("input")[i + 1];
        if (next) next.focus();
      };
      row.appendChild(inp);
      host.appendChild(row);
    }
  }

  /* ---------- Daily Review (K/P/T) ---------- */
  const RV = [
    { k: "k", label: "K", ph: "계속할 것 (Keep)" },
    { k: "p", label: "P", ph: "아쉬운 것 (Problem)" },
    { k: "t", label: "T", ph: "다음에 시도할 것 (Try)" },
  ];
  function renderReview() {
    const host = U.byId("reviewList");
    if (!host) return;
    const rv = S().peekDay(ds).review || { k: "", p: "", t: "" };
    host.innerHTML = "";
    RV.forEach((r) => {
      const row = U.el("div", "review-row");
      row.appendChild(U.el("span", "review-k " + r.k, r.label));
      const inp = U.el("input");
      inp.value = rv[r.k] || "";
      inp.placeholder = r.ph;
      inp.onchange = () => { S().getDay(ds).review[r.k] = inp.value; S().touch(ds); };
      inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); };
      row.appendChild(inp);
      host.appendChild(row);
    });
  }

  /* ---------- D-day 모달 ---------- */
  function renderDdayList() {
    const host = U.byId("ddayList");
    if (!host) return;
    const list = S().state.ddays.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) { host.innerHTML = `<div class="empty">등록된 D-day가 없어요</div>`; return; }
    host.innerHTML = "";
    list.forEach((x) => {
      const row = U.el("div", "task");
      row.appendChild(U.el("span", "task-text", `<b>${U.esc(x.label)}</b> · ${U.esc(x.date)} · ${U.dday(x.date)}`));
      const del = U.el("button", "task-del", "✕");
      del.style.opacity = "1";
      del.onclick = () => {
        S().state.ddays = S().state.ddays.filter((q) => q.id !== x.id);
        S().save(); renderDdayList(); renderHeader();
      };
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  function bindDday() {
    U.on("ddayCard", "click", () => { renderDdayList(); App.ui.openModal("ddayModal"); });
    U.on("ddayClose", "click", () => App.ui.closeModal("ddayModal"));
    U.on("ddayAdd", "click", () => {
      const name = (U.byId("ddayName").value || "").trim();
      const date = U.byId("ddayDate").value;
      if (!name || !date) { App.ui.toast("이름과 날짜를 입력해 주세요"); return; }
      S().state.ddays.push({ id: U.uid("dd"), label: name, date });
      S().save();
      U.byId("ddayName").value = "";
      U.byId("ddayDate").value = "";
      renderDdayList(); renderHeader();
    });
  }

  /* ---------- 전체 갱신 ---------- */
  function refresh() {
    renderHeader();
    renderGoal();
    renderBig3();
    renderReview();
    App.hypo.render(ds);
    App.tasks.render(ds);      // 루틴 탭이면 내부에서 routine.render 호출
    App.routine.render(ds);    // 레일·배너는 항상
    App.timeline.render(ds);
    if (App.nav && App.nav.current === "trade") App.trades.render(ds);
  }

  function init() {
    U.on("dPrev", "click", () => goto(U.addDays(ds, -1)));
    U.on("dNext", "click", () => goto(U.addDays(ds, 1)));
    U.on("dToday", "click", () => goto(U.today()));
    bindGoal();
    bindDday();

    // ←/→ 로 날짜 이동 (입력 중이 아닐 때만)
    document.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!U.byId("view-day").classList.contains("active")) return;
      if (e.key === "ArrowLeft") goto(U.addDays(ds, -1));
      if (e.key === "ArrowRight") goto(U.addDays(ds, 1));
    });

    // 현재 시각 선 갱신
    setInterval(() => {
      if (U.isToday(ds) && U.byId("view-day").classList.contains("active")) App.timeline.render(ds);
    }, 60000);
  }

  App.day = { init, refresh, date, goto };
})();
