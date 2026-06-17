/* ===========================================================
   app.js — bootstrap, tabs, HUD, modals, settings, glue
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;

  /* ---------- modal infra (with focus trap) ---------- */
  let lastFocused = null;
  App.ui = {
    openModal(id) {
      lastFocused = document.activeElement;
      const root = document.getElementById("modalRoot");
      root.classList.remove("hidden");
      document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
      const modal = document.getElementById(id);
      modal.classList.remove("hidden");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const focusable = modal.querySelector("input, select, button");
      if (focusable) setTimeout(() => focusable.focus(), 30);
    },
    closeModals() {
      document.getElementById("modalRoot").classList.add("hidden");
      if (lastFocused && lastFocused.focus) try { lastFocused.focus(); } catch (e) {}
    },
  };

  /* ---------- undo history ---------- */
  const undoStack = [];
  App.history = {
    snapshot() { try { undoStack.push(App.store.raw()); if (undoStack.length > 25) undoStack.shift(); } catch (e) {} },
    undo() {
      if (!undoStack.length) { App.gamify.toast("되돌릴 작업이 없어요"); return; }
      try { App.store.replaceState(JSON.parse(undoStack.pop())); } catch (e) { return; }
      App.planner.render();
      App.refreshAll();
      if (document.getElementById("view-settings").classList.contains("active")) renderSettings();
      if (document.getElementById("view-codex").classList.contains("active")) App.character.renderCollection();
      App.gamify.toast("↩︎ 되돌렸어요");
    },
  };

  /* ---------- HUD ---------- */
  function updateHud() {
    const info = App.gamify.refresh(true);
    document.getElementById("hudLevel").textContent = info.level;
    document.getElementById("hudXpFill").style.width = info.pct + "%";
    document.getElementById("hudXpText").textContent = `${info.into} / ${info.span} XP`;
    document.getElementById("hudStreak").textContent = App.stats.currentStreak();
    const h = App.stats.totalDoneMinutes() / 60;
    document.getElementById("hudHours").textContent = Number.isInteger(h) ? h : h.toFixed(1);
  }

  /* ---------- central refresh ---------- */
  App.refreshAll = function (skipPush) {
    updateHud();
    if (App.character) App.character.render(true);
    App.planner.renderSummary();
    if (document.getElementById("view-stats").classList.contains("active")) App.analytics.render();
    if (document.getElementById("view-settings").classList.contains("active")) renderSettings();
    if (!skipPush && App.sync && App.sync.isSignedIn()) App.sync.schedulePush();
  };

  /* ---------- tabs ---------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = () => {
        const view = tab.dataset.view;
        document.querySelectorAll(".tab").forEach((t) => {
          const on = t === tab;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        document.getElementById("view-" + view).classList.add("active");
        if (view === "stats") { App.analytics.render(); App.character.renderMini(); }
        if (view === "codex") App.character.renderCollection();
        if (view === "settings") renderSettings();
        if (view === "planner") App.planner.render();
      };
    });
  }

  /* ---------- settings: day options ---------- */
  function initSettings() {
    const startSel = document.getElementById("setStart");
    const endSel = document.getElementById("setEnd");
    for (let h = 0; h <= 23; h++) startSel.add(new Option(U.pad(h) + ":00", h));
    for (let h = 1; h <= 24; h++) endSel.add(new Option((h === 24 ? "24" : U.pad(h)) + ":00", h));

    const s = App.state.settings;
    startSel.value = s.dayStartHour;
    endSel.value = s.dayEndHour;
    document.getElementById("setSlot").value = s.slotMinutes;
    document.getElementById("setTarget").value = s.completionTarget;
    document.getElementById("setSound").checked = s.sound;

    document.getElementById("setWeekStart").value = s.weekStart;
    document.getElementById("setCompact").checked = s.compact;
    document.getElementById("setAutoTpl").checked = s.autoTemplate;

    const onDayChange = () => {
      s.dayStartHour = +startSel.value;
      s.dayEndHour = Math.max(+startSel.value + 1, +endSel.value);
      endSel.value = s.dayEndHour;
      s.slotMinutes = +document.getElementById("setSlot").value;
      s.completionTarget = +document.getElementById("setTarget").value;
      s.weekStart = +document.getElementById("setWeekStart").value;
      s.compact = document.getElementById("setCompact").checked;
      s.autoTemplate = document.getElementById("setAutoTpl").checked;
      App.store.save();
      App.planner.render();
      App.refreshAll();
    };
    startSel.onchange = onDayChange;
    endSel.onchange = onDayChange;
    document.getElementById("setSlot").onchange = onDayChange;
    document.getElementById("setTarget").onchange = onDayChange;
    document.getElementById("setWeekStart").onchange = onDayChange;
    document.getElementById("setCompact").onchange = onDayChange;
    document.getElementById("setAutoTpl").onchange = onDayChange;
    document.getElementById("setSound").onchange = () => {
      s.sound = document.getElementById("setSound").checked;
      App.store.save();
      if (s.sound) App.gamify.sfx.complete();
    };
    document.getElementById("setPixel").checked = s.pixel;
    document.getElementById("setPixel").onchange = () => {
      s.pixel = document.getElementById("setPixel").checked;
      document.body.classList.toggle("pixel", s.pixel);
      App.store.save();
      App.gamify.toast(s.pixel ? "🕹️ 레트로 픽셀 모드 ON" : "✨ 모던 모드 ON");
    };
    document.getElementById("setReminder").checked = s.reminderEnabled;
    document.getElementById("setReminderTime").value = s.reminderTime;
    document.getElementById("setReminder").onchange = () => {
      s.reminderEnabled = document.getElementById("setReminder").checked;
      if (s.reminderEnabled && window.Notification && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch (e) {}
      }
      App.store.save();
    };
    document.getElementById("setReminderTime").onchange = () => {
      s.reminderTime = document.getElementById("setReminderTime").value || "21:00";
      App.store.save();
    };

    document.getElementById("addCatBtn").onclick = () => openCatModal(null);
    document.getElementById("catModalSave").onclick = saveCatModal;
    document.getElementById("catModalDelete").onclick = deleteCatModal;

    // backup
    document.getElementById("exportBtn").onclick = exportData;
    document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
    document.getElementById("importFile").onchange = importData;
    document.getElementById("resetBtn").onclick = () => {
      if (confirm("정말 모든 데이터를 초기화할까요? (Ctrl+Z로 되돌릴 수 있어요)")) {
        App.history.snapshot();
        App.store.reset();
        App.planner.render();
        App.refreshAll();
        renderSettings();
        App.gamify.toast("초기화되었습니다");
      }
    };

    // sync chip → settings tab
    document.getElementById("syncBtn").onclick = () => {
      document.querySelector('.tab[data-view="settings"]').click();
    };
  }

  function renderSettings() {
    // keep day-setting controls in sync with current state (after import/pull/reset)
    const s = App.state.settings;
    const startSel = document.getElementById("setStart");
    const endSel = document.getElementById("setEnd");
    if (startSel && startSel.options.length) {
      startSel.value = s.dayStartHour;
      endSel.value = s.dayEndHour;
      document.getElementById("setSlot").value = s.slotMinutes;
      document.getElementById("setTarget").value = s.completionTarget;
      document.getElementById("setSound").checked = s.sound;
      document.getElementById("setWeekStart").value = s.weekStart;
      document.getElementById("setCompact").checked = s.compact;
      document.getElementById("setPixel").checked = s.pixel;
      document.getElementById("setAutoTpl").checked = s.autoTemplate;
      document.getElementById("setReminder").checked = s.reminderEnabled;
      document.getElementById("setReminderTime").value = s.reminderTime;
    }

    const list = document.getElementById("catList");
    list.innerHTML = "";
    App.state.categories.forEach((c) => {
      const row = document.createElement("div");
      row.className = "cat-item";
      row.innerHTML =
        `<span class="cat-swatch" style="background:${c.color}"></span>` +
        `<span class="ci-name">${c.emoji} ${c.name}</span>` +
        `<span class="ci-target">${c.target > 0 ? "목표 " + U.minToH(c.target) : ""}</span>`;
      const edit = document.createElement("button");
      edit.className = "pixel-btn tiny";
      edit.textContent = "편집";
      edit.onclick = () => openCatModal(c.id);
      row.appendChild(edit);
      list.appendChild(row);
    });
  }

  /* ---------- category modal ---------- */
  let editingCat = null;
  let pickedColor = App.CONST.PALETTE[0];

  function openCatModal(id) {
    editingCat = id;
    const c = id ? App.catById(id) : { name: "", emoji: "✨", color: App.CONST.PALETTE[0], target: 0 };
    document.getElementById("catModalTitle").textContent = id ? "카테고리 편집" : "새 카테고리";
    document.getElementById("catName").value = c.name;
    document.getElementById("catEmoji").value = c.emoji;
    document.getElementById("catTarget").value = c.target || 0;
    pickedColor = c.color;

    const pick = document.getElementById("catColorPick");
    pick.innerHTML = "";
    App.CONST.PALETTE.forEach((col) => {
      const sw = document.createElement("button");
      sw.className = "swatch" + (col === pickedColor ? " active" : "");
      sw.style.background = col;
      sw.onclick = () => {
        pickedColor = col;
        pick.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("active", x === sw));
      };
      pick.appendChild(sw);
    });

    document.getElementById("catModalDelete").style.display =
      id && App.state.categories.length > 1 ? "" : "none";
    App.ui.openModal("catModal");
  }

  function saveCatModal() {
    const name = document.getElementById("catName").value.trim();
    if (!name) { alert("이름을 입력하세요"); return; }
    const emoji = document.getElementById("catEmoji").value.trim() || "✨";
    const target = Math.max(0, +document.getElementById("catTarget").value || 0);
    App.history.snapshot();
    if (editingCat) {
      const c = App.catById(editingCat);
      Object.assign(c, { name, emoji, color: pickedColor, target });
    } else {
      App.state.categories.push({ id: App.cid(), name, emoji, color: pickedColor, target });
    }
    App.store.save();
    App.ui.closeModals();
    renderSettings();
    App.planner.render();
    App.refreshAll();
  }

  function deleteCatModal() {
    if (!editingCat || App.state.categories.length <= 1) return;
    if (!confirm("이 카테고리와 관련된 모든 칸 기록이 삭제됩니다. 계속할까요?")) return;
    App.history.snapshot();
    // remove orphan blocks
    for (const ds in App.state.days) {
      const blocks = App.state.days[ds].blocks || {};
      for (const t in blocks) if (blocks[t].categoryId === editingCat) delete blocks[t];
    }
    App.state.categories = App.state.categories.filter((c) => c.id !== editingCat);
    App.store.save();
    App.ui.closeModals();
    renderSettings();
    App.planner.render();
    App.refreshAll();
  }

  /* ---------- backup ---------- */
  function exportData() {
    const blob = new Blob([App.store.raw()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timebox-quest-${U.today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    App.state.settings.lastBackup = Date.now();
    App.store.save();
    App.gamify.toast("💾 백업 파일을 저장했어요");
  }
  // daily reminder — fires while the app is open, once per day, after the set time
  function checkReminder() {
    const s = App.state.settings;
    if (!s.reminderEnabled) return;
    const today = U.today();
    if (s.reminderLastShown === today) return;
    const now = new Date();
    const cur = U.pad(now.getHours()) + ":" + U.pad(now.getMinutes());
    if (cur < (s.reminderTime || "21:00")) return;
    const d = App.stats.deriveDay(today);
    s.reminderLastShown = today;
    App.store.save();
    if (d.isWin) return; // already a good day — no nag
    const msg = d.plannedBlocks === 0
      ? "오늘 하루를 아직 계획하지 않았어요 🗓️"
      : `오늘 달성률 ${d.pct}% — 마무리해볼까요? 🐾`;
    if (window.Notification && Notification.permission === "granted") {
      try { new Notification("TamaBox", { body: msg, icon: "icon.svg" }); }
      catch (e) { App.gamify.toast("⏰ " + msg); }
    } else {
      App.gamify.toast("⏰ " + msg);
    }
  }

  function maybeBackupReminder() {
    setTimeout(() => {
      if (App.sync && App.sync.isSignedIn()) return; // cloud-synced is safe
      if (Object.keys(App.state.days).length < 2) return;
      const WEEK = 7 * 864e5;
      if (Date.now() - (App.state.settings.lastBackup || 0) > WEEK)
        App.gamify.toast("💾 백업한 지 오래됐어요 — 설정 → 내보내기로 데이터를 지켜요");
    }, 4500);
  }
  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm("현재 데이터를 가져온 파일로 덮어쓸까요?")) return;
        App.history.snapshot();
        App.store.replaceState(data);
        App.planner.render();
        App.refreshAll();
        renderSettings();
        App.gamify.toast("가져오기 완료");
      } catch (err) { alert("가져오기 실패: 올바른 JSON 파일이 아닙니다"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /* ---------- backdrop click closes modals ---------- */
  function speciesLocked() {
    const m = document.getElementById("speciesModal");
    return m && !m.classList.contains("hidden") && App.character.needsSpecies();
  }
  function modalOpen() { return !document.getElementById("modalRoot").classList.contains("hidden"); }
  function initModalClose() {
    document.querySelector(".modal-backdrop").onclick = () => { if (!speciesLocked()) App.ui.closeModals(); };
    document.addEventListener("keydown", (e) => {
      // Escape closes
      if (e.key === "Escape" && !speciesLocked()) { App.ui.closeModals(); return; }
      // focus trap inside an open modal
      if (e.key === "Tab" && modalOpen()) {
        const modal = document.querySelector(".modal:not(.hidden)");
        if (!modal) return;
        const f = [...modal.querySelectorAll("input,select,button,textarea,[tabindex]")].filter((el) => !el.disabled && el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      // Ctrl/Cmd+Z = undo (not while typing in a field)
      const tag = (e.target && e.target.tagName) || "";
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !/(INPUT|TEXTAREA|SELECT)/.test(tag) && !modalOpen()) {
        e.preventDefault();
        App.history.undo();
      }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    document.body.classList.toggle("pixel", App.state.settings.pixel !== false);
    initTabs();
    initSettings();
    initModalClose();
    document.getElementById("helpBtn").onclick = () => App.ui.openModal("helpModal");
    document.getElementById("helpClose").onclick = () => App.ui.closeModals();
    App.planner.init();
    App.analytics.init();
    App.character.init();
    App.planner.render();
    renderSettings();
    updateHud();
    App.character.render(false);
    if (App.character.needsSpecies()) App.ui.openModal("speciesModal");
    App.sync.init();
    maybeBackupReminder();
    if (!App.state.settings.seenTip) {
      setTimeout(() => {
        App.gamify.toast("💡 칸을 칠해 계획하고, 네모(☐)를 눌러 완료 체크!");
        App.state.settings.seenTip = true;
        App.store.save();
      }, 2200);
    }
    // PWA: register service worker (only when served over http/https)
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    // re-mark "now" slot + check daily reminder every minute
    setInterval(() => {
      if (document.getElementById("view-planner").classList.contains("active") &&
          App.planner.getDate() === U.today()) App.planner.render();
      checkReminder();
    }, 60000);
    setTimeout(checkReminder, 6000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
