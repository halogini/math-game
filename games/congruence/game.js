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

// ----------------------------------------------------
// Main Game Logic
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Channel Detection
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode');
  let activeMode = (modeParam === 'dorms' || modeParam === 'dorems') ? 'dorms' : 'school';

  const nameStorageKey = `halomath_name_${activeMode}`;
  const idStorageKey = `halomath_id_${activeMode}`;
  const highScoreStorageKey = `congruence_highscore_${activeMode}`;

  let playerName = sanitizeInput(localStorage.getItem(nameStorageKey) || '', 12);
  let studentId = activeMode === 'school' ? sanitizeInput(localStorage.getItem(idStorageKey) || '', 10) : '';
  let highScore = parseInt(localStorage.getItem(highScoreStorageKey) || '0', 10);

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

  // Always show Opening Modal on page load (features 1st Place Champion & Game Purpose)
  fetchLeaderboard();
  profileModal.classList.remove('hidden');

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
        drawBadge(badgeX, badgeY, `${sideNames[i]} = ${tri.sidesCm[i]}cm`, '#f59e0b', true, sideNames[i]);
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

  // Canvas Mouse Interactivity
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    hoverTarget = findTargetAt(mx, my);
    renderCanvas();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const target = findTargetAt(mx, my);
    if (target) {
      let key = '';
      if (target.type === 'side') {
        const sideNames = target.triangle === 'L' ? ['AB', 'BC', 'CA'] : ['DE', 'EF', 'FD'];
        key = `${target.triangle}_side_${sideNames[target.sideIndex]}`;
      } else {
        const angleNames = target.triangle === 'L' ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
        key = `${target.triangle}_angle_${angleNames[target.angleIndex]}`;
      }

      // Irreversible measurement: once measured, it cannot be canceled/deleted
      if (!measuredSet.has(key)) {
        measuredSet.add(key);
        sounds.playMeasure();
      }

      updateCluesUI();
      renderCanvas();
    }
  });

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
      const labelHtml = isAngle ? `📐 ∠${parts[2]}` : `📏 <span style="text-decoration: overline; border-top: 1.5px solid currentColor; padding-top: 1px;">${parts[2]}</span>`;
      const tagSpan = document.createElement('span');
      tagSpan.className = `clue-tag ${isAngle ? 'angle-tag' : ''}`;
      tagSpan.innerHTML = labelHtml;
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

    const hasSSS = (sidePairs === 3);
    const hasSAS = (sidePairs >= 2 && anglePairs >= 1);
    const hasASA = (sidePairs >= 1 && anglePairs >= 2);
    const isValidProof = hasSSS || hasSAS || hasASA;

    if (!isValidProof) {
      ceCount++;
      sounds.playCounterExample();
      let ceType = 'UNDER_MEASURED';
      let msg = '🚨 두 삼각형이 완전히 포개지는 지 확신하려면 더 많은 측정값이 필요합니다.';

      if (sidePairs === 0 && anglePairs === 3) {
        ceType = 'AAA_TRAP';
        msg = '🚨 각도만 측정하면 크기가 다른 삼각형이 만들어질 수 있습니다!';
      } else if (sidePairs === 2 && anglePairs === 1 && !hasSAS) {
        ceType = 'SSA_TRAP';
        msg = '🚨 두 변이 같아도, 그 사이의 끼인각을 재지 않으면 다른 모양이 생겨납니다!';
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
      const minEssential = 6; // Essential clues across both triangles (3 left + 3 right)
      const extraCount = Math.max(0, measuredCount - minEssential);
      const timeBonus = Math.min(30, Math.floor((roundTimeLeft / 60) * 30)); // max 30 pts

      if (isOptimalRoute && extraCount === 0) {
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
            `🎯 최소한의 측정만으로 삼각형 합동 판정에 성공했습니다!`,
            null,
            `주어진 힌트를 활용해 '${routeName}' 조건으로 군더더기 없이 깔끔하게 입증했습니다.`
          );
        });
      } else {
        // DYNAMIC INEFFICIENT SCORE (Deduction scales with extra measurements!)
        const inefficiencyPenalty = 15 * Math.max(1, extraCount); // 15 pts lost per extra clue
        const baseScore = Math.max(10, 70 - inefficiencyPenalty);
        const points = Math.min(99, Math.max(10, baseScore + timeBonus));
        
        totalScore += points;
        correctCount++;
        hudScore.textContent = totalScore;

        let hintReason = '💡 최소한의 필수 치수 외에 불필요한 치수를 더 측정하여 점수가 일부 감점되었습니다.';

        playSuccessAnimation(() => {
          sounds.playSuccess();
          highlightInefficientClues();
          showResultModal(
            true,
            `+${points}점 (비효율 감점)`,
            `⚠️ 합동 입증은 성공했지만, 측정하는데 너무 많은 에너지를 소비했습니다.`,
            null,
            hintReason
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
    
    // Check if side or angle is measured on EITHER triangle so its visual value is 100% locked!
    const isMeasuredSide = [
      measuredSet.has('L_side_AB') || measuredSet.has('R_side_DE'),
      measuredSet.has('L_side_BC') || measuredSet.has('R_side_EF'),
      measuredSet.has('L_side_CA') || measuredSet.has('R_side_FD')
    ];
    const isMeasuredAngle = [
      measuredSet.has('L_angle_A') || measuredSet.has('R_angle_D'),
      measuredSet.has('L_angle_B') || measuredSet.has('R_angle_E'),
      measuredSet.has('L_angle_C') || measuredSet.has('R_angle_F')
    ];
    
    function animateFailure(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progressOverlaping = Math.min(elapsed / 1500, 1.0); // 0 to 1.5s: move to overlap
      const progressWiggling = Math.max(0, (elapsed - 1500) / 1000); // 1.5s+: wiggle infinitely
      
      const easeOverlap = progressOverlaping < 0.5 ? 4 * progressOverlaping * Math.pow(progressOverlaping, 2) : 1 - Math.pow(-2 * progressOverlaping + 2, 3) / 2;
      
      let p0 = {x: originalRightPts[0].x, y: originalRightPts[0].y};
      let p1 = {x: originalRightPts[1].x, y: originalRightPts[1].y};
      let p2 = {x: originalRightPts[2].x, y: originalRightPts[2].y};
      
      // Phase 1: Overlap target triangle
      p0.x += (triangleLeft.pts[0].x - p0.x) * easeOverlap;
      p0.y += (triangleLeft.pts[0].y - p0.y) * easeOverlap;
      p1.x += (triangleLeft.pts[1].x - p1.x) * easeOverlap;
      p1.y += (triangleLeft.pts[1].y - p1.y) * easeOverlap;
      p2.x += (triangleLeft.pts[2].x - p2.x) * easeOverlap;
      p2.y += (triangleLeft.pts[2].y - p2.y) * easeOverlap;
      
      // Phase 2: Wiggle with 100% invariant measured lengths and angles
      if (progressWiggling > 0) {
        const t = Math.sin(progressWiggling * Math.PI * 2);
        
        const numMeasuredSides = (isMeasuredSide[0]?1:0) + (isMeasuredSide[1]?1:0) + (isMeasuredSide[2]?1:0);
        const numMeasuredAngles = (isMeasuredAngle[0]?1:0) + (isMeasuredAngle[1]?1:0) + (isMeasuredAngle[2]?1:0);

        if (numMeasuredSides === 0) {
          if (numMeasuredAngles >= 2) {
            // AAA: Scale relative to centroid. All interior angles are 100% invariant! No side length badges exist.
            const centroid = { x: (p0.x+p1.x+p2.x)/3, y: (p0.y+p1.y+p2.y)/3 };
            const scale = 1.0 + 0.3 * t;
            p0 = { x: centroid.x + (p0.x - centroid.x) * scale, y: centroid.y + (p0.y - centroid.y) * scale };
            p1 = { x: centroid.x + (p1.x - centroid.x) * scale, y: centroid.y + (p1.y - centroid.y) * scale };
            p2 = { x: centroid.x + (p2.x - centroid.x) * scale, y: centroid.y + (p2.y - centroid.y) * scale };
          } else {
            p2.x += t * 30;
            p2.y += Math.cos(progressWiggling * Math.PI * 4) * 20;
          }
        } else if (numMeasuredSides === 2 && numMeasuredAngles >= 1 && ceType === 'SSA_TRAP') {
          // SSA TRAP: Exactly 2 sides measured + 1 non-included angle measured.
          // Discrete alternate triangle reflection that preserves ALL 2 side lengths & 1 angle 100%!
          if (t > 0) {
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
               const dx = refMove.x - refBase.x, dy = refMove.y - refBase.y;
               const len2 = dx*dx + dy*dy;
               if (len2 > 0) {
                 const dot = ((refDrop.x - refBase.x)*dx + (refDrop.y - refBase.y)*dy) / len2;
                 const hx = refBase.x + dx * dot, hy = refBase.y + dy * dot;
                 refMove.x = 2*hx - refMove.x; 
                 refMove.y = 2*hy - refMove.y;
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
            // Side 0 (p0-p1) is measured! p0 and p1 are fixed! Length |p1-p0| NEVER changes!
            if (isMeasuredAngle[0]) {
              const dx = p2.x - p0.x, dy = p2.y - p0.y; const len = Math.hypot(dx, dy) || 1;
              p2.x += (dx/len) * t * 30; p2.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[1]) {
              const dx = p2.x - p1.x, dy = p2.y - p1.y; const len = Math.hypot(dx, dy) || 1;
              p2.x += (dx/len) * t * 30; p2.y += (dy/len) * t * 30;
            } else {
              p2 = rotatePt(p2, p1, t * 0.4);
            }
          } else if (isMeasuredSide[1]) {
            // Side 1 (p1-p2) is measured! p1 and p2 are fixed! Length |p2-p1| NEVER changes!
            if (isMeasuredAngle[1]) {
              const dx = p0.x - p1.x, dy = p0.y - p1.y; const len = Math.hypot(dx, dy) || 1;
              p0.x += (dx/len) * t * 30; p0.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[2]) {
              const dx = p0.x - p2.x, dy = p0.y - p2.y; const len = Math.hypot(dx, dy) || 1;
              p0.x += (dx/len) * t * 30; p0.y += (dy/len) * t * 30;
            } else {
              p0 = rotatePt(p0, p2, t * 0.4);
            }
          } else if (isMeasuredSide[2]) {
            // Side 2 (p2-p0) is measured! p2 and p0 are fixed! Length |p0-p2| NEVER changes!
            if (isMeasuredAngle[2]) {
              const dx = p1.x - p2.x, dy = p1.y - p2.y; const len = Math.hypot(dx, dy) || 1;
              p1.x += (dx/len) * t * 30; p1.y += (dy/len) * t * 30;
            } else if (isMeasuredAngle[0]) {
              const dx = p1.x - p0.x, dy = p1.y - p0.y; const len = Math.hypot(dx, dy) || 1;
              p1.x += (dx/len) * t * 30; p1.y += (dy/len) * t * 30;
            } else {
              p1 = rotatePt(p1, p0, t * 0.4);
            }
          }
        }
      }
      
      let currentPts = [p0, p1, p2];
      
      triangleRight.pts = currentPts;
      renderCanvas();
      
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
      localStorage.setItem(highScoreStorageKey, highScore);
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

  function fetchLeaderboard() {
    if (!firebaseDb) return;

    const dbRefPath = 'scores';
    firebaseDb.ref(dbRefPath).orderByChild('score').limitToLast(100).once('value', (snapshot) => {
      const userBestMap = new Map();

      snapshot.forEach(child => {
        const val = child.val();
        if (val && val.name) {
          const valName = sanitizeInput(val.name, 12);
          const valStudentId = String(val.studentId || '').trim();
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
      }

      renderLeaderboardTable(openingLeaderboardTbody, top20);
      renderLeaderboardTable(modalLeaderboardTbody, top20);
      renderLeaderboardTable(gameoverLeaderboardTbody, top20);
    }, (err) => {
      console.error("Leaderboard fetch error:", err);
    });
  }

  function renderLeaderboardTable(tbodyEl, list) {
    if (!tbodyEl) return;
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
    if (!firebaseDb || !playerName) return null;

    const dbRefPath = 'scores';
    const payload = {
      name: playerName,
      studentId: activeMode === 'school' ? studentId : 'DORMS',
      channel: activeMode === 'school' ? 'school' : 'dorms',
      score: score,
      gameId: 'congruence',
      timestamp: Date.now()
    };

    try {
      const snapshot = await firebaseDb.ref(dbRefPath).once('value');
      const matchingKeys = [];
      let maxExistingScore = -1;

      snapshot.forEach(child => {
        const val = child.val();
        if (val && String(val.name).trim() === String(payload.name).trim()) {
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
          await firebaseDb.ref(`${dbRefPath}/${primaryKey}`).update(payload);
          statusMsg = `🎉 최고 점수가 ${payload.score}점으로 성공적으로 갱신되었습니다!`;
        } else {
          statusMsg = `ℹ️ 기존 최고 점수(${maxExistingScore}점)가 현재 점수(${payload.score}점)보다 높거나 같아 갱신되지 않았습니다.`;
        }
        for (let i = 1; i < matchingKeys.length; i++) {
          await firebaseDb.ref(`${dbRefPath}/${matchingKeys[i].key}`).remove();
        }
      } else {
        await firebaseDb.ref(dbRefPath).push(payload);
        statusMsg = `✅ ${payload.score}점으로 랭킹에 성공적으로 등록되었습니다!`;
      }

      fetchLeaderboard();
      return { success: true, message: statusMsg };
    } catch (err) {
      console.error("Firebase score save error:", err);
      return { success: false, message: '❌ 점수 등록 중 오류가 발생했습니다.' };
    }
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

  btnEditProfile.addEventListener('click', () => {
    inputPlayerName.value = playerName;
    if (activeMode === 'school') inputStudentId.value = studentId;
    profileModal.classList.remove('hidden');
  });

  let isGameStarted = false;

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cleanName = sanitizeInput(inputPlayerName.value, 12);
    if (!cleanName) {
      alert('이름/닉네임을 입력해 주세요.');
      return;
    }

    if (activeMode === 'school') {
      const cleanId = sanitizeInput(inputStudentId.value, 10);
      if (!cleanId) {
        alert('학번을 입력해 주세요.');
        return;
      }
      studentId = cleanId;
      localStorage.setItem(idStorageKey, studentId);
    }

    playerName = cleanName;
    localStorage.setItem(nameStorageKey, playerName);

    updateProfileDisplay();
    profileModal.classList.add('hidden');

    if (!isGameStarted) {
      isGameStarted = true;
      initGame();
    }
  });
});
