/* ===========================================================
   sync.js — optional Supabase cloud sync (free tier)
   Single JSON document per user, last-write-wins on updatedAt.
   Exposes: window.App.sync
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const CFG_KEY = "timeboxQuest.sbcfg";
  const TABLE = "user_state";

  let client = null;
  let session = null;
  let pushTimer = null;

  /* ---------- config ---------- */
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
    catch { return {}; }
  }
  function setCfg(url, key) {
    localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
  }
  function isConfigured() { const c = getCfg(); return !!(c.url && c.key); }

  /* ---------- status chip ---------- */
  function status(kind, label) {
    const dot = document.getElementById("syncDot");
    const lab = document.getElementById("syncLabel");
    if (dot) dot.className = "sync-dot " + kind;
    if (lab) lab.textContent = label;
  }
  function msg(text, ok) {
    const m = document.getElementById("sbMsg");
    if (!m) return;
    m.textContent = text;
    m.className = "sb-msg " + (ok === true ? "ok" : ok === false ? "err" : "");
  }

  /* ---------- lazy load supabase-js ---------- */
  function loadLib() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Supabase 라이브러리 로드 실패 (인터넷 확인)"));
      document.head.appendChild(s);
    });
  }

  async function ensureClient() {
    if (client) return client;
    if (!isConfigured()) throw new Error("Supabase URL/key를 먼저 저장하세요");
    await loadLib();
    const c = getCfg();
    client = window.supabase.createClient(c.url, c.key);
    return client;
  }

  /* ---------- auth ---------- */
  async function restore() {
    if (!isConfigured()) { status("off", "오프라인"); return; }
    try {
      await ensureClient();
      status("syncing", "연결 중…");
      const { data } = await client.auth.getSession();
      session = data.session;
      client.auth.onAuthStateChange((_e, s) => { session = s; reflectAuth(); });
      reflectAuth();
      if (session) await mergeOnLogin();
    } catch (e) {
      status("err", "오류");
      console.warn(e);
    }
  }

  function reflectAuth() {
    const authed = !!session;
    document.getElementById("authBox").classList.toggle("hidden", authed);
    document.getElementById("authedBox").classList.toggle("hidden", !authed);
    if (authed) {
      document.getElementById("sbWho").textContent = session.user.email || "(익명)";
      status("on", "동기화됨");
    } else {
      status(isConfigured() ? "off" : "off", isConfigured() ? "로그인 필요" : "오프라인");
    }
  }

  async function signUp(email, password) {
    await ensureClient();
    msg("가입 중…");
    const { error } = await client.auth.signUp({ email, password });
    if (error) return msg(error.message, false);
    msg("가입 완료! 이메일 확인이 켜져 있다면 메일을 확인하세요. 그 후 로그인하세요.", true);
  }

  async function signIn(email, password) {
    await ensureClient();
    msg("로그인 중…");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return msg(error.message, false);
    session = data.session;
    reflectAuth();
    await mergeOnLogin();
    msg("로그인 성공! 데이터를 동기화했습니다.", true);
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    session = null;
    reflectAuth();
    msg("로그아웃했습니다.", true);
  }

  /* ---------- data sync ---------- */
  async function pull() {
    if (!session) throw new Error("로그인이 필요합니다");
    await ensureClient();
    const { data, error } = await client
      .from(TABLE).select("data, updated_at").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  let lastRemoteTs = 0; // the remote updatedAt we last synced with (conflict baseline)

  async function fetchRemoteMeta() {
    const { data, error } = await client
      .from(TABLE).select("updated_at").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    return data ? (Date.parse(data.updated_at) || 0) : 0;
  }

  async function pullReplace() {
    const remote = await pull();
    if (remote) {
      App.store.replaceState(remote);
      App.refreshAll(true);
      lastRemoteTs = App.state.updatedAt || 0;
      info("클라우드 데이터를 불러왔습니다");
    }
  }

  // Day-level merge: take the newer doc for top-level fields (settings/categories/
  // game/templates), but union `days` choosing each date by its own mtime.
  function mergeStates(local, remote) {
    const newer = (remote.updatedAt || 0) >= (local.updatedAt || 0) ? remote : local;
    const base = JSON.parse(JSON.stringify(newer));
    const ld = local.days || {}, rd = remote.days || {};
    const days = {};
    new Set(Object.keys(ld).concat(Object.keys(rd))).forEach((d) => {
      const a = ld[d], b = rd[d];
      if (a && b) days[d] = (b.mtime || 0) >= (a.mtime || 0) ? b : a;
      else days[d] = a || b;
    });
    base.days = days;
    return base;
  }

  async function push(opts) {
    if (!session) throw new Error("로그인이 필요합니다");
    await ensureClient();
    // conflict guard: if remote changed since our last sync, merge it in (by day) first
    if (!(opts && opts.force)) {
      try {
        const remoteTs = await fetchRemoteMeta();
        if (remoteTs && lastRemoteTs && remoteTs > lastRemoteTs) {
          const remote = await pull();
          if (remote) {
            App.store.replaceState(mergeStates(App.store.get(), remote));
            App.store.save(); // bump updatedAt so the merged doc is newest
            App.refreshAll(true);
          }
        }
      } catch (e) { /* meta check failed — proceed with push */ }
    }
    status("syncing", "올리는 중…");
    const payload = {
      user_id: session.user.id,
      data: App.store.get(),
      updated_at: new Date(App.state.updatedAt).toISOString(),
    };
    const { error } = await client.from(TABLE).upsert(payload, { onConflict: "user_id" });
    if (error) { status("err", "오류"); throw error; }
    lastRemoteTs = App.state.updatedAt || 0;
    status("on", "동기화됨");
    info(`마지막 업로드: 방금`);
  }

  // quiet background pull (on focus / visibility) — take remote if newer
  async function quietPull() {
    if (!session) return;
    try {
      await ensureClient();
      const remote = await pull();
      if (remote && (remote.updatedAt || 0) !== lastRemoteTs) {
        App.store.replaceState(mergeStates(App.store.get(), remote));
        App.store.save();
        App.refreshAll(true);
        lastRemoteTs = remote.updatedAt || lastRemoteTs;
        info("다른 기기 변경을 병합했습니다");
      }
      status("on", "동기화됨");
    } catch (e) { /* ignore */ }
  }

  async function mergeOnLogin() {
    try {
      const remote = await pull();
      if (remote) {
        App.store.replaceState(mergeStates(App.store.get(), remote));
        App.store.save();
        App.refreshAll(true);
        info("클라우드와 병합했습니다");
      }
      await push({ force: true }); // upload merged result
      status("on", "동기화됨");
    } catch (e) {
      status("err", "오류");
      msg("동기화 실패: " + e.message, false);
    }
  }

  function info(text) {
    const el = document.getElementById("sbSyncInfo");
    if (el) el.textContent = text;
  }

  // debounced auto-push after local changes
  function schedulePush() {
    if (!session) return;
    status("syncing", "동기화 중…");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      push().catch((e) => { status("err", "오류"); console.warn(e); });
    }, 1500);
  }

  /* ---------- wiring ---------- */
  function init() {
    const c = getCfg();
    if (c.url) document.getElementById("sbUrl").value = c.url;
    if (c.key) document.getElementById("sbKey").value = c.key;

    // pull other-device changes when the tab regains focus
    document.addEventListener("visibilitychange", () => { if (!document.hidden) quietPull(); });
    window.addEventListener("focus", quietPull);

    document.getElementById("sbSaveCfg").onclick = () => {
      setCfg(document.getElementById("sbUrl").value, document.getElementById("sbKey").value);
      client = null; // force re-create
      msg("설정을 저장했습니다. 이제 로그인하세요.", true);
      restore();
    };
    document.getElementById("sbSignIn").onclick = () =>
      signIn(val("sbEmail"), val("sbPass")).catch((e) => msg(e.message, false));
    document.getElementById("sbSignUp").onclick = () =>
      signUp(val("sbEmail"), val("sbPass")).catch((e) => msg(e.message, false));
    document.getElementById("sbSignOut").onclick = () => signOut();
    document.getElementById("sbPush").onclick = () =>
      push().then(() => msg("올리기 완료", true)).catch((e) => msg(e.message, false));
    document.getElementById("sbPull").onclick = async () => {
      try {
        const remote = await pull();
        if (!remote) return msg("클라우드에 데이터가 없습니다", false);
        App.store.replaceState(remote);
        App.refreshAll(true);
        msg("내려받기 완료", true);
      } catch (e) { msg(e.message, false); }
    };

    restore();
  }

  function val(id) { return document.getElementById(id).value.trim(); }

  App.sync = { init, schedulePush, isSignedIn: () => !!session };
})();
