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

  function matchesPlayer(val, name, studentId, activeMode) {
    if (!val || String(val.name || '').trim() !== String(name).trim()) return false;
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
        if (val.name) {
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
        return {
          success: true,
          updated: false,
          message: unchangedMessage || 'ℹ️ 기존 기록이 더 좋아 갱신하지 않았습니다.'
        };
      }

      // Bingsoo 2 uses tie-breakers (error px, play time). Firebase write rules only
      // allow score increases on update, so always push a fresh flat scores/ row.
      const forcePush = compareMode === 'bingsoo2';
      const targetKey = forcePush ? null : (primary ? primary.key : null);
      const writeResult = await writeRecord(firebaseDb, targetKey, writePayload);
      if (!writeResult.ok) {
        return { success: false, updated: false, message: '❌ 랭킹 등록 중 오류가 발생했습니다.' };
      }

      const keepKey = writeResult.key || targetKey;
      if (matches.length > 0) {
        await removeDuplicates(firebaseDb, matches, keepKey);
      }

      return {
        success: true,
        updated: !!primary,
        message: primary
          ? (updatedMessage || '🎉 기록이 갱신되었습니다!')
          : (createdMessage || '✅ 랭킹에 등록되었습니다!')
      };
    } catch (err) {
      console.warn('submitScore failed:', err);
      return { success: false, updated: false, message: '❌ 랭킹 등록 중 오류가 발생했습니다.' };
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
