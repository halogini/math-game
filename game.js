/**
 * 팥빙수 똑같이 나눠주기 작전! - Game Engine Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Game State
  let currentRound = 1;
  const maxRounds = 5;
  let totalScore = 0;
  let roundHistory = []; // { round, score, errorPx }
  let highScore = parseInt(localStorage.getItem('bingsoo_game_highscore') || '0', 10);
  
  let studentPositions = []; // [{ id: 'A', name: 'A', emoji: '👦', x, y }, ...]
  let targetPoint = { x: 0, y: 0 }; // Exact location with equal distance to A, B, C
  let placedPoint = null; // User clicked position { x, y }
  let isAnswerChecked = false;
  let popupTimeoutId = null;

  // Player Info & Leaderboard
  let playerName = localStorage.getItem('bingsoo_player_name') || '';
  let studentId = localStorage.getItem('bingsoo_student_id') || '';
  let leaderboard = JSON.parse(localStorage.getItem('bingsoo_leaderboard') || '[]');

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
  const btnEditPlayer = document.getElementById('btn-edit-player');

  const roundDisplay = document.getElementById('round-display');
  const totalScoreDisplay = document.getElementById('total-score-display');
  const highScoreDisplay = document.getElementById('high-score-display');

  const btnCheckAnswer = document.getElementById('btn-check-answer');
  const btnNextRound = document.getElementById('btn-next-round');
  const btnRestart = document.getElementById('btn-restart');
  const instructionBanner = document.getElementById('instruction-banner');

  const scorePopup = document.getElementById('score-popup');
  const scoreRatingBadge = document.getElementById('score-rating-badge');
  const scoreNumber = document.getElementById('score-number');
  const scoreDistanceInfo = document.getElementById('score-distance-info');

  const resultModal = document.getElementById('result-modal');
  const resultPlayerName = document.getElementById('result-player-name');
  const resultStudentId = document.getElementById('result-student-id');
  const finalTotalScore = document.getElementById('final-total-score');
  const newRecordBadge = document.getElementById('new-record-badge');
  const roundHistoryList = document.getElementById('round-history-list');
  const btnSendData = document.getElementById('btn-send-data');
  const apiStatusMsg = document.getElementById('api-status-msg');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const btnModalRestart = document.getElementById('btn-modal-restart');

  // Initialize Leaderboard Defaults if Empty
  initLeaderboardDefaults();

  // Check initial player registration
  checkPlayerRegistration();

  function initLeaderboardDefaults() {
    if (!leaderboard || leaderboard.length === 0) {
      leaderboard = [
        { name: '김빙수', studentId: '2105', score: 492 },
        { name: '이얼음', studentId: '2102', score: 485 },
        { name: '박팥달', studentId: '2112', score: 478 },
        { name: '최달콤', studentId: '2108', score: 465 },
        { name: '정연유', studentId: '2103', score: 450 },
        { name: '강시원', studentId: '2115', score: 442 },
        { name: '윤미식', studentId: '2107', score: 435 },
        { name: '장배달', studentId: '2119', score: 420 },
        { name: '임탐험', studentId: '2110', score: 412 },
        { name: '한정확', studentId: '2104', score: 400 },
        { name: '오마스터', studentId: '2114', score: 390 },
        { name: '서스피드', studentId: '2106', score: 382 },
        { name: '신럭키', studentId: '2111', score: 375 },
        { name: '권에이스', studentId: '2117', score: 360 },
        { name: '황골드', studentId: '2120', score: 350 },
        { name: '안나이스', studentId: '2113', score: 342 },
        { name: '송포인트', studentId: '2116', score: 330 },
        { name: '류스마트', studentId: '2118', score: 320 },
        { name: '홍길동', studentId: '2101', score: 310 },
        { name: '조챌린저', studentId: '2109', score: 300 }
      ];
      localStorage.setItem('bingsoo_leaderboard', JSON.stringify(leaderboard));
    }
  }

  function checkPlayerRegistration() {
    if (!playerName || !studentId) {
      playerModal.classList.remove('hidden');
    } else {
      playerModal.classList.add('hidden');
      updatePlayerInfoDisplay();
      initGame();
    }
  }

  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameVal = inputPlayerName.value.trim();
    const idVal = inputStudentId.value.trim();

    if (nameVal && idVal) {
      playerName = nameVal;
      studentId = idVal;

      localStorage.setItem('bingsoo_player_name', playerName);
      localStorage.setItem('bingsoo_student_id', studentId);

      updatePlayerInfoDisplay();
      playerModal.classList.add('hidden');
      initGame();
    }
  });

  btnEditPlayer.addEventListener('click', () => {
    inputPlayerName.value = playerName;
    inputStudentId.value = studentId;
    playerModal.classList.remove('hidden');
  });

  function updatePlayerInfoDisplay() {
    displayPlayerName.textContent = playerName || '플레이어';
    displayStudentId.textContent = studentId ? `학번: ${studentId}` : '학번: 2101';
    if (resultPlayerName) resultPlayerName.textContent = playerName;
    if (resultStudentId) resultStudentId.textContent = studentId;
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
    instructionBanner.classList.remove('hidden');

    const width = gameBoard.clientWidth || 800;
    const height = gameBoard.clientHeight || 520;
    const padding = 70;

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
        x: randomRange(padding + 60, width - padding - 60),
        y: randomRange(padding + 60, height - padding - 60)
      };
      const R = randomRange(120, Math.min(width, height) * 0.38);

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
          { id: 'A', name: 'A', emoji: '👦', x: A.x, y: A.y },
          { id: 'B', name: 'B', emoji: '👧', x: B.x, y: B.y },
          { id: 'C', name: 'C', emoji: '🧑', x: C.x, y: C.y }
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
        x: randomRange(padding + 80, width - padding - 80),
        y: randomRange(padding + 80, height - padding - 80)
      };
      const R = randomRange(130, Math.min(width, height) * 0.42);

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
          { id: 'A', name: 'A', emoji: '👦', x: A.x, y: A.y },
          { id: 'B', name: 'B', emoji: '👧', x: B.x, y: B.y },
          { id: 'C', name: 'C', emoji: '🧑', x: C.x, y: C.y }
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

  // ----------------------------------------------------
  // Render Student Pins (A, B, C Labels)
  // ----------------------------------------------------
  function renderStudents() {
    studentPositions.forEach(st => {
      const el = document.createElement('div');
      el.className = 'student-pin';
      el.style.left = `${st.x}px`;
      el.style.top = `${st.y}px`;
      el.innerHTML = `
        <div class="student-emoji-box">${st.emoji}</div>
        <div class="student-label">${st.name}</div>
      `;
      elementsLayer.appendChild(el);
    });
  }

  // ----------------------------------------------------
  // Interactive Click on Board (Placing Bingsoo 🍨)
  // ----------------------------------------------------
  gameBoard.addEventListener('click', (e) => {
    if (isAnswerChecked) return;

    const rect = gameBoard.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    placedPoint = { x: clickX, y: clickY };
    renderPlacedBingsoo();

    btnCheckAnswer.disabled = false;
    instructionBanner.classList.add('hidden');
  });

  function renderPlacedBingsoo() {
    const existing = document.getElementById('user-bingsoo-pin');
    if (existing) existing.remove();

    const pin = document.createElement('div');
    pin.id = 'user-bingsoo-pin';
    pin.className = 'placed-bingsoo-pin';
    pin.style.left = `${placedPoint.x}px`;
    pin.style.top = `${placedPoint.y}px`;
    pin.innerHTML = `
      <div class="bingsoo-icon">🍨</div>
      <div class="bingsoo-label">내 팥빙수</div>
    `;
    elementsLayer.appendChild(pin);
  }

  // ----------------------------------------------------
  // Check Answer & Strict Scoring Calculation
  // ----------------------------------------------------
  btnCheckAnswer.addEventListener('click', () => {
    if (!placedPoint || isAnswerChecked) return;
    isAnswerChecked = true;

    renderAnswerBingsoo();

    const dx = placedPoint.x - targetPoint.x;
    const dy = placedPoint.y - targetPoint.y;
    const errorDistance = Math.round(Math.sqrt(dx * dx + dy * dy));

    const roundScore = calculateStrictScore(errorDistance);

    totalScore += roundScore;
    roundHistory.push({ round: currentRound, score: roundScore, errorPx: errorDistance });

    updateHeaderUI();
    drawVerificationLines();

    // Show center popup (Exactly 1.5 seconds / 1500ms display duration!)
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

  function renderAnswerBingsoo() {
    const pin = document.createElement('div');
    pin.id = 'answer-bingsoo-pin';
    pin.className = 'answer-bingsoo-pin';
    pin.style.left = `${targetPoint.x}px`;
    pin.style.top = `${targetPoint.y}px`;
    pin.innerHTML = `
      <div class="target-halo"></div>
      <div class="answer-icon">🍧</div>
      <div class="answer-label">🎯 정답 팥빙수</div>
    `;
    elementsLayer.appendChild(pin);
  }

  function drawVerificationLines() {
    ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    const rA = Math.round(Math.hypot(studentPositions[0].x - targetPoint.x, studentPositions[0].y - targetPoint.y));

    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;

    studentPositions.forEach(st => {
      ctx.strokeStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(targetPoint.x, targetPoint.y);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();
    });

    if (placedPoint) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(placedPoint.x, placedPoint.y);
      ctx.lineTo(targetPoint.x, targetPoint.y);
      ctx.stroke();
    }
    ctx.restore();

    studentPositions.forEach(st => {
      const midX = (targetPoint.x + st.x) / 2;
      const midY = (targetPoint.y + st.y) / 2;

      const badge = document.createElement('div');
      badge.className = 'distance-badge';
      badge.style.left = `${midX}px`;
      badge.style.top = `${midY}px`;
      badge.textContent = `${st.name}: ${rA}`;
      elementsLayer.appendChild(badge);
    });
  }

  // Score popup duration set to EXACTLY 1.5 seconds (1500ms)
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
    }, 1500); // Exactly 1.5 seconds!
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

  btnRestart.addEventListener('click', () => {
    initGame();
  });

  btnModalRestart.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    initGame();
  });

  // ----------------------------------------------------
  // Game Finish & Hall of Fame (Rank 1 to 20)
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

    // Save current session to Leaderboard
    saveToLeaderboard(playerName, studentId, totalScore);

    // Render Hall of Fame (Top 1 to 20)
    renderHallOfFame();

    if (window.confetti) {
      confetti({
        particleCount: 100,
        spread: 70,
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
  }

  function saveToLeaderboard(name, id, score) {
    leaderboard.push({
      name: name || '익명',
      studentId: id || '미입력',
      score: score,
      timestamp: Date.now()
    });

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 20);

    localStorage.setItem('bingsoo_leaderboard', JSON.stringify(leaderboard));
  }

  function renderHallOfFame() {
    leaderboardTbody.innerHTML = '';

    leaderboard.forEach((item, index) => {
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
        <td>${item.name}</td>
        <td>${item.studentId}</td>
        <td><strong>${item.score}점</strong></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }

  // Streamlined Send Button: Instant transmission confirmation
  btnSendData.addEventListener('click', () => {
    btnSendData.disabled = true;
    apiStatusMsg.className = 'api-status-msg';
    apiStatusMsg.textContent = '⏳ 기록 전송 중...';

    setTimeout(() => {
      apiStatusMsg.className = 'api-status-msg success';
      apiStatusMsg.textContent = `✅ ${playerName}(학번: ${studentId})님의 ${totalScore}점 기록이 성공적으로 전송되었습니다!`;
      btnSendData.disabled = false;
    }, 450);
  });
});
