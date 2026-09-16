/**
 * Play counters via existing sessionUsage/byGame/*/qualified writes (auth required).
 * Keys are namespaced with play_ so they do not mix into classroom session totals.
 */
(function (global) {
  const REST_BASE = 'https://math-game-halogini-default-rtdb.firebaseio.com';
  const WRITE_TIMEOUT_MS = 4000;
  const PLAY_PREFIX = 'play_';

  let cachedToken = '';

  function usageDayKey(nowMs) {
    const t = Number(nowMs) || Date.now();
    const kst = new Date(t + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeGameId(gameId) {
    const id = String(gameId || '').trim().replace(/[.#$\[\]\/]/g, '_').slice(0, 24);
    return id || 'unknown';
  }

  function normalizeChannel(channel) {
    return channel === 'live' ? 'live' : 'arcade';
  }

  function isPlayStatGameKey(gameId) {
    return String(gameId || '').indexOf(PLAY_PREFIX) === 0;
  }

  function playTotalKey() {
    return PLAY_PREFIX + 'total';
  }

  function playDayKey(day) {
    return PLAY_PREFIX + 'day_' + String(day || '');
  }

  function playGameKey(gameId) {
    return PLAY_PREFIX + 'game_' + normalizeGameId(gameId);
  }

  function playChannelKey(channel) {
    return PLAY_PREFIX + 'ch_' + normalizeChannel(channel);
  }

  function playDayChannelKey(day, channel) {
    return PLAY_PREFIX + 'dch_' + String(day || '') + '_' + normalizeChannel(channel);
  }

  function playSessionDedupKey(code, createdAt) {
    const room = String(code || '').toUpperCase().replace(/[.#$\[\]\/]/g, '_');
    const ca = Number(createdAt) || 0;
    return (`play_${room}_${ca}`).replace(/[.#$\[\]\/]/g, '_').slice(0, 200);
  }

  function roomPlayLedgerKey(code, createdAt) {
    const room = String(code || '').toUpperCase().replace(/[.#$\[\]\/]/g, '_');
    const ca = Number(createdAt) || 0;
    return (`${room}_${ca}`).replace(/[.#$\[\]\/]/g, '_').slice(0, 200);
  }

  function buildIncrementPatchBody(gameId, channel, atMs, n) {
    const count = Math.max(1, Math.min(200, Math.floor(Number(n) || 1)));
    const inc = { '.sv': { increment: count } };
    const day = usageDayKey(atMs);
    const ch = normalizeChannel(channel);
    return {
      [`byGame/${playTotalKey()}/qualified`]: inc,
      [`byGame/${playDayKey(day)}/qualified`]: inc,
      [`byGame/${playGameKey(gameId)}/qualified`]: inc,
      [`byGame/${playChannelKey(ch)}/qualified`]: inc,
      [`byGame/${playDayChannelKey(day, ch)}/qualified`]: inc
    };
  }

  function buildLivePlayPatchBody(gameId, channel, atMs, n, ledgerKey, prev) {
    const total = Math.max(1, Math.min(200, Math.floor(Number(n) || 1)));
    const previous = Math.max(0, Math.floor(Number(prev) || 0));
    if (total <= previous) return null;
    const body = buildIncrementPatchBody(gameId, channel, atMs, total - previous);
    const key = String(ledgerKey || '').replace(/[.#$\[\]\/]/g, '_').slice(0, 200);
    if (key) body[`roomPlays/${key}`] = total;
    return body;
  }

  function buildPatchBody(gameId, channel, atMs, n, dedupKey) {
    const body = buildIncrementPatchBody(gameId, channel, atMs, n);
    const key = String(dedupKey || '').replace(/[.#$\[\]\/]/g, '_').slice(0, 200);
    if (key) body[`dedup/${key}`] = true;
    return body;
  }

  async function ensureAnonAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) return '';
    const auth = firebase.auth();
    try {
      if (!auth.currentUser) {
        await auth.signInAnonymously();
      }
      if (!auth.currentUser) return '';
      cachedToken = await auth.currentUser.getIdToken();
      return cachedToken;
    } catch (e) {
      console.warn('play stats auth failed:', e);
      return '';
    }
  }

  function withAuth(url, token) {
    if (!token) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'auth=' + encodeURIComponent(token);
  }

  function patchPlayCounters(gameId, channel, token, n, dedupKey, atMs) {
    if (!token) return;
    const body = JSON.stringify(buildPatchBody(gameId, channel, Number(atMs) || Date.now(), n, dedupKey));
    const useAbort = !dedupKey;
    const controller = useAbort && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS)
      : null;
    try {
      fetch(withAuth(REST_BASE + '/sessionUsage.json', token), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        signal: controller ? controller.signal : undefined
      }).catch(() => { /* ignore */ }).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * @param {string} gameId
   * @param {{ channel?: 'arcade'|'live', token?: string, dedupKey?: string, count?: number, atMs?: number }} [options]
   */
  function recordPlay(gameId, options) {
    const channel = options && options.channel;
    const providedToken = options && options.token;
    const dedupKey = options && options.dedupKey;
    const count = options && options.count;
    const atMs = options && options.atMs;

    function afterToken(token) {
      if (!token) return;
      cachedToken = token;
      patchPlayCounters(gameId, channel, token, count, dedupKey, atMs);
    }

    if (providedToken) {
      afterToken(providedToken);
      return;
    }
    Promise.resolve(cachedToken || ensureAnonAuth()).then(afterToken);
  }

  function parsePlayStatsFromSessionUsage(data) {
    const byGameRaw = data && data.byGame && typeof data.byGame === 'object' ? data.byGame : {};
    const totals = { plays: 0 };
    const byDay = {};
    const byGame = {};
    const byDayArcade = {};
    const byDayLive = {};

    Object.keys(byGameRaw).forEach((key) => {
      if (!isPlayStatGameKey(key)) return;
      const row = byGameRaw[key] || {};
      const n = Number(row.qualified);
      const count = Number.isFinite(n) && n >= 0 ? n : 0;
      if (!count) return;

      if (key === playTotalKey()) {
        totals.plays = count;
        return;
      }
      if (key.indexOf(PLAY_PREFIX + 'dch_') === 0) {
        const rest = key.slice((PLAY_PREFIX + 'dch_').length);
        const m = /^(\d{4}-\d{2}-\d{2})_(arcade|live)$/.exec(rest);
        if (!m) return;
        const bucket = m[2] === 'live' ? byDayLive : byDayArcade;
        bucket[m[1]] = { plays: count };
        return;
      }
      if (key.indexOf(PLAY_PREFIX + 'day_') === 0) {
        const day = key.slice((PLAY_PREFIX + 'day_').length);
        byDay[day] = { plays: count };
        return;
      }
      if (key.indexOf(PLAY_PREFIX + 'game_') === 0) {
        const gid = key.slice((PLAY_PREFIX + 'game_').length);
        byGame[gid] = { plays: count };
      }
    });

    return { totals, byDay, byGame, byDayArcade, byDayLive };
  }

  global.HalomathPlayStats = {
    PLAY_PREFIX,
    recordPlay,
    playSessionDedupKey,
    roomPlayLedgerKey,
    usageDayKey,
    normalizeGameId,
    normalizeChannel,
    isPlayStatGameKey,
    buildPatchBody,
    buildIncrementPatchBody,
    buildLivePlayPatchBody,
    parsePlayStatsFromSessionUsage
  };
})(typeof window !== 'undefined' ? window : global);
