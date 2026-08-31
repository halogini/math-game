/**
 * 📐 삼각형의 비밀: 합동 판정 작전! - Game Engine
 * 
 * 7th Grade Math - Triangle Congruence (SSS, SAS, ASA) & Counter-Example Debugger
 * HaloMath Arcade Channel Isolated Edition
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

// Security & Sanitization
function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"/]/g, '').trim().slice(0, maxLen);
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

// ----------------------------------------------------
// Web Audio API Synthesizer Sound Engine
// ----------------------------------------------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playMeasure() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playSuccess() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.25, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    });
  }

  playCounterExample() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.35);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}

const sounds = new SoundEngine();

function initCongruenceGame() {
  // Robust Channel Mode Detection (supporting KakaoTalk URL variations)
  let activeMode = HalomathMode.detectActiveMode();

  const highScoreStorageKey = `congruence_highscore_${activeMode}`;

  // Safe LocalStorage helpers for In-App WebViews (e.g. KakaoTalk)
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

  let playerName = sanitizeInput(HalomathProfile.loadName(activeMode), 12);
  if (activeMode === 'dorms' && (!playerName || playerName === '도전자')) {
    playerName = randomDormsNickname();
    HalomathProfile.saveName(activeMode, playerName);
  }
  let studentId = activeMode === 'school' ? sanitizeInput(HalomathProfile.loadStudentId(activeMode), 10) : '';
  let highScore = parseInt(safeGetStorage(highScoreStorageKey, '0'), 10);

  // Hide all Lobby navigation buttons unconditionally in ALL modes
  const btnBackPortal = document.getElementById('btn-back-portal');
  const btnLobbyGameover = document.querySelector('.gameover-actions .btn-secondary');

  if (btnBackPortal) btnBackPortal.style.display = 'none';
  if (btnLobbyGameover) btnLobbyGameover.style.display = 'none';

  // Game State
  const maxRounds = 5;
  let currentRound = 1;
  let totalScore = 0;
  let correctCount = 0;
  let perfectCount = 0;
  let ceCount = 0;
  let roundScores = [0, 0, 0, 0, 0];
  let roundTimeLeft = 60;
  let timerInterval = null;
  let activeTool = 'ruler'; // 'ruler' | 'protractor'

  // Current Round Data
  let triangleLeft = null;
  let triangleRight = null;
  let isTrulyCongruent = true;
  let trueTheorem = 'SSS'; // 'SSS' | 'SAS' | 'ASA'
  let measuredSet = new Set(); // e.g. "L_side_AB", "R_angle_E"
  let userClickSet = new Set(); // Tracks direct user measurements for scoring efficiency
  let hoverTarget = null; // { type: 'side'|'angle', key: 'AB', sideIndex: 0, triangle: 'L'|'R' }
  let successAnimReqId = null;
  let failureAnimReqId = null;
  let savedOriginalLeftPts = null;
  let savedOriginalRightPts = null;

  // Preset Clue State
  let currentPresetType = 'TWO_SIDES'; // 'TWO_SIDES' | 'SIDE_AND_ANGLE' | 'SIDE_AND_TWO_ANGLES'
  let currentPresetCount = 2;
  let presetAngleKeys = [];

  // Design-space triangle points (always generated in 900×420 side-by-side)
  let designLeftPts = null;
  let designRightPts = null;
  let isStackLayout = false;

  // Canvas References
  const canvas = document.getElementById('geometry-canvas');
  const ctx = canvas.getContext('2d');
  const ceCanvas = document.getElementById('ce-canvas');
  const ceCtx = ceCanvas ? ceCanvas.getContext('2d') : null;
  const gameContainerEl = document.querySelector('.game-container');

  // DOM Elements
  const channelBadge = document.getElementById('channel-badge');
  const displayProfileName = document.getElementById('display-profile-name');
  const displayProfileId = document.getElementById('display-profile-id');
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');

  const hudRound = document.getElementById('hud-round');
  const hudScore = document.getElementById('hud-score');
  const hudHighScore = document.getElementById('hud-highscore');
  const hudTimer = document.getElementById('hud-timer');
  const timerBar = document.getElementById('timer-bar');

  const toolRuler = document.getElementById('tool-ruler');
  const toolProtractor = document.getElementById('tool-protractor');
  const btnResetMeasure = document.getElementById('btn-reset-measure');
  const clueCountEl = document.getElementById('clue-count');
  const clueEfficiencyTag = document.getElementById('clue-efficiency-tag');
  const cluesContainer = document.getElementById('clues-tags-container');

  const submitBtns = document.querySelectorAll('.btn-submit-action');
  const btnSSS = document.getElementById('btn-sss');
  const btnSAS = document.getElementById('btn-sas');
  const btnASA = document.getElementById('btn-asa');

  // Modals
  const resultModal = document.getElementById('result-modal');
  const resultHeader = document.getElementById('result-header');
  const resultIcon = document.getElementById('result-icon');
  const resultTitle = document.getElementById('result-title');
  const resultScoreBadge = document.getElementById('result-score-badge');
  const resultSubtitle = document.getElementById('result-subtitle');
  const counterExampleBox = document.getElementById('counter-example-box');
  const ceExplanation = document.getElementById('ce-explanation');
  const mathNoteText = document.getElementById('math-note-text');
  const btnNextRound = document.getElementById('btn-next-round');

  const btnViewInitial = document.getElementById('btn-view-initial');
  const btnViewCounter = document.getElementById('btn-view-counter');
  let activeResultView = 'counter'; // 'initial' or 'counter'
  let lastJudgmentResult = 'SUCCESS'; // 'SUCCESS' | 'OPTIMAL' | 'WARNING' | 'FAILURE'
  let lastFailureArgs = null;

  if (btnViewInitial) {
    btnViewInitial.addEventListener('click', () => {
      activeResultView = 'initial';
      activeTool = null;
      if (toolRuler) toolRuler.classList.remove('active');
      if (toolProtractor) toolProtractor.classList.remove('active');
      btnViewInitial.classList.add('active');
      if (btnViewCounter) btnViewCounter.classList.remove('active');

      if (failureAnimReqId) cancelAnimationFrame(failureAnimReqId);
      if (successAnimReqId) cancelAnimationFrame(successAnimReqId);
      failureAnimReqId = null;
      successAnimReqId = null;

      if (savedOriginalLeftPts && triangleLeft) {
        triangleLeft.pts = savedOriginalLeftPts.map(p => ({ x: p.x, y: p.y }));
      }
      if (savedOriginalRightPts && triangleRight) {
        triangleRight.pts = savedOriginalRightPts.map(p => ({ x: p.x, y: p.y }));
      }

      renderCanvas();
    });
  }
  if (btnViewCounter) {
    btnViewCounter.addEventListener('click', () => {
      activeResultView = 'counter';
      activeTool = null;
      if (toolRuler) toolRuler.classList.remove('active');
      if (toolProtractor) toolProtractor.classList.remove('active');
      btnViewCounter.classList.add('active');
      if (btnViewInitial) btnViewInitial.classList.remove('active');

      if (lastJudgmentResult === 'SUCCESS' || lastJudgmentResult === 'OPTIMAL' || lastJudgmentResult === 'WARNING') {
        playSuccessAnimation();
      } else if (lastJudgmentResult === 'FAILURE' && lastFailureArgs) {
        playFailureAnimation(
          lastFailureArgs.ceType,
          lastFailureArgs.msg,
          lastFailureArgs.sideKnownL,
          lastFailureArgs.angleKnownL,
          lastFailureArgs.sideKnownR,
          lastFailureArgs.angleKnownR
        );
      }
    });
  }

  const gameoverModal = document.getElementById('gameover-modal');
  const finalTotalScore = document.getElementById('final-total-score');
  const finalCorrectCount = document.getElementById('final-correct-count');
  const finalPerfectCount = document.getElementById('final-perfect-count');
  const finalCeCount = document.getElementById('final-ce-count');
  const newHighscoreBanner = document.getElementById('new-highscore-banner');
  const btnRestartGame = document.getElementById('btn-restart-game');

  const profileModal = document.getElementById('profile-modal');
  const profileForm = document.getElementById('profile-form');
  const inputPlayerName = document.getElementById('input-player-name');
  const inputStudentId = document.getElementById('input-student-id');
  const studentIdGroup = document.getElementById('student-id-group');

  // Init UI Branding
  if (channelBadge) {
    channelBadge.style.display = 'none';
  }

  updateProfileDisplay();
  if (hudHighScore) hudHighScore.textContent = `${highScore}점`;

  // Sound Toggle Listener
  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      sounds.muted = !sounds.muted;
      btnSoundToggle.textContent = sounds.muted ? '🔇' : '🔊';
    });
  }

  // Tool Switching
  if (toolRuler) toolRuler.addEventListener('click', () => setTool('ruler'));
  if (toolProtractor) toolProtractor.addEventListener('click', () => setTool('protractor'));

  function setTool(tool) {
    activeTool = tool;
    if (tool === 'ruler') {
      toolRuler.classList.add('active');
      toolProtractor.classList.remove('active');
    } else {
      toolProtractor.classList.add('active');
      toolRuler.classList.remove('active');
    }
  }

  if (btnResetMeasure) {
    btnResetMeasure.addEventListener('click', () => {
      measuredSet.clear();
      updateCluesUI();
      renderCanvas();
    });
  }

  function applyProfileModeUi() {
    const profileLead = document.getElementById('profile-lead');
    const labelPlayerName = document.getElementById('label-player-name');
    const nameColThs = document.querySelectorAll('.leaderboard-table thead th:nth-child(2)');

    if (activeMode === 'dorms') {
      document.body.classList.add('mode-dorms');
      if (labelPlayerName) labelPlayerName.textContent = '닉네임:';
      if (studentIdGroup) studentIdGroup.style.display = 'none';
      document.querySelectorAll('.th-student-id').forEach((el) => { el.style.display = 'none'; });
      const champId = document.getElementById('opening-champ-id');
      if (champId) champId.style.display = 'none';
      const resultIdSpan = document.getElementById('result-locked-id-span');
      if (resultIdSpan) resultIdSpan.style.display = 'none';
      if (displayProfileId) displayProfileId.style.display = 'none';
      if (inputStudentId) {
        inputStudentId.removeAttribute('required');
        inputStudentId.disabled = true;
        inputStudentId.value = '';
      }
      if (profileLead) profileLead.textContent = '랭킹에 올릴 닉네임을 입력해야 시작할 수 있습니다.';
      nameColThs.forEach((el) => { el.textContent = '닉네임'; });
    } else {
      if (labelPlayerName) labelPlayerName.textContent = '이름:';
      if (inputPlayerName) inputPlayerName.placeholder = '예: 홍길동';
      if (profileLead) profileLead.textContent = '이름과 학번을 입력해야 시작할 수 있습니다.';
      nameColThs.forEach((el) => { el.textContent = '이름'; });
    }
  }

  function nameFieldLabel() {
    return activeMode === 'dorms' ? '닉네임' : '이름';
  }

  function fillNicknameInput() {
    const nameEl = document.getElementById('input-player-name');
    if (!nameEl) return;
    if (activeMode === 'dorms') {
      if (!playerName || playerName === '도전자') {
        playerName = randomDormsNickname();
        HalomathProfile.saveName(activeMode, playerName);
      }
      nameEl.placeholder = '닉네임';
      nameEl.value = playerName;
      nameEl.setAttribute('required', '');
    } else {
      nameEl.placeholder = '예: 홍길동';
      nameEl.value = playerName || '';
    }
    if (inputStudentId && activeMode === 'school') inputStudentId.value = studentId;
  }

  applyProfileModeUi();
  fillNicknameInput();

  let isTimerPaused = true;

  // Wire start button BEFORE initGame — if round setup throws, the opening
  // modal must still respond (otherwise the whole UI looks frozen).
  function handleStartGame(e) {
    if (e) e.preventDefault();
    const modalEl = document.getElementById('profile-modal');
    const nameInput = document.getElementById('input-player-name');
    const idInput = document.getElementById('input-student-id');

    const errEl = document.getElementById('profile-err');
    const setErr = (t) => { if (errEl) errEl.textContent = t || ''; };

    let cleanName = sanitizeInput(nameInput ? nameInput.value : '', 12);
    if (!cleanName) {
      setErr(`${nameFieldLabel()}을 입력해야 시작할 수 있습니다.`);
      if (nameInput) nameInput.focus();
      return;
    }
    setErr('');

    if (activeMode === 'school' && idInput) {
      let cleanId = sanitizeInput(idInput.value, 10);
      if (!HalomathProfile.isValidStudentId(cleanId)) {
        setErr('학번을 1~10자 영문·숫자·한글로 입력해 주세요.');
        if (idInput) idInput.focus();
        return;
      }
      studentId = cleanId;
      HalomathProfile.saveStudentId(activeMode, studentId);
    }

    playerName = cleanName;
    HalomathProfile.saveName(activeMode, playerName);

    updateProfileDisplay();

    if (modalEl) {
      modalEl.classList.add('hidden');
      modalEl.style.display = 'none';
      modalEl.style.visibility = 'hidden';
      modalEl.style.pointerEvents = 'none';
    }
    isTimerPaused = false;
  }

  window.__startGame = handleStartGame;
  if (profileForm) profileForm.onsubmit = handleStartGame;
  const btnStartGameEarly = document.getElementById('btn-start-game');
  if (btnStartGameEarly) btnStartGameEarly.onclick = handleStartGame;

  // Always show Opening Modal on page load & pre-render Round 1 Triangles
  try {
    initGame();
  } catch (err) {
    console.error('initGame failed:', err);
  }
  try {
    fetchLeaderboard();
  } catch (err) {
    console.error('fetchLeaderboard failed:', err);
  }
  if (profileModal) profileModal.classList.remove('hidden');

  function initGame() {
    currentRound = 1;
    totalScore = 0;
    correctCount = 0;
    perfectCount = 0;
    ceCount = 0;
    roundScores = [0, 0, 0, 0, 0];
    hudScore.textContent = '0점';
    fetchLeaderboard();
    startRound(currentRound);
  }

  // ----------------------------------------------------
  // Round Generation & Math Calculations
  // ----------------------------------------------------
  function startRound(roundNum) {
    if (successAnimReqId) { cancelAnimationFrame(successAnimReqId); successAnimReqId = null; }
    if (failureAnimReqId) { cancelAnimationFrame(failureAnimReqId); failureAnimReqId = null; }
    setUiPhase('play');

    hudRound.textContent = `${roundNum} / ${maxRounds}`;
    measuredSet.clear();
    userClickSet.clear();
    hoverTarget = null; // Clear any stale hover/selection highlight left over from the previous round
    uncheckRadios();

    // Re-enable measurement tools & submit buttons for active round play
    if (btnSSS) btnSSS.disabled = false;
    if (btnSAS) btnSAS.disabled = false;
    if (btnASA) btnASA.disabled = false;

    const floatingToolPalette = document.querySelector('.floating-tool-palette');
    if (floatingToolPalette) {
      floatingToolPalette.style.opacity = '1.0';
      floatingToolPalette.style.pointerEvents = 'auto';
    }
    setTool('ruler');

    // Generate Triangle Data based on Round Preset
    generateRoundData(roundNum);

    // Update Clues UI with preset starting hints
    updateCluesUI();

    // Reset Timer (60s countdown)
    roundTimeLeft = 60;
    updateTimerUI();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isTimerPaused) return;
      if (roundTimeLeft > 0) {
        roundTimeLeft--;
        updateTimerUI();
      }
    }, 1000);

    renderCanvas();
  }

  function uncheckRadios() {
    // getElementsByName returns HTMLCollection (no forEach) — use a plain loop
    const radios = document.getElementsByName('congruence-cond');
    for (let i = 0; i < radios.length; i++) {
      radios[i].checked = false;
    }
  }

  function updateTimerUI() {
    if (hudTimer) hudTimer.textContent = `${roundTimeLeft}s`;
    if (timerBar) {
      const pct = Math.max(0, (roundTimeLeft / 60) * 100);
      timerBar.style.width = `${pct}%`;
      if (pct < 30) {
        timerBar.classList.add('warning');
      } else {
        timerBar.classList.remove('warning');
      }
    }
  }

  // ----------------------------------------------------
  // Triangle Data Generator
  // ----------------------------------------------------
  function generateRoundData(round) {
    // Left Triangle Bounding Box: Center (240, 220)
    // Right Triangle Bounding Box: Center (660, 220)
    
    // Preset Rules:
    // Round 1: Congruent (SSS focus)
    // Round 2: Congruent (SAS focus)
    // Round 3: Congruent (ASA focus)
    // Round 4: NON-Congruent (One side length modified)
    // Round 5: Congruent (Rotated & Mirrored, challenging SSS/SAS/ASA)

    isTrulyCongruent = true;

    // Base Triangle Parameters: Base = b, Side2 = a, Angle between = C
    const b = 125 + Math.floor(Math.random() * 35); // 125~160 px
    const a = 115 + Math.floor(Math.random() * 35); // 115~150 px
    const angleC_deg = 40 + Math.floor(Math.random() * 55); // 40~95 deg
    const radC = (angleC_deg * Math.PI) / 180;

    // Compute 3rd side c and angles A, B
    const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(radC));
    const angleA_deg = (Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180) / Math.PI;
    const angleB_deg = 180 - angleC_deg - angleA_deg;

    // Scale Factor for cm display (25px = 1cm)
    const pxPerCm = 25;

    // Helper to center and clamp points inside bounding box
    function centerAndFitPts(rawPts, center, minX, maxX, minY, maxY) {
      const cx = (rawPts[0].x + rawPts[1].x + rawPts[2].x) / 3;
      const cy = (rawPts[0].y + rawPts[1].y + rawPts[2].y) / 3;
      let dx = center.x - cx;
      let dy = center.y - cy;
      let shifted = rawPts.map(p => ({ x: p.x + dx, y: p.y + dy }));

      let clampX = 0, clampY = 0;
      shifted.forEach(p => {
        if (p.x < minX) clampX = Math.max(clampX, minX - p.x);
        if (p.x > maxX) clampX = Math.min(clampX, maxX - p.x);
        if (p.y < minY) clampY = Math.max(clampY, minY - p.y);
        if (p.y > maxY) clampY = Math.min(clampY, maxY - p.y);
      });
      return shifted.map(p => ({ x: p.x + clampX, y: p.y + clampY }));
    }

    // Unrotated Left Triangle Vertices (A, B, C)
    const pC_L_raw = { x: 0, y: 0 };
    const pA_L_raw = { x: b, y: 0 };
    const pB_L_raw = { x: a * Math.cos(radC), y: -a * Math.sin(radC) };
    const ptsL_fitted = centerAndFitPts([pA_L_raw, pB_L_raw, pC_L_raw], { x: 225, y: 190 }, 40, 410, 50, 310);

    triangleLeft = {
      labels: ['A', 'B', 'C'],
      pts: ptsL_fitted,
      sidesCm: [
        parseFloat((c / pxPerCm).toFixed(1)), // AB (side 0)
        parseFloat((a / pxPerCm).toFixed(1)), // BC (side 1)
        parseFloat((b / pxPerCm).toFixed(1))  // CA (side 2)
      ],
      anglesDeg: [
        Math.round(angleA_deg),
        Math.round(angleB_deg),
        Math.round(angleC_deg)
      ]
    };

    // Right Triangle Vertices (D, E, F) with random 360-degree rotation
    const rot = Math.random() * Math.PI * 2;
    const pF_R_raw = { x: 0, y: 0 };
    const pD_R_raw = { x: b, y: 0 };
    const pE_R_raw = { x: a * Math.cos(radC), y: -a * Math.sin(radC) };

    const rawRightPts = [pD_R_raw, pE_R_raw, pF_R_raw];
    const rotatedRightPts = rawRightPts.map(pt => ({
      x: pt.x * Math.cos(rot) - pt.y * Math.sin(rot),
      y: pt.x * Math.sin(rot) + pt.y * Math.cos(rot)
    }));

    const ptsR_fitted = centerAndFitPts(rotatedRightPts, { x: 675, y: 190 }, 490, 860, 50, 310);

    triangleRight = {
      labels: ['D', 'E', 'F'],
      pts: ptsR_fitted,
      sidesCm: [
        parseFloat((c / pxPerCm).toFixed(1)), // DE (side 0)
        parseFloat((a / pxPerCm).toFixed(1)), // EF (side 1)
        parseFloat((b / pxPerCm).toFixed(1))  // FD (side 2)
      ],
      anglesDeg: [
        Math.round(angleA_deg),
        Math.round(angleB_deg),
        Math.round(angleC_deg)
      ]
    };

    designLeftPts = triangleLeft.pts.map(p => ({ x: p.x, y: p.y }));
    designRightPts = triangleRight.pts.map(p => ({ x: p.x, y: p.y }));
    applyCanvasLayout(true);

    // Fully randomized starting preset clues (Random target triangle & random element combinations!)
    presetAngleKeys = [];
    measuredSet.clear();

    const targetTriTag = Math.random() < 0.6 ? 'R' : 'L'; // 60% Right, 40% Left
    const sideList = targetTriTag === 'R' ? ['DE', 'EF', 'FD'] : ['AB', 'BC', 'CA'];
    const angleList = targetTriTag === 'R' ? ['D', 'E', 'F'] : ['A', 'B', 'C'];

    // Preset types progressive pool:
    // Round 1-2: TWO_SIDES or SIDE_AND_ANGLE
    // Round 3-4: SIDE_AND_ANGLE or TWO_SIDES
    // Round 5: SIDE_AND_TWO_ANGLES
    let presetType = 'TWO_SIDES';
    if (round === 1 || round === 2) {
      presetType = Math.random() < 0.5 ? 'TWO_SIDES' : 'SIDE_AND_ANGLE';
    } else if (round === 3 || round === 4) {
      presetType = Math.random() < 0.5 ? 'SIDE_AND_ANGLE' : 'TWO_SIDES';
    } else {
      presetType = 'SIDE_AND_TWO_ANGLES';
    }

    currentPresetType = presetType;

    if (presetType === 'TWO_SIDES') {
      currentPresetCount = 2;
      const shuffled = [...sideList].sort(() => Math.random() - 0.5);
      measuredSet.add(`${targetTriTag}_side_${shuffled[0]}`);
      measuredSet.add(`${targetTriTag}_side_${shuffled[1]}`);
    } else if (presetType === 'SIDE_AND_ANGLE') {
      // 변 + 그 변의 끝점 각만 (대변·대각 조합 금지)
      currentPresetCount = 2;
      const sideIdx = Math.floor(Math.random() * 3);
      const adjAngleIdx = Math.random() < 0.5 ? sideIdx : (sideIdx + 1) % 3;
      measuredSet.add(`${targetTriTag}_side_${sideList[sideIdx]}`);
      measuredSet.add(`${targetTriTag}_angle_${angleList[adjAngleIdx]}`);
      presetAngleKeys.push(`${targetTriTag}_angle_${angleList[adjAngleIdx]}`);
    } else {
      // 진짜 ASA: 두 각과 그 끼인변
      currentPresetCount = 3;
      const sideIdx = Math.floor(Math.random() * 3);
      const a1 = sideIdx;
      const a2 = (sideIdx + 1) % 3;
      measuredSet.add(`${targetTriTag}_side_${sideList[sideIdx]}`);
      measuredSet.add(`${targetTriTag}_angle_${angleList[a1]}`);
      measuredSet.add(`${targetTriTag}_angle_${angleList[a2]}`);
      presetAngleKeys.push(`${targetTriTag}_angle_${angleList[a1]}`, `${targetTriTag}_angle_${angleList[a2]}`);
    }
  }

  // ----------------------------------------------------
  // Canvas Layout (side-by-side desktop / stacked mobile)
  // ----------------------------------------------------
  function shouldStackLayout() {
    return window.innerWidth <= 700 && window.innerHeight >= window.innerWidth;
  }

  function ptsCentroid(pts) {
    return {
      x: (pts[0].x + pts[1].x + pts[2].x) / 3,
      y: (pts[0].y + pts[1].y + pts[2].y) / 3
    };
  }

  function mapPtsToCenter(pts, toCenter, scale) {
    const c = ptsCentroid(pts);
    return pts.map(p => ({
      x: toCenter.x + (p.x - c.x) * scale,
      y: toCenter.y + (p.y - c.y) * scale
    }));
  }

  function setUiPhase(phase) {
    // phase: 'play' | 'animating' | 'modal'
    if (gameContainerEl) {
      gameContainerEl.classList.toggle('is-animating', phase === 'animating');
      gameContainerEl.classList.toggle('modal-open', phase === 'modal');
    }
    document.body.classList.toggle('modal-open', phase === 'modal');
  }

  function applyCanvasLayout(force) {
    const stack = shouldStackLayout();
    if (!force && stack === isStackLayout) return;

    // Don't tear down in-flight / result-screen triangle poses
    if (successAnimReqId || failureAnimReqId) return;
    if (resultModal && !resultModal.classList.contains('hidden')) return;

    isStackLayout = stack;
    if (gameContainerEl) gameContainerEl.classList.toggle('is-stack-layout', stack);

    if (stack) {
      canvas.width = 420;
      canvas.height = 720;
    } else {
      canvas.width = 900;
      canvas.height = 420;
    }

    if (!designLeftPts || !designRightPts || !triangleLeft || !triangleRight) {
      renderCanvas();
      return;
    }

    if (stack) {
      triangleLeft.pts = mapPtsToCenter(designLeftPts, { x: 210, y: 175 }, 0.92);
      triangleRight.pts = mapPtsToCenter(designRightPts, { x: 210, y: 505 }, 0.92);
    } else {
      triangleLeft.pts = designLeftPts.map(p => ({ x: p.x, y: p.y }));
      triangleRight.pts = designRightPts.map(p => ({ x: p.x, y: p.y }));
    }
    savedOriginalLeftPts = triangleLeft.pts.map(p => ({ x: p.x, y: p.y }));
    savedOriginalRightPts = triangleRight.pts.map(p => ({ x: p.x, y: p.y }));
    renderCanvas();
  }

  let layoutResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(layoutResizeTimer);
    layoutResizeTimer = setTimeout(() => applyCanvasLayout(false), 120);
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => applyCanvasLayout(true), 200);
  });

  // ----------------------------------------------------
  // Canvas Rendering & Tool Interactivity
  // ----------------------------------------------------
  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Dividers & Titles
    ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.font = isStackLayout ? 'bold 15px Jua' : 'bold 16px Jua';
    if (isStackLayout) {
      ctx.fillText('🔺 삼각형 △ABC', 24, 28);
      ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
      ctx.fillText('🔻 삼각형 △DEF', 24, 368);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath(); ctx.moveTo(24, 350); ctx.lineTo(canvas.width - 24, 350); ctx.stroke();
    } else {
      ctx.fillText('🔺 삼각형 △ABC', 50, 32);
      ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
      ctx.fillText('🔻 삼각형 △DEF', 490, 32);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath(); ctx.moveTo(450, 20); ctx.lineTo(450, 400); ctx.stroke();
    }

    // Draw Triangles
    const prevLeftPts = triangleLeft ? triangleLeft.pts : null;
    const prevRightPts = triangleRight ? triangleRight.pts : null;

    if (activeResultView === 'initial' && savedOriginalLeftPts && savedOriginalRightPts && triangleLeft && triangleRight) {
      triangleLeft.pts = savedOriginalLeftPts;
      triangleRight.pts = savedOriginalRightPts;
    }

    drawSingleTriangle(triangleLeft, 'L');
    drawSingleTriangle(triangleRight, 'R');

    if (prevLeftPts && prevRightPts && triangleLeft && triangleRight) {
      triangleLeft.pts = prevLeftPts;
      triangleRight.pts = prevRightPts;
    }

    // Draw Tool Hover Overlay
    if (hoverTarget && (!resultModal || resultModal.classList.contains('hidden'))) {
      drawHoverOverlay(hoverTarget);
    }
  }

  function getOutwardNormal(p1, p2, centroid) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const toMidX = midX - centroid.x;
    const toMidY = midY - centroid.y;

    if (nx * toMidX + ny * toMidY < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  }

  function drawSingleTriangle(tri, sideTag) {
    if (!tri) return;
    const isLeft = sideTag === 'L';
    const mainColor = isLeft ? '#06b6d4' : '#ec4899';
    const glowColor = isLeft ? 'rgba(6, 182, 212, 0.3)' : 'rgba(236, 72, 153, 0.3)';

    const centroid = {
      x: (tri.pts[0].x + tri.pts[1].x + tri.pts[2].x) / 3,
      y: (tri.pts[0].y + tri.pts[1].y + tri.pts[2].y) / 3
    };

    // Fill Triangle Body
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.moveTo(tri.pts[0].x, tri.pts[0].y);
    ctx.lineTo(tri.pts[1].x, tri.pts[1].y);
    ctx.lineTo(tri.pts[2].x, tri.pts[2].y);
    ctx.closePath();
    ctx.fill();

    // Draw Edges & Measured Highlights
    const sideNames = isLeft ? ['AB', 'BC', 'CA'] : ['DE', 'EF', 'FD'];
    for (let i = 0; i < 3; i++) {
      const p1 = tri.pts[i];
      const p2 = tri.pts[(i + 1) % 3];
      const key = `${sideTag}_side_${sideNames[i]}`;
      const isMeasured = measuredSet.has(key);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      if (isMeasured) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 4;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Side Length Label if Measured (Pushed Outward 32px away from centroid)
      if (isMeasured) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const norm = getOutwardNormal(p1, p2, centroid);
        const badgeX = midX + norm.x * 32;
        const badgeY = midY + norm.y * 32;
        const pxLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const pxPerCm = 25;
        const liveCm = (pxLen / pxPerCm).toFixed(1);
        const labelText = failureAnimReqId
          ? `${sideNames[i]} = ${liveCm}`
          : `${sideNames[i]} = ${tri.sidesCm[i]}`;
        drawBadge(badgeX, badgeY, labelText, '#f59e0b', true, sideNames[i]);
      }
    }

    // Draw Angles & Vertices
    const angleNames = isLeft ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    for (let i = 0; i < 3; i++) {
      const pt = tri.pts[i];
      const prevPt = tri.pts[(i + 2) % 3];
      const nextPt = tri.pts[(i + 1) % 3];
      const key = `${sideTag}_angle_${angleNames[i]}`;
      const isMeasured = measuredSet.has(key);

      // Vertex Point
      ctx.fillStyle = isMeasured ? '#8b5cf6' : mainColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Vertex Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Outfit';
      const offset = getVertexLabelOffset(pt, prevPt, nextPt);
      ctx.fillText(tri.labels[i], pt.x + offset.x, pt.y + offset.y);

      // Draw Angle Arc if Measured
      if (isMeasured) {
        let angLabel = tri.anglesDeg[i];
        if (failureAnimReqId) {
          const v1x = prevPt.x - pt.x, v1y = prevPt.y - pt.y;
          const v2x = nextPt.x - pt.x, v2y = nextPt.y - pt.y;
          const d1 = Math.hypot(v1x, v1y) || 1;
          const d2 = Math.hypot(v2x, v2y) || 1;
          const cosA = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (d1 * d2)));
          angLabel = Math.round((Math.acos(cosA) * 180) / Math.PI);
        }
        drawAngleArc(pt, prevPt, nextPt, `∠${angleNames[i]} = ${angLabel}°`, '#8b5cf6', centroid);
      }
    }
  }

  function drawHoverOverlay(target) {
    const tri = target.triangle === 'L' ? triangleLeft : triangleRight;
    const color = activeTool === 'ruler' ? '#f59e0b' : '#8b5cf6';

    if (target.type === 'side') {
      const p1 = tri.pts[target.sideIndex];
      const p2 = tri.pts[(target.sideIndex + 1) % 3];

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tool Icon floating
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.font = '16px sans-serif';
      ctx.fillText('📏 (클릭하여 측정)', midX - 45, midY - 12);
    } else if (target.type === 'angle') {
      const pt = tri.pts[target.angleIndex];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = '16px sans-serif';
      ctx.fillText('📐 (클릭하여 측정)', pt.x - 45, pt.y - 14);
    }
  }

  function getVertexLabelOffset(pt, prevPt, nextPt) {
    const v1 = { x: prevPt.x - pt.x, y: prevPt.y - pt.y };
    const v2 = { x: nextPt.x - pt.x, y: nextPt.y - pt.y };
    const bisectX = -(v1.x + v2.x);
    const bisectY = -(v1.y + v2.y);
    const len = Math.sqrt(bisectX * bisectX + bisectY * bisectY) || 1;
    return { x: (bisectX / len) * 18 - 4, y: (bisectY / len) * 18 + 5 };
  }

  function drawBadge(x, y, text, color, isSegment = false, segName = '') {
    ctx.font = 'bold 13px Pretendard';
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x - textWidth / 2 - 8, y - 12, textWidth + 16, 24, 6);
    } else {
      ctx.rect(x - textWidth / 2 - 8, y - 12, textWidth + 16, 24);
    }
    ctx.fill();
    ctx.stroke();

    const startX = x - textWidth / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, startX, y + 5);

    // Draw a crisp continuous horizontal overline above segment name (e.g. DE)
    if (isSegment && segName) {
      const segWidth = ctx.measureText(segName).width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, y - 9);
      ctx.lineTo(startX + segWidth, y - 9);
      ctx.stroke();
    }
  }

  function drawAngleArc(pt, prevPt, nextPt, text, color, centroid) {
    let angle1 = Math.atan2(prevPt.y - pt.y, prevPt.x - pt.x);
    let angle2 = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);

    let diff = angle2 - angle1;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < 0) {
      const tmp = angle1;
      angle1 = angle2;
      angle2 = tmp;
    }

    const arcRadius = 28;

    // 1. Sector Fill
    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.arc(pt.x, pt.y, arcRadius, angle1, angle2);
    ctx.closePath();
    ctx.fill();

    // 2. Arc Stroke with Glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, arcRadius, angle1, angle2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Outward Bisector Badge Placement (Pushed 52px Away)
    const midAngle = (angle1 + angle2) / 2;
    let dirX = Math.cos(midAngle);
    let dirY = Math.sin(midAngle);

    const toPtX = pt.x - centroid.x;
    const toPtY = pt.y - centroid.y;
    if (dirX * toPtX + dirY * toPtY < 0) {
      dirX = -dirX;
      dirY = -dirY;
    }

    const badgeX = pt.x + dirX * 52;
    const badgeY = pt.y + dirY * 52;
    drawBadge(badgeX, badgeY, text, color);
  }

  // Canvas Interactivity (Pointer Events unify mouse / touch / pen so taps on
  // tablets & phones behave identically to mouse clicks, instead of relying on
  // 'mousemove' + 'click', which touch browsers only emit as synthetic,
  // unreliable events and never emit a true "hover" for).
  canvas.style.touchAction = 'none'; // Prevent the page from scrolling/zooming while measuring

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * (canvas.width / rect.width),
      my: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function getTargetKey(target) {
    if (target.type === 'side') {
      const sideNames = target.triangle === 'L' ? ['AB', 'BC', 'CA'] : ['DE', 'EF', 'FD'];
      return `${target.triangle}_side_${sideNames[target.sideIndex]}`;
    } else if (target.type === 'angle') {
      const angleNames = target.triangle === 'L' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
      return `${target.triangle}_angle_${angleNames[target.angleIndex]}`;
    }
    return null;
  }

  function selectTargetAt(mx, my) {
    const target = findTargetAt(mx, my);
    if (target) {
      const key = getTargetKey(target);
      if (key && !measuredSet.has(key)) {
        measuredSet.add(key);
        userClickSet.add(key);
        sounds.playMeasure();
      }

      updateCluesUI();
    }
    return target;
  }

  canvas.addEventListener('pointermove', (e) => {
    // Only show a "hover" preview for real mouse/pen input; touch has no hover concept,
    // so we skip this and just resolve the tap directly on pointerdown instead.
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const { mx, my } = getCanvasCoords(e);
      hoverTarget = findTargetAt(mx, my);
      renderCanvas();
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hoverTarget = null;
    renderCanvas();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const { mx, my } = getCanvasCoords(e);
    if (e.pointerType === 'touch') {
      // Touch: resolve and clear immediately so nothing stays visually "stuck highlighted"
      // once the finger lifts and the player moves on (e.g. taps "다음 라운드").
      selectTargetAt(mx, my);
      hoverTarget = null;
    } else {
      hoverTarget = findTargetAt(mx, my);
      selectTargetAt(mx, my);
    }
    renderCanvas();
  });

  function findTargetAt(mx, my) {
    if (resultModal && !resultModal.classList.contains('hidden')) return null;
    // Check Triangle Left
    const targetL = checkTriangleTarget(triangleLeft, 'L', mx, my);
    if (targetL) return targetL;
    // Check Triangle Right
    return checkTriangleTarget(triangleRight, 'R', mx, my);
  }

  function checkTriangleTarget(tri, sideTag, mx, my) {
    if (!tri) return null;

    const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const angleRadius = isTouch ? 36 : 28;
    const sideRadius = isTouch ? 26 : 18;

    // Check Angles (Vertices) first
    for (let i = 0; i < 3; i++) {
      const pt = tri.pts[i];
      const dist = Math.hypot(mx - pt.x, my - pt.y);
      if (dist < angleRadius && activeTool === 'protractor') {
        const angleNames = sideTag === 'L' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
        const key = `${sideTag}_angle_${angleNames[i]}`;
        if (measuredSet.has(key)) continue; // Already measured, ignore hover
        return { type: 'angle', triangle: sideTag, angleIndex: i };
      }
    }

    // Check Sides
    for (let i = 0; i < 3; i++) {
      const p1 = tri.pts[i];
      const p2 = tri.pts[(i + 1) % 3];
      const dist = distToSegment({ x: mx, y: my }, p1, p2);
      if (dist < sideRadius && activeTool === 'ruler') {
        const sideNames = sideTag === 'L' ? ['AB', 'BC', 'CA'] : ['DE', 'EF', 'FD'];
        const key = `${sideTag}_side_${sideNames[i]}`;
        if (measuredSet.has(key)) continue; // Already measured, ignore hover
        return { type: 'side', triangle: sideTag, sideIndex: i };
      }
    }

    return null;
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // ----------------------------------------------------
  // Clues UI Update
  // ----------------------------------------------------
  function updateCluesUI() {
    const count = measuredSet.size;
    clueCountEl.textContent = count;

    cluesContainer.innerHTML = '';

    if (count === 0) {
      cluesContainer.innerHTML = `<span class="clue-empty-msg">변이나 각을 클릭하여 치수를 측정하세요!</span>`;
      if (clueEfficiencyTag) clueEfficiencyTag.style.display = 'none';
      return;
    }

    if (clueEfficiencyTag) clueEfficiencyTag.style.display = 'none';

    measuredSet.forEach(key => {
      const parts = key.split('_'); // e.g. ["L", "side", "AB"]
      const isAngle = parts[1] === 'angle';
      const icon = isAngle ? '📐' : '📏';
      const labelHtml = isAngle
        ? `${icon} ∠${parts[2]}`
        : `${icon} <span style="text-decoration: overline; border-top: 1.5px solid currentColor; padding-top: 1px;">${parts[2]}</span>`;
      const tagSpan = document.createElement('span');
      tagSpan.className = `clue-tag ${isAngle ? 'angle-tag' : ''}`;
      tagSpan.innerHTML = labelHtml;
      cluesContainer.appendChild(tagSpan);
    });
  }

  // Judgment Submission & Scoring Logic
  // ----------------------------------------------------
  if (btnSSS) btnSSS.addEventListener('click', () => evaluateDecision('SSS'));
  if (btnSAS) btnSAS.addEventListener('click', () => evaluateDecision('SAS'));
  if (btnASA) btnASA.addEventListener('click', () => evaluateDecision('ASA'));

  // Vertex/side adjacency helpers (side i connects vertex i and vertex (i+1)%3)
  function sharedVertexOfSides(s1, s2) {
    const e1 = [s1, (s1 + 1) % 3];
    const e2 = [s2, (s2 + 1) % 3];
    return e1.find(v => e2.includes(v));
  }
  function sideBetweenVertices(v1, v2) {
    for (let s = 0; s < 3; s++) {
      const ends = [s, (s + 1) % 3];
      if (ends.includes(v1) && ends.includes(v2)) return s;
    }
    return -1;
  }

  // Side i is opposite vertex (i+2)%3 — equivalently vertex v's opposite side is (v+1)%3
  function oppositeSideOfAngle(angleIdx) {
    return (angleIdx + 1) % 3;
  }
  function isAngleAdjacentToSide(angleIdx, sideIdx) {
    return angleIdx === sideIdx || angleIdx === (sideIdx + 1) % 3;
  }

  // Exactly 2 sides + 1 non-included angle (not a curriculum congruence condition)
  function getNonIncludedSideAngleConfig(sKnown, aKnown) {
    let sideA = -1, sideB = -1;
    if (sKnown[0] && sKnown[1]) { sideA = 0; sideB = 1; }
    else if (sKnown[1] && sKnown[2]) { sideA = 1; sideB = 2; }
    else if (sKnown[2] && sKnown[0]) { sideA = 2; sideB = 0; }
    else return null;
    const angleCount = (aKnown[0] ? 1 : 0) + (aKnown[1] ? 1 : 0) + (aKnown[2] ? 1 : 0);
    if (angleCount !== 1) return null;
    const angleAt = aKnown[0] ? 0 : (aKnown[1] ? 1 : 2);
    const shared = sharedVertexOfSides(sideA, sideB);
    if (angleAt === shared) return null; // included angle → SAS
    return { sideA, sideB, angleAt, shared };
  }

  // 2nd geometric root along the measured-angle ray (null ⇒ unique / determined)
  function computeAlternateRoot(pts, cfg) {
    if (!cfg || !pts) return null;
    const { sideA, sideB, angleAt } = cfg;
    const iDrop = sharedVertexOfSides(sideA, sideB);
    const iBase = angleAt;
    const iMove = [0, 1, 2].find(i => i !== iBase && i !== iDrop);
    if (iMove === undefined) return null;

    const base = pts[iBase], drop = pts[iDrop], move = pts[iMove];
    const ux0 = move.x - base.x, uy0 = move.y - base.y;
    const sCurrent = Math.hypot(ux0, uy0);
    if (sCurrent < 0.0001) return null;
    const ux = ux0 / sCurrent, uy = uy0 / sCurrent;
    // Side between shared vertex and sliding vertex (one measured side)
    const L = Math.hypot(drop.x - move.x, drop.y - move.y);
    const vx = drop.x - base.x, vy = drop.y - base.y;
    const vDotU = vx * ux + vy * uy;
    const disc = vDotU * vDotU - (vx * vx + vy * vy - L * L);
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    const candidates = [vDotU + sqrtDisc, vDotU - sqrtDisc].filter(s => s > 0.01);
    let sAlt = null;
    let bestDiff = 0;
    candidates.forEach(s => {
      const d = Math.abs(s - sCurrent);
      if (d > 1.0 && d > bestDiff) { bestDiff = d; sAlt = s; }
    });
    if (sAlt === null) return null;
    return { iBase, iDrop, iMove, sCurrent, sAlt, ux, uy, L };
  }

  function buildAmbiguousMorphState(pts, cfg) {
    const alt = computeAlternateRoot(pts, cfg);
    if (!alt) return null;
    const base = pts[alt.iBase];
    const drop = pts[alt.iDrop];
    const move = pts[alt.iMove];
    // Freeze both measured side lengths in pixels
    const lenBaseDrop = Math.hypot(drop.x - base.x, drop.y - base.y);
    const lenDropMove = Math.hypot(move.x - drop.x, move.y - drop.y);
    // Unit direction of fixed side base→drop (locks one side of the angle)
    const bdx = (drop.x - base.x) / (lenBaseDrop || 1);
    const bdy = (drop.y - base.y) / (lenBaseDrop || 1);
    // Signed angle from base→drop to base→move (locks measured angle size)
    const angDrop = Math.atan2(drop.y - base.y, drop.x - base.x);
    const angMove = Math.atan2(move.y - base.y, move.x - base.x);
    let angSigned = angMove - angDrop;
    while (angSigned > Math.PI) angSigned -= Math.PI * 2;
    while (angSigned < -Math.PI) angSigned += Math.PI * 2;
    return {
      iBase: alt.iBase,
      iDrop: alt.iDrop,
      iMove: alt.iMove,
      base: { x: base.x, y: base.y },
      lenBaseDrop,
      lenDropMove,
      bdx, bdy,
      angSigned,
      sCurrent: alt.sCurrent,
      sAlt: alt.sAlt
    };
  }

  // Angle vertex + shared vertex fixed; free vertex slides on the measured-angle ray.
  // Both measured side lengths and the measured angle are preserved exactly.
  function applyAmbiguousMorph(origPts, state, blend01) {
    const t = (1 - Math.cos(Math.max(0, Math.min(1, blend01)) * Math.PI)) / 2;
    const sNow = state.sCurrent + (state.sAlt - state.sCurrent) * t;
    const base = { x: state.base.x, y: state.base.y };
    const drop = {
      x: base.x + state.bdx * state.lenBaseDrop,
      y: base.y + state.bdy * state.lenBaseDrop
    };
    const ux = Math.cos(Math.atan2(state.bdy, state.bdx) + state.angSigned);
    const uy = Math.sin(Math.atan2(state.bdy, state.bdx) + state.angSigned);
    // Project onto the ray at distance sNow, then snap to exact |move-drop| = lenDropMove
    // Prefer the intersection of ray and circle(drop, lenDropMove) nearest to sNow.
    const vx = drop.x - base.x, vy = drop.y - base.y;
    const vDotU = vx * ux + vy * uy;
    const disc = vDotU * vDotU - (vx * vx + vy * vy - state.lenDropMove * state.lenDropMove);
    let sUse = sNow;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const c1 = vDotU + sqrtDisc;
      const c2 = vDotU - sqrtDisc;
      const opts = [c1, c2].filter(s => s > 0.01);
      if (opts.length) {
        sUse = opts.reduce((best, s) => Math.abs(s - sNow) < Math.abs(best - sNow) ? s : best, opts[0]);
      }
    }
    const move = { x: base.x + ux * sUse, y: base.y + uy * sUse };
    return origPts.map((p, i) => {
      if (i === state.iBase) return base;
      if (i === state.iDrop) return drop;
      if (i === state.iMove) return move;
      return { x: p.x, y: p.y };
    });
  }

  function rigidTransformPts(pts, cx, cy, origCx, origCy, rot) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    return pts.map(p => ({
      x: cx + (p.x - origCx) * cos - (p.y - origCy) * sin,
      y: cy + (p.x - origCx) * sin + (p.y - origCy) * cos
    }));
  }

  function evaluateDecision(claim) {
    if (timerInterval) clearInterval(timerInterval);

    if (btnSSS) btnSSS.disabled = true;
    if (btnSAS) btnSAS.disabled = true;
    if (btnASA) btnASA.disabled = true;
    setUiPhase('animating');

    const measuredCount = measuredSet.size;

    const sideNamesL = ['AB', 'BC', 'CA'];
    const angleNamesL = ['A', 'B', 'C'];
    const sideNamesR = ['DE', 'EF', 'FD'];
    const angleNamesR = ['D', 'E', 'F'];

    // Build known arrays from measuredSet
    const sideKnownL = sideNamesL.map(n => measuredSet.has(`L_side_${n}`));
    const angleKnownL = angleNamesL.map(n => measuredSet.has(`L_angle_${n}`));
    const sideKnownR = sideNamesR.map(n => measuredSet.has(`R_side_${n}`));
    const angleKnownR = angleNamesR.map(n => measuredSet.has(`R_angle_${n}`));

    function checkTriangleCondition(sKnown, aKnown, pts) {
      const nS = sKnown.filter(Boolean).length;
      const nA = aKnown.filter(Boolean).length;

      const hasSSS = (nS === 3);

      let hasSAS = false;
      if (nS >= 2) {
        const sideIdx = [0, 1, 2].filter(i => sKnown[i]);
        for (let a = 0; a < sideIdx.length && !hasSAS; a++) {
          for (let b = a + 1; b < sideIdx.length && !hasSAS; b++) {
            const v = sharedVertexOfSides(sideIdx[a], sideIdx[b]);
            if (aKnown[v]) hasSAS = true;
          }
        }
      }

      // ASA = 두 각과 한 변 (끼인변·비끼인변 모두 모양 확정)
      let hasASA = false;
      if (nA >= 2 && nS >= 1) {
        hasASA = true;
      }

      // 두 변 + 끼인각이 아닌 각이지만, 기하적으로 해가 유일하면 모양 확정
      let isUniquelyDetermined = false;
      if (!hasSSS && !hasSAS && !hasASA && pts) {
        const cfg = getNonIncludedSideAngleConfig(sKnown, aKnown);
        if (cfg && !computeAlternateRoot(pts, cfg)) {
          isUniquelyDetermined = true;
        }
      }

      const isRigid = hasSSS || hasSAS || hasASA || isUniquelyDetermined;
      return { hasSSS, hasSAS, hasASA, isUniquelyDetermined, isRigid };
    }

    const condL = checkTriangleCondition(sideKnownL, angleKnownL, triangleLeft && triangleLeft.pts);
    const condR = checkTriangleCondition(sideKnownR, angleKnownR, triangleRight && triangleRight.pts);

    const pairedSides = [0, 1, 2].map(i => sideKnownL[i] && sideKnownR[i]);
    const pairedAngles = [0, 1, 2].map(i => angleKnownL[i] && angleKnownR[i]);

    const pairedSideIdx = [0, 1, 2].filter(i => pairedSides[i]);
    const pairedAngleIdx = [0, 1, 2].filter(i => pairedAngles[i]);

    const hasSSS_paired = pairedSideIdx.length === 3;

    let hasSAS_paired = false;
    for (let a = 0; a < pairedSideIdx.length && !hasSAS_paired; a++) {
      for (let b = a + 1; b < pairedSideIdx.length && !hasSAS_paired; b++) {
        const v = sharedVertexOfSides(pairedSideIdx[a], pairedSideIdx[b]);
        if (pairedAngleIdx.includes(v)) hasSAS_paired = true;
      }
    }

    // 대응되는 두 각 + 대응되는 한 변이면 ASA(또는 AAS)로 합동
    const hasASA_paired = pairedAngleIdx.length >= 2 && pairedSideIdx.length >= 1;

    const isPairedCongruent = hasSSS_paired || hasSAS_paired || hasASA_paired;
    const isBothRigid = condL.isRigid && condR.isRigid;
    // 한쪽이라도 모양이 유일하게 확정되면(다른 해가 없으면) 합동으로 인정
    const isCongruentProven = isPairedCongruent || isBothRigid
      || condL.isUniquelyDetermined || condR.isUniquelyDetermined;

    const claimMatchedPaired = (claim === 'SSS' && hasSSS_paired) || (claim === 'SAS' && hasSAS_paired) || (claim === 'ASA' && hasASA_paired);
    const claimMatchedSingle = (claim === 'SSS' && (condL.hasSSS || condR.hasSSS)) || (claim === 'SAS' && (condL.hasSAS || condR.hasSAS)) || (claim === 'ASA' && (condL.hasASA || condR.hasASA));

    // Congruence is ONLY accepted if both triangles are proven rigid/congruent together!
    // (If one triangle is under-measured and not rigid, it can still change shape -> Failure!)
    if (!isCongruentProven) {
      lastJudgmentResult = 'FAILURE';
      ceCount++;
      roundScores[currentRound - 1] = 0;
      sounds.playCounterExample();
      let ceType = 'UNDER_MEASURED';
      let msg = '🚨 두 삼각형이 완전히 포개지는 지 확신하려면 더 많은 측정값이 필요합니다.';

      const ambL = (() => {
        const cfg = getNonIncludedSideAngleConfig(sideKnownL, angleKnownL);
        return cfg ? computeAlternateRoot(triangleLeft && triangleLeft.pts, cfg) : null;
      })();
      const ambR = (() => {
        const cfg = getNonIncludedSideAngleConfig(sideKnownR, angleKnownR);
        return cfg ? computeAlternateRoot(triangleRight && triangleRight.pts, cfg) : null;
      })();

      if (pairedAngleIdx.length >= 2 && pairedSideIdx.length === 0) {
        ceType = 'AAA_TRAP';
        msg = '🚨 각도만 측정하면 모양은 같아도 크기가 다른 삼각형이 만들어질 수 있습니다! 변도 측정해보세요.';
      } else if (ambL || ambR) {
        ceType = 'AMBIGUOUS_TRAP';
        msg = '🚨 지금 잰 치수만으로는 모양이 하나로 정해지지 않습니다! 같은 측정값으로 다른 삼각형이 생길 수 있어요.';
      }

      playFailureAnimation(ceType, msg, sideKnownL, angleKnownL, sideKnownR, angleKnownR, () => {
        showResultModal(false, '0점', msg, ceType, getMathNoteText(ceType));
      });
    } else {
      // Both triangles are confirmed congruent & rigid!
      const userClickCount = userClickSet.size;
      const presetClueCount = currentPresetCount || 2;
      const minRequiredUserClicks = Math.max(1, 6 - Math.min(5, presetClueCount));
      const extraClicks = Math.max(0, userClickCount - minRequiredUserClicks);
      
      const inefficiencyPenalty = 10 * extraClicks;

      // Implicit Time-Elapsed Penalty (Rewards fast decision-making, prevents tie scores on leaderboard)
      const timeSpent = Math.max(0, 60 - roundTimeLeft);
      const timePenalty = Math.max(0, Math.floor((timeSpent - 3) * 0.8));

      const baseScore = 50; // Base score for proving congruence!
      let conditionBonus = 0;
      if (claimMatchedPaired) {
        conditionBonus = 50; // Full condition bonus when paired claim matches
      } else if (claimMatchedSingle) {
        conditionBonus = 20; // Partial condition bonus when single triangle condition matches
      }

      const rawScore = baseScore + conditionBonus - inefficiencyPenalty - timePenalty;
      const points = Math.max(0, rawScore);

      roundScores[currentRound - 1] = points;
      totalScore += points;
      correctCount++;
      hudScore.textContent = `${totalScore}점`;

      if (claimMatchedPaired && extraClicks === 0) {
        perfectCount++;
        lastJudgmentResult = 'OPTIMAL';
        playSuccessAnimation(() => {
          sounds.playSuccess();
          showResultModal(
            true,
            points >= 100 ? '🌟 100점 만점!' : `🌟 +${points}점`,
            `🎯 군더더기 없는 최적의 측정으로 ${claim} 합동 입증 성공!`,
            null,
            `정확히 ${claim} 합동 조건을 완벽하게 대칭으로 증명했습니다!`,
            '완벽한 판정!'
          );
        });
      } else if (claimMatchedPaired) {
        lastJudgmentResult = 'SUCCESS';
        playSuccessAnimation(() => {
          sounds.playSuccess();
          if (extraClicks > 0) highlightInefficientClues();
          showResultModal(
            true,
            `+${points}점`,
            `🎯 ${claim} 조건으로 두 삼각형의 대응/합동 증명 성공!`,
            null,
            extraClicks > 0 ? `불필요한 측정이 포함되어 감점되었습니다(-${inefficiencyPenalty}점).` : `합동 입증 성공!`,
            '판정 성공!'
          );
        });
      } else {
        lastJudgmentResult = 'WARNING';
        let subtitleMsg = `⚠️ 두 삼각형은 합동이지만, 선택한 조건(${claim})과 측정 구성이 정확히 일치하지 않아 조건 보너스가 줄었습니다. (+${points}점)`;
        if (claimMatchedSingle) {
          subtitleMsg = `💡 합동은 확인되었고, 한쪽에서 ${claim} 조건이 맞아 조건 보너스가 일부 추가되었습니다! (+${points}점)`;
        } else if (condL.isUniquelyDetermined || condR.isUniquelyDetermined) {
          subtitleMsg = `⚠️ 측정으로 모양이 하나로 확정되어 합동은 맞지만, SSS·SAS·ASA 중 맞는 조건으로 제출하면 더 높은 점수를 받을 수 있습니다! (+${points}점)`;
        }

        playSuccessAnimation(() => {
          sounds.playSuccess();
          if (extraClicks > 0) highlightInefficientClues();
          showResultModal(
            true,
            `+${points}점`,
            subtitleMsg,
            null,
            `양쪽 모두를 동일한 조건으로 대칭 측정해 제출하면 최대 100점까지 획득할 수 있습니다.`,
            '합동은 맞지만...'
          );
        });
      }
    }
  }

  function highlightInefficientClues() {
    const tags = document.querySelectorAll('.clue-tag');
    tags.forEach(t => t.classList.add('inefficient-pulse'));
  }

  function getMathNoteText(ceType) {
    switch (ceType) {
      case 'AAA_TRAP':
        return '세 각의 크기가 모두 같아도, 변의 길이가 다르면 크기가 자유롭게 변할 수 있습니다.';
      case 'AMBIGUOUS_TRAP':
        return '측정값이 부족하거나 조건이 맞지 않으면, 같은 치수로도 다른 모양의 삼각형이 나올 수 있습니다. SSS·SAS·ASA로 증명하세요.';
      case 'UNDER_MEASURED':
      default:
        return '두 삼각형이 완전히 포개지는 지 확신하려면 더 많은 측정값이 필요합니다.';
    }
  }

  function handleTimeOut() {
    ceCount++;
    roundScores[currentRound - 1] = 0;
    sounds.playCounterExample();
    showResultModal(
      false,
      '0점 (시간 초과)',
      '⏰ 제한 시간이 초과되었습니다! 신속하게 필수 치수를 측정하세요.',
      'TIMEOUT',
      '제한 시간 안에 핵심 치수 3가지를 파악하는 순발력이 필요합니다.'
    );
  }

  // ----------------------------------------------------
  // Result Modal & Counter-Example Visual Renderer
  // ----------------------------------------------------
  function showResultModal(isSuccess, scoreBadgeText, subtitle, ceType, mathNote, customTitle) {
    resultScoreBadge.textContent = scoreBadgeText;
    resultSubtitle.textContent = subtitle;
    mathNoteText.textContent = mathNote;

    activeTool = null;
    if (toolRuler) toolRuler.classList.remove('active');
    if (toolProtractor) toolProtractor.classList.remove('active');
    hoverTarget = null;

    const floatingToolPalette = document.querySelector('.floating-tool-palette');
    if (floatingToolPalette) {
      floatingToolPalette.style.opacity = '0.4';
      floatingToolPalette.style.pointerEvents = 'none';
    }

    activeResultView = 'counter';
    if (btnViewCounter) btnViewCounter.classList.add('active');
    if (btnViewInitial) btnViewInitial.classList.remove('active');

    if (isSuccess) {
      if (customTitle === '판정은 성공했으나...' || customTitle === '합동은 맞지만...') {
        resultHeader.style.color = '#f59e0b';
        resultIcon.textContent = '⚠️';
        resultTitle.textContent = customTitle;
      } else {
        resultHeader.style.color = '#10b981';
        resultIcon.textContent = '🌟';
        resultTitle.textContent = customTitle || '판정 성공!';
      }
      counterExampleBox.style.display = 'none';
    } else {
      resultHeader.style.color = '#ef4444';
      resultIcon.textContent = '🚨';
      resultTitle.textContent = '판정 실패';
      counterExampleBox.style.display = 'none';
    }

    if (btnNextRound) {
      if (currentRound >= maxRounds) {
        btnNextRound.textContent = '🏆 최종 결과 확인하기 ➔';
      } else {
        btnNextRound.textContent = '다음 라운드로 진입 ➔';
      }
    }

    setUiPhase('modal');
    if (resultModal) resultModal.classList.remove('hidden');
  }

  if (btnNextRound) {
    btnNextRound.onclick = () => {
      if (resultModal) resultModal.classList.add('hidden');
      setUiPhase('play');
      const floatingToolPalette = document.querySelector('.floating-tool-palette');
      if (floatingToolPalette) {
        floatingToolPalette.style.opacity = '1';
        floatingToolPalette.style.pointerEvents = 'auto';
      }
      if (currentRound < maxRounds) {
        currentRound++;
        startRound(currentRound);
      } else {
        showGameOverModal();
      }
    };
  }

  // Success Animation Logic (Rigid Body Translation & Rotation -> 0% Size Warping!)
  function ensureCanvasVisibleForAnim() {
    const wrap = document.querySelector('.canvas-wrapper');
    if (wrap && typeof wrap.scrollIntoView === 'function') {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function playSuccessAnimation(onComplete) {
    if (successAnimReqId) cancelAnimationFrame(successAnimReqId);
    successAnimReqId = null;
    ensureCanvasVisibleForAnim();
    let startTime = null;
    
    // Disable tool hover during animation
    const oldHover = hoverTarget;
    hoverTarget = null;
    
    const baseRightPts = savedOriginalRightPts || triangleRight.pts.map(p => ({x: p.x, y: p.y}));
    const leftPts = triangleLeft.pts;

    const cR = {
      x: (baseRightPts[0].x + baseRightPts[1].x + baseRightPts[2].x) / 3,
      y: (baseRightPts[0].y + baseRightPts[1].y + baseRightPts[2].y) / 3
    };
    const cL = {
      x: (leftPts[0].x + leftPts[1].x + leftPts[2].x) / 3,
      y: (leftPts[0].y + leftPts[1].y + leftPts[2].y) / 3
    };

    const angR = Math.atan2(baseRightPts[1].y - baseRightPts[0].y, baseRightPts[1].x - baseRightPts[0].x);
    const angL = Math.atan2(leftPts[1].y - leftPts[0].y, leftPts[1].x - leftPts[0].x);
    let dAng = angL - angR;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;

    function animateSuccess(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 1500, 1.0);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      const curCX = cR.x + (cL.x - cR.x) * ease;
      const curCY = cR.y + (cL.y - cR.y) * ease;
      const curRot = dAng * ease;

      // Transform baseRightPts 100% rigidly (size never warps!)
      triangleRight.pts = baseRightPts.map(pt => {
        const dx = pt.x - cR.x;
        const dy = pt.y - cR.y;
        const rx = dx * Math.cos(curRot) - dy * Math.sin(curRot);
        const ry = dx * Math.sin(curRot) + dy * Math.cos(curRot);
        return {
          x: curCX + rx,
          y: curCY + ry
        };
      });
      
      renderCanvas();
      
      if (progress < 1.0) {
        successAnimReqId = requestAnimationFrame(animateSuccess);
      } else {
        successAnimReqId = null;
        triangleRight.pts = triangleLeft.pts.map(p => ({ x: p.x, y: p.y }));
        renderCanvas();
        hoverTarget = oldHover;
        if (onComplete) onComplete();
      }
    }
    
    successAnimReqId = requestAnimationFrame(animateSuccess);
  }

  // Failure Animation Logic on Main Canvas
  function playFailureAnimation(ceType, msg, sideKnownL, angleKnownL, sideKnownR, angleKnownR, onComplete) {
    lastFailureArgs = { ceType, msg, sideKnownL, angleKnownL, sideKnownR, angleKnownR };
    if (failureAnimReqId) cancelAnimationFrame(failureAnimReqId);
    failureAnimReqId = null;
    ensureCanvasVisibleForAnim();
    let startTime = null;
    const oldHover = hoverTarget;
    hoverTarget = null;
    
    const originalRightPts = triangleRight.pts.map(p => ({x: p.x, y: p.y}));
    const originalLeftPts = triangleLeft.pts.map(p => ({x: p.x, y: p.y}));
    
    function isTriangleRigid(sKnown, aKnown, pts) {
      const nS = sKnown.filter(Boolean).length;
      if (nS === 3) return true;
      let hasSAS = false;
      for (let a=0; a<3; a++) {
        for (let b=a+1; b<3; b++) {
          if (sKnown[a] && sKnown[b]) {
            const v = sharedVertexOfSides(a, b);
            if (aKnown[v]) hasSAS = true;
          }
        }
      }
      if (hasSAS) return true;
      const nA = aKnown.filter(Boolean).length;
      if (nA >= 2 && nS >= 1) return true;
      const cfg = getNonIncludedSideAngleConfig(sKnown, aKnown);
      if (cfg && pts && !computeAlternateRoot(pts, cfg)) return true;
      return false;
    }
    
    const isRigidL = isTriangleRigid(sideKnownL, angleKnownL, originalLeftPts);
    const isRigidR = isTriangleRigid(sideKnownR, angleKnownR, originalRightPts);
    
    const countL = sideKnownL.filter(Boolean).length + angleKnownL.filter(Boolean).length;
    const countR = sideKnownR.filter(Boolean).length + angleKnownR.filter(Boolean).length;

    const cfgL = getNonIncludedSideAngleConfig(sideKnownL, angleKnownL);
    const cfgR = getNonIncludedSideAngleConfig(sideKnownR, angleKnownR);
    const ambStateL = cfgL ? buildAmbiguousMorphState(originalLeftPts, cfgL) : null;
    const ambStateR = cfgR ? buildAmbiguousMorphState(originalRightPts, cfgR) : null;

    let wiggleTarget = 'R';
    let ambState = null;
    if (ambStateL || ambStateR) {
      // Prefer the triangle that actually has the ambiguous counterexample
      if (ambStateR && !ambStateL) {
        wiggleTarget = 'R';
        ambState = ambStateR;
      } else if (ambStateL && !ambStateR) {
        wiggleTarget = 'L';
        ambState = ambStateL;
      } else {
        wiggleTarget = countR >= countL ? 'R' : 'L';
        ambState = wiggleTarget === 'R' ? ambStateR : ambStateL;
      }
    } else if (isRigidR && !isRigidL) {
      wiggleTarget = 'L';
    } else if (!isRigidR && isRigidL) {
      wiggleTarget = 'R';
    } else if (!isRigidR && !isRigidL) {
      if (countL < countR) wiggleTarget = 'L';
    }

    const cR = {
      x: (originalRightPts[0].x + originalRightPts[1].x + originalRightPts[2].x) / 3,
      y: (originalRightPts[0].y + originalRightPts[1].y + originalRightPts[2].y) / 3
    };
    const cL = {
      x: (originalLeftPts[0].x + originalLeftPts[1].x + originalLeftPts[2].x) / 3,
      y: (originalLeftPts[0].y + originalLeftPts[1].y + originalLeftPts[2].y) / 3
    };

    const angR = Math.atan2(originalRightPts[1].y - originalRightPts[0].y, originalRightPts[1].x - originalRightPts[0].x);
    const angL = Math.atan2(originalLeftPts[1].y - originalLeftPts[0].y, originalLeftPts[1].x - originalLeftPts[0].x);
    
    let dAngRtoL = angL - angR;
    while (dAngRtoL > Math.PI) dAngRtoL -= Math.PI * 2;
    while (dAngRtoL < -Math.PI) dAngRtoL += Math.PI * 2;

    let dAngLtoR = angR - angL;
    while (dAngLtoR > Math.PI) dAngLtoR -= Math.PI * 2;
    while (dAngLtoR < -Math.PI) dAngLtoR += Math.PI * 2;

    let notified = false;
    
    function animateFailure(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progressOverlaping = Math.min(elapsed / 1500, 1.0); // 0 to 1.5s: move to overlap
      const progressWiggling = Math.max(0, (elapsed - 1500) / 1000); // 1.5s+: wiggle infinitely
      
      const easeOverlap = progressOverlaping < 0.5 ? 4 * progressOverlaping * Math.pow(progressOverlaping, 2) : 1 - Math.pow(-2 * progressOverlaping + 2, 3) / 2;

      let p0_R = {x: originalRightPts[0].x, y: originalRightPts[0].y};
      let p1_R = {x: originalRightPts[1].x, y: originalRightPts[1].y};
      let p2_R = {x: originalRightPts[2].x, y: originalRightPts[2].y};
      
      let p0_L = {x: originalLeftPts[0].x, y: originalLeftPts[0].y};
      let p1_L = {x: originalLeftPts[1].x, y: originalLeftPts[1].y};
      let p2_L = {x: originalLeftPts[2].x, y: originalLeftPts[2].y};

      if (ambState) {
        // 1) Morph locally (measured sides + angle locked, free vertex slides)
        // 2) Rigidly stack onto the other triangle so both shapes are compared overlapped
        const origPts = wiggleTarget === 'R' ? originalRightPts : originalLeftPts;
        const origC = wiggleTarget === 'R' ? cR : cL;
        const targetC = wiggleTarget === 'R' ? cL : cR;
        const dAng = wiggleTarget === 'R' ? dAngRtoL : dAngLtoR;

        const cycleT = (elapsed % 2400) / 1200;
        const morphBlend = cycleT <= 1 ? cycleT : 2 - cycleT;
        const morphedLocal = applyAmbiguousMorph(origPts, ambState, morphBlend);

        const curCX = origC.x + (targetC.x - origC.x) * easeOverlap;
        const curCY = origC.y + (targetC.y - origC.y) * easeOverlap;
        const curRot = dAng * easeOverlap;
        const finalPts = rigidTransformPts(morphedLocal, curCX, curCY, origC.x, origC.y, curRot);

        if (wiggleTarget === 'R') {
          p0_R = finalPts[0]; p1_R = finalPts[1]; p2_R = finalPts[2];
        } else {
          p0_L = finalPts[0]; p1_L = finalPts[1]; p2_L = finalPts[2];
        }
      } else {
      // Phase 1: Overlap target triangle rigidly (size never warps!)
      const easeMove = easeOverlap;
      
      if (wiggleTarget === 'R') {
        const curCX = cR.x + (cL.x - cR.x) * easeMove;
        const curCY = cR.y + (cL.y - cR.y) * easeMove;
        const curRot = dAngRtoL * easeMove;

        p0_R = {
          x: curCX + (originalRightPts[0].x - cR.x) * Math.cos(curRot) - (originalRightPts[0].y - cR.y) * Math.sin(curRot),
          y: curCY + (originalRightPts[0].x - cR.x) * Math.sin(curRot) + (originalRightPts[0].y - cR.y) * Math.cos(curRot)
        };
        p1_R = {
          x: curCX + (originalRightPts[1].x - cR.x) * Math.cos(curRot) - (originalRightPts[1].y - cR.y) * Math.sin(curRot),
          y: curCY + (originalRightPts[1].x - cR.x) * Math.sin(curRot) + (originalRightPts[1].y - cR.y) * Math.cos(curRot)
        };
        p2_R = {
          x: curCX + (originalRightPts[2].x - cR.x) * Math.cos(curRot) - (originalRightPts[2].y - cR.y) * Math.sin(curRot),
          y: curCY + (originalRightPts[2].x - cR.x) * Math.sin(curRot) + (originalRightPts[2].y - cR.y) * Math.cos(curRot)
        };
      } else {
        const curCX = cL.x + (cR.x - cL.x) * easeMove;
        const curCY = cL.y + (cR.y - cL.y) * easeMove;
        const curRot = dAngLtoR * easeMove;

        p0_L = {
          x: curCX + (originalLeftPts[0].x - cL.x) * Math.cos(curRot) - (originalLeftPts[0].y - cL.y) * Math.sin(curRot),
          y: curCY + (originalLeftPts[0].x - cL.x) * Math.sin(curRot) + (originalLeftPts[0].y - cL.y) * Math.cos(curRot)
        };
        p1_L = {
          x: curCX + (originalLeftPts[1].x - cL.x) * Math.cos(curRot) - (originalLeftPts[1].y - cL.y) * Math.sin(curRot),
          y: curCY + (originalLeftPts[1].x - cL.x) * Math.sin(curRot) + (originalLeftPts[1].y - cL.y) * Math.cos(curRot)
        };
        p2_L = {
          x: curCX + (originalLeftPts[2].x - cL.x) * Math.cos(curRot) - (originalLeftPts[2].y - cL.y) * Math.sin(curRot),
          y: curCY + (originalLeftPts[2].x - cL.x) * Math.sin(curRot) + (originalLeftPts[2].y - cL.y) * Math.cos(curRot)
        };
      }
      }
      
      // Phase 2: Wiggle with 100% invariant measured lengths and angles
      if (progressWiggling > 0 && !ambState) {
        const t = Math.sin(progressWiggling * Math.PI * 2);
        
        let p0 = wiggleTarget === 'R' ? p0_R : p0_L;
        let p1 = wiggleTarget === 'R' ? p1_R : p1_L;
        let p2 = wiggleTarget === 'R' ? p2_R : p2_L;
        
        const isMeasuredSide = wiggleTarget === 'R' ? sideKnownR : sideKnownL;
        const isMeasuredAngle = wiggleTarget === 'R' ? angleKnownR : angleKnownL;
        
        const numMeasuredSides = (isMeasuredSide[0]?1:0) + (isMeasuredSide[1]?1:0) + (isMeasuredSide[2]?1:0);
        const numMeasuredAngles = (isMeasuredAngle[0]?1:0) + (isMeasuredAngle[1]?1:0) + (isMeasuredAngle[2]?1:0);

        const slideLadder = (pFixed, pSlide1, pSlide2, tOffset) => {
          const ux = pSlide1.x - pFixed.x, uy = pSlide1.y - pFixed.y;
          const vx = pSlide2.x - pFixed.x, vy = pSlide2.y - pFixed.y;
          const s0 = Math.hypot(ux, uy);
          const d0 = Math.hypot(vx, vy);
          if (s0 < 0.001 || d0 < 0.001) return [pSlide1, pSlide2];
          
          const dirU = { x: ux / s0, y: uy / s0 };
          const dirV = { x: vx / d0, y: vy / d0 };
          
          const L = Math.hypot(pSlide1.x - pSlide2.x, pSlide1.y - pSlide2.y);
          const cosTheta = dirU.x * dirV.x + dirU.y * dirV.y;
          const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
          
          const sMax = L / (sinTheta + 0.0001);
          let s = s0 + tOffset * 20;
          if (s > sMax * 0.98) s = sMax * 0.98;
          if (s < 5) s = 5;
          
          const disc = L * L - s * s * sinTheta * sinTheta;
          if (disc < 0) return [pSlide1, pSlide2];
          
          const root1 = s * cosTheta + Math.sqrt(disc);
          const root2 = s * cosTheta - Math.sqrt(disc);
          const d = Math.abs(root1 - d0) < Math.abs(root2 - d0) ? root1 : root2;
          
          return [
            { x: pFixed.x + dirU.x * s, y: pFixed.y + dirU.y * s },
            { x: pFixed.x + dirV.x * d, y: pFixed.y + dirV.y * d }
          ];
        };

        if (ceType === 'MISMATCHED_PROOF' || (isRigidL && isRigidR)) {
          // Both triangles are fully rigid on their own! Do NOT wiggle.
        } else if (numMeasuredSides === 0) {
          if (numMeasuredAngles >= 2) {
            const centroid = { x: (p0.x+p1.x+p2.x)/3, y: (p0.y+p1.y+p2.y)/3 };
            const scale = 1.0 + 0.3 * t;
            p0 = { x: centroid.x + (p0.x - centroid.x) * scale, y: centroid.y + (p0.y - centroid.y) * scale };
            p1 = { x: centroid.x + (p1.x - centroid.x) * scale, y: centroid.y + (p1.y - centroid.y) * scale };
            p2 = { x: centroid.x + (p2.x - centroid.x) * scale, y: centroid.y + (p2.y - centroid.y) * scale };
          } else if (numMeasuredAngles === 1) {
            if (isMeasuredAngle[0]) {
              const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y; const len1 = Math.hypot(dx1, dy1) || 1;
              const dx2 = p2.x - p0.x, dy2 = p2.y - p0.y; const len2 = Math.hypot(dx2, dy2) || 1;
              p1.x += (dx1/len1) * t * 20; p1.y += (dy1/len1) * t * 20;
              p2.x -= (dx2/len2) * t * 20; p2.y -= (dy2/len2) * t * 20;
            } else if (isMeasuredAngle[1]) {
              const dx0 = p0.x - p1.x, dy0 = p0.y - p1.y; const len0 = Math.hypot(dx0, dy0) || 1;
              const dx2 = p2.x - p1.x, dy2 = p2.y - p1.y; const len2 = Math.hypot(dx2, dy2) || 1;
              p0.x += (dx0/len0) * t * 20; p0.y += (dy0/len0) * t * 20;
              p2.x -= (dx2/len2) * t * 20; p2.y -= (dy2/len2) * t * 20;
            } else if (isMeasuredAngle[2]) {
              const dx0 = p0.x - p2.x, dy0 = p0.y - p2.y; const len0 = Math.hypot(dx0, dy0) || 1;
              const dx1 = p1.x - p2.x, dy1 = p1.y - p2.y; const len1 = Math.hypot(dx1, dy1) || 1;
              p0.x += (dx0/len0) * t * 20; p0.y += (dy0/len0) * t * 20;
              p1.x -= (dx1/len1) * t * 20; p1.y -= (dy1/len1) * t * 20;
            }
          } else {
            p2.x += t * 30;
            p2.y += Math.cos(progressWiggling * Math.PI * 4) * 20;
          }
        } else if (numMeasuredSides === 2) {
          let sideA = -1, sideB = -1;
          if (isMeasuredSide[0] && isMeasuredSide[1]) { sideA = 0; sideB = 1; }
          else if (isMeasuredSide[1] && isMeasuredSide[2]) { sideA = 1; sideB = 2; }
          else if (isMeasuredSide[2] && isMeasuredSide[0]) { sideA = 2; sideB = 0; }
          const shared = (sideA >= 0) ? sharedVertexOfSides(sideA, sideB) : -1;
          const measuredAngleAt = isMeasuredAngle[0] ? 0 : (isMeasuredAngle[1] ? 1 : (isMeasuredAngle[2] ? 2 : -1));

          if (shared >= 0 && measuredAngleAt < 0) {
            const rotatePt = (pt, center, angle) => {
              const dx = pt.x - center.x, dy = pt.y - center.y;
              return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
            };
            if (sideA === 0 && sideB === 1) p2 = rotatePt(p2, p1, t * 0.4);
            else if (sideA === 1 && sideB === 2) p0 = rotatePt(p0, p2, t * 0.4);
            else if (sideA === 2 && sideB === 0) p1 = rotatePt(p1, p0, t * 0.4);
          }
        } else if (numMeasuredSides === 1) {
          // 1 side measured. Pin both endpoints of the measured side! Length is 100% INVARIANT!
          const rotatePt = (pt, center, angle) => {
            const dx = pt.x - center.x, dy = pt.y - center.y;
            return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
          };

          if (isMeasuredSide[0]) {
            if (isMeasuredAngle[0]) {
              const dx = p2.x - p0.x, dy = p2.y - p0.y; const len = Math.hypot(dx, dy) || 1;
              p2.x += (dx/len) * t * 30; p2.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[1]) {
              const dx = p2.x - p1.x, dy = p2.y - p1.y; const len = Math.hypot(dx, dy) || 1;
              p2.x += (dx/len) * t * 30; p2.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[2]) {
              const res = slideLadder(p2, p0, p1, t); p0 = res[0]; p1 = res[1];
            } else {
              p2 = rotatePt(p2, p1, t * 0.4);
            }
          } else if (isMeasuredSide[1]) {
            if (isMeasuredAngle[1]) {
              const dx = p0.x - p1.x, dy = p0.y - p1.y; const len = Math.hypot(dx, dy) || 1;
              p0.x += (dx/len) * t * 30; p0.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[2]) {
              const dx = p0.x - p2.x, dy = p0.y - p2.y; const len = Math.hypot(dx, dy) || 1;
              p0.x += (dx/len) * t * 30; p0.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[0]) {
              const res = slideLadder(p0, p1, p2, t); p1 = res[0]; p2 = res[1];
            } else {
              p0 = rotatePt(p0, p2, t * 0.4);
            }
          } else if (isMeasuredSide[2]) {
            if (isMeasuredAngle[2]) {
              const dx = p1.x - p2.x, dy = p1.y - p2.y; const len = Math.hypot(dx, dy) || 1;
              p1.x += (dx/len) * t * 30; p1.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[0]) {
              const dx = p1.x - p0.x, dy = p1.y - p0.y; const len = Math.hypot(dx, dy) || 1;
              p1.x += (dx/len) * t * 30; p1.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[1]) {
              const res = slideLadder(p1, p2, p0, t); p2 = res[0]; p0 = res[1];
            } else {
              p1 = rotatePt(p1, p0, t * 0.4);
            }
          }
        }
        if (wiggleTarget === 'R') {
          p0_R = p0; p1_R = p1; p2_R = p2;
        } else {
          p0_L = p0; p1_L = p1; p2_L = p2;
        }
      }
      
      const prevLeftPts = triangleLeft.pts;
      const prevRightPts = triangleRight.pts;
      if (activeResultView === 'initial') {
        renderCanvas();
      } else {
        triangleLeft.pts = [p0_L, p1_L, p2_L];
        triangleRight.pts = [p0_R, p1_R, p2_R];
        renderCanvas();
        triangleLeft.pts = prevLeftPts;
        triangleRight.pts = prevRightPts;
      }
      
      // Trigger modal immediately when wiggling starts (1.5s) instead of waiting for an end
      if (elapsed >= 1500 && !notified) {
        notified = true;
        hoverTarget = oldHover;
        if (onComplete) onComplete();
      }
      
      // Keep animating forever
      failureAnimReqId = requestAnimationFrame(animateFailure);
    }
    failureAnimReqId = requestAnimationFrame(animateFailure);
  }

  // Render Counter-Example Visual Canvas
  let animReqId = null;

  function renderCounterExampleCanvas(ceType) {
    if (animReqId) cancelAnimationFrame(animReqId);
    let startTime = null;

    // Center coordinates for the two triangles in the modal canvas
    const centerTarget = { x: 110, y: 130 };
    const centerCE = { x: 330, y: 130 };
    
    // Extract actual triangleLeft points and translate to modal origin (0,0)
    const centroidL = {
      x: (triangleLeft.pts[0].x + triangleLeft.pts[1].x + triangleLeft.pts[2].x) / 3,
      y: (triangleLeft.pts[0].y + triangleLeft.pts[1].y + triangleLeft.pts[2].y) / 3
    };
    
    // Base points for target (A, B, C)
    const localPts = triangleLeft.pts.map(p => ({
      x: p.x - centroidL.x,
      y: p.y - centroidL.y
    }));
    
    // Bounding box normalization so it fits well in 220x220 half-canvas
    let maxDist = 0;
    localPts.forEach(p => {
      maxDist = Math.max(maxDist, Math.hypot(p.x, p.y));
    });
    const scaleFactor = Math.min(1.0, 70 / maxDist);
    
    const basePts = localPts.map(p => ({
      x: p.x * scaleFactor,
      y: p.y * scaleFactor
    }));

    function animateFrame(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = ((timestamp - startTime) % 3000) / 3000; // 0 to 1 looping over 3 seconds
      const sinWave = Math.sin(progress * Math.PI * 2);

      ceCtx.clearRect(0, 0, ceCanvas.width, ceCanvas.height);

      // 1. Draw Target Triangle (Left, Dotted Cyan)
      const tPts = basePts.map(p => ({ x: centerTarget.x + p.x, y: centerTarget.y + p.y }));
      
      ceCtx.setLineDash([4, 4]);
      ceCtx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ceCtx.lineWidth = 2;
      ceCtx.beginPath();
      ceCtx.moveTo(tPts[0].x, tPts[0].y);
      ceCtx.lineTo(tPts[1].x, tPts[1].y);
      ceCtx.lineTo(tPts[2].x, tPts[2].y);
      ceCtx.closePath();
      ceCtx.stroke();
      ceCtx.setLineDash([]);

      ceCtx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ceCtx.font = 'bold 12px Pretendard';
      ceCtx.fillText('목표 △ABC', centerTarget.x - 30, centerTarget.y + 70);

      // 2. Animated Counter-Example Triangle (Right, Red)
      // Determine how to distort basePts based on ceType
      let cPts = basePts.map(p => ({ x: p.x, y: p.y }));
      
      if (ceType === 'AAA_TRAP') {
        // AAA: Scale changes, angles stay same
        const scale = 1.0 + 0.4 * sinWave;
        cPts = cPts.map(p => ({ x: p.x * scale, y: p.y * scale }));
        ceExplanation.textContent = '🎬 세 각은 똑같지만, 변의 길이가 이렇게 커지거나 작아질 수 있어 완전히 포개어지지 않습니다!';
      } else if (ceType === 'AMBIGUOUS_TRAP') {
        // Alternate shape with same locked measurements: swing free vertex
        const swingAngle = sinWave * 0.4;
        const dx = cPts[2].x - cPts[1].x;
        const dy = cPts[2].y - cPts[1].y;
        cPts[2].x = cPts[1].x + dx * Math.cos(swingAngle) - dy * Math.sin(swingAngle);
        cPts[2].y = cPts[1].y + dx * Math.sin(swingAngle) + dy * Math.cos(swingAngle);
        ceExplanation.textContent = '🎬 지금 잰 치수만으로는 남은 부분이 이렇게 변하면서 전혀 다른 모양이 될 수 있습니다!';
      } else if (ceType === 'UNDER_MEASURED') {
        // General under-measured: distort point C wildly
        cPts[2].x += sinWave * 30;
        cPts[2].y += Math.cos(progress * Math.PI * 4) * 20;
        ceExplanation.textContent = '🎬 측정이 부족하면 재지 않은 치수가 이렇게 자유롭게 변하면서 무수히 많은 반례 삼각형이 생겨납니다!';
      }

      // Translate CE points to right side of canvas
      const renderCePts = cPts.map(p => ({ x: centerCE.x + p.x, y: centerCE.y + p.y }));

      ceCtx.strokeStyle = '#ef4444';
      ceCtx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ceCtx.lineWidth = 2.5;
      ceCtx.beginPath();
      ceCtx.moveTo(renderCePts[0].x, renderCePts[0].y);
      ceCtx.lineTo(renderCePts[1].x, renderCePts[1].y);
      ceCtx.lineTo(renderCePts[2].x, renderCePts[2].y);
      ceCtx.closePath();
      ceCtx.fill();
      ceCtx.stroke();

      ceCtx.fillStyle = '#fca5a5';
      ceCtx.font = 'bold 12px Pretendard';
      ceCtx.fillText('\uD83D\uDEA8 \uBC18\uB808 \u25B3ABC', centerCE.x - 30, centerCE.y + 70);

      animReqId = requestAnimationFrame(animateFrame);
    }

    animReqId = requestAnimationFrame(animateFrame);
  }

  // ----------------------------------------------------
  // Game Over & High Score Submission
  // ----------------------------------------------------
  function showGameOverModal() {
    finalTotalScore.textContent = totalScore;
    
    const roundGrid = document.getElementById('round-scores-grid');
    if (roundGrid) {
      roundGrid.innerHTML = roundScores.map((score, idx) => {
        const isPerfect = score >= 100;
        const isSuccess = score > 0;
        const colorClass = isPerfect ? 'perfect-card' : (isSuccess ? 'success-card' : 'fail-card');
        const scoreText = isSuccess ? `+${score}점` : '0점';
        return `
          <div class="round-score-item ${colorClass}">
            <span class="round-item-label">${idx + 1}라운드</span>
            <span class="round-item-score">${scoreText}</span>
          </div>
        `;
      }).join('');
    }

    if (totalScore > highScore && totalScore > 0) {
      highScore = totalScore;
      safeSetStorage(highScoreStorageKey, highScore);
      hudHighScore.textContent = `${highScore}점`;
      newHighscoreBanner.classList.remove('hidden');
    } else {
      newHighscoreBanner.classList.add('hidden');
    }

    if (resultLockedName) resultLockedName.textContent = playerName || '도전자';
    if (resultLockedId) resultLockedId.textContent = studentId || '—';
    if (resultLockedIdSpan) resultLockedIdSpan.style.display = (activeMode === 'school') ? 'inline' : 'none';

    if (btnSendData) btnSendData.style.display = 'none';
    if (apiStatusMsg) apiStatusMsg.textContent = '';

    setUiPhase('modal');
    if (gameoverModal) gameoverModal.classList.remove('hidden');
    fetchLeaderboard();
    registerScoreToLeaderboard(totalScore);
  }

  async function registerScoreToLeaderboard(score) {
    if (!playerName) return;
    if (apiStatusMsg) {
      apiStatusMsg.textContent = '⏳ 랭킹 등록 중...';
      apiStatusMsg.className = 'api-status-msg';
    }

    const payload = {
      score: score,
      gameId: 'congruence',
      timestamp: (window.firebase && firebase.database && typeof firebase.database.ServerValue !== 'undefined')
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now()
    };

    const result = await HalomathScores.submitScore(firebaseDb, {
      activeMode,
      name: playerName,
      studentId,
      gameIds: ['congruence', 'triangle', 'congruence_game'],
      payload,
      compareMode: 'higher',
      acceptEntry: (val) => isCongruenceScore(val),
      updatedMessage: `🎉 최고 점수가 ${score}점으로 갱신되었습니다!`,
      createdMessage: `🎉 ${score}점이 랭킹에 등록되었습니다!`,
      unchangedMessage: `ℹ️ 기존 최고 점수가 ${score}점보다 높거나 같아 갱신하지 않았습니다.`
    });

    if (result.success && result.updated !== false && score > highScore) {
      highScore = score;
      safeSetStorage(highScoreStorageKey, highScore);
      if (hudHighScore) hudHighScore.textContent = `${highScore}점`;
    }

    if (apiStatusMsg) {
      apiStatusMsg.textContent = result.message;
      apiStatusMsg.className = 'api-status-msg' + (result.success ? ' success' : ' error');
    }
    fetchLeaderboard();
  }

  if (btnRestartGame) {
    btnRestartGame.onclick = () => {
      if (gameoverModal) gameoverModal.classList.add('hidden');
      setUiPhase('play');
      initGame();
    };
  }

  // ----------------------------------------------------
  // Leaderboard & Firebase Realtime Database
  // ----------------------------------------------------
  const btnOpenLeaderboard = document.getElementById('btn-open-leaderboard');
  const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const modalLeaderboardTbody = document.getElementById('modal-leaderboard-tbody');
  const gameoverLeaderboardTbody = document.getElementById('gameover-leaderboard-tbody');

  const btnToggleOpeningLeaderboard = document.getElementById('btn-toggle-opening-leaderboard');
  const openingLeaderboardBox = document.getElementById('opening-leaderboard-box');
  const openingLeaderboardTbody = document.getElementById('opening-leaderboard-tbody');
  const openingChampName = document.getElementById('opening-champ-name');
  const openingChampId = document.getElementById('opening-champ-id');
  const openingChampScore = document.getElementById('opening-champ-score');

  const resultLockedName = document.getElementById('result-locked-name');
  const resultLockedId = document.getElementById('result-locked-id');
  const resultLockedIdSpan = document.getElementById('result-locked-id-span');
  const btnSendData = document.getElementById('btn-send-data');
  const apiStatusMsg = document.getElementById('api-status-msg');

  if (btnToggleOpeningLeaderboard && openingLeaderboardBox) {
    btnToggleOpeningLeaderboard.addEventListener('click', () => {
      fetchLeaderboard();
      openingLeaderboardBox.classList.toggle('hidden');
    });
  }

  if (btnOpenLeaderboard) {
    btnOpenLeaderboard.addEventListener('click', () => {
      fetchLeaderboard();
      leaderboardModal.classList.remove('hidden');
    });
  }

  if (btnCloseLeaderboard) {
    btnCloseLeaderboard.addEventListener('click', () => {
      leaderboardModal.classList.add('hidden');
    });
  }

  let firebaseRetryCount = 0;
  function fetchLeaderboard() {
    const fetchViaREST = () => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);

      Promise.all([
        fetch('https://math-game-halogini-default-rtdb.firebaseio.com/scores.json', { signal: controller.signal }).then(r => r.json()).catch(() => null),
        fetch('https://math-game-halogini-default-rtdb.firebaseio.com/scores/dorms.json', { signal: controller.signal }).then(r => r.json()).catch(() => null)
      ]).then(([data1, data2]) => {
        clearTimeout(id);
        const combined = {};
        if (data1 && typeof data1 === 'object') Object.assign(combined, data1);
        if (data2 && typeof data2 === 'object') Object.assign(combined, data2);
        processLeaderboardData(combined);
      }).catch(() => clearTimeout(id));
    };

    if (firebaseDb) {
      let isResolved = false;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.warn("Firebase SDK leaderboard fetch timed out. Falling back to REST API.");
          fetchViaREST();
        }
      }, 2500);

      firebaseDb.ref('scores').once('value')
        .then(snapScores => {
          return firebaseDb.ref('scores/dorms').once('value').then(snapDorms => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutId);
            const combined = {};
            if (snapScores.val() && typeof snapScores.val() === 'object') {
              Object.assign(combined, snapScores.val());
            }
            if (snapDorms.val() && typeof snapDorms.val() === 'object') {
              Object.assign(combined, snapDorms.val());
            }
            processLeaderboardData(combined);
          });
        })
        .catch(err => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeoutId);
          console.warn("Firebase SDK fetch failed. Falling back to REST API:", err);
          fetchViaREST();
        });
      return;
    }

    if (firebaseRetryCount < 3) {
      firebaseRetryCount++;
      setTimeout(fetchLeaderboard, 400);
    } else {
      fetchViaREST();
    }
  }

  // Only this game's records (reject missing gameId — those belong to other/legacy shared dumps)
  const CONGRUENCE_GAME_IDS = new Set(['congruence', 'triangle', 'congruence_game']);
  function isCongruenceScore(entry) {
    const id = String((entry && entry.gameId) || '').trim();
    return CONGRUENCE_GAME_IDS.has(id);
  }

  function processLeaderboardData(dataObj) {
    if (!dataObj) return;
    const userBestMap = new Map();

    const collectNodes = (obj, isDormsSubtree = false) => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const item = obj[key];
        if (!item || typeof item !== 'object') return;

        if (item.name) {
          if (!isCongruenceScore(item)) return;

          const valName = sanitizeInput(item.name, 12);
          const valStudentId = String(item.studentId || '').trim();
          const valChannel = String(item.channel || '').trim();
          const isDormsEntry = isDormsSubtree || (valStudentId === 'DORMS' || valStudentId === 'DOREMS' || valChannel === 'dorms' || valChannel === 'dorems' || key === 'dorms');
          const score = Math.max(0, Math.min(500, parseInt(item.score, 10) || 0));

          const matchesMode = (activeMode === 'dorms') ? (isDormsEntry || !valStudentId || valStudentId === 'DORMS') : (!isDormsEntry);
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
        } else {
          collectNodes(item, key === 'dorms' || isDormsSubtree);
        }
      });
    };

    collectNodes(dataObj);

    const list = Array.from(userBestMap.values()).sort((a, b) => b.score - a.score);
    const top20 = list.slice(0, 20);

    if (top20.length > 0) {
      const champ = top20[0];
      if (openingChampName) openingChampName.textContent = champ.name || '도전자';
      if (openingChampId) {
        if (activeMode === 'school') {
          openingChampId.textContent = champ.studentId ? `학번: ${champ.studentId}` : '학번: —';
          openingChampId.style.display = 'inline';
        } else {
          openingChampId.style.display = 'none';
        }
      }
      if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
    } else {
      if (openingChampName) openingChampName.textContent = '도전자';
      if (openingChampId) openingChampId.textContent = activeMode === 'school' ? '학번: —' : '';
      if (openingChampScore) openingChampScore.innerHTML = `0<small>점</small>`;
    }

    renderLeaderboardTable(openingLeaderboardTbody, top20);
    renderLeaderboardTable(modalLeaderboardTbody, top20);
    renderLeaderboardTable(gameoverLeaderboardTbody, top20);
  }

  function updateTableHeadersMode() {
    const studentIdHeaders = document.querySelectorAll('.th-student-id');
    studentIdHeaders.forEach(th => {
      th.style.display = (activeMode === 'school') ? '' : 'none';
    });
  }

  function renderLeaderboardTable(tbodyEl, list) {
    if (!tbodyEl) return;
    updateTableHeadersMode();
    tbodyEl.innerHTML = '';

    const colSpan = activeMode === 'school' ? 4 : 3;

    if (!list || list.length === 0) {
      tbodyEl.innerHTML = `<tr><td colspan="${colSpan}" style="padding:15px; color:#64748b; text-align:center;">아직 등록된 기록이 없습니다. 첫 점수를 등록해 보세요!</td></tr>`;
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
        idTd = `<td>${escapeHtml(item.studentId || '—')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${item.score}점</strong></td>
      `;
      tbodyEl.appendChild(tr);
    });
  }

  // ----------------------------------------------------
  // User Profile Registration & Sync
  // ----------------------------------------------------
  function updateProfileDisplay() {
    if (playerName) {
      displayProfileName.textContent = playerName;
      if (activeMode === 'school') {
        displayProfileId.textContent = studentId ? `학번: ${studentId}` : '학번: —';
      } else {
        displayProfileId.style.display = 'none';
      }
    } else {
      displayProfileName.textContent = '—';
      if (activeMode === 'school') {
        displayProfileId.textContent = '학번: —';
      }
    }
  }

  // Pre-fill profile inputs on load
  function openProfileModal() {
    fillNicknameInput();
    if (activeMode === 'school' && inputStudentId) inputStudentId.value = studentId || '';
    if (profileModal) {
      profileModal.classList.remove('hidden');
      profileModal.style.display = 'flex';
    }
  }

  const userProfileCard = document.querySelector('.user-profile-card');
  if (userProfileCard) {
    userProfileCard.style.cursor = 'pointer';
    userProfileCard.addEventListener('click', openProfileModal);
  }
  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileModal();
    });
  }

  openProfileModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCongruenceGame);
} else {
  initCongruenceGame();
}
