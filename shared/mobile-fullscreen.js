(function (global) {
  function wantsMobileFullscreen() {
    try {
      // Touchscreen laptops still expose hover + fine pointer (trackpad/mouse).
      if (window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) {
        return false;
      }
      return window.matchMedia("(pointer: coarse)").matches;
    } catch (_) {
      return false;
    }
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
      return wantsMobileFullscreen();
    }

    function request() {
      if (!supported() || isActive()) return;
      const req = root.requestFullscreen
        ? root.requestFullscreen()
        : root.webkitRequestFullscreen();
      if (req && typeof req.catch === "function") req.catch(function () {});
    }

    function requestIfMobile() {
      if (!wants()) return;
      request();
    }

    function syncButton() {
      if (!btn) return;
      const show = supported() && isPlaying() && !isActive();
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

    return {
      request: request,
      requestIfMobile: requestIfMobile,
      syncButton: syncButton,
      isActive: isActive,
      supported: supported,
      wants: wants
    };
  }

  global.MobileFullscreen = MobileFullscreen;
})(window);
