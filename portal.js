/**
 * 할로매쓰 (HaloMath) Main Portal Engine & Channel Isolation Logic
 */

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) || null;

let firebaseDb = null;
if (window.firebase && firebaseConfig && firebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.database();
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

function randomDormsNickname() {
  const prefixes = ['도름', '별빛', '반짝', '똑똑', '신난', '고냥', '빙수', '프라즘'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = String(Math.floor(10 + Math.random() * 90));
  return sanitizeInput(prefix + num, 12);
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
  
  let activeMode = 'school'; // Default channel mode
  
  const modeParam = urlParams.get('mode');
  if (modeParam === 'dorms' || modeParam === 'dorems' || currentPath.includes('/dorms') || currentPath.includes('/dorems')) {
    activeMode = 'dorms';
  } else if (modeParam === 'school' || currentPath.includes('/school')) {
    activeMode = 'school';
  }

  // Persistent Player Profile Keys
  const nameStorageKey = `halomath_name_${activeMode}`;
  const idStorageKey = `halomath_id_${activeMode}`;

  let playerName = sanitizeInput(localStorage.getItem(nameStorageKey) || '', 12);
  let studentId = activeMode === 'school' ? sanitizeInput(localStorage.getItem(idStorageKey) || '', 10) : '';

  if (activeMode === 'dorms' && !playerName) {
    playerName = randomDormsNickname();
    localStorage.setItem(nameStorageKey, playerName);
  }

  // DOM Elements
  const portalTitle = document.getElementById('portal-title');
  const portalSubtitle = document.getElementById('portal-subtitle');
  const displayProfileName = document.getElementById('display-profile-name');
  const displayProfileId = document.getElementById('display-profile-id');
  const btnEditProfile = document.getElementById('btn-edit-profile');

  const profileModal = document.getElementById('profile-modal');
  const profileForm = document.getElementById('profile-form');
  const modalTitle = document.getElementById('modal-title');
  const labelPlayerName = document.getElementById('label-player-name');
  const inputPlayerName = document.getElementById('input-player-name');
  const studentIdGroup = document.getElementById('student-id-group');
  const inputStudentId = document.getElementById('input-student-id');

  const btnPlayBingsoo = document.getElementById('btn-play-bingsoo');
  const btnPlayBingsoo2 = document.getElementById('btn-play-bingsoo2');
  const btnPlayCongruence = document.getElementById('btn-play-congruence');
  const btnPlayThreeChances = document.getElementById('btn-play-three-chances');
  const btnPlayPrismTycoon = document.getElementById('btn-play-prism-tycoon');
  const leaderboardTitle = document.getElementById('leaderboard-title');
  const leaderboardModeNote = document.getElementById('leaderboard-mode-note');
  const leaderboardTableHeaderId = document.getElementById('th-header-id');
  const leaderboardTableHeaderMetric = document.getElementById('th-header-metric');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const leaderboardTabs = document.getElementById('leaderboard-tabs');

  const CONGRUENCE_GAME_IDS = new Set(['congruence', 'triangle', 'congruence_game']);
  const BINGSOO_GAME_IDS = new Set(['bingsoo', '']);
  const BINGSOO2_GAME_IDS = new Set(['bingsoo2', 'bingsoo-2']);
  const PRISM_TYCOON_GAME_IDS = new Set(['prism-tycoon', 'tycoon']);
  let activeLeaderboardGame = 'bingsoo';
  let scoresUnsub = null;
  let threeChancesUnsub = null;

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
      
      modalTitle.textContent = '🌐 도전자 닉네임 설정';
      labelPlayerName.textContent = '도전자 닉네임:';
      inputPlayerName.placeholder = '닉네임';
      if (inputPlayerName && !inputPlayerName.value && playerName) {
        inputPlayerName.value = playerName;
      }

      // Completely Hide & Remove Student ID group for Dorems mode
      if (studentIdGroup) {
        studentIdGroup.style.display = 'none';
        inputStudentId.removeAttribute('required');
      }

      leaderboardTitle.textContent = '🏆 dorms 명예의 전당 (Top 20)';
      if (leaderboardModeNote) {
        leaderboardModeNote.textContent = '도름 모드 · 학번 없이 닉네임만 기록됩니다';
      }
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = 'none';
      }
    } else {
      // School Mode
      portalTitle.textContent = '🏫 할로매쓰 - 수학 미니게임 아케이드';
      portalSubtitle.textContent = '우리 학교 친구들과 펼치는 유쾌하고 똑똑한 수학 미니게임 대결!';

      modalTitle.textContent = '🏫 도전자 프로필 등록';
      labelPlayerName.textContent = '도전자 이름:';
      inputPlayerName.placeholder = '예: 홍길동';

      if (studentIdGroup) {
        studentIdGroup.style.display = 'flex';
        inputStudentId.setAttribute('required', 'true');
      }

      leaderboardTitle.textContent = '🏆 우리 학교 명예의 전당 (Top 20)';
      if (leaderboardModeNote) {
        leaderboardModeNote.textContent = '학교 모드 · 이름과 학번으로 기록됩니다';
      }
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = '';
      }
    }

    if (btnPlayBingsoo) btnPlayBingsoo.href = gameHref('games/bingsoo/index.html');
    if (btnPlayBingsoo2) btnPlayBingsoo2.href = gameHref('games/bingsoo2/index.html');
    if (btnPlayCongruence) btnPlayCongruence.href = gameHref('games/congruence/index.html');
    if (btnPlayThreeChances) btnPlayThreeChances.href = gameHref('games/three-chances/index.html');
    if (btnPlayPrismTycoon) btnPlayPrismTycoon.href = gameHref('games/prism-tycoon/index.html');

    updateProfileDisplay();
  }

  function updateProfileDisplay() {
    if (playerName) {
      displayProfileName.textContent = playerName;
      if (activeMode === 'school') {
        displayProfileId.textContent = studentId ? `학번: ${studentId}` : '학번: 미입력';
        displayProfileId.style.display = '';
      } else {
        displayProfileId.style.display = 'none';
      }
    } else {
      displayProfileName.textContent = '도전자 미등록';
      displayProfileId.textContent = '클릭하여 프로필 설정';
    }
  }

  // Check Profile Registration
  if (!playerName || (activeMode === 'school' && !studentId)) {
    profileModal.classList.remove('hidden');
  }

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
      inputPlayerName.value = playerName || (activeMode === 'dorms' ? randomDormsNickname() : '');
      if (activeMode === 'school') {
        inputStudentId.value = studentId;
      }
      profileModal.classList.remove('hidden');
    });
  }

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let cleanName = sanitizeInput(inputPlayerName.value, 12);

    if (!cleanName) {
      alert('닉네임을 입력해야 시작할 수 있습니다.');
      if (inputPlayerName) inputPlayerName.focus();
      return;
    }

    if (activeMode === 'school') {
      const cleanId = sanitizeInput(inputStudentId.value, 10);
      if (!cleanId || !/^[a-zA-Z0-9가-힣\-]+$/.test(cleanId)) {
        alert('학번은 1자 이상 10자 이하의 영문, 숫자, 한글로 입력해 주세요.');
        return;
      }
      studentId = cleanId;
      localStorage.setItem(idStorageKey, studentId);
    }

    playerName = cleanName;
    localStorage.setItem(nameStorageKey, playerName);

    updateProfileDisplay();
    profileModal.classList.add('hidden');
  });

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

  updateMetricHeader();
  listenRealtimeLeaderboard();

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

  function listenRealtimeLeaderboard() {
    stopLeaderboardListeners();
    renderLeaderboardSkeleton(leaderboardTbody);
    if (!firebaseDb) {
      renderLeaderboardTable([]);
      return;
    }

    // All arcade games write under scores/ with gameId + channel.
    // Also watch scores/dorms for older dorms writes.
    const process = (rootVal) => {
      const list = collectGameScores(rootVal, activeLeaderboardGame);
      renderLeaderboardTable(getLeaderboardDisplayList(list, activeLeaderboardGame));
    };

    const scoresRef = firebaseDb.ref('scores');
    const onScores = scoresRef.on('value', (snap) => process(snap.val()), (err) => {
      console.error('Leaderboard fetch error:', err);
      renderLeaderboardTable([]);
    });
    scoresUnsub = () => scoresRef.off('value', onScores);
  }

  function collectGameScores(dataObj, gameKey) {
    const bestMap = new Map();

    const acceptGame = (entry) => {
      const id = String((entry && (entry.gameId || entry.game)) || '').trim();
      if (gameKey === 'congruence') return CONGRUENCE_GAME_IDS.has(id);
      if (gameKey === 'prism-tycoon') return PRISM_TYCOON_GAME_IDS.has(id);
      if (gameKey === 'three-chances') {
        return id === 'three-chances' || id === 'three_chances';
      }
      if (gameKey === 'bingsoo2') {
        return BINGSOO2_GAME_IDS.has(id);
      }
      // bingsoo 1: explicit id or legacy rows with no gameId and a numeric score (not clear-time)
      if (id === 'bingsoo') return true;
      if (!id && entry && entry.score != null && entry.clearTimeMs == null && !CONGRUENCE_GAME_IDS.has(id) && !PRISM_TYCOON_GAME_IDS.has(id) && !BINGSOO2_GAME_IDS.has(id)) {
        return true;
      }
      return false;
    };

    const visit = (obj, isDormsSubtree = false) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        if (!item || typeof item !== 'object') return;
        if (item.name) {
          if (!acceptGame(item)) return;
          if (!matchesActiveMode(item, key, isDormsSubtree)) return;

          const name = sanitizeInput(item.name, 12);
          const sid = sanitizeInput(item.studentId || '', 10);
          const userKey = activeMode === 'school' ? `${name}_${sid}` : name;

          if (gameKey === 'three-chances') {
            const clearTimeMs = Number(item.clearTimeMs);
            if (!Number.isFinite(clearTimeMs) || clearTimeMs <= 0) return;
            const prev = bestMap.get(userKey);
            if (!prev || clearTimeMs < prev.clearTimeMs) {
              bestMap.set(userKey, {
                name,
                studentId: sid,
                clearTimeMs,
                metricLabel: formatClearTime(clearTimeMs)
              });
            }
          } else {
            const rawScore = gameKey === 'prism-tycoon'
              ? (Number(item.score) || 0)
              : (parseInt(item.score, 10) || 0);
            // 팥빙수나 합동게임은 500점 캡, 타이쿤 수익은 상한 없음
            const score = gameKey === 'prism-tycoon' ? Math.max(0, rawScore) : Math.max(0, Math.min(500, rawScore));
            const prev = bestMap.get(userKey);

            if (gameKey === 'bingsoo2') {
              const totalErrorPx = getBingsoo2TotalErrorPx(item);
              const playTimeMs = getBingsoo2PlayTimeMs(item);
              const candidate = { score, totalErrorPx, playTimeMs, timestamp: item.timestamp || 0 };
              if (isBetterBingsoo2Record(candidate, prev)) {
                const formattedScore = score.toLocaleString();
                let metricLabel = totalErrorPx != null
                  ? `${formattedScore}점 · ${totalErrorPx}px`
                  : `${formattedScore}점`;
                if (playTimeMs != null) {
                  metricLabel += ` · ${Math.floor(playTimeMs / 60000)}:${String(Math.floor((playTimeMs % 60000) / 1000)).padStart(2, '0')}`;
                }
                bestMap.set(userKey, {
                  name,
                  studentId: sid,
                  score,
                  totalErrorPx,
                  playTimeMs,
                  timestamp: item.timestamp || 0,
                  metricLabel
                });
              }
            } else if (!prev || score > prev.score) {
              const formattedScore = score.toLocaleString();
              bestMap.set(userKey, {
                name,
                studentId: sid,
                score,
                metricLabel: gameKey === 'prism-tycoon' ? `${formattedScore} 💰` : `${formattedScore}점`
              });
            }
          }
        } else {
          visit(item, key === 'dorms' || isDormsSubtree);
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

  function renderLeaderboardTable(list) {
    if (!leaderboardTbody) return;
    leaderboardTbody.removeAttribute('aria-busy');
    leaderboardTbody.innerHTML = '';

    const colSpan = activeMode === 'school' ? 4 : 3;

    if (!list || list.length === 0) {
      leaderboardTbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:16px; text-align:center; color:#64748b;">아직 등록된 기록이 없습니다. 첫 번째 챔피언이 되어 보세요!</td></tr>`;
      return;
    }

    const ranked = activeLeaderboardGame === 'three-chances'
      ? withCompetitionRanks(list, (item) => item.metricLabel || formatClearTime(item.clearTimeMs))
      : withCompetitionRanks(list, (item) => item.score);

    ranked.forEach(({ item, rank, tied }) => {
      const tr = document.createElement('tr');
      const rankDisplay = formatRankLabel(rank, tied);

      let idTd = '';
      if (activeMode === 'school') {
        idTd = `<td>${escapeHtml(item.studentId || '미입력')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${rank}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${escapeHtml(item.metricLabel || (item.score != null ? `${item.score}점` : '-'))}</strong></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }
});
