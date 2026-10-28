/* ===========================================================
   sync.js — 기기 간 동기화 (본인 소유 Supabase 프로젝트 사용)
   PC/폰이 각자 localStorage 에만 저장되는 문제를 풀기 위한 선택 기능.
   - 앱이 Supabase 계정을 만들진 않는다 — 사용자가 직접 만든 프로젝트의
     URL + anon(publishable) key 를 이 기기에 붙여넣어야 동작한다.
   - 로그인은 비밀번호 없이 이메일 매직링크만 쓴다(분실·관리 부담이 적다).
   - 문서 전체 1개(jsonb)를 사용자당 하나 저장. 병합 전략(v1, 단순화):
     settings/categories/projects/ddays/terms/research/pomo 등 days 외
     전부는 "문서 전체 updatedAt 이 더 최신인 쪽 전체"를 그대로 쓰고,
     days{} 만 날짜별로 그 날의 mtime 이 더 큰 쪽을 고른다.
     → 기기 수는 제한 없음(맥북·아이패드·아이폰 등 몇 대든 같은 이메일로 로그인하면 됨).
       다만 같은 동기화 구간 안에서 두 대 이상이 '서로 다른 설정'을 동시에 고치면
       뒤처진 쪽의 설정 변경은 버려질 수 있음(1인 다기기 기준 감내 가능한 단순화).
   Exposes: window.App.sync
   =========================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = App.util;
  const S = () => App.store;

  const CFG_KEY = "tbxPlanner.sync.v1";
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

  /* ---------- 병합 (순수 로직 — 테스트 가능) ---------- */
  function mergeStates(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const newer = (remote.updatedAt || 0) >= (local.updatedAt || 0) ? remote : local;
    const merged = Object.assign({}, newer);
    const days = {};
    const keys = new Set(Object.keys(local.days || {}).concat(Object.keys(remote.days || {})));
    keys.forEach((ds) => {
      const a = (local.days || {})[ds], b = (remote.days || {})[ds];
      if (!a) days[ds] = b;
      else if (!b) days[ds] = a;
      else days[ds] = (b.mtime || 0) > (a.mtime || 0) ? b : a;
    });
    merged.days = days;
    merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    return merged;
  }

  /* ---------- 설정(URL/key) 저장 — 세션 데이터와 분리, '전체 초기화'에 영향 없음 ---------- */
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch (e) { return null; }
  }
  function setCfg(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* 접근 불가 */ }
  }
  function clearCfg() {
    try { localStorage.removeItem(CFG_KEY); } catch (e) { /* noop */ }
  }

  /* ---------- 상태 ---------- */
  let client = null;
  let session = null;
  let applyingRemote = false;
  let busy = false;
  let lastSyncAt = null;
  let lastErr = "";
  let sdkPromise = null;
  let pushTimer = null;

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("SDK를 불러오지 못했어요(네트워크 확인)"));
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  async function ensureClient() {
    const cfg = getCfg();
    if (!cfg || !cfg.url || !cfg.key) return null;
    if (client) return client;
    await loadSdk();
    client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    client.auth.onAuthStateChange((_event, sess) => {
      session = sess || null;
      render();
      if (session && !applyingRemote) pullAndMerge();
    });
    return client;
  }

  /* ---------- 클라우드 I/O ---------- */
  async function fetchRemote() {
    if (!client || !session) return null;
    const { data, error } = await client
      .from("user_state").select("data,updated_at")
      .eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  async function pushNow() {
    clearTimeout(pushTimer);
    if (!client || !session) return;
    busy = true; render();
    try {
      const { error } = await client.from("user_state").upsert({
        user_id: session.user.id,
        data: S().state,
        updated_at: new Date(S().state.updatedAt || Date.now()).toISOString(),
      });
      if (error) throw error;
      lastSyncAt = Date.now(); lastErr = "";
    } catch (e) {
      lastErr = "올리기 실패: " + e.message;
    }
    busy = false; render();
  }

  function pushSoon() {
    if (applyingRemote || !client || !session) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 1800);
  }

  async function pullAndMerge() {
    if (!client || !session || busy) return;
    busy = true; render();
    try {
      const remote = await fetchRemote();
      if (remote) {
        const merged = mergeStates(S().state, remote);
        applyingRemote = true;
        S().replaceState(merged);
        applyingRemote = false;
        App.timeline && App.timeline.refreshPalette && App.timeline.refreshPalette();
        App.day && App.day.refresh && App.day.refresh();
        if (App.nav && App.nav.current === "settings") App.settings.render();
        if (App.nav && App.nav.current === "stats") App.stats.render();
      }
      lastSyncAt = Date.now(); lastErr = "";
      pushSoon();   // 병합 결과(로컬에만 있던 날짜 등)를 서버에도 맞춰 올린다
    } catch (e) {
      lastErr = "가져오기 실패: " + e.message;
    }
    busy = false; render();
  }

  /* ---------- 사용자 동작 ---------- */
  async function saveCfg() {
    const url = (U.byId("sbUrl").value || "").trim();
    const key = (U.byId("sbKey").value || "").trim();
    if (!url || !key) { lastErr = "URL과 key를 모두 입력하세요"; render(); return; }
    setCfg({ url, key });
    client = null; session = null; lastErr = "";
    render();
    try { await ensureClient(); } catch (e) { lastErr = "연결 실패: " + e.message; }
    render();
  }

  async function requestMagicLink() {
    const c = await ensureClient();
    if (!c) { lastErr = "먼저 URL/key를 저장하세요"; render(); return; }
    const email = (U.byId("sbEmail").value || "").trim();
    if (!email) { lastErr = "이메일을 입력하세요"; render(); return; }
    busy = true; lastErr = ""; render();
    try {
      const { error } = await c.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href.split("#")[0] },
      });
      if (error) throw error;
      lastErr = "__sent__";
    } catch (e) {
      lastErr = "실패: " + e.message;
    }
    busy = false; render();
  }

  async function signOut() {
    if (client) { try { await client.auth.signOut(); } catch (e) { /* noop */ } }
    session = null; lastErr = ""; render();
  }

  function disconnect() {
    if (!confirm("이 기기에서 동기화 연결을 끊을까요? (클라우드에 저장된 데이터는 지워지지 않아요)")) return;
    if (client) { try { client.auth.signOut(); } catch (e) { /* noop */ } }
    client = null; session = null; lastErr = "";
    clearCfg();
    render();
  }

  /* ---------- 화면 ---------- */
  function fmtWhen(ts) {
    if (!ts) return "아직 없음";
    const d = new Date(ts);
    return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  }

  function render() {
    const setup = U.byId("syncSetup"), auth = U.byId("syncAuth");
    if (!setup || !auth) return;   // 설정 화면이 아직 안 그려짐
    const cfg = getCfg();

    const dot = U.byId("syncDot"), label = U.byId("syncLabel");
    if (dot) dot.className = "sync-dot " + (
      busy ? "busy" : !cfg ? "off" : session ? "ok" : "warn");
    if (label) label.textContent =
      busy ? "동기화 중…" : !cfg ? "꺼짐" : session ? "연결됨" : "로그인 필요";

    setup.hidden = !!cfg;
    auth.hidden = !cfg;
    if (cfg) {
      const urlInp = U.byId("sbUrl"), keyInp = U.byId("sbKey");
      if (urlInp && !urlInp.matches(":focus")) urlInp.value = cfg.url || "";
      if (keyInp && !keyInp.matches(":focus")) keyInp.value = cfg.key || "";
    }

    const authBox = U.byId("authBox"), authedBox = U.byId("authedBox");
    if (authBox) authBox.hidden = !!session;
    if (authedBox) authedBox.hidden = !session;
    if (session) U.setText("sbWho", session.user.email || "");
    U.setText("sbSyncInfo", session ? `마지막 동기화: ${fmtWhen(lastSyncAt)}` : "");

    const msgEl = U.byId("sbMsg");
    if (msgEl) {
      msgEl.textContent = lastErr === "__sent__"
        ? "이메일로 로그인 링크를 보냈어요. 메일함에서 링크를 눌러주세요."
        : (lastErr || "");
      msgEl.style.color = lastErr && lastErr !== "__sent__" ? "var(--danger)" : "";
    }
  }

  /* ---------- 초기화 ---------- */
  function init() {
    U.on("sbSaveCfg", "click", saveCfg);
    U.on("sbMagic", "click", requestMagicLink);
    U.on("sbSignOut", "click", signOut);
    U.on("sbDisconnect", "click", disconnect);
    U.on("sbPull", "click", () => pullAndMerge());
    U.on("sbPush", "click", () => pushNow());

    render();
    if (getCfg()) {
      ensureClient().then(async (c) => {
        if (!c) return;
        const { data } = await c.auth.getSession();
        session = (data && data.session) || null;
        render();
        if (session) pullAndMerge();
      }).catch((e) => { lastErr = "연결 실패: " + e.message; render(); });
    }

    // 다른 기기에서 바뀐 내용을 조용히 반영 — 탭에 돌아올 때마다
    const quietPull = () => { if (!document.hidden && session && !busy) pullAndMerge(); };
    document.addEventListener("visibilitychange", quietPull);
    window.addEventListener("focus", quietPull);
  }

  App.sync = { init, pushSoon, mergeStates };
})();
