/**
 * Classroom live sessions (REST-first). Scores go to liveRooms/{code}, never scores/.
 * Host window (and lobby) uses anonymous auth. Students joining via QR do not.
 */
(function (global) {
  const ALPH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const TTL_MS = 24 * 60 * 60 * 1000;
  const LAST_ROOM_KEY = 'halomath_live_last_room';
  const REST_TIMEOUT_MS = 8000;
  const CODE_ATTEMPTS = 12;
  const MIN_QUALIFIED_PLAYERS = 3;

  let cachedHostToken = '';
  let cachedHostUid = '';

  function normalizeCode(raw) {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length < 4 || s.length > 6) return '';
    return s;
  }

  function detectRoomFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('live') !== '1') return '';
      return normalizeCode(p.get('room') || '');
    } catch (e) {
      return '';
    }
  }

  function randomCode() {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      out += ALPH[Math.floor(Math.random() * ALPH.length)];
    }
    return out;
  }

  function playerKey(name) {
    const key = String(name || '')
      .replace(/[.#$\[\]\/]/g, '_')
      .trim()
      .slice(0, 24);
    return key || 'player';
  }

  function isExpired(createdAt) {
    const t = Number(createdAt);
    if (!t) return true;
    return Date.now() - t > TTL_MS;
  }

  function isHostClosed(meta) {
    if (!meta || typeof meta !== 'object') return true;
    if (!Object.prototype.hasOwnProperty.call(meta, 'hostSeenAt')) return false;
    return Number(meta.hostSeenAt) === 0;
  }

  function normalizeGameId(gameId) {
    const id = String(gameId || 'bingsoo').trim().slice(0, 24);
    return id || 'bingsoo';
  }

  function lastRoomStorageKey(gameId) {
    const id = normalizeGameId(gameId);
    return id === 'bingsoo' ? LAST_ROOM_KEY : `${LAST_ROOM_KEY}_${id}`;
  }

  function compareNullableAsc(a, b) {
    if (a != null && b != null && a !== b) return a - b;
    if (a != null && b == null) return -1;
    if (a == null && b != null) return 1;
    return 0;
  }

  function parseOptionalPx(value) {
    if (value == null || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }

  function parseOptionalMs(value) {
    if (value == null || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function isBetterBingsoo2Record(candidate, previous) {
    if (!previous) return true;
    const cs = Number(candidate && candidate.score) || 0;
    const es = Number(previous && previous.score) || 0;
    if (cs !== es) return cs > es;
    const errCmp = compareNullableAsc(candidate && candidate.totalErrorPx, previous && previous.totalErrorPx);
    if (errCmp !== 0) return errCmp < 0;
    const timeCmp = compareNullableAsc(candidate && candidate.playTimeMs, previous && previous.playTimeMs);
    if (timeCmp !== 0) return timeCmp < 0;
    return (Number(candidate && candidate.timestamp) || 0) < (Number(previous && previous.timestamp) || 0);
  }

  function metaBody(createdAt, hostSeenAt, hostUid, gameId) {
    const payload = {
      gameId: normalizeGameId(gameId),
      createdAt: Number(createdAt) || Date.now()
    };
    if (hostSeenAt != null) payload.hostSeenAt = Number(hostSeenAt) || 0;
    if (hostUid) payload.hostUid = String(hostUid);
    return payload;
  }

  function saveLastRoom(code, gameId) {
    const key = lastRoomStorageKey(gameId);
    try {
      if (code) localStorage.setItem(key, code);
      else localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  function loadLastRoom(gameId) {
    try {
      return normalizeCode(localStorage.getItem(lastRoomStorageKey(gameId)) || '');
    } catch (e) {
      return '';
    }
  }

  function roomPath(code) {
    return `liveRooms/${code}`;
  }

  function restBase() {
    try {
      const cfg = (typeof global !== 'undefined' && global.ENV && global.ENV.FIREBASE_CONFIG)
        || (typeof window !== 'undefined' && window.ENV && window.ENV.FIREBASE_CONFIG)
        || {};
      return String(cfg.databaseURL || 'https://math-game-halogini-default-rtdb.firebaseio.com').replace(/\/$/, '');
    } catch (e) {
      return 'https://math-game-halogini-default-rtdb.firebaseio.com';
    }
  }

  function firebaseConfig() {
    return (global.ENV && global.ENV.FIREBASE_CONFIG)
      || (typeof window !== 'undefined' && window.ENV && window.ENV.FIREBASE_CONFIG)
      || {};
  }

  function initFirebaseApp() {
    if (typeof firebase === 'undefined' || !firebase.initializeApp) return null;
    if (firebase.apps && firebase.apps.length) return firebase.app();
    const cfg = firebaseConfig();
    if (!cfg.apiKey) return null;
    return firebase.initializeApp(cfg);
  }

  async function ensureHostAuth() {
    initFirebaseApp();
    if (typeof firebase === 'undefined' || !firebase.auth) {
      const err = new Error('HOST_AUTH_UNAVAILABLE');
      err.code = 'HOST_AUTH_UNAVAILABLE';
      throw err;
    }
    const auth = firebase.auth();
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (e) { /* ignore */ }
    if (!auth.currentUser) {
      try {
        await auth.signInAnonymously();
      } catch (e) {
        const err = new Error('HOST_AUTH_DISABLED');
        err.code = 'HOST_AUTH_DISABLED';
        err.cause = e;
        throw err;
      }
    }
    const user = auth.currentUser;
    cachedHostUid = user.uid;
    cachedHostToken = await user.getIdToken();
    return user;
  }

  async function refreshHostAuth() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) {
        return ensureHostAuth();
      }
      cachedHostUid = firebase.auth().currentUser.uid;
      cachedHostToken = await firebase.auth().currentUser.getIdToken();
      return firebase.auth().currentUser;
    } catch (e) {
      return ensureHostAuth();
    }
  }

  function withAuth(path, token) {
    const cleanPath = String(path || '').replace(/^\//, '');
    const url = `${restBase()}/${cleanPath}`;
    if (!token) return url;
    return `${url}${url.indexOf('?') >= 0 ? '&' : '?'}auth=${encodeURIComponent(token)}`;
  }

  function writeMetaKeepalive(code, createdAt, hostSeenAt, hostUid, token, gameId) {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const url = withAuth(`${roomPath(normalized)}/meta.json`, token || cachedHostToken);
    try {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaBody(createdAt, hostSeenAt, hostUid || cachedHostUid, gameId)),
        keepalive: true
      });
    } catch (e) { /* page is unloading */ }
  }

  function deleteRoomKeepalive(code, token) {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const url = withAuth(`${roomPath(normalized)}.json`, token || cachedHostToken);
    try {
      fetch(url, { method: 'DELETE', keepalive: true });
    } catch (e) { /* page is unloading */ }
  }

  function ownerHostUidSet() {
    try {
      const raw = (global.ENV && global.ENV.SESSION_OWNER_HOST_UIDS)
        || (typeof window !== 'undefined' && window.ENV && window.ENV.SESSION_OWNER_HOST_UIDS);
      if (!Array.isArray(raw)) return new Set();
      return new Set(raw.map((id) => String(id || '').trim()).filter(Boolean));
    } catch (e) {
      return new Set();
    }
  }

  function usageDayKey(nowMs) {
    const t = Number(nowMs) || Date.now();
    const kst = new Date(t + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function usageCounterKey(isOwner) {
    return isOwner ? 'ownerQualified' : 'externalQualified';
  }

  function dedupKeyForRoom(code, createdAt, fallbackAt) {
    const ca = Number(createdAt) || Number(fallbackAt) || 0;
    return `${normalizeCode(code)}_${ca}`.replace(/[.#$\[\]/]/g, '_');
  }

  function buildUsagePatchBody(isOwner, gameId, endedAt) {
    const counter = usageCounterKey(isOwner);
    const day = usageDayKey(endedAt);
    const gid = normalizeGameId(gameId);
    const inc = { '.sv': { increment: 1 } };
    return {
      totals: { [counter]: inc },
      byDay: { [day]: { [counter]: inc } },
      byGame: { [gid]: { [counter]: inc } }
    };
  }

  async function incrementSessionUsage(isOwner, gameId, endedAt, token) {
    await fetchRest('sessionUsage.json', {
      method: 'PATCH',
      body: JSON.stringify(buildUsagePatchBody(isOwner, gameId, endedAt)),
      authToken: token
    });
  }

  function recordSessionUsageKeepalive(code, hint, token) {
    hint = hint && typeof hint === 'object' ? hint : {};
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const playerCount = Number(hint.playerCount);
    if (!Number.isFinite(playerCount) || playerCount < MIN_QUALIFIED_PLAYERS) return;
    const hostUid = String(hint.hostUid || cachedHostUid || '');
    const gameId = normalizeGameId(hint.gameId);
    const endedAt = Date.now();
    const isOwner = ownerHostUidSet().has(hostUid);
    const dedupKey = dedupKeyForRoom(normalized, hint.createdAt, endedAt);
    const authToken = token || cachedHostToken;
    if (!authToken) return;
    const dedupUrl = withAuth(`sessionUsage/dedup/${dedupKey}.json`, authToken);
    const patchUrl = withAuth('sessionUsage.json', authToken);
    const patchBody = JSON.stringify(buildUsagePatchBody(isOwner, gameId, endedAt));
    try {
      fetch(dedupUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'true',
        keepalive: true
      }).then((res) => {
        if (!res.ok) return;
        fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: patchBody,
          keepalive: true
        });
      }).catch(() => { /* page is unloading */ });
    } catch (e) { /* page is unloading */ }
  }

  async function tryRecordSessionUsage(code, hint) {
    hint = hint && typeof hint === 'object' ? hint : {};
    const normalized = normalizeCode(code);
    if (!normalized) return false;

    let meta = null;
    let playerCount = Number(hint.playerCount);
    let gameId = hint.gameId;
    let hostUid = hint.hostUid;

    try {
      meta = await getMeta(normalized);
      if (!meta) return false;
      if (!Number.isFinite(playerCount) || playerCount < 0) {
        const players = await getPlayers(normalized);
        playerCount = collectLiveList(players).length;
      }
      gameId = gameId || meta.gameId;
      hostUid = hostUid || meta.hostUid;
    } catch (e) {
      console.warn('session usage meta fetch failed:', e);
      return false;
    }

    if (playerCount < MIN_QUALIFIED_PLAYERS) return false;

    const endedAt = Date.now();
    const dedupKey = dedupKeyForRoom(normalized, meta.createdAt, endedAt);
    const isOwner = ownerHostUidSet().has(String(hostUid || ''));
    const user = await ensureHostAuth();
    const token = await user.getIdToken();

    try {
      await fetchRest(`sessionUsage/dedup/${dedupKey}.json`, {
        method: 'PUT',
        body: JSON.stringify(true),
        authToken: token
      });
    } catch (e) {
      if (e && e.code === 'PERMISSION_DENIED') return false;
      console.warn('session usage dedup failed:', e);
      return false;
    }

    try {
      await incrementSessionUsage(isOwner, gameId, endedAt, token);
      return true;
    } catch (e) {
      console.warn('session usage increment failed:', e);
      return false;
    }
  }

  async function fetchRest(path, options, timeoutMs) {
    const ms = timeoutMs || REST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const token = options && options.authToken;
    try {
      const res = await fetch(withAuth(path, token), {
        method: options && options.method ? options.method : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options && options.body ? options.body : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(text || res.statusText);
        err.code = res.status === 401 || res.status === 403 ? 'PERMISSION_DENIED' : String(res.status);
        throw err;
      }
      if (!text || text === 'null') return null;
      return JSON.parse(text);
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  async function getMeta(code) {
    return fetchRest(`${roomPath(code)}/meta.json`);
  }

  async function getPlayers(code) {
    const data = await fetchRest(`${roomPath(code)}/players.json`);
    return data && typeof data === 'object' ? data : {};
  }

  async function createRoom(gameId) {
    const user = await ensureHostAuth();
    const token = await user.getIdToken();
    cachedHostToken = token;
    cachedHostUid = user.uid;
    const gid = normalizeGameId(gameId);
    for (let i = 0; i < CODE_ATTEMPTS; i += 1) {
      const code = randomCode();
      let existing = null;
      try {
        existing = await getMeta(code);
      } catch (e) {
        existing = null;
      }
      if (existing) continue;
      const now = Date.now();
      try {
        await fetchRest(`${roomPath(code)}/meta.json`, {
          method: 'PUT',
          body: JSON.stringify(metaBody(now, now, user.uid, gid)),
          authToken: token
        });
        return code;
      } catch (err) {
        if (err && err.code === 'PERMISSION_DENIED') continue;
        throw err;
      }
    }
    const err = new Error('NO_FREE_CODE');
    err.code = 'NO_FREE_CODE';
    throw err;
  }

  async function markHostOpen(code, createdAt, hostUid, gameId) {
    const user = await ensureHostAuth();
    const token = await user.getIdToken();
    cachedHostToken = token;
    cachedHostUid = user.uid;
    const meta = await getMeta(code);
    if (!meta) {
      const err = new Error('SESSION_ENDED');
      err.code = 'SESSION_ENDED';
      throw err;
    }
    const uid = String(hostUid || meta.hostUid || user.uid);
    const created = Number(createdAt || meta.createdAt) || Date.now();
    const gid = normalizeGameId(gameId || meta.gameId);
    await fetchRest(`${roomPath(code)}/meta.json`, {
      method: 'PUT',
      body: JSON.stringify(metaBody(created, Date.now(), uid, gid)),
      authToken: token
    });
  }

  function leaveHostWindow(code, createdAt, hostUid, gameId, usageHint) {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const gid = normalizeGameId(gameId);
    saveLastRoom('', gid);
    const uid = hostUid || cachedHostUid;
    recordSessionUsageKeepalive(normalized, Object.assign({}, usageHint, {
      createdAt,
      hostUid: uid,
      gameId: gid
    }), cachedHostToken);
    writeMetaKeepalive(normalized, createdAt, 0, uid, cachedHostToken, gid);
    deleteRoomKeepalive(normalized, cachedHostToken);
    try {
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'halomath-live-ended', code: normalized, gameId: gid }, '*');
      }
    } catch (e) { /* ignore */ }
  }

  async function roomIsActive(code) {
    try {
      const meta = await getMeta(code);
      return !!(meta && !isExpired(meta.createdAt) && !isHostClosed(meta));
    } catch (e) {
      return false;
    }
  }

  async function deleteRoom(code, gameId) {
    const user = await ensureHostAuth();
    const token = await user.getIdToken();
    try {
      await tryRecordSessionUsage(code, { gameId });
    } catch (e) {
      console.warn('session usage record failed:', e);
    }
    await fetchRest(`${roomPath(code)}.json`, { method: 'DELETE', authToken: token });
    saveLastRoom('', gameId);
  }

  function collectLiveList(data) {
    const list = [];
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        const row = data[key];
        if (!row || typeof row !== 'object') return;
        const name = String(row.name || '').trim().slice(0, 12);
        const score = Math.max(0, Math.min(999999999, Number(row.score) || 0));
        if (!name) return;
        list.push({
          name,
          score,
          totalErrorPx: parseOptionalPx(row.totalErrorPx),
          playTimeMs: parseOptionalMs(row.playTimeMs)
        });
      });
    }
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const errCmp = compareNullableAsc(a.totalErrorPx, b.totalErrorPx);
      if (errCmp !== 0) return errCmp;
      return compareNullableAsc(a.playTimeMs, b.playTimeMs);
    });
    return list;
  }

  function liveCsvFilename(code) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `halomath-session-${code || 'room'}-${stamp}.csv`;
  }

  function downloadLiveRanks(code, list, options) {
    const bingsoo2 = options && (options.compareMode === 'bingsoo2' || options.gameId === 'bingsoo2');
    const rows = bingsoo2
      ? [['순위', '닉네임', '점수', '총오차px', '시간ms', '세션코드']]
      : [['순위', '닉네임', '점수', '세션코드']];
    (list || []).forEach((item, i) => {
      if (bingsoo2) {
        rows.push([
          String(i + 1),
          item.name || '',
          String(item.score),
          item.totalErrorPx == null ? '' : String(item.totalErrorPx),
          item.playTimeMs == null ? '' : String(item.playTimeMs),
          code || ''
        ]);
      } else {
        rows.push([String(i + 1), item.name || '', String(item.score), code || '']);
      }
    });
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = liveCsvFilename(code);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function promptEndRoom(code, options) {
    const ok = window.confirm(`세션 ${code}을 종료하고 서버 기록을 지울까요?`);
    if (!ok) return false;

    let list = [];
    try {
      list = collectLiveList(await getPlayers(code));
    } catch (e) {
      console.warn('live session rank fetch failed:', e);
    }

    if (list.length) {
      const saveFile = window.confirm('종료하면 이 방 순위는 서버에서 사라집니다.\n순위를 파일로 저장할까요?');
      if (saveFile) downloadLiveRanks(code, list, options);
    }

    saveLastRoom('', options && options.gameId);
    return true;
  }

  async function submitScore(code, name, score, extras) {
    extras = extras && typeof extras === 'object' ? extras : {};
    const meta = await getMeta(code);
    if (!meta || isExpired(meta.createdAt) || isHostClosed(meta)) {
      const err = new Error('SESSION_ENDED');
      err.code = 'SESSION_ENDED';
      throw err;
    }
    if (extras.expectedGameId && meta.gameId && String(meta.gameId) !== String(extras.expectedGameId)) {
      const err = new Error('GAME_MISMATCH');
      err.code = 'GAME_MISMATCH';
      throw err;
    }
    const trimmedName = String(name || '').trim().slice(0, 12);
    const numScore = Math.max(0, Math.min(999999999, Number(score) || 0));
    const key = playerKey(trimmedName);
    const body = { name: trimmedName, score: numScore };
    const totalErrorPx = parseOptionalPx(extras.totalErrorPx);
    const playTimeMs = parseOptionalMs(extras.playTimeMs);
    if (totalErrorPx != null) body.totalErrorPx = totalErrorPx;
    if (playTimeMs != null) body.playTimeMs = playTimeMs;

    let existing = null;
    try {
      existing = await fetchRest(`${roomPath(code)}/players/${encodeURIComponent(key)}.json`);
    } catch (e) { /* first score */ }
    const existingScore = existing && typeof existing === 'object' ? Number(existing.score) || 0 : 0;
    const compareMode = extras.compareMode || (totalErrorPx != null ? 'bingsoo2' : 'higher');
    if (existing && typeof existing === 'object') {
      if (compareMode === 'bingsoo2') {
        const candidate = {
          score: numScore,
          totalErrorPx,
          playTimeMs,
          timestamp: Date.now()
        };
        const previous = {
          score: existingScore,
          totalErrorPx: parseOptionalPx(existing.totalErrorPx),
          playTimeMs: parseOptionalMs(existing.playTimeMs),
          timestamp: existing.timestamp || 0
        };
        if (!isBetterBingsoo2Record(candidate, previous)) {
          return { updated: false, existingScore };
        }
      } else if (existingScore >= numScore) {
        return { updated: false, existingScore };
      }
    }
    await fetchRest(`${roomPath(code)}/players/${encodeURIComponent(key)}.json`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    return { updated: true, existingScore };
  }

  function playersToLeaderboardMap(raw, options) {
    const mapped = {};
    const gameId = normalizeGameId(options && options.gameId);
    if (!raw || typeof raw !== 'object') return mapped;
    Object.keys(raw).forEach((key) => {
      const row = raw[key];
      if (!row || typeof row !== 'object') return;
      mapped[key] = {
        name: row.name,
        score: row.score,
        totalErrorPx: row.totalErrorPx,
        playTimeMs: row.playTimeMs,
        gameId,
        studentId: '',
        channel: 'live'
      };
    });
    return mapped;
  }

  function lobbyUrl(fromHref) {
    try {
      return new URL('index.html?ended=1', fromHref || window.location.href).href;
    } catch (e) {
      return 'index.html?ended=1';
    }
  }

  function returnToLobby(fromWindow, gameId) {
    const win = fromWindow || (typeof window !== 'undefined' ? window : null);
    if (!win) return;
    const gid = normalizeGameId(gameId);
    const target = lobbyUrl(win.location.href);
    saveLastRoom('', gid);

    if (win.opener && !win.opener.closed) {
      try { win.opener.location.replace(target); } catch (e) { /* ignore */ }
      try { win.opener.focus(); } catch (e) { /* ignore */ }
      try { win.opener.postMessage({ type: 'halomath-live-ended', gameId: gid }, '*'); } catch (e) { /* ignore */ }
      try { win.close(); } catch (e) { /* ignore */ }
      win.setTimeout(() => {
        if (!win.closed) win.location.replace(target);
      }, 120);
      return;
    }

    win.location.replace(target);
  }

  function hostAuthErrorMessage(err) {
    const code = err && err.code;
    if (code === 'HOST_AUTH_DISABLED' || (err && err.cause && err.cause.code === 'auth/operation-not-allowed')) {
      return '세션을 열려면 Firebase 콘솔에서 익명 로그인(Anonymous)을 켜 주세요.';
    }
    if (code === 'NO_FREE_CODE') {
      return '빈 세션 코드를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    const detail = err && (err.code || err.message) ? ` (${err.code || err.message})` : '';
    return `세션을 열 수 없습니다.${detail} Firebase 콘솔에서 liveRooms 규칙을 Publish했는지 확인해 주세요.`;
  }

  global.HalomathLive = {
    normalizeCode,
    normalizeGameId,
    detectRoomFromUrl,
    randomCode,
    playerKey,
    roomPath,
    TTL_MS,
    isExpired,
    isHostClosed,
    ensureHostAuth,
    refreshHostAuth,
    markHostOpen,
    leaveHostWindow,
    LAST_ROOM_KEY,
    lastRoomKey: lastRoomStorageKey,
    saveLastRoom,
    loadLastRoom,
    restBase,
    fetchRest,
    getMeta,
    getPlayers,
    createRoom,
    roomIsActive,
    deleteRoom,
    collectLiveList,
    downloadLiveRanks,
    promptEndRoom,
    submitScore,
    playersToLeaderboardMap,
    lobbyUrl,
    returnToLobby,
    hostAuthErrorMessage
  };
})(typeof window !== 'undefined' ? window : global);
