/**
 * 할로매쓰 (HaloMath) Main Portal Engine & Channel Isolation Logic
 */

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) || null;

let firebaseDb = null;
let firebaseAuth = null;
let portalAdminUnlocked = false;
if (window.firebase && firebaseConfig && firebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.database();
    if (firebase.auth) firebaseAuth = firebase.auth();
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

// Security & Input Validation Helpers
function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"/]/g, '')
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function getBingsoo2TotalErrorPx(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.totalErrorPx != null && Number.isFinite(Number(item.totalErrorPx))) {
    return Math.max(0, parseInt(item.totalErrorPx, 10));
  }
  if (!Array.isArray(item.rounds)) return null;

  let sum = 0;
  for (const round of item.rounds) {
    const px = parseInt(round && round.errorPx, 10);
    if (!Number.isFinite(px)) return null;
    sum += px;
  }
  return sum;
}

function getBingsoo2PlayTimeMs(item) {
  if (!item || typeof item !== 'object') return null;
  const playTimeMs = parseInt(item.playTimeMs, 10);
  return Number.isFinite(playTimeMs) && playTimeMs >= 0 ? playTimeMs : null;
}

function compareAscendingNullable(a, b) {
  if (a != null && b != null && a !== b) return a - b;
  if (a != null && b == null) return -1;
  if (a == null && b != null) return 1;
  return 0;
}

function isBetterBingsoo2Record(candidate, previous) {
  if (!previous) return true;
  if (candidate.score !== previous.score) return candidate.score > previous.score;

  const errCmp = compareAscendingNullable(candidate.totalErrorPx, previous.totalErrorPx);
  if (errCmp !== 0) return errCmp < 0;

  const timeCmp = compareAscendingNullable(candidate.playTimeMs, previous.playTimeMs);
  if (timeCmp !== 0) return timeCmp < 0;

  return (candidate.timestamp || 0) < (previous.timestamp || 0);
}

function getLeaderboardDisplayList(list, gameKey) {
  if (portalAdminUnlocked) return list;
  if (gameKey === 'bingsoo2') {
    const perfectCount = list.filter((item) => item.score === 500).length;
    return list.slice(0, Math.max(20, perfectCount));
  }
  return list.slice(0, 20);
}

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------
  // Channel Mode Detection Logic (?mode=dorms vs ?mode=school)
  // ----------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const currentPath = window.location.pathname.toLowerCase();

  let activeMode = typeof HalomathMode !== 'undefined'
    ? HalomathMode.detectActiveMode()
    : 'dorms';

  // Fallback if shared script failed to load
  if (typeof HalomathMode === 'undefined') {
    const modeParam = urlParams.get('mode');
    if (modeParam === 'school' || currentPath.includes('/school')) {
      activeMode = 'school';
    } else if (modeParam === 'dorms' || modeParam === 'dorems' || currentPath.includes('/dorms') || currentPath.includes('/dorems')) {
      activeMode = 'dorms';
    }
  }

  const portalTitle = document.getElementById('portal-title');
  const portalSubtitle = document.getElementById('portal-subtitle');

  const btnPlayBingsoo = document.getElementById('btn-play-bingsoo');
  const btnPlayBingsoo2 = document.getElementById('btn-play-bingsoo2');
  const btnPlayCongruence = document.getElementById('btn-play-congruence');
  const btnPlayThreeChances = document.getElementById('btn-play-three-chances');
  const btnPlayPrismTycoon = document.getElementById('btn-play-prism-tycoon');
  const leaderboardTitle = document.getElementById('leaderboard-title');
  const leaderboardModeNote = document.getElementById('leaderboard-mode-note');
  const leaderboardTableHeaderId = document.getElementById('th-header-id');
  const leaderboardTableHeaderName = document.getElementById('th-header-name');
  const leaderboardTableHeaderMetric = document.getElementById('th-header-metric');
  const leaderboardTableHeaderDelete = document.getElementById('th-header-delete');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const leaderboardTabs = document.getElementById('leaderboard-tabs');
  const leaderboardSection = document.getElementById('leaderboard-section');
  const leaderboardFold = document.getElementById('leaderboard-fold');
  const logoBadge = document.getElementById('logo-badge');
  const adminGate = document.getElementById('admin-gate');
  const adminEmailInput = document.getElementById('admin-email-input');
  const adminPassInput = document.getElementById('admin-pass-input');
  const adminGateError = document.getElementById('admin-gate-error');
  const adminToolbar = document.getElementById('admin-toolbar');
  const adminSearch = document.getElementById('admin-search');
  const adminCount = document.getElementById('admin-count');
  const btnAdminUnlock = document.getElementById('btn-admin-unlock');
  const btnAdminCancel = document.getElementById('btn-admin-cancel');
  const btnAdminExit = document.getElementById('btn-admin-exit');
  const btnAdminExport = document.getElementById('btn-admin-export');
  const btnAdminToggleMode = document.getElementById('btn-admin-toggle-mode');
  const sessionUsageFold = document.getElementById('session-usage-fold');
  const sessionUsageTitle = document.getElementById('session-usage-title');
  const sessionUsageCards = document.getElementById('session-usage-cards');
  const sessionUsageByGame = document.getElementById('session-usage-by-game');
  const sessionUsageLoading = document.getElementById('session-usage-loading');
  const btnSessionUsageRefresh = document.getElementById('btn-session-usage-refresh');

  const CONGRUENCE_GAME_IDS = new Set(['congruence', 'triangle', 'congruence_game']);
  const BINGSOO_GAME_IDS = new Set(['bingsoo', '']);
  const BINGSOO2_GAME_IDS = new Set(['bingsoo2', 'bingsoo-2']);
  const PRISM_TYCOON_GAME_IDS = new Set(['prism-tycoon', 'tycoon']);
  let activeLeaderboardGame = 'bingsoo';
  let scoresUnsub = null;
  let threeChancesUnsub = null;
  let leaderboardFetchGen = 0;
  let lastFullList = [];
  let adminQuery = '';
  let leaderboardEverLoaded = false;
  let sessionUsageLoadingFlag = false;

  const SESSION_GAME_LABELS = {
    bingsoo: '팥빙수',
    bingsoo2: '팥빙수 2탄',
    'prism-tycoon': '보석 타이쿤',
    tycoon: '보석 타이쿤'
  };

  function usageDayKeyKst(nowMs) {
    const t = Number(nowMs) || Date.now();
    const kst = new Date(t + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function sessionUsageCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function qualifiedSessionCount(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    if (obj.qualified != null) return sessionUsageCount(obj.qualified);
    return sessionUsageCount(obj.externalQualified) + sessionUsageCount(obj.ownerQualified);
  }

  function clearSessionUsageStats() {
    if (sessionUsageTitle) sessionUsageTitle.textContent = '📊 수업 세션 통계';
    if (sessionUsageCards) {
      sessionUsageCards.innerHTML = '';
      if (sessionUsageLoading) {
        sessionUsageLoading.hidden = false;
        sessionUsageLoading.textContent = '불러오는 중…';
        sessionUsageCards.appendChild(sessionUsageLoading);
      }
    }
    if (sessionUsageByGame) {
      sessionUsageByGame.hidden = true;
      sessionUsageByGame.innerHTML = '';
    }
    if (sessionUsageFold) sessionUsageFold.open = false;
  }

  function renderSessionUsageCard(label, total, today) {
    return `<article class="session-usage-card">
      <span class="session-usage-card-label">${escapeHtml(label)}</span>
      <span class="session-usage-card-value">${total}</span>
      <span class="session-usage-card-sub">오늘 ${today}</span>
    </article>`;
  }

  function showSessionUsageMessage(message) {
    if (sessionUsageTitle) sessionUsageTitle.textContent = '📊 수업 세션 통계';
    if (sessionUsageCards) {
      sessionUsageCards.innerHTML = `<p class="session-usage-loading">${escapeHtml(message)}</p>`;
    }
    if (sessionUsageByGame) {
      sessionUsageByGame.hidden = true;
      sessionUsageByGame.innerHTML = '';
    }
  }

  function renderSessionUsageStats(data) {
    const payload = data && typeof data === 'object' ? data : {};
    const totals = payload.totals && typeof payload.totals === 'object' ? payload.totals : {};
    const byDay = payload.byDay && typeof payload.byDay === 'object' ? payload.byDay : {};
    const byGame = payload.byGame && typeof payload.byGame === 'object' ? payload.byGame : {};
    const todayKey = usageDayKeyKst();
    const today = byDay[todayKey] && typeof byDay[todayKey] === 'object' ? byDay[todayKey] : {};

    const total = qualifiedSessionCount(totals);
    const todayCount = qualifiedSessionCount(today);

    if (sessionUsageTitle) {
      sessionUsageTitle.textContent = `📊 수업 세션 · 누적 ${total} · 오늘 ${todayCount}`;
    }

    if (sessionUsageCards) {
      sessionUsageCards.innerHTML = renderSessionUsageCard('수업 세션 (누적)', total, todayCount)
        + (total === 0 && todayCount === 0
          ? '<p class="session-usage-loading">아직 집계된 세션이 없습니다. 3명 이상 참여 후 종료하면 숫자가 올라갑니다.</p>'
          : '');
    }

    const gameRows = Object.keys(byGame).sort().map((gameId) => {
      const row = byGame[gameId] || {};
      const label = SESSION_GAME_LABELS[gameId] || gameId;
      const count = qualifiedSessionCount(row);
      if (!count) return '';
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${count}</td>
      </tr>`;
    }).filter(Boolean);

    if (sessionUsageByGame) {
      if (gameRows.length) {
        sessionUsageByGame.hidden = false;
        sessionUsageByGame.innerHTML = `<table>
          <thead>
            <tr><th>게임</th><th>세션 수</th></tr>
          </thead>
          <tbody>${gameRows.join('')}</tbody>
        </table>`;
      } else {
        sessionUsageByGame.hidden = true;
        sessionUsageByGame.innerHTML = '';
      }
    }
  }

  async function loadSessionUsageStats() {
    if (!portalAdminUnlocked) return;
    if (!firebaseDb && !firebaseConfig) {
      showSessionUsageMessage('통계를 불러올 수 없습니다. Firebase 설정을 확인해 주세요.');
      return;
    }
    if (!currentAdminUser()) {
      showSessionUsageMessage('관리자 로그인이 필요합니다.');
      return;
    }
    if (sessionUsageLoadingFlag) return;
    sessionUsageLoadingFlag = true;
    if (sessionUsageLoading && sessionUsageCards && sessionUsageCards.contains(sessionUsageLoading)) {
      sessionUsageLoading.textContent = '불러오는 중…';
    }
    try {
      let data = await fetchSessionUsageViaRest(5000);
      renderSessionUsageStats(data);
    } catch (err) {
      console.warn('session usage stats failed:', err);
      const code = String((err && err.code) || '');
      if (code === 'PERMISSION_DENIED') {
        showSessionUsageMessage('통계를 불러오지 못했습니다. Firebase 규칙을 다시 Publish했는지, 관리자 이메일 로그인인지 확인해 주세요.');
      } else if (code === 'ADMIN_EMAIL_REQUIRED') {
        showSessionUsageMessage('통계는 이메일로 로그인한 관리자만 볼 수 있습니다. 관리자 종료 후 다시 로그인해 주세요.');
      } else if (code === 'SESSION_USAGE_TIMEOUT' || (err && err.message === 'SDK_TIMEOUT')) {
        showSessionUsageMessage('통계 응답이 없습니다. 네트워크를 확인한 뒤 새로고침해 주세요.');
      } else {
        showSessionUsageMessage('통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
      }
    } finally {
      sessionUsageLoadingFlag = false;
    }
  }

  function isLeaderboardOpen() {
    return !!(leaderboardFold && leaderboardFold.open);
  }

  function syncLeaderboardFold(open) {
    if (!leaderboardFold) return;
    leaderboardFold.open = !!open;
  }

  function ensureLeaderboardLoaded() {
    if (!portalAdminUnlocked || !isLeaderboardOpen()) return;
    if (!leaderboardEverLoaded) leaderboardEverLoaded = true;
    listenRealtimeLeaderboard();
  }

  function onLeaderboardFoldToggle() {
    if (isLeaderboardOpen()) {
      ensureLeaderboardLoaded();
      return;
    }
    stopLeaderboardListeners();
  }

  function refreshLeaderboardForMode() {
    if (!portalAdminUnlocked) return;
    if (isLeaderboardOpen()) {
      listenRealtimeLeaderboard();
      return;
    }
    stopLeaderboardListeners();
    lastFullList = [];
    if (adminCount) adminCount.textContent = '';
  }

  function toggleAdminChannelMode() {
    if (!portalAdminUnlocked) return;
    activeMode = activeMode === 'school' ? 'dorms' : 'school';
    applyAdminChrome();
    refreshLeaderboardForMode();
  }

  function formatClearTime(ms) {
    const n = Math.max(0, Math.floor(Number(ms) || 0));
    const m = Math.floor(n / 60000);
    const s = Math.floor((n % 60000) / 1000);
    const cs = Math.floor((n % 1000) / 10);
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function isDormsRecord(val, key, isDormsSubtree) {
    const valStudentId = String((val && val.studentId) || '').trim();
    const valChannel = String((val && val.channel) || '').trim();
    return !!(
      isDormsSubtree
      || valStudentId === 'DORMS'
      || valStudentId === 'DOREMS'
      || valChannel === 'dorms'
      || valChannel === 'dorems'
      || key === 'dorms'
    );
  }

  function matchesActiveMode(val, key, isDormsSubtree) {
    const dorms = isDormsRecord(val, key, isDormsSubtree);
    return activeMode === 'dorms' ? dorms : !dorms;
  }

  function gameHref(path) {
    return `${path}?mode=${activeMode === 'dorms' ? 'dorms' : 'school'}`;
  }

  // ----------------------------------------------------
  // Apply Channel Isolation UI & Branding
  // ----------------------------------------------------
  applyChannelBranding();

  function applyChannelBranding() {
    if (activeMode === 'dorms') {
      portalTitle.textContent = '🌐 할로매쓰 - dorms 수학 아케이드';
      portalSubtitle.textContent = 'dorms 회원들과 함께 즐기는 신나는 수학 미니게임 마당!';

      leaderboardTitle.textContent = portalAdminUnlocked
        ? '🏆 dorms 명예의 전당 (전체)'
        : '🏆 dorms 명예의 전당 (Top 20)';
      if (leaderboardModeNote) {
        leaderboardModeNote.textContent = portalAdminUnlocked
          ? '관리자 · 도름 전체 기록 (학생 화면은 Top 20)'
          : '도름 모드 · 학번 없이 닉네임만 기록됩니다';
      }
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = 'none';
      }
      if (leaderboardTableHeaderName) {
        leaderboardTableHeaderName.textContent = '닉네임';
      }
    } else {
      portalTitle.textContent = '🏫 할로매쓰 - 수학 미니게임 아케이드';
      portalSubtitle.textContent = '우리 학교 친구들과 펼치는 유쾌하고 똑똑한 수학 미니게임 대결!';

      leaderboardTitle.textContent = portalAdminUnlocked
        ? '🏆 우리 학교 명예의 전당 (전체)'
        : '🏆 우리 학교 명예의 전당 (Top 20)';
      if (leaderboardModeNote) {
        leaderboardModeNote.textContent = portalAdminUnlocked
          ? '관리자 · 학교 전체 기록 (학생 화면은 Top 20)'
          : '학교 모드 · 이름과 학번으로 기록됩니다';
      }
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = '';
      }
      if (leaderboardTableHeaderName) {
        leaderboardTableHeaderName.textContent = '이름';
      }
    }

    if (btnPlayBingsoo) btnPlayBingsoo.href = gameHref('games/bingsoo-live/index.html');
    if (btnPlayBingsoo2) btnPlayBingsoo2.href = gameHref('games/bingsoo2-live/index.html');
    if (btnPlayCongruence) btnPlayCongruence.href = gameHref('games/congruence/index.html');
    if (btnPlayThreeChances) btnPlayThreeChances.href = gameHref('games/three-chances/index.html');
    if (btnPlayPrismTycoon) btnPlayPrismTycoon.href = gameHref('games/prism-tycoon-live/index.html');
  }

  // ----------------------------------------------------
  // Channel + game isolated leaderboard
  // ----------------------------------------------------
  function updateMetricHeader() {
    if (!leaderboardTableHeaderMetric) return;
    if (activeLeaderboardGame === 'three-chances') {
      leaderboardTableHeaderMetric.textContent = '클리어 시간';
    } else if (activeLeaderboardGame === 'prism-tycoon') {
      leaderboardTableHeaderMetric.textContent = '총 수익';
    } else {
      leaderboardTableHeaderMetric.textContent = '최고 점수';
    }
  }

  function renderLeaderboardSkeleton(tbody, rowCount = 6) {
    if (!tbody) return;
    const showId = activeMode === 'school';
    const widths = showId
      ? ['w-xs', 'w-md', 'w-sm', 'w-lg']
      : ['w-xs', 'w-md', 'w-lg'];
    if (portalAdminUnlocked) {
      widths.push('w-xs');
    }
    let html = '';
    for (let i = 0; i < rowCount; i++) {
      html += `<tr class="lb-skeleton-row" aria-hidden="true">${widths.map((w) =>
        `<td><span class="lb-skeleton-bar ${w}"></span></td>`
      ).join('')}</tr>`;
    }
    tbody.setAttribute('aria-busy', 'true');
    tbody.innerHTML = html;
  }

  if (leaderboardTabs) {
    leaderboardTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.lb-tab');
      if (!btn || !btn.dataset.game) return;
      activeLeaderboardGame = btn.dataset.game;
      leaderboardTabs.querySelectorAll('.lb-tab').forEach((el) => {
        const on = el === btn;
        el.classList.toggle('active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      updateMetricHeader();
      listenRealtimeLeaderboard();
    });
  }

  function stopLeaderboardListeners() {
    if (typeof scoresUnsub === 'function') {
      try { scoresUnsub(); } catch (e) { /* ignore */ }
      scoresUnsub = null;
    }
    if (typeof threeChancesUnsub === 'function') {
      try { threeChancesUnsub(); } catch (e) { /* ignore */ }
      threeChancesUnsub = null;
    }
  }

  async function fetchScoresDataViaRest(timeoutMs = 4000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dbUrl = (firebaseConfig && firebaseConfig.databaseURL) || 'https://math-game-halogini-default-rtdb.firebaseio.com';
      const res = await fetch(`${dbUrl}/scores.json`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Leaderboard REST fetch failed:', err);
      return null;
    }
  }

  async function fetchSessionUsageViaRest(timeoutMs = 5000) {
    const adminUser = currentAdminUser();
    if (!adminUser) {
      const err = new Error('ADMIN_AUTH_REQUIRED');
      err.code = 'ADMIN_AUTH_REQUIRED';
      throw err;
    }
    if (!adminUser.email) {
      const err = new Error('ADMIN_EMAIL_REQUIRED');
      err.code = 'ADMIN_EMAIL_REQUIRED';
      throw err;
    }
    const idToken = await adminUser.getIdToken(true);
    const dbUrl = (firebaseConfig && firebaseConfig.databaseURL) || 'https://math-game-halogini-default-rtdb.firebaseio.com';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    async function readUsagePath(path) {
      const res = await fetch(`${dbUrl}/${path}.json?auth=${encodeURIComponent(idToken)}`, {
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) {
        const err = new Error('PERMISSION_DENIED');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`HTTP_${res.status}`);
        err.code = String(res.status);
        throw err;
      }
      const text = await res.text();
      if (!text || text === 'null') return null;
      return JSON.parse(text);
    }

    try {
      const [totals, byDay, byGame] = await Promise.all([
        readUsagePath('sessionUsage/totals'),
        readUsagePath('sessionUsage/byDay'),
        readUsagePath('sessionUsage/byGame')
      ]);
      clearTimeout(timeoutId);
      return { totals, byDay, byGame };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err && err.name === 'AbortError') {
        const timeoutErr = new Error('SESSION_USAGE_TIMEOUT');
        timeoutErr.code = 'SESSION_USAGE_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  function listenRealtimeLeaderboard() {
    stopLeaderboardListeners();
    const fetchId = ++leaderboardFetchGen;
    renderLeaderboardSkeleton(leaderboardTbody);

    const applyData = (dataObj) => {
      if (fetchId !== leaderboardFetchGen) return;
      const list = collectGameScores(dataObj, activeLeaderboardGame);
      lastFullList = list;
      renderLeaderboardTable(getLeaderboardDisplayList(list, activeLeaderboardGame));
    };

    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (resolved || fetchId !== leaderboardFetchGen) return;
      resolved = true;
      console.warn('Leaderboard SDK fetch timed out; attempting REST fallback.');
      fetchScoresDataViaRest()
        .then((data) => {
          if (fetchId !== leaderboardFetchGen) return;
          applyData(data);
        })
        .catch(() => {
          if (fetchId !== leaderboardFetchGen) return;
          lastFullList = [];
          renderLeaderboardTable([]);
        });
    }, 3500);

    if (firebaseDb) {
      firebaseDb.ref('scores').once('value')
        .then((snap) => {
          if (resolved || fetchId !== leaderboardFetchGen) return;
          resolved = true;
          clearTimeout(timeoutId);
          applyData(snap.val());
        })
        .catch((err) => {
          if (resolved || fetchId !== leaderboardFetchGen) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.warn('Leaderboard SDK fetch failed; attempting REST fallback.', err);
          fetchScoresDataViaRest()
            .then((data) => {
              if (fetchId !== leaderboardFetchGen) return;
              applyData(data);
            })
            .catch(() => {
              if (fetchId !== leaderboardFetchGen) return;
              lastFullList = [];
              renderLeaderboardTable([]);
            });
        });
    } else {
      clearTimeout(timeoutId);
      fetchScoresDataViaRest()
        .then((data) => {
          if (fetchId !== leaderboardFetchGen) return;
          applyData(data);
        })
        .catch(() => {
          if (fetchId !== leaderboardFetchGen) return;
          lastFullList = [];
          renderLeaderboardTable([]);
        });
    }
  }

  function acceptGame(entry, gameKey) {
    const key = gameKey || activeLeaderboardGame;
    const id = String((entry && (entry.gameId || entry.game)) || '').trim();
    if (key === 'congruence') return CONGRUENCE_GAME_IDS.has(id);
    if (key === 'prism-tycoon') return PRISM_TYCOON_GAME_IDS.has(id);
    if (key === 'three-chances') {
      return id === 'three-chances' || id === 'three_chances';
    }
    if (key === 'bingsoo2') {
      return BINGSOO2_GAME_IDS.has(id);
    }
    if (id === 'bingsoo') return true;
    if (!id && entry && entry.score != null && entry.clearTimeMs == null && !CONGRUENCE_GAME_IDS.has(id) && !PRISM_TYCOON_GAME_IDS.has(id) && !BINGSOO2_GAME_IDS.has(id)) {
      return true;
    }
    return false;
  }

  function collectGameScores(dataObj, gameKey) {
    const bestMap = new Map();

    const visit = (obj, isDormsSubtree = false, keyPrefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        if (!item || typeof item !== 'object') return;
        const path = keyPrefix ? `${keyPrefix}/${key}` : key;
        if (item.name) {
          if (!acceptGame(item, gameKey)) return;
          if (!matchesActiveMode(item, key, isDormsSubtree)) return;

          const name = sanitizeInput(item.name, 12);
          const sid = sanitizeInput(item.studentId || '', 10);
          const userKey = activeMode === 'school' ? `${name}_${sid}` : name;

          const keepKeys = (next, isWinner) => {
            const prev = bestMap.get(userKey);
            if (isWinner) {
              const extra = [];
              if (prev && prev.recordKey) extra.push(prev.recordKey);
              if (prev && Array.isArray(prev.extraKeys)) extra.push.apply(extra, prev.extraKeys);
              next.recordKey = path;
              next.extraKeys = extra.filter((k) => k && k !== path);
              bestMap.set(userKey, next);
              return;
            }
            if (prev && path && prev.recordKey !== path) {
              prev.extraKeys = prev.extraKeys || [];
              if (prev.extraKeys.indexOf(path) === -1) prev.extraKeys.push(path);
            }
          };

          if (gameKey === 'three-chances') {
            const clearTimeMs = Number(item.clearTimeMs);
            if (!Number.isFinite(clearTimeMs) || clearTimeMs <= 0) return;
            const prev = bestMap.get(userKey);
            keepKeys({
              name,
              studentId: sid,
              clearTimeMs,
              metricLabel: formatClearTime(clearTimeMs)
            }, !prev || clearTimeMs < prev.clearTimeMs);
          } else {
            const rawScore = gameKey === 'prism-tycoon'
              ? (Number(item.score) || 0)
              : (parseInt(item.score, 10) || 0);
            const score = gameKey === 'prism-tycoon' ? Math.max(0, rawScore) : Math.max(0, Math.min(500, rawScore));
            const prev = bestMap.get(userKey);

            if (gameKey === 'bingsoo2') {
              const totalErrorPx = getBingsoo2TotalErrorPx(item);
              const playTimeMs = getBingsoo2PlayTimeMs(item);
              const candidate = { score, totalErrorPx, playTimeMs, timestamp: item.timestamp || 0 };
              const formattedScore = score.toLocaleString();
              let metricLabel = totalErrorPx != null
                ? `${formattedScore}점 · ${totalErrorPx}px`
                : `${formattedScore}점`;
              if (playTimeMs != null) {
                metricLabel += ` · ${Math.floor(playTimeMs / 60000)}:${String(Math.floor((playTimeMs % 60000) / 1000)).padStart(2, '0')}`;
              }
              keepKeys({
                name,
                studentId: sid,
                score,
                totalErrorPx,
                playTimeMs,
                timestamp: item.timestamp || 0,
                metricLabel
              }, isBetterBingsoo2Record(candidate, prev));
            } else {
              const formattedScore = score.toLocaleString();
              keepKeys({
                name,
                studentId: sid,
                score,
                metricLabel: gameKey === 'prism-tycoon' ? `${formattedScore} 💰` : `${formattedScore}점`
              }, !prev || score > prev.score);
            }
          }
        } else {
          visit(item, key === 'dorms' || isDormsSubtree, path);
        }
      });
    };

    visit(dataObj);

    const list = Array.from(bestMap.values());
    if (gameKey === 'three-chances') {
      list.sort((a, b) => {
        const da = Math.floor(a.clearTimeMs / 1000) - Math.floor(b.clearTimeMs / 1000);
        return da !== 0 ? da : a.clearTimeMs - b.clearTimeMs;
      });
    } else if (gameKey === 'bingsoo2') {
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const errCmp = compareAscendingNullable(a.totalErrorPx, b.totalErrorPx);
        if (errCmp !== 0) return errCmp;

        const timeCmp = compareAscendingNullable(a.playTimeMs, b.playTimeMs);
        if (timeCmp !== 0) return timeCmp;

        return (a.timestamp || 0) - (b.timestamp || 0);
      });
    } else {
      list.sort((a, b) => b.score - a.score);
    }
    return list;
  }

  function withCompetitionRanks(list, keyFn) {
    const ranks = [];
    let lastKey = null;
    let lastRank = 0;
    for (let i = 0; i < list.length; i++) {
      const k = keyFn(list[i]);
      const rank = lastKey !== null && k === lastKey ? lastRank : i + 1;
      lastKey = k;
      lastRank = rank;
      ranks.push(rank);
    }
    const counts = {};
    ranks.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
    return list.map((item, i) => ({
      item,
      rank: ranks[i],
      tied: counts[ranks[i]] > 1
    }));
  }

  function formatRankLabel(rank, tied) {
    const n = tied ? `공동 ${rank}위` : `${rank}위`;
    if (rank === 1) return `🥇 ${n}`;
    if (rank === 2) return `🥈 ${n}`;
    if (rank === 3) return `🥉 ${n}`;
    return n;
  }

  function filterAdminList(list) {
    const q = adminQuery.trim().toLowerCase();
    if (!portalAdminUnlocked || !q) return list;
    return list.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const sid = String(item.studentId || '').toLowerCase();
      return name.includes(q) || sid.includes(q);
    });
  }

  function setElHidden(el, hide) {
    if (!el) return;
    el.hidden = hide;
    el.classList.toggle('hidden', hide);
  }

  function stripAdminQuery() {
    try {
      const next = new URL(window.location.href);
      next.searchParams.delete('admin');
      window.history.replaceState({}, '', next.pathname + next.search + next.hash);
    } catch (e) { /* ignore */ }
  }

  function currentAdminUser() {
    const user = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
    if (!user || !user.email) return null;
    return user;
  }

  function clearAnonymousAuthIfNeeded() {
    const user = firebaseAuth && firebaseAuth.currentUser ? firebaseAuth.currentUser : null;
    if (user && !user.email) {
      firebaseAuth.signOut().catch(() => { /* ignore */ });
    }
  }

  function applyAdminChrome() {
    document.body.classList.toggle('admin-mode', portalAdminUnlocked);
    setElHidden(adminToolbar, !portalAdminUnlocked);
    setElHidden(leaderboardSection, !portalAdminUnlocked);
    if (btnAdminToggleMode) {
      btnAdminToggleMode.textContent = activeMode === 'school' ? '도름 기록 보기' : '학교 기록 보기';
    }
    applyChannelBranding();
    if (leaderboardTableHeaderDelete) setElHidden(leaderboardTableHeaderDelete, !portalAdminUnlocked);
    if (!portalAdminUnlocked) {
      syncLeaderboardFold(false);
      stopLeaderboardListeners();
    }
  }

  function enterAdminMode() {
    portalAdminUnlocked = true;
    applyAdminChrome();
    setElHidden(adminGate, true);
    syncLeaderboardFold(false);
    loadSessionUsageStats();
  }

  function restoreModeFromUrl() {
    if (typeof HalomathMode !== 'undefined') {
      activeMode = HalomathMode.detectActiveMode();
      return;
    }
    const modeParam = urlParams.get('mode');
    if (modeParam === 'school' || currentPath.includes('/school')) activeMode = 'school';
    else activeMode = 'dorms';
  }

  function exitAdminMode() {
    portalAdminUnlocked = false;
    adminQuery = '';
    if (adminSearch) adminSearch.value = '';
    stripAdminQuery();
    restoreModeFromUrl();
    applyAdminChrome();
    clearSessionUsageStats();
    if (firebaseAuth) {
      firebaseAuth.signOut().catch(() => { /* ignore */ });
    }
  }

  function showAdminGateError(msg) {
    if (!adminGateError) return;
    if (!msg) {
      adminGateError.hidden = true;
      adminGateError.textContent = '';
      return;
    }
    adminGateError.hidden = false;
    adminGateError.textContent = msg;
  }

  function openAdminGate() {
    if (portalAdminUnlocked) return;
    if (currentAdminUser()) {
      enterAdminMode();
      return;
    }
    clearAnonymousAuthIfNeeded();
    showAdminGateError('');
    setElHidden(adminGate, false);
    if (adminPassInput) adminPassInput.value = '';
    if (adminEmailInput) adminEmailInput.focus();
  }

  function authErrorMessage(err) {
    const code = String((err && err.code) || '');
    if (code === 'auth/operation-not-allowed') {
      return 'Firebase 콘솔에서 이메일/비밀번호 로그인을 켜고, 선생님 계정을 추가해 주세요.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (code === 'auth/too-many-requests') {
      return '시도가 너무 많습니다. 잠시 후 다시 해 주세요.';
    }
    if (code === 'auth/network-request-failed') {
      return '로그인 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.';
    }
    return '로그인에 실패했습니다.';
  }

  async function submitAdminLogin() {
    if (!firebaseAuth) {
      showAdminGateError('로그인 기능을 불러오지 못했습니다.');
      return;
    }
    const email = adminEmailInput ? String(adminEmailInput.value || '').trim() : '';
    const password = adminPassInput ? String(adminPassInput.value || '') : '';
    if (!email || !password) {
      showAdminGateError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }
    showAdminGateError('');
    if (btnAdminUnlock) {
      btnAdminUnlock.disabled = true;
      btnAdminUnlock.textContent = '확인 중...';
    }
    try {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      if (adminPassInput) adminPassInput.value = '';
      enterAdminMode();
    } catch (err) {
      showAdminGateError(authErrorMessage(err));
    } finally {
      if (btnAdminUnlock) {
        btnAdminUnlock.disabled = false;
        btnAdminUnlock.textContent = '로그인';
      }
    }
  }

  function exportAdminCsv() {
    const list = filterAdminList(lastFullList);
    const showId = activeMode === 'school';
    const rows = [[
      '순위',
      showId ? '이름' : '닉네임',
      ...(showId ? ['학번'] : []),
      activeLeaderboardGame === 'three-chances' ? '클리어 시간' : (activeLeaderboardGame === 'prism-tycoon' ? '총 수익' : '최고 점수')
    ]];
    const getCompetitionRankKey = (item) => {
      if (activeLeaderboardGame === 'three-chances') {
        return item.metricLabel || formatClearTime(item.clearTimeMs);
      }
      if (activeLeaderboardGame === 'bingsoo2') {
        return `${item.score}_${item.totalErrorPx}_${item.playTimeMs}`;
      }
      return item.score;
    };
    const ranked = withCompetitionRanks(list, getCompetitionRankKey);
    ranked.forEach(({ item, rank }) => {
      const line = [String(rank), item.name || ''];
      if (showId) line.push(item.studentId || '');
      line.push(item.metricLabel || (item.score != null ? String(item.score) : ''));
      rows.push(line);
    });
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `halomath-${activeMode}-${activeLeaderboardGame}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function scoreRecordPath(key) {
    const raw = String(key || '').trim().replace(/^\/+/, '');
    if (!raw) return '';
    return raw.replace(/^scores\//, '');
  }

  function addScoreKey(keys, key) {
    const path = scoreRecordPath(key);
    if (path && keys.indexOf(path) === -1) keys.push(path);
  }

  function leaderboardGameIds() {
    if (activeLeaderboardGame === 'congruence') {
      return ['congruence', 'triangle', 'congruence_game'];
    }
    if (activeLeaderboardGame === 'prism-tycoon') {
      return ['prism-tycoon', 'tycoon'];
    }
    if (activeLeaderboardGame === 'three-chances') {
      return ['three-chances', 'three_chances'];
    }
    if (activeLeaderboardGame === 'bingsoo2') {
      return ['bingsoo2', 'bingsoo-2'];
    }
    return ['bingsoo'];
  }

  function entryMatchesLeaderboardPlayer(entry, item) {
    if (!entry || !item) return false;
    const targetName = sanitizeInput(item.name || '', 12);
    const targetSid = sanitizeInput(item.studentId || '', 10);
    const entryName = String((entry.name || entry.playerName) || '').trim();
    const nameMatch = sanitizeInput(entryName, 12) === targetName || entryName === String(item.name || '').trim();
    if (!nameMatch) return false;

    if (typeof HalomathScores !== 'undefined') {
      if (!HalomathScores.matchesGameId(entry, leaderboardGameIds())) return false;
      return HalomathScores.matchesPlayer(entry, item.name || entryName, item.studentId || '', activeMode);
    }

    if (!acceptGame(entry, activeLeaderboardGame)) return false;
    if (activeMode === 'school') {
      return sanitizeInput(entry.studentId || '', 10) === targetSid;
    }
    return isDormsRecord(entry, '', false);
  }

  function collectPlayerScoreKeys(item, dataObj) {
    const keys = [];
    addScoreKey(keys, item && item.recordKey);
    if (item && Array.isArray(item.extraKeys)) {
      item.extraKeys.forEach((k) => addScoreKey(keys, k));
    }
    if (!dataObj || typeof dataObj !== 'object' || !item) return keys;

    const walk = (obj, prefix, isDormsSubtree) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((key) => {
        const entry = obj[key];
        if (!entry || typeof entry !== 'object') return;
        const path = prefix ? `${prefix}/${key}` : key;
        if (entry.name || entry.playerName) {
          if (!matchesActiveMode(entry, key, isDormsSubtree)) return;
          if (!entryMatchesLeaderboardPlayer(entry, item)) return;
          addScoreKey(keys, path);
          return;
        }
        walk(entry, path, key === 'dorms' || isDormsSubtree);
      });
    };
    walk(dataObj, '', false);
    return keys;
  }

  function scoresDatabaseUrl() {
    return (firebaseConfig && firebaseConfig.databaseURL)
      || 'https://math-game-halogini-default-rtdb.firebaseio.com';
  }

  function withAsyncTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(label || 'timeout')), ms);
      })
    ]);
  }

  async function deleteScoreKey(path, idToken) {
    const segments = scoreRecordPath(path);
    if (!segments) throw new Error('empty-path');
    if (!idToken) throw new Error('no-auth');

    const urlPath = segments.split('/').map(encodeURIComponent).join('/');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(
        `${scoresDatabaseUrl()}/scores/${urlPath}.json?auth=${encodeURIComponent(idToken)}`,
        { method: 'DELETE', signal: controller.signal }
      );
      if (res.ok) return;

      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = String((parsed && parsed.error) || text);
      } catch (e) { /* ignore */ }
      const err = new Error(message || `HTTP ${res.status}`);
      if (res.status === 401 || /permission denied/i.test(message)) {
        err.code = 'PERMISSION_DENIED';
      }
      throw err;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const timeoutErr = new Error('delete-timeout');
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function deleteAdminRecord(item, triggerBtn) {
    if (!portalAdminUnlocked || !item) return;
    if (!firebaseDb || !firebaseAuth) {
      window.alert('데이터베이스에 연결되지 않았습니다. 페이지를 새로고침해 주세요.');
      return;
    }
    const adminUser = currentAdminUser();
    if (!adminUser) {
      window.alert('관리자 로그인이 풀렸습니다. 다시 로그인해 주세요.');
      portalAdminUnlocked = false;
      applyAdminChrome();
      listenRealtimeLeaderboard();
      openAdminGate();
      return;
    }
    const label = activeMode === 'school' && item.studentId
      ? `${item.name} (${item.studentId})`
      : (item.name || '이 기록');
    if (!window.confirm(`${label} 기록을 삭제할까요?\n되돌릴 수 없습니다.`)) return;

    const btn = triggerBtn && triggerBtn.tagName ? triggerBtn : null;
    const btnLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '삭제 중…';
    }

    try {
      let keys = collectPlayerScoreKeys(item, null);
      if (!keys.length) {
        const dataObj = await fetchScoresDataViaRest(5000);
        keys = collectPlayerScoreKeys(item, dataObj);
      }

      if (!keys.length) {
        window.alert('이 기록의 저장 위치를 찾지 못했습니다.');
        return;
      }

      const idToken = await withAsyncTimeout(adminUser.getIdToken(true), 6000, 'auth-timeout');
      let deleted = 0;
      const failures = [];
      for (let i = 0; i < keys.length; i++) {
        try {
          await deleteScoreKey(keys[i], idToken);
          deleted += 1;
        } catch (err) {
          console.error('Delete failed for', keys[i], err);
          failures.push({ key: keys[i], err });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
      listenRealtimeLeaderboard();

      if (deleted === 0) {
        const first = failures[0] && failures[0].err;
        const code = String((first && first.code) || (first && first.message) || '');
        if (/PERMISSION_DENIED|permission-denied|permission denied/i.test(code)) {
          window.alert('삭제 권한이 없습니다. Firebase 콘솔 → Realtime Database → 규칙에서 validate 끝에 `: true`가 있는지 확인해 주세요.');
        } else if (/TIMEOUT|auth-timeout|delete-timeout/i.test(code)) {
          window.alert('삭제 요청 시간이 초과됐습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
        } else {
          window.alert('삭제에 실패했습니다. 로그인 상태와 네트워크를 확인해 주세요.');
        }
        return;
      }

      if (failures.length) {
        window.alert(`${deleted}개 기록은 삭제했지만 ${failures.length}개는 남았습니다. 잠시 후 다시 시도해 주세요.`);
        return;
      }

      window.alert(`${label} 기록 ${deleted}개를 삭제했습니다.`);
    } catch (err) {
      console.error('Admin delete failed:', err);
      window.alert('삭제에 실패했습니다. 로그인 상태와 네트워크를 확인해 주세요.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btnLabel || '삭제';
      }
    }
  }

  function renderLeaderboardTable(list) {
    if (!leaderboardTbody) return;
    leaderboardTbody.removeAttribute('aria-busy');
    leaderboardTbody.innerHTML = '';

    const visible = filterAdminList(list);
    const colSpan = (activeMode === 'school' ? 4 : 3) + (portalAdminUnlocked ? 1 : 0);

    if (adminCount) {
      adminCount.textContent = portalAdminUnlocked
        ? (adminQuery.trim() ? `표시 ${visible.length}명 / 전체 ${list.length}명` : `전체 ${visible.length}명`)
        : '';
    }

    if (!visible || visible.length === 0) {
      const emptyMsg = portalAdminUnlocked && lastFullList.length && adminQuery.trim()
        ? '검색 결과가 없습니다.'
        : '아직 등록된 기록이 없습니다. 첫 번째 챔피언이 되어 보세요!';
      leaderboardTbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:16px; text-align:center; color:#64748b;">${emptyMsg}</td></tr>`;
      return;
    }

    const getCompetitionRankKey = (item) => {
      if (activeLeaderboardGame === 'three-chances') {
        return item.metricLabel || formatClearTime(item.clearTimeMs);
      }
      if (activeLeaderboardGame === 'bingsoo2') {
        return `${item.score}_${item.totalErrorPx}_${item.playTimeMs}`;
      }
      return item.score;
    };

    const ranked = withCompetitionRanks(visible, getCompetitionRankKey);

    ranked.forEach(({ item, rank, tied }) => {
      const tr = document.createElement('tr');
      const rankDisplay = formatRankLabel(rank, tied);

      let idTd = '';
      if (activeMode === 'school') {
        idTd = `<td>${escapeHtml(item.studentId || '—')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${rank}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${escapeHtml(item.metricLabel || (item.score != null ? `${item.score}점` : '-'))}</strong></td>
      `;
      if (portalAdminUnlocked) {
        const td = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-btn admin-btn-delete';
        btn.textContent = '삭제';
        btn.addEventListener('click', () => deleteAdminRecord(item, btn));
        td.appendChild(btn);
        tr.appendChild(td);
      }
      leaderboardTbody.appendChild(tr);
    });
  }

  if (btnAdminUnlock) btnAdminUnlock.addEventListener('click', submitAdminLogin);
  if (btnAdminCancel) {
    btnAdminCancel.addEventListener('click', () => {
      setElHidden(adminGate, true);
      stripAdminQuery();
    });
  }
  if (btnAdminExit) btnAdminExit.addEventListener('click', exitAdminMode);
  if (btnAdminExport) btnAdminExport.addEventListener('click', exportAdminCsv);
  if (btnAdminToggleMode) {
    btnAdminToggleMode.addEventListener('click', toggleAdminChannelMode);
  }
  if (adminSearch) {
    adminSearch.addEventListener('input', () => {
      adminQuery = adminSearch.value || '';
      renderLeaderboardTable(getLeaderboardDisplayList(lastFullList, activeLeaderboardGame));
    });
  }
  function onAdminLoginKey(e) {
    if (e.key === 'Enter') submitAdminLogin();
  }
  if (adminEmailInput) adminEmailInput.addEventListener('keydown', onAdminLoginKey);
  if (adminPassInput) adminPassInput.addEventListener('keydown', onAdminLoginKey);
  if (logoBadge) {
    let logoClicks = 0;
    let logoTimer = null;
    logoBadge.addEventListener('click', () => {
      logoClicks += 1;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => { logoClicks = 0; }, 1400);
      if (logoClicks >= 7) {
        logoClicks = 0;
        openAdminGate();
      }
    });
  }

  if (leaderboardFold) {
    leaderboardFold.addEventListener('toggle', onLeaderboardFoldToggle);
  }
  if (btnSessionUsageRefresh) {
    btnSessionUsageRefresh.addEventListener('click', () => {
      sessionUsageLoadingFlag = false;
      loadSessionUsageStats();
    });
  }
  if (sessionUsageFold) {
    sessionUsageFold.addEventListener('toggle', () => {
      if (sessionUsageFold.open && portalAdminUnlocked) {
        sessionUsageLoadingFlag = false;
        loadSessionUsageStats();
      }
    });
  }

  function startPortal() {
    const wantAdmin = (urlParams.get('admin') || '').toLowerCase();
    if (wantAdmin === '1' || wantAdmin === 'true') {
      if (currentAdminUser()) enterAdminMode();
      else openAdminGate();
    } else {
      setElHidden(leaderboardSection, true);
    }
    updateMetricHeader();
  }

  if (firebaseAuth) {
    const unsub = firebaseAuth.onAuthStateChanged(() => {
      unsub();
      startPortal();
    });
  } else {
    startPortal();
  }
});
