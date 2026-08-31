/**
 * HaloMath channel mode: school vs dorms.
 * Default when ?mode= is omitted: dorms.
 * Explicit: ?mode=school | ?mode=dorms (dorems alias)
 */
(function (global) {
  function detectActiveMode() {
    try {
      const href = (window.location.href || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();

      if (search.includes('mode=school') || hash.includes('mode=school') || path.includes('/school')) {
        return 'school';
      }
      if (search.includes('mode=dorms') || search.includes('mode=dorems') ||
          hash.includes('mode=dorms') || hash.includes('mode=dorems') ||
          path.includes('/dorms') || path.includes('/dorems') ||
          href.includes('dorms') || href.includes('dorems')) {
        return 'dorms';
      }
    } catch (e) {
      /* ignore */
    }
    return 'dorms';
  }

  global.HalomathMode = {
    detectActiveMode
  };
})(typeof window !== 'undefined' ? window : global);
