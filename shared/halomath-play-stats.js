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

  function buildPatchBody(gameId, channel, atMs) {
    const inc = { '.sv': { increment: 1 } };
    const day = usageDayKey(atMs);
    return {
      [`byGame/${playTotalKey()}/qualified`]: inc,
      [`byGame/${playDayKey(day)}/qualified`]: inc,
      [`byGame/${playGameKey(gameId)}/qualified`]: inc,
      [`byGame/${playChannelKey(channel)}/qualified`]: inc
    };
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

  /**
   * @param {string} gameId
   * @param {{ channel?: 'arcade'|'live' }} [options]
   */
  function recordPlay(gameId, options) {
    const channel = options && options.channel;
    const body = JSON.stringify(buildPatchBody(gameId, channel, Date.now()));

    Promise.resolve(cachedToken || ensureAnonAuth()).then((token) => {
      if (!token) return;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
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
    });
  }

  function parsePlayStatsFromSessionUsage(data) {
    const byGameRaw = data && data.byGame && typeof data.byGame === 'object' ? data.byGame : {};
    const totals = { plays: 0 };
    const byDay = {};
    const byGame = {};
    const byChannel = {};

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
      if (key.indexOf(PLAY_PREFIX + 'day_') === 0) {
        const day = key.slice((PLAY_PREFIX + 'day_').length);
        byDay[day] = { plays: count };
        return;
      }
      if (key.indexOf(PLAY_PREFIX + 'game_') === 0) {
        const gid = key.slice((PLAY_PREFIX + 'game_').length);
        byGame[gid] = { plays: count };
        return;
      }
      if (key.indexOf(PLAY_PREFIX + 'ch_') === 0) {
        const ch = key.slice((PLAY_PREFIX + 'ch_').length);
        byChannel[ch] = { plays: count };
      }
    });

    return { totals, byDay, byGame, byChannel };
  }

  global.HalomathPlayStats = {
    PLAY_PREFIX,
    recordPlay,
    usageDayKey,
    normalizeGameId,
    normalizeChannel,
    isPlayStatGameKey,
    buildPatchBody,
    parsePlayStatsFromSessionUsage
  };
})(typeof window !== 'undefined' ? window : global);
