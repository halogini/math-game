/**

 * Unified Firebase score writes for HaloMath arcade games.

 * All records go to scores/ with channel + studentId markers.

 */

(function (global) {

  const SCORES_PATH = 'scores';

  const REST_BASE = 'https://math-game-halogini-default-rtdb.firebaseio.com/scores';

  const REST_URL = `${REST_BASE}.json`;

  const SCAN_TIMEOUT_MS = 3500;

  const WRITE_TIMEOUT_MS = 5000;

  const REMOVE_TIMEOUT_MS = 2500;



  function isDormsRecord(val) {

    const sid = String((val && val.studentId) || '').trim();

    const ch = String((val && val.channel) || '').trim();

    return sid === 'DORMS' || sid === 'DOREMS' || ch === 'dorms' || ch === 'dorems';

  }



  function channelForMode(activeMode) {

    return activeMode === 'dorms' ? 'dorms' : 'school';

  }



  function studentIdForMode(activeMode, studentId) {

    return activeMode === 'dorms' ? 'DORMS' : String(studentId || '').trim();

  }



  function isBingsoo2GameId(val) {

    const id = String((val && (val.gameId || val.game)) || '').trim();

    return id === 'bingsoo2' || id === 'bingsoo-2';

  }



  function recordName(val) {

    return String((val && (val.name || val.playerName)) || '').trim();

  }



  function matchesPlayer(val, name, studentId, activeMode) {

    if (!val || recordName(val) !== String(name).trim()) return false;

    if (activeMode === 'dorms') return isDormsRecord(val);

    return !isDormsRecord(val) && String(val.studentId || '').trim() === String(studentId).trim();

  }



  function matchesGameId(val, gameIds) {

    if (!gameIds || !gameIds.length) return true;

    const id = String((val && (val.gameId || val.game)) || '').trim();

    return gameIds.some((g) => {

      if (g === 'bingsoo') return id === 'bingsoo' || id === '';

      if (g === 'bingsoo2') return isBingsoo2GameId(val);

      return id === g;

    });

  }



  function compareNullableAsc(a, b) {

    if (a != null && b != null && a !== b) return a - b;

    if (a != null && b == null) return -1;

    if (a == null && b != null) return 1;

    return 0;

  }



  function isBetterRecord(candidate, existing, compareMode) {

    if (!existing) return true;

    if (compareMode === 'lowerClearTime') {

      const c = Number(candidate.clearTimeMs);

      const e = Number(existing.clearTimeMs);

      if (!Number.isFinite(c) || c <= 0) return false;

      if (!Number.isFinite(e) || e <= 0) return true;

      return c < e;

    }

    if (compareMode === 'bingsoo2') {

      const cs = Number(candidate.score) || 0;

      const es = Number(existing.score) || 0;

      if (cs !== es) return cs > es;

      const errCmp = compareNullableAsc(candidate.totalErrorPx, existing.totalErrorPx);

      if (errCmp !== 0) return errCmp < 0;

      const timeCmp = compareNullableAsc(candidate.playTimeMs, existing.playTimeMs);

      if (timeCmp !== 0) return timeCmp < 0;

      return (candidate.timestamp || 0) < (existing.timestamp || 0);

    }

    return (Number(candidate.score) || 0) > (Number(existing.score) || 0);

  }



  function withTimeout(promise, ms, label) {

    return Promise.race([

      promise,

      new Promise((_, reject) => {

        setTimeout(() => reject(new Error(label || 'timeout')), ms);

      })

    ]);

  }



  function restUrlForScoreKey(key, asPatch) {

    if (!key) return REST_URL;

    const segments = String(key).split('/').map(encodeURIComponent).join('/');

    return `${REST_BASE}/${segments}.json`;

  }



  async function fetchScoresJson() {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    try {

      const res = await fetch(REST_URL, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!res.ok) return null;

      return await res.json();

    } catch (err) {

      clearTimeout(timeoutId);

      console.warn('REST score scan failed:', err);

      return null;

    }

  }



  function collectMatches(dataObj, filterFn, prefix) {

    const out = [];

    const collect = (obj, keyPrefix, isDormsSubtree) => {

      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach((key) => {

        const val = obj[key];

        if (!val || typeof val !== 'object') return;

        if (val.name || val.playerName) {

          if (filterFn(val)) {

            out.push({ key: keyPrefix ? `${keyPrefix}/${key}` : key, val });

          }

        } else {

          collect(val, keyPrefix ? `${keyPrefix}/${key}` : key, key === 'dorms' || isDormsSubtree);

        }

      });

    };

    collect(dataObj, prefix || '', false);

    return out;

  }



  async function scanMatches(firebaseDb, filterFn) {

    if (firebaseDb) {

      try {

        const snap = await withTimeout(

          firebaseDb.ref(SCORES_PATH).once('value'),

          SCAN_TIMEOUT_MS,

          'scan timeout'

        );

        return collectMatches(snap.val(), filterFn);

      } catch (err) {

        console.warn('SDK score scan failed:', err);

      }

    }



    const data = await fetchScoresJson();

    if (!data) return [];

    return collectMatches(data, filterFn);

  }



  async function writeRecord(firebaseDb, existingKey, payload) {

    if (firebaseDb) {

      try {

        if (existingKey) {

          await withTimeout(

            firebaseDb.ref(`${SCORES_PATH}/${existingKey}`).update(payload),

            WRITE_TIMEOUT_MS,

            'update timeout'

          );

          return { ok: true, key: existingKey };

        }



        const ref = await withTimeout(

          firebaseDb.ref(SCORES_PATH).push(payload),

          WRITE_TIMEOUT_MS,

          'push timeout'

        );

        return { ok: true, key: ref.key || null };

      } catch (err) {

        console.warn('SDK score write failed:', err);

      }

    }



    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

    const url = restUrlForScoreKey(existingKey);

    try {

      const res = await fetch(url, {

        method: existingKey ? 'PATCH' : 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload),

        signal: controller.signal

      });

      clearTimeout(timeoutId);

      if (!res.ok) return { ok: false, key: existingKey || null };



      if (existingKey) {

        return { ok: true, key: existingKey };

      }



      const body = await res.json().catch(() => null);

      const pushedKey = body && body.name ? String(body.name) : null;

      return { ok: true, key: pushedKey };

    } catch (err) {

      clearTimeout(timeoutId);

      console.warn('REST score write failed:', err);

      return { ok: false, key: existingKey || null };

    }

  }



  async function removeScoreKey(firebaseDb, key) {

    if (!key) return;



    if (firebaseDb) {

      try {

        await withTimeout(

          firebaseDb.ref(`${SCORES_PATH}/${key}`).remove(),

          REMOVE_TIMEOUT_MS,

          'remove timeout'

        );

        return;

      } catch (err) {

        console.warn('SDK score remove failed:', err);

      }

    }



    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), REMOVE_TIMEOUT_MS);

    try {

      await fetch(restUrlForScoreKey(key), {

        method: 'DELETE',

        signal: controller.signal

      });

    } catch (err) {

      console.warn('REST score remove failed:', err);

    } finally {

      clearTimeout(timeoutId);

    }

  }



  async function removeDuplicates(firebaseDb, matches, keepKey) {

    for (const m of matches) {

      if (!m.key || m.key === keepKey) continue;

      await removeScoreKey(firebaseDb, m.key);

    }

  }



  /**

   * @param {object} opts

   * @param {object|null} opts.firebaseDb

   * @param {string} opts.activeMode

   * @param {string} opts.name

   * @param {string} opts.studentId

   * @param {string[]} opts.gameIds

   * @param {object} opts.payload

   * @param {string} [opts.compareMode] higher | lowerClearTime | bingsoo2

   * @param {function} [opts.acceptEntry]

   * @param {string} [opts.updatedMessage]

   * @param {string} [opts.createdMessage]

   * @param {string} [opts.unchangedMessage]

   */

  async function submitScore(firebaseDb, opts) {

    const {

      activeMode,

      name,

      studentId,

      gameIds,

      payload,

      compareMode = 'higher',

      acceptEntry,

      updatedMessage,

      createdMessage,

      unchangedMessage

    } = opts;



    try {

      const filterFn = (val) => {

        if (!matchesGameId(val, gameIds)) return false;

        if (acceptEntry && !acceptEntry(val)) return false;

        return matchesPlayer(val, name, studentId, activeMode);

      };



      const writePayload = Object.assign({}, payload, {

        name: String(name).trim(),

        studentId: studentIdForMode(activeMode, studentId),

        channel: channelForMode(activeMode)

      });



      const matches = await scanMatches(firebaseDb, filterFn);

      let primary = null;

      matches.forEach((m) => {

        if (!primary || isBetterRecord(m.val, primary.val, compareMode)) primary = m;

      });



      if (primary && !isBetterRecord(writePayload, primary.val, compareMode)) {
        const existingScore = Number(primary.val.score) || 0;
        if (global.HalomathPlayStats && typeof global.HalomathPlayStats.recordPlay === 'function') {
          const playGameId = (writePayload && writePayload.gameId) || (gameIds && gameIds[0]) || '';
          global.HalomathPlayStats.recordPlay(playGameId, { channel: 'arcade' });
        }
        return {
          success: true,
          updated: false,
          existingScore,
          message: unchangedMessage || 'â„¹ï¸ ê¸°ì¡´ ê¸°ë¡ì´ ë” ì¢‹ì•„ ê°±ì‹ í•˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.'
        };
      }



      // Bingsoo 2 uses tie-breakers (error px, play time). Firebase write rules only

      // allow score increases on update, so always push a fresh flat scores/ row.

      const forcePush = compareMode === 'bingsoo2';

      const targetKey = forcePush ? null : (primary ? primary.key : null);

      const writeResult = await writeRecord(firebaseDb, targetKey, writePayload);

      if (!writeResult.ok) {

        return { success: false, updated: false, message: 'âŒ ë­í‚¹ ë“±ë¡ ì¤‘ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.' };

      }



      const keepKey = writeResult.key || targetKey;

      if (matches.length > 0) {

        await removeDuplicates(firebaseDb, matches, keepKey);

      }

      if (global.HalomathPlayStats && typeof global.HalomathPlayStats.recordPlay === 'function') {
        const playGameId = (writePayload && writePayload.gameId) || (gameIds && gameIds[0]) || '';
        global.HalomathPlayStats.recordPlay(playGameId, { channel: 'arcade' });
      }

      return {

        success: true,

        updated: !!primary,

        message: primary

          ? (updatedMessage || 'ğŸ‰ ê¸°ë¡ì´ ê°±ì‹ ë˜ì—ˆìŠµë‹ˆë‹¤!')

          : (createdMessage || 'âœ… ë­í‚¹ì— ë“±ë¡ë˜ì—ˆìŠµë‹ˆë‹¤!')

      };

    } catch (err) {

      console.warn('submitScore failed:', err);

      return { success: false, updated: false, message: 'âŒ ë­í‚¹ ë“±ë¡ ì¤‘ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤.' };

    }

  }



  global.HalomathScores = {

    SCORES_PATH,

    isDormsRecord,

    isBingsoo2GameId,

    channelForMode,

    studentIdForMode,

    matchesPlayer,

    matchesGameId,

    isBetterRecord,

    submitScore

  };

})(typeof window !== 'undefined' ? window : global);



// --- [º¸¾È(Anti-Cheat) ¸ğµâ] ---
(function() {
  if (typeof window === 'undefined') return;
  // 1. ¿ìÅ¬¸¯ ¹× °³¹ßÀÚ µµ±¸ ´ÜÃàÅ° Â÷´Ü
  window.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  window.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || e.keyCode === 123) e.preventDefault();
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) e.preventDefault();
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) e.preventDefault();
  });
  // 2. µğ¹ö°Å µ£ (°³¹ßÀÚ µµ±¸ ¿ÀÇÂ ½Ã ºê¶ó¿ìÀú Á¤Áö)
  setInterval(function() {
    (function() { return false; }['constructor']('debugger')());
  }, 1000);
})();
