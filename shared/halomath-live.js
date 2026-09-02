/**
 * Classroom live sessions (REST-first). Scores go to liveRooms/{code}, never scores/.
 */
(function (global) {
  const ALPH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const TTL_MS = 24 * 60 * 60 * 1000;
  const LAST_ROOM_KEY = 'halomath_live_last_room';
  const REST_TIMEOUT_MS = 8000;

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

  function saveLastRoom(code) {
    try {
      if (code) localStorage.setItem(LAST_ROOM_KEY, code);
      else localStorage.removeItem(LAST_ROOM_KEY);
    } catch (e) { /* ignore */ }
  }

  function loadLastRoom() {
    try {
      return normalizeCode(localStorage.getItem(LAST_ROOM_KEY) || '');
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

  async function fetchRest(path, options, timeoutMs) {
    const ms = timeoutMs || REST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const cleanPath = String(path || '').replace(/^\//, '');
    try {
      const res = await fetch(`${restBase()}/${cleanPath}`, {
        method: options && options.method ? options.method : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options && options.body ? options.body : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(text || res.statusText);
        err.code = res.status === 401 ? 'PERMISSION_DENIED' : String(res.status);
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

  async function createRoom(code) {
    await fetchRest(`${roomPath(code)}/meta.json`, {
      method: 'PUT',
      body: JSON.stringify({ gameId: 'bingsoo', createdAt: Date.now() })
    });
  }

  async function roomIsActive(code) {
    try {
      const meta = await getMeta(code);
      return !!(meta && !isExpired(meta.createdAt));
    } catch (e) {
      return false;
    }
  }

  async function deleteRoom(code) {
    await fetchRest(`${roomPath(code)}.json`, { method: 'DELETE' });
    saveLastRoom('');
  }

  function collectLiveList(data) {
    const list = [];
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        const row = data[key];
        if (!row || typeof row !== 'object') return;
        const name = String(row.name || '').trim().slice(0, 12);
        const score = Math.max(0, Math.min(500, Number(row.score) || 0));
        if (!name) return;
        list.push({ name, score });
      });
    }
    list.sort((a, b) => b.score - a.score);
    return list;
  }

  function liveCsvFilename(code) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `halomath-session-${code || 'room'}-${stamp}.csv`;
  }

  function downloadLiveRanks(code, list) {
    const rows = [['순위', '닉네임', '점수', '세션코드']];
    (list || []).forEach((item, i) => {
      rows.push([String(i + 1), item.name || '', String(item.score), code || '']);
    });
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = liveCsvFilename(code);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function promptEndRoom(code) {
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
      if (saveFile) downloadLiveRanks(code, list);
    }

    saveLastRoom('');
    return true;
  }

  async function submitScore(code, name, score) {
    const meta = await getMeta(code);
    if (!meta || isExpired(meta.createdAt)) {
      const err = new Error('SESSION_ENDED');
      err.code = 'SESSION_ENDED';
      throw err;
    }
    const trimmedName = String(name || '').trim().slice(0, 12);
    const numScore = Math.max(0, Math.min(500, Number(score) || 0));
    const key = playerKey(trimmedName);
    let existing = null;
    try {
      existing = await fetchRest(`${roomPath(code)}/players/${encodeURIComponent(key)}.json`);
    } catch (e) { /* first score */ }
    const existingScore = existing && typeof existing === 'object' ? Number(existing.score) || 0 : 0;
    if (existingScore >= numScore) {
      return { updated: false, existingScore };
    }
    await fetchRest(`${roomPath(code)}/players/${encodeURIComponent(key)}.json`, {
      method: 'PUT',
      body: JSON.stringify({ name: trimmedName, score: numScore })
    });
    return { updated: existingScore > 0, existingScore };
  }

  function playersToLeaderboardMap(raw) {
    const mapped = {};
    if (!raw || typeof raw !== 'object') return mapped;
    Object.keys(raw).forEach((key) => {
      const row = raw[key];
      if (!row || typeof row !== 'object') return;
      mapped[key] = {
        name: row.name,
        score: row.score,
        gameId: 'bingsoo',
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

  function returnToLobby(fromWindow) {
    const win = fromWindow || (typeof window !== 'undefined' ? window : null);
    if (!win) return;
    const target = lobbyUrl(win.location.href);
    saveLastRoom('');

    if (win.opener && !win.opener.closed) {
      try { win.opener.location.replace(target); } catch (e) { /* ignore */ }
      try { win.opener.focus(); } catch (e) { /* ignore */ }
      try { win.opener.postMessage({ type: 'halomath-live-ended' }, '*'); } catch (e) { /* ignore */ }
      try { win.close(); } catch (e) { /* ignore */ }
      win.setTimeout(() => {
        if (!win.closed) win.location.replace(target);
      }, 120);
      return;
    }

    win.location.replace(target);
  }

  global.HalomathLive = {
    normalizeCode,
    detectRoomFromUrl,
    randomCode,
    playerKey,
    roomPath,
    TTL_MS,
    isExpired,
    LAST_ROOM_KEY,
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
    returnToLobby
  };
})(typeof window !== 'undefined' ? window : global);
