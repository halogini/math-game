/**
 * Unified Firebase score writes for HaloMath arcade games.
 * All records go to scores/ with channel + studentId markers.
 */
(function (global) {
  const SCORES_PATH = 'scores';
  const REST_URL = 'https://math-game-halogini-default-rtdb.firebaseio.com/scores.json';

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
      if (g === 'bingsoo2') return id === 'bingsoo2' || id === 'bingsoo-2';
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

  async function scanMatches(firebaseDb, filterFn) {
    const out = [];
    const collect = (dataObj, prefix, isDormsSubtree) => {
      if (!dataObj || typeof dataObj !== 'object') return;
      Object.keys(dataObj).forEach((key) => {
        const val = dataObj[key];
        if (!val || typeof val !== 'object') return;
        if (val.name) {
          if (filterFn(val)) {
            out.push({ key: prefix ? `${prefix}/${key}` : key, val });
          }
        } else {
          collect(val, prefix ? `${prefix}/${key}` : key, key === 'dorms' || isDormsSubtree);
        }
      });
    };

    if (firebaseDb) {
      try {
        const snap = await Promise.race([
          firebaseDb.ref(SCORES_PATH).once('value'),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500))
        ]);
        collect(snap.val(), '', false);
        return out;
      } catch (err) {
        console.warn('SDK score scan failed:', err);
      }
    }

    try {
      const res = await fetch(REST_URL);
      if (!res.ok) return out;
      collect(await res.json(), '', false);
      return out;
    } catch (err) {
      console.warn('REST score scan failed:', err);
      return out;
    }
  }

  async function writeRecord(firebaseDb, existingKey, payload) {
    if (firebaseDb) {
      try {
        if (existingKey) {
          await firebaseDb.ref(`${SCORES_PATH}/${existingKey}`).update(payload);
        } else {
          await firebaseDb.ref(SCORES_PATH).push(payload);
        }
        return true;
      } catch (err) {
        console.warn('SDK score write failed:', err);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = existingKey
      ? `https://math-game-halogini-default-rtdb.firebaseio.com/scores/${encodeURIComponent(existingKey)}.json`
      : REST_URL;
    try {
      const res = await fetch(url, {
        method: existingKey ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('REST score write failed:', err);
      return false;
    }
  }

  async function removeDuplicates(firebaseDb, matches, keepKey) {
    for (const m of matches) {
      if (m.key === keepKey) continue;
      if (firebaseDb) {
        try {
          await firebaseDb.ref(`${SCORES_PATH}/${m.key}`).remove();
        } catch (_) { /* ignore */ }
      }
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

    const targetKey = primary ? primary.key : null;
    const ok = await writeRecord(firebaseDb, targetKey, writePayload);
    if (!ok) {
      return { success: false, updated: false, message: '❌ 랭킹 등록 중 오류가 발생했습니다.' };
    }

    if (matches.length > 1) {
      await removeDuplicates(firebaseDb, matches, targetKey);
    }

    return {
      success: true,
      updated: !!primary,
      message: primary
        ? (updatedMessage || '🎉 기록이 갱신되었습니다!')
        : (createdMessage || '✅ 랭킹에 등록되었습니다!')
    };
  }

  global.HalomathScores = {
    SCORES_PATH,
    isDormsRecord,
    channelForMode,
    studentIdForMode,
    matchesPlayer,
    isBetterRecord,
    submitScore
  };
})(typeof window !== 'undefined' ? window : global);
