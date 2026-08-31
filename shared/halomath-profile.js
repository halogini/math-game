/**
 * Shared player profile storage for HaloMath arcade games.
 * Keys: halomath_name_school | halomath_name_dorms, halomath_id_school
 */
(function (global) {
  const LEGACY_NAME_KEYS = {
    school: ['hm_player_name', 'bingsoo_name_school', 'bingsoo2_name_school', 'congruence_name_school'],
    dorms: ['hm_player_name', 'bingsoo_name_dorms', 'bingsoo2_name_dorms', 'congruence_name_dorms']
  };
  const LEGACY_ID_KEYS = {
    school: ['hm_student_id', 'bingsoo_id_school', 'bingsoo2_id_school', 'congruence_id_school']
  };

  function nameKey(mode) {
    return `halomath_name_${mode}`;
  }

  function idKey(mode) {
    return `halomath_id_${mode}`;
  }

  function getStorage(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn('Profile storage restricted:', e);
    }
  }

  function loadName(mode) {
    const primary = getStorage(nameKey(mode));
    if (primary) return primary;
    const legacy = LEGACY_NAME_KEYS[mode] || [];
    for (let i = 0; i < legacy.length; i++) {
      const val = getStorage(legacy[i]);
      if (val) return val;
    }
    return '';
  }

  function loadStudentId(mode) {
    if (mode !== 'school') return '';
    const primary = getStorage(idKey(mode));
    if (primary) return primary;
    const legacy = LEGACY_ID_KEYS.school || [];
    for (let i = 0; i < legacy.length; i++) {
      const val = getStorage(legacy[i]);
      if (val) return val;
    }
    return '';
  }

  function saveName(mode, name) {
    setStorage(nameKey(mode), name);
  }

  function saveStudentId(mode, id) {
    if (mode === 'school') setStorage(idKey(mode), id);
  }

  function isValidStudentId(id) {
    if (typeof id !== 'string') return false;
    const trimmed = id.trim();
    return trimmed.length >= 1 && trimmed.length <= 10 && /^[a-zA-Z0-9가-힣\-]+$/.test(trimmed);
  }

  global.HalomathProfile = {
    nameKey,
    idKey,
    loadName,
    loadStudentId,
    saveName,
    saveStudentId,
    isValidStudentId
  };
})(typeof window !== 'undefined' ? window : global);
