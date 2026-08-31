/**
 * 🍧 팥빙수 2탄: 세 친구 삼각형 & 직각자 작전! - Game Engine Logic
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
  function detectActiveMode() {
    try {
      const href = (window.location.href || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();

      if (search.includes('mode=dorms') || search.includes('mode=dorems') ||
          hash.includes('mode=dorms') || hash.includes('mode=dorems') ||
          href.includes('dorms') || href.includes('dorems')) {
        return 'dorms';
      }
    } catch (e) {}
    return 'school';
  }

  let activeMode = detectActiveMode();

  const dbRefPath = activeMode === 'dorms' ? 'scores/dorms' : 'scores';
  const nameStorageKey = `bingsoo2_name_${activeMode}`;
  const idStorageKey = `bingsoo2_id_${activeMode}`;
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
  let isAnswerChecked = false;
  let isDraggingBingsoo = false;
  let popupTimeoutId = null;

  // 3 Set Squares (직각자 3개 - 깔끔하게 정렬된 기본 배치)
  const rulers = [
    { id: 0, theme: 'ruler-theme-blue', name: '자 A', x: 40, y: 380, angle: 0, width: 140, height: 110, isDragging: false, isRotating: false },
    { id: 1, theme: 'ruler-theme-green', name: '자 B', x: 260, y: 380, angle: 0, width: 140, height: 110, isDragging: false, isRotating: false },
    { id: 2, theme: 'ruler-theme-orange', name: '자 C', x: 480, y: 380, angle: 0, width: 140, height: 110, isDragging: false, isRotating: false }
  ];

  // Locked Player Info
  let playerName = sanitizeInput(
    safeGetStorage(nameStorageKey) || (activeMode === 'dorms' ? safeGetStorage('halomath_name_dorms') : '') || '',
    12
  );
  if (activeMode === 'dorms' && !playerName) {
    playerName = randomDormsNickname();
    safeSetStorage(nameStorageKey, playerName);
  } else if (!playerName) {
    playerName = '도전자';
  }
  let studentId = activeMode === 'school' ? sanitizeInput(safeGetStorage(idStorageKey) || '', 10) : '';

  // DOM Elements
  const gameBoard = document.getElementById('game-board');
  const geometrySvg = document.getElementById('geometry-svg');
  const elementsLayer = document.getElementById('elements-layer');
  const rulersLayer = document.getElementById('rulers-layer');
  const lineCanvas = document.getElementById('line-canvas');
  const ctx = lineCanvas.getContext('2d');

  const btnResetRulers = document.getElementById('btn-reset-rulers');

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
  if (activeMode === 'dorms') {
    if (studentIdGroup) studentIdGroup.style.display = 'none';
    if (displayStudentId) displayStudentId.style.display = 'none';
    if (thOpeningId) thOpeningId.style.display = 'none';
    if (thResultId) thResultId.style.display = 'none';
    if (resultLockedIdSpan) resultLockedIdSpan.style.display = 'none';
    if (labelPlayerName) labelPlayerName.textContent = '도전자 닉네임:';
    if (inputPlayerName) {
      inputPlayerName.placeholder = '닉네임';
      if (!inputPlayerName.value && playerName) inputPlayerName.value = playerName;
    }
    if (inputStudentId) inputStudentId.removeAttribute('required');
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 dorms 팥빙수 2탄 명예의 전당';
  } else {
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 우리 학교 팥빙수 2탄 명예의 전당';
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

  // Toolbar Toggle Handlers
  if (btnResetRulers) {
    btnResetRulers.addEventListener('click', () => {
      resetRulersPosition();
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
      setErr('닉네임을 입력해야 시작할 수 있습니다.');
      if (inputPlayerName) inputPlayerName.focus();
      return;
    }
    setErr('');

    let cleanId = '';
    if (activeMode === 'school') {
      const rawId = inputStudentId ? inputStudentId.value : '';
      cleanId = sanitizeInput(rawId, 10) || '미입력';
      studentId = cleanId;
      safeSetStorage(idStorageKey, studentId);
    }

    playerName = cleanName;
    safeSetStorage(nameStorageKey, playerName);

    updatePlayerInfoDisplay();
    playerModal.classList.add('hidden');
    initGame();
  });

  function updatePlayerInfoDisplay() {
    displayPlayerName.textContent = playerName || '플레이어';
    if (activeMode === 'school') {
      displayStudentId.textContent = studentId ? `학번: ${studentId}` : '학번: 미입력';
      displayStudentId.style.display = '';
    } else {
      displayStudentId.style.display = 'none';
    }
    if (resultLockedName) resultLockedName.textContent = playerName;
    if (resultLockedId) resultLockedId.textContent = studentId;
  }

  function initGame() {
    highScoreDisplay.innerHTML = `${highScore} <small>점</small>`;

    currentRound = 1;
    totalScore = 0;
    roundHistory = [];

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

  function setupCanvasResolution() {
    const rect = gameBoard.getBoundingClientRect();
    lineCanvas.width = rect.width;
    lineCanvas.height = rect.height;
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
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    elementsLayer.innerHTML = '';

    btnCheckAnswer.disabled = true;
    btnCheckAnswer.classList.remove('hidden');
    if (btnResetToSubmitted) btnResetToSubmitted.classList.add('hidden');
    btnNextRound.classList.add('hidden');
    scorePopup.classList.add('hidden');

    showInstruction(
      '👉 직각자 3개를 활용해 삼각형 변의 수직이등분선을 찾고, 교점에 팥빙수(🍨)를 놓아보세요!',
      '👉 직각자로 외심을 찾아 🍨을 놓아보세요!'
    );

    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 520;
    const padding = isCompactViewport()
      ? Math.max(36, Math.round(Math.min(width, height) * 0.1))
      : 65;

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
      `👉 [라운드 ${roundNum}] 직각자를 활용해 세 친구와 똑같은 거리에 팥빙수(🍨)를 놓아보세요!`,
      `👉 [라운드 ${roundNum}] 외심에 🍨을 놓으세요!`
    );

    resetRulersPosition();
    renderStudents();
    renderTriangleGeometry();
    renderRulers();
    updateHeaderUI();
  }

  // 1. Acute Triangle (예각삼각형: 외심이 내부)
  function generateAcuteLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 250) {
      attempts++;
      const target = {
        x: randomRange(padding + 60, width - padding - 60),
        y: randomRange(padding + 60, height - padding - 60)
      };
      const R = randomRange(110, Math.min(width, height) * 0.38);

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

    while (!valid && attempts < 350) {
      attempts++;
      const target = {
        x: randomRange(padding + 70, width - padding - 70),
        y: randomRange(padding + 70, height - padding - 70)
      };
      const R = randomRange(120, Math.min(width, height) * 0.40);

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

    while (!valid && attempts < 350) {
      attempts++;
      const target = {
        x: randomRange(padding + 70, width - padding - 70),
        y: randomRange(padding + 70, height - padding - 70)
      };
      const R = randomRange(125, Math.min(width, height) * 0.43);

      const angle1 = randomRange(0, Math.PI * 2);
      // Span of all 3 vertices is strictly less than PI (e.g. 110~150 deg), putting target outside the triangle
      const angle2 = angle1 + randomRange(Math.PI * 0.30, Math.PI * 0.42);
      const angle3 = angle2 + randomRange(Math.PI * 0.30, Math.PI * 0.42);

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

  function generateStandardFallback(width, height, padding) {
    targetPoint = { x: width / 2, y: height / 2, radius: 130 };
    studentPositions = [
      { name: '친구 A', baseEmoji: '👦', x: width / 2 - 100, y: height / 2 - 70, currentEmoji: '🤔' },
      { name: '친구 B', baseEmoji: '👧', x: width / 2 + 100, y: height / 2 - 70, currentEmoji: '🤔' },
      { name: '친구 C', baseEmoji: '🧑', x: width / 2, y: height / 2 + 100, currentEmoji: '🤔' }
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

    rulers.forEach(ruler => {
      const container = document.createElement('div');
      container.id = `set-square-${ruler.id}`;
      container.className = `set-square-container ${ruler.theme}`;
      container.style.left = `${ruler.x}px`;
      container.style.top = `${ruler.y}px`;
      container.style.transform = `rotate(${ruler.angle}deg)`;

      const W = ruler.width;
      const H = ruler.height;

      // SVG Set Square Shape with graduation tick marks & right-angle square
      let tickMarks = '';
      for (let i = 10; i < W - 15; i += 10) {
        const h = i % 50 === 0 ? 8 : (i % 20 === 0 ? 5 : 3);
        tickMarks += `<line x1="${i}" y1="0" x2="${i}" y2="${h}" class="ruler-ticks" />`;
      }
      for (let i = 10; i < H - 15; i += 10) {
        const w = i % 50 === 0 ? 8 : (i % 20 === 0 ? 5 : 3);
        tickMarks += `<line x1="0" y1="${i}" x2="${w}" y2="${i}" class="ruler-ticks" />`;
      }

      // Perpendicular Guide Ray
      const guideRaySvg = `
        <!-- Extended Perpendicular Rays from 90 deg corner -->
        <line x1="0" y1="0" x2="${W * 4}" y2="0" stroke="rgba(2, 132, 199, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" />
        <line x1="0" y1="0" x2="0" y2="${H * 4}" stroke="rgba(2, 132, 199, 0.45)" stroke-width="1.5" stroke-dasharray="4,4" />
      `;

      container.innerHTML = `
        <svg class="set-square-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
          ${guideRaySvg}
          <!-- Outer Triangle Body -->
          <polygon points="0,0 ${W},0 0,${H}" class="ruler-body" />
          <!-- Inner Cutout Triangle -->
          <polygon points="24,24 ${W - 48},24 24,${H - 48}" class="ruler-inner-cutout" />
          <!-- 90 Degree Right Angle Symbol -->
          <path d="M 14,0 L 14,14 L 0,14" class="ruler-right-angle-mark" />
          <!-- Ticks -->
          ${tickMarks}
          <!-- 90 Deg Label -->
          <text x="18" y="20" font-size="10" font-weight="800" fill="#0369a1">90°</text>
        </svg>

        <!-- Interactive Rotation Handle at Hypotenuse Center -->
        <div class="ruler-rotate-handle" id="rotate-handle-${ruler.id}" title="드래그하여 각도를 자유롭게 회전하세요!">
          ⟳
        </div>
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

      const boardRect = gameBoard.getBoundingClientRect();
      ruler.x = Math.max(-40, Math.min(boardRect.width - 60, startRulerPos.x + dx));
      ruler.y = Math.max(-40, Math.min(boardRect.height - 60, startRulerPos.y + dy));

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
        // Pivot point is at ruler.x, ruler.y (relative to board)
        const pivotScreenX = boardRect.left + ruler.x;
        const pivotScreenY = boardRect.top + ruler.y;

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
    const rect = gameBoard.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: Math.max(10, Math.min(rect.width - 10, clientX - rect.left)),
      y: Math.max(10, Math.min(rect.height - 10, clientY - rect.top))
    };
  }

  function handleBoardClick(e) {
    if (e.target.closest('.set-square-container') || e.target.closest('.ruler-toolbar') || e.target.closest('.controls-bar')) {
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
        x: dpadRect.left - boardRect.left,
        y: dpadRect.top - boardRect.top
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

      const boardRect = gameBoard.getBoundingClientRect();
      const dpadWidth = dpadController.offsetWidth || 120;
      const dpadHeight = dpadController.offsetHeight || 140;

      const newX = Math.max(5, Math.min(boardRect.width - dpadWidth - 5, dpadStartPos.x + dx));
      const newY = Math.max(5, Math.min(boardRect.height - dpadHeight - 5, dpadStartPos.y + dy));

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
    const boardRect = gameBoard.getBoundingClientRect();
    if (!placedPoint) {
      placedPoint = {
        x: Math.round(boardRect.width / 2),
        y: Math.round(boardRect.height / 2)
      };
    } else {
      placedPoint.x = Math.max(10, Math.min(boardRect.width - 10, placedPoint.x + dx));
      placedPoint.y = Math.max(10, Math.min(boardRect.height - 10, placedPoint.y + dy));
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
      '👉 팥빙수를 움직여 정답 외심(초록점)과 비교해보세요!',
      '👉 🍨을 움직여 초록점과 비교하세요!'
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
      setDualLabel(btnNextRound, '🏆 최종 결과 보기', '🏆 결과');
    } else {
      setDualLabel(btnNextRound, '▶ 다음 라운드 진행', '▶ 다음');
    }
  });

  if (btnResetToSubmitted) {
    btnResetToSubmitted.addEventListener('click', () => {
      if (!initialSubmittedPoint) return;
      placedPoint = { x: initialSubmittedPoint.x, y: initialSubmittedPoint.y };
      renderPlacedBingsoo();
      updateIndividualStudentExpressions(placedPoint);
      drawVerificationLines();
      showScorePopup(initialSubmittedPoint.score, initialSubmittedPoint.errorPx);
      showInstruction(
        '📍 팥빙수를 원래 제출 위치로 되돌렸습니다!',
        '📍 제출 위치로 되돌렸습니다!'
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
      <div class="target-label">정답 외심(O)</div>
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

    // 3. Draw Distance lines from placed Bingsoo to all 3 students
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
    scoreDistanceInfo.textContent = `정답 외심과 오차: ${errorDistance} px`;

    let badgeText = "좋아요! 👍";
    if (score === 100) badgeText = "완벽한 외심 명중! 🏆";
    else if (score >= 90) badgeText = "초정밀 작도 명중! 🎯";
    else if (score >= 75) badgeText = "훌륭합니다! 👏";
    else if (score >= 50) badgeText = "좋아요! 👍";
    else if (score >= 30) badgeText = "아쉬워요! 😃";
    else badgeText = "다시 도전! 🍧";

    scoreRatingBadge.textContent = badgeText;
    scorePopup.classList.remove('hidden');

    popupTimeoutId = setTimeout(() => {
      scorePopup.classList.add('hidden');
    }, 1800);
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
  function finishGame() {
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
    if (resultLockedId) resultLockedId.textContent = studentId;

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
      li.innerHTML = `
        <span><strong>라운드 ${item.round}</strong></span>
        <span>오차: ${item.errorPx} px</span>
        <span style="font-weight: 800; color: #0284c7;">+${item.score}점</span>
      `;
      roundHistoryList.appendChild(li);
    });

    resultModal.classList.remove('hidden');
  }

  // ----------------------------------------------------
  // Leaderboard Functions
  // ----------------------------------------------------
  function listenRealtimeLeaderboard() {
    if (!firebaseDb) return;

    try {
      const ref = firebaseDb.ref(dbRefPath);
      ref.on('value', (snapshot) => {
        const val = snapshot.val();
        renderLeaderboardsFromData(val);
      });
    } catch (e) {
      console.warn("Leaderboard listen error:", e);
    }
  }

  function renderLeaderboardsFromData(data) {
    if (!data) return;

    let entries = [];
    Object.keys(data).forEach(key => {
      const row = data[key];
      if (row && (row.game === 'bingsoo2' || row.game === 'bingsoo-2' || (row.gameId && row.gameId.includes('bingsoo2')))) {
        entries.push({
          key,
          name: sanitizeInput(row.playerName || row.name || '도전자', 12),
          studentId: sanitizeInput(row.studentId || '', 10),
          score: parseInt(row.totalScore || row.score || 0, 10),
          timestamp: row.timestamp || 0
        });
      }
    });

    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timestamp - b.timestamp;
    });

    // 1st Place Champion
    if (entries.length > 0) {
      const champ = entries[0];
      if (openingChampName) openingChampName.textContent = champ.name;
      if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
      if (openingChampId) {
        openingChampId.textContent = activeMode === 'school' ? `학번: ${champ.studentId || '미입력'}` : '';
      }
    }

    // Opening & Result Table
    const top20 = entries.slice(0, 20);
    const buildRows = () => {
      if (top20.length === 0) {
        return `<tr><td colspan="4" style="text-align:center; padding:16px; color:#94a3b8;">아직 등록된 랭킹 기록이 없습니다. 1등에 도전하세요!</td></tr>`;
      }
      return top20.map((entry, idx) => {
        const rank = idx + 1;
        let rankBadge = `${rank}위`;
        if (rank === 1) rankBadge = '🥇 1위';
        else if (rank === 2) rankBadge = '🥈 2위';
        else if (rank === 3) rankBadge = '🥉 3위';

        const idCell = activeMode === 'school' ? `<td>${escapeHtml(entry.studentId || '-')}</td>` : '';
        return `
          <tr>
            <td><strong>${rankBadge}</strong></td>
            <td>${escapeHtml(entry.name)}</td>
            ${idCell}
            <td style="font-weight: 800; color: #0284c7;">${entry.score}점</td>
          </tr>
        `;
      }).join('');
    };

    if (openingLeaderboardTbody) openingLeaderboardTbody.innerHTML = buildRows();
    if (leaderboardTbody) leaderboardTbody.innerHTML = buildRows();
  }

  // Register Score
  btnSendData.addEventListener('click', async () => {
    btnSendData.disabled = true;
    apiStatusMsg.textContent = '명예의 전당에 점수를 등록하는 중...';
    apiStatusMsg.className = 'api-status-msg';

    if (!firebaseDb) {
      apiStatusMsg.textContent = '❌ Firebase 데이터베이스 연결을 찾을 수 없습니다.';
      apiStatusMsg.className = 'api-status-msg error';
      btnSendData.disabled = false;
      return;
    }

    try {
      const newScoreRef = firebaseDb.ref(dbRefPath).push();
      await newScoreRef.set({
        gameId: 'bingsoo2',
        game: 'bingsoo2',
        name: playerName,
        playerName: playerName,
        studentId: activeMode === 'school' ? studentId : '',
        score: totalScore,
        totalScore: totalScore,
        rounds: roundHistory,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      apiStatusMsg.textContent = '🎉 명예의 전당 랭킹에 성공적으로 등록되었습니다!';
      apiStatusMsg.className = 'api-status-msg success';
    } catch (e) {
      console.error("Score submission error:", e);
      apiStatusMsg.textContent = '❌ 점수 등록 중 오류가 발생했습니다: ' + (e.message || '네트워크 오류');
      apiStatusMsg.className = 'api-status-msg error';
      btnSendData.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBingsoo2Game();
});
