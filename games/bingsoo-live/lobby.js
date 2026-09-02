function hostUrl(code) {
  return new URL(`host.html?room=${encodeURIComponent(code)}`, window.location.href).href;
}

function qrPopoutUrl(code) {
  return new URL(`qr-popout.html?room=${encodeURIComponent(code)}`, window.location.href).href;
}

function openQrPopout(code) {
  const features = 'width=320,height=440,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
  const opened = window.open(qrPopoutUrl(code), 'halomath-bingsoo-qr', features);
  if (opened) {
    try { opened.focus(); } catch (e) { /* ignore */ }
  }
  return opened;
}

function openHostWindow(code) {
  const url = hostUrl(code);
  const opened = window.open(url, 'halomath-bingsoo-session');
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
    let existing = HalomathLive.loadLastRoom();
    if (existing && !(await HalomathLive.roomIsActive(existing))) {
      HalomathLive.saveLastRoom('');
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
      const shouldEnd = await HalomathLive.promptEndRoom(existing);
      if (!shouldEnd) {
        setStatus('이전 세션을 그대로 둡니다.');
        return;
      }
      await HalomathLive.deleteRoom(existing);
      hideReopen();
    }

    const code = HalomathLive.randomCode();
    setStatus(`세션 ${code} 만드는 중…`);
    await HalomathLive.createRoom(code);
    HalomathLive.saveLastRoom(code);
    showReopen(code);

    const popped = openHostWindow(code);
    setStatus(popped
      ? `세션 ${code} 창을 열었습니다.`
      : `세션 ${code}으로 이동했습니다. (팝업이 막혀 같은 탭에서 열림)`);
  } catch (err) {
    console.warn(err);
    const detail = err && (err.code || err.message) ? ` (${err.code || err.message})` : '';
    setStatus(`세션을 열 수 없습니다.${detail} Firebase 콘솔에서 liveRooms 규칙을 Publish했는지 확인해 주세요.`);
  } finally {
    setBusy(false);
  }
});

document.getElementById('btn-reopen').addEventListener('click', () => {
  const code = window.HalomathLive ? HalomathLive.loadLastRoom() : '';
  if (!code) {
    hideReopen();
    return;
  }
  openHostWindow(code);
  setStatus('진행 중 세션 창을 열었습니다.');
});

window.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'halomath-live-ended') return;
  if (e.origin !== window.location.origin && e.origin !== 'null') return;
  if (window.HalomathLive) HalomathLive.saveLastRoom('');
  hideReopen();
  setStatus('세션이 종료되었습니다.');
});

window.addEventListener('storage', (e) => {
  if (!window.HalomathLive) return;
  if (e.key && e.key !== HalomathLive.LAST_ROOM_KEY) return;
  const code = HalomathLive.loadLastRoom();
  if (code) showReopen(code);
  else hideReopen();
});

(function initLobby() {
  if (!window.HalomathLive) {
    setStatus('세션 모듈을 불러오지 못했습니다. Ctrl+Shift+R로 새로고침해 주세요.');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('ended') === '1') {
    HalomathLive.saveLastRoom('');
    hideReopen();
    setStatus('세션이 종료되었습니다.');
    try {
      window.history.replaceState({}, '', 'index.html');
    } catch (e) { /* ignore */ }
    return;
  }
  const code = HalomathLive.loadLastRoom();
  if (code) showReopen(code);
}());
