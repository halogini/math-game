const LIVE_GAME = Object.assign({
  gameId: 'bingsoo',
  compareMode: 'higher',
  sessionWindowName: 'halomath-bingsoo-session',
  qrWindowName: 'halomath-bingsoo-qr',
  qrPopoutPath: 'qr-popout.html'
}, (typeof window !== 'undefined' && window.HalomathLiveGame) || {});

function liveGameId() {
  return LIVE_GAME.gameId || 'bingsoo';
}

function liveOptions() {
  return { gameId: liveGameId(), compareMode: LIVE_GAME.compareMode || 'higher' };
}

function detectLobbyMode() {
  try {
    if (typeof HalomathMode !== 'undefined') return HalomathMode.detectActiveMode();
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'school') return 'school';
    if (mode === 'dorms' || mode === 'dorems') return 'dorms';
  } catch (e) { /* ignore */ }
  return 'dorms';
}

function modeQuery() {
  return `mode=${detectLobbyMode() === 'school' ? 'school' : 'dorms'}`;
}

function soloPlayPath() {
  const gid = liveGameId();
  if (gid === 'bingsoo2') return '../bingsoo2/index.html';
  if (gid === 'prism-tycoon' || gid === 'tycoon') return '../prism-tycoon/index.html';
  return '../bingsoo/index.html';
}

function applySoloPlayLink() {
  const btn = document.getElementById('btn-play-solo');
  if (!btn) return;
  btn.href = `${soloPlayPath()}?${modeQuery()}`;
}

function hostUrl(code) {
  const url = new URL('host.html', window.location.href);
  url.searchParams.set('room', code);
  if (detectLobbyMode() === 'school') url.searchParams.set('mode', 'school');
  return url.href;
}

function qrPopoutUrl(code) {
  const url = new URL(LIVE_GAME.qrPopoutPath || 'qr-popout.html', window.location.href);
  url.searchParams.set('room', code);
  if (liveGameId() !== 'bingsoo') url.searchParams.set('game', liveGameId());
  if (detectLobbyMode() === 'school') url.searchParams.set('mode', 'school');
  return url.href;
}

function openQrPopout(code) {
  const features = 'width=320,height=440,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
  const opened = window.open(qrPopoutUrl(code), LIVE_GAME.qrWindowName || 'halomath-bingsoo-qr', features);
  if (opened) {
    try { opened.focus(); } catch (e) { /* ignore */ }
  }
  return opened;
}

function openHostWindow(code) {
  const url = hostUrl(code);
  const opened = window.open(url, LIVE_GAME.sessionWindowName || 'halomath-bingsoo-session');
  if (!opened) {
    window.location.href = url;
    return false;
  }
  openQrPopout(code);
  try { opened.focus(); } catch (e) { /* ignore */ }
  return true;
}

function showReopen(code) {
  const btn = document.getElementById('btn-reopen');
  const banner = document.getElementById('active-banner');
  const codeEl = document.getElementById('active-code');
  if (!code) return;
  if (codeEl) codeEl.textContent = code;
  if (banner) {
    banner.hidden = false;
    banner.classList.remove('hidden');
  }
  if (btn) {
    btn.hidden = false;
    btn.classList.remove('hidden');
    btn.textContent = '진행 창 다시 열기';
  }
}

function hideReopen() {
  const btn = document.getElementById('btn-reopen');
  const banner = document.getElementById('active-banner');
  const codeEl = document.getElementById('active-code');
  if (banner) {
    banner.hidden = true;
    banner.classList.add('hidden');
  }
  if (codeEl) codeEl.textContent = '————';
  if (btn) {
    btn.hidden = true;
    btn.classList.add('hidden');
  }
}

function setStatus(text) {
  const status = document.getElementById('host-status');
  if (status) status.textContent = text || '';
}

function setBusy(busy) {
  const btn = document.getElementById('btn-host');
  if (btn) btn.disabled = !!busy;
}

document.getElementById('btn-host').addEventListener('click', async () => {
  if (!window.HalomathLive) {
    setStatus('세션 모듈을 불러오지 못했습니다. Ctrl+Shift+R로 새로고침해 주세요.');
    return;
  }

  setBusy(true);
  setStatus('세션 준비 중…');

  try {
    await HalomathLive.ensureHostAuth();
    try {
      await HalomathLive.cleanupInactiveLastRooms();
    } catch (e) {
      console.warn('cleanupInactiveLastRooms failed:', e);
    }
    let existing = HalomathLive.loadLastRoom(liveGameId());
    if (existing && !(await HalomathLive.roomIsActive(existing))) {
      try {
        await HalomathLive.deleteRoom(existing, liveGameId());
      } catch (e) {
        console.warn('inactive room delete failed:', e);
        HalomathLive.saveLastRoom('', liveGameId());
      }
      hideReopen();
      existing = '';
    }

    if (existing) {
      const reopen = window.confirm(
        `진행 중인 세션 ${existing}이 있습니다.\n그 창을 다시 열까요?\n\n취소 = 이전 세션을 종료하고 새 세션 시작`
      );
      if (reopen) {
        openHostWindow(existing);
        setStatus('진행 중 세션 창을 열었습니다.');
        return;
      }
      const shouldEnd = await HalomathLive.promptEndRoom(existing, liveOptions());
      if (!shouldEnd) {
        setStatus('이전 세션을 그대로 둡니다.');
        return;
      }
      await HalomathLive.deleteRoom(existing, liveGameId());
      hideReopen();
    }

    setStatus('빈 세션 코드를 찾는 중…');
    const code = await HalomathLive.createRoom(liveGameId());
    HalomathLive.saveLastRoom(code, liveGameId());
    showReopen(code);

    const popped = openHostWindow(code);
    setStatus(popped
      ? `세션 ${code} 창을 열었습니다.`
      : `세션 ${code}으로 이동했습니다. (팝업이 막혀 같은 탭에서 열림)`);
  } catch (err) {
    console.warn(err);
    setStatus(HalomathLive.hostAuthErrorMessage(err));
  } finally {
    setBusy(false);
  }
});

document.getElementById('btn-reopen').addEventListener('click', async () => {
  const code = window.HalomathLive ? HalomathLive.loadLastRoom(liveGameId()) : '';
  if (!code) {
    hideReopen();
    return;
  }
  try {
    await HalomathLive.ensureHostAuth();
  } catch (err) {
    setStatus(HalomathLive.hostAuthErrorMessage(err));
    return;
  }
  openHostWindow(code);
  setStatus('진행 중 세션 창을 열었습니다.');
});

window.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'halomath-live-ended') return;
  if (e.origin !== window.location.origin && e.origin !== 'null') return;
  const msgGame = e.data.gameId || 'bingsoo';
  if (msgGame !== liveGameId()) return;
  if (window.HalomathLive) HalomathLive.saveLastRoom('', liveGameId());
  hideReopen();
  setStatus('세션이 종료되었습니다.');
});

window.addEventListener('storage', (e) => {
  if (!window.HalomathLive) return;
  const roomKey = HalomathLive.lastRoomKey
    ? HalomathLive.lastRoomKey(liveGameId())
    : HalomathLive.LAST_ROOM_KEY;
  if (e.key && e.key !== roomKey) return;
  const code = HalomathLive.loadLastRoom(liveGameId());
  if (code) showReopen(code);
  else hideReopen();
});

(function initLobby() {
  applySoloPlayLink();
  if (!window.HalomathLive) {
    setStatus('세션 모듈을 불러오지 못했습니다. Ctrl+Shift+R로 새로고침해 주세요.');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('ended') === '1') {
    HalomathLive.saveLastRoom('', liveGameId());
    hideReopen();
    setStatus('세션이 종료되었습니다.');
    try {
      const next = new URL('index.html', window.location.href);
      if (detectLobbyMode() === 'school') next.searchParams.set('mode', 'school');
      window.history.replaceState({}, '', next.pathname + next.search);
    } catch (e) { /* ignore */ }
    return;
  }
  const code = HalomathLive.loadLastRoom(liveGameId());
  if (!code) return;
  HalomathLive.ensureHostAuth().then(() => HalomathLive.roomIsActive(code)).then(async (active) => {
    if (active) {
      showReopen(code);
      return;
    }
    try {
      await HalomathLive.deleteRoom(code, liveGameId());
    } catch (e) {
      console.warn('inactive lobby room delete failed:', e);
      HalomathLive.saveLastRoom('', liveGameId());
    }
    hideReopen();
  }).catch(() => showReopen(code));
}());
