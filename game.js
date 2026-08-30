/**
 * 팥빙수 똑같이 나눠주기 작전! - Game Engine Logic
 * 
 * Security & Input Validation Enhanced Version
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
    console.error("Initialization failed:", err);
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
  // Game State
  let currentRound = 1;
  const maxRounds = 5;
  let totalScore = 0;
  let roundHistory = [];
  let highScore = parseInt(localStorage.getItem('bingsoo_game_highscore') || '0', 10);
  
  let studentPositions = [];
  let targetPoint = { x: 0, y: 0 };
  let placedPoint = null;
  let isAnswerChecked = false;
  let isDraggingBingsoo = false;
  let popupTimeoutId = null;

  // Locked Player Info (Sanitized)
  let playerName = sanitizeInput(localStorage.getItem('bingsoo_player_name') || '', 12);
  let studentId = sanitizeInput(localStorage.getItem('bingsoo_student_id') || '', 10);

  // DOM Elements
  const gameBoard = document.getElementById('game-board');
  const elementsLayer = document.getElementById('elements-layer');
  const lineCanvas = document.getElementById('line-canvas');
  const ctx = lineCanvas.getContext('2d');

  const playerModal = document.getElementById('player-modal');
  const playerForm = document.getElementById('player-form');
  const inputPlayerName = document.getElementById('input-player-name');
  const inputStudentId = document.getElementById('input-student-id');
  const displayPlayerName = document.getElementById('display-player-name');
  const displayStudentId = document.getElementById('display-student-id');

  const openingChampName = document.getElementById('opening-champ-name');
  const openingChampId = document.getElementById('opening-champ-id');
  const openingChampScore = document.getElementById('opening-champ-score');
  const btnToggleOpeningLeaderboard = document.getElementById('btn-toggle-opening-leaderboard');
  const openingLeaderboardBox = document.getElementById('opening-leaderboard-box');
  const openingLeaderboardTbody = document.getElementById('opening-leaderboard-tbody');

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
  const finalTotalScore = document.getElementById('final-total-score');
  const newRecordBadge = document.getElementById('new-record-badge');
  const roundHistoryList = document.getElementById('round-history-list');
  const btnSendData = document.getElementById('btn-send-data');
  const apiStatusMsg = document.getElementById('api-status-msg');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const btnModalRestart = document.getElementById('btn-modal-restart');

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
    if (playerName && studentId) {
      inputPlayerName.value = playerName;
      inputStudentId.value = studentId;
    }
    playerModal.classList.remove('hidden');
  }

  // Form Submit Handler with Strict Validation
  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawName = inputPlayerName.value;
    const rawId = inputStudentId.value;

    const cleanName = sanitizeInput(rawName, 12);
    const cleanId = sanitizeInput(rawId, 10);

    if (!isValidName(cleanName)) {
      alert('도전자 이름은 1자 이상 12자 이하로 입력해 주세요.');
      return;
    }

    if (!isValidStudentId(cleanId)) {
      alert('학번은 1자 이상 10자 이하의 영문, 숫자, 한글로 입력해 주세요.');
      return;
    }

    playerName = cleanName;
    studentId = cleanId;

    localStorage.setItem('bingsoo_player_name', playerName);
    localStorage.setItem('bingsoo_student_id', studentId);

    updatePlayerInfoDisplay();
    playerModal.classList.add('hidden');
    initGame();
  });

  function updatePlayerInfoDisplay() {
    displayPlayerName.textContent = playerName || '플레이어';
    displayStudentId.textContent = studentId ? `학번: ${studentId}` : '학번: 미입력';
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
    if (isAnswerChecked) {
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
        el.className = 'student-pin';
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
      localStorage.setItem('bingsoo_game_highscore', highScore.toString());
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
  function listenRealtimeLeaderboard() {
    if (!firebaseDb) return;

    firebaseDb.ref('scores').orderByChild('score').limitToLast(20).on('value', (snapshot) => {
      const list = [];
      snapshot.forEach(childSnap => {
        const val = childSnap.val();
        if (val) {
          list.push({
            name: sanitizeInput(val.name, 12),
            studentId: sanitizeInput(val.studentId, 10),
            score: Math.max(0, Math.min(500, parseInt(val.score, 10) || 0))
          });
        }
      });
      list.reverse();

      if (list.length > 0) {
        const champ = list[0];
        if (openingChampName) openingChampName.textContent = champ.name || '김빙수';
        if (openingChampId) openingChampId.textContent = champ.studentId ? `학번: ${champ.studentId}` : '학번: 2105';
        if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
      }

      renderHallOfFame(list);
      renderOpeningHallOfFame(list);
    }, (err) => {
      console.error("Leaderboard read error:", err);
    });
  }

  function renderOpeningHallOfFame(list) {
    if (!openingLeaderboardTbody) return;
    openingLeaderboardTbody.innerHTML = '';

    if (!list || list.length === 0) {
      openingLeaderboardTbody.innerHTML = `<tr><td colspan="4" style="padding:10px; color:#64748b;">등록된 기록이 없습니다.</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      let rankDisplay = `${index + 1}위`;
      if (index === 0) rankDisplay = `🥇 1위`;
      else if (index === 1) rankDisplay = `🥈 2위`;
      else if (index === 2) rankDisplay = `🥉 3위`;

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        <td>${escapeHtml(item.studentId || '미입력')}</td>
        <td><strong>${item.score}점</strong></td>
      `;
      openingLeaderboardTbody.appendChild(tr);
    });
  }

  function renderHallOfFame(list) {
    if (!leaderboardTbody) return;
    leaderboardTbody.innerHTML = '';

    if (!list || list.length === 0) {
      leaderboardTbody.innerHTML = `<tr><td colspan="4" style="padding:15px; color:#64748b;">아직 등록된 기록이 없습니다. 첫 점수를 등록해 보세요!</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');

      const isCurrentPlayer = (item.name === playerName && item.studentId === studentId && item.score === totalScore);
      if (isCurrentPlayer) {
        tr.className = 'current-player-row';
      }

      let rankDisplay = `${index + 1}위`;
      if (index === 0) rankDisplay = `🥇 1위`;
      else if (index === 1) rankDisplay = `🥈 2위`;
      else if (index === 2) rankDisplay = `🥉 3위`;

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        <td>${escapeHtml(item.studentId || '미입력')}</td>
        <td><strong>${item.score}점</strong></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }

  // ----------------------------------------------------
  // Score Submission Handler with Anti-Tampering & Validation
  // ----------------------------------------------------
  btnSendData.addEventListener('click', async () => {
    // 1. Input Validation
    if (!isValidName(playerName) || !isValidStudentId(studentId)) {
      apiStatusMsg.className = 'api-status-msg error';
      apiStatusMsg.textContent = '❌ 참가자 정보가 올바르지 않습니다. (이름 1~12자, 학번 1~10자)';
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

    if (firebaseDb) {
      try {
        const snapshot = await firebaseDb.ref('scores').once('value');
        let existingKey = null;
        let existingScore = -1;

        snapshot.forEach(child => {
          const val = child.val();
          if (val && val.name === playerName && val.studentId === studentId) {
            existingKey = child.key;
            existingScore = val.score;
          }
        });

        if (existingKey) {
          if (totalScore > existingScore) {
            const confirmUpdate = confirm(`'${playerName}'님(${studentId})의 기존 등록 점수(${existingScore}점)보다 높은 점수(${totalScore}점)를 달성하셨습니다!\n기존 점수를 갱신하시겠습니까?`);
            if (confirmUpdate) {
              await firebaseDb.ref('scores/' + existingKey).update({
                score: totalScore,
                timestamp: firebase.database.ServerValue.TIMESTAMP
              });
              apiStatusMsg.className = 'api-status-msg success';
              apiStatusMsg.textContent = `🎉 기존 점수(${existingScore}점)에서 ${totalScore}점으로 최고 점수가 갱신되었습니다!`;
            } else {
              apiStatusMsg.className = 'api-status-msg';
              apiStatusMsg.textContent = `기존 점수(${existingScore}점)가 유지되었습니다.`;
            }
          } else {
            apiStatusMsg.className = 'api-status-msg';
            apiStatusMsg.textContent = `ℹ️ 기존 등록 점수(${existingScore}점)가 현재 점수(${totalScore}점)보다 높거나 같아 갱신되지 않았습니다.`;
          }
        } else {
          await firebaseDb.ref('scores').push({
            name: playerName,
            studentId: studentId,
            score: totalScore,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          apiStatusMsg.className = 'api-status-msg success';
          apiStatusMsg.textContent = `✅ ${playerName}(학번: ${studentId})님의 ${totalScore}점 기록이 등록되었습니다!`;
        }
      } catch (err) {
        console.error("Score submit error:", err);
        apiStatusMsg.className = 'api-status-msg error';
        apiStatusMsg.textContent = '❌ 점수 등록 중 오류가 발생했습니다.';
      } finally {
        btnSendData.disabled = false;
      }
    } else {
      setTimeout(() => {
        apiStatusMsg.className = 'api-status-msg success';
        apiStatusMsg.textContent = `✅ ${playerName}(학번: ${studentId})님의 ${totalScore}점 기록이 등록되었습니다.`;
        btnSendData.disabled = false;
      }, 400);
    }
  });
});
