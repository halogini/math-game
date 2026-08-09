/**
 * 📐 삼각형의 비밀: 합동 판정 작전! - Game Engine
 * 
 * 7th Grade Math - Triangle Congruence (SSS, SAS, ASA) & Counter-Example Debugger
 * HaloMath Arcade Channel Isolated Edition
 */

// Dynamic Firebase Configuration
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

let firebaseDb = null;
if (window.firebase) {
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

  const nameStorageKey = `congruence_name_${activeMode}`;
  const idStorageKey = `congruence_id_${activeMode}`;
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

  let playerName = sanitizeInput(safeGetStorage(nameStorageKey), 12);
  let studentId = activeMode === 'school' ? sanitizeInput(safeGetStorage(idStorageKey), 10) : '';
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
  let bonusAngleKeys = new Set(); // angle keys that were auto-revealed for free (see registerMeasurement)
  let hoverTarget = null; // { type: 'side'|'angle', key: 'AB', sideIndex: 0, triangle: 'L'|'R' }
  let successAnimReqId = null;
  let failureAnimReqId = null;

  // Preset Clue State
  let currentPresetType = 'TWO_SIDES'; // 'TWO_SIDES' | 'SIDE_AND_ANGLE' | 'SIDE_AND_TWO_ANGLES'
  let currentPresetCount = 2;
  let presetAngleKeys = [];

  // Canvas References
  const canvas = document.getElementById('geometry-canvas');
  const ctx = canvas.getContext('2d');
  const ceCanvas = document.getElementById('ce-canvas');
  const ceCtx = ceCanvas ? ceCanvas.getContext('2d') : null;

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

  const btnSubmitDecision = document.getElementById('btn-submit-decision');

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
  hudHighScore.textContent = highScore;

  // Sound Toggle Listener
  btnSoundToggle.addEventListener('click', () => {
    sounds.muted = !sounds.muted;
    btnSoundToggle.textContent = sounds.muted ? '🔇' : '🔊';
  });

  // Tool Switching
  toolRuler.addEventListener('click', () => setTool('ruler'));
  toolProtractor.addEventListener('click', () => setTool('protractor'));

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

  // Pre-fill profile inputs from localStorage on load
  if (inputPlayerName) inputPlayerName.value = playerName;
  if (inputStudentId) inputStudentId.value = studentId;
  if (activeMode !== 'school' && studentIdGroup) {
    studentIdGroup.style.display = 'none';
  }

  let isTimerPaused = true;

  // Always show Opening Modal on page load & pre-render Round 1 Triangles
  initGame();
  fetchLeaderboard();
  if (profileModal) profileModal.classList.remove('hidden');

  function initGame() {
    currentRound = 1;
    totalScore = 0;
    correctCount = 0;
    perfectCount = 0;
    ceCount = 0;
    hudScore.textContent = '0';
    fetchLeaderboard();
    startRound(currentRound);
  }

  // ----------------------------------------------------
  // Round Generation & Math Calculations
  // ----------------------------------------------------
  function startRound(roundNum) {
    if (successAnimReqId) { cancelAnimationFrame(successAnimReqId); successAnimReqId = null; }
    if (failureAnimReqId) { cancelAnimationFrame(failureAnimReqId); failureAnimReqId = null; }

    hudRound.textContent = `${roundNum} / ${maxRounds}`;
    measuredSet.clear();
    bonusAngleKeys.clear();
    userClickSet.clear();
    hoverTarget = null; // Clear any stale hover/selection highlight left over from the previous round
    uncheckRadios();

    // Generate Triangle Data based on Round Preset
    generateRoundData(roundNum);

    // Update Clues UI with preset starting hints
    updateCluesUI();

    // Reset Timer (60s)
    roundTimeLeft = 60;
    updateTimerUI();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (isTimerPaused) return;
      roundTimeLeft--;
      updateTimerUI();
      if (roundTimeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeOut();
      }
    }, 1000);

    renderCanvas();
  }

  function uncheckRadios() {
    const radios = document.getElementsByName('congruence-cond');
    radios.forEach(r => r.checked = false);
  }

  function updateTimerUI() {
    hudTimer.textContent = `${roundTimeLeft}s`;
    const pct = Math.max(0, (roundTimeLeft / 60) * 100);
    timerBar.style.width = `${pct}%`;
    if (pct < 30) {
      timerBar.classList.add('warning');
    } else {
      timerBar.classList.remove('warning');
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
    if (round === 1) {
      trueTheorem = 'SSS';
    } else if (round === 2) {
      trueTheorem = 'SAS';
    } else if (round === 3) {
      trueTheorem = 'ASA';
    } else if (round === 4) {
      trueTheorem = 'SAS';
    } else {
      trueTheorem = 'ASA';
    }

    // Base Triangle Parameters: Base = b, Side2 = a, Angle between = C
    const b = 120 + Math.floor(Math.random() * 40); // 120~160 px
    const a = 110 + Math.floor(Math.random() * 40); // 110~150 px
    const angleC_deg = 45 + Math.floor(Math.random() * 50); // 45~95 deg
    const radC = (angleC_deg * Math.PI) / 180;

    // Compute 3rd side c and angles A, B
    const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(radC));
    const angleA_deg = (Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180) / Math.PI;
    const angleB_deg = 180 - angleC_deg - angleA_deg;

    // Scale Factor for cm display (e.g. 20px = 1cm)
    const pxPerCm = 20;

    // Left Triangle Vertices (A, B, C)
    const centerL = { x: 230, y: 220 };
    const pC_L = { x: centerL.x - b / 2, y: centerL.y + 40 };
    const pA_L = { x: centerL.x + b / 2, y: centerL.y + 40 };
    const pB_L = {
      x: pC_L.x + a * Math.cos(radC),
      y: pC_L.y - a * Math.sin(radC)
    };

    triangleLeft = {
      labels: ['A', 'B', 'C'],
      pts: [pA_L, pB_L, pC_L],
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

    // Right Triangle Vertices (D, E, F)
    const centerR = { x: 670, y: 220 };
    let rot = (round === 5 || round === 1) ? Math.PI / 4 : (Math.random() * 0.3 - 0.15); // Rotation angle

    let rightA = angleA_deg, rightB = angleB_deg, rightC = angleC_deg;
    let right_a = a, right_b = b, right_c = c;

    const radC_R = (rightC * Math.PI) / 180;
    const pF_R = { x: 0, y: 0 };
    const pD_R = { x: right_b, y: 0 };
    const pE_R = { x: right_a * Math.cos(radC_R), y: -right_a * Math.sin(radC_R) };

    // Apply Rotation & Offset to Right Triangle
    const rawPts = [pD_R, pE_R, pF_R];
    const rotatedPts = rawPts.map(pt => ({
      x: centerR.x + (pt.x - right_b / 2) * Math.cos(rot) - (pt.y + 20) * Math.sin(rot),
      y: centerR.y + (pt.x - right_b / 2) * Math.sin(rot) + (pt.y + 20) * Math.cos(rot)
    }));

    const right_c_calc = Math.sqrt(right_a * right_a + right_b * right_b - 2 * right_a * right_b * Math.cos(radC_R));

    triangleRight = {
      labels: ['D', 'E', 'F'],
      pts: rotatedPts,
      sidesCm: [
        parseFloat((right_c_calc / pxPerCm).toFixed(1)), // DE (side 0)
        parseFloat((right_a / pxPerCm).toFixed(1)),      // EF (side 1)
        parseFloat((right_b / pxPerCm).toFixed(1))       // FD (side 2)
      ],
      anglesDeg: [
        Math.round(rightA),
        Math.round(rightB),
        Math.round(rightC)
      ]
    };

    // Pre-measure 1 or 2 clues on Right Triangle automatically as puzzle starting hints!
    presetAngleKeys = [];
    if (round === 1) {
      currentPresetType = 'TWO_SIDES';
      currentPresetCount = 2;
      measuredSet.add('R_side_DE');
      measuredSet.add('R_side_EF');
    } else if (round === 2) {
      currentPresetType = 'SIDE_AND_ANGLE';
      currentPresetCount = 2;
      measuredSet.add('R_side_DE');
      measuredSet.add('R_angle_E');
      presetAngleKeys.push('R_angle_E');
    } else if (round === 3) {
      currentPresetType = 'SIDE_AND_ANGLE';
      currentPresetCount = 2;
      measuredSet.add('R_side_EF');
      measuredSet.add('R_angle_F');
      presetAngleKeys.push('R_angle_F');
    } else if (round === 4) {
      currentPresetType = 'SIDE_AND_ANGLE';
      currentPresetCount = 2;
      measuredSet.add('R_side_FD');
      measuredSet.add('R_angle_D');
      presetAngleKeys.push('R_angle_D');
    } else {
      currentPresetType = 'SIDE_AND_TWO_ANGLES';
      currentPresetCount = 3;
      measuredSet.add('R_side_DE');
      measuredSet.add('R_angle_D');
      measuredSet.add('R_angle_E');
      presetAngleKeys.push('R_angle_D', 'R_angle_E');
    }
  }

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
    ctx.font = 'bold 16px Jua';
    ctx.fillText('🔺 삼각형 △ABC', 50, 32);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
    ctx.fillText('🔻 삼각형 △DEF', 490, 32);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath(); ctx.moveTo(450, 20); ctx.lineTo(450, 400); ctx.stroke();

    // Draw Triangles
    drawSingleTriangle(triangleLeft, 'L');
    drawSingleTriangle(triangleRight, 'R');

    // Draw Tool Hover Overlay
    if (hoverTarget) {
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
        drawBadge(badgeX, badgeY, `${sideNames[i]} = ${tri.sidesCm[i]}`, '#f59e0b', true, sideNames[i]);
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
        drawAngleArc(pt, prevPt, nextPt, `∠${angleNames[i]} = ${tri.anglesDeg[i]}°`, '#8b5cf6', centroid);
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
        registerMeasurement(target, key);
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

  // ----------------------------------------------------
  // Auto-reveal the 3rd angle once 2 angles of the same triangle are known
  // ("삼각형의 세 내각의 합은 180˚" — this is prior knowledge, not a new fact,
  // so it should never cost a separate measurement or read as a new/ambiguous
  // situation. This also means a player who measures two angles + one side
  // always ends up with all three angles known, so there's never a case where
  // it matters *which* side they picked — it always behaves like "한 변과
  // 그 양 끝각" (ASA), and the AAS distinction never needs to come up.)
  // ----------------------------------------------------
  function registerMeasurement(target, key) {
    if (target.type !== 'angle') return;
    const triangleTag = target.triangle;
    const angleNames = triangleTag === 'L' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
    const angleKeys = angleNames.map(n => `${triangleTag}_angle_${n}`);
    const measuredCount = angleKeys.filter(k => measuredSet.has(k)).length;

    if (measuredCount === 2) {
      const missingKey = angleKeys.find(k => !measuredSet.has(k));
      if (missingKey && !measuredSet.has(missingKey)) {
        measuredSet.add(missingKey);
        bonusAngleKeys.add(missingKey);
      }
    }
  }

  function findTargetAt(mx, my) {
    // Check Triangle Left
    const targetL = checkTriangleTarget(triangleLeft, 'L', mx, my);
    if (targetL) return targetL;
    // Check Triangle Right
    return checkTriangleTarget(triangleRight, 'R', mx, my);
  }

  function checkTriangleTarget(tri, sideTag, mx, my) {
    if (!tri) return null;

    // Check Angles (Vertices) first
    for (let i = 0; i < 3; i++) {
      const pt = tri.pts[i];
      const dist = Math.hypot(mx - pt.x, my - pt.y);
      if (dist < 20 && activeTool === 'protractor') {
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
      if (dist < 12 && activeTool === 'ruler') {
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
      const isBonus = bonusAngleKeys.has(key);
      const icon = isBonus ? '🎁' : (isAngle ? '📐' : '📏');
      const labelHtml = isAngle
        ? `${icon} ∠${parts[2]}`
        : `${icon} <span style="text-decoration: overline; border-top: 1.5px solid currentColor; padding-top: 1px;">${parts[2]}</span>`;
      const tagSpan = document.createElement('span');
      tagSpan.className = `clue-tag ${isAngle ? 'angle-tag' : ''} ${isBonus ? 'bonus-tag' : ''}`;
      tagSpan.innerHTML = labelHtml;
      if (isBonus) tagSpan.title = '나머지 각은 삼각형의 세 내각의 합(180˚)으로 자동으로 알 수 있어요!';
      cluesContainer.appendChild(tagSpan);
    });
  }

  // ----------------------------------------------------
  // Judgment Submission & Scoring Logic
  // ----------------------------------------------------
  btnSubmitDecision.addEventListener('click', () => {
    evaluateDecision('SUBMIT');
  });

  function evaluateDecision(claim) {
    if (timerInterval) clearInterval(timerInterval);

    const measuredCount = measuredSet.size;

    // Check corresponding measured pairs between Left and Right triangles
    let sidePairs = 0;
    let anglePairs = 0;
    const pairedSides = [false, false, false];
    const pairedAngles = [false, false, false];
    const sideNames = ['AB', 'BC', 'CA', 'DE', 'EF', 'FD'];
    const angleNames = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (let i = 0; i < 3; i++) {
      if (measuredSet.has(`L_side_${sideNames[i]}`) && measuredSet.has(`R_side_${sideNames[i+3]}`)) {
        sidePairs++;
        pairedSides[i] = true;
      }
      if (measuredSet.has(`L_angle_${angleNames[i]}`) && measuredSet.has(`R_angle_${angleNames[i+3]}`)) {
        anglePairs++;
        pairedAngles[i] = true;
      }
    }

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

    const pairedSideIdx = [0, 1, 2].filter(i => pairedSides[i]);
    const pairedAngleIdx = [0, 1, 2].filter(i => pairedAngles[i]);

    const hasSSS = pairedSideIdx.length === 3;

    // SAS: 2 measured+paired sides whose SHARED (included) vertex angle is also measured+paired.
    let hasSAS = false;
    for (let a = 0; a < pairedSideIdx.length && !hasSAS; a++) {
      for (let b = a + 1; b < pairedSideIdx.length && !hasSAS; b++) {
        const v = sharedVertexOfSides(pairedSideIdx[a], pairedSideIdx[b]);
        if (pairedAngleIdx.includes(v)) hasSAS = true;
      }
    }

    // ASA: a measured+paired side whose two endpoints are both measured+paired angles.
    // If all 3 angles ended up known (thanks to the free 3rd-angle reveal above), the
    // "which side" question disappears entirely — any one paired side is enough, so this
    // naturally covers what would otherwise be called "AAS" without ever naming it.
    let hasASA = false;
    if (pairedAngleIdx.length === 3 && pairedSideIdx.length >= 1) {
      hasASA = true;
    } else {
      for (let a = 0; a < pairedAngleIdx.length && !hasASA; a++) {
        for (let b = a + 1; b < pairedAngleIdx.length && !hasASA; b++) {
          const s = sideBetweenVertices(pairedAngleIdx[a], pairedAngleIdx[b]);
          if (s !== -1 && pairedSideIdx.includes(s)) hasASA = true;
        }
      }
    }

    const isValidProof = hasSSS || hasSAS || hasASA;

    if (!isValidProof) {
      ceCount++;
      sounds.playCounterExample();
      let ceType = 'UNDER_MEASURED';
      let msg = '🚨 두 삼각형이 완전히 포개지는 지 확신하려면 더 많은 측정값이 필요합니다.';

      if (pairedAngleIdx.length >= 2 && pairedSideIdx.length === 0) {
        ceType = 'AAA_TRAP';
        msg = '🚨 각도만 측정하면 모양은 같아도 크기가 다른 삼각형이 만들어질 수 있습니다! 변도 측정해보세요.';
      } else if (pairedSideIdx.length === 2 && pairedAngleIdx.length >= 1) {
        ceType = 'SSA_TRAP';
        msg = '🚨 지금 잰 치수만으로는 모양이 두 가지로 나올 수 있어요. 다른 변이나 각을 측정해보세요.';
      }

      playFailureAnimation(ceType, msg, pairedSides, pairedAngles, () => {
        showResultModal(false, '0점', msg, ceType, getMathNoteText(ceType));
      });
    } else {
      // SUCCESSFUL CONGRUENCE PROOF! Check multiple valid optimal routes
      let utilizedPresetAngle = true;
      if (currentPresetType === 'SIDE_AND_ANGLE' || currentPresetType === 'SIDE_AND_TWO_ANGLES') {
        let angleUsed = false;
        presetAngleKeys.forEach(k => {
          const targetLeftKey = k.replace('R_angle_D', 'L_angle_A').replace('R_angle_E', 'L_angle_B').replace('R_angle_F', 'L_angle_C');
          if (measuredSet.has(targetLeftKey) || measuredSet.has(k)) {
            angleUsed = true;
          }
        });
        utilizedPresetAngle = angleUsed;
      }

      let isOptimalRoute = false;
      let routeName = '';

      if (currentPresetType === 'TWO_SIDES') {
        if (hasSSS) {
          isOptimalRoute = true;
          routeName = '세 변의 길이가 같음';
        } else if (hasSAS) {
          isOptimalRoute = true;
          routeName = '두 변과 그 사이 끼인각이 같음';
        }
      } else if (currentPresetType === 'SIDE_AND_ANGLE') {
        if (hasSAS && utilizedPresetAngle) {
          isOptimalRoute = true;
          routeName = '두 변과 그 사이 끼인각이 같음';
        } else if (hasASA && utilizedPresetAngle) {
          isOptimalRoute = true;
          routeName = '한 변과 그 양 끝각이 같음';
        }
      } else if (currentPresetType === 'SIDE_AND_TWO_ANGLES') {
        if (hasASA && utilizedPresetAngle) {
          isOptimalRoute = true;
          routeName = '한 변과 그 양 끝각이 같음';
        }
      }

      const isWastedExtra = measuredCount > 6;

      // Dynamic scoring out of 100 max per round
      // User-selected method: "측정 횟수 단순 차감 방식"
      const userClickCount = userClickSet.size; // Direct clicks by student
      const presetClueCount = measuredSet.size - userClickCount;
      const minRequiredUserClicks = Math.max(1, 6 - Math.min(5, presetClueCount));
      const extraClicks = Math.max(0, userClickCount - minRequiredUserClicks);
      const timeBonus = Math.min(30, Math.floor((roundTimeLeft / 60) * 30)); // max 30 pts

      if (extraClicks === 0) {
        // PERFECT OPTIMAL SCORE! (100 만점 가능!)
        const points = 70 + timeBonus; // 70 + 30 = 100 max!

        totalScore += points;
        correctCount++;
        perfectCount++;
        hudScore.textContent = totalScore;

        playSuccessAnimation(() => {
          sounds.playSuccess();
          showResultModal(
            true,
            points === 100 ? '🌟 100점 만점!' : `🌟 +${points}점`,
            `🎯 군더더기 없는 최적의 측정(${userClickCount}회)으로 합동 입증 성공!`,
            null,
            `주어진 힌트를 활용해 '${routeName}' 조건으로 깔끔하게 입증했습니다.`
          );
        });
      } else {
        // DYNAMIC INEFFICIENT SCORE (15 pts lost per extra direct user click)
        const inefficiencyPenalty = 15 * extraClicks;
        const baseScore = Math.max(10, 70 - inefficiencyPenalty);
        const points = Math.min(99, Math.max(10, baseScore + timeBonus));
        
        totalScore += points;
        correctCount++;
        hudScore.textContent = totalScore;

        playSuccessAnimation(() => {
          sounds.playSuccess();
          highlightInefficientClues();
          showResultModal(
            true,
            `+${points}점 (불필요한 측정 -${inefficiencyPenalty}점)`,
            `⚠️ 합동 입증은 성공했지만, 추가 측정(${extraClicks}회)이 포함되었습니다.`,
            null,
            `필수 치수만으로 최소 입증 시 100점 만점을 받을 수 있습니다.`
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
      case 'SSA_TRAP':
        return '두 변이 같을 때, 그 사이의 각(끼인각)이 아니면 삼각형의 모양이 달라질 수 있습니다.';
      case 'UNDER_MEASURED':
      default:
        return '두 삼각형이 완전히 포개지는 지 확신하려면 더 많은 측정값이 필요합니다.';
    }
  }

  function handleTimeOut() {
    ceCount++;
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
  function showResultModal(isSuccess, scoreBadgeText, subtitle, ceType, mathNote) {
    resultScoreBadge.textContent = scoreBadgeText;
    resultSubtitle.textContent = subtitle;
    mathNoteText.textContent = mathNote;

    if (isSuccess) {
      resultHeader.style.color = '#10b981';
      resultIcon.textContent = '🌟';
      resultTitle.textContent = '판정 성공!';
      counterExampleBox.style.display = 'none';
    } else {
      resultHeader.style.color = '#ef4444';
      resultIcon.textContent = '🚨';
      resultTitle.textContent = '판정 실패';
      counterExampleBox.style.display = 'none'; // We now do CE on main canvas, so hide this in modal
    }

    if (currentRound >= maxRounds) {
      btnNextRound.textContent = '🏆 최종 결과 확인하기 ➔';
    } else {
      btnNextRound.textContent = '다음 라운드로 진입 ➔';
    }

    resultModal.classList.remove('hidden');
  }

  btnNextRound.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    if (currentRound < maxRounds) {
      currentRound++;
      startRound(currentRound);
    } else {
      showGameOverModal();
    }
  });

  // Success Animation Logic
  function playSuccessAnimation(onComplete) {
    if (successAnimReqId) cancelAnimationFrame(successAnimReqId);
    let startTime = null;
    
    // Disable tool hover during animation
    const oldHover = hoverTarget;
    hoverTarget = null;
    
    // Store original right triangle points
    const originalRightPts = triangleRight.pts.map(p => ({x: p.x, y: p.y}));
    
    function animateSuccess(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 1500, 1.0); // 1.5 second animation
      
      // Easing function (easeInOutCubic)
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      // Interpolate right points towards left points
      triangleRight.pts = originalRightPts.map((pt, i) => {
        const targetPt = triangleLeft.pts[i];
        return {
          x: pt.x + (targetPt.x - pt.x) * ease,
          y: pt.y + (targetPt.y - pt.y) * ease
        };
      });
      
      renderCanvas();
      
      if (progress < 1.0) {
        successAnimReqId = requestAnimationFrame(animateSuccess);
      } else {
        hoverTarget = oldHover;
        if (onComplete) onComplete();
      }
    }
    
    successAnimReqId = requestAnimationFrame(animateSuccess);
  }

  // Failure Animation Logic on Main Canvas
  function playFailureAnimation(ceType, msg, pairedSides, pairedAngles, onComplete) {
    if (failureAnimReqId) cancelAnimationFrame(failureAnimReqId);
    let startTime = null;
    const oldHover = hoverTarget;
    hoverTarget = null;
    
    const originalRightPts = triangleRight.pts.map(p => ({x: p.x, y: p.y}));
    
    let notified = false;
    
    const isMeasuredSideL = [measuredSet.has('L_side_AB'), measuredSet.has('L_side_BC'), measuredSet.has('L_side_CA')];
    const isMeasuredAngleL = [measuredSet.has('L_angle_A'), measuredSet.has('L_angle_B'), measuredSet.has('L_angle_C')];
    const numMeasuredSidesL = (isMeasuredSideL[0]?1:0) + (isMeasuredSideL[1]?1:0) + (isMeasuredSideL[2]?1:0);
    const numMeasuredAnglesL = (isMeasuredAngleL[0]?1:0) + (isMeasuredAngleL[1]?1:0) + (isMeasuredAngleL[2]?1:0);
    const isRigidL = (numMeasuredSidesL === 3) || (numMeasuredSidesL === 2 && numMeasuredAnglesL >= 1 && ceType !== 'SSA_TRAP') || (numMeasuredSidesL === 1 && numMeasuredAnglesL >= 2);

    const isMeasuredSideR = [measuredSet.has('R_side_DE'), measuredSet.has('R_side_EF'), measuredSet.has('R_side_FD')];
    const isMeasuredAngleR = [measuredSet.has('R_angle_D'), measuredSet.has('R_angle_E'), measuredSet.has('R_angle_F')];
    const numMeasuredSidesR = (isMeasuredSideR[0]?1:0) + (isMeasuredSideR[1]?1:0) + (isMeasuredSideR[2]?1:0);
    const numMeasuredAnglesR = (isMeasuredAngleR[0]?1:0) + (isMeasuredAngleR[1]?1:0) + (isMeasuredAngleR[2]?1:0);
    const isRigidR = (numMeasuredSidesR === 3) || (numMeasuredSidesR === 2 && numMeasuredAnglesR >= 1 && ceType !== 'SSA_TRAP') || (numMeasuredSidesR === 1 && numMeasuredAnglesR >= 2);

    let wiggleTarget = 'R';
    if (isRigidR && !isRigidL) wiggleTarget = 'L';
    
    function animateFailure(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progressOverlaping = Math.min(elapsed / 1500, 1.0); // 0 to 1.5s: move to overlap
      const progressWiggling = Math.max(0, (elapsed - 1500) / 1000); // 1.5s+: wiggle infinitely
      
      const easeOverlap = progressOverlaping < 0.5 ? 4 * progressOverlaping * Math.pow(progressOverlaping, 2) : 1 - Math.pow(-2 * progressOverlaping + 2, 3) / 2;
      
      let p0_R = {x: originalRightPts[0].x, y: originalRightPts[0].y};
      let p1_R = {x: originalRightPts[1].x, y: originalRightPts[1].y};
      let p2_R = {x: originalRightPts[2].x, y: originalRightPts[2].y};
      
      let p0_L = {x: triangleLeft.pts[0].x, y: triangleLeft.pts[0].y};
      let p1_L = {x: triangleLeft.pts[1].x, y: triangleLeft.pts[1].y};
      let p2_L = {x: triangleLeft.pts[2].x, y: triangleLeft.pts[2].y};
      
      // Phase 1: Overlap target triangle
      p0_R.x += (p0_L.x - p0_R.x) * easeOverlap;
      p0_R.y += (p0_L.y - p0_R.y) * easeOverlap;
      p1_R.x += (p1_L.x - p1_R.x) * easeOverlap;
      p1_R.y += (p1_L.y - p1_R.y) * easeOverlap;
      p2_R.x += (p2_L.x - p2_R.x) * easeOverlap;
      p2_R.y += (p2_L.y - p2_R.y) * easeOverlap;
      
      // Phase 2: Wiggle with 100% invariant measured lengths and angles
      if (progressWiggling > 0) {
        const t = Math.sin(progressWiggling * Math.PI * 2);
        
        let p0, p1, p2, isMeasuredSide, isMeasuredAngle, numMeasuredSides, numMeasuredAngles, isRigid;
        
        if (wiggleTarget === 'L') {
          p0 = p0_L; p1 = p1_L; p2 = p2_L;
          isMeasuredSide = isMeasuredSideL; isMeasuredAngle = isMeasuredAngleL;
          numMeasuredSides = numMeasuredSidesL; numMeasuredAngles = numMeasuredAnglesL;
          isRigid = isRigidL;
        } else {
          p0 = p0_R; p1 = p1_R; p2 = p2_R;
          isMeasuredSide = isMeasuredSideR; isMeasuredAngle = isMeasuredAngleR;
          numMeasuredSides = numMeasuredSidesR; numMeasuredAngles = numMeasuredAnglesR;
          isRigid = isRigidR;
        }

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

        if (isRigid) {
          const centroid = { x: (p0.x+p1.x+p2.x)/3, y: (p0.y+p1.y+p2.y)/3 };
          const rotatePt = (pt, center, angle) => {
            const dx = pt.x - center.x, dy = pt.y - center.y;
            return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
          };
          p0 = rotatePt(p0, centroid, t * 0.15);
          p1 = rotatePt(p1, centroid, t * 0.15);
          p2 = rotatePt(p2, centroid, t * 0.15);
        } else if (numMeasuredSides === 0) {
          if (numMeasuredAngles >= 2) {
            // AAA: Scale relative to centroid. All interior angles are 100% invariant! No side length badges exist.
            const centroid = { x: (p0.x+p1.x+p2.x)/3, y: (p0.y+p1.y+p2.y)/3 };
            const scale = 1.0 + 0.3 * t;
            p0 = { x: centroid.x + (p0.x - centroid.x) * scale, y: centroid.y + (p0.y - centroid.y) * scale };
            p1 = { x: centroid.x + (p1.x - centroid.x) * scale, y: centroid.y + (p1.y - centroid.y) * scale };
            p2 = { x: centroid.x + (p2.x - centroid.x) * scale, y: centroid.y + (p2.y - centroid.y) * scale };
          } else if (numMeasuredAngles === 1) {
            // 1 Angle measured, 0 sides. The angle's vertex is fixed, and the two sides forming it scale independently!
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
        } else if (numMeasuredSides === 2 && numMeasuredAngles >= 1 && ceType === 'SSA_TRAP') {
          // SSA TRAP: Smoothly oscillate to the other valid root!
          let refBase, refDrop, refMove;
          if (isMeasuredSide[0] && isMeasuredSide[1]) {
             if (isMeasuredAngle[0]) { refBase = p0; refDrop = p1; refMove = p2; }
             else if (isMeasuredAngle[2]) { refBase = p2; refDrop = p1; refMove = p0; }
          } else if (isMeasuredSide[1] && isMeasuredSide[2]) {
             if (isMeasuredAngle[1]) { refBase = p1; refDrop = p2; refMove = p0; }
             else if (isMeasuredAngle[0]) { refBase = p0; refDrop = p2; refMove = p1; }
          } else if (isMeasuredSide[2] && isMeasuredSide[0]) {
             if (isMeasuredAngle[2]) { refBase = p2; refDrop = p0; refMove = p1; }
             else if (isMeasuredAngle[1]) { refBase = p1; refDrop = p0; refMove = p2; }
          }
          if (refBase && refDrop && refMove) {
            const ux0 = refMove.x - refBase.x, uy0 = refMove.y - refBase.y;
            const uLen = Math.hypot(ux0, uy0);
            if (uLen > 0.0001) {
              const ux = ux0 / uLen, uy = uy0 / uLen; // fixed ray direction — this IS the measured angle
              const L = Math.hypot(refDrop.x - refMove.x, refDrop.y - refMove.y); // fixed side length to preserve
              const vx = refDrop.x - refBase.x, vy = refDrop.y - refBase.y;
              const vDotU = vx * ux + vy * uy;
              const vLen2 = vx * vx + vy * vy;
              const disc = vDotU * vDotU - (vLen2 - L * L);
              if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const sCurrent = uLen;
                const sA = vDotU + sqrtDisc;
                const sB = vDotU - sqrtDisc;
                let sTarget = null;
                if (Math.abs(sA - sCurrent) > 0.5 && sA > 0.01) sTarget = sA;
                else if (Math.abs(sB - sCurrent) > 0.5 && sB > 0.01) sTarget = sB;

                if (sTarget !== null) {
                  const blend = (1 - Math.cos(progressWiggling * Math.PI * 2)) / 2;
                  const sNow = sCurrent + (sTarget - sCurrent) * blend;
                  refMove.x = refBase.x + ux * sNow;
                  refMove.y = refBase.y + uy * sNow;
                }
              }
            }
          }
        } else if (numMeasuredSides === 2) {
          // 2 sides measured. Hinge around the shared vertex! Both side lengths are 100% INVARIANT!
          const rotatePt = (pt, center, angle) => {
            const dx = pt.x - center.x, dy = pt.y - center.y;
            return { x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
          };
          
          if (isMeasuredSide[0] && isMeasuredSide[1]) {
            p2 = rotatePt(p2, p1, t * 0.4);
          } else if (isMeasuredSide[1] && isMeasuredSide[2]) {
            p0 = rotatePt(p0, p2, t * 0.4);
          } else if (isMeasuredSide[2] && isMeasuredSide[0]) {
            p1 = rotatePt(p1, p0, t * 0.4);
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
        if (wiggleTarget === 'L') {
          p0_L = p0; p1_L = p1; p2_L = p2;
        } else {
          p0_R = p0; p1_R = p1; p2_R = p2;
        }
      }
      
      const prevLeftPts = triangleLeft.pts;
      triangleLeft.pts = [p0_L, p1_L, p2_L];
      triangleRight.pts = [p0_R, p1_R, p2_R];
      renderCanvas();
      triangleLeft.pts = prevLeftPts;
      
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
      } else if (ceType === 'SSA_TRAP') {
        // SSA: Point C swings along a circle centered at B, passing through original C
        // We'll approximate this by swinging C relative to A and B
        const swingAngle = sinWave * 0.4;
        const dx = cPts[2].x - cPts[1].x;
        const dy = cPts[2].y - cPts[1].y;
        cPts[2].x = cPts[1].x + dx * Math.cos(swingAngle) - dy * Math.sin(swingAngle);
        cPts[2].y = cPts[1].y + dx * Math.sin(swingAngle) + dy * Math.cos(swingAngle);
        ceExplanation.textContent = '🎬 두 변과 끼인각이 아닌 각이 주어지면, 남은 변이 이렇게 꺾이면서 전혀 다른 모양이 됩니다!';
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
      ceCtx.fillText('🚨 반례 △A"B"C"', centerCE.x - 30, centerCE.y + 70);

      animReqId = requestAnimationFrame(animateFrame);
    }

    animReqId = requestAnimationFrame(animateFrame);
  }

  // ----------------------------------------------------
  // Game Over & High Score Submission
  // ----------------------------------------------------
  function showGameOverModal() {
    finalTotalScore.textContent = totalScore;
    finalCorrectCount.textContent = `${correctCount} / ${maxRounds}`;
    finalPerfectCount.textContent = `${perfectCount} 회`;
    finalCeCount.textContent = `${ceCount} 회`;

    if (totalScore > highScore) {
      highScore = totalScore;
      safeSetStorage(highScoreStorageKey, highScore);
      hudHighScore.textContent = highScore;
      newHighscoreBanner.classList.remove('hidden');
    } else {
      newHighscoreBanner.classList.add('hidden');
    }

    if (resultLockedName) resultLockedName.textContent = playerName || '도전자';
    if (resultLockedId) resultLockedId.textContent = studentId || '미입력';
    if (resultLockedIdSpan) resultLockedIdSpan.style.display = (activeMode === 'school') ? 'inline' : 'none';

    if (btnSendData) {
      btnSendData.disabled = false;
      btnSendData.textContent = '🚀 점수 등록하기';
    }
    if (apiStatusMsg) apiStatusMsg.textContent = '';

    gameoverModal.classList.remove('hidden');
    fetchLeaderboard();
  }

  btnRestartGame.addEventListener('click', () => {
    gameoverModal.classList.add('hidden');
    initGame();
  });

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

  if (btnSendData) {
    btnSendData.addEventListener('click', async () => {
      btnSendData.disabled = true;
      btnSendData.textContent = '⏳ 등록 중...';
      const res = await saveScoreToFirebase(totalScore);
      if (apiStatusMsg) apiStatusMsg.textContent = res ? res.message : '🎉 점수가 등록되었습니다!';
      btnSendData.textContent = '✅ 등록 완료';
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

  function processLeaderboardData(dataObj) {
    if (!dataObj) return;
    const userBestMap = new Map();

    const collectNodes = (obj, isDormsSubtree = false) => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const item = obj[key];
        if (!item || typeof item !== 'object') return;

        if (item.name) {
          const valGameId = String(item.gameId || '').trim();
          if (valGameId !== 'congruence') return;

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
          openingChampId.textContent = champ.studentId ? `학번: ${champ.studentId}` : '학번: 미입력';
          openingChampId.style.display = 'inline';
        } else {
          openingChampId.style.display = 'none';
        }
      }
      if (openingChampScore) openingChampScore.innerHTML = `${champ.score}<small>점</small>`;
    } else {
      if (openingChampName) openingChampName.textContent = '도전자';
      if (openingChampId) openingChampId.textContent = activeMode === 'school' ? '학번: 미입력' : '';
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
        idTd = `<td>${escapeHtml(item.studentId || '미입력')}</td>`;
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

  async function saveScoreToFirebase(score) {
    if (!playerName) return { success: false, message: '❌ 참가자 이름이 입력되지 않았습니다.' };

    const payload = {
      name: playerName,
      studentId: activeMode === 'school' ? studentId : 'DORMS',
      channel: activeMode === 'school' ? 'school' : 'dorms',
      score: score,
      gameId: 'congruence',
      timestamp: (window.firebase && firebase.database && typeof firebase.database.ServerValue !== 'undefined') ? firebase.database.ServerValue.TIMESTAMP : Date.now()
    };

    const saveViaREST = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const restRes = await fetch('https://math-game-halogini-default-rtdb.firebaseio.com/scores.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (restRes.ok) {
          fetchLeaderboard();
          return { success: true, message: `✅ ${payload.score}점으로 랭킹에 성공적으로 등록되었습니다!` };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("REST score save error:", err);
      }
      return { success: false, message: '❌ 점수 등록 중 네트워크 오류가 발생했습니다.' };
    };

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), 2500);
    });

    const sdkSavePromise = (async () => {
      if (!firebaseDb) return null;
      try {
        const snapshot = await firebaseDb.ref('scores').once('value');
        const matchingKeys = [];
        let maxExistingScore = -1;

        snapshot.forEach(child => {
          const val = child.val();
          if (val && String(val.name).trim() === String(payload.name).trim()) {
            const valGameId = String(val.gameId || '').trim();
            if (valGameId !== 'congruence') return;

            const valStudentId = String(val.studentId || '').trim();
            const valChannel = String(val.channel || '').trim();
            const isDormsVal = (valStudentId === 'DORMS' || valStudentId === 'DOREMS' || valChannel === 'dorms' || valChannel === 'dorems');
            const isMatch = (activeMode === 'dorms' && isDormsVal)
                         || (activeMode === 'school' && !isDormsVal && valStudentId === String(payload.studentId).trim());
            if (isMatch) {
              matchingKeys.push({ key: child.key, score: parseInt(val.score, 10) || 0 });
              if ((parseInt(val.score, 10) || 0) > maxExistingScore) {
                maxExistingScore = parseInt(val.score, 10) || 0;
              }
            }
          }
        });

        let statusMsg = '';
        if (matchingKeys.length > 0) {
          const primaryKey = matchingKeys[0].key;
          if (payload.score > maxExistingScore) {
            await firebaseDb.ref(`scores/${primaryKey}`).update(payload);
            statusMsg = `🎉 최고 점수가 ${payload.score}점으로 성공적으로 갱신되었습니다!`;
          } else {
            statusMsg = `ℹ️ 기존 최고 점수(${maxExistingScore}점)가 현재 점수(${payload.score}점)보다 높거나 같아 갱신되지 않았습니다.`;
          }
          for (let i = 1; i < matchingKeys.length; i++) {
            await firebaseDb.ref(`scores/${matchingKeys[i].key}`).remove();
          }
        } else {
          await firebaseDb.ref('scores').push(payload);
          statusMsg = `✅ ${payload.score}점으로 랭킹에 성공적으로 등록되었습니다!`;
        }

        fetchLeaderboard();
        return { success: true, message: statusMsg };
      } catch (err) {
        return null;
      }
    })();

    const result = await Promise.race([sdkSavePromise, timeoutPromise]);
    if (result && !result.timeout) {
      return result;
    }

    return await saveViaREST();
  }

  // ----------------------------------------------------
  // User Profile Registration & Sync
  // ----------------------------------------------------
  function updateProfileDisplay() {
    if (playerName) {
      displayProfileName.textContent = playerName;
      if (activeMode === 'school') {
        displayProfileId.textContent = studentId ? `학번: ${studentId}` : '학번: 미입력';
      } else {
        displayProfileId.style.display = 'none';
      }
    } else {
      displayProfileName.textContent = '도전자 미등록';
      displayProfileId.textContent = '클릭하여 프로필 설정';
    }
  }

  // Pre-fill profile inputs on load
  if (inputPlayerName && !inputPlayerName.value) {
    inputPlayerName.value = playerName || '도전자';
  }

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
      inputPlayerName.value = playerName || '도전자';
      if (activeMode === 'school') inputStudentId.value = studentId || '미입력';
      profileModal.classList.remove('hidden');
    });
  }

  // Show profile modal on load
  if (profileModal) {
    profileModal.classList.remove('hidden');
  }

  const btnStartGame = profileForm ? profileForm.querySelector('button[type="submit"]') : null;

  function handleStartGame(e) {
    if (e) e.preventDefault();
    let cleanName = sanitizeInput(inputPlayerName ? inputPlayerName.value : '', 12);
    if (!cleanName) {
      cleanName = '도전자';
      if (inputPlayerName) inputPlayerName.value = '도전자';
    }

    if (activeMode === 'school' && inputStudentId) {
      let cleanId = sanitizeInput(inputStudentId.value, 10);
      studentId = cleanId || '미입력';
      safeSetStorage(idStorageKey, studentId);
    }

    playerName = cleanName;
    safeSetStorage(nameStorageKey, playerName);

    updateProfileDisplay();
    if (profileModal) {
      profileModal.classList.add('hidden');
      profileModal.style.display = 'none';
    }
    isTimerPaused = false;
  }

  if (profileForm) {
    profileForm.addEventListener('submit', handleStartGame);
  }
  if (btnStartGame) {
    btnStartGame.addEventListener('click', handleStartGame);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCongruenceGame);
} else {
  initCongruenceGame();
}
