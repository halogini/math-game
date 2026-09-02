/**
 * 🍧 팥빙수 똑같이 나눠주기 작전 2탄! - Game Engine Logic
 * 
 * Includes interactive set squares (직각자 3개 with drag & rotate),
 * Triangle geometry rendering, perpendicular bisector guidance,
 * Circumcenter verification, and Firebase Realtime Database Leaderboard.
 */

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) || null;

// Initialize Firebase App & Database
let firebaseDb = null;
if (window.firebase && firebaseConfig && firebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.database();
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

// ----------------------------------------------------
// Security & Input Validation Helpers
// ----------------------------------------------------
function isValidName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 12;
}

function isBingsoo2GameId(row) {
  if (typeof HalomathScores !== 'undefined' && HalomathScores.isBingsoo2GameId) {
    return HalomathScores.isBingsoo2GameId(row);
  }
  const id = String((row && (row.gameId || row.game)) || '').trim();
  return id === 'bingsoo2' || id === 'bingsoo-2';
}

function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"/]/g, '') // strip dangerous HTML characters
    .trim()
    .slice(0, maxLen);
}

function randomDormsNickname() {
  const prefixes = ['도름', '별빛', '반짝', '똑똑', '신난', '직각', '빙수', '자도사'];
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

function initBingsoo2Game() {
  // Channel Mode Detection (?mode=dorms vs school)
  let activeMode = HalomathMode.detectActiveMode();

  const highScoreStorageKey = `bingsoo2_highscore_${activeMode}`;

  // LocalStorage Safe Helpers
  function safeGetStorage(key, fallback = '') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSetStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn("Storage restricted:", e);
    }
  }

  // Game State
  let currentRound = 1;
  const maxRounds = 5;
  let totalScore = 0;
  let roundHistory = [];
  let highScore = parseInt(safeGetStorage(highScoreStorageKey, '0'), 10);
  
  let studentPositions = [];
  let targetPoint = { x: 0, y: 0, radius: 0 };
  let placedPoint = null;
  let initialSubmittedPoint = null;
  let initialSubmittedRulersState = null;
  let isAnswerChecked = false;
  let isDraggingBingsoo = false;
  let popupTimeoutId = null;
  let activeRulerId = null;
  let gameStartedAt = null;
  let sessionPlayTimeMs = null;

  // 3 Set Squares (직각자 3개 - 깔끔하게 정렬된 기본 배치)
  const RULER_COLOR_NAMES = ['파란', '초록', '주황'];

  const rulers = [
    { id: 0, theme: 'ruler-theme-blue', x: 40, y: 380, angle: 0, width: 140, height: 110, locked: false, hidden: false, isDragging: false, isRotating: false },
    { id: 1, theme: 'ruler-theme-green', x: 260, y: 380, angle: 0, width: 140, height: 110, locked: false, hidden: true, isDragging: false, isRotating: false },
    { id: 2, theme: 'ruler-theme-orange', x: 480, y: 380, angle: 0, width: 140, height: 110, locked: false, hidden: true, isDragging: false, isRotating: false }
  ];

  // Locked Player Info
  let playerName = sanitizeInput(HalomathProfile.loadName(activeMode), 12);
  if (activeMode === 'dorms' && !playerName) {
    playerName = randomDormsNickname();
    HalomathProfile.saveName(activeMode, playerName);
  } else if (!playerName) {
    playerName = '도전자';
  }
  let studentId = activeMode === 'school' ? sanitizeInput(HalomathProfile.loadStudentId(activeMode), 10) : '';

  // DOM Elements
  const gameBoard = document.getElementById('game-board');
  const geometrySvg = document.getElementById('geometry-svg');
  const elementsLayer = document.getElementById('elements-layer');
  const rulersLayer = document.getElementById('rulers-layer');
  const lineCanvas = document.getElementById('line-canvas');
  const ctx = lineCanvas.getContext('2d');

  const rulerChipGroup = document.getElementById('ruler-chip-group');
  const btnLockAllRulers = document.getElementById('btn-lock-all-rulers');

  const playerModal = document.getElementById('player-modal');
  const playerForm = document.getElementById('player-form');
  const labelPlayerName = document.getElementById('label-player-name');
  const inputPlayerName = document.getElementById('input-player-name');
  const studentIdGroup = document.getElementById('student-id-group');
  const inputStudentId = document.getElementById('input-student-id');
  const displayPlayerName = document.getElementById('display-player-name');
  const displayStudentId = document.getElementById('display-student-id');

  const openingChampName = document.getElementById('opening-champ-name');
  const openingChampId = document.getElementById('opening-champ-id');
  const openingChampScore = document.getElementById('opening-champ-score');
  const btnToggleOpeningLeaderboard = document.getElementById('btn-toggle-opening-leaderboard');
  const openingLeaderboardBox = document.getElementById('opening-leaderboard-box');
  const openingLeaderboardTbody = document.getElementById('opening-leaderboard-tbody');
  const thOpeningId = document.getElementById('th-opening-id');
  const thResultId = document.getElementById('th-result-id');

  const btnPrivacyPolicy = document.getElementById('btn-privacy-policy');
  const privacyModal = document.getElementById('privacy-modal');
  const btnClosePrivacy = document.getElementById('btn-close-privacy');

  const roundDisplay = document.getElementById('round-display');
  const totalScoreDisplay = document.getElementById('total-score-display');
  const highScoreDisplay = document.getElementById('high-score-display');

  const btnCheckAnswer = document.getElementById('btn-check-answer');
  const btnResetToSubmitted = document.getElementById('btn-reset-to-submitted');
  const btnNextRound = document.getElementById('btn-next-round');
  const instructionBanner = document.getElementById('instruction-banner');

  const scorePopup = document.getElementById('score-popup');
  const scoreRatingBadge = document.getElementById('score-rating-badge');
  const scoreNumber = document.getElementById('score-number');
  const scoreDistanceInfo = document.getElementById('score-distance-info');

  const resultModal = document.getElementById('result-modal');
  const resultLockedName = document.getElementById('result-locked-name');
  const resultLockedId = document.getElementById('result-locked-id');
  const resultLockedIdSpan = document.getElementById('result-locked-id-span');
  const finalTotalScore = document.getElementById('final-total-score');
  const newRecordBadge = document.getElementById('new-record-badge');
  const roundHistoryList = document.getElementById('round-history-list');
  const btnSendData = document.getElementById('btn-send-data');
  const apiStatusMsg = document.getElementById('api-status-msg');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const btnModalRestart = document.getElementById('btn-modal-restart');
  const resultLeaderboardTitle = document.getElementById('result-leaderboard-title');

  // Mode Isolation Toggles
  const profileLead = document.getElementById('profile-lead');
  const nameColThs = document.querySelectorAll('#tr-opening-th th:nth-child(2), #tr-result-th th:nth-child(2)');

  function nameFieldLabel() {
    return activeMode === 'dorms' ? '닉네임' : '이름';
  }

  if (activeMode === 'dorms') {
    if (studentIdGroup) studentIdGroup.style.display = 'none';
    if (displayStudentId) displayStudentId.style.display = 'none';
    if (thOpeningId) thOpeningId.style.display = 'none';
    if (thResultId) thResultId.style.display = 'none';
    if (resultLockedIdSpan) resultLockedIdSpan.style.display = 'none';
    if (labelPlayerName) labelPlayerName.textContent = '닉네임:';
    if (inputPlayerName) {
      inputPlayerName.placeholder = '닉네임';
      if (!inputPlayerName.value && playerName) inputPlayerName.value = playerName;
    }
    if (inputStudentId) inputStudentId.removeAttribute('required');
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 dorms 명예의 전당 (1위 ~ 20위)';
    if (profileLead) profileLead.textContent = '랭킹에 올릴 닉네임을 입력해야 시작할 수 있습니다.';
    nameColThs.forEach((el) => { el.textContent = '닉네임'; });
  } else {
    if (labelPlayerName) labelPlayerName.textContent = '이름:';
    if (inputPlayerName) inputPlayerName.placeholder = '예: 홍길동';
    if (inputStudentId) inputStudentId.placeholder = '4글자로 입력 (예: 2230)';
    if (profileLead) profileLead.textContent = '이름과 학번을 입력해야 시작할 수 있습니다.';
    nameColThs.forEach((el) => { el.textContent = '이름'; });
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 우리 학교 명예의 전당 (1위 ~ 20위)';
  }

  // Privacy Policy Handlers
  if (btnPrivacyPolicy && privacyModal && btnClosePrivacy) {
    btnPrivacyPolicy.addEventListener('click', () => {
      privacyModal.classList.remove('hidden');
    });
    btnClosePrivacy.addEventListener('click', () => {
      privacyModal.classList.add('hidden');
    });
  }

  // Toggle Opening Leaderboard
  if (btnToggleOpeningLeaderboard && openingLeaderboardBox) {
    btnToggleOpeningLeaderboard.addEventListener('click', () => {
      openingLeaderboardBox.classList.toggle('hidden');
      if (!openingLeaderboardBox.classList.contains('hidden')) {
        btnToggleOpeningLeaderboard.textContent = '▲ 순위표 접기';
      } else {
        btnToggleOpeningLeaderboard.textContent = '🏆 명예의 전당 순위표 전체 보기';
      }
    });
  }

  if (rulerChipGroup) {
    rulerChipGroup.querySelectorAll('.ruler-chip').forEach(chip => {
      let longPressTimer = null;
      let longPressTriggered = false;

      const clearLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      chip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        longPressTriggered = false;
        clearLongPress();
        const id = parseInt(chip.dataset.rulerId, 10);
        if (Number.isNaN(id)) return;
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          toggleRulerHidden(id);
        }, 480);
      });

      chip.addEventListener('pointerup', clearLongPress);
      chip.addEventListener('pointerleave', clearLongPress);
      chip.addEventListener('pointercancel', clearLongPress);

      chip.addEventListener('click', () => {
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }
        const id = parseInt(chip.dataset.rulerId, 10);
        if (Number.isNaN(id)) return;
        handleRulerChipClick(id);
      });
    });
  }

  if (btnLockAllRulers) {
    btnLockAllRulers.addEventListener('click', () => {
      handleLockAllRulersClick();
    });
  }

  function isCompactViewport() {
    return window.matchMedia('(max-width: 640px), (max-height: 700px)').matches;
  }

  function isScrollableTouchTarget(target) {
    return !!target.closest('.privacy-body, .leaderboard-table-wrapper, .opening-leaderboard-box, .modal-card');
  }

  function isGameTouchSurfaceActive() {
    return playerModal.classList.contains('hidden')
      && resultModal.classList.contains('hidden')
      && privacyModal.classList.contains('hidden');
  }

  function setupMobileViewportLock() {
    if (!isCompactViewport()) return;

    const applyViewportMetrics = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      document.documentElement.style.setProperty('--app-vh', `${Math.round(height)}px`);
      document.documentElement.style.setProperty('--app-offset-top', `${Math.round(offsetTop)}px`);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    applyViewportMetrics();
    document.body.classList.add('mobile-play-active');

    window.addEventListener('resize', applyViewportMetrics);
    window.addEventListener('scroll', () => window.scrollTo(0, 0), { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', applyViewportMetrics);
      window.visualViewport.addEventListener('scroll', applyViewportMetrics);
    }
  }

  document.addEventListener('touchmove', (e) => {
    if (!isGameTouchSurfaceActive()) return;
    if (isScrollableTouchTarget(e.target)) return;
    if (e.target.closest('input, textarea')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchstart', (e) => {
    if (!isGameTouchSurfaceActive()) return;
    if (isScrollableTouchTarget(e.target)) return;
    if (e.target.closest('input, textarea, .controls-bar, .ruler-toolbar')) return;
    if (e.target.closest('.game-board, .set-square-container, .dpad-controller, .placed-bingsoo-pin')) {
      e.preventDefault();
    }
  }, { passive: false });

  function setDualLabel(el, fullText, shortText) {
    if (!el) return;
    el.innerHTML = `<span class="btn-label-full">${fullText}</span><span class="btn-label-short">${shortText}</span>`;
  }

  let instructionFadeTimer = null;
  function showInstruction(fullText, compactText) {
    if (!instructionBanner) return;
    instructionBanner.textContent = (compactText && isCompactViewport()) ? compactText : fullText;
    instructionBanner.classList.remove('hidden', 'is-faded');
    clearTimeout(instructionFadeTimer);
    if (isCompactViewport()) {
      instructionFadeTimer = setTimeout(() => {
        instructionBanner.classList.add('is-faded');
      }, 4800);
    }
  }

  // Realtime Leaderboard Listeners
  listenRealtimeLeaderboard();
  checkPlayerRegistration();

  function checkPlayerRegistration() {
    if (playerName && (activeMode === 'dorms' || studentId)) {
      if (inputPlayerName) inputPlayerName.value = playerName;
      if (activeMode === 'school' && inputStudentId) inputStudentId.value = studentId;
    }
    playerModal.classList.remove('hidden');
  }

  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const errEl = document.getElementById('profile-err');
    const setErr = (t) => { if (errEl) errEl.textContent = t || ''; };
    const rawName = inputPlayerName ? inputPlayerName.value : '';
    const cleanName = sanitizeInput(rawName, 12);
    if (!cleanName) {
      setErr(`${nameFieldLabel()}을 입력해야 시작할 수 있습니다.`);
      if (inputPlayerName) inputPlayerName.focus();
      return;
    }
    setErr('');

    let cleanId = '';
    if (activeMode === 'school') {
      const rawId = inputStudentId ? inputStudentId.value : '';
      cleanId = sanitizeInput(rawId, 10);
      if (!HalomathProfile.isValidStudentId(cleanId)) {
        setErr('학번을 1~10자 영문·숫자·한글로 입력해 주세요.');
        if (inputStudentId) inputStudentId.focus();
        return;
      }
      studentId = cleanId;
      HalomathProfile.saveStudentId(activeMode, studentId);
    }

    playerName = cleanName;
    HalomathProfile.saveName(activeMode, playerName);

    updatePlayerInfoDisplay();
    playerModal.classList.add('hidden');
    initGame();
  });

  function updatePlayerInfoDisplay() {
    displayPlayerName.textContent = playerName || '플레이어';
    if (activeMode === 'school') {
      displayStudentId.textContent = studentId ? `학번: ${studentId}` : '학번: —';
      displayStudentId.style.display = '';
    } else {
      displayStudentId.style.display = 'none';
    }
    if (resultLockedName) resultLockedName.textContent = playerName;
    if (resultLockedId) resultLockedId.textContent = studentId || '—';
  }

  function initGame() {
    highScoreDisplay.innerHTML = `${highScore} <small>점</small>`;

    currentRound = 1;
    totalScore = 0;
    roundHistory = [];
    gameStartedAt = Date.now();
    sessionPlayTimeMs = null;

    updateHeaderUI();
    setupCanvasResolution();
    setupMobileViewportLock();
    loadRound(currentRound);

    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    setupCanvasResolution();
    renderTriangleGeometry();
    renderRulers();
    if (isAnswerChecked && placedPoint) {
      drawVerificationLines();
    }
  }

  function getBoardContentSize() {
    return {
      width: gameBoard.clientWidth || 800,
      height: gameBoard.clientHeight || 520
    };
  }

  function clientToBoardCoords(clientX, clientY) {
    const rect = gameBoard.getBoundingClientRect();
    const { width, height } = getBoardContentSize();
    return {
      x: Math.max(10, Math.min(width - 10, clientX - rect.left - gameBoard.clientLeft)),
      y: Math.max(10, Math.min(height - 10, clientY - rect.top - gameBoard.clientTop))
    };
  }

  function setupCanvasResolution() {
    const { width, height } = getBoardContentSize();
    lineCanvas.width = width;
    lineCanvas.height = height;
  }

  function updateHeaderUI() {
    roundDisplay.textContent = `${currentRound} / ${maxRounds}`;
    totalScoreDisplay.innerHTML = `${totalScore} <small>점</small>`;
  }

  // ----------------------------------------------------
  // Round Loading & Point Generation
  // ----------------------------------------------------
  function loadRound(roundNum) {
    isAnswerChecked = false;
    placedPoint = null;
    initialSubmittedPoint = null;
    initialSubmittedRulersState = null;
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    elementsLayer.innerHTML = '';

    btnCheckAnswer.disabled = true;
    btnCheckAnswer.classList.remove('hidden');
    if (btnResetToSubmitted) btnResetToSubmitted.classList.add('hidden');
    btnNextRound.classList.add('hidden');
    scorePopup.classList.add('hidden');

    showInstruction(
      '👉 🍨 원하는 곳을 터치해 팥빙수를 놓아보세요!',
      '👉 🍨 터치해 팥빙수를 놓아보세요!'
    );

    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 520;
    const padding = isCompactViewport()
      ? Math.max(36, Math.round(Math.min(width, height) * 0.1))
      : 48;

    // Round progression:
    // Round 1, 2: Acute Triangle (예각삼각형 - 외심이 삼각형 내부)
    // Round 3: Right Triangle (직각삼각형 - 외심이 빗변의 중점에 위치)
    // Round 4, 5: Obtuse Triangle (둔각삼각형 - 외심이 삼각형 외부에 위치)
    if (roundNum <= 2) {
      generateAcuteLayout(width, height, padding);
    } else if (roundNum === 3) {
      generateRightLayout(width, height, padding);
    } else {
      generateObtuseLayout(width, height, padding);
    }

    showInstruction(
      '👉 🍨 원하는 곳을 터치해 팥빙수를 놓아보세요!',
      '👉 🍨 터치해 팥빙수를 놓아보세요!'
    );

    resetRulersState();
    resetRulersPosition();
    renderStudents();
    renderTriangleGeometry();
    updateHeaderUI();
  }

  // 1. Acute Triangle (예각삼각형: 외심이 내부)
  function generateAcuteLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;
    const compact = isCompactViewport();
    const minDim = Math.min(width, height);

    const minR = compact ? 105 : Math.max(150, Math.round(minDim * 0.32));
    const maxR = Math.round(minDim * (compact ? 0.38 : 0.44));

    while (!valid && attempts < 250) {
      attempts++;
      const target = {
        x: randomRange(padding + (compact ? 60 : 50), width - padding - (compact ? 60 : 50)),
        y: randomRange(padding + (compact ? 60 : 50), height - padding - (compact ? 60 : 50))
      };
      const R = randomRange(minR, maxR);

      const angle1 = randomRange(0, Math.PI * 2);
      const angle2 = angle1 + randomRange(Math.PI * 0.55, Math.PI * 0.80);
      const angle3 = angle2 + randomRange(Math.PI * 0.55, Math.PI * 0.80);

      const A = { x: target.x + R * Math.cos(angle1), y: target.y + R * Math.sin(angle1) };
      const B = { x: target.x + R * Math.cos(angle2), y: target.y + R * Math.sin(angle2) };
      const C = { x: target.x + R * Math.cos(angle3), y: target.y + R * Math.sin(angle3) };

      if (isPointInside(A, width, height, padding) &&
          isPointInside(B, width, height, padding) &&
          isPointInside(C, width, height, padding)) {
        
        targetPoint = { x: target.x, y: target.y, radius: R };
        studentPositions = [
          { name: '친구 A', baseEmoji: '👦', x: A.x, y: A.y, currentEmoji: '🤔' },
          { name: '친구 B', baseEmoji: '👧', x: B.x, y: B.y, currentEmoji: '🤔' },
          { name: '친구 C', baseEmoji: '🧑', x: C.x, y: C.y, currentEmoji: '🤔' }
        ];
        valid = true;
      }
    }

    if (!valid) generateStandardFallback(width, height, padding);
  }

  // 2. Right Triangle (직각삼각형: 외심이 빗변의 중점)
  function generateRightLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;
    const compact = isCompactViewport();
    const minDim = Math.min(width, height);

    const minR = compact ? 115 : Math.max(155, Math.round(minDim * 0.33));
    const maxR = Math.round(minDim * (compact ? 0.40 : 0.45));

    while (!valid && attempts < 350) {
      attempts++;
      const target = {
        x: randomRange(padding + (compact ? 70 : 55), width - padding - (compact ? 70 : 55)),
        y: randomRange(padding + (compact ? 70 : 55), height - padding - (compact ? 70 : 55))
      };
      const R = randomRange(minR, maxR);

      const angle1 = randomRange(0, Math.PI * 2);
      // Diameter across circle (180 deg) forms the hypotenuse
      const angle2 = angle1 + Math.PI;
      // Third vertex anywhere along the semicircle
      const angle3 = angle1 + randomRange(Math.PI * 0.35, Math.PI * 0.65);

      const A = { x: target.x + R * Math.cos(angle1), y: target.y + R * Math.sin(angle1) };
      const B = { x: target.x + R * Math.cos(angle2), y: target.y + R * Math.sin(angle2) };
      const C = { x: target.x + R * Math.cos(angle3), y: target.y + R * Math.sin(angle3) };

      if (isPointInside(A, width, height, padding) &&
          isPointInside(B, width, height, padding) &&
          isPointInside(C, width, height, padding)) {
        
        targetPoint = { x: target.x, y: target.y, radius: R };
        studentPositions = [
          { name: '친구 A', baseEmoji: '👦', x: A.x, y: A.y, currentEmoji: '🤔' },
          { name: '친구 B', baseEmoji: '👧', x: B.x, y: B.y, currentEmoji: '🤔' },
          { name: '친구 C', baseEmoji: '🧑', x: C.x, y: C.y, currentEmoji: '🤔' }
        ];
        valid = true;
      }
    }

    if (!valid) generateAcuteLayout(width, height, padding);
  }

  // 3. Obtuse Triangle (둔각삼각형: 외심이 외부)
  function generateObtuseLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;
    const compact = isCompactViewport();
    const minDim = Math.min(width, height);

    const minR = compact ? 120 : Math.max(165, Math.round(minDim * 0.35));
    const maxR = Math.round(minDim * (compact ? 0.43 : 0.47));

    while (!valid && attempts < 350) {
      attempts++;
      const target = {
        x: randomRange(padding + (compact ? 70 : 55), width - padding - (compact ? 70 : 55)),
        y: randomRange(padding + (compact ? 70 : 55), height - padding - (compact ? 70 : 55))
      };
      const R = randomRange(minR, maxR);

      const angle1 = randomRange(0, Math.PI * 2);
      // Span of all 3 vertices is strictly less than PI (e.g. 110~150 deg), putting target outside the triangle
      const angle2 = angle1 + randomRange(Math.PI * 0.32, Math.PI * 0.44);
      const angle3 = angle2 + randomRange(Math.PI * 0.32, Math.PI * 0.44);

      const A = { x: target.x + R * Math.cos(angle1), y: target.y + R * Math.sin(angle1) };
      const B = { x: target.x + R * Math.cos(angle2), y: target.y + R * Math.sin(angle2) };
      const C = { x: target.x + R * Math.cos(angle3), y: target.y + R * Math.sin(angle3) };

      const distAB = Math.hypot(A.x - B.x, A.y - B.y);
      const distBC = Math.hypot(B.x - C.x, B.y - C.y);
      const distCA = Math.hypot(C.x - A.x, C.y - A.y);
      const minSideLen = compact ? 70 : 100;

      if (distAB >= minSideLen && distBC >= minSideLen && distCA >= minSideLen &&
          isPointInside(A, width, height, padding) &&
          isPointInside(B, width, height, padding) &&
          isPointInside(C, width, height, padding)) {
        
        targetPoint = { x: target.x, y: target.y, radius: R };
        studentPositions = [
          { name: '친구 A', baseEmoji: '👦', x: A.x, y: A.y, currentEmoji: '🤔' },
          { name: '친구 B', baseEmoji: '👧', x: B.x, y: B.y, currentEmoji: '🤔' },
          { name: '친구 C', baseEmoji: '🧑', x: C.x, y: C.y, currentEmoji: '🤔' }
        ];
        valid = true;
      }
    }

    if (!valid) generateAcuteLayout(width, height, padding);
  }

  function generateStandardFallback(width, height, padding) {
    const compact = isCompactViewport();
    const R = compact ? 120 : Math.round(Math.min(width, height) * 0.36);
    targetPoint = { x: width / 2, y: height / 2, radius: R };
    studentPositions = [
      { name: '친구 A', baseEmoji: '👦', x: width / 2 - Math.round(R * 0.8), y: height / 2 - Math.round(R * 0.55), currentEmoji: '🤔' },
      { name: '친구 B', baseEmoji: '👧', x: width / 2 + Math.round(R * 0.8), y: height / 2 - Math.round(R * 0.55), currentEmoji: '🤔' },
      { name: '친구 C', baseEmoji: '🧑', x: width / 2, y: height / 2 + Math.round(R * 0.8), currentEmoji: '🤔' }
    ];
  }

  function isPointInside(pt, width, height, pad) {
    return pt.x >= pad && pt.x <= width - pad && pt.y >= pad && pt.y <= height - pad;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // ----------------------------------------------------
  // Render Students
  // ----------------------------------------------------
  function renderStudents() {
    studentPositions.forEach((st, idx) => {
      let el = document.getElementById(`student-pin-${idx}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `student-pin-${idx}`;
        el.className = 'student-pin mood-neutral';
        elementsLayer.appendChild(el);
      }
      el.style.left = `${st.x}px`;
      el.style.top = `${st.y}px`;
      el.innerHTML = `<div class="student-emoji-box" id="student-emoji-${idx}">🤔</div>`;
    });
  }

  // ----------------------------------------------------
  // Render Triangle Geometry Layer (SVG)
  // ----------------------------------------------------
  function renderTriangleGeometry() {
    if (studentPositions.length < 3) return;
    const [A, B, C] = studentPositions;
    const { width, height } = getBoardContentSize();
    geometrySvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const midBC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const midCA = { x: (C.x + A.x) / 2, y: (C.y + A.y) / 2 };

    let svgHtml = `
      <defs>
        <filter id="glow-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0284c7" flood-opacity="0.25"/>
        </filter>
      </defs>
      
      <!-- Triangle Body Fill & Edges -->
      <polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" 
               fill="rgba(2, 132, 199, 0.04)" 
               stroke="#0284c7" 
               stroke-width="2.8" 
               stroke-linejoin="round"
               filter="url(#glow-shadow)" />

      <!-- Triangle Vertex Dots (A, B, C Center Points) -->
      <circle cx="${A.x}" cy="${A.y}" r="4.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
      <circle cx="${B.x}" cy="${B.y}" r="4.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
      <circle cx="${C.x}" cy="${C.y}" r="4.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
    `;

    svgHtml += `
      <!-- Midpoint AB -->
      <circle cx="${midAB.x}" cy="${midAB.y}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
      <text x="${midAB.x}" y="${midAB.y - 9}" font-size="11" font-weight="700" fill="#d97706" text-anchor="middle">중점</text>
      
      <!-- Midpoint BC -->
      <circle cx="${midBC.x}" cy="${midBC.y}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
      <text x="${midBC.x}" y="${midBC.y - 9}" font-size="11" font-weight="700" fill="#d97706" text-anchor="middle">중점</text>
      
      <!-- Midpoint CA -->
      <circle cx="${midCA.x}" cy="${midCA.y}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
      <text x="${midCA.x}" y="${midCA.y - 9}" font-size="11" font-weight="700" fill="#d97706" text-anchor="middle">중점</text>
    `;

    geometrySvg.innerHTML = svgHtml;
  }

  // ----------------------------------------------------
  // Set Square (직각자) Management & Interaction
  // ----------------------------------------------------
  function getRulerSvgMetrics(W, H) {
    const insetX = Math.max(5, Math.round(W * (24 / 140)));
    const insetY = Math.max(5, Math.round(H * (24 / 110)));
    const farX = Math.max(insetX + 6, Math.round(W * (48 / 140)));
    const farY = Math.max(insetY + 6, Math.round(H * (48 / 110)));
    const innerTopX = Math.max(insetX + 8, W - farX);
    const innerLeftY = Math.max(insetY + 8, H - farY);
    const cornerMark = Math.max(7, Math.round(Math.min(insetX, insetY) * 0.58));
    const fontSize = Math.max(7, Math.round(Math.min(W, H) * 0.071));
    const tickStep = Math.max(6, Math.round(W / 14));
    const tickMargin = Math.max(8, Math.round(Math.min(W, H) * 0.11));
    const strokeOuter = Math.max(1.4, W / 56);
    const strokeInner = Math.max(1, W / 93);

    return {
      insetX,
      insetY,
      innerTopX,
      innerLeftY,
      cornerMark,
      fontSize,
      tickStep,
      tickMargin,
      strokeOuter,
      strokeInner,
      lockX: Math.round(W / 3),
      lockY: Math.round(H / 3)
    };
  }

  function buildRulerSvgMarkup(W, H) {
    const m = getRulerSvgMetrics(W, H);
    let tickMarks = '';
    for (let i = m.tickStep; i < W - m.tickMargin; i += m.tickStep) {
      const h = i % (m.tickStep * 5) === 0 ? 8 : (i % (m.tickStep * 2) === 0 ? 5 : 3);
      tickMarks += `<line x1="${i}" y1="0" x2="${i}" y2="${h}" class="ruler-ticks" />`;
    }
    for (let i = m.tickStep; i < H - m.tickMargin; i += m.tickStep) {
      const w = i % (m.tickStep * 5) === 0 ? 8 : (i % (m.tickStep * 2) === 0 ? 5 : 3);
      tickMarks += `<line x1="0" y1="${i}" x2="${w}" y2="${i}" class="ruler-ticks" />`;
    }

    return `
      <line x1="0" y1="0" x2="${W * 4}" y2="0" stroke="rgba(2, 132, 199, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" />
      <line x1="0" y1="0" x2="0" y2="${H * 4}" stroke="rgba(2, 132, 199, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" />
      <polygon points="0,0 ${W},0 0,${H}" class="ruler-body" stroke-width="${m.strokeOuter}" />
      <polygon points="${m.insetX},${m.insetY} ${m.innerTopX},${m.insetY} ${m.insetX},${m.innerLeftY}" class="ruler-inner-cutout" stroke-width="${m.strokeInner}" />
      <path d="M ${m.cornerMark},0 L ${m.cornerMark},${m.cornerMark} L 0,${m.cornerMark}" class="ruler-right-angle-mark" stroke-width="${m.strokeInner}" />
      ${tickMarks}
      <text x="${m.cornerMark + 4}" y="${m.cornerMark + 6}" font-size="${m.fontSize}" font-weight="800" class="ruler-angle-label">90°</text>
    `;
  }

  function getRulerSize() {
    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 520;
    const scale = Math.min(1, Math.min(width / 720, height / 480));
    const clamped = Math.max(isCompactViewport() ? 0.64 : 0.78, scale);
    return {
      width: Math.round(140 * clamped),
      height: Math.round(110 * clamped)
    };
  }

  function snapshotRulersState() {
    return {
      activeRulerId,
      rulers: rulers.map(ruler => ({
        id: ruler.id,
        x: ruler.x,
        y: ruler.y,
        angle: ruler.angle,
        width: ruler.width,
        height: ruler.height,
        locked: ruler.locked,
        hidden: ruler.hidden
      }))
    };
  }

  function restoreRulersState(snapshot) {
    if (!snapshot) return;

    activeRulerId = snapshot.activeRulerId;
    snapshot.rulers.forEach(saved => {
      const ruler = rulers[saved.id];
      if (!ruler) return;
      ruler.x = saved.x;
      ruler.y = saved.y;
      ruler.angle = saved.angle;
      ruler.width = saved.width;
      ruler.height = saved.height;
      ruler.locked = saved.locked;
      ruler.hidden = saved.hidden;
      ruler.isDragging = false;
      ruler.isRotating = false;
    });

    updateRulerToolbar();
    renderRulers();
  }

  function resetRulersState() {
    activeRulerId = 0;
    rulers.forEach((ruler, index) => {
      ruler.locked = false;
      ruler.hidden = index !== 0;
    });
    updateRulerToolbar();
  }

  function getRulerColorName(id) {
    return RULER_COLOR_NAMES[id] || '직각자';
  }

  function updateRulerToolbar() {
    if (rulerChipGroup) {
      rulerChipGroup.querySelectorAll('.ruler-chip').forEach(chip => {
        const id = parseInt(chip.dataset.rulerId, 10);
        const ruler = rulers[id];
        if (!ruler) return;
        const colorName = getRulerColorName(id);
        chip.classList.toggle('is-selected', !ruler.hidden && activeRulerId === id);
        chip.classList.toggle('is-locked', ruler.locked && !ruler.hidden);
        chip.classList.toggle('is-hidden', ruler.hidden);
        chip.setAttribute('aria-pressed', !ruler.hidden && activeRulerId === id ? 'true' : 'false');
        chip.title = ruler.hidden
          ? `${colorName} 직각자 · 눌러서 꺼내기`
          : ruler.locked
            ? `${colorName} 직각자 고정됨 · 눌러서 해제 · 길게 누르면 숨김`
            : activeRulerId === id
              ? `${colorName} 직각자 선택됨 · 다시 누르면 고정 · 길게 누르면 숨김`
              : `${colorName} 직각자 선택 · 길게 누르면 숨김`;
      });
    }

    if (btnLockAllRulers) {
      const visibleRulers = rulers.filter(ruler => !ruler.hidden);
      const allLocked = visibleRulers.length > 0 && visibleRulers.every(ruler => ruler.locked);
      btnLockAllRulers.classList.toggle('active', allLocked);
      btnLockAllRulers.innerHTML = allLocked
        ? '<span class="tool-lock-icon">🔒</span><span class="tool-btn-full">전체 고정됨</span><span class="tool-btn-short">고정됨</span>'
        : '<span class="tool-lock-icon">🔓</span><span class="tool-btn-full">전체 고정</span><span class="tool-btn-short">전체</span>';
      btnLockAllRulers.title = allLocked ? '표시 중인 직각자 전체 고정 해제' : '표시 중인 직각자 전체 고정';
    }
  }

  function handleRulerChipClick(id) {
    const ruler = rulers[id];
    if (!ruler) return;

    if (ruler.hidden) {
      ruler.hidden = false;
      activeRulerId = id;
    } else if (ruler.locked) {
      ruler.locked = false;
      activeRulerId = id;
    } else if (activeRulerId === id) {
      ruler.locked = true;
      activeRulerId = null;
    } else {
      activeRulerId = id;
    }

    updateRulerToolbar();
    renderRulers();
  }

  function toggleRulerHidden(id) {
    const ruler = rulers[id];
    if (!ruler) return;

    ruler.hidden = !ruler.hidden;
    ruler.isDragging = false;
    ruler.isRotating = false;

    if (ruler.hidden) {
      if (activeRulerId === id) activeRulerId = null;
    } else {
      activeRulerId = id;
    }

    updateRulerToolbar();
    renderRulers();
  }

  function handleLockAllRulersClick() {
    const visibleRulers = rulers.filter(ruler => !ruler.hidden);
    const allLocked = visibleRulers.length > 0 && visibleRulers.every(ruler => ruler.locked);
    rulers.forEach(ruler => {
      if (!ruler.hidden) ruler.locked = !allLocked;
    });
    if (!allLocked) activeRulerId = null;
    updateRulerToolbar();
    renderRulers();
  }

  function resetRulersPosition() {
    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 520;
    const size = getRulerSize();
    const compact = isCompactViewport();
    const bottomY = Math.max(16, height - size.height - (compact ? 12 : 20));
    const rightReserve = compact ? 112 : 16;

    const count = 3;
    const availableWidth = Math.max(120, width - 28 - rightReserve);
    const spacing = Math.min(compact ? 150 : 240, availableWidth / count);
    const startX = Math.max(12, (width - rightReserve - ((count - 1) * spacing + size.width)) / 2);

    for (let i = 0; i < count; i++) {
      rulers[i].width = size.width;
      rulers[i].height = size.height;
      rulers[i].x = Math.round(startX + i * spacing);
      rulers[i].y = bottomY;
      rulers[i].angle = 0;
    }

    renderRulers();
  }

  function renderRulers() {
    rulersLayer.innerHTML = '';

    const drawOrder = [...rulers].sort((a, b) => {
      if (a.id === activeRulerId) return 1;
      if (b.id === activeRulerId) return -1;
      return a.id - b.id;
    });

    drawOrder.forEach(ruler => {
      if (ruler.hidden) return;

      const container = document.createElement('div');
      container.id = `set-square-${ruler.id}`;
      const classNames = ['set-square-container', ruler.theme];
      if (ruler.locked) classNames.push('is-locked');
      if (activeRulerId === ruler.id) classNames.push('is-selected');
      container.className = classNames.join(' ');
      container.style.left = `${ruler.x}px`;
      container.style.top = `${ruler.y}px`;
      container.style.transform = `rotate(${ruler.angle}deg)`;

      const W = ruler.width;
      const H = ruler.height;
      const metrics = getRulerSvgMetrics(W, H);

      container.innerHTML = `
        <svg class="set-square-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
          ${buildRulerSvgMarkup(W, H)}
        </svg>

        <div class="ruler-rotate-handle" id="rotate-handle-${ruler.id}" title="드래그하여 각도를 자유롭게 회전하세요!">
          ⟳
        </div>
        ${ruler.locked ? `<div class="ruler-lock-badge" style="left:${metrics.lockX}px;top:${metrics.lockY}px;width:${Math.max(28, Math.round(Math.min(W, H) * 0.34))}px;height:${Math.max(28, Math.round(Math.min(W, H) * 0.34))}px;font-size:${Math.max(14, Math.round(Math.min(W, H) * 0.18))}px" aria-hidden="true">🔒</div>` : ''}
      `;

      // Position the rotation knob
      const rotateHandle = container.querySelector(`#rotate-handle-${ruler.id}`);
      if (rotateHandle) {
        rotateHandle.style.left = `${W * 0.44}px`;
        rotateHandle.style.top = `${H * 0.44}px`;
      }

      rulersLayer.appendChild(container);
      bindRulerEvents(container, ruler);
    });
  }

  function bindRulerEvents(container, ruler) {
    const rotateHandle = container.querySelector(`#rotate-handle-${ruler.id}`);

    // Ruler Dragging (Move)
    let startPointer = { x: 0, y: 0 };
    let startRulerPos = { x: ruler.x, y: ruler.y };

    function onRulerDragStart(e) {
      if (ruler.locked) return;
      if (e.target.closest('.ruler-rotate-handle')) return;
      e.preventDefault();
      e.stopPropagation();

      ruler.isDragging = true;
      container.classList.add('is-dragging');

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startPointer = { x: clientX, y: clientY };
      startRulerPos = { x: ruler.x, y: ruler.y };

      window.addEventListener('mousemove', onRulerDragMove);
      window.addEventListener('mouseup', onRulerDragEnd);
      window.addEventListener('touchmove', onRulerDragMove, { passive: false });
      window.addEventListener('touchend', onRulerDragEnd);
    }

    function onRulerDragMove(e) {
      if (!ruler.isDragging) return;
      if (e.type === 'touchmove') e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startPointer.x;
      const dy = clientY - startPointer.y;

      const { width, height } = getBoardContentSize();
      ruler.x = Math.max(-40, Math.min(width - 60, startRulerPos.x + dx));
      ruler.y = Math.max(-40, Math.min(height - 60, startRulerPos.y + dy));

      container.style.left = `${ruler.x}px`;
      container.style.top = `${ruler.y}px`;
    }

    function onRulerDragEnd() {
      if (!ruler.isDragging) return;
      ruler.isDragging = false;
      container.classList.remove('is-dragging');

      window.removeEventListener('mousemove', onRulerDragMove);
      window.removeEventListener('mouseup', onRulerDragEnd);
      window.removeEventListener('touchmove', onRulerDragMove);
      window.removeEventListener('touchend', onRulerDragEnd);
    }

    container.addEventListener('mousedown', onRulerDragStart);
    container.addEventListener('touchstart', onRulerDragStart, { passive: false });

    // Rotation Knob Dragging (Rotate)
    if (rotateHandle) {
      function onRotateStart(e) {
        if (ruler.locked) return;
        e.preventDefault();
        e.stopPropagation();

        ruler.isRotating = true;
        rotateHandle.classList.add('is-rotating');

        window.addEventListener('mousemove', onRotateMove);
        window.addEventListener('mouseup', onRotateEnd);
        window.addEventListener('touchmove', onRotateMove, { passive: false });
        window.addEventListener('touchend', onRotateEnd);
      }

      function onRotateMove(e) {
        if (!ruler.isRotating) return;
        if (e.type === 'touchmove') e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const boardRect = gameBoard.getBoundingClientRect();
        // Pivot point is at ruler.x, ruler.y (relative to board content area)
        const pivotScreenX = boardRect.left + gameBoard.clientLeft + ruler.x;
        const pivotScreenY = boardRect.top + gameBoard.clientTop + ruler.y;

        const angleRad = Math.atan2(clientY - pivotScreenY, clientX - pivotScreenX);
        let angleDeg = angleRad * (180 / Math.PI) - 45; // Offset by handle vector

        ruler.angle = Math.round(angleDeg);
        container.style.transform = `rotate(${ruler.angle}deg)`;
      }

      function onRotateEnd() {
        if (!ruler.isRotating) return;
        ruler.isRotating = false;
        rotateHandle.classList.remove('is-rotating');

        window.removeEventListener('mousemove', onRotateMove);
        window.removeEventListener('mouseup', onRotateEnd);
        window.removeEventListener('touchmove', onRotateMove);
        window.removeEventListener('touchend', onRotateEnd);
      }

      rotateHandle.addEventListener('mousedown', onRotateStart);
      rotateHandle.addEventListener('touchstart', onRotateStart, { passive: false });
    }
  }

  // ----------------------------------------------------
  // Board Drag & Bingsoo Placement Handlers
  // ----------------------------------------------------
  function getBoardCoords(e) {
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return clientToBoardCoords(clientX, clientY);
  }

  function handleBoardClick(e) {
    if (e.target.closest('.dpad-controller') || e.target.closest('.set-square-container') || e.target.closest('.ruler-toolbar') || e.target.closest('.controls-bar')) {
      return;
    }

    if (e.type === 'touchstart') e.preventDefault();

    const coords = getBoardCoords(e);
    placedPoint = coords;
    isDraggingBingsoo = true;

    renderPlacedBingsoo();
    btnCheckAnswer.disabled = false;

    if (isAnswerChecked) {
      updateIndividualStudentExpressions(placedPoint);
      drawVerificationLines();
    } else {
      resetStudentExpressionsNeutral();
    }
  }

  function handleBoardMove(e) {
    if (!isDraggingBingsoo) return;
    if (e.cancelable) e.preventDefault();

    const coords = getBoardCoords(e);
    placedPoint = coords;

    const pin = document.getElementById('user-bingsoo-pin');
    if (pin) {
      pin.style.left = `${placedPoint.x}px`;
      pin.style.top = `${placedPoint.y}px`;
      pin.classList.add('is-dragging');
    }

    if (isAnswerChecked) {
      updateIndividualStudentExpressions(placedPoint);
      drawVerificationLines();
    } else {
      resetStudentExpressionsNeutral();
    }
  }

  function handleBoardEnd() {
    if (!isDraggingBingsoo) return;
    isDraggingBingsoo = false;

    const pin = document.getElementById('user-bingsoo-pin');
    if (pin) {
      pin.classList.remove('is-dragging');
    }
  }

  gameBoard.addEventListener('mousedown', handleBoardClick);
  window.addEventListener('mousemove', handleBoardMove);
  window.addEventListener('mouseup', handleBoardEnd);

  gameBoard.addEventListener('touchstart', handleBoardClick, { passive: false });
  window.addEventListener('touchmove', handleBoardMove, { passive: false });
  window.addEventListener('touchend', handleBoardEnd);

  function renderPlacedBingsoo() {
    let pin = document.getElementById('user-bingsoo-pin');
    if (!pin) {
      pin = document.createElement('div');
      pin.id = 'user-bingsoo-pin';
      pin.className = 'placed-bingsoo-pin';
      elementsLayer.appendChild(pin);
    }
    pin.style.left = `${placedPoint.x}px`;
    pin.style.top = `${placedPoint.y}px`;
    pin.innerHTML = `
      <div class="bingsoo-center-crosshair">
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
        <div class="crosshair-dot"></div>
      </div>
      <div class="bingsoo-icon-wrapper">🍨</div>
      <div class="bingsoo-label">내 팥빙수</div>
    `;
  }

  // ----------------------------------------------------
  // Fine-Tuning D-Pad & Keyboard Controls (방향키 세밀조정)
  // ----------------------------------------------------
  let dpadStep = 1;
  const dpadController = document.getElementById('dpad-controller');
  const btnToggleStep = document.getElementById('btn-toggle-step');
  const dpadButtons = document.querySelectorAll('.dpad-btn[data-dir]');

  // D-Pad Draggable Positioning
  if (dpadController) {
    let isDraggingDpad = false;
    let dpadStartPointer = { x: 0, y: 0 };
    let dpadStartPos = { x: 0, y: 0 };

    const onDpadStart = (e) => {
      if (e.target.closest('.dpad-btn') || e.target.closest('.dpad-step-btn')) return;
      e.preventDefault();
      e.stopPropagation();

      isDraggingDpad = true;
      dpadController.classList.add('is-dragging');

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const boardRect = gameBoard.getBoundingClientRect();
      const dpadRect = dpadController.getBoundingClientRect();

      dpadStartPos = {
        x: dpadRect.left - boardRect.left - gameBoard.clientLeft,
        y: dpadRect.top - boardRect.top - gameBoard.clientTop
      };

      dpadController.style.left = `${dpadStartPos.x}px`;
      dpadController.style.top = `${dpadStartPos.y}px`;
      dpadController.style.right = 'auto';
      dpadController.style.bottom = 'auto';

      dpadStartPointer = { x: clientX, y: clientY };

      window.addEventListener('mousemove', onDpadMove);
      window.addEventListener('mouseup', onDpadEnd);
      window.addEventListener('touchmove', onDpadMove, { passive: false });
      window.addEventListener('touchend', onDpadEnd);
    };

    const onDpadMove = (e) => {
      if (!isDraggingDpad) return;
      if (e.type === 'touchmove') e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - dpadStartPointer.x;
      const dy = clientY - dpadStartPointer.y;

      const { width, height } = getBoardContentSize();
      const dpadWidth = dpadController.offsetWidth || 120;
      const dpadHeight = dpadController.offsetHeight || 140;

      const newX = Math.max(5, Math.min(width - dpadWidth - 5, dpadStartPos.x + dx));
      const newY = Math.max(5, Math.min(height - dpadHeight - 5, dpadStartPos.y + dy));

      dpadController.style.left = `${newX}px`;
      dpadController.style.top = `${newY}px`;
    };

    const onDpadEnd = () => {
      if (!isDraggingDpad) return;
      isDraggingDpad = false;
      dpadController.classList.remove('is-dragging');

      window.removeEventListener('mousemove', onDpadMove);
      window.removeEventListener('mouseup', onDpadEnd);
      window.removeEventListener('touchmove', onDpadMove);
      window.removeEventListener('touchend', onDpadEnd);
    };

    dpadController.addEventListener('mousedown', onDpadStart);
    dpadController.addEventListener('touchstart', onDpadStart, { passive: false });
  }

  if (btnToggleStep) {
    btnToggleStep.addEventListener('click', () => {
      dpadStep = dpadStep === 1 ? 5 : 1;
      btnToggleStep.textContent = `${dpadStep}px`;
    });
  }

  function nudgeBingsoo(dx, dy) {
    const { width, height } = getBoardContentSize();
    if (!placedPoint) {
      placedPoint = {
        x: Math.round(width / 2),
        y: Math.round(height / 2)
      };
    } else {
      placedPoint.x = Math.max(10, Math.min(width - 10, placedPoint.x + dx));
      placedPoint.y = Math.max(10, Math.min(height - 10, placedPoint.y + dy));
    }

    renderPlacedBingsoo();
    btnCheckAnswer.disabled = false;

    if (isAnswerChecked) {
      updateIndividualStudentExpressions(placedPoint);
      drawVerificationLines();
    } else {
      resetStudentExpressionsNeutral();
    }
  }

  let dpadRepeatTimer = null;
  let dpadIntervalTimer = null;

  function getDpadDelta(dir, step) {
    if (dir === 'up') return { dx: 0, dy: -step };
    if (dir === 'down') return { dx: 0, dy: step };
    if (dir === 'left') return { dx: -step, dy: 0 };
    if (dir === 'right') return { dx: step, dy: 0 };
    return { dx: 0, dy: 0 };
  }

  dpadButtons.forEach(btn => {
    const dir = btn.getAttribute('data-dir');

    const startPress = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('is-pressed');
      const { dx, dy } = getDpadDelta(dir, dpadStep);
      nudgeBingsoo(dx, dy);

      clearTimeout(dpadRepeatTimer);
      clearInterval(dpadIntervalTimer);

      dpadRepeatTimer = setTimeout(() => {
        dpadIntervalTimer = setInterval(() => {
          nudgeBingsoo(dx, dy);
        }, 40);
      }, 220);
    };

    const stopPress = () => {
      btn.classList.remove('is-pressed');
      clearTimeout(dpadRepeatTimer);
      clearInterval(dpadIntervalTimer);
    };

    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', stopPress);
    btn.addEventListener('mouseleave', stopPress);

    btn.addEventListener('touchstart', startPress, { passive: false });
    btn.addEventListener('touchend', stopPress);
    btn.addEventListener('touchcancel', stopPress);
  });

  // Keyboard Arrow Keys Handlers
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!playerModal.classList.contains('hidden') || !privacyModal.classList.contains('hidden') || !resultModal.classList.contains('hidden')) return;

    let dir = null;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'up';
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dir = 'down';
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'left';
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'right';

    if (dir) {
      e.preventDefault();
      const step = e.shiftKey ? dpadStep * 5 : dpadStep;
      const { dx, dy } = getDpadDelta(dir, step);
      nudgeBingsoo(dx, dy);

      const targetBtn = document.querySelector(`.dpad-btn[data-dir="${dir}"]`);
      if (targetBtn) targetBtn.classList.add('is-pressed');
    }
  });

  window.addEventListener('keyup', (e) => {
    let dir = null;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'up';
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dir = 'down';
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'left';
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'right';

    if (dir) {
      const targetBtn = document.querySelector(`.dpad-btn[data-dir="${dir}"]`);
      if (targetBtn) targetBtn.classList.remove('is-pressed');
    }
  });

  // ----------------------------------------------------
  // Student Reactions & Expressions
  // ----------------------------------------------------
  function updateIndividualStudentExpressions(bingsooPos) {
    if (!bingsooPos || studentPositions.length < 3) return;

    const distances = studentPositions.map(st => Math.hypot(bingsooPos.x - st.x, bingsooPos.y - st.y));
    const targetDist = Math.hypot(bingsooPos.x - targetPoint.x, bingsooPos.y - targetPoint.y);

    const maxD = Math.max(...distances);
    const minD = Math.min(...distances);
    const spread = maxD - minD;

    studentPositions.forEach((st, idx) => {
      const d = distances[idx];
      let expr = '🤔';
      let moodClass = 'mood-neutral';

      if (targetDist <= 10 || spread <= 10) {
        expr = '🤩';
        moodClass = 'mood-happy';
      } else {
        if (Math.abs(d - maxD) < 8 && spread > 16) {
          expr = '😡';
          moodClass = 'mood-angry';
        } else if (Math.abs(d - minD) < 8 && spread > 16) {
          expr = '😊';
          moodClass = 'mood-happy';
        } else {
          expr = '😟';
          moodClass = 'mood-disappointed';
        }
      }

      st.currentEmoji = expr;
      const box = document.getElementById(`student-emoji-${idx}`);
      const pin = document.getElementById(`student-pin-${idx}`);
      if (box) box.textContent = expr;
      if (pin) pin.className = `student-pin ${moodClass}`;
    });
  }

  function resetStudentExpressionsNeutral() {
    studentPositions.forEach((st, idx) => {
      st.currentEmoji = '🤔';
      const box = document.getElementById(`student-emoji-${idx}`);
      const pin = document.getElementById(`student-pin-${idx}`);
      if (box) box.textContent = '🤔';
      if (pin) pin.className = 'student-pin mood-neutral';
    });
  }

  // ----------------------------------------------------
  // Check Answer & Geometry Verification
  // ----------------------------------------------------
  btnCheckAnswer.addEventListener('click', () => {
    if (!placedPoint || isAnswerChecked) return;
    isAnswerChecked = true;

    showInstruction(
      '👉 팥빙수를 드래그하여 정답 위치를 확인하세요!',
      '👉 팥빙수를 드래그해 정답 위치를 확인하세요!'
    );

    const errorDistance = Math.round(Math.hypot(placedPoint.x - targetPoint.x, placedPoint.y - targetPoint.y));

    updateIndividualStudentExpressions(placedPoint);

    const roundScore = calculateStrictScore(errorDistance);

    // Save initial submitted position for this round
    initialSubmittedPoint = {
      x: placedPoint.x,
      y: placedPoint.y,
      errorPx: errorDistance,
      score: roundScore
    };
    initialSubmittedRulersState = snapshotRulersState();

    totalScore += roundScore;
    roundHistory.push({ round: currentRound, score: roundScore, errorPx: errorDistance });

    updateHeaderUI();
    drawVerificationLines();
    renderTargetCircumcenterPin();
    renderOriginalSubmittedPin();

    showScorePopup(roundScore, errorDistance);

    btnCheckAnswer.classList.add('hidden');
    if (btnResetToSubmitted) btnResetToSubmitted.classList.remove('hidden');
    btnNextRound.classList.remove('hidden');

    if (currentRound === maxRounds) {
      btnNextRound.textContent = '🏆 최종 결과 보기';
    } else {
      btnNextRound.textContent = '▶ 다음 라운드 진행';
    }
  });

  if (btnResetToSubmitted) {
    btnResetToSubmitted.addEventListener('click', () => {
      if (!initialSubmittedPoint) return;
      placedPoint = { x: initialSubmittedPoint.x, y: initialSubmittedPoint.y };
      restoreRulersState(initialSubmittedRulersState);
      renderPlacedBingsoo();
      updateIndividualStudentExpressions(placedPoint);
      drawVerificationLines();
      showScorePopup(initialSubmittedPoint.score, initialSubmittedPoint.errorPx);
      showInstruction(
        '👉 팥빙수를 드래그하여 정답 위치를 확인하세요!',
        '👉 팥빙수를 드래그해 정답 위치를 확인하세요!'
      );
    });
  }

  function calculateStrictScore(distance) {
    if (distance <= 3) return 100;
    if (distance <= 8) return Math.max(90, Math.round(100 - distance * 1.5));
    if (distance <= 20) return Math.max(70, Math.round(90 - (distance - 8) * 1.6));
    if (distance <= 45) return Math.max(30, Math.round(70 - (distance - 20) * 1.6));
    if (distance <= 75) return Math.max(0, Math.round(30 - (distance - 45) * 1.0));
    return 0;
  }

  function renderOriginalSubmittedPin() {
    if (!initialSubmittedPoint) return;
    let pin = document.getElementById('original-submitted-pin');
    if (!pin) {
      pin = document.createElement('div');
      pin.id = 'original-submitted-pin';
      pin.className = 'original-submitted-pin';
      elementsLayer.appendChild(pin);
    }
    pin.style.left = `${initialSubmittedPoint.x}px`;
    pin.style.top = `${initialSubmittedPoint.y}px`;
    pin.innerHTML = `
      <div class="original-ghost-box">🍨</div>
      <div class="original-ghost-label">내 제출 위치 (${initialSubmittedPoint.errorPx}px)</div>
    `;
  }

  function renderTargetCircumcenterPin() {
    let pin = document.getElementById('target-circumcenter-pin');
    if (!pin) {
      pin = document.createElement('div');
      pin.id = 'target-circumcenter-pin';
      pin.className = 'target-circumcenter-pin';
      elementsLayer.appendChild(pin);
    }
    pin.style.left = `${targetPoint.x}px`;
    pin.style.top = `${targetPoint.y}px`;
    pin.innerHTML = `
      <div class="bingsoo-center-crosshair target-crosshair">
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
        <div class="crosshair-dot"></div>
      </div>
      <div class="target-icon-box">🎯</div>
      <div class="target-label">정답 위치</div>
    `;
  }

  function drawVerificationLines() {
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    if (!placedPoint || studentPositions.length < 3) return;

    const [A, B, C] = studentPositions;

    ctx.save();

    // 1. Draw Circumcircle (외접원) passing through A, B, C
    ctx.beginPath();
    ctx.arc(targetPoint.x, targetPoint.y, targetPoint.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();

    // 2. Draw 3 Perpendicular Bisectors (수직이등분선)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    const drawPerpBisector = (p1, p2) => {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(midX - nx * 400, midY - ny * 400);
      ctx.lineTo(midX + nx * 400, midY + ny * 400);
      ctx.stroke();
    };

    drawPerpBisector(A, B);
    drawPerpBisector(B, C);
    drawPerpBisector(C, A);

    // 3. Draw distance lines from placed Bingsoo to all 3 students
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;
    studentPositions.forEach(st => {
      const d = Math.round(Math.hypot(placedPoint.x - st.x, placedPoint.y - st.y));
      ctx.strokeStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(placedPoint.x, placedPoint.y);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();

      const midX = (placedPoint.x + st.x) / 2;
      const midY = (placedPoint.y + st.y) / 2;

      let badge = document.getElementById(`dist-badge-${st.x}-${st.y}`);
      if (!badge) {
        badge = document.createElement('div');
        badge.id = `dist-badge-${st.x}-${st.y}`;
        badge.className = 'distance-badge';
        elementsLayer.appendChild(badge);
      }
      badge.style.left = `${midX}px`;
      badge.style.top = `${midY}px`;
      badge.textContent = `거리: ${d}`;
    });

    ctx.restore();
  }

  function showScorePopup(score, errorDistance) {
    if (popupTimeoutId) clearTimeout(popupTimeoutId);

    scoreNumber.textContent = `${score}점`;
    scoreDistanceInfo.textContent = `정답 위치와 오차: ${errorDistance}`;

    let badgeText = "좋아요! 👍";
    if (score === 100) badgeText = "0 오차 완벽 명중! 🏆";
    else if (score >= 90) badgeText = "초정밀 명중! 🎯";
    else if (score >= 75) badgeText = "훌륭합니다! 👏";
    else if (score >= 50) badgeText = "좋아요! 👍";
    else if (score >= 25) badgeText = "아쉬워요! 😃";
    else badgeText = "다시 도전! 🍧";

    scoreRatingBadge.textContent = badgeText;
    scorePopup.classList.remove('hidden');

    popupTimeoutId = setTimeout(() => {
      scorePopup.classList.add('hidden');
    }, 1500);
  }

  scorePopup.addEventListener('click', () => {
    scorePopup.classList.add('hidden');
    if (popupTimeoutId) clearTimeout(popupTimeoutId);
  });

  // ----------------------------------------------------
  // Next Round / Restart
  // ----------------------------------------------------
  btnNextRound.addEventListener('click', () => {
    if (currentRound < maxRounds) {
      currentRound++;
      loadRound(currentRound);
    } else {
      finishGame();
    }
  });

  btnModalRestart.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    checkPlayerRegistration();
  });

  // ----------------------------------------------------
  // Game Finish & Realtime Firebase Leaderboard
  // ----------------------------------------------------
  if (btnSendData) btnSendData.style.display = 'none';

  async function registerScoreToLeaderboard() {
    if (apiStatusMsg) {
      apiStatusMsg.className = 'api-status-msg';
      apiStatusMsg.textContent = '⏳ 랭킹 등록 중...';
    }

    playerName = sanitizeInput(HalomathProfile.loadName(activeMode) || playerName || '', 12);
    if (activeMode === 'school') {
      studentId = sanitizeInput(HalomathProfile.loadStudentId(activeMode) || studentId || '', 10);
    }

    if (!isValidName(playerName) || (activeMode === 'school' && !HalomathProfile.isValidStudentId(studentId))) {
      if (apiStatusMsg) {
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = activeMode === 'school'
          ? '❌ 참가자 정보가 올바르지 않습니다. (이름 1~12자, 학번 1~10자)'
          : '❌ 닉네임이 올바르지 않습니다. (1~12자)';
      }
      return null;
    }

    if (typeof totalScore !== 'number' || isNaN(totalScore) || totalScore < 0 || totalScore > 500) {
      if (apiStatusMsg) {
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = '❌ 유효하지 않은 점수 범위입니다.';
      }
      return null;
    }

    const calculatedSum = roundHistory.reduce((acc, cur) => acc + cur.score, 0);
    if (roundHistory.length !== maxRounds || calculatedSum !== totalScore) {
      if (apiStatusMsg) {
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = '❌ 라운드 성적 데이터 검증에 실패했습니다.';
      }
      return null;
    }

    const totalErrorPx = roundHistory.reduce((sum, round) => sum + round.errorPx, 0);
    const playTimeMs = sessionPlayTimeMs != null
      ? sessionPlayTimeMs
      : (gameStartedAt ? Math.max(0, Date.now() - gameStartedAt) : null);

    const payload = {
      gameId: 'bingsoo2',
      game: 'bingsoo2',
      score: Number(totalScore),
      totalErrorPx,
      playTimeMs,
      rounds: roundHistory,
      timestamp: (window.firebase && firebase.database && typeof firebase.database.ServerValue !== 'undefined')
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now()
    };

    try {
      const result = await HalomathScores.submitScore(firebaseDb, {
        activeMode,
        name: playerName,
        studentId,
        gameIds: ['bingsoo2', 'bingsoo-2'],
        payload,
        compareMode: 'bingsoo2',
        acceptEntry: (val) => isBingsoo2GameId(val),
        updatedMessage: `🎉 ${totalScore}점으로 기록이 갱신되었습니다!`,
        createdMessage: activeMode === 'school'
          ? `✅ ${playerName}(학번: ${studentId})님의 ${totalScore}점이 등록되었습니다!`
          : `✅ ${playerName}님의 ${totalScore}점이 등록되었습니다!`,
        unchangedMessage: `ℹ️ 기존 등록 점수가 ${totalScore}점보다 높거나 같아 갱신하지 않았습니다.`
      });

      if (apiStatusMsg) {
        apiStatusMsg.className = 'api-status-msg' + (result.success ? ' success' : ' error');
        if (!result.updated && result.existingScore != null) {
          if (result.existingScore > totalScore) {
            apiStatusMsg.textContent = `ℹ️ 이미 등록된 팥빙수2 기록(${result.existingScore}점)이 더 좋아 갱신하지 않았습니다.`;
          } else if (result.existingScore === totalScore) {
            apiStatusMsg.textContent = `ℹ️ ${totalScore}점은 같지만, 기존 팥빙수2 기록(오차·시간)이 더 좋아 갱신하지 않았습니다.`;
          } else {
            apiStatusMsg.textContent = result.message;
          }
        } else {
          apiStatusMsg.textContent = result.message;
        }
      }
      listenRealtimeLeaderboard();
      return result;
    } catch (err) {
      console.warn('registerScoreToLeaderboard failed:', err);
      if (apiStatusMsg) {
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = '❌ 랭킹 등록 중 오류가 발생했습니다.';
      }
      return null;
    }
  }

  function finishGame() {
    if (gameStartedAt) {
      sessionPlayTimeMs = Math.max(0, Date.now() - gameStartedAt);
    }

    finalTotalScore.innerHTML = `${totalScore} <small>/ 500</small>`;
    apiStatusMsg.textContent = '';
    apiStatusMsg.className = 'api-status-msg';

    let isNewRecord = false;
    if (totalScore > highScore) {
      highScore = totalScore;
      safeSetStorage(highScoreStorageKey, highScore.toString());
      highScoreDisplay.innerHTML = `${highScore} <small>점</small>`;
      isNewRecord = true;
    }

    if (isNewRecord) {
      newRecordBadge.classList.remove('hidden');
    } else {
      newRecordBadge.classList.add('hidden');
    }

    if (resultLockedName) resultLockedName.textContent = playerName;
    if (resultLockedId) resultLockedId.textContent = studentId || '—';

    const avgScore = totalScore / 5;

    if (window.confetti && avgScore >= 80) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    roundHistoryList.innerHTML = '';
    roundHistory.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="round-tag">ROUND ${item.round}</span>
        <span>오차: ${item.errorPx}</span>
        <span class="score-tag">+${item.score}점</span>
      `;
      roundHistoryList.appendChild(li);
    });

    resultModal.classList.remove('hidden');
    registerScoreToLeaderboard();
  }

  // ----------------------------------------------------
  // Leaderboard Functions
  // ----------------------------------------------------
  function getTotalErrorPxFromRounds(rounds) {
    if (!Array.isArray(rounds)) return null;
    let sum = 0;
    for (const round of rounds) {
      const px = parseInt(round && round.errorPx, 10);
      if (!Number.isFinite(px)) return null;
      sum += px;
    }
    return sum;
  }

  function compareAscendingNullable(a, b) {
    if (a != null && b != null && a !== b) return a - b;
    if (a != null && b == null) return -1;
    if (a == null && b != null) return 1;
    return 0;
  }

  function isBetterLeaderboardEntry(candidate, previous) {
    if (!previous) return true;
    if (candidate.score !== previous.score) return candidate.score > previous.score;

    const errCmp = compareAscendingNullable(candidate.totalErrorPx, previous.totalErrorPx);
    if (errCmp !== 0) return errCmp < 0;

    const timeCmp = compareAscendingNullable(candidate.playTimeMs, previous.playTimeMs);
    if (timeCmp !== 0) return timeCmp < 0;

    return (candidate.timestamp || 0) < (previous.timestamp || 0);
  }

  function sortLeaderboardEntries(entries) {
    return entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const errCmp = compareAscendingNullable(a.totalErrorPx, b.totalErrorPx);
      if (errCmp !== 0) return errCmp;

      const timeCmp = compareAscendingNullable(a.playTimeMs, b.playTimeMs);
      if (timeCmp !== 0) return timeCmp;

      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  function withScoreCompetitionRanks(entries) {
    const ranks = [];
    let lastScore = null;
    let lastRank = 0;

    entries.forEach((entry, index) => {
      const rank = lastScore !== null && entry.score === lastScore ? lastRank : index + 1;
      lastScore = entry.score;
      lastRank = rank;
      ranks.push(rank);
    });

    const tieCounts = {};
    ranks.forEach((rank) => {
      tieCounts[rank] = (tieCounts[rank] || 0) + 1;
    });

    return entries.map((entry, index) => ({
      entry,
      rank: ranks[index],
      tied: tieCounts[ranks[index]] > 1
    }));
  }

  function formatRankBadge(rank, tied) {
    const label = tied ? `공동 ${rank}위` : `${rank}위`;
    if (rank === 1) return `🥇 ${label}`;
    if (rank === 2) return `🥈 ${label}`;
    if (rank === 3) return `🥉 ${label}`;
    return label;
  }

  function formatTotalErrorPx(totalErrorPx) {
    return totalErrorPx == null ? '-' : `${totalErrorPx}px`;
  }

  function parseLeaderboardRow(row) {
    const name = sanitizeInput(row.playerName || row.name || '도전자', 12);
    const studentId = sanitizeInput(row.studentId || '', 10);
    const score = Math.max(0, Math.min(500, parseInt(row.totalScore || row.score || 0, 10)));
    const storedError = row.totalErrorPx != null ? parseInt(row.totalErrorPx, 10) : null;
    const totalErrorPx = Number.isFinite(storedError)
      ? storedError
      : getTotalErrorPxFromRounds(row.rounds);
    const storedPlayTime = row.playTimeMs != null ? parseInt(row.playTimeMs, 10) : null;
    const playTimeMs = Number.isFinite(storedPlayTime) && storedPlayTime >= 0 ? storedPlayTime : null;

    return {
      name,
      studentId,
      score,
      totalErrorPx: totalErrorPx == null || !Number.isFinite(totalErrorPx) ? null : totalErrorPx,
      playTimeMs,
      timestamp: row.timestamp || 0
    };
  }

  function getHallOfFameDisplayEntries(sortedEntries, perfectScore = 500, defaultLimit = 20) {
    const perfectCount = sortedEntries.filter((entry) => entry.score === perfectScore).length;
    const displayCount = Math.max(defaultLimit, perfectCount);
    return {
      entries: sortedEntries.slice(0, displayCount),
      perfectCount,
      displayCount
    };
  }

  function updateLeaderboardTitle(displayCount, perfectCount) {
    if (!resultLeaderboardTitle) return;
    const baseTitle = activeMode === 'dorms'
      ? '🏆 dorms 명예의 전당'
      : '🏆 우리 학교 명예의 전당';

    if (perfectCount > 20) {
      resultLeaderboardTitle.textContent = `${baseTitle} (500점 만점 ${perfectCount}명 전원)`;
    } else {
      resultLeaderboardTitle.textContent = `${baseTitle} (1위 ~ 20위)`;
    }
  }

  let bingsoo2FirebaseRetryCount = 0;

  function fetchLeaderboardViaREST() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch('https://math-game-halogini-default-rtdb.firebaseio.com/scores.json', {
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        clearTimeout(timeoutId);
        renderLeaderboardsFromData(data);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.warn('Bingsoo2 leaderboard REST fetch failed:', err);
      });
  }

  function listenRealtimeLeaderboard() {
    if (firebaseDb) {
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        console.warn('Bingsoo2 leaderboard SDK timed out; using REST.');
        fetchLeaderboardViaREST();
      }, 3000);

      firebaseDb.ref('scores').once('value')
        .then((snapshot) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          renderLeaderboardsFromData(snapshot.val());
        })
        .catch((err) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.warn('Bingsoo2 leaderboard SDK failed; using REST.', err);
          fetchLeaderboardViaREST();
        });
      return;
    }

    if (bingsoo2FirebaseRetryCount < 3) {
      bingsoo2FirebaseRetryCount += 1;
      setTimeout(listenRealtimeLeaderboard, 400);
      return;
    }

    fetchLeaderboardViaREST();
  }

  function renderLeaderboardsFromData(data) {
    if (!data) return;

    const bestMap = new Map();

    const collectNodes = (obj, isDormsSubtree = false) => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach((key) => {
        const row = obj[key];
        if (!row || typeof row !== 'object') return;

        if (row.name || row.playerName) {
          if (!isBingsoo2GameId(row)) return;

          const valStudentId = String(row.studentId || '').trim();
          const valChannel = String(row.channel || '').trim();
          const isDormsEntry = isDormsSubtree || valStudentId === 'DORMS' || valStudentId === 'DOREMS'
            || valChannel === 'dorms' || valChannel === 'dorems' || key === 'dorms';
          const matchesMode = activeMode === 'dorms' ? isDormsEntry : !isDormsEntry;
          if (!matchesMode) return;

          const entry = parseLeaderboardRow(row);
          const userKey = activeMode === 'school'
            ? `${entry.name}_${entry.studentId}`
            : entry.name;
          const prev = bestMap.get(userKey);
          if (isBetterLeaderboardEntry(entry, prev)) {
            bestMap.set(userKey, entry);
          }
        } else {
          collectNodes(row, key === 'dorms' || isDormsSubtree);
        }
      });
    };

    collectNodes(data);

    const sortedEntries = sortLeaderboardEntries(Array.from(bestMap.values()));
    const { entries: hallOfFameEntries, perfectCount, displayCount } = getHallOfFameDisplayEntries(sortedEntries);
    const tableColSpan = activeMode === 'school' ? 5 : 4;

    updateLeaderboardTitle(displayCount, perfectCount);

    if (hallOfFameEntries.length > 0) {
      const champ = hallOfFameEntries[0];
      if (openingChampName) openingChampName.textContent = champ.name;
      if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
      if (openingChampId) {
        openingChampId.textContent = activeMode === 'school' ? `학번: ${champ.studentId || '—'}` : '';
      }
    } else {
      if (openingChampName) openingChampName.textContent = '도전자';
      if (openingChampId) openingChampId.textContent = '';
      if (openingChampScore) openingChampScore.innerHTML = `0<small>점</small>`;
    }

    const ranked = withScoreCompetitionRanks(hallOfFameEntries);
    const buildRows = () => {
      if (ranked.length === 0) {
        return `<tr><td colspan="${tableColSpan}" style="text-align:center; padding:15px; color:#64748b;">아직 등록된 기록이 없습니다. 첫 점수를 등록해 보세요!</td></tr>`;
      }

      return ranked.map(({ entry, rank, tied }) => {
        const rankBadge = formatRankBadge(rank, tied);
        const idCell = activeMode === 'school' ? `<td>${escapeHtml(entry.studentId || '—')}</td>` : '';
        return `
          <tr>
            <td><strong>${rankBadge}</strong></td>
            <td>${escapeHtml(entry.name)}</td>
            ${idCell}
            <td style="font-weight: 800; color: #0284c7;">${entry.score}점</td>
            <td>${formatTotalErrorPx(entry.totalErrorPx)}</td>
          </tr>
        `;
      }).join('');
    };

    if (openingLeaderboardTbody) openingLeaderboardTbody.innerHTML = buildRows();
    if (leaderboardTbody) leaderboardTbody.innerHTML = buildRows();
  }

  // ----------------------------------------------------
  // Crown 5-Clicks QR PiP / Popout Mini Window
  // ----------------------------------------------------
  let qrPipWindow = null;
  let qrPopoutWindow = null;

  function canUseDocumentPip() {
    return !!(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function');
  }

  function getShareableGameUrl() {
    try {
      return new URL(window.location.href).href;
    } catch (e) {
      return window.location.href;
    }
  }

  function fillQrPipDocument(doc, targetUrl) {
    doc.title = '🍧 빙수 2탄 입장 QR';
    doc.head.innerHTML = '';
    doc.body.innerHTML = '';

    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&ecc=M&data=${encodeURIComponent(targetUrl)}`;

    const style = doc.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Pretendard', system-ui, -apple-system, sans-serif;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 14px;
        text-align: center;
        color: #0f172a;
        user-select: none;
      }
      .qr-card {
        background: #ffffff;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        border: 1px solid #e2e8f0;
        width: 100%;
        max-width: 280px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .qr-badge {
        display: inline-block;
        font-size: 0.75rem;
        font-weight: 700;
        color: #0284c7;
        background: #e0f2fe;
        padding: 3px 10px;
        border-radius: 20px;
        margin-bottom: 6px;
      }
      .qr-title {
        font-size: 1.05rem;
        font-weight: 800;
        color: #1e293b;
        margin-bottom: 10px;
      }
      .qr-img-wrapper {
        background: #ffffff;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
      }
      .qr-img {
        display: block;
        width: 200px;
        height: 200px;
        border-radius: 6px;
      }
      .qr-desc {
        font-size: 0.8rem;
        color: #64748b;
        line-height: 1.4;
        font-weight: 500;
      }
      .qr-desc strong {
        color: #0284c7;
      }
    `;
    doc.head.appendChild(style);

    const card = doc.createElement('div');
    card.className = 'qr-card';

    const badge = doc.createElement('span');
    badge.className = 'qr-badge';
    badge.textContent = '🍧 할로매쓰 빙수 2탄';

    const title = doc.createElement('div');
    title.className = 'qr-title';
    title.textContent = '학생 접속 QR 코드';

    const imgWrap = doc.createElement('div');
    imgWrap.className = 'qr-img-wrapper';

    const img = doc.createElement('img');
    img.className = 'qr-img';
    img.alt = '빙수 2탄 입장 QR 코드';
    img.width = 200;
    img.height = 200;
    img.src = qrImgSrc;

    imgWrap.appendChild(img);

    const desc = doc.createElement('p');
    desc.className = 'qr-desc';
    desc.innerHTML = '스마트폰/태블릿 카메라로 비추면<br><strong>바로 게임에 접속</strong>할 수 있습니다.';

    card.append(badge, title, imgWrap, desc);
    doc.body.appendChild(card);
  }

  async function openQrPipOrPopup() {
    const targetUrl = getShareableGameUrl();

    if (canUseDocumentPip()) {
      try {
        if (qrPipWindow && !qrPipWindow.closed) {
          fillQrPipDocument(qrPipWindow.document, targetUrl);
          return;
        }
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 290,
          height: 380
        });
        qrPipWindow = pipWindow;
        fillQrPipDocument(pipWindow.document, targetUrl);
        pipWindow.addEventListener('pagehide', () => {
          qrPipWindow = null;
        });
        return;
      } catch (err) {
        console.warn('QR Document PiP failed, using fallback popup window:', err);
      }
    }

    const features = 'width=320,height=420,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
    if (qrPopoutWindow && !qrPopoutWindow.closed) {
      try {
        fillQrPipDocument(qrPopoutWindow.document, targetUrl);
        qrPopoutWindow.focus();
        return;
      } catch (e) { /* fall through */ }
    }

    qrPopoutWindow = window.open('', 'halomath-bingsoo2-qr', features);
    if (qrPopoutWindow) {
      fillQrPipDocument(qrPopoutWindow.document, targetUrl);
      try { qrPopoutWindow.focus(); } catch (e) { /* ignore */ }
    } else {
      alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.');
    }
  }

  function setupCrownEasterEgg() {
    let crownClicks = 0;
    let crownTimer = null;

    const onCrownTrigger = (e) => {
      if (e) {
        e.stopPropagation();
      }
      crownClicks += 1;

      if (crownTimer) clearTimeout(crownTimer);
      crownTimer = setTimeout(() => {
        crownClicks = 0;
      }, 2500);

      if (crownClicks >= 5) {
        crownClicks = 0;
        clearTimeout(crownTimer);
        openQrPipOrPopup();
      }
    };

    const crownBtn = document.getElementById('btn-opening-crown');
    if (crownBtn) {
      crownBtn.addEventListener('click', onCrownTrigger);
    }

    const bannerH2 = document.querySelector('.opening-banner h2');
    if (bannerH2 && bannerH2 !== crownBtn) {
      bannerH2.addEventListener('click', onCrownTrigger);
    }
  }

  setupCrownEasterEgg();

  // Score auto-registers in finishGame via registerScoreToLeaderboard.
}

document.addEventListener('DOMContentLoaded', () => {
  initBingsoo2Game();
});
