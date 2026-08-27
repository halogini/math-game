/**
 * 원석을 깎아라! 감정 작전!
 * 깎기는 면(절단), 평행 잠금은 전단, 감정은 대각선 십자.
 */

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

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG)
  ? window.ENV.FIREBASE_CONFIG
  : defaultFirebaseConfig;

let firebaseDb = null;
// Shared production scores DB is not used. This prototype must not write
// into bingsoo/congruence/three-chances records.

function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>'"/]/g, "").trim().slice(0, maxLen);
}
function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 12;
}
function isValidStudentId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9가-힣\-]+$/.test(id.trim()) && id.trim().length <= 10;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

const V = {
  add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
  sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
  mul(a, s) { return { x: a.x * s, y: a.y * s }; },
  dot(a, b) { return a.x * b.x + a.y * b.y; },
  cross(a, b) { return a.x * b.y - a.y * b.x; },
  len(a) { return Math.hypot(a.x, a.y); },
  norm(a) {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  },
  rot90(a) { return { x: -a.y, y: a.x }; },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
  copy(a) { return { x: a.x, y: a.y }; },
  lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
};

function clonePoly(vs) { return vs.map(V.copy); }

function centroid(vs) {
  let x = 0, y = 0;
  vs.forEach((p) => { x += p.x; y += p.y; });
  return { x: x / vs.length, y: y / vs.length };
}

function area(vs) {
  let a = 0;
  for (let i = 0; i < vs.length; i++) {
    const p = vs[i], q = vs[(i + 1) % vs.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureCCW(vs) {
  const out = clonePoly(vs);
  if (area(out) < 0) out.reverse();
  return out;
}

function lineIntersect(p1, d1, p2, d2) {
  const den = V.cross(d1, d2);
  if (Math.abs(den) < 1e-8) return null;
  const t = V.cross(V.sub(p2, p1), d2) / den;
  return V.add(p1, V.mul(d1, t));
}

function isConvex(vs) {
  const n = vs.length;
  if (n < 3 || Math.abs(area(vs)) < 500) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const cr = V.cross(V.sub(vs[(i + 1) % n], vs[i]), V.sub(vs[(i + 2) % n], vs[(i + 1) % n]));
    if (Math.abs(cr) < 1e-4) continue;
    const s = cr > 0 ? 1 : -1;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function replaceEdge(vs, i, P, D) {
  const n = vs.length;
  const prev = vs[(i - 1 + n) % n];
  const a = vs[i];
  const b = vs[(i + 1) % n];
  const nxt = vs[(i + 2) % n];
  const newA = lineIntersect(prev, V.sub(a, prev), P, D);
  const newB = lineIntersect(b, V.sub(nxt, b), P, D);
  if (!newA || !newB) return null;
  if (![newA.x, newA.y, newB.x, newB.y].every(Number.isFinite)) return null;
  if (V.dist(newA, newB) < 18) return null;
  const out = clonePoly(vs);
  out[i] = newA;
  out[(i + 1) % n] = newB;
  return isConvex(out) ? out : null;
}

function edgeDir(vs, i) {
  return V.sub(vs[(i + 1) % vs.length], vs[i]);
}

function midpoint(vs, i) {
  return V.mul(V.add(vs[i], vs[(i + 1) % vs.length]), 0.5);
}

function inwardNormal(vs, i) {
  let n = V.rot90(edgeDir(vs, i));
  const mid = midpoint(vs, i);
  if (V.dot(n, V.sub(centroid(vs), mid)) < 0) n = V.mul(n, -1);
  return V.norm(n);
}

function distToSegment(p, a, b) {
  const ab = V.sub(b, a);
  const t = Math.max(0, Math.min(1, V.dot(V.sub(p, a), ab) / (V.dot(ab, ab) || 1)));
  return V.dist(p, V.add(a, V.mul(ab, t)));
}

function hitEdge(vs, p, tol) {
  let best = -1, bestD = tol;
  for (let i = 0; i < vs.length; i++) {
    const d = distToSegment(p, vs[i], vs[(i + 1) % vs.length]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function hitVertex(vs, p, tol) {
  let best = -1, bestD = tol;
  vs.forEach((v, i) => {
    const d = V.dist(p, v);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function interiorAngle(vs, i) {
  const n = vs.length;
  const prev = vs[(i - 1 + n) % n];
  const cur = vs[i];
  const next = vs[(i + 1) % n];
  const inVec = V.sub(cur, prev);
  const outVec = V.sub(next, cur);
  let ang = Math.atan2(V.cross(inVec, outVec), V.dot(inVec, outVec)) * 180 / Math.PI;
  if (ang < 0) ang += 360;
  return ang;
}

const PAR_EPS = 0.12;

function classify(vs) {
  if (!vs || vs.length !== 4) {
    return { pairCount: 0, pairs: [false, false], bisect: false, equalDiag: false, perpDiag: false, sideEqual: false, rightCount: 0, angles: [], sides: [] };
  }
  const n0 = V.norm(edgeDir(vs, 0));
  const n1 = V.norm(edgeDir(vs, 1));
  const n2 = V.norm(edgeDir(vs, 2));
  const n3 = V.norm(edgeDir(vs, 3));
  const pairs = [
    Math.abs(V.cross(n0, n2)) < PAR_EPS,
    Math.abs(V.cross(n1, n3)) < PAR_EPS
  ];
  const pairCount = (pairs[0] ? 1 : 0) + (pairs[1] ? 1 : 0);
  const A = vs[0], B = vs[1], C = vs[2], D = vs[3];
  const midAC = V.mul(V.add(A, C), 0.5);
  const midBD = V.mul(V.add(B, D), 0.5);
  const diagScale = (V.dist(A, C) + V.dist(B, D)) / 2 || 1;
  const bisect = V.dist(midAC, midBD) / diagScale < 0.055;
  const lenAC = V.dist(A, C);
  const lenBD = V.dist(B, D);
  const equalDiag = Math.abs(lenAC - lenBD) / diagScale < 0.07;
  const perpDiag = Math.abs(V.dot(V.norm(V.sub(C, A)), V.norm(V.sub(D, B)))) < 0.12;
  const sides = [0, 1, 2, 3].map((i) => V.len(edgeDir(vs, i)));
  const avg = (sides[0] + sides[1] + sides[2] + sides[3]) / 4 || 1;
  const sideEqual = (Math.max(...sides) - Math.min(...sides)) / avg < 0.08;
  const angles = [0, 1, 2, 3].map((i) => interiorAngle(vs, i));
  const rightCount = angles.filter((a) => Math.abs(a - 90) < 8).length;
  const parallelogram = pairCount === 2 || bisect;
  return {
    pairCount, pairs, bisect, equalDiag, perpDiag, sideEqual, rightCount, angles, sides,
    midAC, midBD, lenAC, lenBD, parallelogram,
    rectangle: parallelogram && (equalDiag || rightCount === 4),
    rhombus: parallelogram && (perpDiag || sideEqual),
    square: false
  };
}

function withSquareFlag(cls) {
  cls.square = !!(cls.rectangle && cls.rhombus);
  return cls;
}

function asParallelogram(vs) {
  const A = vs[0];
  const u = V.sub(vs[1], A);
  const v = V.sub(vs[3], A);
  return [V.copy(A), V.add(A, u), V.add(V.add(A, u), v), V.add(A, v)];
}

function uPerpToV(uLen, v) {
  const cw = { x: v.y, y: -v.x };
  return V.mul(V.norm(cw), uLen);
}

function rotate(v, rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function shearToPointer(vs, pointer) {
  const A = vs[0];
  const u0 = V.sub(vs[1], A);
  const v = V.sub(vs[3], A);
  const ru = V.len(u0) || 1;
  const dir = V.sub(pointer, A);
  if (V.len(dir) < 8) return clonePoly(vs);
  let u = V.mul(V.norm(dir), ru);
  if (V.cross(u, v) < 0) u = uPerpToV(ru, v);
  let deg = Math.atan2(V.cross(u, v), V.dot(u, v)) * 180 / Math.PI;
  if (deg < 22 || deg > 158) {
    const th = (deg < 22 ? 22 : 158) * Math.PI / 180;
    u = V.mul(V.norm(rotate(V.norm(v), -th)), ru);
  }
  deg = Math.abs(Math.atan2(V.cross(u, v), V.dot(u, v))) * 180 / Math.PI;
  if (Math.abs(deg - 90) < 8) u = uPerpToV(ru, v);
  const A2 = V.copy(A);
  return [A2, V.add(A2, u), V.add(V.add(A2, u), v), V.add(A2, v)];
}

function equalizeSides(vs) {
  const A = vs[0];
  let u = V.sub(vs[1], A);
  let v = V.sub(vs[3], A);
  const m = Math.min(V.len(u), V.len(v));
  u = V.mul(V.norm(u), m);
  v = V.mul(V.norm(v), m);
  return [V.copy(A), V.add(A, u), V.add(V.add(A, u), v), V.add(A, v)];
}

function fitToView(vs, W, H, pad = 70) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  vs.forEach((p) => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });
  const w = Math.max(40, maxX - minX);
  const h = Math.max(40, maxY - minY);
  const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return vs.map((p) => ({
    x: W / 2 + (p.x - cx) * s,
    y: H / 2 + (p.y - cy) * s
  }));
}

function parallelogramUV(angDeg, a, b) {
  const th = angDeg * Math.PI / 180;
  const u = { x: a, y: 0 };
  const v = { x: Math.cos(th) * b, y: Math.sin(th) * b };
  return [{ x: 0, y: 0 }, u, V.add(u, v), v];
}

const ROUNDS = [
  {
    title: "빛 터널을 열어라",
    mission: "원석을 캔 뒤, 마주 면을 골라 평행 깎기를 하세요. 한 줄, 그다음 다른 한 줄 — 두 쌍이 나란히면 십자 교차점이 가운데로 들어옵니다.",
    tools: ["parallel"],
    start: "irregular",
    target: "parallelogram"
  },
  {
    title: "평행의 힘",
    mission: "자물쇠가 걸린 돌을 각 밀기로 한 구석만 직각에 맞추세요. 직각 깎기로 한 면만 자르면 자물쇠가 풀리고, 그 각만 섭니다.",
    tools: ["parallel", "right", "shear"],
    start: "parallelogram",
    target: "rectangle"
  },
  {
    title: "십자가 + 자로",
    mission: "변 맞추기로 네 면 길이를 같게 하세요. 대각선이 수직이등분하면 마름모 감정이 나옵니다.",
    tools: ["parallel", "right", "shear", "equal"],
    start: "long-para",
    target: "rhombus"
  },
  {
    title: "만능 돌",
    mission: "평행을 지킨 채 직각으로 밀고, 변까지 맞추세요. 세 빛이 모두 켜지면 정사각형입니다.",
    tools: ["parallel", "right", "shear", "equal"],
    start: "parallelogram",
    target: "square"
  },
  {
    title: "원석부터 감정까지",
    mission: "제멋대로인 원석을 캐서, 평행 잠금과 각 밀기·변 맞추기로 정사각형 감정까지 가져가세요.",
    tools: ["parallel", "right", "shear", "equal"],
    start: "irregular2",
    target: "square"
  }
];

function makeStart(kind, W, H) {
  let vs;
  if (kind === "parallelogram") vs = parallelogramUV(58, 220, 150);
  else if (kind === "long-para") vs = parallelogramUV(62, 260, 120);
  else if (kind === "irregular2") {
    vs = [
      { x: 0, y: 10 },
      { x: 240, y: -40 },
      { x: 190, y: 155 },
      { x: -50, y: 175 }
    ];
  } else {
    vs = [
      { x: -10, y: 30 },
      { x: 210, y: -25 },
      { x: 175, y: 145 },
      { x: -35, y: 155 }
    ];
  }
  return fitToView(ensureCCW(vs), W, H);
}

function scoreFor(target, cls) {
  cls = withSquareFlag(cls);
  if (target === "parallelogram") {
    if (cls.parallelogram) return 100;
    if (cls.pairCount === 1) return 58;
    return 12;
  }
  if (target === "rectangle") {
    if (cls.square) return 100;
    if (cls.rectangle) return 100;
    if (cls.parallelogram) return 42;
    if (cls.rightCount >= 1 && cls.pairCount === 1) return 28;
    return 10;
  }
  if (target === "rhombus") {
    if (cls.square) return 100;
    if (cls.rhombus) return 100;
    if (cls.parallelogram) return 40;
    return 10;
  }
  if (cls.square) return 100;
  if (cls.rectangle || cls.rhombus) return 62;
  if (cls.parallelogram) return 36;
  if (cls.pairCount === 1) return 22;
  return 8;
}

function stampsFor(cls) {
  cls = withSquareFlag(cls);
  const list = [];
  if (cls.pairCount >= 1) list.push({ id: "trap", label: "사다리꼴" });
  if (cls.parallelogram) list.push({ id: "para", label: "평행사변형" });
  if (cls.rectangle) list.push({ id: "rect", label: "직사각형" });
  if (cls.rhombus) list.push({ id: "rhomb", label: "마름모" });
  if (cls.square) list.push({ id: "square", label: "정사각형" });
  return list;
}

function initGemCutGame() {
  function detectActiveMode() {
    try {
      const href = (window.location.href || "").toLowerCase();
      const search = (window.location.search || "").toLowerCase();
      if (search.includes("mode=dorms") || search.includes("mode=dorems") || href.includes("dorms")) {
        return "dorms";
      }
    } catch (e) { /* ignore */ }
    return "school";
  }

  const activeMode = detectActiveMode();
  const nameStorageKey = `halomath_name_${activeMode}`;
  const idStorageKey = `halomath_id_${activeMode}`;
  const highScoreStorageKey = `gemcut_highscore_${activeMode}`;
  const GAME_ID = "gem-cut";

  function safeGet(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  let playerName = sanitizeInput(safeGet(nameStorageKey, "도전자"), 12);
  let studentId = activeMode === "school" ? sanitizeInput(safeGet(idStorageKey, ""), 10) : "";
  let currentRound = 1;
  const maxRounds = 5;
  let totalScore = 0;
  let roundHistory = [];
  let highScore = parseInt(safeGet(highScoreStorageKey, "0"), 10) || 0;

  const canvas = document.getElementById("gem-canvas");
  const ctx = canvas.getContext("2d");
  const W = 900, H = 520;
  let dpr = 1;

  let stage = "mine";
  let verts = [];
  let startVerts = [];
  let undoStack = [];
  let mineHits = 0;
  let tool = "parallel";
  let hoverEdge = -1;
  let hoverVertex = -1;
  let drag = null;
  let preview = null;
  let appraiseT = 0;
  let appraiseRunning = false;
  let lastClassify = null;
  let roundScored = false;
  let cracks = [];
  let shearWasLocked = false;

  const missionBanner = document.getElementById("mission-banner");
  const toolbar = document.getElementById("toolbar");
  const stampRow = document.getElementById("stamp-row");
  const lockToast = document.getElementById("lock-toast");
  const flashToast = document.getElementById("flash-toast");
  const btnUndo = document.getElementById("btn-undo");
  const btnReset = document.getElementById("btn-reset");
  const btnAppraise = document.getElementById("btn-appraise");
  const btnNext = document.getElementById("btn-next-round");
  const roundDisplay = document.getElementById("round-display");
  const totalScoreDisplay = document.getElementById("total-score-display");
  const highScoreDisplay = document.getElementById("high-score-display");

  const playerModal = document.getElementById("player-modal");
  const playerForm = document.getElementById("player-form");
  const resultModal = document.getElementById("result-modal");

  const btnBack = document.getElementById("btn-back-portal");
  if (btnBack) btnBack.href = `../../index.html?mode=${activeMode}`;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - r.left) * (W / r.width),
      y: (src.clientY - r.top) * (H / r.height)
    };
  }

  function showFlash(msg) {
    flashToast.textContent = msg;
    flashToast.classList.remove("hidden");
    clearTimeout(showFlash._t);
    showFlash._t = setTimeout(() => flashToast.classList.add("hidden"), 2200);
  }

  function updateHud() {
    roundDisplay.textContent = `${currentRound} / ${maxRounds}`;
    totalScoreDisplay.innerHTML = `${totalScore} <small>점</small>`;
    highScoreDisplay.innerHTML = `${highScore} <small>점</small>`;
    document.getElementById("display-player-name").textContent = playerName || "도전자";
    const idEl = document.getElementById("display-student-id");
    if (activeMode === "dorms") {
      idEl.style.display = "none";
    } else {
      idEl.style.display = "";
      idEl.textContent = studentId ? `학번: ${studentId}` : "학번: 미입력";
    }
    document.querySelectorAll(".stage-chip").forEach((el) => {
      el.classList.toggle("active", el.dataset.stage === stage);
      const order = ["mine", "cut", "appraise"];
      el.classList.toggle("done", order.indexOf(el.dataset.stage) < order.indexOf(stage));
    });
    const spec = ROUNDS[currentRound - 1];
    const locked = verts.length === 4 && withSquareFlag(classify(verts)).parallelogram;
    lockToast.classList.toggle("hidden", !(stage === "cut" && locked));
    btnAppraise.disabled = stage !== "cut" || roundScored;
    btnUndo.disabled = stage !== "cut" || undoStack.length === 0;
    btnReset.disabled = stage === "appraise";
    btnNext.classList.toggle("hidden", !roundScored);
  }

  function renderTools() {
    const spec = ROUNDS[currentRound - 1];
    const locked = verts.length === 4 && classify(verts).parallelogram;
    const defs = [
      { id: "parallel", label: "평행 깎기" },
      { id: "right", label: "직각 깎기" },
      { id: "shear", label: "각 밀기" },
      { id: "equal", label: "변 맞추기" }
    ];
    toolbar.innerHTML = "";
    defs.forEach((d) => {
      if (!spec.tools.includes(d.id)) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tool-btn" + (tool === d.id ? " active" : "");
      b.textContent = d.label;
      const needLock = d.id === "shear" || d.id === "equal";
      b.disabled = stage !== "cut" || (needLock && !locked);
      b.addEventListener("click", () => {
        if (b.disabled) return;
        if (d.id === "equal") {
          applyEqualize();
          return;
        }
        tool = d.id;
        renderTools();
        draw();
      });
      toolbar.appendChild(b);
    });
  }

  function applyEqualize() {
    if (stage !== "cut" || !classify(verts).parallelogram) {
      showFlash("먼저 두 쌍을 나란히 깎아 자물쇠를 거세요.");
      return;
    }
    pushUndo();
    verts = fitToView(equalizeSides(asParallelogram(verts)), W, H);
    showFlash("네 면 길이를 맞췄습니다. 십자가 + 자로 서는지 감정해 보세요.");
    renderTools();
    updateHud();
    draw();
  }

  function pushUndo() {
    undoStack.push(clonePoly(verts));
    if (undoStack.length > 12) undoStack.shift();
  }

  function loadRound() {
    const spec = ROUNDS[currentRound - 1];
    startVerts = makeStart(spec.start, W, H);
    verts = clonePoly(startVerts);
    undoStack = [];
    mineHits = 0;
    stage = "mine";
    tool = spec.tools.includes("shear") && classify(verts).parallelogram
      ? "shear"
      : spec.tools[0];
    drag = null;
    preview = null;
    appraiseT = 0;
    appraiseRunning = false;
    lastClassify = null;
    roundScored = false;
    stampRow.classList.add("hidden");
    stampRow.innerHTML = "";
    cracks = [];
    const c = centroid(verts);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      cracks.push({
        x: c.x + (Math.random() - 0.5) * 30,
        y: c.y + (Math.random() - 0.5) * 20,
        dx: Math.cos(a) * (40 + Math.random() * 70),
        dy: Math.sin(a) * (40 + Math.random() * 70)
      });
    }
    missionBanner.textContent = `라운드 ${currentRound}. ${spec.title} — 광맥을 곡괭이로 세 번 두드리세요.`;
    renderTools();
    updateHud();
    draw();
  }

  function startCutStage() {
    stage = "cut";
    const spec = ROUNDS[currentRound - 1];
    missionBanner.textContent = spec.mission;
    renderTools();
    updateHud();
    draw();
  }

  function rockPoly() {
    const c = centroid(startVerts);
    return startVerts.map((p, i) => {
      const extra = 28 + (i % 2) * 10;
      const d = V.norm(V.sub(p, c));
      return V.add(p, V.mul(d, extra));
    });
  }

  function drawGem(vs, alpha, crystal) {
    if (vs.length < 3) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(vs[0].x, vs[0].y);
    vs.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    const g = ctx.createLinearGradient(vs[0].x, vs[0].y, vs[2] ? vs[2].x : vs[0].x, vs[2] ? vs[2].y : vs[0].y);
    if (crystal) {
      g.addColorStop(0, "#99f6e4");
      g.addColorStop(0.45, "#22d3ee");
      g.addColorStop(1, "#7c3aed");
    } else {
      g.addColorStop(0, "#475569");
      g.addColorStop(1, "#1e293b");
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = crystal ? "rgba(253, 230, 138, 0.85)" : "#94a3b8";
    ctx.lineWidth = crystal ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawParallelMarks(vs, cls) {
    if (vs.length !== 4) return;
    cls.pairs.forEach((on, pair) => {
      if (!on) return;
      const edges = pair === 0 ? [0, 2] : [1, 3];
      ctx.strokeStyle = "rgba(232, 195, 106, 0.9)";
      ctx.lineWidth = 2;
      edges.forEach((i) => {
        const mid = midpoint(vs, i);
        const n = inwardNormal(vs, i);
        const t = V.norm(edgeDir(vs, i));
        for (let k = -1; k <= 1; k += 2) {
          const p = V.add(mid, V.mul(t, k * 10));
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + n.x * 10, p.y + n.y * 10);
          ctx.stroke();
        }
      });
    });
  }

  function drawPreview() {
    if (!preview) return;
    const vs = preview.verts || verts;
    if (preview.line) {
      const { P, D } = preview.line;
      const dir = V.norm(D);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(P.x - dir.x * 800, P.y - dir.y * 800);
      ctx.lineTo(P.x + dir.x * 800, P.y + dir.y * 800);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (preview.verts) {
      ctx.globalAlpha = 0.35;
      drawGem(preview.verts, 1, true);
      ctx.globalAlpha = 1;
    }
  }

  function drawDiagonals(vs, cls, t) {
    if (vs.length !== 4) return;
    const A = vs[0], B = vs[1], C = vs[2], D = vs[3];
    const t1 = Math.min(1, t / 0.33);
    const t2 = Math.min(1, Math.max(0, (t - 0.33) / 0.33));
    const t3 = Math.min(1, Math.max(0, (t - 0.66) / 0.34));
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(A.x + (C.x - A.x) * t1, A.y + (C.y - A.y) * t1);
    ctx.stroke();
    if (t2 > 0) {
      ctx.beginPath();
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(B.x + (D.x - B.x) * t2, B.y + (D.y - B.y) * t2);
      ctx.stroke();
    }
    if (t3 > 0 && cls) {
      const ok1 = cls.bisect;
      const m = V.lerp(cls.midAC, cls.midBD, 0.5);
      ctx.fillStyle = ok1 ? "#5eead4" : "#f87171";
      ctx.beginPath();
      ctx.arc(cls.midAC.x, cls.midAC.y, 6, 0, Math.PI * 2);
      ctx.arc(cls.midBD.x, cls.midBD.y, 6, 0, Math.PI * 2);
      ctx.fill();
      if (ok1) {
        ctx.strokeStyle = "#5eead4";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = "700 13px Pretendard, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(ok1 ? "교차점이 가운데" : "교차점이 치우침", 24, H - 54);
      ctx.fillStyle = cls.equalDiag ? "#5eead4" : "#f87171";
      ctx.fillText(cls.equalDiag ? "두 줄 길이 같음" : "두 줄 길이 다름", 24, H - 34);
      ctx.fillStyle = cls.perpDiag ? "#5eead4" : "#f87171";
      ctx.fillText(cls.perpDiag ? "십자가 + 자로 섬" : "십자가 기울어짐", 24, H - 14);
    }
  }

  function drawAngles(vs) {
    if (tool !== "shear" || stage !== "cut") return;
    ctx.fillStyle = "#fde68a";
    ctx.font = "700 12px Outfit, sans-serif";
    vs.forEach((p, i) => {
      const ang = interiorAngle(vs, i);
      ctx.fillText(`${Math.round(ang)}°`, p.x + 8, p.y - 8);
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 40; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (stage === "mine") {
      drawGem(rockPoly(), 1, false);
      ctx.strokeStyle = "rgba(248, 250, 252, 0.45)";
      ctx.lineWidth = 2;
      cracks.slice(0, mineHits * 2).forEach((c) => {
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + c.dx, c.y + c.dy);
        ctx.stroke();
      });
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 18px Jua, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mineHits >= 3 ? "원석이 드러납니다" : `곡괭이 ${mineHits} / 3`, W / 2, 36);
      ctx.textAlign = "left";
      return;
    }

    const cls = verts.length === 4 ? withSquareFlag(classify(verts)) : null;
    drawGem(verts, 1, true);
    if (cls) drawParallelMarks(verts, cls);
    if (hoverEdge >= 0 && stage === "cut") {
      const a = verts[hoverEdge], b = verts[(hoverEdge + 1) % verts.length];
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    verts.forEach((p, i) => {
      ctx.beginPath();
      ctx.fillStyle = (i === hoverVertex && tool === "right") ? "#fde68a" : "#fff";
      ctx.arc(p.x, p.y, i === 1 && cls && cls.parallelogram && tool === "shear" ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (cls && cls.parallelogram && stage === "cut") {
      const h = verts[1];
      ctx.strokeStyle = "#e8c36a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawPreview();
    drawAngles(verts);
    if (stage === "appraise" && cls) drawDiagonals(verts, cls, appraiseT);
  }

  function tryParallelPreview(i, p) {
    const dir = edgeDir(verts, (i + 2) % 4);
    const n = inwardNormal(verts, i);
    const mid = midpoint(verts, i);
    const t = V.dot(V.sub(p, mid), n);
    const P = V.add(mid, V.mul(n, t));
    const next = replaceEdge(verts, i, P, dir);
    preview = { line: { P, D: dir }, verts: next };
    return next;
  }

  function tryRightPreview(i, p) {
    const n = verts.length;
    const prev = verts[(i - 1 + n) % n];
    const cur = verts[i];
    const prevDir = V.sub(cur, prev);
    const D = V.rot90(prevDir);
    const nrm = V.norm(V.rot90(D));
    const t = V.dot(V.sub(p, cur), nrm);
    const P = V.add(cur, V.mul(nrm, t));
    const next = replaceEdge(verts, i, P, D);
    preview = { line: { P, D }, verts: next };
    return next;
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const p = pointerPos(e);
    if (stage === "mine") {
      mineHits += 1;
      if (mineHits >= 3) startCutStage();
      else {
        updateHud();
        draw();
      }
      return;
    }
    if (stage !== "cut" || roundScored) return;
    const cls = classify(verts);

    if (tool === "shear" && cls.parallelogram) {
      const h = hitVertex(verts, p, 28);
      if (h === 1 || V.dist(p, verts[1]) < 36) {
        pushUndo();
        shearWasLocked = true;
        drag = { kind: "shear" };
        verts = asParallelogram(verts);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    if (tool === "right") {
      const v = hitVertex(verts, p, 22);
      if (v >= 0) {
        drag = { kind: "right", index: v };
        canvas.setPointerCapture(e.pointerId);
        tryRightPreview(v, p);
        draw();
        return;
      }
    }

    if (tool === "parallel" || tool === "right") {
      const edge = hitEdge(verts, p, 18);
      if (edge >= 0) {
        drag = { kind: tool, index: edge };
        canvas.setPointerCapture(e.pointerId);
        if (tool === "parallel") tryParallelPreview(edge, p);
        else tryRightPreview(edge, p);
        draw();
      }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointerPos(e);
    if (stage === "cut" && !drag) {
      hoverEdge = hitEdge(verts, p, 16);
      hoverVertex = hitVertex(verts, p, 16);
      draw();
    }
    if (!drag) return;
    if (drag.kind === "shear") {
      verts = shearToPointer(asParallelogram(verts), p);
      const cls = classify(verts);
      if (cls.rightCount === 4) showFlash("평행이 네 각을 결정했습니다.");
      draw();
      return;
    }
    if (drag.kind === "parallel") tryParallelPreview(drag.index, p);
    if (drag.kind === "right") tryRightPreview(drag.index, p);
    draw();
  });

  function commitDrag() {
    if (!drag) return;
    if (drag.kind === "shear") {
      const cls = classify(verts);
      if (shearWasLocked && !cls.parallelogram) showFlash("자물쇠가 풀렸습니다.");
      if (cls.rightCount === 4) showFlash("한 각을 밀었을 뿐인데 네 구석이 섰습니다.");
      verts = fitToView(verts, W, H);
      drag = null;
      preview = null;
      renderTools();
      updateHud();
      draw();
      return;
    }
    if (preview && preview.verts) {
      const wasPara = classify(verts).parallelogram;
      pushUndo();
      verts = fitToView(preview.verts, W, H);
      const now = classify(verts);
      if (wasPara && !now.parallelogram) showFlash("한 면만 깎아 자물쇠가 풀렸습니다. 그 각만 섰어요.");
      else if (now.pairCount === 1 && !wasPara) showFlash("빛 터널이 한 줄 열렸습니다.");
      else if (now.parallelogram) showFlash("두 줄이 열렸습니다. 평행 자물쇠가 걸렸습니다.");
    } else {
      showFlash("더 깎으면 돌이 부서집니다. 깊이를 조금 줄여 보세요.");
    }
    drag = null;
    preview = null;
    renderTools();
    updateHud();
    draw();
  }

  canvas.addEventListener("pointerup", commitDrag);
  canvas.addEventListener("pointercancel", () => { drag = null; preview = null; draw(); });

  btnUndo.addEventListener("click", () => {
    if (!undoStack.length || stage !== "cut") return;
    verts = undoStack.pop();
    renderTools();
    updateHud();
    draw();
  });

  btnReset.addEventListener("click", () => {
    if (stage === "appraise") return;
    verts = clonePoly(startVerts);
    undoStack = [];
    if (stage === "cut") showFlash("원석 모양으로 되돌렸습니다.");
    renderTools();
    updateHud();
    draw();
  });

  function finishAppraise() {
    appraiseRunning = false;
    appraiseT = 1;
    const spec = ROUNDS[currentRound - 1];
    lastClassify = withSquareFlag(classify(verts));
    const score = scoreFor(spec.target, lastClassify);
    if (!roundScored) {
      roundScored = true;
      totalScore += score;
      const stampLabels = stampsFor(lastClassify).map((s) => s.label).join(" · ") || "일반 사각형";
      roundHistory.push({ round: currentRound, score, stamps: stampLabels });
      stampRow.classList.remove("hidden");
      stampRow.innerHTML = `<span class="stamp-caption">세상이 찍은 도장</span>` + (stampsFor(lastClassify).map((s) =>
        `<span class="stamp on${s.id === "square" ? " square" : ""}">${s.label}</span>`
      ).join("") || `<span class="stamp">이름 도장 없음</span>`);
      const extra = lastClassify.square
        ? "세 빛이 모두 켜졌습니다. 그래서 정사각형입니다."
        : lastClassify.rectangle && !lastClassify.rhombus
          ? "이등분과 등장 — 직각을 넷 다 재지 않아도 직사각형입니다."
          : lastClassify.rhombus && !lastClassify.rectangle
            ? "이등분과 수직 — 마름모입니다."
            : lastClassify.parallelogram
              ? "교차점만 가운데. 평행사변형입니다."
              : lastClassify.pairCount === 1
                ? "빛은 한 줄. 사다리꼴입니다."
                : "아직 터널이 열리지 않았습니다.";
      missionBanner.textContent = `+${score}점. ${extra}`;
      if (score >= 90 && window.confetti) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
      }
    }
    updateHud();
    draw();
  }

  btnAppraise.addEventListener("click", () => {
    if (stage !== "cut" || roundScored) return;
    stage = "appraise";
    appraiseRunning = true;
    appraiseT = 0;
    lastClassify = withSquareFlag(classify(verts));
    missionBanner.textContent = "감정사가 돌 속 십자를 보고 있습니다…";
    renderTools();
    updateHud();
    const start = performance.now();
    function tick(now) {
      appraiseT = Math.min(1, (now - start) / 2400);
      draw();
      if (appraiseT < 1 && appraiseRunning) requestAnimationFrame(tick);
      else finishAppraise();
    }
    requestAnimationFrame(tick);
  });

  canvas.addEventListener("click", () => {
    if (stage === "appraise" && appraiseRunning) {
      appraiseRunning = false;
      finishAppraise();
    }
  });

  btnNext.addEventListener("click", () => {
    if (!roundScored) return;
    roundScored = false;
    if (currentRound >= maxRounds) {
      openResult();
      return;
    }
    currentRound += 1;
    loadRound();
  });

  function openResult() {
    if (totalScore > highScore) {
      highScore = totalScore;
      safeSet(highScoreStorageKey, String(highScore));
      document.getElementById("new-record-badge").classList.remove("hidden");
    } else {
      document.getElementById("new-record-badge").classList.add("hidden");
    }
    document.getElementById("final-total-score").innerHTML = `${totalScore} <small>/ 500</small>`;
    document.getElementById("result-locked-name").textContent = playerName;
    const idSpan = document.getElementById("result-locked-id-span");
    if (activeMode === "dorms") idSpan.style.display = "none";
    else {
      idSpan.style.display = "";
      document.getElementById("result-locked-id").textContent = studentId || "미입력";
    }
    document.getElementById("round-history-list").innerHTML = roundHistory.map((r) =>
      `<li>라운드 ${r.round}: +${r.score}점 — ${escapeHtml(r.stamps)}</li>`
    ).join("");
    resultModal.classList.remove("hidden");
    listenLeaderboard();
  }

  document.getElementById("btn-modal-restart").addEventListener("click", () => {
    resultModal.classList.add("hidden");
    currentRound = 1;
    totalScore = 0;
    roundHistory = [];
    loadRound();
  });

  function applyChannelOpening() {
    const label = document.getElementById("label-player-name");
    const group = document.getElementById("student-id-group");
    if (activeMode === "dorms") {
      label.textContent = "도전자 닉네임:";
      group.style.display = "none";
      document.getElementById("th-opening-id").style.display = "none";
      document.getElementById("th-result-id").style.display = "none";
    }
    document.getElementById("input-player-name").value = playerName || "도전자";
    document.getElementById("input-student-id").value = studentId;
  }

  playerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = sanitizeInput(document.getElementById("input-player-name").value, 12);
    if (!isValidName(name)) return;
    playerName = name;
    safeSet(nameStorageKey, playerName);
    if (activeMode === "school") {
      const id = sanitizeInput(document.getElementById("input-student-id").value, 10);
      if (!isValidStudentId(id)) {
        showFlash("학번을 확인해 주세요.");
        return;
      }
      studentId = id;
      safeSet(idStorageKey, studentId);
    }
    playerModal.classList.add("hidden");
    updateHud();
    loadRound();
  });

  document.getElementById("btn-toggle-opening-leaderboard").addEventListener("click", () => {
    document.getElementById("opening-leaderboard-box").classList.toggle("hidden");
  });

  function collectScores(dataObj) {
    const best = new Map();
    const visit = (obj, isDorms) => {
      if (!obj || typeof obj !== "object") return;
      Object.keys(obj).forEach((key) => {
        const item = obj[key];
        if (!item || typeof item !== "object") return;
        if (item.name) {
          if (String(item.gameId || "") !== GAME_ID) return;
          const dorms = isDorms || item.studentId === "DORMS" || item.channel === "dorms";
          if (activeMode === "dorms" ? !dorms : dorms) return;
          const name = sanitizeInput(item.name, 12);
          const sid = sanitizeInput(item.studentId || "", 10);
          const userKey = activeMode === "school" ? `${name}_${sid}` : name;
          const score = Math.max(0, Math.min(500, parseInt(item.score, 10) || 0));
          const prev = best.get(userKey);
          if (!prev || score > prev.score) best.set(userKey, { name, studentId: sid, score });
        } else visit(item, key === "dorms" || isDorms);
      });
    };
    visit(dataObj, false);
    return Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, 20);
  }

  function renderLb(tbody, list) {
    if (!tbody) return;
    tbody.innerHTML = "";
    const col = activeMode === "school" ? 4 : 3;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${col}" style="padding:12px;color:#94a3b8;">아직 기록이 없습니다.</td></tr>`;
      return;
    }
    list.forEach((item, i) => {
      const tr = document.createElement("tr");
      const idTd = activeMode === "school" ? `<td>${escapeHtml(item.studentId || "")}</td>` : "";
      tr.innerHTML = `<td>${i + 1}위</td><td>${escapeHtml(item.name)}</td>${idTd}<td><strong>${item.score}점</strong></td>`;
      tbody.appendChild(tr);
    });
  }

  async function listenLeaderboard() {
    let list = [];
    try {
      if (firebaseDb) {
        const snap = await firebaseDb.ref("scores").once("value");
        list = collectScores(snap.val());
      }
    } catch (e) { /* ignore */ }
    renderLb(document.getElementById("opening-leaderboard-tbody"), list);
    renderLb(document.getElementById("leaderboard-tbody"), list);
    if (list[0]) {
      document.getElementById("opening-champ-name").textContent = list[0].name;
      document.getElementById("opening-champ-id").textContent =
        activeMode === "school" ? `학번: ${list[0].studentId || "—"}` : "";
      document.getElementById("opening-champ-score").innerHTML = `${list[0].score}<small>점</small>`;
    }
  }

  document.getElementById("btn-send-data").addEventListener("click", async () => {
    const msg = document.getElementById("api-status-msg");
    const btn = document.getElementById("btn-send-data");
    if (!isValidName(playerName) || (activeMode === "school" && !isValidStudentId(studentId))) {
      msg.className = "api-status-msg error";
      msg.textContent = "참가자 정보가 올바르지 않습니다.";
      return;
    }
    const sum = roundHistory.reduce((a, r) => a + r.score, 0);
    if (roundHistory.length !== maxRounds || sum !== totalScore || totalScore < 0 || totalScore > 500) {
      msg.className = "api-status-msg error";
      msg.textContent = "점수 검증에 실패했습니다.";
      return;
    }
    btn.disabled = true;
    msg.className = "api-status-msg";
    msg.textContent = "등록 중...";
    const payload = {
      name: playerName.trim(),
      studentId: activeMode === "dorms" ? "DORMS" : studentId.trim(),
      score: Number(totalScore),
      channel: activeMode,
      gameId: GAME_ID,
      timestamp: (window.firebase && firebase.database && firebase.database.ServerValue)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now()
    };
    try {
      if (firebaseDb) {
        const snap = await firebaseDb.ref("scores").once("value");
        let existingKey = null, existingScore = -1;
        snap.forEach((child) => {
          const val = child.val();
          if (!val || val.gameId !== GAME_ID) return;
          if (String(val.name).trim() !== payload.name) return;
          const sid = String(val.studentId || "").trim();
          if (activeMode === "dorms") {
            if (sid === "DORMS" || val.channel === "dorms") {
              existingKey = child.key;
              existingScore = parseInt(val.score, 10) || 0;
            }
          } else if (sid === payload.studentId) {
            existingKey = child.key;
            existingScore = parseInt(val.score, 10) || 0;
          }
        });
        if (existingKey) {
          if (payload.score > existingScore) {
            await firebaseDb.ref(`scores/${existingKey}`).update(payload);
            msg.className = "api-status-msg success";
            msg.textContent = `최고 점수가 ${payload.score}점으로 갱신되었습니다.`;
          } else {
            msg.className = "api-status-msg success";
            msg.textContent = `기존 점수(${existingScore}점)가 더 높아 유지됩니다.`;
          }
        } else {
          await firebaseDb.ref("scores").push(payload);
          msg.className = "api-status-msg success";
          msg.textContent = `${payload.score}점이 등록되었습니다.`;
        }
        listenLeaderboard();
      } else {
        msg.className = "api-status-msg success";
        msg.textContent = "오프라인 모드 — 로컬에서만 기록됩니다.";
      }
    } catch (err) {
      msg.className = "api-status-msg error";
      msg.textContent = "등록 중 오류가 났습니다.";
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener("resize", resizeCanvas);
  applyChannelOpening();
  highScoreDisplay.innerHTML = `${highScore} <small>점</small>`;
  resizeCanvas();
  listenLeaderboard();
  updateHud();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGemCutGame);
} else {
  initGemCutGame();
}
