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
  const sessionUsageByDay = document.getElementById('session-usage-by-day');
  const sessionUsageByGame = document.getElementById('session-usage-by-game');
  const sessionUsageLoading = document.getElementById('session-usage-loading');
  const btnSessionUsageRefresh = document.getElementById('btn-session-usage-refresh');
  const btnPurgeExpiredRooms = document.getElementById('btn-purge-expired-rooms');
  const purgeExpiredStatus = document.getElementById('purge-expired-status');
  const purgeConfirm = document.getElementById('purge-confirm');
  const purgeConfirmBody = document.getElementById('purge-confirm-body');
  const btnPurgeConfirmOk = document.getElementById('btn-purge-confirm-ok');
  const btnPurgeConfirmCancel = document.getElementById('btn-purge-confirm-cancel');
  const playStatsFold = document.getElementById('play-stats-fold');
  const playStatsTitle = document.getElementById('play-stats-title');
  const playStatsCards = document.getElementById('play-stats-cards');
  const playStatsByDay = document.getElementById('play-stats-by-day');
  const playStatsByGame = document.getElementById('play-stats-by-game');
  const playStatsLoading = document.getElementById('play-stats-loading');
  const btnPlayStatsRefresh = document.getElementById('btn-play-stats-refresh');

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
  let playStatsLoadingFlag = false;

  const SESSION_GAME_LABELS = {
    bingsoo: '팥빙수',
    bingsoo2: '팥빙수 2탄',
    'prism-tycoon': '보석 타이쿤',
    tycoon: '보석 타이쿤',
    'three-chances': '기회는 세 번',
    congruence: '합동'
  };

  function usageDayKeyKst(nowMs) {
    const t = Number(nowMs) || Date.now();
    const kst = new Date(t + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatUsageDayLabel(dayKey, todayKey) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''));
    if (!m) return String(dayKey || '');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
    const label = `${m[1]}-${m[2]}-${m[3]} (${weekday})`;
    return dayKey === todayKey ? `${label} · 오늘` : label;
  }

  function hideUsageTable(el) {
    if (!el) return;
    el.hidden = true;
    el.innerHTML = '';
    if (el._usageChartClick) {
      el.removeEventListener('click', el._usageChartClick);
      el._usageChartClick = null;
    }
  }

  const usageChartState = new WeakMap();

  function buildUsageDaySeries(byDay, countFn) {
    return Object.keys(byDay || {})
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
      .map((day) => ({ day, count: countFn(byDay[day]) }))
      .filter((row) => row.count > 0)
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  function formatUsageMonthLabel(monthKey) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
    if (!m) return String(monthKey || '');
    return `${m[1]}년 ${Number(m[2])}월`;
  }

  function daysInCalendarMonth(monthKey) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
    if (!m) return 31;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  }

  function defaultUsageChartMonth(daySeries) {
    if (!daySeries.length) return usageDayKeyKst().slice(0, 7);
    return daySeries[daySeries.length - 1].day.slice(0, 7);
  }

  function buildUsageMonthSeries(daySeries) {
    const months = {};
    daySeries.forEach((row) => {
      const mk = row.day.slice(0, 7);
      months[mk] = (months[mk] || 0) + row.count;
    });
    return Object.keys(months).sort().map((monthKey) => ({
      monthKey,
      count: months[monthKey],
      label: formatUsageMonthLabel(monthKey)
    }));
  }

  function renderUsageHBarRows(bars, maxVal) {
    const max = Math.max(maxVal, 1);
    return bars.map((bar) => {
      const pct = Math.max(bar.value > 0 ? 6 : 0, Math.round((bar.value / max) * 100));
      const todayCls = bar.today ? ' usage-bar-fill-today' : '';
      const title = escapeHtml(bar.title || `${bar.label}: ${bar.value}`);
      return `<div class="usage-bar-row" title="${title}">
        <span class="usage-bar-label">${escapeHtml(bar.label)}</span>
        <div class="usage-bar-track"><div class="usage-bar-fill${todayCls}" style="width:${pct}%"></div></div>
        <span class="usage-bar-value">${bar.value}</span>
      </div>`;
    }).join('');
  }

  function renderUsageColumnChart(monthKey, dayMap, todayKey) {
    const totalDays = daysInCalendarMonth(monthKey);
    const counts = [];
    for (let d = 1; d <= totalDays; d += 1) {
      const day = `${monthKey}-${String(d).padStart(2, '0')}`;
      counts.push(dayMap[day] || 0);
    }
    const max = Math.max(...counts, 1);
    const gridCols = `repeat(${totalDays}, minmax(0, 1fr))`;
    const bars = counts.map((val, idx) => {
      const day = `${monthKey}-${String(idx + 1).padStart(2, '0')}`;
      const h = val > 0 ? Math.max(10, Math.round((val / max) * 100)) : 0;
      const todayCls = day === todayKey ? ' usage-column-today' : '';
      return `<div class="usage-column${todayCls}" title="${escapeHtml(formatUsageDayLabel(day, todayKey))}: ${val}">
        <div class="usage-column-track"><div class="usage-column-fill" style="height:${h}%"></div></div>
      </div>`;
    }).join('');
    const labels = counts.map((val, idx) => {
      const day = `${monthKey}-${String(idx + 1).padStart(2, '0')}`;
      const showLabel = idx === 0 || (idx + 1) % 5 === 0 || idx + 1 === totalDays;
      const todayCls = day === todayKey ? ' usage-column-label-today' : '';
      return `<span class="usage-column-day${todayCls}">${showLabel ? idx + 1 : '\u00a0'}</span>`;
    }).join('');
    return `<div class="usage-column-chart-wrap" role="img" aria-label="${escapeHtml(formatUsageMonthLabel(monthKey))} 일별 차트">
      <div class="usage-column-chart" style="grid-template-columns:${gridCols}">${bars}</div>
      <div class="usage-column-labels" style="grid-template-columns:${gridCols}">${labels}</div>
    </div>`;
  }

  function renderUsageDayCharts(container, byDay, countFn, countHeader) {
    if (!container) return;
    const daySeries = buildUsageDaySeries(byDay, countFn);
    if (!daySeries.length) {
      hideUsageTable(container);
      return;
    }

    const todayKey = usageDayKeyKst();
    const todayMonth = todayKey.slice(0, 7);
    const monthSeries = buildUsageMonthSeries(daySeries);
    const monthKeys = monthSeries.map((row) => row.monthKey);
    let state = usageChartState.get(container);
    if (!state) state = {};
    if (!state.selectedMonth || monthKeys.indexOf(state.selectedMonth) < 0) {
      state.selectedMonth = defaultUsageChartMonth(daySeries);
    }
    state.byDay = byDay;
    state.countFn = countFn;
    state.countHeader = countHeader;
    usageChartState.set(container, state);

    const selectedMonth = state.selectedMonth;
    const monthIdx = monthKeys.indexOf(selectedMonth);
    const monthTotal = (monthSeries.find((row) => row.monthKey === selectedMonth) || {}).count || 0;
    const monthMax = Math.max(...monthSeries.map((row) => row.count), 1);
    const dayMap = {};
    daySeries.forEach((row) => { dayMap[row.day] = row.count; });

    const monthBars = monthSeries.map((row) => ({
      label: row.label,
      value: row.count,
      today: row.monthKey === todayMonth,
      title: `${row.label}: ${row.count}`
    }));

    const dayRows = daySeries
      .filter((row) => row.day.indexOf(selectedMonth) === 0)
      .slice()
      .reverse()
      .map((row) => {
        const todayAttr = row.day === todayKey ? ' class="session-usage-day-today"' : '';
        return `<tr${todayAttr}>
          <td>${escapeHtml(formatUsageDayLabel(row.day, todayKey))}</td>
          <td>${row.count}</td>
        </tr>`;
      });

    const prevDisabled = monthIdx <= 0 ? ' disabled' : '';
    const nextDisabled = monthIdx < 0 || monthIdx >= monthKeys.length - 1 ? ' disabled' : '';

    container.hidden = false;
    container.className = 'session-usage-by-game session-usage-charts';
    container.innerHTML = `
      <section class="usage-chart-panel">
        <h3 class="usage-chart-heading">월별 ${escapeHtml(countHeader)}</h3>
        <div class="usage-bar-chart">${renderUsageHBarRows(monthBars, monthMax)}</div>
      </section>
      <section class="usage-chart-panel">
        <div class="usage-chart-nav">
          <button type="button" class="admin-btn usage-chart-nav-btn" data-chart-nav="prev"${prevDisabled} aria-label="이전 달">◀</button>
          <span class="usage-chart-nav-label">${escapeHtml(formatUsageMonthLabel(selectedMonth))} · 합계 ${monthTotal}</span>
          <button type="button" class="admin-btn usage-chart-nav-btn" data-chart-nav="next"${nextDisabled} aria-label="다음 달">▶</button>
        </div>
        <h3 class="usage-chart-heading">일별 ${escapeHtml(countHeader)}</h3>
        ${renderUsageColumnChart(selectedMonth, dayMap, todayKey)}
        ${dayRows.length ? `<table class="usage-month-table">
          <thead><tr><th>날짜</th><th>${escapeHtml(countHeader)}</th></tr></thead>
          <tbody>${dayRows.join('')}</tbody>
        </table>` : '<p class="session-usage-loading">이 달에 집계된 날짜가 없습니다.</p>'}
      </section>`;

    if (!container._usageChartClick) {
      container._usageChartClick = (event) => {
        const btn = event.target.closest('[data-chart-nav]');
        if (!btn || btn.disabled || !container.contains(btn)) return;
        const chartState = usageChartState.get(container);
        if (!chartState || !chartState.byDay || !chartState.countFn) return;
        const series = buildUsageDaySeries(chartState.byDay, chartState.countFn);
        const keys = buildUsageMonthSeries(series).map((row) => row.monthKey);
        const curIdx = keys.indexOf(chartState.selectedMonth);
        if (curIdx < 0) return;
        const dir = btn.getAttribute('data-chart-nav');
        const nextIdx = dir === 'prev' ? curIdx - 1 : curIdx + 1;
        if (nextIdx < 0 || nextIdx >= keys.length) return;
        chartState.selectedMonth = keys[nextIdx];
        usageChartState.set(container, chartState);
        renderUsageDayCharts(container, chartState.byDay, chartState.countFn, chartState.countHeader);
      };
      container.addEventListener('click', container._usageChartClick);
    }
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
    hideUsageTable(sessionUsageByDay);
    hideUsageTable(sessionUsageByGame);
    if (sessionUsageFold) sessionUsageFold.open = false;
    if (purgeExpiredStatus) {
      purgeExpiredStatus.hidden = true;
      purgeExpiredStatus.textContent = '';
    }
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
    hideUsageTable(sessionUsageByDay);
    hideUsageTable(sessionUsageByGame);
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

    renderUsageDayCharts(sessionUsageByDay, byDay, qualifiedSessionCount, '세션 수');

    const gameRows = Object.keys(byGame).sort().map((gameId) => {
      if (String(gameId).indexOf('play_') === 0) return '';
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
          <caption>게임별</caption>
          <thead>
            <tr><th>게임</th><th>세션 수</th></tr>
          </thead>
          <tbody>${gameRows.join('')}</tbody>
        </table>`;
      } else {
        hideUsageTable(sessionUsageByGame);
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

  function playStatsCount(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    if (obj.plays != null) return sessionUsageCount(obj.plays);
    return 0;
  }

  function normalizePlayGameId(raw) {
    const id = String(raw || '').trim();
    if (!id || id === 'bingsoo') return 'bingsoo';
    if (id === 'bingsoo2' || id === 'bingsoo-2') return 'bingsoo2';
    if (id === 'prism-tycoon' || id === 'tycoon') return 'prism-tycoon';
    if (id === 'three-chances' || id === 'three_chances') return 'three-chances';
    if (id === 'congruence' || id === 'triangle' || id === 'congruence_game') return 'congruence';
    return id.slice(0, 24) || 'unknown';
  }

  function emptyPlayFloor() {
    return { total: 0, byDay: {}, byGame: {} };
  }

  function bumpPlayFloor(floor, gameId, channel, day, n) {
    const count = Number(n);
    if (!Number.isFinite(count) || count <= 0) return;
    floor.total += count;
    if (gameId) floor.byGame[gameId] = (floor.byGame[gameId] || 0) + count;
    if (day) floor.byDay[day] = (floor.byDay[day] || 0) + count;
  }

  function collectPlayFloorFromScores(dataObj) {
    const floor = emptyPlayFloor();
    const visit = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        if (!item || typeof item !== 'object') return;
        if (item.name || item.playerName) {
          const gameId = normalizePlayGameId(item.gameId || item.game || '');
          const ts = Number(item.timestamp);
          const day = Number.isFinite(ts) && ts > 0 ? usageDayKeyKst(ts) : '';
          bumpPlayFloor(floor, gameId, 'arcade', day, 1);
          return;
        }
        visit(item);
      });
    };
    visit(dataObj);
    return floor;
  }

  function takePlayStatsMax(parsed, arcadeFloor) {
    const parsedSafe = parsed && typeof parsed === 'object' ? parsed : {};
    const arcade = arcadeFloor && typeof arcadeFloor === 'object' ? arcadeFloor : emptyPlayFloor();

    function dayCount(map, day) {
      return playStatsCount(map && map[day]);
    }

    function combinedDayPlays(day) {
      const recorded = dayCount(parsedSafe.byDay, day);
      const recArcade = dayCount(parsedSafe.byDayArcade, day);
      const recLive = dayCount(parsedSafe.byDayLive, day);
      const scoreN = arcade.byDay[day] || 0;
      if (recLive > 0) {
        const arcadeN = Math.max(recArcade, scoreN, Math.max(0, recorded - recLive));
        return arcadeN + recLive;
      }
      return Math.max(recorded, scoreN, recArcade);
    }

    const dayKeys = {};
    Object.keys(parsedSafe.byDay || {}).forEach((k) => { dayKeys[k] = true; });
    Object.keys(parsedSafe.byDayArcade || {}).forEach((k) => { dayKeys[k] = true; });
    Object.keys(parsedSafe.byDayLive || {}).forEach((k) => { dayKeys[k] = true; });
    Object.keys(arcade.byDay || {}).forEach((k) => { dayKeys[k] = true; });

    const byDay = {};
    Object.keys(dayKeys).forEach((day) => {
      const n = combinedDayPlays(day);
      if (n) byDay[day] = { plays: n };
    });

    const recordedTotal = playStatsCount(parsedSafe.totals);
    const recLiveTotal = Object.keys(parsedSafe.byDayLive || {}).reduce((sum, day) => {
      return sum + dayCount(parsedSafe.byDayLive, day);
    }, 0);
    const arcadeTotal = arcade.total || 0;
    const total = recLiveTotal > 0
      ? Math.max(recordedTotal, arcadeTotal + recLiveTotal)
      : Math.max(recordedTotal, arcadeTotal);

    const byGame = {};
    const gameKeys = {};
    Object.keys(parsedSafe.byGame || {}).forEach((k) => { gameKeys[k] = true; });
    Object.keys(arcade.byGame || {}).forEach((k) => { gameKeys[k] = true; });
    Object.keys(gameKeys).forEach((gid) => {
      const n = Math.max(
        playStatsCount(parsedSafe.byGame && parsedSafe.byGame[gid]),
        arcade.byGame[gid] || 0
      );
      if (n) byGame[gid] = { plays: n };
    });

    return { totals: { plays: total }, byDay, byGame };
  }

  function playStatsNeedsWrite(parsed, merged) {
    if (playStatsCount(merged.totals) > playStatsCount(parsed.totals)) return true;
    const checkMap = (a, b) => {
      const keys = {};
      Object.keys(a || {}).forEach((k) => { keys[k] = true; });
      Object.keys(b || {}).forEach((k) => { keys[k] = true; });
      return Object.keys(keys).some((k) => playStatsCount(b && b[k]) > playStatsCount(a && a[k]));
    };
    return checkMap(parsed.byDay, merged.byDay) || checkMap(parsed.byGame, merged.byGame);
  }

  async function writePlayStatsBaseline(merged, idToken) {
    const patch = {};
    const total = playStatsCount(merged.totals);
    if (total > 0) patch['byGame/play_total/qualified'] = total;
    Object.keys(merged.byDay || {}).forEach((day) => {
      const n = playStatsCount(merged.byDay[day]);
      if (n > 0) patch[`byGame/play_day_${day}/qualified`] = n;
    });
    Object.keys(merged.byGame || {}).forEach((gid) => {
      const n = playStatsCount(merged.byGame[gid]);
      if (n > 0) patch[`byGame/play_game_${gid}/qualified`] = n;
    });
    if (!Object.keys(patch).length) return;
    await adminAuthFetch('sessionUsage', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }, idToken);
  }

  function clearPlayStats() {
    if (playStatsTitle) playStatsTitle.textContent = '🎮 플레이 통계';
    if (playStatsCards) {
      playStatsCards.innerHTML = '';
      if (playStatsLoading) {
        playStatsLoading.hidden = false;
        playStatsLoading.textContent = '불러오는 중…';
        playStatsCards.appendChild(playStatsLoading);
      }
    }
    hideUsageTable(playStatsByDay);
    hideUsageTable(playStatsByGame);
    if (playStatsFold) playStatsFold.open = false;
  }

  function showPlayStatsMessage(message) {
    if (playStatsTitle) playStatsTitle.textContent = '🎮 플레이 통계';
    if (playStatsCards) {
      playStatsCards.innerHTML = `<p class="session-usage-loading">${escapeHtml(message)}</p>`;
    }
    hideUsageTable(playStatsByDay);
    hideUsageTable(playStatsByGame);
  }

  function renderPlayStats(data) {
    const payload = data && typeof data === 'object' ? data : {};
    const totals = payload.totals && typeof payload.totals === 'object' ? payload.totals : {};
    const byDay = payload.byDay && typeof payload.byDay === 'object' ? payload.byDay : {};
    const byGame = payload.byGame && typeof payload.byGame === 'object' ? payload.byGame : {};
    const todayKey = usageDayKeyKst();
    const today = byDay[todayKey] && typeof byDay[todayKey] === 'object' ? byDay[todayKey] : {};

    const total = playStatsCount(totals);
    const todayCount = playStatsCount(today);

    if (playStatsTitle) {
      playStatsTitle.textContent = `🎮 플레이 · 누적 ${total} · 오늘 ${todayCount}`;
    }

    if (playStatsCards) {
      playStatsCards.innerHTML = renderSessionUsageCard('전체 플레이', total, todayCount)
        + (total === 0
          ? '<p class="session-usage-loading">확인된 기록이 없습니다.</p>'
          : '');
    }

    renderUsageDayCharts(playStatsByDay, byDay, playStatsCount, '플레이 수');

    const gameRows = Object.keys(byGame).sort().map((gameId) => {
      const row = byGame[gameId] || {};
      const label = SESSION_GAME_LABELS[gameId] || gameId;
      const count = playStatsCount(row);
      if (!count) return '';
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${count}</td>
      </tr>`;
    }).filter(Boolean);

    if (playStatsByGame) {
      if (gameRows.length) {
        playStatsByGame.hidden = false;
        playStatsByGame.innerHTML = `<table>
          <caption>게임별</caption>
          <thead>
            <tr><th>게임</th><th>플레이 수</th></tr>
          </thead>
          <tbody>${gameRows.join('')}</tbody>
        </table>`;
      } else {
        hideUsageTable(playStatsByGame);
      }
    }
  }

  async function loadPlayStats() {
    if (!portalAdminUnlocked) return;
    if (!firebaseDb && !firebaseConfig) {
      showPlayStatsMessage('통계를 불러올 수 없습니다. Firebase 설정을 확인해 주세요.');
      return;
    }
    if (!currentAdminUser()) {
      showPlayStatsMessage('관리자 로그인이 필요합니다.');
      return;
    }
    if (playStatsLoadingFlag) return;
    playStatsLoadingFlag = true;
    if (playStatsLoading && playStatsCards && playStatsCards.contains(playStatsLoading)) {
      playStatsLoading.textContent = '불러오는 중…';
    }
    try {
      const adminUser = currentAdminUser();
      const [usage, scoresData] = await Promise.all([
        fetchSessionUsageViaRest(5000),
        fetchScoresDataViaRest(8000)
      ]);
      const parsed = (window.HalomathPlayStats && typeof window.HalomathPlayStats.parsePlayStatsFromSessionUsage === 'function')
        ? window.HalomathPlayStats.parsePlayStatsFromSessionUsage(usage)
        : parsePlayStatsFromUsageFallback(usage);
      const arcadeFloor = collectPlayFloorFromScores(scoresData);
      const merged = takePlayStatsMax(parsed, arcadeFloor);
      if (playStatsNeedsWrite(parsed, merged)) {
        try {
          const idToken = await adminUser.getIdToken(true);
          await writePlayStatsBaseline(merged, idToken);
        } catch (writeErr) {
          console.warn('play stats baseline write failed:', writeErr);
        }
      }
      renderPlayStats(merged);
    } catch (err) {
      console.warn('play stats failed:', err);
      const code = String((err && err.code) || '');
      if (code === 'PERMISSION_DENIED') {
        showPlayStatsMessage('통계를 불러오지 못했습니다. 관리자 이메일 로그인인지 확인해 주세요.');
      } else if (code === 'ADMIN_EMAIL_REQUIRED') {
        showPlayStatsMessage('통계는 이메일로 로그인한 관리자만 볼 수 있습니다. 관리자 종료 후 다시 로그인해 주세요.');
      } else if (code === 'SESSION_USAGE_TIMEOUT' || code === 'PLAY_STATS_TIMEOUT') {
        showPlayStatsMessage('통계 응답이 없습니다. 네트워크를 확인한 뒤 새로고침해 주세요.');
      } else {
        showPlayStatsMessage('통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
      }
    } finally {
      playStatsLoadingFlag = false;
    }
  }

  function parsePlayStatsFromUsageFallback(data) {
    const byGameRaw = data && data.byGame && typeof data.byGame === 'object' ? data.byGame : {};
    const totals = { plays: 0 };
    const byDay = {};
    const byGame = {};
    const byDayArcade = {};
    const byDayLive = {};
    Object.keys(byGameRaw).forEach((key) => {
      if (String(key).indexOf('play_') !== 0) return;
      const n = Number((byGameRaw[key] || {}).qualified);
      const count = Number.isFinite(n) && n >= 0 ? n : 0;
      if (!count) return;
      if (key === 'play_total') totals.plays = count;
      else if (key.indexOf('play_dch_') === 0) {
        const rest = key.slice(9);
        const m = /^(\d{4}-\d{2}-\d{2})_(arcade|live)$/.exec(rest);
        if (!m) return;
        const bucket = m[2] === 'live' ? byDayLive : byDayArcade;
        bucket[m[1]] = { plays: count };
      } else if (key.indexOf('play_day_') === 0) byDay[key.slice(9)] = { plays: count };
      else if (key.indexOf('play_game_') === 0) byGame[key.slice(10)] = { plays: count };
    });
    return { totals, byDay, byGame, byDayArcade, byDayLive };
  }

  const LIVE_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
  const MIN_QUALIFIED_PLAYERS = 3;
  let purgeExpiredRunning = false;

  function hidePurgeConfirm() {
    if (purgeConfirm) purgeConfirm.hidden = true;
    if (purgeConfirmBody) purgeConfirmBody.innerHTML = '';
  }

  function askPurgeConfirm(html) {
    return new Promise((resolve) => {
      if (!purgeConfirm || !purgeConfirmBody || !btnPurgeConfirmOk || !btnPurgeConfirmCancel) {
        resolve(window.confirm('이대로 진행할까요?'));
        return;
      }
      purgeConfirm.hidden = false;
      purgeConfirmBody.innerHTML = html;
      const finish = (ok) => {
        btnPurgeConfirmOk.removeEventListener('click', onOk);
        btnPurgeConfirmCancel.removeEventListener('click', onCancel);
        hidePurgeConfirm();
        resolve(ok);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      btnPurgeConfirmOk.addEventListener('click', onOk);
      btnPurgeConfirmCancel.addEventListener('click', onCancel);
      try {
        purgeConfirm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) { /* ignore */ }
    });
  }

  function setPurgeStatus(message, visible) {
    if (!purgeExpiredStatus) return;
    if (!visible) {
      purgeExpiredStatus.hidden = true;
      purgeExpiredStatus.textContent = '';
      return;
    }
    purgeExpiredStatus.hidden = false;
    purgeExpiredStatus.textContent = message || '';
  }

  function normalizeLiveGameId(gameId) {
    const id = String(gameId || 'bingsoo').trim().slice(0, 24);
    return id || 'bingsoo';
  }

  function collectLivePlayerCount(players) {
    if (!players || typeof players !== 'object') return 0;
    let count = 0;
    Object.keys(players).forEach((key) => {
      const row = players[key];
      if (!row || typeof row !== 'object') return;
      const name = String(row.name || '').trim();
      if (name) count += 1;
    });
    return count;
  }

  function usageDedupKey(code, createdAt) {
    const ca = Number(createdAt) || 0;
    return `${String(code || '').toUpperCase()}_${ca}`.replace(/[.#$\[\]/]/g, '_');
  }

  function qualifiedCount(raw) {
    const n = Number(raw && raw.qualified);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function readLivePlayDay(day, idToken, signal) {
    try {
      const raw = await adminAuthFetch(`sessionUsage/byGame/play_dch_${day}_live`, { method: 'GET' }, idToken, signal);
      return qualifiedCount(raw);
    } catch (e) {
      return 0;
    }
  }

  async function previewRoomSync(room, code, idToken, signal) {
    const meta = room && room.meta && typeof room.meta === 'object' ? room.meta : {};
    const playerCount = collectLivePlayerCount(room && room.players);
    const createdAt = Number(meta.createdAt) || 0;
    const day = createdAt ? usageDayKeyKst(createdAt) : '';
    const preview = {
      playerCount,
      createdAt,
      day,
      sessionNew: false,
      sessionUnknown: false,
      playLedger: 0,
      playDelta: 0,
      resetLedger: false
    };

    if (playerCount < MIN_QUALIFIED_PLAYERS) return preview;
    if (!createdAt) {
      preview.sessionUnknown = true;
      return preview;
    }

    const dedupKey = usageDedupKey(code, createdAt);
    try {
      const isDeduped = await adminAuthFetch(`sessionUsage/dedup/${dedupKey}`, { method: 'GET' }, idToken, signal);
      preview.sessionNew = !isDeduped;
    } catch (e) {
      preview.sessionUnknown = true;
    }

    const stats = window.HalomathPlayStats;
    if (!stats || typeof stats.roomPlayLedgerKey !== 'function') return preview;
    const n = Math.max(0, Math.min(200, Math.floor(playerCount)));
    const ledgerKey = stats.roomPlayLedgerKey(code, createdAt);
    let prev = 0;
    try {
      const prevRaw = await adminAuthFetch(`sessionUsage/roomPlays/${ledgerKey}`, { method: 'GET' }, idToken, signal);
      prev = Number(prevRaw);
      if (!Number.isFinite(prev) || prev < 0) prev = 0;
    } catch (e) {
      prev = 0;
    }
    preview.playLedger = prev;
    if (n > prev) preview.playDelta = n - prev;
    return preview;
  }

  function formatRoomSyncDetail(code, preview) {
    const n = preview.playerCount;
    if (n > 0 && n < MIN_QUALIFIED_PLAYERS) {
      return `${code} ${n}명 — 3명 미만이라 통계에 넣지 않음`;
    }
    if (!preview.createdAt) {
      return `${code} ${n}명 — 방 정보가 불완전함`;
    }
    const sessionBit = preview.sessionNew
      ? '수업 횟수에 새로 넣음'
      : (preview.sessionUnknown ? '수업 횟수는 확인 못 함' : '수업 횟수는 이미 들어 있음');
    const playBit = (preview.resetLedger || preview.playDelta > 0)
      ? `참가 인원 +${preview.playDelta}명`
      : '참가 인원은 이미 들어 있음';
    return `${code} ${n}명 — ${sessionBit}, ${playBit}`;
  }

  async function adminAuthFetch(path, options, idToken, signal) {
    const dbUrl = (firebaseConfig && firebaseConfig.databaseURL) || 'https://math-game-halogini-default-rtdb.firebaseio.com';
    const clean = String(path || '').replace(/^\//, '');
    const url = `${dbUrl}/${clean}.json?auth=${encodeURIComponent(idToken)}`;
    const res = await fetch(url, {
      method: (options && options.method) || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options && options.body != null ? options.body : undefined,
      signal
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      const err = new Error('PERMISSION_DENIED');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }
    if (!res.ok) {
      const err = new Error(text || res.statusText);
      err.code = String(res.status);
      throw err;
    }
    if (!text || text === 'null') return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async function adminRecordLivePlayCount(room, code, idToken, signal, options) {
    const stats = window.HalomathPlayStats;
    if (!stats || typeof stats.buildLivePlayPatchBody !== 'function' || typeof stats.roomPlayLedgerKey !== 'function') {
      throw new Error('PLAY_STATS_MODULE_MISSING');
    }
    const meta = room && room.meta && typeof room.meta === 'object' ? room.meta : {};
    const playerCount = collectLivePlayerCount(room && room.players);
    if (playerCount < MIN_QUALIFIED_PLAYERS) return 0;
    const n = Math.max(0, Math.min(200, Math.floor(playerCount)));
    if (!n) return 0;
    const gameId = normalizeLiveGameId(meta.gameId);
    const createdAt = Number(meta.createdAt) || 0;
    const targetAt = createdAt > 0 ? createdAt : Date.now();
    const ledgerKey = stats.roomPlayLedgerKey(code, createdAt);
    let prev = 0;
    try {
      const prevRaw = await adminAuthFetch(`sessionUsage/roomPlays/${ledgerKey}`, { method: 'GET' }, idToken, signal);
      prev = Number(prevRaw);
      if (!Number.isFinite(prev) || prev < 0) prev = 0;
    } catch (e) {
      prev = 0;
    }
    if (options && options.resetLedger && prev > 0) {
      // 원장만 높고 통계는 비어 있는 경우: 규칙 변경 없이 현재 인원만 더한다.
      await adminAuthFetch('sessionUsage', {
        method: 'PATCH',
        body: JSON.stringify(stats.buildIncrementPatchBody(gameId, 'live', targetAt, n))
      }, idToken, signal);
      return n;
    }
    const patchBody = stats.buildLivePlayPatchBody(gameId, 'live', targetAt, n, ledgerKey, prev);
    if (!patchBody) return 0;
    await adminAuthFetch('sessionUsage', {
      method: 'PATCH',
      body: JSON.stringify(patchBody)
    }, idToken, signal);
    return n - prev;
  }

  async function adminRecordSessionUsage(room, code, idToken, signal) {
    const meta = room && room.meta && typeof room.meta === 'object' ? room.meta : {};
    const playerCount = collectLivePlayerCount(room && room.players);
    if (playerCount < MIN_QUALIFIED_PLAYERS) return false;
    const createdAt = Number(meta.createdAt) || 0;
    const gameId = normalizeLiveGameId(meta.gameId);
    const dedupKey = usageDedupKey(code, createdAt);
    
    // 1. 이미 집계된 방인지 먼저 확인 (중복 집계 원천 차단)
    try {
      const isDeduped = await adminAuthFetch(`sessionUsage/dedup/${dedupKey}`, { method: 'GET' }, idToken, signal);
      if (isDeduped) return false;
    } catch (e) {
      // 무시하고 아래 PATCH 시도
    }

    const targetAt = createdAt > 0 ? createdAt : Date.now();
    const day = usageDayKeyKst(targetAt);
    const inc = { '.sv': { increment: 1 } };
    const patchBody = JSON.stringify({
      [`dedup/${dedupKey}`]: true,
      'totals/qualified': inc,
      [`byDay/${day}/qualified`]: inc,
      [`byGame/${gameId}/qualified`]: inc
    });
    try {
      await adminAuthFetch('sessionUsage', { method: 'PATCH', body: patchBody }, idToken, signal);
      return true;
    } catch (e) {
      if (e && e.code === 'PERMISSION_DENIED') return false;
      throw e;
    }
  }

  async function purgeExpiredLiveRooms() {
    if (!portalAdminUnlocked || purgeExpiredRunning) return;
    const adminUser = currentAdminUser();
    if (!adminUser || !adminUser.email) {
      setPurgeStatus('이메일 관리자 로그인이 필요합니다.', true);
      return;
    }
    
    purgeExpiredRunning = true;
    if (btnPurgeExpiredRooms) btnPurgeExpiredRooms.disabled = true;
    hidePurgeConfirm();
    setPurgeStatus('지금 방과 통계를 비교하는 중…', true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const idToken = await adminUser.getIdToken(true);
      
      // 1. liveRooms 데이터 가져오기
      const rooms = await adminAuthFetch('liveRooms', { method: 'GET' }, idToken, controller.signal) || {};
      const now = Date.now();
      const codes = Object.keys(rooms);
      
      let expiredRooms = [];
      let activeRooms = [];
      let expiredRoomsDetails = [];
      let activeRoomsDetails = [];
      let previewSessionNew = 0;
      let previewPlayDelta = 0;
      const roomPreviews = {};
      const dayRoomSum = {};
      let qualifiedRoomSum = 0;
      
      for (let i = 0; i < codes.length; i += 1) {
        const code = codes[i];
        const room = rooms[code];
        const meta = room && room.meta ? room.meta : {};
        const createdAt = Number(meta.createdAt) || 0;
        const isClosed = meta.hostSeenAt === 0;
        const isExpiredRoom = createdAt && (now - createdAt) > LIVE_ROOM_TTL_MS;
        const preview = await previewRoomSync(room, code, idToken, controller.signal);
        roomPreviews[code] = preview;
        if (preview.playerCount >= MIN_QUALIFIED_PLAYERS) {
          qualifiedRoomSum += preview.playerCount;
          if (preview.day) dayRoomSum[preview.day] = (dayRoomSum[preview.day] || 0) + preview.playerCount;
        }
        
        if (isExpiredRoom || isClosed) {
          expiredRooms.push(code);
        } else {
          activeRooms.push(code);
        }
      }

      const todayKey = usageDayKeyKst(now);
      const yesterdayKey = usageDayKeyKst(now - 24 * 60 * 60 * 1000);
      const liveToday = await readLivePlayDay(todayKey, idToken, controller.signal);
      const liveYesterday = await readLivePlayDay(yesterdayKey, idToken, controller.signal);
      const liveByDay = {};
      const dayKeys = Object.keys(dayRoomSum);
      if (dayKeys.indexOf(todayKey) < 0) dayKeys.push(todayKey);
      if (dayKeys.indexOf(yesterdayKey) < 0) dayKeys.push(yesterdayKey);
      liveByDay[todayKey] = liveToday;
      liveByDay[yesterdayKey] = liveYesterday;
      for (let i = 0; i < dayKeys.length; i += 1) {
        const day = dayKeys[i];
        if (liveByDay[day] == null) liveByDay[day] = await readLivePlayDay(day, idToken, controller.signal);
      }

      codes.forEach((code) => {
        const preview = roomPreviews[code];
        if (!preview || preview.playerCount < MIN_QUALIFIED_PLAYERS || !preview.day) return;
        const dayLive = liveByDay[preview.day] || 0;
        const dayRooms = dayRoomSum[preview.day] || 0;
        if (dayRooms > dayLive && preview.playDelta <= 0) {
          preview.resetLedger = true;
          preview.playDelta = preview.playerCount;
        }
      });

      previewSessionNew = 0;
      previewPlayDelta = 0;
      expiredRoomsDetails = [];
      activeRoomsDetails = [];
      const expiredSet = {};
      expiredRooms.forEach((code) => { expiredSet[code] = true; });
      codes.forEach((code) => {
        const preview = roomPreviews[code];
        const detailStr = formatRoomSyncDetail(code, preview);
        if (preview.sessionNew) previewSessionNew += 1;
        previewPlayDelta += preview.playDelta || 0;
        if (expiredSet[code]) expiredRoomsDetails.push(detailStr);
        else activeRoomsDetails.push(detailStr);
      });

      // 2. dedup 찌꺼기 데이터 가져오기
      setPurgeStatus('오래된 내부 기록을 확인하는 중…', true);
      const dedupData = await adminAuthFetch('sessionUsage/dedup', { method: 'GET' }, idToken, controller.signal) || {};
      const dedupKeys = Object.keys(dedupData);
      
      let oldDedupKeys = [];
      const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
      
      dedupKeys.forEach(key => {
        const match = key.match(/_(\d{13})$/);
        if (match) {
          const ts = Number(match[1]);
          if (now - ts > TWO_DAYS_MS) {
            oldDedupKeys.push(key);
          }
        }
      });

      clearTimeout(timeoutId); // 사용자 응답 대기를 위해 타임아웃 해제

      // 2단계: 최종 확인
      const statsGap = qualifiedRoomSum > liveToday + liveYesterday;
      const roomItems = (list) => {
        if (!list.length) return '<p class="purge-confirm-note">없음</p>';
        const shown = list.slice(0, 12);
        const extra = list.length > 12 ? `<li>외 ${list.length - 12}개</li>` : '';
        return `<ul>${shown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}${extra}</ul>`;
      };

      const confirmHtml = `
        <p>취소를 누르면 아무 것도 바뀌지 않습니다.</p>
        <h4>통계에 넣을 것</h4>
        <ul>
          <li>수업 횟수: <strong>${previewSessionNew}번</strong> 추가</li>
          <li>참가 인원: <strong>${previewPlayDelta}명</strong> 추가</li>
        </ul>
        <h4>지금 숫자 비교</h4>
        <ul>
          <li>오늘 통계의 수업 참가 인원: ${liveToday}명</li>
          <li>어제 통계의 수업 참가 인원: ${liveYesterday}명</li>
          <li>지금 방 안에 실제로 있는 사람(3명 이상인 방): ${qualifiedRoomSum}명</li>
        </ul>
        <p class="purge-confirm-note">${statsGap
          ? '통계가 실제 인원보다 적습니다. 진행을 누르면 부족한 인원을 통계에 넣습니다.'
          : '통계와 실제 인원이 크게 어긋나 보이지 않습니다.'}</p>
        <h4>지울 것</h4>
        <ul>
          <li>이미 끝난 방: ${expiredRooms.length}개 (진행 창을 닫았거나, 만든 지 하루가 지난 방만. 수업 중인 방은 안 지움)</li>
          <li>이틀이 지난 내부 기록: ${oldDedupKeys.length}개 (화면에 보이는 통계 숫자는 그대로)</li>
        </ul>
        ${expiredRooms.length ? `<h4>끝난 방</h4>${roomItems(expiredRoomsDetails)}` : ''}
        <h4>그대로 둘 방 — 수업 진행 중</h4>
        ${roomItems(activeRoomsDetails)}
      `;

      const confirmed = await askPurgeConfirm(confirmHtml);
      if (!confirmed) {
        setPurgeStatus('취소했습니다. 통계와 방은 그대로입니다.', true);
        purgeExpiredRunning = false;
        if (btnPurgeExpiredRooms) btnPurgeExpiredRooms.disabled = false;
        return;
      }

      // 실제 삭제 및 동기화 진행
      setPurgeStatus('통계에 반영하고 끝난 방을 정리하는 중…', true);
      const execController = new AbortController();
      const execTimeoutId = setTimeout(() => execController.abort(), 120000);

      let deletedRoomsCount = 0;
      let counted = 0;
      let playCounted = 0;
      let playFailed = 0;
      let failed = 0;

      for (let i = 0; i < codes.length; i += 1) {
        const code = codes[i];
        const room = rooms[code];
        
        try {
          const recorded = await adminRecordSessionUsage(room, code, idToken, execController.signal);
          if (recorded) counted += 1;
        } catch (e) {
          console.warn('session usage record failed:', code, e);
        }
        try {
          playCounted += await adminRecordLivePlayCount(room, code, idToken, execController.signal, {
            resetLedger: !!(roomPreviews[code] && roomPreviews[code].resetLedger)
          });
        } catch (e) {
          playFailed += 1;
          console.warn('live play stats record failed:', code, e);
        }

        if (expiredRooms.includes(code)) {
          setPurgeStatus(`끝난 방을 지우는 중… ${deletedRoomsCount + failed + 1}/${expiredRooms.length}`, true);
          try {
            await adminAuthFetch(`liveRooms/${code}`, { method: 'DELETE' }, idToken, execController.signal);
            deletedRoomsCount += 1;
          } catch (e) {
            console.warn('purge room failed:', code, e);
            failed += 1;
          }
        }
      }

      let deletedDedupCount = 0;
      if (oldDedupKeys.length > 0) {
        setPurgeStatus(`오래된 내부 기록을 지우는 중… (${oldDedupKeys.length}개)`, true);
        const dedupPatch = {};
        oldDedupKeys.forEach(k => {
          dedupPatch[k] = null; // null 값을 보내면 Firebase에서 해당 키가 삭제됨
        });
        
        try {
          await adminAuthFetch('sessionUsage/dedup', {
            method: 'PATCH',
            body: JSON.stringify(dedupPatch)
          }, idToken, execController.signal);
          deletedDedupCount = oldDedupKeys.length;
        } catch (e) {
          console.warn('purge dedup failed:', e);
        }
      }

      clearTimeout(execTimeoutId);

      const playNote = playCounted > 0
        ? `참가 인원 ${playCounted}명 추가`
        : (playFailed > 0
          ? `참가 인원 반영 실패 ${playFailed}건`
          : '참가 인원 변화 없음');
      
      setPurgeStatus(`완료: 수업 횟수 ${counted}번 추가 · ${playNote} · 끝난 방 ${deletedRoomsCount}개 삭제 · 오래된 기록 ${deletedDedupCount}개 삭제${failed ? ` · 실패 ${failed}건` : ''}`, true);
      
      sessionUsageLoadingFlag = false;
      playStatsLoadingFlag = false;
      await loadSessionUsageStats();
      await loadPlayStats();
    } catch (err) {
      console.warn('purge expired rooms failed:', err);
      const code = String((err && err.code) || '');
      if (code === 'PERMISSION_DENIED') {
        setPurgeStatus('권한이 없습니다. 관리자 이메일로 로그인했는지 확인해 주세요.', true);
      } else {
        setPurgeStatus('정리에 실패했습니다. 잠시 후 다시 시도해 주세요.', true);
      }
    } finally {
      purgeExpiredRunning = false;
      if (btnPurgeExpiredRooms) btnPurgeExpiredRooms.disabled = false;
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
    loadPlayStats();
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
    clearPlayStats();
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
  if (btnPurgeExpiredRooms) {
    btnPurgeExpiredRooms.addEventListener('click', () => {
      purgeExpiredLiveRooms();
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
  if (btnPlayStatsRefresh) {
    btnPlayStatsRefresh.addEventListener('click', () => {
      playStatsLoadingFlag = false;
      loadPlayStats();
    });
  }
  if (playStatsFold) {
    playStatsFold.addEventListener('toggle', () => {
      if (playStatsFold.open && portalAdminUnlocked) {
        playStatsLoadingFlag = false;
        loadPlayStats();
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
