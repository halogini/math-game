(function (global) {
  function isTouchDevice() {
    try {
      if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return true;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
    } catch (_) {}
    return (navigator.maxTouchPoints || 0) > 1;
  }

  function MobileFullscreen(options) {
    const root = typeof options.root === "string"
      ? document.querySelector(options.root)
      : options.root;
    const btn = typeof options.button === "string"
      ? document.querySelector(options.button)
      : options.button;
    const onResize = options.onResize || function () {};
    const isPlaying = options.isPlaying || function () { return false; };

    function supported() {
      return !!(root && (root.requestFullscreen || root.webkitRequestFullscreen));
    }

    function isActive() {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      return active === root;
    }

    function wants() {
      return isTouchDevice();
    }

    function request() {
      if (!wants() || !supported() || isActive()) return;
      const req = root.requestFullscreen
        ? root.requestFullscreen()
        : root.webkitRequestFullscreen();
      if (req && typeof req.catch === "function") req.catch(function () {});
    }

    function syncButton() {
      if (!btn) return;
      const show = wants() && supported() && isPlaying() && !isActive();
      btn.classList.toggle("hidden", !show);
    }

    function onViewportChange() {
      onResize();
      syncButton();
    }

    document.addEventListener("fullscreenchange", onViewportChange);
    document.addEventListener("webkitfullscreenchange", onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onViewportChange);
    }

    if (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        request();
      });
    }

    syncButton();

    return { request: request, syncButton: syncButton, isActive: isActive, supported: supported, wants: wants };
  }

  global.MobileFullscreen = MobileFullscreen;
})(window);
