/**
 * 기회는 세 번! 구멍을 메워라!
 * World walk + drag pan · workbench/tank interior scenes
 */

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) || null;

let firebaseDb = null;
if (window.firebase && firebaseConfig && firebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.database();
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>'"/]/g, "").trim().slice(0, maxLen);
}

function randomDormsNickname() {
  const prefixes = ["도름", "별빛", "반짝", "똑똑", "신난", "고냥", "빙수", "프라즘"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = String(Math.floor(10 + Math.random() * 90));
  return sanitizeInput(prefix + num, 12);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._noise = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  tone(freq, dur, type = "sine", vol = 0.12, when = 0, slideTo = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.now() + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = type === "square" ? 2200 : 4200;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  noiseBurst(dur, vol = 0.06, when = 0, hp = 400, lp = 2800) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.now() + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hpF = this.ctx.createBiquadFilter();
    hpF.type = "highpass";
    hpF.frequency.value = hp;
    const lpF = this.ctx.createBiquadFilter();
    lpF.type = "lowpass";
    lpF.frequency.value = lp;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hpF);
    hpF.connect(lpF);
    lpF.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
  /** UI tap */
  click() {
    this.noiseBurst(0.03, 0.045, 0, 1200, 4800);
    this.tone(920, 0.035, "sine", 0.04);
  }
  /** Hole measure / tool use */
  measure() {
    this.tone(784, 0.07, "sine", 0.1);
    this.tone(1175, 0.1, "sine", 0.07, 0.05);
  }
  /** Piece snap onto board */
  snap() {
    this.noiseBurst(0.045, 0.055, 0, 200, 1600);
    this.tone(392, 0.08, "triangle", 0.08);
  }
  /** Soft confirm / pick up */
  pickup() {
    this.tone(523, 0.06, "sine", 0.07);
    this.tone(659, 0.09, "sine", 0.06, 0.04);
  }
  success() {
    this.tone(523, 0.09, "sine", 0.1);
    this.tone(659, 0.1, "sine", 0.09, 0.08);
    this.tone(784, 0.14, "sine", 0.1, 0.16);
  }
  fail() {
    this.tone(277, 0.16, "sine", 0.1, 0, 196);
    this.noiseBurst(0.12, 0.04, 0.02, 120, 900);
  }
  /** Install slip / bounce out */
  slip() {
    this.noiseBurst(0.14, 0.07, 0, 180, 1400);
    this.tone(240, 0.18, "triangle", 0.09, 0, 140);
  }
  footstep() {
    this.noiseBurst(0.04, 0.028, 0, 80, 700);
  }
  enter() {
    this.tone(440, 0.08, "sine", 0.05, 0, 660);
    this.noiseBurst(0.1, 0.035, 0.02, 300, 2200);
  }
  repair() {
    this.tone(587, 0.1, "sine", 0.1);
    this.tone(740, 0.12, "sine", 0.09, 0.09);
    this.tone(880, 0.16, "sine", 0.1, 0.2);
    this.noiseBurst(0.12, 0.03, 0.05, 400, 3000);
  }
}

const sound = new SoundEngine();
const TOTAL_TANKS = 5;
const TIME_LIMIT_MS = 5 * 60 * 1000;
const VIEW_W = 960;
const VIEW_H = 520;
/** Below DOM timer + mission toast so canvas titles stay readable */
const TOP_CLEAR_Y = 132;
const TOP_SUB_Y = TOP_CLEAR_Y + 26;
/** Above mobile bottom HUD / scene buttons */
const BOTTOM_TIP_Y = 400;
/** Zone names on tanks/bench — above the overlay HUD */
const ZONE_LABEL_Y = 252;
const WORLD_W = 2600;
const GROUND_Y = 418;
// Must match TANK_W / FLOOR_Y in tools/build-art.ps1, which composes level-bg.png.
const TANK_DRAW_W = 150;
const TANK_BASE_Y = 430;
// Cat sprites are square with the paws sitting on the bottom margin baked in by build-art.ps1.
const CAT_SPRITE = 200;
const CAT_BASELINE = CAT_SPRITE * (246 / 256);
/** Tuned so stride ≈ CAT_PX_PER_FRAME * 4 matches travel feel */
const CAT_SPEED = 260;
const CAT_PX_PER_FRAME = 26;
const CAT_BOB_AMP = 3.2;
/** Standing idle frame index within walk sheets (tools/triangle idle copies walk-2) */
const CAT_STAND_FRAME = 1;
const PX_PER_CM = 22;
const NICE_ANGLES = [30, 40, 45, 50, 60, 70, 80, 90];
const LB_PATH = "scores";
const GAME_ID = "three-chances";
const SIDE_LABELS = ["①", "②", "③"];
const ANGLE_LABELS = ["A", "B", "C"];
const DRAG_THRESH = 10;
const POI_ENTER_DIST = 70;

function resolveActiveMode() {
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const href = window.location.href || "";
    if (search.includes("mode=dorms") || search.includes("mode=dorems")
      || hash.includes("mode=dorms") || hash.includes("mode=dorems")
      || href.includes("dorms") || href.includes("dorems")) {
      return "dorms";
    }
  } catch (e) { /* ignore */ }
  return "school";
}

const activeMode = resolveActiveMode();
if (document.body) document.body.classList.toggle("mode-dorms", activeMode === "dorms");
/** URL ?test=a1s2 | sas | angle1 → 각1·변2만 바로 플레이 */
const TEST_A1S2 = (() => {
  try {
    const t = new URLSearchParams(window.location.search).get("test");
    return t === "a1s2" || t === "sas" || t === "angle1";
  } catch (e) {
    return false;
  }
})();

/** URL ?test=asa | a2s1 | angle2 → 각2·변1(낀변) 바로 플레이 */
const TEST_A2S1 = (() => {
  try {
    const t = new URLSearchParams(window.location.search).get("test");
    return t === "asa" || t === "a2s1" || t === "angle2";
  } catch (e) {
    return false;
  }
})();

const ZONES = [
  { id: "tank0", label: "수조 1", x: 420, w: 170, tank: 0 },
  { id: "tank1", label: "수조 2", x: 740, w: 170, tank: 1 },
  { id: "bench", label: "작업대", x: 1120, w: 220 },
  { id: "tank2", label: "수조 3", x: 1500, w: 170, tank: 2 },
  { id: "tank3", label: "수조 4", x: 1840, w: 170, tank: 3 },
  { id: "tank4", label: "수조 5", x: 2180, w: 170, tank: 4 }
];

function zoneById(id) {
  return ZONES.find((z) => z.id === id);
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  const hudTimer = document.getElementById("hud-timer");
  const timeGaugeFill = document.getElementById("time-gauge-fill");
  const missionBar = document.getElementById("mission-bar");
  const missionText = document.getElementById("mission-text");
  const toolSlots = document.getElementById("tool-slots");
  const tankPips = document.getElementById("tank-pips");
  const sceneChrome = document.getElementById("scene-chrome");
  const btnSceneAction = document.getElementById("btn-scene-action");
  const playHud = document.getElementById("play-hud");
  const headerHudSlot = document.getElementById("header-hud-slot");
  const playHudSlot = document.getElementById("play-hud-slot");
  const hudOverlayMq = window.matchMedia(
    "(orientation: landscape) and (max-width: 1024px)"
  );
  const portraitGateMq = window.matchMedia(
    "(orientation: portrait) and (max-width: 1024px)"
  );
  const coarsePointerMq = window.matchMedia("(pointer: coarse)");
  const rotateGate = document.getElementById("rotate-gate");
  let portraitBlocked = false;
  // Declared before MobileFullscreen() — its constructor calls isPlaying() immediately.
  let running = false;

  function tryLockLandscape() {
    const orient = screen.orientation;
    if (!orient || typeof orient.lock !== "function") return;
    const p = orient.lock("landscape");
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function syncRotateGate() {
    portraitBlocked = portraitGateMq.matches;
    document.body.classList.toggle("needs-landscape", portraitBlocked);
    if (!rotateGate) return;
    rotateGate.classList.toggle("hidden", !portraitBlocked);
    rotateGate.hidden = !portraitBlocked;
    rotateGate.setAttribute("aria-hidden", portraitBlocked ? "false" : "true");
  }

  function syncHudPlacement() {
    if (!playHud || !headerHudSlot || !playHudSlot) return;
    const overlay = hudOverlayMq.matches;
    document.body.classList.toggle("hud-overlay-mobile", overlay);
    const host = overlay ? playHudSlot : headerHudSlot;
    if (playHud.parentElement !== host) host.appendChild(playHud);
  }

  function syncMobileLayout() {
    syncRotateGate();
    syncHudPlacement();
  }
  syncMobileLayout();

  const mobileFs = typeof MobileFullscreen === "function"
    ? MobileFullscreen({
      root: document.getElementById("game-container"),
      button: document.getElementById("btn-fullscreen"),
      onResize: syncMobileLayout,
      isPlaying: () => !portraitBlocked
    })
    : null;

  if (typeof hudOverlayMq.addEventListener === "function") {
    hudOverlayMq.addEventListener("change", syncHudPlacement);
  } else if (typeof hudOverlayMq.addListener === "function") {
    hudOverlayMq.addListener(syncHudPlacement);
  }
  if (typeof portraitGateMq.addEventListener === "function") {
    portraitGateMq.addEventListener("change", syncRotateGate);
  } else if (typeof portraitGateMq.addListener === "function") {
    portraitGateMq.addListener(syncRotateGate);
  }
  window.addEventListener("orientationchange", () => setTimeout(syncMobileLayout, 50));
  window.addEventListener("resize", () => {
    clearTimeout(syncMobileLayout._t);
    syncMobileLayout._t = setTimeout(syncMobileLayout, 80);
  });

  const quizModal = document.getElementById("quiz-modal");
  const quizPrompt = document.getElementById("quiz-prompt");
  const quizChoices = document.getElementById("quiz-choices");
  const quizFeedback = document.getElementById("quiz-feedback");
  const resultModal = document.getElementById("result-modal");
  const gameoverModal = document.getElementById("gameover-modal");
  const profileModal = document.getElementById("profile-modal");
  const profileForm = document.getElementById("profile-form");
  const introOverlay = document.getElementById("intro-overlay");
  const btnToggleOpeningLeaderboard = document.getElementById("btn-toggle-opening-leaderboard");
  const openingLeaderboardBox = document.getElementById("opening-leaderboard-box");
  const openingLeaderboardTbody = document.getElementById("opening-leaderboard-tbody");
  const openingChampName = document.getElementById("opening-champ-name");
  const openingChampId = document.getElementById("opening-champ-id");
  const openingChampScore = document.getElementById("opening-champ-score");
  const thOpeningId = document.getElementById("th-opening-id");
  const introVideo = document.getElementById("intro-video");
  const btnSkipIntro = document.getElementById("btn-skip-intro");
  const successOverlay = document.getElementById("success-overlay");
  const successVideo = document.getElementById("success-video");
  const btnSkipSuccess = document.getElementById("btn-skip-success");
  const timeoutOverlay = document.getElementById("timeout-overlay");
  const timeoutVideo = document.getElementById("timeout-video");
  const btnSkipTimeout = document.getElementById("btn-skip-timeout");
  const btnNext = document.getElementById("btn-next-round");
  const btnRestart = document.getElementById("btn-restart-game");
  const btnSend = document.getElementById("btn-send-data");
  const btnSound = document.getElementById("btn-sound-toggle");
  const btnEditProfile = document.getElementById("btn-edit-profile");

  let playerName = "도전자";
  let studentId = "";
  let totalScore = 0;
  let roundScores = [];
  /** 클리어 시간(ms). 전부 수리 성공 시에만 설정 */
  let clearTimeMs = null;
  let bestClearTimeMs = Number(localStorage.getItem(
    activeMode === "dorms" ? "hm_three_chances_best_dorms" : "hm_three_chances_best"
  ) || 0);
  let pendingStartAfterIntro = false;
  let pendingGameOverAfterSuccess = false;
  let pendingGameOverAfterTimeout = false;
  let endedByTimeout = false;
  let timeLeftMs = TIME_LIMIT_MS;
  let lastTs = 0;

  /** @type {'idle'|'need_tools'|'go_measure'|'go_build'|'go_install'|'result'|'gameover'} */
  let phase = "idle";
  /** @type {'world'|'bench'|'tank'} */
  let scene = "world";
  /** @type {'pick'|'build'|null} */
  let benchMode = null;
  /** @type {'measure'|'install'|null} */
  let tankMode = null;

  let tankIndex = 0;
  let tanksFixed = [false, false, false, false, false];
  let bag = [];
  let toolIndex = 0;
  let measuredSides = [false, false, false];
  let measuredAngles = [false, false, false];
  let measureHistory = [];
  let hole = null;
  let hover = null;
  let flashMsg = "";
  let flashUntil = 0;
  let hasTriangle = false;
  let assembleTaps = 0;
  let buildOk = false;
  let plankDesign = null;
  let dockAnim = null;
  let patchPose = { x: VIEW_W * 0.22, y: VIEW_H * 0.55, scale: 1.25 };
  let patchDrag = null; // { dx, dy } grab offset from centroid
  /** Interactive assemble / construction */
  let asm = null;
  let asmMysteryIndex = -1;
  let asmTrayHits = [];
  const ASM_CX = VIEW_W * 0.58;
  const ASM_CY = 320;
  // Angles alone fix the shape but not the size, so the AAA patch comes out visibly small.
  const AAA_PATCH_SCALE = 0.68;
  /** AAA: patch vertex → hole vertex (angle piece index). Survives bench exit for dock. */
  let aaaVertexMap = null;
  const quizTitle = document.getElementById("quiz-title");
  const btnMeasureRef = document.getElementById("btn-measure-ref");
  const btnAssembleUndo = document.getElementById("btn-assemble-undo");
  const measureRefOverlay = document.getElementById("measure-ref-overlay");
  const measureRefCanvas = document.getElementById("measure-ref-canvas");
  const btnCloseMeasureRef = document.getElementById("btn-close-measure-ref");
  const hingeAngleModal = document.getElementById("hinge-angle-modal");
  const hingeAngleInput = document.getElementById("hinge-angle-input");
  const hingeAngleFeedback = document.getElementById("hinge-angle-feedback");
  const btnHingeOk = document.getElementById("btn-hinge-ok");
  const btnHingeCancel = document.getElementById("btn-hinge-cancel");
  const assembleFailModal = document.getElementById("assemble-fail-modal");
  const assembleFailMsg = document.getElementById("assemble-fail-msg");
  const btnFailRemeasure = document.getElementById("btn-fail-remeasure");
  const btnFailRebuild = document.getElementById("btn-fail-rebuild");
  let cameraX = 0;
  let cameraFollow = true;
  const keys = { left: false, right: false };
  let poiCheckCooldown = 0;

  /** Table tools in bench pick scene */
  let benchTools = [];

  const cat = {
    x: zoneById("tank0").x,
    facing: 1,
    walking: false,
    targetX: zoneById("tank0").x,
    arriveCb: null,
    frame: CAT_STAND_FRAME,
    strideAcc: 0,
    bob: 0,
    bobPhase: 0,
    carry: "empty"
  };

  const pointer = {
    down: false,
    dragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    startClientX: 0,
    startClientY: 0,
    moved: 0
  };

  const art = {
    bg: null,
    repaired: null,
    idle: null,
    tools: null,
    triangle: null,
    walk: [],
    toolsWalk: [],
    triangleWalk: [],
    workbench: null,
    tank: null,
    ruler: null,
    protractor: null
  };

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadArt() {
    const base = "assets/";
    art.bg = await loadImg(base + "level-bg.jpg");
    art.repaired = await loadImg(base + "tank-repaired.png");
    art.idle = await loadImg(base + "cat-idle.png");
    art.tools = await loadImg(base + "cat-tools.png");
    art.triangle = await loadImg(base + "cat-triangle.png");
    art.walk = await Promise.all([1, 2, 3, 4].map((n) => loadImg(base + `cat-walk-${n}.png`)));
    art.toolsWalk = await Promise.all([1, 2, 3, 4].map((n) => loadImg(base + `cat-tools-walk-${n}.png`)));
    art.triangleWalk = await Promise.all([1, 2, 3, 4].map((n) => loadImg(base + `cat-triangle-walk-${n}.png`)));
    art.workbench = await loadImg(base + "scene-bench.jpg");
    art.tank = await loadImg(base + "scene-tank.jpg");
    art.ruler = await loadImg(base + "ruler.png");
    art.protractor = await loadImg(base + "protractor.png");
  }

  // ---------- Geometry ----------
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function centroid(pts) {
    return {
      x: (pts[0].x + pts[1].x + pts[2].x) / 3,
      y: (pts[0].y + pts[1].y + pts[2].y) / 3
    };
  }

  function rotatePts(pts, c, ang) {
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    return pts.map((p) => {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
    });
  }

  function sideLength(pts, i) {
    return dist(pts[i], pts[(i + 1) % 3]);
  }

  function sharedVertexOfSides(s0, s1) {
    const a = [s0, (s0 + 1) % 3];
    const b = [s1, (s1 + 1) % 3];
    return a.find((v) => b.includes(v)) ?? null;
  }

  function mapPtsToCenter(design, center, scale = 1) {
    const c = centroid(design);
    return design.map((p) => ({
      x: center.x + (p.x - c.x) * scale,
      y: center.y + (p.y - c.y) * scale
    }));
  }

  function angleDegAt(pts, i) {
    const p = pts[i];
    const a = pts[(i + 2) % 3];
    const b = pts[(i + 1) % 3];
    const v1x = a.x - p.x;
    const v1y = a.y - p.y;
    const v2x = b.x - p.x;
    const v2y = b.y - p.y;
    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;
    return Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
  }

  function generateHole() {
    let a0, a1, a2;
    for (let tries = 0; tries < 40; tries++) {
      a0 = NICE_ANGLES[Math.floor(Math.random() * NICE_ANGLES.length)];
      a1 = NICE_ANGLES[Math.floor(Math.random() * NICE_ANGLES.length)];
      a2 = 180 - a0 - a1;
      if (a2 >= 30 && a2 <= 100 && (NICE_ANGLES.includes(a2) || a2 % 5 === 0)) break;
    }
    if (a2 < 30 || a2 > 120) {
      a0 = 60; a1 = 50; a2 = 70;
    }
    const side01 = 110 + Math.random() * 50;
    const rad0 = (a0 * Math.PI) / 180;
    const rad1 = (a1 * Math.PI) / 180;
    const rad2 = (a2 * Math.PI) / 180;
    const side02 = (side01 * Math.sin(rad1)) / Math.sin(rad2);
    let pts = [
      { x: 0, y: 0 },
      { x: side01, y: 0 },
      { x: Math.cos(rad0) * side02, y: -Math.sin(rad0) * side02 }
    ];
    pts = rotatePts(pts, centroid(pts), Math.random() * Math.PI * 2);
    const sides = [0, 1, 2].map((i) => sideLength(pts, i));
    // Labels from actual geometry so on-screen arcs match numbers
    const angles = [0, 1, 2].map((i) => Math.round(angleDegAt(pts, i)));
    return {
      designPts: pts,
      sidesCm: sides.map((s) => +(s / PX_PER_CM).toFixed(1)),
      anglesDeg: angles
    };
  }

  function isRigid(sideKnown, angleKnown) {
    const nS = sideKnown.filter(Boolean).length;
    const nA = angleKnown.filter(Boolean).length;
    if (nS === 3) return true;
    if (nS === 2 && nA === 1) {
      const si = [];
      for (let i = 0; i < 3; i++) if (sideKnown[i]) si.push(i);
      const shared = sharedVertexOfSides(si[0], si[1]);
      return shared != null && angleKnown[shared];
    }
    if (nA >= 2 && nS >= 1) return true;
    return false;
  }

  function needsAngleQuiz() {
    const nS = measuredSides.filter(Boolean).length;
    const nA = measuredAngles.filter(Boolean).length;
    return nA === 2 && nS === 1;
  }

  function circleIntersect(c0, r0, c1, r1) {
    const d = dist(c0, c1);
    if (d > r0 + r1 || d < Math.abs(r0 - r1) || d < 1e-6) return null;
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
    const xm = c0.x + (a * (c1.x - c0.x)) / d;
    const ym = c0.y + (a * (c1.y - c0.y)) / d;
    const rx = (-(c1.y - c0.y) * h) / d;
    const ry = ((c1.x - c0.x) * h) / d;
    return [
      { x: xm + rx, y: ym + ry },
      { x: xm - rx, y: ym - ry }
    ];
  }

  /** Wrong patch when measurements don't determine a unique triangle */
  function buildCounterPlank(pts, sideKnown) {
    const nS = sideKnown.filter(Boolean).length;
    // AAA: 각만 있으면 합동은 안 정해짐 → 같은 각·다른 크기
    if (nS === 0) {
      const c = centroid(pts);
      const s = 0.68;
      return pts.map((p) => ({
        x: c.x + (p.x - c.x) * s,
        y: c.y + (p.y - c.y) * s
      }));
    }
    const si = [];
    for (let i = 0; i < 3; i++) if (sideKnown[i]) si.push(i);
    const alt = pts.map((p) => ({ ...p }));
    if (si.length === 2) {
      const shared = sharedVertexOfSides(si[0], si[1]);
      const unmeasuredSide = [0, 1, 2].find((i) => !sideKnown[i]);
      const swing = [unmeasuredSide, (unmeasuredSide + 1) % 3].find((v) => v !== shared) ?? unmeasuredSide;
      const pivot = shared != null ? shared : 0;
      const len = dist(pts[pivot], pts[swing]);
      const ang0 = Math.atan2(pts[swing].y - pts[pivot].y, pts[swing].x - pts[pivot].x);
      alt[swing] = {
        x: pts[pivot].x + Math.cos(ang0 + 0.7) * len,
        y: pts[pivot].y + Math.sin(ang0 + 0.7) * len
      };
      return alt;
    }
    const free = 2;
    const mid = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
    alt[free] = {
      x: mid.x + (pts[free].x - mid.x) * -0.45 + (pts[1].y - pts[0].y) * 0.3,
      y: mid.y + (pts[free].y - mid.y) * -0.45 + (pts[0].x - pts[1].x) * 0.3
    };
    return alt;
  }

  function rigidLerpPts(from, to, t) {
    const cf = centroid(from);
    const ct = centroid(to);
    const aFrom = Math.atan2(from[1].y - from[0].y, from[1].x - from[0].x);
    const aTo = Math.atan2(to[1].y - to[0].y, to[1].x - to[0].x);
    let dAng = aTo - aFrom;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    const ang = dAng * t;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const cx = cf.x + (ct.x - cf.x) * t;
    const cy = cf.y + (ct.y - cf.y) * t;
    return from.map((p) => {
      const dx = p.x - cf.x;
      const dy = p.y - cf.y;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ---------- UI ----------
  function showFlash(msg) {
    flashMsg = msg;
    flashUntil = performance.now() + 1200;
  }

  function syncFlashMissionVisibility() {
    /* mission stays visible — flash is brief feedback only */
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function formatClearTime(ms) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function clearTimeBucket(ms) {
    return Math.floor(Number(ms) / 1000);
  }

  function withTimeRanks(list) {
    const ranks = [];
    let lastBucket = null;
    let lastRank = 0;
    for (let i = 0; i < list.length; i++) {
      const bucket = clearTimeBucket(list[i].clearTimeMs);
      const rank = lastBucket !== null && bucket === lastBucket ? lastRank : i + 1;
      lastBucket = bucket;
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

  function elapsedMs() {
    return Math.max(0, TIME_LIMIT_MS - timeLeftMs);
  }

  function updateHud() {
    if (hudTimer) hudTimer.textContent = formatTime(timeLeftMs);
    document.getElementById("display-profile-name").textContent = playerName;
    const idEl = document.getElementById("display-profile-id");
    if (activeMode === "dorms") {
      idEl.textContent = "dorms";
    } else {
      idEl.textContent = studentId ? `학번 ${studentId}` : "학번 미입력";
    }
    // 프로필 수정은 판이 시작되기 전에만
    const inRun = running || pendingStartAfterIntro
      || pendingGameOverAfterSuccess || pendingGameOverAfterTimeout;
    btnEditProfile.classList.toggle("hidden", inRun);
    const ratio = Math.max(0, Math.min(1, timeLeftMs / TIME_LIMIT_MS));
    if (timeGaugeFill) {
      timeGaugeFill.style.transform = `scaleX(${ratio})`;
      timeGaugeFill.classList.toggle("low", ratio <= 0.25);
    }
    if (hudTimer) hudTimer.style.color = ratio <= 0.25 ? "#ff6b8a" : "";
  }

  function toolsRemaining() {
    const rulersInBag = bag.filter((t) => t === "ruler").length;
    const prosInBag = bag.filter((t) => t === "protractor").length;
    return {
      rulers: Math.max(0, rulersInBag - measuredSides.filter(Boolean).length),
      protractors: Math.max(0, prosInBag - measuredAngles.filter(Boolean).length)
    };
  }

  function isAAABuild() {
    return measuredAngles.every(Boolean) && !measuredSides.some(Boolean);
  }

  function isSssBuild() {
    return measuredSides.every(Boolean) && !measuredAngles.some(Boolean);
  }

  /** 1차 리얼 조립: 각 1 + 변 2 */
  function isOneAngleBuild() {
    return measuredAngles.filter(Boolean).length === 1
      && measuredSides.filter(Boolean).length === 2;
  }

  /** 각 2 + 변 1 */
  function isTwoAngleBuild() {
    return measuredAngles.filter(Boolean).length === 2
      && measuredSides.filter(Boolean).length === 1;
  }

  /** 각2·변1 자유 작도 (낀변 ASA + 끝각 하나 미측정 AAS) */
  function isAsaFreeBuild() {
    return isTwoAngleBuild();
  }

  function isFreeConstructBuild() {
    return isOneAngleBuild() || isAsaFreeBuild();
  }

  /** 작도 트레이에 올릴 끝각 꼭짓점 (변의 양끝) */
  function twoAngleEndVertices() {
    const si = primaryMeasuredSide();
    if (si < 0) return [];
    return sideEnds(si);
  }

  function measuredAngleIndex() {
    return [0, 1, 2].find((i) => measuredAngles[i]);
  }

  function measuredAngleList() {
    return [0, 1, 2].filter((i) => measuredAngles[i]);
  }

  function measuredSideList() {
    return [0, 1, 2].filter((i) => measuredSides[i]);
  }

  function primaryMeasuredSide() {
    for (let i = 0; i < 3; i++) if (measuredSides[i]) return i;
    return -1;
  }

  function sideEnds(si) {
    return [si, (si + 1) % 3];
  }

  function isAsaBothEndsMeasured() {
    const si = primaryMeasuredSide();
    if (si < 0 || measuredSides.filter(Boolean).length !== 1) return false;
    return sideEnds(si).every((e) => measuredAngles[e]);
  }

  function mysteryEndForPlacedSide(si) {
    if (si < 0) return -1;
    if (measuredAngles.filter(Boolean).length !== 2) return -1;
    const missing = [0, 1, 2].find((i) => !measuredAngles[i]);
    if (missing == null) return -1;
    if (!sideEnds(si).includes(missing)) return -1;
    return missing;
  }

  function formatSideLen(i) {
    return String(hole.sidesCm[i]);
  }

  function sideBoardLen(i) {
    return Math.max(48, hole.sidesCm[i] * 18);
  }

  function emptyAsm() {
    return {
      phase: "pick_first",
      drag: null,
      placedSides: [false, false, false],
      placedAngles: [false, false, false],
      mysterySolved: false,
      raysT: 0,
      // one-angle construction
      startKind: null,
      baseSide: null, // { index, p0, p1, ray? }
      angleAt: null, // { end:'p0'|'p1'|null, deg, origin, dirA, dirB, fromPiece:bool }
      secondSide: null, // { index, p0, p1 }
      resultPts: null,
      pendingHinge: null, // { end, sideIndex }
      hingeDeg: null,
      // two-angle (ASA) construction
      endAngleP0: null, // { index, deg, origin, dirAlong, dirOpen, fromPiece }
      endAngleP1: null,
      lastPlacedEnd: null, // 'p0' | 'p1'
      apex: null,
      // AAA: angle piece index at each board vertex slot (0..2)
      aaaSlot: [null, null, null]
    };
  }

  function resetAssembleState() {
    asm = emptyAsm();
    asmMysteryIndex = -1;
    asmTrayHits = [];
    assembleTaps = 0;
  }

  function syncAssembleTaps() {
    if (!asm) {
      assembleTaps = 0;
      return;
    }
    if (isAsaFreeBuild()) {
      let n = 0;
      if (asm.baseSide) n++;
      if (asm.endAngleP0) n++;
      if (asm.endAngleP1) n++;
      // 각 먼저: 변 전에 angleAt만 있을 때
      if (!asm.baseSide && asm.angleAt) n = Math.max(n, 1);
      assembleTaps = n;
      return;
    }
    if (isOneAngleBuild()) {
      let n = 0;
      if (asm.startKind === "angle") {
        if (asm.angleAt) n++;
        if (asm.baseSide) n++;
        if (asm.secondSide) n++;
      } else {
        if (asm.baseSide) n++;
        if (asm.angleAt && asm.angleAt.fromPiece) n++;
        if (asm.secondSide) n++;
      }
      assembleTaps = n;
      return;
    }
    let n = 0;
    for (let i = 0; i < 3; i++) {
      if (asm.placedSides[i]) n++;
      if (asm.placedAngles[i]) n++;
    }
    assembleTaps = n;
  }

  function assembleNeeded() {
    if (isOneAngleBuild() || isAsaFreeBuild()) return 3;
    const si = primaryMeasuredSide();
    const asaMode = si >= 0 && measuredSides.filter(Boolean).length === 1 && !isSssBuild();
    if (asaMode) return 3;
    let n = measuredSides.filter(Boolean).length + measuredAngles.filter(Boolean).length;
    if (asmMysteryIndex >= 0 && !asm.mysterySolved) n += 1;
    return Math.max(1, n);
  }

  function asaEndAnglesReady(si) {
    if (si < 0) return false;
    return sideEnds(si).every((e) => asm.placedAngles[e]);
  }

  function triangleArea(pts) {
    return Math.abs(
      (pts[0].x * (pts[1].y - pts[2].y)
        + pts[1].x * (pts[2].y - pts[0].y)
        + pts[2].x * (pts[0].y - pts[1].y)) / 2
    );
  }

  function canFormTriangle(pts) {
    if (!pts || pts.length < 3) return false;
    const a = dist(pts[0], pts[1]);
    const b = dist(pts[1], pts[2]);
    const c = dist(pts[2], pts[0]);
    if (a < 8 || b < 8 || c < 8) return false;
    if (a + b <= c + 2 || b + c <= a + 2 || c + a <= b + 2) return false;
    return triangleArea(pts) > 40;
  }

  /** 작도 결과가 구멍과 합동인지 (각 1+변 2) */
  function constructionMatchesHole() {
    if (!asm.resultPts || !canFormTriangle(asm.resultPts)) return false;
    const v = measuredAngleIndex();
    const trueDeg = hole.anglesDeg[v];
    const usedDeg = asm.hingeDeg != null ? asm.hingeDeg : (asm.angleAt && asm.angleAt.deg);
    if (usedDeg == null || Math.abs(usedDeg - trueDeg) > 4) return false;
    // 낀각에 인접한 두 변
    const adj = [(v + 2) % 3, v];
    const needLens = adj.map((i) => hole.sidesCm[i]).sort((a, b) => a - b);
    const got = [];
    if (asm.baseSide) got.push(hole.sidesCm[asm.baseSide.index]);
    if (asm.secondSide) got.push(hole.sidesCm[asm.secondSide.index]);
    if (got.length < 2) return false;
    got.sort((a, b) => a - b);
    if (Math.abs(got[0] - needLens[0]) > 0.35 || Math.abs(got[1] - needLens[1]) > 0.35) return false;
    // 힌지가 낀각이어야 함: 두 측정 변이 모두 꼭짓점 v에 붙어 있어야
    const share = sharedVertexOfSides(asm.baseSide.index, asm.secondSide.index);
    if (share !== v) return false;
    return true;
  }

  function finalizeOneAngleConstruction() {
    if (!asm.baseSide || !asm.secondSide || asm.hingeDeg == null) return false;
    const h = asm.angleAt && asm.angleAt.origin
      ? asm.angleAt.origin
      : (asm.angleAt && asm.angleAt.end === "p0" ? asm.baseSide.p0 : asm.baseSide.p1);
    const freeBase = dist(asm.baseSide.p0, h) < 8 ? asm.baseSide.p1 : asm.baseSide.p0;
    const freeSec = dist(asm.secondSide.p0, h) < 8 ? asm.secondSide.p1 : asm.secondSide.p0;
    asm.resultPts = [freeBase, { ...h }, freeSec];
    return canFormTriangle(asm.resultPts);
  }

  /** 두 반직선 교점 (둘 다 전방 t,s > 여유) */
  function rayRayIntersection(o1, dir1, o2, dir2) {
    const ux = Math.cos(dir1);
    const uy = Math.sin(dir1);
    const vx = Math.cos(dir2);
    const vy = Math.sin(dir2);
    const dx = o2.x - o1.x;
    const dy = o2.y - o1.y;
    const det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-5) return null;
    const t = (dx * vy - dy * vx) / det;
    const s = (dx * uy - dy * ux) / det;
    if (t < 8 || s < 8) return null;
    if (t > 900 || s > 900) return null;
    return { x: o1.x + t * ux, y: o1.y + t * uy };
  }

  function constructionMatchesHoleAsa() {
    if (!asm.resultPts || !canFormTriangle(asm.resultPts)) return false;
    const si = primaryMeasuredSide();
    if (si < 0 || !asm.baseSide || asm.baseSide.index !== si) return false;
    if (!asm.endAngleP0 || !asm.endAngleP1) return false;
    const ends = sideEnds(si);
    // 양끝 °만 맞으면 좌·우 뒤집어 붙여도 합동(반사)
    const placed = [asm.endAngleP0.deg, asm.endAngleP1.deg].sort((a, b) => a - b);
    const expect = [hole.anglesDeg[ends[0]], hole.anglesDeg[ends[1]]].sort((a, b) => a - b);
    if (Math.abs(placed[0] - expect[0]) > 4) return false;
    if (Math.abs(placed[1] - expect[1]) > 4) return false;
    // AAS: 잰 맞은편 각이 있으면 작도된 꼭짓점 각과 비교
    const opp = [0, 1, 2].find((i) => !ends.includes(i));
    if (opp != null && measuredAngles[opp]) {
      const apexDeg = angleDegBetween(
        asm.resultPts[0],
        asm.resultPts[2],
        asm.resultPts[1]
      );
      if (Math.abs(apexDeg - hole.anglesDeg[opp]) > 6) return false;
    }
    return true;
  }

  function angleDegBetween(a, vertex, b) {
    const a0 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
    const a1 = Math.atan2(b.y - vertex.y, b.x - vertex.x);
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return Math.abs(delta) * (180 / Math.PI);
  }

  function finalizeTwoAngleConstruction() {
    if (!asm.baseSide || !asm.endAngleP0 || !asm.endAngleP1) return false;
    // 양끝 열림을 같은 반평면으로 재정렬 후 교점
    const base = asm.baseSide;
    asm.endAngleP0.dirOpen = asaOpenDirFromAlong(
      asm.endAngleP0.dirAlong,
      (asm.endAngleP0.deg * Math.PI) / 180,
      base
    );
    asm.endAngleP1.dirOpen = asaOpenDirFromAlong(
      asm.endAngleP1.dirAlong,
      (asm.endAngleP1.deg * Math.PI) / 180,
      base
    );
    let apex = rayRayIntersection(
      asm.endAngleP0.origin,
      asm.endAngleP0.dirOpen,
      asm.endAngleP1.origin,
      asm.endAngleP1.dirOpen
    );
    if (!apex) {
      asm.apex = null;
      asm.resultPts = null;
      return false;
    }
    asm.apex = apex;
    asm.resultPts = [
      { ...asm.baseSide.p0 },
      { ...asm.baseSide.p1 },
      { ...apex }
    ];
    return canFormTriangle(asm.resultPts);
  }

  function tryCloseTwoAngle() {
    if (!asm.baseSide || !asm.endAngleP0 || !asm.endAngleP1) return;
    const okForm = finalizeTwoAngleConstruction();
    if (!okForm) {
      asm.phase = "failed";
      buildOk = false;
      plankDesign = null;
      hasTriangle = false;
      sound.fail();
      showAssembleFailChoices("삼각형을 만드는 데 실패한 것 같아요.");
      refreshUI();
      return;
    }
    buildOk = constructionMatchesHoleAsa();
    if (buildOk) {
      plankDesign = hole.designPts.map((p) => ({ ...p }));
    } else {
      const c = centroid(asm.resultPts);
      plankDesign = asm.resultPts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    }
    asm.phase = "done";
    sound.success();
    refreshUI();
  }

  /** 변 p0→p1 기준 같은 반평면에 열리는 각의 반직선 방향 */
  function asaOpenDirFromAlong(along, rad, base) {
    const baseDir = Math.atan2(base.p1.y - base.p0.y, base.p1.x - base.p0.x);
    const score = (dir) => Math.sin(dir - baseDir); // >0 이면 p0→p1 왼쪽
    const a = along + rad;
    const b = along - rad;
    return score(a) >= score(b) ? a : b;
  }

  /** 변 끝에 각 조각 부착 (ASA). degOverride: ?각 입력값 */
  function attachAsaEndAngle(endKey, angleIndex, degOverride) {
    const base = asm.baseSide;
    if (!base) return false;
    const slot = endKey === "p0" ? "endAngleP0" : "endAngleP1";
    if (asm[slot]) return false;
    const origin = endKey === "p0" ? base.p0 : base.p1;
    const other = endKey === "p0" ? base.p1 : base.p0;
    const along = Math.atan2(other.y - origin.y, other.x - origin.x);
    const deg = degOverride != null ? degOverride : hole.anglesDeg[angleIndex];
    const rad = (deg * Math.PI) / 180;
    const dirOpen = asaOpenDirFromAlong(along, rad, base);
    asm[slot] = {
      index: angleIndex,
      deg,
      origin: { ...origin },
      dirAlong: along,
      dirOpen,
      fromPiece: true
    };
    asm.placedAngles[angleIndex] = true;
    asm.lastPlacedEnd = endKey;
    asm.phase = "building";
    if (asm.angleAt && Math.hypot(asm.angleAt.origin.x - origin.x, asm.angleAt.origin.y - origin.y) < 14) {
      asm.angleAt = null;
    }
    const otherSlot = endKey === "p0" ? "endAngleP1" : "endAngleP0";
    if (asm[otherSlot]) {
      const o = asm[otherSlot];
      o.dirOpen = asaOpenDirFromAlong(o.dirAlong, (o.deg * Math.PI) / 180, base);
    }
    syncAssembleTaps();
    if (asm.endAngleP0 && asm.endAngleP1) tryCloseTwoAngle();
    return true;
  }

  /** 각 먼저: 반직선에 변을 붙인 뒤, 꼭짓점 쪽 끝각을 angleAt에서 이관 */
  function bindAngleAtToBaseEnd() {
    if (!asm.baseSide || !asm.angleAt) return;
    const a = asm.angleAt;
    const d0 = Math.hypot(asm.baseSide.p0.x - a.origin.x, asm.baseSide.p0.y - a.origin.y);
    const d1 = Math.hypot(asm.baseSide.p1.x - a.origin.x, asm.baseSide.p1.y - a.origin.y);
    const endKey = d0 <= d1 ? "p0" : "p1";
    const other = endKey === "p0" ? asm.baseSide.p1 : asm.baseSide.p0;
    const along = Math.atan2(other.y - a.origin.y, other.x - a.origin.x);
    const index = a.index != null ? a.index : measuredAngleList()[0];
    const deg = a.deg;
    const rad = (deg * Math.PI) / 180;
    const dirOpen = asaOpenDirFromAlong(along, rad, asm.baseSide);
    const slot = endKey === "p0" ? "endAngleP0" : "endAngleP1";
    asm[slot] = {
      index,
      deg,
      origin: { ...a.origin },
      dirAlong: along,
      dirOpen,
      fromPiece: true
    };
    asm.lastPlacedEnd = endKey;
    asm.angleAt = null;
    syncAssembleTaps();
  }

  function isAssembleComplete() {
    if (!asm) return false;
    if (isOneAngleBuild() || isAsaFreeBuild()) {
      return asm.phase === "done" && !!asm.resultPts;
    }
    if (asmMysteryIndex >= 0 && !asm.mysterySolved) return false;
    const si = primaryMeasuredSide();
    const asaMode = si >= 0 && measuredSides.filter(Boolean).length === 1 && !isSssBuild();
    if (asaMode) {
      return !!(asm.placedSides[si] && asaEndAnglesReady(si));
    }
    for (let i = 0; i < 3; i++) {
      if (measuredSides[i] && !asm.placedSides[i]) return false;
      if (measuredAngles[i] && !asm.placedAngles[i]) return false;
    }
    return assembleTaps > 0;
  }

  function assembleBoardPts() {
    return mapPtsToCenter(hole.designPts, { x: ASM_CX, y: ASM_CY }, 1.25);
  }

  /** Build triangle with given interior angles (deg) at vertices 0,1,2; side 0–1 = side01Len.
   *  wind picks which side of 0–1 the third vertex falls on. */
  function triangleFromVertexAngles(degAtVertex, side01Len, wind = -1) {
    const a0 = (degAtVertex[0] * Math.PI) / 180;
    const a1 = (degAtVertex[1] * Math.PI) / 180;
    const a2 = (degAtVertex[2] * Math.PI) / 180;
    const side02 = (side01Len * Math.sin(a1)) / Math.sin(a2);
    return [
      { x: 0, y: 0 },
      { x: side01Len, y: 0 },
      { x: Math.cos(a0) * side02, y: wind * Math.sin(a0) * side02 }
    ];
  }

  function windingOf(pts) {
    const cross = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y)
      - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x);
    return cross < 0 ? -1 : 1;
  }

  /** Design-space AAA patch: angles as placed, similarity-aligned to matching hole angles
   *  (not raw slot index), scaled down so it cannot seal. */
  function aaaPlankFromAngles(degs) {
    const hp = hole.designPts;
    const σ = (aaaVertexMap && aaaVertexMap.length === 3)
      ? aaaVertexMap
      : (asm && asm.aaaSlot && asm.aaaSlot.every((s) => s != null) ? asm.aaaSlot.slice() : [0, 1, 2]);
    const ch = centroid(hp);
    const b = [0, 1, 2].map((v) => ({
      x: hp[σ[v]].x - ch.x,
      y: hp[σ[v]].y - ch.y
    }));
    let nb = 0;
    for (let i = 0; i < 3; i++) nb += b[i].x * b[i].x + b[i].y * b[i].y;

    function fit(wind) {
      const raw = triangleFromVertexAngles(degs, sideLength(hp, 0), wind);
      const cr = centroid(raw);
      const a = raw.map((p) => ({ x: p.x - cr.x, y: p.y - cr.y }));
      let dot = 0, cross = 0, na = 0;
      for (let i = 0; i < 3; i++) {
        dot += a[i].x * b[i].x + a[i].y * b[i].y;
        cross += a[i].x * b[i].y - a[i].y * b[i].x;
        na += a[i].x * a[i].x + a[i].y * a[i].y;
      }
      const ang = Math.atan2(cross, dot);
      const s = AAA_PATCH_SCALE * Math.sqrt(nb / na);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const pts = a.map((p) => ({
        x: (p.x * cos - p.y * sin) * s,
        y: (p.x * sin + p.y * cos) * s
      }));
      // Compare to scaled hole targets (same AAA_PATCH_SCALE)
      let err = 0;
      const ts = AAA_PATCH_SCALE;
      for (let i = 0; i < 3; i++) {
        const dx = pts[i].x - b[i].x * ts;
        const dy = pts[i].y - b[i].y * ts;
        err += dx * dx + dy * dy;
      }
      return { pts, err };
    }

    const w = windingOf(hp);
    const f0 = fit(w);
    const f1 = fit(-w);
    return f1.err < f0.err ? f1.pts : f0.pts;
  }

  function aaaSlotAngles() {
    if (!asm || !asm.aaaSlot) return null;
    if (asm.aaaSlot.some((s) => s == null)) return null;
    return asm.aaaSlot.map((ai) => hole.anglesDeg[ai]);
  }

  /** After all 3 AAA angles are on vertex slots, form the triangle from that assignment */
  function tryCloseAaa() {
    const degs = aaaSlotAngles();
    if (!degs) return;
    if (Math.abs(degs[0] + degs[1] + degs[2] - 180) > 2) {
      asm.phase = "failed";
      buildOk = false;
      plankDesign = null;
      hasTriangle = false;
      aaaVertexMap = null;
      sound.fail();
      showAssembleFailChoices("세 각의 합이 180°가 아니에요.");
      refreshUI();
      return;
    }
    // AAA never determines size — always a smaller patch with the angles as placed
    buildOk = false;
    aaaVertexMap = asm.aaaSlot.slice();
    plankDesign = aaaPlankFromAngles(degs);
    asm.resultPts = mapPtsToCenter(plankDesign, { x: ASM_CX, y: ASM_CY }, 1.25);
    asm.phase = "done";
    sound.success();
    refreshUI();
  }

  function nearestFreeAaaSlot(sx, sy, thresh = 56) {
    if (!asm) return -1;
    if (!asm.aaaSlot) asm.aaaSlot = [null, null, null];
    const full = assembleBoardPts();
    let best = -1;
    let bestD = thresh;
    for (let v = 0; v < 3; v++) {
      if (asm.aaaSlot[v] != null) continue;
      const d = Math.hypot(sx - full[v].x, sy - full[v].y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  function revealMysteryIfNeeded() {
    const si = [0, 1, 2].find((i) => asm.placedSides[i] && measuredSides[i]);
    if (si == null) return;
    if (asmMysteryIndex >= 0 || asm.mysterySolved) return;
    if (isAsaBothEndsMeasured()) return;
    const miss = mysteryEndForPlacedSide(si);
    if (miss >= 0) {
      asmMysteryIndex = miss;
      showFlash("끝각을 안 쟀어요 — 계산이 필요해요!");
      refreshUI();
    }
  }

  function workAreaHit(sx, sy) {
    return sx > 300 && sx < 920 && sy > 160 && sy < 470;
  }

  function placeBaseSide(index, sx, sy) {
    const len = sideBoardLen(index);
    const cx = Math.max(380, Math.min(820, sx));
    const cy = Math.max(220, Math.min(400, sy));
    asm.baseSide = {
      index,
      p0: { x: cx - len / 2, y: cy },
      p1: { x: cx + len / 2, y: cy }
    };
    asm.placedSides[index] = true;
    asm.startKind = asm.startKind || "side";
    asm.phase = "building";
    syncAssembleTaps();
  }

  function placeAngleFirst(index, sx, sy) {
    const deg = hole.anglesDeg[index];
    const rad = (deg * Math.PI) / 180;
    const ox = Math.max(400, Math.min(800, sx));
    const oy = Math.max(240, Math.min(380, sy));
    const dirA = -rad / 2;
    const dirB = rad / 2;
    asm.angleAt = {
      end: null,
      index,
      deg,
      origin: { x: ox, y: oy },
      dirA,
      dirB,
      fromPiece: true
    };
    asm.hingeDeg = deg;
    asm.placedAngles[index] = true;
    asm.startKind = "angle";
    asm.phase = "building";
    syncAssembleTaps();
  }

  function attachAngleToBaseEnd(endKey) {
    const angIdx = measuredAngleIndex();
    const deg = hole.anglesDeg[angIdx];
    const rad = (deg * Math.PI) / 180;
    const base = asm.baseSide;
    const origin = endKey === "p0" ? base.p0 : base.p1;
    const other = endKey === "p0" ? base.p1 : base.p0;
    const along = Math.atan2(other.y - origin.y, other.x - origin.x);
    // 반직선: 변 방향 + 각만큼 회전한 방향
    const dirA = along;
    const dirB = along + rad;
    asm.angleAt = {
      end: endKey,
      deg,
      origin: { ...origin },
      dirA,
      dirB,
      fromPiece: true
    };
    asm.hingeDeg = deg;
    asm.placedAngles[angIdx] = true;
    syncAssembleTaps();
  }

  function attachSecondSideAtAngle(sideIndex, endKey, deg) {
    const base = asm.baseSide;
    const origin = endKey === "p0" ? base.p0 : base.p1;
    const other = endKey === "p0" ? base.p1 : base.p0;
    const along = Math.atan2(other.y - origin.y, other.x - origin.x);
    const rad = (deg * Math.PI) / 180;
    const dirB = along + rad;
    const len = sideBoardLen(sideIndex);
    const tip = {
      x: origin.x + Math.cos(dirB) * len,
      y: origin.y + Math.sin(dirB) * len
    };
    asm.secondSide = { index: sideIndex, p0: { ...origin }, p1: tip };
    asm.placedSides[sideIndex] = true;
    asm.hingeDeg = deg;
    asm.angleAt = {
      end: endKey,
      deg,
      origin: { ...origin },
      dirA: along,
      dirB,
      fromPiece: false
    };
    asm.pendingHinge = null;
    syncAssembleTaps();
    tryCloseOneAngle();
  }

  function attachSideToAngleRay(sideIndex, ray) {
    // ray 0 or 1
    const a = asm.angleAt;
    const dir = ray === 0 ? a.dirA : a.dirB;
    const len = sideBoardLen(sideIndex);
    const tip = {
      x: a.origin.x + Math.cos(dir) * len,
      y: a.origin.y + Math.sin(dir) * len
    };
    if (!asm.baseSide) {
      asm.baseSide = {
        index: sideIndex,
        p0: { ...a.origin },
        p1: tip,
        ray
      };
      asm.placedSides[sideIndex] = true;
    } else if (!asm.secondSide) {
      asm.secondSide = {
        index: sideIndex,
        p0: { ...a.origin },
        p1: tip,
        ray
      };
      asm.placedSides[sideIndex] = true;
    }
    syncAssembleTaps();
    tryCloseOneAngle();
  }

  /** 각 반직선에 이미 변이 있으면 true (그 쪽 반직선은 그리지 않음) */
  function isAngleRayOccupied(rayIdx) {
    if (!asm || !asm.angleAt) return false;
    if (asm.baseSide && asm.baseSide.ray === rayIdx) return true;
    if (asm.secondSide && asm.secondSide.ray === rayIdx) return true;
    // 변 먼저 → 끝에 각: 변은 dirA(ray 0) 위에 있음
    if (
      asm.angleAt.fromPiece
      && asm.baseSide
      && asm.baseSide.ray == null
      && rayIdx === 0
    ) {
      return true;
    }
    return false;
  }

  function freeAngleRay() {
    if (!isAngleRayOccupied(0)) return 0;
    if (!isAngleRayOccupied(1)) return 1;
    return -1;
  }

  /** 각이 있는 끝의 반대쪽(자유 끝) */
  function freeBaseEndAwayFromAngle() {
    if (!asm.baseSide || !asm.angleAt) return null;
    const o = asm.angleAt.origin;
    const d0 = Math.hypot(asm.baseSide.p0.x - o.x, asm.baseSide.p0.y - o.y);
    const d1 = Math.hypot(asm.baseSide.p1.x - o.x, asm.baseSide.p1.y - o.y);
    return d0 <= d1 ? "p1" : "p0";
  }

  function nearestFreeBaseEnd(sx, sy) {
    const key = freeBaseEndAwayFromAngle();
    if (!key || !asm.baseSide) return null;
    const p = asm.baseSide[key];
    if (Math.hypot(sx - p.x, sy - p.y) < 48) return key;
    return null;
  }

  function distToAngleRay(sx, sy, rayIdx) {
    if (!asm.angleAt || rayIdx < 0) return Infinity;
    const a = asm.angleAt;
    const dir = rayIdx === 0 ? a.dirA : a.dirB;
    let best = Math.hypot(sx - a.origin.x, sy - a.origin.y);
    for (let t = 16; t < 170; t += 10) {
      const x = a.origin.x + Math.cos(dir) * t;
      const y = a.origin.y + Math.sin(dir) * t;
      best = Math.min(best, Math.hypot(sx - x, sy - y));
    }
    return best;
  }

  function tryCloseOneAngle() {
    if (!asm.baseSide || !asm.secondSide || asm.hingeDeg == null) return;
    const okForm = finalizeOneAngleConstruction();
    if (!okForm) {
      asm.phase = "failed";
      buildOk = false;
      plankDesign = null;
      hasTriangle = false;
      sound.fail();
      showAssembleFailChoices("삼각형을 만드는 데 실패한 것 같아요.");
      refreshUI();
      return;
    }
    // 닫힌 삼각형이면 완성 — 구멍과 달라도 삼각형 조각으로 가져가 설치(안 맞으면 튕김)
    buildOk = constructionMatchesHole();
    if (buildOk) {
      plankDesign = hole.designPts.map((p) => ({ ...p }));
    } else {
      const c = centroid(asm.resultPts);
      plankDesign = asm.resultPts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    }
    asm.phase = "done";
    sound.success();
    refreshUI();
  }

  function showAssembleFailChoices(msg) {
    if (assembleFailMsg) assembleFailMsg.textContent = msg || "삼각형을 만드는 데 실패한 것 같아요.";
    if (assembleFailModal) {
      assembleFailModal.classList.remove("hidden");
      assembleFailModal.setAttribute("aria-hidden", "false");
    }
  }

  function hideAssembleFailChoices() {
    if (assembleFailModal) {
      assembleFailModal.classList.add("hidden");
      assembleFailModal.setAttribute("aria-hidden", "true");
    }
  }

  function remakeTriangleOnly() {
    hideAssembleFailChoices();
    bag = [];
    toolIndex = 0;
    measuredSides = [false, false, false];
    measuredAngles = [false, false, false];
    measureHistory = [];
    hasTriangle = false;
    plankDesign = null;
    aaaVertexMap = null;
    buildOk = false;
    resetAssembleState();
    updateCarrySprite();
    // 작업대에서 도구 다시 고르기 (선택했던 도구·측정 전부 리셋)
    scene = "bench";
    benchMode = "pick";
    setupBenchPickTools();
    phase = "need_tools";
    refreshUI();
    showFlash("도구부터 다시 골라 주세요!");
  }

  function failAssembleToRemeasure() {
    hideAssembleFailChoices();
    bag = [];
    measuredSides = [false, false, false];
    measuredAngles = [false, false, false];
    measureHistory = [];
    hasTriangle = false;
    plankDesign = null;
    aaaVertexMap = null;
    buildOk = false;
    resetAssembleState();
    updateCarrySprite();
    if (TEST_A1S2) {
      applyTestA1S2Loadout();
      refreshUI();
      exitToWorld("go_measure", "테스트: 다시 수조에서 구멍을 측정하세요");
      return;
    }
    if (TEST_A2S1) {
      applyTestA2S1Loadout();
      refreshUI();
      exitToWorld("go_measure", "테스트: 다시 수조에서 구멍을 측정하세요");
      return;
    }
    exitToWorld("need_tools", "삼각형을 못 만들었어요. 도구를 다시 챙기고 구멍을 측정하세요!");
  }

  function canUndoAssembleStep() {
    if (scene !== "bench" || benchMode !== "build" || !asm) return false;
    if (asm.pendingHinge || phase === "quiz") return false;
    if (assembleFailModal && !assembleFailModal.classList.contains("hidden")) return false;

    if (isAsaFreeBuild()) {
      if (asm.phase === "failed") return false;
      if (asm.phase === "done") return true;
      if (asm.endAngleP0 || asm.endAngleP1) return true;
      if (asm.baseSide) return true;
      if (asm.angleAt) return true;
      return false;
    }
    if (isOneAngleBuild()) {
      if (asm.phase === "failed") return false;
      if (asm.phase === "done") return true;
      if (asm.secondSide) return true;
      if (asm.angleAt && asm.angleAt.fromPiece) return true;
      if (asm.baseSide) return true;
      return false;
    }
    for (let i = 0; i < 3; i++) {
      if (asm.placedAngles[i] || asm.placedSides[i]) return true;
    }
    return false;
  }

  /** 삼각형 조각 조립: 마지막 작도 단계 되돌리기 */
  function undoAssembleStep() {
    if (!canUndoAssembleStep()) {
      if (asm && (asm.pendingHinge || phase === "quiz")) {
        showFlash("각도 창을 먼저 취소하세요");
      } else {
        showFlash("되돌릴 단계가 없어요");
      }
      return;
    }

    if (isAsaFreeBuild()) {
      if (asm.phase === "failed") return;
      if (asm.phase === "done") {
        asm.phase = "building";
        asm.resultPts = null;
        asm.apex = null;
        plankDesign = null;
        buildOk = false;
        hasTriangle = false;
      } else if (asm.endAngleP0 || asm.endAngleP1) {
        let endKey = asm.lastPlacedEnd;
        if (endKey !== "p0" && endKey !== "p1") {
          endKey = asm.endAngleP1 ? "p1" : "p0";
        }
        const slot = endKey === "p0" ? "endAngleP0" : "endAngleP1";
        const ang = asm[slot];
        if (ang) {
          asm.placedAngles[ang.index] = false;
          asm[slot] = null;
        }
        asm.lastPlacedEnd = asm.endAngleP0 ? "p0" : (asm.endAngleP1 ? "p1" : null);
        if (!asm.endAngleP0 && !asm.endAngleP1 && !asm.baseSide) {
          asm.startKind = null;
          asm.phase = "pick_first";
        } else {
          asm.phase = "building";
        }
      } else if (asm.baseSide) {
        asm.placedSides[asm.baseSide.index] = false;
        asm.baseSide = null;
        for (const slot of ["endAngleP0", "endAngleP1"]) {
          const ang = asm[slot];
          if (ang) {
            asm.placedAngles[ang.index] = false;
            asm[slot] = null;
          }
        }
        asm.lastPlacedEnd = null;
        asm.apex = null;
        if (asm.angleAt) {
          const ai = asm.angleAt.index != null ? asm.angleAt.index : measuredAngleList()[0];
          if (ai != null) asm.placedAngles[ai] = false;
          asm.angleAt = null;
        }
        asm.startKind = null;
        asm.phase = "pick_first";
      } else if (asm.angleAt) {
        const ai = asm.angleAt.index != null ? asm.angleAt.index : measuredAngleList()[0];
        if (ai != null) asm.placedAngles[ai] = false;
        asm.angleAt = null;
        asm.startKind = null;
        asm.phase = "pick_first";
      } else {
        showFlash("되돌릴 단계가 없어요");
        return;
      }
      syncAssembleTaps();
      sound.click();
      refreshUI();
      return;
    }

    if (isOneAngleBuild()) {
      if (asm.phase === "failed") return;
      if (asm.phase === "done") {
        asm.phase = "building";
        asm.resultPts = null;
        plankDesign = null;
        buildOk = false;
        hasTriangle = false;
      } else if (asm.secondSide) {
        const idx = asm.secondSide.index;
        asm.placedSides[idx] = false;
        asm.secondSide = null;
        if (asm.angleAt && !asm.angleAt.fromPiece) {
          asm.angleAt = null;
          asm.hingeDeg = null;
        }
        asm.phase = "building";
      } else if (asm.angleAt && asm.angleAt.fromPiece) {
        const ai = measuredAngleIndex();
        if (ai != null) asm.placedAngles[ai] = false;
        asm.angleAt = null;
        asm.hingeDeg = null;
        if (!asm.baseSide) {
          asm.startKind = null;
          asm.phase = "pick_first";
        }
      } else if (asm.baseSide) {
        asm.placedSides[asm.baseSide.index] = false;
        asm.baseSide = null;
        if (asm.startKind === "side") {
          asm.startKind = null;
          asm.phase = "pick_first";
        }
      } else {
        showFlash("되돌릴 단계가 없어요");
        return;
      }
      syncAssembleTaps();
      sound.click();
      refreshUI();
      return;
    }

    // legacy: undo last placed angle then side
    for (let i = 2; i >= 0; i--) {
      if (asm.placedAngles[i]) {
        asm.placedAngles[i] = false;
        if (asm.aaaSlot) {
          for (let v = 0; v < 3; v++) {
            if (asm.aaaSlot[v] === i) asm.aaaSlot[v] = null;
          }
        }
        if (asm.phase === "done") {
          asm.phase = "building";
          asm.resultPts = null;
          plankDesign = null;
          buildOk = false;
          hasTriangle = false;
        }
        if (asmMysteryIndex === i) asm.mysterySolved = false;
        syncAssembleTaps();
        sound.click();
        refreshUI();
        return;
      }
    }
    for (let i = 2; i >= 0; i--) {
      if (asm.placedSides[i]) {
        asm.placedSides[i] = false;
        syncAssembleTaps();
        sound.click();
        refreshUI();
        return;
      }
    }
    showFlash("되돌릴 단계가 없어요");
  }

  function openHingeAngleQuiz(endKey, sideIndex) {
    asm.pendingHinge = { end: endKey, sideIndex, mode: "hinge" };
    phase = "quiz";
    setHingeModalCopy("이 사이 각도는?", "두 변 사이의 각을 입력하세요.");
    if (hingeAngleFeedback) {
      hingeAngleFeedback.textContent = "";
      hingeAngleFeedback.style.color = "";
    }
    if (hingeAngleInput) {
      hingeAngleInput.value = "";
      hingeAngleInput.focus();
    }
    if (hingeAngleModal) {
      hingeAngleModal.classList.remove("hidden");
      hingeAngleModal.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("modal-open");
    setTimeout(() => {
      if (hingeAngleInput) hingeAngleInput.focus();
    }, 30);
  }

  /** AAS: 안 잰 끝각 ? 를 변 끝에 붙일 때 */
  function openAsaMysteryQuiz(endKey, angleIndex) {
    asm.pendingHinge = { end: endKey, angleIndex, mode: "asaMystery" };
    phase = "quiz";
    setHingeModalCopy("이 끝의 각도는?", "안 잰 끝각을 계산해 입력하세요.");
    if (hingeAngleFeedback) {
      hingeAngleFeedback.textContent = "";
      hingeAngleFeedback.style.color = "";
    }
    if (hingeAngleInput) {
      hingeAngleInput.value = "";
      hingeAngleInput.focus();
    }
    if (hingeAngleModal) {
      hingeAngleModal.classList.remove("hidden");
      hingeAngleModal.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("modal-open");
    setTimeout(() => {
      if (hingeAngleInput) hingeAngleInput.focus();
    }, 30);
  }

  function setHingeModalCopy(title, prompt) {
    const card = hingeAngleModal && hingeAngleModal.querySelector(".hinge-angle-card");
    if (!card) return;
    const h2 = card.querySelector("h2");
    const p = card.querySelector(".quiz-prompt");
    if (h2) h2.textContent = title;
    if (p) p.textContent = prompt;
  }

  function closeHingeAngleModal(cancelled) {
    if (hingeAngleModal) {
      hingeAngleModal.classList.add("hidden");
      hingeAngleModal.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
    phase = "go_build";
    if (cancelled) {
      asm.pendingHinge = null;
      showFlash("취소했어요. 다시 끝을 골라 붙이세요");
    }
    refreshUI();
  }

  function confirmHingeAngleInput() {
    if (!asm || !asm.pendingHinge) {
      closeHingeAngleModal(true);
      return;
    }
    const raw = hingeAngleInput ? hingeAngleInput.value.trim() : "";
    const deg = Number(raw);
    if (!Number.isFinite(deg) || deg <= 0 || deg >= 180) {
      if (hingeAngleFeedback) {
        hingeAngleFeedback.textContent = "1°~179° 사이 숫자를 입력하세요.";
        hingeAngleFeedback.style.color = "#ff6b8a";
      }
      sound.fail();
      return;
    }
    const useDeg = Math.round(deg);
    const pending = asm.pendingHinge;

    if (pending.mode === "asaMystery") {
      const { end, angleIndex } = pending;
      closeHingeAngleModal(false);
      asm.pendingHinge = null;
      // 입력한 °로 항상 붙임 (틀려도 붙음 → 구멍과 다른 삼각형 / 설치 튕김)
      attachAsaEndAngle(end, angleIndex, useDeg);
      sound.snap();
      refreshUI();
      return;
    }

    const { end, sideIndex } = pending;
    closeHingeAngleModal(false);
    attachSecondSideAtAngle(sideIndex, end, useDeg);
    sound.snap();
    refreshUI();
  }

  function nearestBaseEnd(sx, sy, thresh = 72) {
    if (!asm.baseSide) return null;
    const d0 = Math.hypot(sx - asm.baseSide.p0.x, sy - asm.baseSide.p0.y);
    const d1 = Math.hypot(sx - asm.baseSide.p1.x, sy - asm.baseSide.p1.y);
    if (d0 <= thresh || d1 <= thresh) return d0 <= d1 ? "p0" : "p1";
    return null;
  }

  /** 각/? 붙이기: 아직 비어 있는 끝만 (점유 끝은 무시) */
  function nearestFreeAsaEnd(sx, sy, thresh = 88) {
    if (!asm.baseSide) return null;
    const cands = [];
    if (!asm.endAngleP0) {
      cands.push({
        key: "p0",
        d: Math.hypot(sx - asm.baseSide.p0.x, sy - asm.baseSide.p0.y)
      });
    }
    if (!asm.endAngleP1) {
      cands.push({
        key: "p1",
        d: Math.hypot(sx - asm.baseSide.p1.x, sy - asm.baseSide.p1.y)
      });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    return cands[0].d <= thresh ? cands[0].key : null;
  }

  function nearestAngleRay(sx, sy) {
    if (!asm.angleAt) return -1;
    const a = asm.angleAt;
    const thresh = (asm.drag && asm.drag.kind === "side") ? 40 : 28;
    const distToRay = (dir) => {
      let best = Math.hypot(sx - a.origin.x, sy - a.origin.y);
      for (let t = 16; t < 170; t += 10) {
        const x = a.origin.x + Math.cos(dir) * t;
        const y = a.origin.y + Math.sin(dir) * t;
        best = Math.min(best, Math.hypot(sx - x, sy - y));
      }
      return best;
    };
    const candidates = [];
    if (!isAngleRayOccupied(0)) candidates.push({ idx: 0, d: distToRay(a.dirA) });
    if (!isAngleRayOccupied(1)) candidates.push({ idx: 1, d: distToRay(a.dirB) });
    if (!candidates.length) return -1;
    candidates.sort((p, q) => p.d - q.d);
    if (candidates[0].d >= thresh) return -1;
    return candidates[0].idx;
  }

  function drawAngleRaysHighlighted(hotRay) {
    const a = asm.angleAt;
    if (!a) return;
    const draggingSide = !!(asm.drag && asm.drag.kind === "side");
    // 첫 변(빈 팔) 또는 남은 변(남은 반직선) 드롭 힌트
    const needSides = draggingSide && asm.phase === "building"
      && ((asm.startKind === "angle" && !asm.baseSide)
        || (asm.baseSide && !asm.secondSide && freeAngleRay() >= 0));
    const rayLen = 160;
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);

    const drawOneRay = (dir, idx) => {
      // 이미 변이 놓인 팔은 반직선을 그리지 않음
      if (isAngleRayOccupied(idx)) return;

      const hot = needSides && (hotRay === idx || hotRay < 0);
      const veryHot = needSides && hotRay === idx;
      ctx.save();
      if (veryHot || needSides) {
        ctx.shadowColor = veryHot ? "rgba(61, 232, 255, 0.95)" : "rgba(255, 213, 106, 0.75)";
        ctx.shadowBlur = veryHot ? 22 : 14 * pulse;
      }
      ctx.strokeStyle = veryHot
        ? "#3de8ff"
        : (needSides ? `rgba(255, 213, 106, ${0.55 + 0.4 * pulse})` : "rgba(255, 213, 106, 0.85)");
      ctx.lineWidth = veryHot ? 7 : (needSides ? 5 : 3);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.origin.x, a.origin.y);
      ctx.lineTo(a.origin.x + Math.cos(dir) * rayLen, a.origin.y + Math.sin(dir) * rayLen);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      if (needSides) {
        const mid = 88;
        const lx = a.origin.x + Math.cos(dir) * mid;
        const ly = a.origin.y + Math.sin(dir) * mid;
        ctx.beginPath();
        ctx.arc(lx, ly, veryHot ? 16 : 12, 0, Math.PI * 2);
        ctx.fillStyle = veryHot ? "rgba(61, 232, 255, 0.35)" : `rgba(255, 213, 106, ${0.2 + 0.15 * pulse})`;
        ctx.fill();
        ctx.strokeStyle = veryHot ? "#3de8ff" : "#ffd56a";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    drawOneRay(a.dirA, 0);
    drawOneRay(a.dirB, 1);

    // ghost side preview on hot (empty) ray — 첫 변을 놓을 때만
    if (needSides && hotRay >= 0 && !isAngleRayOccupied(hotRay) && asm.drag && asm.drag.kind === "side") {
      const dir = hotRay === 0 ? a.dirA : a.dirB;
      const len = sideBoardLen(asm.drag.index);
      const tip = {
        x: a.origin.x + Math.cos(dir) * len,
        y: a.origin.y + Math.sin(dir) * len
      };
      ctx.strokeStyle = "rgba(61, 232, 255, 0.75)";
      ctx.lineWidth = 5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(a.origin.x, a.origin.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(61, 232, 255, 0.9)";
      ctx.font = "800 13px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatSideLen(asm.drag.index), (a.origin.x + tip.x) / 2, (a.origin.y + tip.y) / 2 - 14);
    }

    // wedge — interior sweep matching a.deg between the two rays
    {
      const want = (a.deg * Math.PI) / 180;
      let delta = a.dirB - a.dirA;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(Math.abs(delta) - want) > 0.25) {
        delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
      }
      // Snap magnitude to the labeled degree so the arc never lies.
      delta = delta < 0 ? -want : want;
      // Rays already drawn above — arc + label only (avoids nested double-angle look).
      drawAngleSector(a.origin.x, a.origin.y, a.dirA, delta, {
        r: 36,
        fill: "rgba(255, 213, 106, 0.28)",
        skipRays: true,
        label: `${a.deg}°`,
        labelR: 54
      });
    }
  }

  function renderBag() {
    toolSlots.innerHTML = "";
    let rulerSeen = 0;
    let proSeen = 0;
    const sidesDone = measuredSides.filter(Boolean).length;
    const angsDone = measuredAngles.filter(Boolean).length;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement("div");
      const kind = bag[i];
      el.className = "tool-slot" + (kind ? " filled" : "");
      if (!kind) {
        el.textContent = "빈칸";
      } else if (kind === "ruler") {
        const spent = rulerSeen < sidesDone;
        rulerSeen++;
        el.textContent = "📏 자";
        if (spent) el.style.opacity = "0.4";
        else if (scene === "tank" && tankMode === "measure") el.style.outline = "2px solid #ffd56a";
      } else {
        const spent = proSeen < angsDone;
        proSeen++;
        el.textContent = "📐 각도기";
        if (spent) el.style.opacity = "0.4";
        else if (scene === "tank" && tankMode === "measure") el.style.outline = "2px solid #ffd56a";
      }
      toolSlots.appendChild(el);
    }
  }

  function renderTankPips() {
    tankPips.innerHTML = "";
    for (let i = 0; i < TOTAL_TANKS; i++) {
      const pip = document.createElement("span");
      pip.className = "tank-pip"
        + (tanksFixed[i] ? " fixed" : "")
        + (i === tankIndex && !tanksFixed[i] ? " current" : "");
      pip.title = `수조 ${i + 1}`;
      tankPips.appendChild(pip);
    }
  }

  function setMission() {
    if (scene === "bench" && benchMode === "pick") {
      missionText.textContent = tankIndex === 0
        ? `자를 고르세요 (${bag.length}/3)`
        : `도구를 고르세요 (${bag.length}/3)`;
      return;
    }
    if (scene === "bench" && benchMode === "build") {
      const need = assembleNeeded();
      const done = isAssembleComplete();
      if (done) {
        missionText.textContent = "완성! 조각을 챙기세요";
        return;
      }
      if (isFreeConstructBuild()) {
        if (asm && asm.phase === "pick_first") {
          missionText.textContent = "조각으로 삼각형을 만드세요";
        } else if (isAsaFreeBuild() && asm && asm.baseSide && (!asm.endAngleP0 || !asm.endAngleP1)) {
          missionText.textContent = `양끝에 각을 붙이세요 (${assembleTaps}/${need})`;
        } else {
          missionText.textContent = `작도 중 (${assembleTaps}/${need})`;
        }
        return;
      }
      if (isAAABuild()) {
        missionText.textContent = `각을 놓으세요 (${assembleTaps}/${need})`;
        return;
      }
      if (isSssBuild()) {
        missionText.textContent = `변을 이어 붙이세요 (${assembleTaps}/${need})`;
        return;
      }
      missionText.textContent = `조각을 붙이세요 (${assembleTaps}/${need})`;
      return;
    }
    if (scene === "tank" && tankMode === "measure") {
      const rem = toolsRemaining();
      const left = rem.rulers + rem.protractors;
      missionText.textContent = left > 0
        ? `구멍의 변·각을 측정하세요 (${left}번 남음)`
        : "측정 완료 — 작업대로";
      return;
    }
    if (scene === "tank" && tankMode === "install") {
      missionText.textContent = dockAnim
        ? (dockAnim.ok ? "끼우는 중…" : "맞지 않아요…")
        : (patchDrag ? "구멍 위에 놓으세요" : "조각을 구멍에 끼우세요");
      return;
    }
    const map = {
      idle: "수리를 시작해 주세요",
      need_tools: "작업대로 가서 도구를 챙기세요",
      go_measure: `수조 ${tankIndex + 1}로 가서 구멍을 측정하세요`,
      go_build: "작업대로 가서 조각을 만드세요",
      go_install: `수조 ${tankIndex + 1}에 조각을 끼우세요`,
      result: "결과 확인 중…",
      gameover: "실험실 수리 종료"
    };
    missionText.textContent = map[phase] || "";
  }

  function syncSceneChrome() {
    const inScene = scene !== "world";
    sceneChrome.classList.toggle("hidden", !inScene);
    if (!inScene) return;

    if (scene === "bench" && benchMode === "pick") {
      btnSceneAction.classList.remove("hidden");
      btnSceneAction.textContent = "챙겼어요!";
      btnSceneAction.disabled = bag.length !== 3;
      if (btnMeasureRef) btnMeasureRef.classList.add("hidden");
      if (btnAssembleUndo) btnAssembleUndo.classList.add("hidden");
    } else if (scene === "bench" && benchMode === "build") {
      const done = isAssembleComplete();
      btnSceneAction.classList.remove("hidden");
      btnSceneAction.textContent = done ? "챙기기" : "조립";
      btnSceneAction.disabled = !done;
      if (btnMeasureRef) btnMeasureRef.classList.remove("hidden");
      if (btnAssembleUndo) {
        btnAssembleUndo.classList.remove("hidden");
        btnAssembleUndo.disabled = !canUndoAssembleStep();
      }
    } else if (scene === "tank" && tankMode === "measure") {
      btnSceneAction.classList.add("hidden");
      if (btnMeasureRef) btnMeasureRef.classList.add("hidden");
      if (btnAssembleUndo) btnAssembleUndo.classList.add("hidden");
    } else if (scene === "tank" && tankMode === "install") {
      btnSceneAction.classList.add("hidden");
      if (btnMeasureRef) btnMeasureRef.classList.add("hidden");
      if (btnAssembleUndo) btnAssembleUndo.classList.add("hidden");
    }
  }

  function syncMissionToast() {
    if (!missionBar) return;
    missionBar.classList.toggle("in-scene", scene !== "world");
    // Keep readable; briefly dim only during dock animation
    missionBar.classList.toggle("dim", !!(dockAnim && dockAnim.phase === "docking"));
  }

  function refreshUI() {
    updateHud();
    renderBag();
    renderTankPips();
    setMission();
    syncSceneChrome();
    syncMissionToast();
  }

  // ---------- Cat / camera ----------
  function updateCarrySprite() {
    if (hasTriangle) cat.carry = "triangle";
    else if (bag.length) cat.carry = "tools";
    else cat.carry = "empty";
  }

  function clampCamera() {
    cameraX = Math.max(0, Math.min(WORLD_W - VIEW_W, cameraX));
  }

  function walkToX(worldX, onArrive) {
    const x = Math.max(80, Math.min(WORLD_W - 80, worldX));
    cat.targetX = x;
    cat.facing = x >= cat.x ? 1 : -1;
    cat.arriveCb = onArrive || null;
    cameraFollow = true;
    updateCarrySprite();
    if (Math.abs(cat.x - cat.targetX) < 3) {
      cat.x = cat.targetX;
      stopCatWalk();
      const cb = cat.arriveCb;
      cat.arriveCb = null;
      if (cb) cb();
      else tryEnterNearbyPoi();
      return;
    }
    cat.walking = true;
  }

  function advanceWalkStride(dist) {
    cat.strideAcc += Math.abs(dist);
    while (cat.strideAcc >= CAT_PX_PER_FRAME) {
      cat.strideAcc -= CAT_PX_PER_FRAME;
      cat.frame = (cat.frame + 1) % 4;
      // Contact-ish frames 0 & 2 get a soft paw tap
      if (cat.frame % 2 === 0) sound.footstep();
    }
    cat.bobPhase += Math.abs(dist) * 0.12;
    cat.bob = Math.sin(cat.bobPhase) * CAT_BOB_AMP;
  }

  function stopCatWalk() {
    cat.walking = false;
    cat.strideAcc = 0;
    cat.bob = 0;
    cat.frame = CAT_STAND_FRAME;
  }

  function updateCat(dt) {
    if (scene !== "world") return;

    // Keyboard move (desktop)
    let keyDir = 0;
    if (keys.left) keyDir -= 1;
    if (keys.right) keyDir += 1;
    if (keyDir !== 0 && !pointer.dragging) {
      cameraFollow = true;
      cat.walking = true;
      cat.facing = keyDir;
      cat.arriveCb = null;
      cat.targetX = cat.x;
      const step = keyDir * CAT_SPEED * dt;
      cat.x = Math.max(80, Math.min(WORLD_W - 80, cat.x + step));
      advanceWalkStride(step);
      poiCheckCooldown -= dt;
      if (poiCheckCooldown <= 0) {
        poiCheckCooldown = 0.25;
        tryEnterNearbyPoi();
      }
      return;
    }

    if (!cat.walking) {
      cat.bob *= Math.max(0, 1 - dt * 10);
      return;
    }
    const dx = cat.targetX - cat.x;
    const step = CAT_SPEED * dt;
    if (Math.abs(dx) <= step) {
      cat.x = cat.targetX;
      stopCatWalk();
      const cb = cat.arriveCb;
      cat.arriveCb = null;
      if (cb) cb();
      else tryEnterNearbyPoi();
      return;
    }
    const move = Math.sign(dx) * step;
    cat.x += move;
    advanceWalkStride(move);
  }

  function updateCamera(dt) {
    if (scene !== "world") return;
    if (!cameraFollow) return;
    const ideal = cat.x - VIEW_W * 0.42;
    const k = 1 - Math.pow(0.001, dt || 0.016);
    cameraX += (ideal - cameraX) * Math.min(1, k * 8);
    clampCamera();
  }

  function nearestPoi(worldX) {
    let best = null;
    let bestD = POI_ENTER_DIST;
    for (const z of ZONES) {
      const d = Math.abs(worldX - z.x);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best;
  }

  function tryEnterNearbyPoi() {
    if (scene !== "world") return;
    const z = nearestPoi(cat.x);
    if (!z) return;
    if (z.id === "bench") {
      if (phase === "need_tools") enterBenchPick();
      else if (phase === "go_build") enterBenchBuild();
      return;
    }
    if (typeof z.tank === "number" && z.tank === tankIndex) {
      if (phase === "go_measure") enterTankMeasure();
      else if (phase === "go_install") enterTankInstall();
    }
  }

  // ---------- Scenes ----------
  function exitToWorld(nextPhase, flash) {
    scene = "world";
    benchMode = null;
    tankMode = null;
    hover = null;
    if (nextPhase) phase = nextPhase;
    updateCarrySprite();
    cameraFollow = true;
    refreshUI();
    if (flash) showFlash(flash);
  }

  function setupBenchPickTools() {
    bag = [];
    const items = [];
    // 테스트: 탁자에 자2·각도기1만 (각1변2 조립만)
    if (TEST_A1S2) {
      const layout = [
        { kind: "ruler", x: 260, y: 280 },
        { kind: "ruler", x: 460, y: 300 },
        { kind: "protractor", x: 700, y: 290 }
      ];
      layout.forEach((L, i) => {
        items.push({
          id: "t" + i,
          kind: L.kind,
          x: L.x,
          y: L.y,
          w: L.kind === "ruler" ? 150 : 88,
          h: L.kind === "ruler" ? 36 : 88,
          taken: false,
          rot: L.kind === "ruler" ? (-6 + i * 6) : 0
        });
      });
      benchTools = items;
      return;
    }
    // 테스트: 자1·각도기2 (각2변1)
    if (TEST_A2S1) {
      const layout = [
        { kind: "ruler", x: 300, y: 290 },
        { kind: "protractor", x: 520, y: 280 },
        { kind: "protractor", x: 720, y: 300 }
      ];
      layout.forEach((L, i) => {
        items.push({
          id: "t" + i,
          kind: L.kind,
          x: L.x,
          y: L.y,
          w: L.kind === "ruler" ? 150 : 88,
          h: L.kind === "ruler" ? 36 : 88,
          taken: false,
          rot: L.kind === "ruler" ? -4 : 0
        });
      });
      benchTools = items;
      return;
    }
    if (tankIndex === 0) {
      // Three rulers on the table
      for (let i = 0; i < 3; i++) {
        items.push({
          id: "r" + i,
          kind: "ruler",
          x: 220 + i * 180,
          y: 290,
          w: 150,
          h: 36,
          taken: false,
          rot: -8 + i * 8
        });
      }
    } else {
      // rulers shrink on later tanks: 수조2=3, 수조3·4=2, 수조5=1
      let rulerCount = 3;
      if (tankIndex === 2 || tankIndex === 3) rulerCount = 2;
      else if (tankIndex >= 4) rulerCount = 1;
      const rulerXs = { 3: [160, 320, 480], 2: [220, 420], 1: [320] }[rulerCount];
      const layout = [];
      for (let i = 0; i < rulerCount; i++) {
        layout.push({ kind: "ruler", x: rulerXs[i], y: 265 + (i % 2) * 35 });
      }
      // Keep the rightmost protractor inside the tray, which ends at VIEW_W - 40.
      layout.push(
        { kind: "protractor", x: 610, y: 285 },
        { kind: "protractor", x: 735, y: 315 },
        { kind: "protractor", x: 860, y: 275 }
      );
      layout.forEach((L, i) => {
        items.push({
          id: "t" + i,
          kind: L.kind,
          x: L.x,
          y: L.y,
          w: L.kind === "ruler" ? 150 : 88,
          h: L.kind === "ruler" ? 36 : 88,
          taken: false,
          rot: L.kind === "ruler" ? (-6 + (i % 3) * 6) : 0
        });
      });
    }
    benchTools = items;
  }

  function applyTestA1S2Loadout() {
    if (!TEST_A1S2) return;
    // 수조1(SSS만) 건너뛰고, 자2+각도기1 들고 측정으로
    if (tankIndex < 1) tankIndex = 1;
    bag = ["ruler", "ruler", "protractor"];
    updateCarrySprite();
    phase = "go_measure";
    showFlash("테스트: 각1·변2 — 수조로 가서 구멍을 측정하세요");
  }

  function applyTestA2S1Loadout() {
    if (!TEST_A2S1) return;
    if (tankIndex < 1) tankIndex = 1;
    bag = ["ruler", "protractor", "protractor"];
    updateCarrySprite();
    phase = "go_measure";
    showFlash("테스트: 각2·변1 — 변과 양끝 각을 측정하세요");
  }

  function enterBenchPick() {
    scene = "bench";
    benchMode = "pick";
    setupBenchPickTools();
    phase = "need_tools";
    refreshUI();
    sound.enter();
  }

  function enterBenchBuild() {
    scene = "bench";
    benchMode = "build";
    buildOk = isRigid(measuredSides, measuredAngles);
    resetAssembleState();
    asmMysteryIndex = -1;
    plankDesign = null;
    aaaVertexMap = null;
    phase = "go_build";
    refreshUI();
    sound.enter();
  }

  function enterTankMeasure() {
    if (bag.length !== 3) {
      showFlash("먼저 작업대에서 도구를 챙기세요!");
      return;
    }
    if (measureHistory.length >= 3) {
      exitToWorld("go_build", "이미 다 쟀어요. 작업대로!");
      return;
    }
    scene = "tank";
    tankMode = "measure";
    toolIndex = measureHistory.length;
    hover = null;
    resetLeakBubbles();
    refreshUI();
    sound.enter();
  }

  function enterTankInstall() {
    if (!hasTriangle || !plankDesign) {
      showFlash("삼각형 조각이 없어요!");
      return;
    }
    scene = "tank";
    tankMode = "install";
    dockAnim = null;
    patchDrag = null;
    patchPose = { x: VIEW_W * 0.22, y: VIEW_H * 0.55, scale: 1.25 };
    resetLeakBubbles();
    refreshUI();
    sound.enter();
  }

  function advanceAssemble() {
    // legacy button path — only finish when complete
    if (scene !== "bench" || benchMode !== "build") return;
    if (isAssembleComplete()) finishAssembleAndExit();
    else showFlash("왼쪽 조각을 드래그해서 붙이세요");
  }

  function finishAssembleAndExit() {
    if (scene !== "bench" || benchMode !== "build") return;
    if (!isAssembleComplete()) {
      showFlash("아직 조각이 남았어요");
      return;
    }
    syncAssembleTaps();
    if (isOneAngleBuild() || isAsaFreeBuild()) {
      // buildOk / plankDesign already set in tryClose*
      if (!plankDesign && asm.resultPts) {
        const c = centroid(asm.resultPts);
        plankDesign = asm.resultPts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
      }
    } else if (isAAABuild()) {
      if (!plankDesign) tryCloseAaa();
      if (!plankDesign && asm.resultPts) {
        const c = centroid(asm.resultPts);
        plankDesign = asm.resultPts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
      }
    } else {
      buildOk = isRigid(measuredSides, measuredAngles);
      plankDesign = buildOk
        ? hole.designPts.map((p) => ({ ...p }))
        : buildCounterPlank(hole.designPts, measuredSides);
    }
    hasTriangle = true;
    bag = [];
    updateCarrySprite();
    sound.success();
    exitToWorld("go_install", "삼각형 조각을 수조 구멍에 끼우러 가세요!");
  }

  function pickBenchTool(tool) {
    if (!tool || tool.taken || bag.length >= 3) return;
    tool.taken = true;
    bag.push(tool.kind);
    sound.pickup();
    updateCarrySprite();
    refreshUI();
    if (bag.length === 3) showFlash("입에 꽉 찼어요!");
  }

  function unpickBenchTool(tool) {
    if (!tool || !tool.taken) return;
    const idx = bag.lastIndexOf(tool.kind);
    if (idx < 0) return;
    bag.splice(idx, 1);
    tool.taken = false;
    sound.click();
    updateCarrySprite();
    refreshUI();
    showFlash("도구를 내려놓았어요");
  }

  function toggleBenchTool(tool) {
    if (!tool) return;
    if (tool.taken) unpickBenchTool(tool);
    else pickBenchTool(tool);
  }

  function confirmToolsAndExit() {
    if (bag.length !== 3) {
      showFlash("도구를 세 개 챙겨야 해요!");
      return;
    }
    toolIndex = 0;
    sound.pickup();
    // 이미 잰 상태면(삼각형 다시 만들기) 바로 조립으로
    if (measureHistory.length >= 3) {
      enterBenchBuild();
      return;
    }
    exitToWorld("go_measure", `수조 ${tankIndex + 1}로 이동하세요`);
  }

  function beginTank() {
    bag = [];
    toolIndex = 0;
    measuredSides = [false, false, false];
    measuredAngles = [false, false, false];
    measureHistory = [];
    hole = generateHole();
    hasTriangle = false;
    resetAssembleState();
    buildOk = false;
    plankDesign = null;
    aaaVertexMap = null;
    dockAnim = null;
    patchDrag = null;
    hover = null;
    scene = "world";
    benchMode = null;
    tankMode = null;
    phase = "need_tools";
    updateCarrySprite();
    applyTestA1S2Loadout();
    applyTestA2S1Loadout();
    // 테스트 시 해당 수조 앞으로 이동
    if (TEST_A1S2 || TEST_A2S1) {
      const z = zoneById(`tank${tankIndex}`);
      if (z) {
        cat.x = z.x;
        cat.targetX = z.x;
        cameraX = Math.max(0, cat.x - VIEW_W * 0.42);
      }
    }
    refreshUI();
  }

  function openAngleQuiz() {
    const known = [];
    for (let i = 0; i < 3; i++) if (measuredAngles[i]) known.push(i);
    const missing = asmMysteryIndex >= 0
      ? asmMysteryIndex
      : [0, 1, 2].find((i) => !measuredAngles[i]);
    if (missing == null || known.length < 2) return;
    const trueAng = hole.anglesDeg[missing];
    const distractors = new Set([trueAng]);
    while (distractors.size < 3) {
      const d = NICE_ANGLES[Math.floor(Math.random() * NICE_ANGLES.length)];
      if (Math.abs(d - trueAng) >= 10) distractors.add(d);
    }
    const choices = [...distractors].sort(() => Math.random() - 0.5);
    if (quizTitle) quizTitle.textContent = "나머지 각은?";
    quizPrompt.textContent = `각 ${ANGLE_LABELS[known[0]]}=${hole.anglesDeg[known[0]]}°, `
      + `각 ${ANGLE_LABELS[known[1]]}=${hole.anglesDeg[known[1]]}°일 때 `
      + `나머지 각 ${ANGLE_LABELS[missing]}는?`;
    quizFeedback.textContent = "";
    quizChoices.innerHTML = "";
    phase = "quiz";
    choices.forEach((deg) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-choice";
      btn.textContent = `${deg}°`;
      btn.addEventListener("click", () => {
        if (deg === trueAng) {
          quizFeedback.textContent = "맞아요! 세 각의 합은 180°예요.";
          quizFeedback.style.color = "#5dffb0";
          measuredAngles[missing] = true;
          asm.mysterySolved = true;
          asm.placedAngles[missing] = true;
          buildOk = isRigid(measuredSides, measuredAngles);
          plankDesign = hole.designPts.map((p) => ({ ...p }));
          syncAssembleTaps();
          sound.success();
          setTimeout(() => {
            quizModal.classList.add("hidden");
            document.body.classList.remove("modal-open");
            scene = "bench";
            benchMode = "build";
            phase = "go_build";
            asm.drag = null;
            refreshUI();
          }, 700);
        } else {
          quizFeedback.textContent = "다시 생각해 보세요. 세 각을 더하면 180°!";
          quizFeedback.style.color = "#ff6b8a";
          sound.fail();
        }
      });
      quizChoices.appendChild(btn);
    });
    quizModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y))
        && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function freePatchPts() {
    if (!plankDesign) return null;
    return mapPtsToCenter(plankDesign, { x: patchPose.x, y: patchPose.y }, patchPose.scale);
  }

  function hitFreePatch(sx, sy) {
    const pts = freePatchPts();
    if (!pts) return false;
    if (pointInPoly(sx, sy, pts)) return true;
    const c = centroid(pts);
    return Math.hypot(sx - c.x, sy - c.y) < 55;
  }

  /** Rigid motion: align a corresponding side (by matching angles) so all sides stay parallel. */
  function edgeFlushPts(patchPts, holePts) {
    const σ = (aaaVertexMap && aaaVertexMap.length === 3)
      ? aaaVertexMap
      : (asm && asm.aaaSlot && asm.aaaSlot.every((s) => s != null) ? asm.aaaSlot.slice() : [0, 1, 2]);
    let k = 0;
    let longest = -1;
    for (let i = 0; i < 3; i++) {
      const len = dist(holePts[i], holePts[(i + 1) % 3]);
      if (len > longest) {
        longest = len;
        k = i;
      }
    }
    const h0 = k;
    const h1 = (k + 1) % 3;
    const p0 = σ.indexOf(h0);
    const p1 = σ.indexOf(h1);
    if (p0 < 0 || p1 < 0) {
      // fallback: same-index flush
      const ha = holePts[k];
      const hb = holePts[(k + 1) % 3];
      const pa = patchPts[k];
      const pb = patchPts[(k + 1) % 3];
      const turn = Math.atan2(hb.y - ha.y, hb.x - ha.x) - Math.atan2(pb.y - pa.y, pb.x - pa.x);
      const rot = rotatePts(patchPts, pa, turn);
      const dx = ha.x - rot[k].x;
      const dy = ha.y - rot[k].y;
      return rot.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    const ha = holePts[h0];
    const hb = holePts[h1];
    const pa = patchPts[p0];
    const pb = patchPts[p1];
    const turn = Math.atan2(hb.y - ha.y, hb.x - ha.x) - Math.atan2(pb.y - pa.y, pb.x - pa.x);
    const rot = rotatePts(patchPts, pa, turn);
    // Center the shorter patch side on the hole side so the size gap is obvious.
    const ra = rot[p0];
    const rb = rot[p1];
    const dx = (ha.x + hb.x) / 2 - (ra.x + rb.x) / 2;
    const dy = (ha.y + hb.y) / 2 - (ra.y + rb.y) / 2;
    return rot.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  function startDockAnim(fromPts) {
    if (dockAnim || !plankDesign) return;
    const holePts = holePtsInTankScene();
    if (!holePts) return;
    const from = (fromPts || freePatchPts()).map((p) => ({ ...p }));
    let to;
    if (buildOk) {
      to = holePts.map((p) => ({ ...p }));
    } else if (isAAABuild()) {
      to = edgeFlushPts(from, holePts);
    } else {
      const c = centroid(holePts);
      to = rotatePts(holePts.map((p) => ({
        x: p.x + 28,
        y: p.y - 18
      })), c, 0.45);
    }
    patchDrag = null;
    dockAnim = {
      from,
      to,
      t0: performance.now(),
      dur: buildOk ? 700 : 650,
      ok: buildOk,
      phase: "docking"
    };
    sound.snap();
    refreshUI();
  }

  function tryDropPatchOnHole() {
    const holePts = holePtsInTankScene();
    if (!holePts) return;
    const hc = centroid(holePts);
    const dist = Math.hypot(patchPose.x - hc.x, patchPose.y - hc.y);
    if (dist < 95) {
      startDockAnim(freePatchPts());
    } else {
      showFlash("구멍 더 가까이 드래그하세요");
      refreshUI();
    }
  }

  function updateDockAnim() {
    if (!dockAnim) return;
    if (dockAnim.phase !== "docking" && dockAnim.phase !== "hold") return;
    const t = (performance.now() - dockAnim.t0) / dockAnim.dur;
    if (t < 1) return;
    // Too small to seal: rest against the side it lined up with before it slides off.
    if (!dockAnim.ok && dockAnim.phase === "docking" && isAAABuild()) {
      dockAnim.phase = "hold";
      dockAnim.t0 = performance.now();
      dockAnim.dur = 560;
      return;
    }
    if (dockAnim.ok) {
      dockAnim.phase = "done";
      hasTriangle = false;
      sound.repair();
      if (window.confetti) confetti({ particleCount: 80, spread: 55, origin: { y: 0.65 } });
      setTimeout(() => {
        tanksFixed[tankIndex] = true;
        const pts = 100;
        totalScore += pts;
        roundScores[tankIndex] = pts;
        updateCarrySprite();
        scene = "world";
        tankMode = null;
        dockAnim = null;
        patchDrag = null;
        endTank(true, pts, `수조 ${tankIndex + 1} 수리 완료!`, "삼각형 조각이 구멍에 딱 맞았어요.");
      }, 500);
    } else {
      const settled = rigidLerpPts(dockAnim.from, dockAnim.to, 1);
      const c = centroid(settled);
      const tooSmall = isAAABuild();
      dockAnim.slipBase = settled.map((p) => ({ ...p }));
      dockAnim.slipC = { x: c.x, y: c.y };
      dockAnim.slipSpin = (Math.random() > 0.5 ? 1 : -1)
        * (tooSmall ? 0.25 + Math.random() * 0.2 : 1.1 + Math.random() * 0.5);
      dockAnim.slipVx = tooSmall ? 20 + Math.random() * 25 : 100 + Math.random() * 80;
      dockAnim.slipVy = tooSmall ? 12 : -70 - Math.random() * 40;
      dockAnim.slipG = 560;
      dockAnim.phase = "slip";
      dockAnim.t0 = performance.now();
      dockAnim.dur = 920;
      const holeC = centroid(holePtsInTankScene() || settled);
      burstWaterSpray(holeC, 64);
      sound.slip();
    }
  }

  function slipPatchPts(t) {
    const base = dockAnim.slipBase || dockAnim.to;
    const c0 = dockAnim.slipC || centroid(base);
    const ang = (dockAnim.slipSpin || 1.2) * t;
    const x = (dockAnim.slipVx || 120) * t;
    const y = (dockAnim.slipVy || -60) * t + 0.5 * (dockAnim.slipG || 500) * t * t;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    return base.map((p) => {
      const dx = p.x - c0.x;
      const dy = p.y - c0.y;
      return {
        x: c0.x + dx * cos - dy * sin + x,
        y: c0.y + dx * sin + dy * cos + y
      };
    });
  }

  function updateSlipAnim() {
    if (!dockAnim || dockAnim.phase !== "slip") return;
    const t = (performance.now() - dockAnim.t0) / dockAnim.dur;
    // keep spraying while bouncing off
    if (t < 0.55) {
      const holePts = holePtsInTankScene();
      if (holePts && Math.random() < 0.45) burstWaterSpray(centroid(holePts), 6);
    }
    if (t < 1) return;
    hasTriangle = false;
    plankDesign = null;
    aaaVertexMap = null;
    dockAnim = null;
    patchDrag = null;
    scene = "world";
    tankMode = null;
    endTank(false, 0, "구멍에 맞지 않았어요", isAAABuild()
      ? "각만 재면 크기가 정해지지 않아요 — 모양은 닮았지만 더 작아요."
      : "삼각형 조각이 수조 구멍과 달라요.");
  }

  function endTank(ok, pts, title, hint) {
    phase = "result";
    refreshUI();
    document.getElementById("result-icon").textContent = ok ? "✅" : "💧";
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-score-badge").textContent = ok ? "수리 완료" : "다시 도전";
    document.getElementById("result-subtitle").textContent = ok
      ? `${TOTAL_TANKS - tanksFixed.filter(Boolean).length}개 남음`
      : "같은 수조를 측정부터 다시 해요";
    document.getElementById("result-hint").textContent = hint;
    document.getElementById("btn-next-round").textContent = ok
      ? (tankIndex >= TOTAL_TANKS - 1 || tanksFixed.every(Boolean) ? "결과 보기 ➔" : "다음 수조 ➔")
      : "다시 측정하기 ➔";
    resultModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  /** 설치 실패: 같은 수조·같은 구멍, 도구·측정·조립만 리셋 */
  function retryCurrentTankFromMeasure() {
    bag = [];
    toolIndex = 0;
    measuredSides = [false, false, false];
    measuredAngles = [false, false, false];
    measureHistory = [];
    hasTriangle = false;
    plankDesign = null;
    buildOk = false;
    resetAssembleState();
    dockAnim = null;
    patchDrag = null;
    hover = null;
    scene = "world";
    benchMode = null;
    tankMode = null;
    updateCarrySprite();
    if (TEST_A1S2) {
      applyTestA1S2Loadout();
      refreshUI();
      exitToWorld("go_measure", `수조 ${tankIndex + 1}에서 다시 구멍을 측정하세요`);
      return;
    }
    if (TEST_A2S1) {
      applyTestA2S1Loadout();
      refreshUI();
      exitToWorld("go_measure", `수조 ${tankIndex + 1}에서 다시 구멍을 측정하세요`);
      return;
    }
    phase = "need_tools";
    refreshUI();
    showFlash(`수조 ${tankIndex + 1} — 도구를 다시 챙기고 측정하세요!`);
  }

  function advanceAfterResult() {
    resultModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    if (tanksFixed.every(Boolean)) {
      playSuccessThenGameOver();
      return;
    }
    // Install fail: stay on this tank and remasure (do not advance / game over)
    if (!tanksFixed[tankIndex]) {
      retryCurrentTankFromMeasure();
      return;
    }
    if (tankIndex >= TOTAL_TANKS - 1) {
      openGameOver();
      return;
    }
    let next = tankIndex + 1;
    while (next < TOTAL_TANKS && tanksFixed[next]) next++;
    if (next >= TOTAL_TANKS) {
      openGameOver();
      return;
    }
    tankIndex = next;
    beginTank();
  }

  function playSuccessThenGameOver() {
    pendingGameOverAfterSuccess = true;
    if (successOverlay) {
      successOverlay.classList.remove("hidden");
      successOverlay.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("modal-open");
    try {
      if (successVideo) {
        successVideo.currentTime = 0;
        const p = successVideo.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  function finishSuccessCutscene() {
    if (!pendingGameOverAfterSuccess) return;
    pendingGameOverAfterSuccess = false;
    try { if (successVideo) successVideo.pause(); } catch (e) { /* ignore */ }
    if (successOverlay) {
      successOverlay.classList.add("hidden");
      successOverlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
    openGameOver();
  }

  function playTimeoutThenGameOver() {
    pendingGameOverAfterTimeout = true;
    endedByTimeout = true;
    if (timeoutOverlay) {
      timeoutOverlay.classList.remove("hidden");
      timeoutOverlay.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("modal-open");
    try {
      if (timeoutVideo) {
        timeoutVideo.currentTime = 0;
        const p = timeoutVideo.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  function finishTimeoutCutscene() {
    if (!pendingGameOverAfterTimeout) return;
    pendingGameOverAfterTimeout = false;
    try { if (timeoutVideo) timeoutVideo.pause(); } catch (e) { /* ignore */ }
    if (timeoutOverlay) {
      timeoutOverlay.classList.add("hidden");
      timeoutOverlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
    openGameOver();
  }

  function openGameOver() {
    running = false;
    if (mobileFs) mobileFs.syncButton();
    phase = "gameover";
    scene = "world";
    refreshUI();

    const allFixed = tanksFixed.every(Boolean);
    clearTimeMs = allFixed ? elapsedMs() : null;

    const titleEl = document.getElementById("gameover-title");
    const subtitleEl = document.getElementById("gameover-subtitle");
    const trophyEl = document.getElementById("gameover-trophy");
    const finalEl = document.getElementById("final-total-score");
    const unitEl = document.getElementById("final-score-unit");
    if (clearTimeMs != null) {
      if (titleEl) titleEl.textContent = "실험실 수리 완료!";
      if (subtitleEl) subtitleEl.textContent = "다섯 수조 미션을 마쳤습니다";
      if (trophyEl) trophyEl.textContent = "🏆";
      finalEl.textContent = formatClearTime(clearTimeMs);
      unitEl.textContent = "클리어";
      if (!bestClearTimeMs || clearTimeMs < bestClearTimeMs) {
        bestClearTimeMs = clearTimeMs;
        localStorage.setItem(
          activeMode === "dorms" ? "hm_three_chances_best_dorms" : "hm_three_chances_best",
          String(bestClearTimeMs)
        );
        document.getElementById("new-highscore-banner").classList.remove("hidden");
      } else {
        document.getElementById("new-highscore-banner").classList.add("hidden");
      }
    } else {
      if (endedByTimeout) {
        if (titleEl) titleEl.textContent = "타임오버!";
        if (subtitleEl) subtitleEl.textContent = "시간이 끝나 수리를 마치지 못했어요";
        if (trophyEl) trophyEl.textContent = "⏰";
        finalEl.textContent = "타임오버!";
        unitEl.textContent = "";
      } else {
        if (titleEl) titleEl.textContent = "수리 미완료";
        if (subtitleEl) subtitleEl.textContent = "다섯 수조를 모두 고치지 못했어요";
        if (trophyEl) trophyEl.textContent = "💧";
        finalEl.textContent = "미완";
        unitEl.textContent = "";
      }
      document.getElementById("new-highscore-banner").classList.add("hidden");
    }

    document.getElementById("result-locked-name").textContent = playerName;
    document.getElementById("result-locked-id").textContent = studentId || "미입력";
    const grid = document.getElementById("round-scores-grid");
    grid.innerHTML = "";
    for (let i = 0; i < TOTAL_TANKS; i++) {
      const cell = document.createElement("div");
      cell.className = "round-score-cell";
      cell.innerHTML = `<div>수조 ${i + 1}</div><strong>${tanksFixed[i] ? "✓" : "—"}</strong>`;
      grid.appendChild(cell);
    }

    const btnSendEl = document.getElementById("btn-send-data");
    const msg = document.getElementById("api-status-msg");
    if (btnSendEl) {
      btnSendEl.disabled = clearTimeMs == null;
      btnSendEl.textContent = clearTimeMs == null ? "클리어 후 등록 가능" : "기록 등록하기";
    }
    if (msg && clearTimeMs == null) {
      msg.textContent = "다섯 수조를 모두 고쳐야 클리어 시간을 등록할 수 있어요.";
    } else if (msg) {
      msg.textContent = "";
    }

    gameoverModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    loadLeaderboard();
  }

  /** 열려 있는 모달·컷신을 모두 닫고 대기 중인 컷신 상태를 해제 */
  function closeAllOverlays() {
    pendingStartAfterIntro = false;
    pendingGameOverAfterSuccess = false;
    pendingGameOverAfterTimeout = false;
    [introVideo, successVideo, timeoutVideo].forEach((v) => {
      try { if (v) v.pause(); } catch (e) { /* ignore */ }
    });
    [introOverlay, successOverlay, timeoutOverlay].forEach((el) => {
      if (!el) return;
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    });
    [quizModal, resultModal, gameoverModal, measureRefOverlay, hingeAngleModal, assembleFailModal]
      .forEach((el) => { if (el) el.classList.add("hidden"); });
    document.body.classList.remove("modal-open");
  }

  function restartGame() {
    closeAllOverlays();
    totalScore = 0;
    roundScores = [];
    clearTimeMs = null;
    tankIndex = 0;
    tanksFixed = [false, false, false, false, false];
    timeLeftMs = TIME_LIMIT_MS;
    endedByTimeout = false;
    flashMsg = "";
    flashUntil = 0;
    cat.x = zoneById("tank0").x;
    cat.targetX = cat.x;
    cat.facing = 1;
    cat.arriveCb = null;
    stopCatWalk();
    cameraX = Math.max(0, cat.x - VIEW_W * 0.42);
    cameraFollow = true;
    running = true;
    lastTs = performance.now();
    beginTank();
    if (mobileFs) {
      mobileFs.requestIfMobile();
      mobileFs.syncButton();
    }
  }

  // ---------- Measure (tank scene) ----------
  function holePtsInTankScene() {
    if (!hole) return null;
    return mapPtsToCenter(hole.designPts, { x: VIEW_W * 0.52, y: VIEW_H * 0.48 }, 1.35);
  }

  function distToSegment(px, py, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    let t = ((px - a.x) * vx + (py - a.y) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
  }

  function hitTestMeasure(sx, sy) {
    const pts = holePtsInTankScene();
    if (!pts) return null;
    const rem = toolsRemaining();
    let best = null;
    let bestD = 1e9;

    // 꼭짓점(각) 우선 — 각부터 잴 수 있게
    if (rem.protractors > 0) {
      for (let i = 0; i < 3; i++) {
        if (measuredAngles[i]) continue;
        const d = Math.hypot(sx - pts[i].x, sy - pts[i].y);
        if (d < 44 && d < bestD) {
          bestD = d;
          best = { kind: "angle", index: i };
        }
      }
    }
    if (best) return best;

    if (rem.rulers > 0) {
      bestD = 32;
      for (let i = 0; i < 3; i++) {
        if (measuredSides[i]) continue;
        const a = pts[i];
        const b = pts[(i + 1) % 3];
        const d = distToSegment(sx, sy, a, b);
        if (d < bestD) {
          bestD = d;
          best = { kind: "side", index: i };
        }
      }
    }
    return best;
  }

  function tryMeasure(target) {
    if (scene !== "tank" || tankMode !== "measure" || !target) return;
    const rem = toolsRemaining();
    if (target.kind === "side") {
      if (rem.rulers <= 0) {
        showFlash("자가 없어요. 변은 자로 재요!");
        return;
      }
      if (measuredSides[target.index]) {
        showFlash("이미 잰 변이에요!");
        return;
      }
      measuredSides[target.index] = true;
    } else {
      if (rem.protractors <= 0) {
        showFlash("각도기가 없어요. 각은 각도기로 재요!");
        return;
      }
      if (measuredAngles[target.index]) {
        showFlash("이미 잰 각이에요!");
        return;
      }
      measuredAngles[target.index] = true;
    }
    measureHistory.push(target);
    sound.measure();
    refreshUI();
    if (measureHistory.length >= 3) {
      setTimeout(() => {
        exitToWorld("go_build", "측정 완료! 작업대로 돌아가세요");
      }, 450);
    }
  }

  function hitBenchTool(sx, sy) {
    for (let i = benchTools.length - 1; i >= 0; i--) {
      const t = benchTools[i];
      if (sx >= t.x - t.w / 2 && sx <= t.x + t.w / 2 && sy >= t.y - t.h / 2 && sy <= t.y + t.h / 2) {
        return t;
      }
    }
    return null;
  }

  // ---------- Pointer ----------
  function canvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    // touchend has an empty touches list that is still truthy — prefer changedTouches.
    const src =
      (evt.changedTouches && evt.changedTouches.length > 0 && evt.changedTouches[0])
      || (evt.touches && evt.touches.length > 0 && evt.touches[0])
      || evt;
    const rw = rect.width || 1;
    const rh = rect.height || 1;
    return {
      x: ((src.clientX - rect.left) / rw) * canvas.width,
      y: ((src.clientY - rect.top) / rh) * canvas.height,
      clientX: src.clientX,
      clientY: src.clientY
    };
  }

  function onPointerDown(evt) {
    if (portraitBlocked) return;
    if (!running || phase === "idle" || phase === "result" || phase === "gameover" || phase === "quiz") return;
    evt.preventDefault();
    sound.init();
    const p = canvasPos(evt);
    pointer.down = true;
    pointer.dragging = false;
    pointer.startX = p.x;
    pointer.startY = p.y;
    pointer.lastX = p.x;
    pointer.startClientX = p.clientX;
    pointer.startClientY = p.clientY;
    pointer.moved = 0;

    if (scene === "tank" && tankMode === "measure") {
      hover = hitTestMeasure(p.x, p.y);
    }

    if (scene === "bench" && benchMode === "build") {
      if (!asm) resetAssembleState();
      const piece = hitAsmTray(p.x, p.y);
      if (piece) {
        asm.drag = {
          kind: piece.kind,
          index: piece.index,
          x: p.x,
          y: p.y
        };
        sound.click();
        return;
      }
      // tap red ? socket on board (ASA legacy)
      if (!isFreeConstructBuild() && asmMysteryIndex >= 0 && !asm.mysterySolved) {
        const full = assembleBoardPts();
        const v = full[asmMysteryIndex];
        if (Math.hypot(p.x - v.x, p.y - v.y) < 36) {
          openAngleQuiz();
          return;
        }
      }
    }

    if (scene === "tank" && tankMode === "install" && !dockAnim && hitFreePatch(p.x, p.y)) {
      patchDrag = { dx: p.x - patchPose.x, dy: p.y - patchPose.y };
      sound.click();
      refreshUI();
    }
  }

  function onPointerMove(evt) {
    if (portraitBlocked || !running) return;
    const p = canvasPos(evt);

    if (scene === "tank" && tankMode === "measure") {
      // Ignore the synthetic mouse event that follows touchend on phones.
      if (!(coarsePointerMq.matches && evt.type === "mousemove")) {
        hover = hitTestMeasure(p.x, p.y);
      }
    }

    if (asm && asm.drag && scene === "bench" && benchMode === "build") {
      evt.preventDefault();
      pointer.dragging = true;
      pointer.moved = Math.hypot(
        p.clientX - pointer.startClientX,
        p.clientY - pointer.startClientY
      );
      asm.drag.x = p.x;
      asm.drag.y = p.y;
      return;
    }

    if (patchDrag && scene === "tank" && tankMode === "install" && !dockAnim) {
      evt.preventDefault();
      pointer.dragging = true;
      pointer.moved = Math.hypot(
        p.clientX - pointer.startClientX,
        p.clientY - pointer.startClientY
      );
      patchPose.x = Math.max(60, Math.min(VIEW_W - 60, p.x - patchDrag.dx));
      patchPose.y = Math.max(80, Math.min(VIEW_H - 40, p.y - patchDrag.dy));
      return;
    }

    if (!pointer.down) return;
    evt.preventDefault();
    const dx = p.x - pointer.lastX;
    // Screen pixels, not canvas coords — on a phone the canvas is often ~half width,
    // so a 6px finger wobble already exceeds DRAG_THRESH when measured in canvas space.
    pointer.moved = Math.hypot(
      p.clientX - pointer.startClientX,
      p.clientY - pointer.startClientY
    );
    pointer.lastX = p.x;

    if (scene === "world" && pointer.moved > DRAG_THRESH) {
      pointer.dragging = true;
      cameraFollow = false;
      cameraX -= dx;
      clampCamera();
    }
  }

  function onPointerUp(evt) {
    if (!pointer.down && !patchDrag && !(asm && asm.drag)) return;
    const p = canvasPos(evt);
    const wasWorldDrag = pointer.dragging && !patchDrag && !(asm && asm.drag);
    const wasPatchDrag = !!patchDrag;
    const wasAsmDrag = !!(asm && asm.drag);

    if (wasAsmDrag && scene === "bench" && benchMode === "build") {
      const drag = asm.drag;
      asm.drag = null;
      pointer.down = false;
      pointer.dragging = false;
      let placed = tryPlaceAssemblePiece(drag, p.x, p.y);
      // ASA: 끝에 살짝 못 미치면 빈 끝으로 한 번 더 스냅
      if (!placed && isAsaFreeBuild() && asm.baseSide
        && (drag.kind === "angle" || drag.kind === "asaMystery")) {
        const snapEnd = nearestFreeAsaEnd(p.x, p.y, 120);
        if (snapEnd) {
          const pt = asm.baseSide[snapEnd];
          placed = tryPlaceAssemblePiece(drag, pt.x, pt.y);
        }
      }
      if (!placed && drag.kind === "mystery" && pointer.moved < DRAG_THRESH) {
        openAngleQuiz();
      } else if (!placed && pointer.moved < DRAG_THRESH && drag.kind !== "mystery" && !isFreeConstructBuild()) {
        tryPlaceAssemblePiece(drag, ...assembleSnapPoint(drag));
      } else if (!placed) {
        showFlash(
          isAsaFreeBuild() && asm && asm.baseSide
            ? "변의 양끝에 각을 놓으세요"
            : (isFreeConstructBuild() ? "끝점·반직선·작업 영역에 놓으세요" : "점선 자리에 더 가까이 놓으세요")
        );
      }
      refreshUI();
      return;
    }

    if (wasPatchDrag && scene === "tank" && tankMode === "install" && !dockAnim) {
      patchDrag = null;
      pointer.down = false;
      pointer.dragging = false;
      tryDropPatchOnHole();
      return;
    }

    pointer.down = false;
    pointer.dragging = false;
    patchDrag = null;

    if (wasWorldDrag) return;
    if (!running || phase === "idle" || phase === "result" || phase === "quiz" || phase === "gameover") return;

    if (scene === "bench" && benchMode === "pick") {
      const tool = hitBenchTool(p.x, p.y);
      if (tool) toggleBenchTool(tool);
      return;
    }

    if (scene === "bench" && benchMode === "build") {
      return;
    }

    if (scene === "tank" && tankMode === "measure") {
      const t = hitTestMeasure(p.x, p.y);
      tryMeasure(t);
      if (coarsePointerMq.matches) hover = null;
      return;
    }

    if (scene === "tank" && tankMode === "install") {
      return;
    }

    // World: free click-to-move
    if (scene === "world") {
      const worldX = p.x + cameraX;
      walkToX(worldX, () => tryEnterNearbyPoi());
    }
  }

  function assembleSnapPoint(drag) {
    if (isAAABuild() && drag.kind === "angle") {
      const full = assembleBoardPts();
      if (!asm.aaaSlot) asm.aaaSlot = [null, null, null];
      for (let v = 0; v < 3; v++) {
        if (asm.aaaSlot[v] == null) return [full[v].x, full[v].y];
      }
      return [full[0].x, full[0].y];
    }
    const full = assembleBoardPts();
    if (drag.kind === "side") {
      const a = full[drag.index];
      const b = full[(drag.index + 1) % 3];
      return [(a.x + b.x) / 2, (a.y + b.y) / 2];
    }
    const v = full[drag.index];
    return [v.x, v.y];
  }

  // ---------- Draw helpers ----------
  function coverImage(img) {
    if (!img) {
      ctx.fillStyle = "#0a1a24";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    const iw = img.width;
    const ih = img.height;
    const scale = Math.max(VIEW_W / iw, VIEW_H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (VIEW_W - dw) / 2, (VIEW_H - dh) / 2, dw, dh);
  }

  function drawRulerIcon(x, y, w, h, rot, dim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.globalAlpha = dim ? 0.25 : 1;
    if (art.ruler) {
      const dh = w * (art.ruler.height / art.ruler.width);
      ctx.drawImage(art.ruler, -w / 2, -dh / 2, w, dh);
    } else {
      ctx.fillStyle = "#d4a574";
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = dim ? 0.25 : 1;
    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("자", x, y + h / 2 + 18);
    ctx.restore();
  }

  function drawProtractorIcon(x, y, size, dim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = dim ? 0.25 : 1;
    if (art.protractor) {
      const dh = size * (art.protractor.height / art.protractor.width);
      ctx.drawImage(art.protractor, -size / 2, -dh / 2, size, dh);
    } else {
      ctx.beginPath();
      ctx.arc(0, 8, size / 2, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(61, 232, 255, 0.35)";
      ctx.strokeStyle = "#3de8ff";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("각도기", 0, size / 2 + 18);
    ctx.restore();
  }

  function drawWorld() {
    if (art.bg) {
      const iw = art.bg.width;
      const ih = art.bg.height;
      const srcX = (cameraX / WORLD_W) * iw;
      const srcW = (VIEW_W / WORLD_W) * iw;
      const scaleY = VIEW_H / ih;
      const dh = VIEW_H;
      ctx.drawImage(art.bg, srcX, 0, srcW, ih, 0, 0, VIEW_W, dh);
      ctx.fillStyle = "rgba(4, 12, 20, 0.22)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle = "#0a1a24";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    for (const z of ZONES) {
      const sx = z.x - cameraX;
      if (sx < -100 || sx > VIEW_W + 100) continue;
      const actionable =
        (z.id === "bench" && (phase === "need_tools" || phase === "go_build"))
        || (typeof z.tank === "number" && z.tank === tankIndex
          && (phase === "go_measure" || phase === "go_install") && !tanksFixed[z.tank]);
      if (typeof z.tank === "number" && tanksFixed[z.tank] && art.repaired) {
        // Same footprint the cracked tanks were composed with in level-bg.png.
        const tw = TANK_DRAW_W;
        const th = tw * (art.repaired.height / art.repaired.width);
        ctx.drawImage(art.repaired, sx - tw / 2, TANK_BASE_Y - th, tw, th);
      }
      ctx.save();
      ctx.globalAlpha = actionable ? 0.95 : 0.55;
      ctx.fillStyle = actionable ? "rgba(255, 213, 106, 0.22)" : "rgba(61, 232, 255, 0.08)";
      ctx.strokeStyle = actionable ? "#ffd56a" : "rgba(61, 232, 255, 0.3)";
      ctx.lineWidth = actionable ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(sx - z.w / 2, GROUND_Y - 8, z.w, 14, 6);
      ctx.fill();
      ctx.stroke();

      const hint = actionable;
      ctx.font = "800 15px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelW = Math.max(78, ctx.measureText(z.label).width + 24);
      const pillH = hint ? 42 : 28;
      ctx.fillStyle = "rgba(4, 14, 24, 0.82)";
      ctx.strokeStyle = actionable ? "rgba(255, 213, 106, 0.75)" : "rgba(61, 232, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sx - labelW / 2, ZONE_LABEL_Y - pillH / 2, labelW, pillH, 13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = actionable ? "#ffd56a" : "#e8f4ff";
      ctx.fillText(z.label, sx, hint ? ZONE_LABEL_Y - 8 : ZONE_LABEL_Y);
      if (hint) {
        ctx.font = "600 11px Outfit, sans-serif";
        ctx.fillStyle = "#e8f4ff";
        ctx.fillText("도착하면 입장", sx, ZONE_LABEL_Y + 10);
      }
      ctx.restore();
    }

    // cat
    const sx = cat.x - cameraX;
    const walkFrames = cat.carry === "triangle" ? art.triangleWalk
      : cat.carry === "tools" ? art.toolsWalk
        : art.walk;
    let img = null;
    if (cat.walking) {
      img = (walkFrames && walkFrames[cat.frame]) || art.walk[cat.frame] || art.idle;
    } else if (cat.carry === "triangle") {
      img = art.triangle || (art.triangleWalk && art.triangleWalk[CAT_STAND_FRAME]) || art.idle;
    } else if (cat.carry === "tools") {
      img = art.tools || (art.toolsWalk && art.toolsWalk[CAT_STAND_FRAME]) || art.idle;
    } else {
      img = art.idle || (art.walk && art.walk[CAT_STAND_FRAME]);
    }
    const bobY = cat.walking || Math.abs(cat.bob) > 0.2 ? cat.bob : 0;
    ctx.save();
    ctx.translate(sx, GROUND_Y + bobY);
    ctx.scale(cat.facing, 1);
    if (img) ctx.drawImage(img, -CAT_SPRITE / 2, -CAT_BASELINE, CAT_SPRITE, CAT_SPRITE);
    else {
      ctx.fillStyle = "#f4a460";
      ctx.beginPath();
      ctx.ellipse(0, -40, 36, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // hint: drag (keyboard — hide on touch phones)
    const touchUi = window.matchMedia("(pointer: coarse)").matches;
    if (!touchUi) {
      ctx.fillStyle = "rgba(143, 180, 212, 0.55)";
      ctx.font = "600 11px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("← → / A D 이동  ·  탭: 이동  ·  드래그: 화면", 14, TOP_CLEAR_Y);
    }
  }

  /** Signed interior sweep from edge dir a0 → a1 that faces focus (radians). */
  function interiorAngleDelta(a0, a1, p, focus) {
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const mid = a0 + delta / 2;
    const tx = p.x + Math.cos(mid) * 24;
    const ty = p.y + Math.sin(mid) * 24;
    if (Math.hypot(tx - focus.x, ty - focus.y) > Math.hypot(p.x - focus.x, p.y - focus.y)) {
      delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
    }
    return delta;
  }

  /** Draw a true-degree sector. a0 = start ray, delta = signed sweep (canvas radians). */
  function drawAngleSector(cx, cy, a0, delta, opts = {}) {
    const r = opts.r != null ? opts.r : 32;
    const rayExtra = opts.rayExtra != null ? opts.rayExtra : 10;
    const fill = opts.fill != null ? opts.fill : "rgba(255, 213, 106, 0.32)";
    const stroke = opts.stroke || "#ffd56a";
    const lineWidth = opts.lineWidth != null ? opts.lineWidth : 2.5;
    const g = opts.ctx || ctx;
    const end = a0 + delta;
    const anticlockwise = delta < 0;

    g.save();
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, a0, end, anticlockwise);
    g.closePath();
    if (fill !== "none") {
      g.fillStyle = fill;
      g.fill();
    }
    g.beginPath();
    g.arc(cx, cy, r, a0, end, anticlockwise);
    g.strokeStyle = stroke;
    g.lineWidth = lineWidth;
    g.stroke();

    if (!opts.skipRays) {
      g.strokeStyle = opts.rayStroke || stroke;
      g.lineWidth = opts.rayWidth != null ? opts.rayWidth : Math.max(2, lineWidth - 0.5);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * (r + rayExtra), cy + Math.sin(a0) * (r + rayExtra));
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(end) * (r + rayExtra), cy + Math.sin(end) * (r + rayExtra));
      g.stroke();
    }

    if (opts.innerTick) {
      g.beginPath();
      g.arc(cx, cy, Math.min(16, r * 0.45), a0, end, anticlockwise);
      g.strokeStyle = opts.tickStroke || "rgba(255, 213, 106, 0.95)";
      g.lineWidth = 2;
      g.stroke();
    }

    if (opts.label != null) {
      const mid = a0 + delta / 2;
      const labelR = opts.labelR != null ? opts.labelR : r + 18;
      g.fillStyle = opts.labelColor || stroke;
      g.font = opts.labelFont || "800 14px Oxanium, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(opts.label), cx + Math.cos(mid) * labelR, cy + Math.sin(mid) * labelR);
    }
    g.restore();
  }

  function drawAngleMark(pts, i, text, hot, pulse = 0) {
    const p = pts[i];
    const prev = pts[(i + 2) % 3];
    const next = pts[(i + 1) % 3];
    const a0 = Math.atan2(prev.y - p.y, prev.x - p.x);
    const a1 = Math.atan2(next.y - p.y, next.x - p.x);
    const delta = interiorAngleDelta(a0, a1, p, centroid(pts));
    const glow = hot ? 1 : pulse;
    const r = 30 + 8 * glow;
    drawAngleSector(p.x, p.y, a0, delta, {
      r,
      fill: `rgba(255, 213, 106, ${0.22 + 0.18 * glow})`,
      lineWidth: 2.5 + glow,
      rayStroke: glow >= 1 ? "#ffe9a8" : `rgba(255, 213, 106, ${0.85 + 0.15 * glow})`,
      label: text,
      labelR: r + 18
    });
  }

  /**
   * Tray / drag angle piece. Horizontal baseline + upper ray at exactly `deg`
   * so 40° / 50° / 90° read as clearly different openings.
   */
  function drawAngleWedgeIcon(x, y, deg, dim) {
    const d = Math.max(5, Math.min(170, Number(deg) || 0));
    const sweep = (d * Math.PI) / 180;
    const r = 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = dim ? 0.28 : 1;
    // Upper ray at -deg, baseline at 0; clockwise sweep = exact d°.
    drawAngleSector(0, 0, -sweep, sweep, {
      r,
      fill: "rgba(255, 213, 106, 0.3)",
      lineWidth: 2.5,
      rayExtra: 12,
      label: `${Math.round(d)}°`,
      labelR: r + 20,
      labelFont: "800 13px Oxanium, sans-serif"
    });
    ctx.restore();
  }

  /** Exact-degree angle mark at a point (bisector toward focus). */
  function drawExactAngleAt(p, deg, focus, text) {
    const d = Math.max(5, Math.min(170, Number(deg) || 0));
    const sweep = (d * Math.PI) / 180;
    const mid = Math.atan2(focus.y - p.y, focus.x - p.x);
    // Clockwise from mid-sweep/2 → mid+sweep/2 (bisector toward focus).
    drawAngleSector(p.x, p.y, mid - sweep / 2, sweep, {
      r: 36,
      fill: "rgba(255, 213, 106, 0.4)",
      lineWidth: 3.5,
      rayStroke: "#ffe9a8",
      rayWidth: 2,
      label: text,
      labelR: 54
    });
  }

  function drawGlassTriangle(pts, opts = {}) {
    const fill = opts.fill || "rgba(61, 232, 255, 0.28)";
    const stroke = opts.stroke || "#3de8ff";
    const lineWidth = opts.lineWidth || 3;
    const dash = opts.dash || null;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();
    if (opts.fill !== "none") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  let leakBubbles = [];

  function resetLeakBubbles() {
    leakBubbles = [];
  }

  function burstWaterSpray(center, count = 48) {
    if (!center) return;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const spd = 140 + Math.random() * 260;
      const life = 0.35 + Math.random() * 0.85;
      leakBubbles.push({
        x: center.x + (Math.random() - 0.5) * 14,
        y: center.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        r: 2 + Math.random() * 7,
        life,
        max: life
      });
    }
  }

  function updateLeakBubbles(center, dt) {
    while (leakBubbles.length < 28) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 40 + Math.random() * 90;
      leakBubbles.push({
        x: center.x + (Math.random() - 0.5) * 18,
        y: center.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(ang) * spd * 0.35,
        vy: Math.sin(ang) * spd - 30,
        r: 2 + Math.random() * 5,
        life: 0.4 + Math.random() * 1.1,
        max: 0.4 + Math.random() * 1.1
      });
    }
    for (const b of leakBubbles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy -= 25 * dt;
      b.life -= dt;
    }
    leakBubbles = leakBubbles.filter((b) => b.life > 0);
  }

  function drawLeakBubbles() {
    for (const b of leakBubbles) {
      const a = Math.max(0, b.life / b.max);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.7 + 0.3 * a), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 230, 255, ${0.15 + 0.55 * a})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(220, 245, 255, ${0.25 + 0.4 * a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Cracked triangular breach with dark interior + leak spray */
  function drawHoleBreach(pts, opts = {}) {
    const c = centroid(pts);
    const sealed = !!opts.sealed;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();

    if (!sealed) {
      const g = ctx.createRadialGradient(c.x, c.y - 8, 4, c.x, c.y, 110);
      g.addColorStop(0, "rgba(4, 18, 36, 0.98)");
      g.addColorStop(0.45, "rgba(12, 55, 90, 0.88)");
      g.addColorStop(0.8, "rgba(40, 100, 140, 0.35)");
      g.addColorStop(1, "rgba(255, 90, 120, 0.15)");
      ctx.fillStyle = g;
      ctx.fill();

      // Inner shadow / depth rim
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.restore();

      // Crack spokes
      ctx.strokeStyle = "rgba(255, 150, 170, 0.55)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + 0.2;
        const len = 28 + (i % 3) * 12;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(ang) * len, c.y + Math.sin(ang) * len);
        ctx.stroke();
      }

      // Jagged rim
      ctx.strokeStyle = "rgba(255, 100, 130, 0.95)";
      ctx.lineWidth = 3.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.stroke();

      // Outer glow crack
      ctx.strokeStyle = "rgba(255, 180, 200, 0.35)";
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(93, 255, 176, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "#5dffb0";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    if (!sealed) drawLeakBubbles();
  }

  function drawBenchScene() {
    coverImage(art.workbench);
    ctx.fillStyle = "rgba(4, 12, 20, 0.45)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = "rgba(20, 40, 55, 0.55)";
    ctx.fillRect(40, 200, VIEW_W - 80, 230);
    ctx.strokeStyle = "rgba(61, 232, 255, 0.25)";
    ctx.strokeRect(40, 200, VIEW_W - 80, 230);

    if (benchMode === "pick") {
      benchTools.forEach((t) => {
        if (t.kind === "ruler") drawRulerIcon(t.x, t.y, t.w, t.h, t.rot, t.taken);
        else drawProtractorIcon(t.x, t.y, t.w, t.taken);
      });
      return;
    }

    if (benchMode === "build") {
      if (isAsaFreeBuild()) {
        drawTwoAngleAssemble();
        return;
      }
      if (isOneAngleBuild()) {
        drawOneAngleAssemble();
        return;
      }
      if (!plankDesign && !isAAABuild()) {
        plankDesign = hole.designPts.map((p) => ({ ...p }));
      }

      const full = assembleBoardPts();
      const done = isAssembleComplete();
      const si = primaryMeasuredSide();
      const asaMode = si >= 0 && measuredSides.filter(Boolean).length === 1 && !isSssBuild();

      // SSS / ASA / AAA: 완성 전엔 통째 유령 삼각형 없음 (AAA는 슬롯만)
      if (!isSssBuild() && !asaMode && !isAAABuild()) {
        drawGlassTriangle(full, {
          fill: "rgba(61, 232, 255, 0.05)",
          stroke: "rgba(143, 180, 212, 0.3)",
          dash: [4, 5],
          lineWidth: 2
        });
      }

      // Snap hints
      if (isSssBuild()) {
        // 미리 삼각형 틀 없음. 놓인 변의 끝점에만 이음 힌트.
        const placedN = asm.placedSides.filter(Boolean).length;
        if (placedN === 0) {
          ctx.fillStyle = "rgba(61, 232, 255, 0.05)";
          ctx.beginPath();
          ctx.ellipse(VIEW_W * 0.58, 320, 130, 78, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          for (let v = 0; v < 3; v++) {
            const sideA = v;
            const sideB = (v + 2) % 3;
            const jointUsed = asm.placedSides[sideA] || asm.placedSides[sideB];
            const jointOpen = (measuredSides[sideA] && !asm.placedSides[sideA])
              || (measuredSides[sideB] && !asm.placedSides[sideB]);
            if (!jointUsed || !jointOpen) continue;
            const p = full[v];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(61, 232, 255, 0.85)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      } else if (asaMode) {
        if (!asm.placedSides[si]) {
          const a = full[si];
          const b = full[(si + 1) % 3];
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = "rgba(61, 232, 255, 0.55)";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          for (const e of sideEnds(si)) {
            const need = (measuredAngles[e] && !asm.placedAngles[e])
              || (asmMysteryIndex === e && !asm.mysterySolved);
            if (!need) continue;
            const p = full[e];
            const mystery = asmMysteryIndex === e && !asm.mysterySolved;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
            ctx.strokeStyle = mystery ? "rgba(255, 107, 138, 0.9)" : "rgba(255, 213, 106, 0.65)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            if (mystery) {
              ctx.fillStyle = "#ff6b8a";
              ctx.font = "800 18px Oxanium, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("?", p.x, p.y);
            }
          }
        }
      } else if (isAAABuild()) {
        // 슬롯만 — 구멍 크기 점선 테두리 없음 (완성 후에도).
        if (!done) {
          if (!asm.aaaSlot) asm.aaaSlot = [null, null, null];
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
          for (let v = 0; v < 3; v++) {
            if (asm.aaaSlot[v] != null) continue;
            const p = full[v];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 213, 106, ${0.4 + 0.35 * pulse})`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      } else {
        for (let i = 0; i < 3; i++) {
          if (measuredSides[i] && !asm.placedSides[i]) {
            const a = full[i];
            const b = full[(i + 1) % 3];
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = "rgba(61, 232, 255, 0.45)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          if (measuredAngles[i] && !asm.placedAngles[i]) {
            const p = full[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 213, 106, 0.55)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Placed sides
      for (let i = 0; i < 3; i++) {
        if (!asm.placedSides[i]) continue;
        const a = full[i];
        const b = full[(i + 1) % 3];
        ctx.strokeStyle = "#3de8ff";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(61, 232, 255, 0.55)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e8f4ff";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3de8ff";
        ctx.font = "800 14px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(formatSideLen(i), (a.x + b.x) / 2, (a.y + b.y) / 2 - 10);
      }

      // Placed angles
      for (let i = 0; i < 3; i++) {
        if (!asm.placedAngles[i]) continue;
        if (isAAABuild() && asm.aaaSlot) {
          const slot = asm.aaaSlot.indexOf(i);
          if (slot < 0) continue;
          const label = `${hole.anglesDeg[i]}°`;
          if (done && asm.resultPts) {
            // resultPts has the placed angles at each slot — geometry matches label
            drawAngleMark(asm.resultPts, slot, label, true);
          } else {
            // Before close: hole corner ≠ placed piece — draw the piece's true angle
            drawExactAngleAt(full[slot], hole.anglesDeg[i], centroid(full), label);
          }
        } else {
          drawAngleMark(full, i, `${hole.anglesDeg[i]}°`, true);
        }
      }

      // ASA rays from both end angles → third vertex
      if (asaMode && asm.placedSides[si] && asaEndAnglesReady(si)) {
        const [e0, e1] = sideEnds(si);
        const apex = (si + 2) % 3;
        const p0 = full[e0];
        const p1 = full[e1];
        const tip = full[apex];
        asm.raysT = Math.min(1, (asm.raysT || 0) + 0.018);
        const t = asm.raysT;
        ctx.strokeStyle = "rgba(255, 213, 106, 0.85)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p0.x + (tip.x - p0.x) * t, p0.y + (tip.y - p0.y) * t);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + (tip.x - p1.x) * t, p1.y + (tip.y - p1.y) * t);
        ctx.stroke();
        if (t >= 1) {
          ctx.fillStyle = "rgba(255, 213, 106, 0.9)";
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (asaMode) {
        asm.raysT = 0;
      }

      if (done) {
        const raysOk = !asaMode || (asm.raysT || 0) >= 1 || !asaEndAnglesReady(si);
        if (isAAABuild() && asm.resultPts) {
          drawGlassTriangle(asm.resultPts, {
            fill: "rgba(93, 255, 176, 0.38)",
            stroke: "#5dffb0",
            lineWidth: 4
          });
        } else if (!isAAABuild() && (raysOk || isSssBuild() || !buildOk)) {
          drawGlassTriangle(full, {
            fill: "rgba(93, 255, 176, 0.38)",
            stroke: "#5dffb0",
            lineWidth: 4
          });
        }
      }

      // Tray
      asmTrayHits = [];
      let py = 252;
      ctx.fillStyle = "rgba(8, 20, 36, 0.45)";
      ctx.beginPath();
      ctx.roundRect(40, 160, 210, 310, 12);
      ctx.fill();
      ctx.fillStyle = "#8fb4d4";
      ctx.font = "700 12px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("잰 조각", 140, 178);

      for (let i = 0; i < 3; i++) {
        if (!measuredSides[i] || asm.placedSides[i]) continue;
        if (asm.drag && asm.drag.kind === "side" && asm.drag.index === i) continue;
        const len = Math.min(150, hole.sidesCm[i] * 16);
        const hit = { kind: "side", index: i, x: 140, y: py, w: len + 20, h: 36 };
        asmTrayHits.push(hit);
        drawTraySidePiece(hit.x, hit.y, hole.sidesCm[i], len, false);
        py += 52;
      }
      for (let i = 0; i < 3; i++) {
        if (!measuredAngles[i] || asm.placedAngles[i]) continue;
        // ASA: 맞은편 각은 보드에 안 붙임(계산용) — 양끝만
        if (asaMode && !sideEnds(si).includes(i)) continue;
        if (asm.drag && asm.drag.kind === "angle" && asm.drag.index === i) continue;
        const hit = { kind: "angle", index: i, x: 140, y: py, w: 100, h: 72 };
        asmTrayHits.push(hit);
        drawAngleWedgeIcon(hit.x, hit.y, hole.anglesDeg[i], false);
        py += 84;
      }
      if (asmMysteryIndex >= 0 && !asm.mysterySolved) {
        if (!(asm.drag && asm.drag.kind === "mystery")) {
          const hit = { kind: "mystery", index: asmMysteryIndex, x: 140, y: py, w: 100, h: 72 };
          asmTrayHits.push(hit);
          drawMysteryAngleIcon(hit.x, hit.y);
        }
      }

      if (asm.drag) {
        const d = asm.drag;
        if (d.kind === "side") {
          drawTraySidePiece(d.x, d.y, hole.sidesCm[d.index], Math.min(150, hole.sidesCm[d.index] * 16), true);
        } else if (d.kind === "angle") {
          drawAngleWedgeIcon(d.x, d.y, hole.anglesDeg[d.index], false);
        } else {
          drawMysteryAngleIcon(d.x, d.y);
        }
      }
    }
  }

  function drawTwoAngleAssemble() {
    if (!asm) resetAssembleState();

    if (asm.phase === "pick_first") {
      ctx.fillStyle = "rgba(61, 232, 255, 0.06)";
      ctx.beginPath();
      ctx.ellipse(ASM_CX, ASM_CY, 140, 85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // angle-first preview (before side)
    if (asm.angleAt && !asm.baseSide) {
      const hotRay = (asm.drag && asm.drag.kind === "side")
        ? nearestAngleRay(asm.drag.x, asm.drag.y)
        : -1;
      drawAngleRaysHighlighted(hotRay);
    }

    if (asm.baseSide) {
      const s = asm.baseSide;
      ctx.strokeStyle = "#3de8ff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(61, 232, 255, 0.5)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(s.p0.x, s.p0.y);
      ctx.lineTo(s.p1.x, s.p1.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8f4ff";
      ctx.beginPath();
      ctx.arc(s.p0.x, s.p0.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3de8ff";
      ctx.font = "800 14px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatSideLen(s.index), (s.p0.x + s.p1.x) / 2, (s.p0.y + s.p1.y) / 2 - 12);
    }

    const drawAsaEnd = (ea, endKey) => {
      if (!ea) return;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
      const rayLen = 160;
      // 열린 반직선만 (변 방향은 숨김)
      const needAng = !!(asm.drag && asm.drag.kind === "angle" && asm.baseSide
        && ((endKey === "p0" && !asm.endAngleP0) || (endKey === "p1" && !asm.endAngleP1)));
      ctx.save();
      ctx.strokeStyle = needAng
        ? `rgba(255, 213, 106, ${0.55 + 0.4 * pulse})`
        : "rgba(255, 213, 106, 0.85)";
      ctx.lineWidth = needAng ? 5 : 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ea.origin.x, ea.origin.y);
      ctx.lineTo(
        ea.origin.x + Math.cos(ea.dirOpen) * rayLen,
        ea.origin.y + Math.sin(ea.dirOpen) * rayLen
      );
      ctx.stroke();
      ctx.restore();
      // wedge — exact labeled degree between side and open ray
      {
        const want = (ea.deg * Math.PI) / 180;
        let delta = ea.dirOpen - ea.dirAlong;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (Math.abs(Math.abs(delta) - want) > 0.25) {
          delta = delta > 0 ? delta - Math.PI * 2 : delta + Math.PI * 2;
        }
        delta = delta < 0 ? -want : want;
        // Open ray already drawn — arc + label only.
        drawAngleSector(ea.origin.x, ea.origin.y, ea.dirAlong, delta, {
          r: 36,
          fill: "rgba(255, 213, 106, 0.28)",
          skipRays: true,
          label: `${ea.deg}°`,
          labelR: 54
        });
      }
    };

    drawAsaEnd(asm.endAngleP0, "p0");
    drawAsaEnd(asm.endAngleP1, "p1");

    // 교점 미리보기
    if (asm.endAngleP0 && asm.endAngleP1 && asm.phase === "building") {
      const preview = rayRayIntersection(
        asm.endAngleP0.origin, asm.endAngleP0.dirOpen,
        asm.endAngleP1.origin, asm.endAngleP1.dirOpen
      );
      if (preview) {
        ctx.strokeStyle = "rgba(93, 255, 176, 0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(asm.baseSide.p0.x, asm.baseSide.p0.y);
        ctx.lineTo(preview.x, preview.y);
        ctx.lineTo(asm.baseSide.p1.x, asm.baseSide.p1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#5dffb0";
        ctx.beginPath();
        ctx.arc(preview.x, preview.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 끝점 하이라이트 (각 / ? 붙이기)
    if (asm.baseSide && asm.phase === "building" && (!asm.endAngleP0 || !asm.endAngleP1)) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      const draggingAng = asm.drag && (asm.drag.kind === "angle" || asm.drag.kind === "asaMystery");
      const hotEnd = draggingAng
        ? nearestFreeAsaEnd(asm.drag.x, asm.drag.y)
        : null;
      for (const key of ["p0", "p1"]) {
        if (key === "p0" && asm.endAngleP0) continue;
        if (key === "p1" && asm.endAngleP1) continue;
        const p = asm.baseSide[key];
        const hot = hotEnd === key;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hot ? 20 : 15, 0, Math.PI * 2);
        ctx.strokeStyle = hot ? "#3de8ff" : `rgba(255, 213, 106, ${0.45 + 0.4 * pulse})`;
        ctx.lineWidth = hot ? 3.5 : 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (asm.phase === "done" && asm.resultPts) {
      drawGlassTriangle(asm.resultPts, {
        fill: "rgba(93, 255, 176, 0.35)",
        stroke: "#5dffb0",
        lineWidth: 4
      });
    }

    // tray
    asmTrayHits = [];
    let py = 252;
    ctx.fillStyle = "rgba(8, 20, 36, 0.45)";
    ctx.beginPath();
    ctx.roundRect(40, 160, 210, 310, 12);
    ctx.fill();
    ctx.fillStyle = "#8fb4d4";
    ctx.font = "700 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("잰 조각", 140, 178);

    for (const i of measuredSideList()) {
      if (asm.placedSides[i]) continue;
      if (asm.drag && asm.drag.kind === "side" && asm.drag.index === i) continue;
      const len = Math.min(150, hole.sidesCm[i] * 16);
      const hit = { kind: "side", index: i, x: 140, y: py, w: len + 20, h: 36 };
      asmTrayHits.push(hit);
      drawTraySidePiece(hit.x, hit.y, hole.sidesCm[i], len, false);
      py += 52;
    }
    // 측정한 각은 모두 표시
    for (const i of measuredAngleList()) {
      if (asm.placedAngles[i]) continue;
      if (asm.drag && asm.drag.kind === "angle" && asm.drag.index === i) continue;
      const hit = { kind: "angle", index: i, x: 140, y: py, w: 100, h: 72 };
      asmTrayHits.push(hit);
      drawAngleWedgeIcon(hit.x, hit.y, hole.anglesDeg[i], false);
      py += 84;
    }
    // 변의 끝인데 안 잰 각만 ?
    for (const i of twoAngleEndVertices()) {
      if (measuredAngles[i] || asm.placedAngles[i]) continue;
      if (asm.drag && asm.drag.kind === "asaMystery" && asm.drag.index === i) continue;
      const hit = { kind: "asaMystery", index: i, x: 140, y: py, w: 100, h: 72 };
      asmTrayHits.push(hit);
      drawMysteryAngleIcon(hit.x, hit.y);
      py += 84;
    }

    if (asm.drag) {
      const d = asm.drag;
      if (d.kind === "side") {
        drawTraySidePiece(d.x, d.y, hole.sidesCm[d.index], Math.min(150, hole.sidesCm[d.index] * 16), true);
      } else if (d.kind === "angle") {
        drawAngleWedgeIcon(d.x, d.y, hole.anglesDeg[d.index], false);
      } else if (d.kind === "asaMystery") {
        drawMysteryAngleIcon(d.x, d.y);
      }
    }
  }

  function drawOneAngleAssemble() {
    if (!asm) resetAssembleState();

    // soft drop zone only — no triangle frame
    if (asm.phase === "pick_first") {
      ctx.fillStyle = "rgba(61, 232, 255, 0.06)";
      ctx.beginPath();
      ctx.ellipse(ASM_CX, ASM_CY, 140, 85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // draw base side
    if (asm.baseSide) {
      const s = asm.baseSide;
      ctx.strokeStyle = "#3de8ff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(61, 232, 255, 0.5)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(s.p0.x, s.p0.y);
      ctx.lineTo(s.p1.x, s.p1.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8f4ff";
      ctx.beginPath();
      ctx.arc(s.p0.x, s.p0.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3de8ff";
      ctx.font = "800 14px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatSideLen(s.index), (s.p0.x + s.p1.x) / 2, (s.p0.y + s.p1.y) / 2 - 12);
    }

    // angle rays (+ drop hints: 첫 변 / 남은 반직선)
    if (asm.angleAt) {
      const hotRay = (asm.drag && asm.drag.kind === "side"
        && (!asm.baseSide || !asm.secondSide))
        ? nearestAngleRay(asm.drag.x, asm.drag.y)
        : -1;
      drawAngleRaysHighlighted(hotRay);
    }

    // 끝점 하이라이트
    // - 각 조각 드래그: 양 끝
    // - 각+변1 후 남은 변: 자유 끝만 (각 꼭짓점은 반직선과 겹침)
    // - 각 없을 때 둘째 변: 양 끝
    if (asm.baseSide && !asm.secondSide && asm.phase === "building" && asm.drag) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      const freeOnly = asm.drag.kind === "side" && !!asm.angleAt;
      const endKeys = freeOnly
        ? [freeBaseEndAwayFromAngle()].filter(Boolean)
        : ["p0", "p1"];
      const hotEnd = freeOnly
        ? nearestFreeBaseEnd(asm.drag.x, asm.drag.y)
        : nearestBaseEnd(asm.drag.x, asm.drag.y);
      for (const key of endKeys) {
        const p = asm.baseSide[key];
        const hot = hotEnd === key;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hot ? 20 : 15, 0, Math.PI * 2);
        ctx.strokeStyle = hot ? "#3de8ff" : `rgba(255, 213, 106, ${0.45 + 0.4 * pulse})`;
        ctx.lineWidth = hot ? 3.5 : 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (asm.baseSide && !asm.secondSide && asm.phase === "building") {
      const endKeys = asm.angleAt
        ? [freeBaseEndAwayFromAngle()].filter(Boolean)
        : ["p0", "p1"];
      for (const key of endKeys) {
        const p = asm.baseSide[key];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 213, 106, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (asm.secondSide) {
      const s = asm.secondSide;
      ctx.strokeStyle = "#3de8ff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.p0.x, s.p0.y);
      ctx.lineTo(s.p1.x, s.p1.y);
      ctx.stroke();
      ctx.fillStyle = "#3de8ff";
      ctx.font = "800 14px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatSideLen(s.index), (s.p0.x + s.p1.x) / 2, (s.p0.y + s.p1.y) / 2 - 12);
    }

    if (asm.phase === "done" && asm.resultPts) {
      drawGlassTriangle(asm.resultPts, {
        fill: "rgba(93, 255, 176, 0.35)",
        stroke: "#5dffb0",
        lineWidth: 4
      });
    }

    // tray
    asmTrayHits = [];
    let py = 252;
    ctx.fillStyle = "rgba(8, 20, 36, 0.45)";
    ctx.beginPath();
    ctx.roundRect(40, 160, 210, 310, 12);
    ctx.fill();
    ctx.fillStyle = "#8fb4d4";
    ctx.font = "700 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("잰 조각", 140, 178);

    const angIdx = measuredAngleIndex();
    const angleUsed = asm.placedAngles[angIdx];
    for (const i of measuredSideList()) {
      if (asm.placedSides[i]) continue;
      if (asm.drag && asm.drag.kind === "side" && asm.drag.index === i) continue;
      const len = Math.min(150, hole.sidesCm[i] * 16);
      const hit = { kind: "side", index: i, x: 140, y: py, w: len + 20, h: 36 };
      asmTrayHits.push(hit);
      drawTraySidePiece(hit.x, hit.y, hole.sidesCm[i], len, false);
      py += 52;
    }
    if (!angleUsed && !(asm.drag && asm.drag.kind === "angle")) {
      const hit = { kind: "angle", index: angIdx, x: 140, y: py, w: 100, h: 72 };
      asmTrayHits.push(hit);
      drawAngleWedgeIcon(hit.x, hit.y, hole.anglesDeg[angIdx], false);
    }

    if (asm.drag) {
      const d = asm.drag;
      if (d.kind === "side") {
        drawTraySidePiece(d.x, d.y, hole.sidesCm[d.index], Math.min(150, hole.sidesCm[d.index] * 16), true);
      } else {
        drawAngleWedgeIcon(d.x, d.y, hole.anglesDeg[d.index], false);
      }
    }
  }

  function drawTraySidePiece(x, y, cm, len, hot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = hot ? "rgba(61, 232, 255, 0.55)" : "rgba(61, 232, 255, 0.4)";
    ctx.strokeStyle = "#3de8ff";
    ctx.lineWidth = hot ? 4 : 3;
    ctx.shadowColor = "rgba(61, 232, 255, 0.45)";
    ctx.shadowBlur = hot ? 12 : 0;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -9, len, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "700 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(cm), 0, 0);
    ctx.restore();
  }

  function drawMysteryAngleIcon(x, y) {
    const sweep = (55 * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, y);
    drawAngleSector(0, 0, -sweep, sweep, {
      r: 34,
      fill: "rgba(255, 107, 138, 0.28)",
      stroke: "#ff6b8a",
      lineWidth: 2.5,
      rayExtra: 12,
      label: "?",
      labelColor: "#ff6b8a",
      labelR: 54,
      labelFont: "800 20px Oxanium, sans-serif"
    });
    ctx.restore();
  }

  function hitAsmTray(sx, sy) {
    for (let i = asmTrayHits.length - 1; i >= 0; i--) {
      const h = asmTrayHits[i];
      if (Math.abs(sx - h.x) <= h.w / 2 && Math.abs(sy - h.y) <= h.h / 2) return h;
    }
    return null;
  }

  function tryPlaceTwoAnglePiece(drag, sx, sy) {
    if (!drag || !asm || asm.phase === "done" || asm.phase === "failed") return false;

    // 안 잰 끝각 ?
    if (drag.kind === "asaMystery") {
      if (asm.placedAngles[drag.index]) return false;
      if (!asm.baseSide) {
        showFlash("먼저 변을 가운데에 놓으세요");
        return false;
      }
      const end = nearestFreeAsaEnd(sx, sy);
      if (!end) {
        showFlash("변의 양 끝에 ? 각을 붙이세요");
        return false;
      }
      openAsaMysteryQuiz(end, drag.index);
      return true;
    }

    if (drag.kind === "angle") {
      if (asm.placedAngles[drag.index]) return false;
      if (!measuredAngles[drag.index]) {
        showFlash("안 잰 각은 ? 조각으로 붙이세요");
        return false;
      }
      // 각 먼저 — 잰 각이면 어느 것이든 가능
      if (asm.phase === "pick_first" || (!asm.baseSide && !asm.angleAt && !asm.endAngleP0 && !asm.endAngleP1)) {
        if (!workAreaHit(sx, sy)) {
          showFlash("가운데 작업 영역에 놓으세요");
          return false;
        }
        placeAngleFirst(drag.index, sx, sy);
        sound.snap();
        refreshUI();
        return true;
      }
      // 변의 양 끝에 각 — 어느 끝이든, 어느 각이든 붙음
      if (asm.baseSide) {
        const end = nearestFreeAsaEnd(sx, sy);
        if (!end) {
          showFlash("변의 양 끝에 각을 붙이세요");
          return false;
        }
        attachAsaEndAngle(end, drag.index);
        sound.snap();
        refreshUI();
        return true;
      }
      return false;
    }

    // side
    if (asm.placedSides[drag.index]) return false;
    const si = primaryMeasuredSide();
    if (drag.index !== si) {
      showFlash("잰 변을 놓으세요");
      return false;
    }

    if (asm.phase === "pick_first" || (!asm.baseSide && !asm.angleAt)) {
      if (!workAreaHit(sx, sy)) {
        showFlash("가운데 작업 영역에 놓으세요");
        return false;
      }
      placeBaseSide(drag.index, sx, sy);
      sound.snap();
      refreshUI();
      return true;
    }

    // 각 먼저: 반직선에 변
    if (asm.angleAt && !asm.baseSide) {
      const ray = nearestAngleRay(sx, sy);
      if (ray < 0) {
        showFlash("각의 팔(반직선) 위에 놓으세요");
        return false;
      }
      attachSideToAngleRay(drag.index, ray);
      bindAngleAtToBaseEnd();
      sound.snap();
      refreshUI();
      return true;
    }

    return false;
  }

  function tryPlaceOneAnglePiece(drag, sx, sy) {
    if (!drag || !asm || asm.phase === "done" || asm.phase === "failed") return false;

    if (drag.kind === "angle") {
      if (asm.placedAngles[drag.index]) return false;
      // angle first
      if (asm.phase === "pick_first" || (!asm.baseSide && !asm.angleAt)) {
        if (!workAreaHit(sx, sy)) {
          showFlash("가운데 작업 영역에 놓으세요");
          return false;
        }
        placeAngleFirst(drag.index, sx, sy);
        sound.snap();
        refreshUI();
        return true;
      }
      // attach to base end
      if (asm.baseSide && !asm.angleAt) {
        const end = nearestBaseEnd(sx, sy);
        if (!end) {
          showFlash("변의 왼쪽/오른쪽 끝에 붙이세요");
          return false;
        }
        attachAngleToBaseEnd(end);
        sound.snap();
        refreshUI();
        return true;
      }
      return false;
    }

    // side
    if (asm.placedSides[drag.index]) return false;

    if (asm.phase === "pick_first" || (!asm.baseSide && !asm.angleAt)) {
      if (!workAreaHit(sx, sy)) {
        showFlash("가운데 작업 영역에 놓으세요");
        return false;
      }
      placeBaseSide(drag.index, sx, sy);
      sound.snap();
      refreshUI();
      return true;
    }

    // 각 먼저: 첫 변은 반직선에
    if (asm.startKind === "angle" && asm.angleAt && !asm.baseSide) {
      const ray = nearestAngleRay(sx, sy);
      if (ray < 0) {
        showFlash("각의 팔(반직선) 위에 놓으세요");
        return false;
      }
      attachSideToAngleRay(drag.index, ray);
      refreshUI();
      return true;
    }

    // 남은 변: (각 있음) 자유 끝 ↔ 남은 반직선 / (각 없음) 양 끝 힌지
    if (asm.baseSide && !asm.secondSide) {
      if (asm.angleAt) {
        const end = nearestFreeBaseEnd(sx, sy);
        const ray = nearestAngleRay(sx, sy);
        let pick = null; // "end" | "ray"
        if (end && ray >= 0) {
          const ep = asm.baseSide[end];
          const dEnd = Math.hypot(sx - ep.x, sy - ep.y);
          const dRay = distToAngleRay(sx, sy, ray);
          pick = dEnd <= dRay ? "end" : "ray";
        } else if (end) {
          pick = "end";
        } else if (ray >= 0) {
          pick = "ray";
        } else {
          showFlash("변의 끝, 또는 남은 반직선 위에 놓으세요");
          return false;
        }
        if (pick === "ray") {
          attachSideToAngleRay(drag.index, ray);
          sound.snap();
          refreshUI();
          return true;
        }
        openHingeAngleQuiz(end, drag.index);
        return true;
      }
      const end = nearestBaseEnd(sx, sy);
      if (!end) {
        showFlash("변의 양 끝 중 하나에 붙이세요");
        return false;
      }
      openHingeAngleQuiz(end, drag.index);
      return true;
    }

    return false;
  }

  function tryPlaceAssemblePiece(drag, sx, sy) {
    if (!drag) return false;
    if (isAsaFreeBuild()) return tryPlaceTwoAnglePiece(drag, sx, sy);
    if (isOneAngleBuild()) return tryPlaceOneAnglePiece(drag, sx, sy);

    if (isAAABuild() && drag.kind === "angle") {
      if (asm.placedAngles[drag.index]) return false;
      if (!asm.aaaSlot) asm.aaaSlot = [null, null, null];
      const slot = nearestFreeAaaSlot(sx, sy);
      if (slot < 0) {
        showFlash("점선 꼭짓점에 각을 붙이세요");
        return false;
      }
      asm.aaaSlot[slot] = drag.index;
      asm.placedAngles[drag.index] = true;
      asm.phase = "building";
      syncAssembleTaps();
      sound.snap();
      if (isAssembleComplete()) {
        tryCloseAaa();
      }
      refreshUI();
      return true;
    }

    const full = assembleBoardPts();
    const si = primaryMeasuredSide();
    const asaMode = si >= 0 && measuredSides.filter(Boolean).length === 1 && !isSssBuild();

    if (drag.kind === "side") {
      const a = full[drag.index];
      const b = full[(drag.index + 1) % 3];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let ok = Math.hypot(sx - mid.x, sy - mid.y) < 58 || distToSegment(sx, sy, a, b) < 36;
      // SSS 첫 변: 틀 없이 작업 영역 어디에 놓아도 됨
      if (!ok && isSssBuild() && !asm.placedSides.some(Boolean)) {
        ok = sx > 300 && sx < 900 && sy > 170 && sy < 470;
      }
      // SSS 이후: 이미 놓인 변의 끝점 근처에 놓아도 됨
      if (!ok && isSssBuild()) {
        const ends = [a, b];
        ok = ends.some((p, ei) => {
          const v = ei === 0 ? drag.index : (drag.index + 1) % 3;
          const adj = [v, (v + 2) % 3];
          const linked = adj.some((s) => s !== drag.index && asm.placedSides[s]);
          return linked && Math.hypot(sx - p.x, sy - p.y) < 48;
        });
      }
      if (ok) {
        asm.placedSides[drag.index] = true;
        syncAssembleTaps();
        sound.snap();
        revealMysteryIfNeeded();
        if (isAssembleComplete()) {
          sound.success();
        }
        refreshUI();
        return true;
      }
      return false;
    }
    if (drag.kind === "mystery") {
      const p = full[drag.index];
      if (Math.hypot(sx - p.x, sy - p.y) < 52 || sx < 260) {
        openAngleQuiz();
        return true;
      }
      return false;
    }
    // angle
    if (asaMode && !asm.placedSides[si]) {
      showFlash("먼저 변을 놓으세요");
      return false;
    }
    if (asaMode && !sideEnds(si).includes(drag.index) && drag.index !== asmMysteryIndex) {
      showFlash("변의 양끝 각에 붙여 보세요");
      return false;
    }
    const p = full[drag.index];
    if (Math.hypot(sx - p.x, sy - p.y) < 52) {
      asm.placedAngles[drag.index] = true;
      syncAssembleTaps();
      sound.snap();
      if (asaMode && asaEndAnglesReady(si)) {
        asm.raysT = 0;
        sound.success();
      } else if (isAssembleComplete()) {
        sound.success();
      }
      refreshUI();
      return true;
    }
    return false;
  }

  function drawTankScene(dt) {
    coverImage(art.tank);
    ctx.fillStyle = "rgba(4, 12, 20, 0.42)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pts = holePtsInTankScene();
    if (!pts) return;
    const c = centroid(pts);
    const sealed = !!(dockAnim && (dockAnim.phase === "done" || (dockAnim.phase === "docking" && dockAnim.ok
      && (performance.now() - dockAnim.t0) / dockAnim.dur > 0.85)));

    if (!sealed) updateLeakBubbles(c, dt || 0.016);
    else leakBubbles = [];

    drawHoleBreach(pts, { sealed });

    if (tankMode === "measure") {
      const rem = toolsRemaining();
      const hintPulse = coarsePointerMq.matches
        ? 0.5 + 0.5 * Math.sin(performance.now() / 320)
        : 0;
      for (let i = 0; i < 3; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % 3];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (measuredSides[i]) {
          ctx.fillStyle = "#3de8ff";
          ctx.font = "800 14px Oxanium, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(formatSideLen(i), mid.x, mid.y - 8);
          ctx.strokeStyle = "rgba(61,232,255,0.7)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else if (rem.rulers > 0) {
          const hot = hover && hover.kind === "side" && hover.index === i;
          const glow = hot ? 1 : hintPulse;
          ctx.save();
          if (glow > 0 && !hot) {
            ctx.shadowColor = "rgba(255, 213, 106, 0.8)";
            ctx.shadowBlur = 6 + 10 * glow;
          }
          ctx.strokeStyle = glow >= 1
            ? "#ffd56a"
            : (glow > 0
              ? `rgba(255, 213, 106, ${0.45 + 0.5 * glow})`
              : "rgba(61,232,255,0.7)");
          ctx.lineWidth = 3 + 2 * glow;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      for (let i = 0; i < 3; i++) {
        if (measuredAngles[i]) {
          drawAngleMark(pts, i, `${hole.anglesDeg[i]}°`, false);
        } else if (rem.protractors > 0) {
          const hot = hover && hover.kind === "angle" && hover.index === i;
          drawAngleMark(pts, i, null, hot, hot ? 0 : hintPulse);
        }
      }
      return;
    }

    if (tankMode === "install" && plankDesign) {
      let patchPts;
      if (dockAnim && dockAnim.phase === "docking") {
        const raw = (performance.now() - dockAnim.t0) / dockAnim.dur;
        const t = easeOutCubic(Math.min(1, raw));
        patchPts = rigidLerpPts(dockAnim.from, dockAnim.to, t);
      } else if (dockAnim && (dockAnim.phase === "done" || dockAnim.phase === "hold")) {
        patchPts = dockAnim.to;
      } else if (dockAnim && dockAnim.phase === "slip") {
        const raw = (performance.now() - dockAnim.t0) / dockAnim.dur;
        const t = Math.min(1, raw);
        patchPts = slipPatchPts(t);
      } else {
        patchPts = freePatchPts();
      }

      if (patchPts) {
        drawGlassTriangle(patchPts, {
          fill: buildOk ? "rgba(93, 255, 176, 0.45)" : "rgba(255, 170, 80, 0.45)",
          stroke: patchDrag ? "#ffd56a" : (buildOk ? "#5dffb0" : "#ffb347"),
          lineWidth: patchDrag ? 5 : 4
        });
        for (let i = 0; i < 3; i++) {
          if (measuredAngles[i]) {
            if (isAAABuild() && aaaVertexMap) {
              const v = aaaVertexMap.indexOf(i);
              if (v >= 0) drawAngleMark(patchPts, v, `${hole.anglesDeg[i]}°`, false);
            } else {
              drawAngleMark(patchPts, i, `${hole.anglesDeg[i]}°`, false);
            }
          }
          if (measuredSides[i]) {
            if (isAAABuild() && aaaVertexMap) {
              // Side i of the hole lies between hole vertices i and i+1 → patch vertices
              const pa = aaaVertexMap.indexOf(i);
              const pb = aaaVertexMap.indexOf((i + 1) % 3);
              if (pa >= 0 && pb >= 0) {
                const a = patchPts[pa];
                const b = patchPts[pb];
                ctx.fillStyle = "#3de8ff";
                ctx.font = "800 13px Oxanium, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(formatSideLen(i), (a.x + b.x) / 2, (a.y + b.y) / 2 - 10);
              }
            } else {
              const a = patchPts[i];
              const b = patchPts[(i + 1) % 3];
              ctx.fillStyle = "#3de8ff";
              ctx.font = "800 13px Oxanium, sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(formatSideLen(i), (a.x + b.x) / 2, (a.y + b.y) / 2 - 10);
            }
          }
        }
      }
    }
  }

  function drawFlash() {
    syncFlashMissionVisibility();
    if (performance.now() > flashUntil || !flashMsg) return;
    ctx.save();
    ctx.font = "700 13px Outfit, sans-serif";
    ctx.textAlign = "center";
    const tw = Math.min(VIEW_W - 48, Math.max(180, ctx.measureText(flashMsg).width + 32));
    const boxY = BOTTOM_TIP_Y - 10;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - tw / 2, boxY, tw, 30, 10);
    ctx.fill();
    ctx.fillStyle = "#e8f4ff";
    ctx.fillText(flashMsg, VIEW_W / 2, BOTTOM_TIP_Y + 8);
    ctx.restore();
  }

  function draw(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    const simDt = portraitBlocked ? 0 : dt;
    if (running && !portraitBlocked && phase !== "result" && phase !== "quiz" && phase !== "gameover") {
      timeLeftMs -= simDt * 1000;
      if (timeLeftMs <= 0) {
        timeLeftMs = 0;
        running = false;
        scene = "world";
        playTimeoutThenGameOver();
      }
      updateHud();
    }
    updateCat(simDt);
    updateCamera(simDt);
    if (portraitBlocked) {
      if (dockAnim && dockAnim.t0 != null) dockAnim.t0 += dt * 1000;
    } else {
      updateDockAnim();
      updateSlipAnim();
    }

    if (scene === "world") drawWorld();
    else if (scene === "bench") drawBenchScene();
    else if (scene === "tank") drawTankScene(dt);
    drawFlash();
    requestAnimationFrame(draw);
  }

  // ---------- Firebase ----------
  function isThreeChancesEntry(v) {
    const id = String((v && v.gameId) || "").trim();
    return id === GAME_ID || id === "three_chances";
  }

  function isDormsEntry(v, key, isDormsSubtree) {
    const sid = String((v && v.studentId) || "").trim().toUpperCase();
    const ch = String((v && v.channel) || "").trim().toLowerCase();
    return !!(isDormsSubtree
      || sid === "DORMS" || sid === "DOREMS"
      || ch === "dorms" || ch === "dorems"
      || key === "dorms" || key === "dorems");
  }

  function matchesMode(v, key, isDormsSubtree) {
    return activeMode === "dorms" ? isDormsEntry(v, key, isDormsSubtree) : !isDormsEntry(v, key, isDormsSubtree);
  }

  function visitScoreRecords(data, onRecord) {
    const walk = (obj, isDormsSubtree = false) => {
      if (!obj || typeof obj !== "object") return;
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        if (item.name) {
          onRecord(key, item, isDormsSubtree || key === "dorms" || key === "dorems");
        } else {
          walk(item, isDormsSubtree || key === "dorms" || key === "dorems");
        }
      });
    };
    walk(data);
  }

  function renderLeaderboardSkeleton(tbody, rowCount = 5) {
    if (!tbody) return;
    const widths = activeMode === "dorms"
      ? ["w-xs", "w-md", "w-lg"]
      : ["w-xs", "w-md", "w-sm", "w-lg"];
    let html = "";
    for (let i = 0; i < rowCount; i++) {
      html += `<tr class="lb-skeleton-row" aria-hidden="true">${widths.map((w) =>
        `<td><span class="lb-skeleton-bar ${w}"></span></td>`
      ).join("")}</tr>`;
    }
    tbody.setAttribute("aria-busy", "true");
    tbody.innerHTML = html;
  }

  function showChampSkeleton() {
    if (openingChampName) {
      openingChampName.innerHTML = '<span class="lb-skeleton-bar w-md" aria-hidden="true"></span>';
    }
    if (openingChampId) {
      if (activeMode === "dorms") {
        openingChampId.style.display = "none";
      } else {
        openingChampId.style.display = "";
        openingChampId.innerHTML = '<span class="lb-skeleton-bar w-sm" aria-hidden="true"></span>';
      }
    }
    if (openingChampScore) {
      openingChampScore.innerHTML = '<span class="lb-skeleton-bar w-lg" aria-hidden="true"></span>';
    }
  }

  const SCORES_URL = "https://math-game-halogini-default-rtdb.firebaseio.com/scores.json";
  const DORMS_SCORES_URL = "https://math-game-halogini-default-rtdb.firebaseio.com/scores/dorms.json";

  function playerRecordKey(name, sid) {
    return activeMode === "dorms" ? name : `${name}_${sid}`;
  }

  function mergeScoreMaps(root, dorms) {
    const combined = {};
    if (root && typeof root === "object") Object.assign(combined, root);
    if (dorms && typeof dorms === "object") {
      combined.dorms = (combined.dorms && typeof combined.dorms === "object")
        ? Object.assign({}, combined.dorms, dorms)
        : dorms;
    }
    return combined;
  }

  async function fetchScoresMap() {
    if (firebaseDb) {
      try {
        const snapPromise = Promise.all([
          firebaseDb.ref(LB_PATH).once("value"),
          firebaseDb.ref(`${LB_PATH}/dorms`).once("value")
        ]);
        const [snapScores, snapDorms] = await Promise.race([
          snapPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("lb-timeout")), 2500))
        ]);
        return mergeScoreMaps(snapScores.val(), snapDorms.val());
      } catch (err) {
        console.warn("three-chances SDK leaderboard failed:", err);
      }
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const [resRoot, resDorms] = await Promise.all([
        fetch(SCORES_URL, { signal: controller.signal }),
        fetch(DORMS_SCORES_URL, { signal: controller.signal }).catch(() => null)
      ]);
      clearTimeout(timeoutId);
      if (!resRoot || !resRoot.ok) return null;
      const root = (await resRoot.json()) || {};
      const dorms = resDorms && resDorms.ok ? (await resDorms.json()) : null;
      return mergeScoreMaps(root, dorms);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("three-chances REST leaderboard failed:", err);
      return null;
    }
  }

  async function loadLeaderboard() {
    const gameoverTbody = document.getElementById("gameover-leaderboard-tbody");
    const colSpan = activeMode === "dorms" ? 3 : 4;
    const emptyHtml = `<tr><td colspan='${colSpan}'>아직 기록이 없습니다</td></tr>`;
    const failHtml = `<tr><td colspan='${colSpan}'>불러오기 실패</td></tr>`;
    showChampSkeleton();
    renderLeaderboardSkeleton(gameoverTbody);
    renderLeaderboardSkeleton(openingLeaderboardTbody);

    try {
      const data = await fetchScoresMap();
      if (data == null) {
        if (gameoverTbody) {
          gameoverTbody.removeAttribute("aria-busy");
          gameoverTbody.innerHTML = failHtml;
        }
        if (openingLeaderboardTbody) {
          openingLeaderboardTbody.removeAttribute("aria-busy");
          openingLeaderboardTbody.innerHTML = failHtml;
        }
        updateOpeningChamp(null);
        return;
      }
      const best = new Map();
      visitScoreRecords(data, (key, v, isDormsSubtree) => {
        if (!isThreeChancesEntry(v) || !matchesMode(v, key, isDormsSubtree) || v.clearTimeMs == null) return;
        const name = sanitizeInput(v.name || "", 12);
        const sid = sanitizeInput(v.studentId || "", 10);
        const mapKey = playerRecordKey(name, sid);
        const clearMs = Number(v.clearTimeMs);
        if (!Number.isFinite(clearMs) || clearMs <= 0) return;
        const prev = best.get(mapKey);
        if (!prev || clearMs < prev.clearTimeMs) {
          best.set(mapKey, { name, studentId: sid, clearTimeMs: clearMs });
        }
      });
      const top = Array.from(best.values())
        .sort((a, b) => {
          const d = clearTimeBucket(a.clearTimeMs) - clearTimeBucket(b.clearTimeMs);
          return d !== 0 ? d : a.clearTimeMs - b.clearTimeMs;
        })
        .slice(0, 20);

      updateOpeningChamp(top[0] || null);

      if (!top.length) {
        if (gameoverTbody) {
          gameoverTbody.removeAttribute("aria-busy");
          gameoverTbody.innerHTML = emptyHtml;
        }
        if (openingLeaderboardTbody) {
          openingLeaderboardTbody.removeAttribute("aria-busy");
          openingLeaderboardTbody.innerHTML = emptyHtml;
        }
        return;
      }
      const rowsHtml = withTimeRanks(top).map(({ item: r, rank, tied }) => {
        const idCell = activeMode === "dorms"
          ? ""
          : `<td>${escapeHtml(r.studentId || "-")}</td>`;
        const rankText = tied ? `공동 ${rank}` : String(rank);
        return `<tr><td>${rankText}</td><td>${escapeHtml(r.name || "")}</td>${idCell}<td>${formatClearTime(r.clearTimeMs)}</td></tr>`;
      }).join("");
      if (gameoverTbody) {
        gameoverTbody.removeAttribute("aria-busy");
        gameoverTbody.innerHTML = rowsHtml;
      }
      if (openingLeaderboardTbody) {
        openingLeaderboardTbody.removeAttribute("aria-busy");
        openingLeaderboardTbody.innerHTML = rowsHtml;
      }
    } catch (e) {
      if (gameoverTbody) {
        gameoverTbody.removeAttribute("aria-busy");
        gameoverTbody.innerHTML = failHtml;
      }
      if (openingLeaderboardTbody) {
        openingLeaderboardTbody.removeAttribute("aria-busy");
        openingLeaderboardTbody.innerHTML = failHtml;
      }
      updateOpeningChamp(null);
    }
  }

  function updateOpeningChamp(champ) {
    if (!openingChampName || !openingChampScore) return;
    if (!champ) {
      openingChampName.textContent = "아직 없음";
      if (openingChampId) {
        openingChampId.textContent = activeMode === "dorms" ? "dorms" : "학번: —";
        openingChampId.style.display = activeMode === "dorms" ? "none" : "";
      }
      openingChampScore.innerHTML = "—";
      return;
    }
    openingChampName.textContent = champ.name || "도전자";
    if (openingChampId) {
      if (activeMode === "dorms") {
        openingChampId.style.display = "none";
      } else {
        openingChampId.style.display = "";
        openingChampId.textContent = champ.studentId ? `학번: ${champ.studentId}` : "학번: 미입력";
      }
    }
    openingChampScore.innerHTML = `${formatClearTime(champ.clearTimeMs)}<small></small>`;
  }

  async function sendScore() {
    const msg = document.getElementById("api-status-msg");
    const btn = document.getElementById("btn-send-data");
    if (clearTimeMs == null) {
      msg.textContent = "다섯 수조를 모두 고쳐야 등록할 수 있어요.";
      return;
    }
    const cleanName = sanitizeInput(playerName || "", 12);
    if (!cleanName) {
      msg.textContent = "이름을 먼저 등록해 주세요.";
      return;
    }
    if (activeMode === "school") {
      const cleanId = sanitizeInput(studentId || "", 10);
      if (!cleanId) {
        msg.textContent = "학번을 먼저 등록해 주세요.";
        return;
      }
    }
    msg.textContent = "등록 중…";
    if (btn) btn.disabled = true;

    const payload = {
      name: cleanName,
      studentId: activeMode === "dorms" ? "DORMS" : sanitizeInput(studentId || "", 10),
      clearTimeMs: Number(clearTimeMs),
      // Higher is better for shared scores ordering; derived from faster clear times.
      score: Math.max(0, Math.min(500, Math.round(500 - Number(clearTimeMs) / 1000))),
      channel: activeMode === "dorms" ? "dorms" : "school",
      gameId: GAME_ID,
      timestamp: Date.now()
    };
    const myKey = playerRecordKey(payload.name, payload.studentId);
    const myLabel = formatClearTime(payload.clearTimeMs);

    const saveViaREST = async (existingKey) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = existingKey
        ? `https://math-game-halogini-default-rtdb.firebaseio.com/scores/${encodeURIComponent(existingKey)}.json`
        : SCORES_URL;
      try {
        const restRes = await fetch(url, {
          method: existingKey ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (restRes.ok) return true;
        const errText = await restRes.text().catch(() => "");
        console.error("three-chances REST score save failed:", restRes.status, errText);
        return false;
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("three-chances REST score save error:", err);
        return false;
      }
    };

    const saveRecord = async (existingKey) => {
      if (firebaseDb) {
        const sdkSave = (async () => {
          if (existingKey) await firebaseDb.ref(`${LB_PATH}/${existingKey}`).update(payload);
          else await firebaseDb.ref(LB_PATH).push(payload);
          return true;
        })();
        const timedOut = await Promise.race([
          sdkSave.then(() => false).catch((err) => {
            console.warn("three-chances SDK push failed:", err);
            return "fail";
          }),
          new Promise((resolve) => setTimeout(() => resolve("timeout"), 2500))
        ]);
        if (timedOut === false) return true;
        return saveViaREST(existingKey);
      }
      return saveViaREST(existingKey);
    };

    try {
      const data = await fetchScoresMap();
      let existingBest = null;
      let otherSameTime = false;
      if (data) {
        visitScoreRecords(data, (key, v, isDormsSubtree) => {
          if (!isThreeChancesEntry(v) || !matchesMode(v, key, isDormsSubtree) || v.clearTimeMs == null) return;
          const name = sanitizeInput(v.name || "", 12);
          const sid = sanitizeInput(v.studentId || "", 10);
          const clearMs = Number(v.clearTimeMs);
          if (!Number.isFinite(clearMs) || clearMs <= 0) return;
          if (playerRecordKey(name, sid) === myKey) {
            if (!existingBest || clearMs < existingBest.clearTimeMs) {
              existingBest = { key, clearTimeMs: clearMs };
            }
          } else if (formatClearTime(clearMs) === myLabel) {
            otherSameTime = true;
          }
        });
      }

      if (existingBest && payload.clearTimeMs >= existingBest.clearTimeMs) {
        const sameDisplay = formatClearTime(existingBest.clearTimeMs) === myLabel;
        msg.textContent = sameDisplay
          ? `이미 같은 클리어 시간(${myLabel})이 등록되어 있어요.`
          : `이미 더 빠른 기록(${formatClearTime(existingBest.clearTimeMs)})이 등록되어 있어요.`;
        loadLeaderboard();
        return;
      }

      const ok = await saveRecord(existingBest ? existingBest.key : null);
      if (ok) {
        if (existingBest) {
          msg.textContent = otherSameTime
            ? `기록이 ${myLabel}로 갱신되었습니다! 같은 시간은 공동 순위예요.`
            : `기록이 ${myLabel}로 갱신되었습니다!`;
        } else if (otherSameTime) {
          msg.textContent = `클리어 시간이 등록되었습니다! 같은 시간은 공동 순위예요.`;
        } else {
          msg.textContent = "클리어 시간이 등록되었습니다!";
        }
        loadLeaderboard();
      } else {
        msg.textContent = "등록 실패. 잠시 후 다시 시도하세요.";
      }
    } catch (e) {
      console.error("three-chances score submit failed:", e);
      msg.textContent = "등록 실패. 잠시 후 다시 시도하세요.";
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function playIntroThenStart() {
    pendingStartAfterIntro = true;
    // 인트로가 끝날 때까지 진행 중인 판을 멈춘다
    running = false;
    cat.arriveCb = null;
    stopCatWalk();
    updateHud();
    if (mobileFs) mobileFs.syncButton();
    introOverlay.classList.remove("hidden");
    introOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    try {
      introVideo.currentTime = 0;
      const p = introVideo.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  function finishIntro() {
    if (!pendingStartAfterIntro) return;
    restartGame();
  }

  // ---------- Events ----------
  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  // Match mouse: keep tracking if the finger slides off the canvas mid-gesture.
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
  window.addEventListener("touchcancel", onPointerUp);

  btnSceneAction.addEventListener("click", () => {
    sound.click();
    if (scene === "bench" && benchMode === "pick") confirmToolsAndExit();
    else if (scene === "bench" && benchMode === "build") {
      if (isAssembleComplete()) finishAssembleAndExit();
      else showFlash(isFreeConstructBuild() ? "조각을 드래그해 작도하세요" : "왼쪽 조각을 드래그해서 붙이세요");
    }
  });

  function drawMeasureRefCanvas() {
    if (!measureRefCanvas || !hole) return;
    const rctx = measureRefCanvas.getContext("2d");
    const W = measureRefCanvas.width;
    const H = measureRefCanvas.height;
    rctx.clearRect(0, 0, W, H);
    rctx.fillStyle = "#071828";
    rctx.fillRect(0, 0, W, H);
    const pts = mapPtsToCenter(hole.designPts, { x: W * 0.52, y: H * 0.52 }, 1.15);
    rctx.beginPath();
    rctx.moveTo(pts[0].x, pts[0].y);
    rctx.lineTo(pts[1].x, pts[1].y);
    rctx.lineTo(pts[2].x, pts[2].y);
    rctx.closePath();
    rctx.fillStyle = "rgba(12, 55, 90, 0.85)";
    rctx.fill();
    rctx.strokeStyle = "rgba(255, 100, 130, 0.9)";
    rctx.lineWidth = 3;
    rctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 3];
      if (measuredSides[i]) {
        rctx.strokeStyle = "#3de8ff";
        rctx.lineWidth = 4;
        rctx.beginPath();
        rctx.moveTo(a.x, a.y);
        rctx.lineTo(b.x, b.y);
        rctx.stroke();
        rctx.fillStyle = "#3de8ff";
        rctx.font = "800 14px Oxanium, sans-serif";
        rctx.textAlign = "center";
        rctx.fillText(formatSideLen(i), (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
      }
    }
    // angle marks — interior arcs matching hole geometry
    const focus = centroid(pts);
    for (let i = 0; i < 3; i++) {
      if (!measuredAngles[i]) continue;
      const p = pts[i];
      const prev = pts[(i + 2) % 3];
      const next = pts[(i + 1) % 3];
      const a0 = Math.atan2(prev.y - p.y, prev.x - p.x);
      const a1 = Math.atan2(next.y - p.y, next.x - p.x);
      const delta = interiorAngleDelta(a0, a1, p, focus);
      drawAngleSector(p.x, p.y, a0, delta, {
        ctx: rctx,
        r: 28,
        fill: "rgba(255, 213, 106, 0.3)",
        lineWidth: 2.5,
        label: `${hole.anglesDeg[i]}°`,
        labelR: 46,
        labelFont: "800 13px Oxanium, sans-serif"
      });
    }
    rctx.fillStyle = "#8fb4d4";
    rctx.font = "600 13px Outfit, sans-serif";
    rctx.textAlign = "center";
    rctx.fillText(`수조 ${tankIndex + 1} · 내가 잰 모습`, W / 2, 28);
    const sideBits = measuredSideList().map((i) => formatSideLen(i));
    const angBits = measuredAngleList().map((i) => `${hole.anglesDeg[i]}°`);
    const summary = [
      sideBits.length ? `변 ${sideBits.join(", ")}` : "",
      angBits.length ? `각 ${angBits.join(", ")}` : ""
    ].filter(Boolean).join(" · ");
    if (summary) {
      rctx.fillStyle = "rgba(143, 180, 212, 0.9)";
      rctx.font = "600 12px Outfit, sans-serif";
      rctx.fillText(summary, W / 2, H - 16);
    }
  }

  function openMeasureRef() {
    if (!hole || scene !== "bench" || benchMode !== "build") return;
    if (assembleFailModal && !assembleFailModal.classList.contains("hidden")) return;
    if (hingeAngleModal && !hingeAngleModal.classList.contains("hidden")) return;
    if (phase === "quiz") return;
    measureRefOverlay.classList.remove("hidden");
    measureRefOverlay.setAttribute("aria-hidden", "false");
    drawMeasureRefCanvas();
  }

  function closeMeasureRef() {
    measureRefOverlay.classList.add("hidden");
    measureRefOverlay.setAttribute("aria-hidden", "true");
  }

  if (btnMeasureRef) {
    btnMeasureRef.addEventListener("click", () => {
      sound.click();
      openMeasureRef();
    });
  }
  if (btnAssembleUndo) {
    btnAssembleUndo.addEventListener("click", () => {
      sound.click();
      undoAssembleStep();
    });
  }
  if (btnCloseMeasureRef) {
    btnCloseMeasureRef.addEventListener("click", () => {
      sound.click();
      closeMeasureRef();
    });
  }
  if (measureRefOverlay) {
    measureRefOverlay.addEventListener("click", (e) => {
      if (e.target === measureRefOverlay) {
        sound.click();
        closeMeasureRef();
      }
    });
  }

  if (btnHingeOk) {
    btnHingeOk.addEventListener("click", () => {
      sound.click();
      confirmHingeAngleInput();
    });
  }
  if (btnHingeCancel) {
    btnHingeCancel.addEventListener("click", () => {
      sound.click();
      closeHingeAngleModal(true);
    });
  }
  if (btnFailRemeasure) {
    btnFailRemeasure.addEventListener("click", () => {
      sound.click();
      failAssembleToRemeasure();
    });
  }
  if (btnFailRebuild) {
    btnFailRebuild.addEventListener("click", () => {
      sound.click();
      remakeTriangleOnly();
    });
  }
  if (hingeAngleModal) {
    hingeAngleModal.addEventListener("click", (e) => {
      if (e.target === hingeAngleModal) {
        sound.click();
        closeHingeAngleModal(true);
      }
    });
  }
  if (hingeAngleInput) {
    hingeAngleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmHingeAngleInput();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeHingeAngleModal(true);
      }
    });
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      keys.left = true;
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      keys.right = true;
      e.preventDefault();
    }
    if ((e.code === "Enter" || e.code === "Space") && scene === "world") {
      tryEnterNearbyPoi();
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    if (!keys.left && !keys.right && scene === "world") {
      cat.walking = false;
      cat.frame = 0;
      tryEnterNearbyPoi();
    }
  });

  btnNext.addEventListener("click", () => { sound.click(); advanceAfterResult(); });
  btnRestart.addEventListener("click", () => { sound.click(); restartGame(); });
  btnSend.addEventListener("click", () => { sound.click(); sendScore(); });
  btnSound.addEventListener("click", () => {
    sound.muted = !sound.muted;
    btnSound.textContent = sound.muted ? "🔇" : "🔊";
    btnSound.classList.toggle("muted", sound.muted);
  });
  btnEditProfile.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  });
  profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameField = document.getElementById("input-player-name");
    const errEl = document.getElementById("profile-err");
    const cleanName = sanitizeInput(nameField ? nameField.value : "");
    if (!cleanName) {
      if (errEl) errEl.textContent = "닉네임을 입력해야 시작할 수 있습니다.";
      if (nameField) nameField.focus();
      return;
    }
    if (errEl) errEl.textContent = "";
    playerName = cleanName;
    if (activeMode === "dorms") {
      studentId = "";
    } else {
      studentId = sanitizeInput(document.getElementById("input-student-id").value);
      localStorage.setItem("hm_student_id", studentId);
    }
    localStorage.setItem("hm_player_name", playerName);
    profileModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    updateHud();
    sound.init();
    tryLockLandscape();
    // 시작 버튼은 진행 중이어도 항상 처음부터 다시 시작
    closeAllOverlays();
    playIntroThenStart();
  });
  introVideo.addEventListener("ended", () => finishIntro());
  btnSkipIntro.addEventListener("click", () => { sound.click(); finishIntro(); });
  if (successVideo) {
    successVideo.addEventListener("ended", () => finishSuccessCutscene());
  }
  if (btnSkipSuccess) {
    btnSkipSuccess.addEventListener("click", () => {
      sound.click();
      finishSuccessCutscene();
    });
  }
  if (timeoutVideo) {
    timeoutVideo.addEventListener("ended", () => finishTimeoutCutscene());
  }
  if (btnSkipTimeout) {
    btnSkipTimeout.addEventListener("click", () => {
      sound.click();
      finishTimeoutCutscene();
    });
  }

  function applyDormsModeUi() {
    document.body.classList.toggle("mode-dorms", activeMode === "dorms");
    const lbTitle = document.getElementById("result-leaderboard-title");
    if (lbTitle) {
      lbTitle.textContent = activeMode === "dorms"
        ? "dorms 명예의 전당 (Top 20)"
        : "우리 학교 명예의 전당 (Top 20)";
    }
    if (thOpeningId) thOpeningId.style.display = activeMode === "dorms" ? "none" : "";
    if (activeMode !== "dorms") return;
    const labelId = document.getElementById("label-student-id");
    const inputId = document.getElementById("input-student-id");
    const idWrap = document.getElementById("result-locked-id-wrap");
    const thId = document.getElementById("th-leaderboard-id");
    const labelName = document.getElementById("label-player-name");
    const displayId = document.getElementById("display-profile-id");
    if (labelId) labelId.style.display = "none";
    if (inputId) {
      inputId.removeAttribute("required");
      inputId.disabled = true;
      inputId.value = "";
    }
    if (idWrap) idWrap.style.display = "none";
    if (thId) thId.style.display = "none";
    if (labelName) {
      const nameInput = labelName.querySelector("input");
      labelName.textContent = "";
      labelName.append("닉네임");
      if (nameInput) {
        nameInput.placeholder = "닉네임";
        nameInput.setAttribute("required", "");
        labelName.appendChild(document.createTextNode(" "));
        labelName.appendChild(nameInput);
      }
    }
    if (displayId) displayId.style.display = "none";
    studentId = "";
  }

  applyDormsModeUi();
  loadLeaderboard();

  if (btnToggleOpeningLeaderboard && openingLeaderboardBox) {
    btnToggleOpeningLeaderboard.addEventListener("click", () => {
      sound.click();
      const open = openingLeaderboardBox.classList.toggle("hidden") === false;
      btnToggleOpeningLeaderboard.textContent = open
        ? "🏆 명예의 전당 순위표 접기"
        : "🏆 명예의 전당 순위표 전체 보기";
    });
  }

  const savedName = localStorage.getItem("hm_player_name")
    || (activeMode === "dorms" ? localStorage.getItem("halomath_name_dorms") : "");
  const savedId = localStorage.getItem("hm_student_id");
  const nameInputEl = document.getElementById("input-player-name");
  if (nameInputEl) {
    if (activeMode === "dorms") nameInputEl.placeholder = "닉네임";
    if (savedName) {
      nameInputEl.value = savedName;
    } else if (activeMode === "dorms") {
      nameInputEl.value = randomDormsNickname();
    }
  }
  if (savedId && activeMode !== "dorms") {
    document.getElementById("input-student-id").value = savedId;
  }

  loadArt().then(() => {
    updateHud();
    renderBag();
    renderTankPips();
    setMission();
    requestAnimationFrame(draw);
  });
});
