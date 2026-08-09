/**
 * 팥빙수 똑같이 나눠주기 작전! - Game Engine Logic
 * 
 * Full Interactive & Channel Isolated Edition (Synchronized with Bingsoo Standalone Quality)
 */

// Dynamic Firebase Configuration (Supports window.ENV or Default Fallback)
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBiY1JBwYxtROIGFW7RUIJ4k7QZHVfNcEA",
  authDomain: "math-game-halogini.firebaseapp.com",
  databaseURL: "https://math-game-halogini-default-rtdb.firebaseio.com",
  projectId: "math-game-halogini",
  storageBucket: "math-game-halogini.firebasestorage.app",
  messagingSenderId: "42232060061",
  appId: "1:42232060061:web:ad26f83ca7d1285b3e5c74",
  measurementId: "G-F13LE342GQ"
};

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) ? window.ENV.FIREBASE_CONFIG : defaultFirebaseConfig;

// Initialize Firebase App & Database
let firebaseDb = null;
if (window.firebase) {
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

function isValidName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 12;
}

function isValidStudentId(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length >= 1 && trimmed.length <= 10 && /^[a-zA-Z0-9가-힣\-]+$/.test(trimmed);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------
  // Channel Mode Detection Logic (?mode=dorms vs ?mode=school)
  // ----------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode');
  let activeMode = (modeParam === 'dorms' || modeParam === 'dorems') ? 'dorms' : 'school';

  const dbRefPath = activeMode === 'dorms' ? 'scores/dorms' : 'scores';
  const nameStorageKey = `halomath_name_${activeMode}`;
  const idStorageKey = `halomath_id_${activeMode}`;
  const highScoreStorageKey = `bingsoo_highscore_${activeMode}`;

  // Game State
  let currentRound = 1;
  const maxRounds = 5;
  let totalScore = 0;
  let roundHistory = [];
  let highScore = parseInt(localStorage.getItem(highScoreStorageKey) || '0', 10);
  
  let studentPositions = [];
  let targetPoint = { x: 0, y: 0 };
  let placedPoint = null;
  let isAnswerChecked = false;
  let isDraggingBingsoo = false;
  let popupTimeoutId = null;

  // Locked Player Info (Sanitized)
  let playerName = sanitizeInput(localStorage.getItem(nameStorageKey) || '', 12);
  let studentId = activeMode === 'school' ? sanitizeInput(localStorage.getItem(idStorageKey) || '', 10) : '';

  // DOM Elements
  const gameBoard = document.getElementById('game-board');
  const elementsLayer = document.getElementById('elements-layer');
  const lineCanvas = document.getElementById('line-canvas');
  const ctx = lineCanvas.getContext('2d');

  const btnBackPortal = document.getElementById('btn-back-portal');
  if (btnBackPortal) {
    btnBackPortal.href = `../../index.html?mode=${activeMode}`;
  }

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

  // Apply Mode Isolation UI Toggles
  if (activeMode === 'dorms') {
    if (studentIdGroup) studentIdGroup.style.display = 'none';
    if (displayStudentId) displayStudentId.style.display = 'none';
    if (thOpeningId) thOpeningId.style.display = 'none';
    if (thResultId) thResultId.style.display = 'none';
    if (resultLockedIdSpan) resultLockedIdSpan.style.display = 'none';
    if (labelPlayerName) labelPlayerName.textContent = '도전자 닉네임:';
    if (inputPlayerName) inputPlayerName.placeholder = '예: dorms마스터';
    if (inputStudentId) inputStudentId.removeAttribute('required');
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 dorms 명예의 전당 (1위 ~ 20위)';
  } else {
    if (resultLeaderboardTitle) resultLeaderboardTitle.textContent = '🏆 우리 학교 명예의 전당 (1위 ~ 20위)';
  }

  // Privacy Policy Modal Handlers
  if (btnPrivacyPolicy && privacyModal && btnClosePrivacy) {
    btnPrivacyPolicy.addEventListener('click', () => {
      privacyModal.classList.remove('hidden');
    });
    btnClosePrivacy.addEventListener('click', () => {
      privacyModal.classList.add('hidden');
    });
  }

  // Toggle Opening Leaderboard View
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

  // Listen to Realtime Leaderboard
  listenRealtimeLeaderboard();

  // Initial Player Registration Check
  checkPlayerRegistration();

  function checkPlayerRegistration() {
    if (playerName && (activeMode === 'dorms' || studentId)) {
      if (inputPlayerName) inputPlayerName.value = playerName;
      if (activeMode === 'school' && inputStudentId) inputStudentId.value = studentId;
    }
    playerModal.classList.remove('hidden');
  }

  // Form Submit Handler with Strict Validation
  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawName = inputPlayerName.value;
    const cleanName = sanitizeInput(rawName, 12);

    if (!isValidName(cleanName)) {
      alert('도전자 이름/닉네임은 1자 이상 12자 이하로 입력해 주세요.');
      return;
    }

    let cleanId = '';
    if (activeMode === 'school') {
      const rawId = inputStudentId.value;
      cleanId = sanitizeInput(rawId, 10);
      if (!isValidStudentId(cleanId)) {
        alert('학번은 1자 이상 10자 이하의 영문, 숫자, 한글로 입력해 주세요.');
        return;
      }
      studentId = cleanId;
      localStorage.setItem(idStorageKey, studentId);
    }

    playerName = cleanName;
    localStorage.setItem(nameStorageKey, playerName);

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
    loadRound(currentRound);

    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    setupCanvasResolution();
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
  // Round Loading & Point Generation Algorithms
  // ----------------------------------------------------
  function loadRound(roundNum) {
    isAnswerChecked = false;
    placedPoint = null;
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    elementsLayer.innerHTML = '';

    btnCheckAnswer.disabled = true;
    btnCheckAnswer.classList.remove('hidden');
    btnNextRound.classList.add('hidden');
    scorePopup.classList.add('hidden');

    instructionBanner.textContent = '👉 🍨 원하는 곳을 터치해 팥빙수를 놓아보세요!';
    instructionBanner.classList.remove('hidden');

    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 500;
    const padding = 60;

    if (roundNum <= 3) {
      generateStandardLayout(width, height, padding);
    } else {
      generateSpecialLayout(width, height, padding);
    }

    renderStudents();
    updateHeaderUI();
  }

  function generateStandardLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 200) {
      attempts++;
      const target = {
        x: randomRange(padding + 50, width - padding - 50),
        y: randomRange(padding + 50, height - padding - 50)
      };
      const R = randomRange(100, Math.min(width, height) * 0.38);

      const angle1 = randomRange(0, Math.PI * 2);
      const angle2 = angle1 + randomRange(Math.PI * 0.5, Math.PI * 0.85);
      const angle3 = angle2 + randomRange(Math.PI * 0.5, Math.PI * 0.85);

      const A = { x: target.x + R * Math.cos(angle1), y: target.y + R * Math.sin(angle1) };
      const B = { x: target.x + R * Math.cos(angle2), y: target.y + R * Math.sin(angle2) };
      const C = { x: target.x + R * Math.cos(angle3), y: target.y + R * Math.sin(angle3) };

      if (isPointInside(A, width, height, padding) &&
          isPointInside(B, width, height, padding) &&
          isPointInside(C, width, height, padding)) {
        
        targetPoint = target;
        studentPositions = [
          { baseEmoji: '👦', x: A.x, y: A.y, currentEmoji: '🤔' },
          { baseEmoji: '👧', x: B.x, y: B.y, currentEmoji: '🤔' },
          { baseEmoji: '🧑', x: C.x, y: C.y, currentEmoji: '🤔' }
        ];
        valid = true;
      }
    }
  }

  function generateSpecialLayout(width, height, padding) {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 300) {
      attempts++;
      const target = {
        x: randomRange(padding + 60, width - padding - 60),
        y: randomRange(padding + 60, height - padding - 60)
      };
      const R = randomRange(110, Math.min(width, height) * 0.42);

      const angle1 = randomRange(0, Math.PI * 2);
      const deltaAngle = (attempts % 2 === 0) ? randomRange(Math.PI * 0.9, Math.PI * 1.05) : randomRange(Math.PI * 0.3, Math.PI * 0.45);
      const angle2 = angle1 + deltaAngle;
      const angle3 = angle2 + randomRange(Math.PI * 0.45, Math.PI * 0.7);

      const A = { x: target.x + R * Math.cos(angle1), y: target.y + R * Math.sin(angle1) };
      const B = { x: target.x + R * Math.cos(angle2), y: target.y + R * Math.sin(angle2) };
      const C = { x: target.x + R * Math.cos(angle3), y: target.y + R * Math.sin(angle3) };

      if (isPointInside(A, width, height, padding) &&
          isPointInside(B, width, height, padding) &&
          isPointInside(C, width, height, padding)) {
        
        targetPoint = target;
        studentPositions = [
          { baseEmoji: '👦', x: A.x, y: A.y, currentEmoji: '🤔' },
          { baseEmoji: '👧', x: B.x, y: B.y, currentEmoji: '🤔' },
          { baseEmoji: '🧑', x: C.x, y: C.y, currentEmoji: '🤔' }
        ];
        valid = true;
      }
    }

    if (!valid) {
      generateStandardLayout(width, height, padding);
    }
  }

  function isPointInside(pt, width, height, pad) {
    return pt.x >= pad && pt.x <= width - pad && pt.y >= pad && pt.y <= height - pad;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // Render Student Pins
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

  function updateIndividualStudentExpressions(bingsooPos) {
    if (!bingsooPos) return;

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
  // Drag & Interaction Handlers
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

  function handleStartDrag(e) {
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

  function handleMoveDrag(e) {
    if (!isDraggingBingsoo) return;
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

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

  function handleEndDrag(e) {
    if (!isDraggingBingsoo) return;
    isDraggingBingsoo = false;

    const pin = document.getElementById('user-bingsoo-pin');
    if (pin) {
      pin.classList.remove('is-dragging');
    }
  }

  gameBoard.addEventListener('mousedown', handleStartDrag);
  window.addEventListener('mousemove', handleMoveDrag);
  window.addEventListener('mouseup', handleEndDrag);

  gameBoard.addEventListener('touchstart', handleStartDrag, { passive: false });
  window.addEventListener('touchmove', handleMoveDrag, { passive: false });
  window.addEventListener('touchend', handleEndDrag);

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
      <div class="bingsoo-icon">🍨</div>
      <div class="bingsoo-label">내 팥빙수</div>
    `;

    if (isAnswerChecked) {
      pin.classList.add('transparent-mode');
    } else {
      pin.classList.remove('transparent-mode');
    }
  }

  // ----------------------------------------------------
  // Check Answer & Strict Score Calculation
  // ----------------------------------------------------
  btnCheckAnswer.addEventListener('click', () => {
    if (!placedPoint || isAnswerChecked) return;
    isAnswerChecked = true;

    const pin = document.getElementById('user-bingsoo-pin');
    if (pin) pin.classList.add('transparent-mode');

    instructionBanner.textContent = '👉 팥빙수를 드래그하여 정답 위치를 확인하세요!';
    instructionBanner.classList.remove('hidden');

    const errorDistance = Math.round(Math.hypot(placedPoint.x - targetPoint.x, placedPoint.y - targetPoint.y));

    updateIndividualStudentExpressions(placedPoint);

    const roundScore = calculateStrictScore(errorDistance);

    totalScore += roundScore;
    roundHistory.push({ round: currentRound, score: roundScore, errorPx: errorDistance });

    updateHeaderUI();
    drawVerificationLines();

    showScorePopup(roundScore, errorDistance);

    btnCheckAnswer.classList.add('hidden');
    btnNextRound.classList.remove('hidden');

    if (currentRound === maxRounds) {
      btnNextRound.textContent = '🏆 최종 결과 보기';
    } else {
      btnNextRound.textContent = '▶ 다음 라운드 진행';
    }
  });

  function calculateStrictScore(distance) {
    if (distance === 0) return 100;
    if (distance <= 5) return Math.max(88, Math.round(100 - distance * 2.4));
    if (distance <= 15) return Math.max(65, Math.round(88 - (distance - 5) * 2.2));
    if (distance <= 40) return Math.max(25, Math.round(65 - (distance - 15) * 1.6));
    if (distance <= 65) return Math.max(0, Math.round(25 - (distance - 40) * 1.0));
    return 0;
  }

  function drawVerificationLines() {
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    ctx.save();
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
  // Game Finish
  // ----------------------------------------------------
  function finishGame() {
    finalTotalScore.innerHTML = `${totalScore} <small>/ 500</small>`;
    apiStatusMsg.textContent = '';
    apiStatusMsg.className = 'api-status-msg';

    let isNewRecord = false;
    if (totalScore > highScore) {
      highScore = totalScore;
      localStorage.setItem(highScoreStorageKey, highScore.toString());
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
      li.className = 'history-item';
      li.innerHTML = `
        <span class="round-tag">ROUND ${item.round}</span>
        <span>오차: ${item.errorPx}</span>
        <span class="score-tag">+${item.score}점</span>
      `;
      roundHistoryList.appendChild(li);
    });

    resultModal.classList.remove('hidden');

    const cardEl = resultModal.querySelector('.modal-card');
    if (cardEl) {
      cardEl.scrollTop = 0;
    }
  }

  // ----------------------------------------------------
  // Realtime Leaderboard Listener & Secure Rendering
  // ----------------------------------------------------
  let bingsooFirebaseRetryCount = 0;
  function listenRealtimeLeaderboard() {
    if (!firebaseDb) {
      if (bingsooFirebaseRetryCount < 10) {
        bingsooFirebaseRetryCount++;
        setTimeout(listenRealtimeLeaderboard, 400);
      }
      return;
    }

    firebaseDb.ref('scores').on('value', (snapshot) => {
      const userBestMap = new Map();
      snapshot.forEach(childSnap => {
        const val = childSnap.val();
        if (val && val.name) {
          const valGameId = String(val.gameId || '').trim();
          if (valGameId === 'congruence') return; // Skip congruence entries

          const valName = sanitizeInput(val.name, 12);
          const valStudentId = sanitizeInput(val.studentId || '', 10);
          const valChannel = String(val.channel || '').trim();
          const isDormsEntry = (valStudentId === 'DORMS' || valStudentId === 'DOREMS' || valChannel === 'dorms' || valChannel === 'dorems');
          const score = Math.max(0, Math.min(500, parseInt(val.score, 10) || 0));

          const matchesMode = (activeMode === 'dorms' && isDormsEntry) || (activeMode === 'school' && !isDormsEntry);
          if (matchesMode) {
            const userKey = activeMode === 'school' ? `${valName}_${valStudentId}` : valName;
            if (!userBestMap.has(userKey) || score > userBestMap.get(userKey).score) {
              userBestMap.set(userKey, {
                name: valName,
                studentId: valStudentId,
                score: score
              });
            }
          }
        }
      });
      const list = Array.from(userBestMap.values()).sort((a, b) => b.score - a.score);
      const top20 = list.slice(0, 20);

      if (top20.length > 0) {
        const champ = top20[0];
        if (openingChampName) openingChampName.textContent = champ.name || '김빙수';
        if (openingChampId) {
          if (activeMode === 'school') {
            openingChampId.textContent = champ.studentId ? `학번: ${champ.studentId}` : '학번: 미입력';
            openingChampId.style.display = '';
          } else {
            openingChampId.style.display = 'none';
          }
        }
        if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
      }

      renderHallOfFame(top20);
      renderOpeningHallOfFame(top20);
    }, (err) => {
      console.error("Leaderboard read error:", err);
    });
  }

  function renderOpeningHallOfFame(list) {
    if (!openingLeaderboardTbody) return;
    openingLeaderboardTbody.innerHTML = '';

    const colSpan = activeMode === 'school' ? 4 : 3;

    if (!list || list.length === 0) {
      openingLeaderboardTbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:10px; color:#64748b;">등록된 기록이 없습니다.</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      let rankDisplay = `${index + 1}위`;
      if (index === 0) rankDisplay = `🥇 1위`;
      else if (index === 1) rankDisplay = `🥈 2위`;
      else if (index === 2) rankDisplay = `🥉 3위`;

      let idTd = '';
      if (activeMode === 'school') {
        idTd = `<td>${escapeHtml(item.studentId || '미입력')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${item.score}점</strong></td>
      `;
      openingLeaderboardTbody.appendChild(tr);
    });
  }

  function renderHallOfFame(list) {
    if (!leaderboardTbody) return;
    leaderboardTbody.innerHTML = '';

    const colSpan = activeMode === 'school' ? 4 : 3;

    if (!list || list.length === 0) {
      leaderboardTbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:15px; color:#64748b;">아직 등록된 기록이 없습니다. 첫 점수를 등록해 보세요!</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');

      const isCurrentPlayer = (item.name === playerName && (activeMode === 'dorms' || item.studentId === studentId) && item.score === totalScore);
      if (isCurrentPlayer) {
        tr.className = 'current-player-row';
      }

      let rankDisplay = `${index + 1}위`;
      if (index === 0) rankDisplay = `🥇 1위`;
      else if (index === 1) rankDisplay = `🥈 2위`;
      else if (index === 2) rankDisplay = `🥉 3위`;

      let idTd = '';
      if (activeMode === 'school') {
        idTd = `<td>${escapeHtml(item.studentId || '미입력')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${item.score}점</strong></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }

  // ----------------------------------------------------
  // Score Submission Helper
  // ----------------------------------------------------
  async function submitScoreToFirebase(payload) {
    const snapshot = await firebaseDb.ref('scores').once('value');
    let existingKey = null;
    let existingScore = -1;

    snapshot.forEach(child => {
      const val = child.val();
      if (val && String(val.name).trim() === String(payload.name).trim()) {
        const valStudentId = String(val.studentId || '').trim();
        if (activeMode === 'dorms' && (valStudentId === 'DORMS' || valStudentId === 'DOREMS' || val.channel === 'dorms' || val.channel === 'dorems')) {
          existingKey = child.key;
          existingScore = parseInt(val.score, 10) || 0;
        } else if (activeMode === 'school' && valStudentId === String(payload.studentId).trim()) {
          existingKey = child.key;
          existingScore = parseInt(val.score, 10) || 0;
        }
      }
    });

    if (existingKey) {
      if (payload.score > existingScore) {
        const confirmUpdate = confirm(`'${payload.name}'님의 기존 등록 점수(${existingScore}점)보다 높은 점수(${payload.score}점)를 달성하셨습니다!\n기존 점수를 갱신하시겠습니까?`);
        if (confirmUpdate) {
          await firebaseDb.ref(`scores/${existingKey}`).update(payload);
          return { success: true, message: `🎉 기존 점수(${existingScore}점)에서 ${payload.score}점으로 최고 점수가 갱신되었습니다!` };
        } else {
          return { success: true, message: `기존 점수(${existingScore}점)가 유지되었습니다.` };
        }
      } else {
        return { success: true, message: `ℹ️ 기존 등록 점수(${existingScore}점)가 현재 점수(${payload.score}점)보다 높거나 같아 갱신되지 않았습니다.` };
      }
    } else {
      await firebaseDb.ref('scores').push(payload);
      return { 
        success: true, 
        message: activeMode === 'school' 
          ? `✅ ${payload.name}(학번: ${payload.studentId})님의 ${payload.score}점 기록이 등록되었습니다!`
          : `✅ ${payload.name}님의 ${payload.score}점 기록이 등록되었습니다!` 
      };
    }
  }

  // ----------------------------------------------------
  // Score Submission Handler with Anti-Tampering & Validation
  // ----------------------------------------------------
  btnSendData.addEventListener('click', async () => {
    // Re-verify & sanitize latest stored player info
    playerName = sanitizeInput(localStorage.getItem(nameStorageKey) || playerName || '', 12);
    if (activeMode === 'school') {
      studentId = sanitizeInput(localStorage.getItem(idStorageKey) || studentId || '', 10);
    }

    // 1. Input Validation
    if (!isValidName(playerName) || (activeMode === 'school' && !isValidStudentId(studentId))) {
      apiStatusMsg.className = 'api-status-msg error';
      apiStatusMsg.textContent = activeMode === 'school' 
        ? '❌ 참가자 정보가 올바르지 않습니다. (이름 1~12자, 학번 1~10자)'
        : '❌ 참가자 닉네임이 올바르지 않습니다. (1~12자)';
      return;
    }

    // 2. Anti-Tampering Verification
    if (typeof totalScore !== 'number' || isNaN(totalScore) || totalScore < 0 || totalScore > 500) {
      apiStatusMsg.className = 'api-status-msg error';
      apiStatusMsg.textContent = '❌ 유효하지 않은 점수 범위입니다.';
      return;
    }

    const calculatedSum = roundHistory.reduce((acc, cur) => acc + cur.score, 0);
    if (roundHistory.length !== maxRounds || calculatedSum !== totalScore) {
      apiStatusMsg.className = 'api-status-msg error';
      apiStatusMsg.textContent = '❌ 라운드 성적 데이터 검증 실패: 점수 변조가 감지되었습니다.';
      return;
    }

    btnSendData.disabled = true;
    apiStatusMsg.className = 'api-status-msg';
    apiStatusMsg.textContent = '⏳ 점수 등록 중...';

    const payload = {
      name: String(playerName).trim(),
      studentId: activeMode === 'dorms' ? 'DORMS' : String(studentId).trim(),
      score: Number(totalScore),
      channel: activeMode,
      timestamp: (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
    };

    if (firebaseDb) {
      try {
        const result = await submitScoreToFirebase(payload);
        apiStatusMsg.className = 'api-status-msg success';
        apiStatusMsg.textContent = result.message;
      } catch (err) {
        console.error("Score submit error:", err);
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = `❌ 점수 등록 중 오류가 발생했습니다 (${err.message || err.code || 'Firebase 오류'}).`;
      } finally {
        btnSendData.disabled = false;
      }
    } else {
      setTimeout(() => {
        apiStatusMsg.className = 'api-status-msg success';
        apiStatusMsg.textContent = activeMode === 'school'
          ? `✅ ${playerName}(학번: ${studentId})님의 ${totalScore}점 기록이 등록되었습니다.`
          : `✅ ${playerName}님의 ${totalScore}점 기록이 등록되었습니다.`;
        btnSendData.disabled = false;
      }, 400);
    }
  });
});
