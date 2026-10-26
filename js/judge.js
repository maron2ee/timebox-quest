/* ===========================================================
   judge.js — 오늘 판정: 계획 블록을 탭으로 확정한다 (DONE을 그리지 않는다)
   했음 / 안 함 / 다른 걸 함  →  DONE 타임라인이 채워진다.
   "장중엔 기록하지 않고 읽기만", "사후 추정 금지" 원칙에 맞춘 입력 방식.
   Exposes: window.App.judge
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  let openPicker = null;   // '다른 걸 함' 카테고리 선택을 펼친 블록 key

  /* ---------- 판정 적용 ---------- */
  function apply(ds, block, verdict, catId) {
    const d = S().getDay(ds);
    if (verdict === "done") {
      block.slots.forEach((k) => { d.done[k] = { c: block.c, t: block.t }; });
      d.judged[block.key] = "done";
    } else if (verdict === "skip") {
      block.slots.forEach((k) => { delete d.done[k]; });
      d.judged[block.key] = "skip";
    } else if (verdict === "other") {
      block.slots.forEach((k) => { d.done[k] = { c: catId, t: "" }; });
      d.judged[block.key] = "other";
    } else {
      block.slots.forEach((k) => { delete d.done[k]; });
      delete d.judged[block.key];
    }
    S().touch(ds);
  }

  function applyAll(ds) {
    const blocks = S().blocksOf(ds, "plan");
    const unjudged = blocks.filter((b) => !S().verdictOf(ds, b.key));
    if (!unjudged.length) { App.ui.toast("판정할 블록이 없어요"); return; }
    unjudged.forEach((b) => apply(ds, b, "done"));
    App.day.refresh();
    App.ui.toast(`${unjudged.length}개를 계획대로 확정했어요`);
  }

  /* ---------- 렌더 ---------- */
  function render(ds) {
    const host = U.byId("judgeList");
    if (!host) return;
    const blocks = S().blocksOf(ds, "plan");
    const pr = S().judgeProgress(ds);

    const head = U.byId("judgeHead");
    if (head) {
      const inRecord = (App.routine.nowPhase() || {}).mode === "record" && U.isToday(ds);
      head.innerHTML =
        `<div class="card-label" style="margin:0">오늘 판정</div>` +
        `<span class="judge-count${pr.total && pr.done === pr.total ? " all" : ""}">${pr.done}/${pr.total}</span>` +
        (inRecord ? `<span class="judge-now">기록 구간이에요</span>` : "");
    }

    host.innerHTML = "";
    if (!blocks.length) {
      host.appendChild(U.el("div", "empty", "계획이 없어요. 타임라인 PLAN을 칠하거나 ‘🧭 루틴 적용’을 눌러보세요."));
      return;
    }

    blocks.forEach((b) => {
      const cat = S().catById(b.c);
      const v = S().verdictOf(ds, b.key);
      const row = U.el("div", "jrow" + (v ? " j-" + v : ""));

      const when = U.el("span", "jwhen", `${U.toHHMM(b.startMin)}–${U.toHHMM(b.endMin)}`);
      row.appendChild(when);

      const dot = U.el("span", "jdot");
      dot.style.background = (cat && cat.color) || "#e5e7eb";
      row.appendChild(dot);

      const label = U.el("span", "jlabel", U.esc(b.t || (cat ? cat.name : "")));
      label.title = `${U.minToKo(b.endMin - b.startMin)}`;
      row.appendChild(label);

      const acts = U.el("span", "jacts");
      [["done", "했음"], ["skip", "안 함"], ["other", "다른 걸"]].forEach(([kind, text]) => {
        const btn = U.el("button", "jbtn" + (v === kind ? " on " + kind : ""), text);
        btn.onclick = () => {
          if (kind === "other") {
            openPicker = openPicker === b.key ? null : b.key;
            render(ds);
            return;
          }
          apply(ds, b, v === kind ? null : kind);
          openPicker = null;
          App.day.refresh();
        };
        acts.appendChild(btn);
      });
      row.appendChild(acts);
      host.appendChild(row);

      // '다른 걸 함' — 카테고리 선택
      if (openPicker === b.key) {
        const pick = U.el("div", "jpick");
        S().state.categories.forEach((c) => {
          if (c.id === b.c) return;
          const chip = U.el("button", "chip", `<span class="sw" style="background:${U.esc(c.color)}"></span>${U.esc(c.name)}`);
          chip.onclick = () => {
            apply(ds, b, "other", c.id);
            openPicker = null;
            App.day.refresh();
          };
          pick.appendChild(chip);
        });
        host.appendChild(pick);
      }
    });

    // 계획에 없던 활동 (DONE 에만 있는 블록)
    const planSlots = new Set(blocks.flatMap((b) => b.slots));
    const extra = S().blocksOf(ds, "done").filter((b) => !b.slots.some((k) => planSlots.has(k)));
    if (extra.length) {
      host.appendChild(U.el("div", "jextra-k", "계획에 없던 활동"));
      extra.forEach((b) => {
        const cat = S().catById(b.c);
        const row = U.el("div", "jrow jextra");
        row.appendChild(U.el("span", "jwhen", `${U.toHHMM(b.startMin)}–${U.toHHMM(b.endMin)}`));
        const dot = U.el("span", "jdot");
        dot.style.background = (cat && cat.color) || "#e5e7eb";
        row.appendChild(dot);
        row.appendChild(U.el("span", "jlabel", U.esc(b.t || (cat ? cat.name : ""))));
        host.appendChild(row);
      });
    }
  }

  function init() {
    U.on("judgeAll", "click", () => applyAll(App.day.date()));
  }

  App.judge = { init, render, apply };
})();
