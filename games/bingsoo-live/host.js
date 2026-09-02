function playUrl(code) {
  return `../bingsoo/index.html?live=1&room=${encodeURIComponent(code)}`;
}

function absolutePlayUrl(code) {
  try {
    return new URL(playUrl(code), window.location.href).href;
  } catch (e) {
    return playUrl(code);
  }
}

let currentRoomCode = '';
let hostCreatedAt = 0;
let hostUid = '';
let autoEndArmed = true;
let lastLiveList = [];
let pollTimer = null;
let qrPopoutWindow = null;
let qrPipWindow = null;

function qrImageUrl(playHref, size) {
  const s = size || 220;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&ecc=M&data=${encodeURIComponent(playHref)}`;
}

function canUseQrPip() {
  return !!(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function');
}

function fillQrPipDocument(pipWindow, code, playHref) {
  const doc = pipWindow.document;
  doc.title = `QR · ${code}`;
  doc.head.innerHTML = '';
  doc.body.innerHTML = '';
  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Pretendard', system-ui, sans-serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .qr-pip-card { text-align: center; padding: 12px; }
    .qr-pip-label { margin: 0; font-size: 0.8rem; font-weight: 700; color: #0369a1; }
    .qr-pip-code { margin: 4px 0 10px; font-size: 1.6rem; font-weight: 800; letter-spacing: 0.15em; color: #0f172a; }
    .qr-pip-img { display: block; width: 220px; height: 220px; margin: 0 auto; }
    .qr-pip-hint { margin: 10px 0 0; font-size: 0.78rem; color: #64748b; line-height: 1.4; }
  `;
  doc.head.appendChild(style);

  const card = doc.createElement('div');
  card.className = 'qr-pip-card';

  const label = doc.createElement('p');
  label.className = 'qr-pip-label';
  label.textContent = '세션 코드';

  const codeEl = doc.createElement('p');
  codeEl.className = 'qr-pip-code';
  codeEl.textContent = code;

  const img = doc.createElement('img');
  img.className = 'qr-pip-img';
  img.alt = '학생용 입장 QR';
  img.width = 220;
  img.height = 220;
  img.src = qrImageUrl(playHref, 220);

  const hint = doc.createElement('p');
  hint.className = 'qr-pip-hint';
  hint.textContent = '학생이 카메라로 찍으세요';

  card.append(label, codeEl, img, hint);
  doc.body.appendChild(card);
}

async function openQrPip(code, playHref) {
  if (!canUseQrPip()) return false;
  try {
    if (qrPipWindow && !qrPipWindow.closed) {
      fillQrPipDocument(qrPipWindow, code, playHref);
      return true;
    }
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 280,
      height: 380
    });
    qrPipWindow = pipWindow;
    fillQrPipDocument(pipWindow, code, playHref);
    pipWindow.addEventListener('pagehide', () => {
      qrPipWindow = null;
    });
    return true;
  } catch (err) {
    console.warn('QR PiP failed:', err);
    return false;
  }
}

function closeQrPip() {
  try {
    if (qrPipWindow && !qrPipWindow.closed) qrPipWindow.close();
  } catch (e) { /* ignore */ }
  qrPipWindow = null;
}

function closeAllQrWindows() {
  closeQrPopout();
  closeQrPip();
}

function qrPopoutUrl(code) {
  return new URL(`qr-popout.html?room=${encodeURIComponent(code)}`, window.location.href).href;
}

function openQrPopout(code) {
  const url = qrPopoutUrl(code);
  const features = 'width=320,height=440,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
  if (qrPopoutWindow && !qrPopoutWindow.closed) {
    try {
      qrPopoutWindow.location.href = url;
      qrPopoutWindow.focus();
      return true;
    } catch (e) { /* fall through */ }
  }
  qrPopoutWindow = window.open(url, 'halomath-bingsoo-qr', features);
  if (qrPopoutWindow) {
    try { qrPopoutWindow.focus(); } catch (e) { /* ignore */ }
    return true;
  }
  return false;
}

function closeQrPopout() {
  try {
    if (qrPopoutWindow && !qrPopoutWindow.closed) qrPopoutWindow.close();
  } catch (e) { /* ignore */ }
  try {
    const w = window.open('', 'halomath-bingsoo-qr');
    if (w) w.close();
  } catch (e) { /* ignore */ }
  qrPopoutWindow = null;
}

function setStudentQr(url) {
  const img = document.getElementById('host-qr');
  if (!img) return;
  if (!url) {
    img.removeAttribute('src');
    img.alt = '학생용 입장 QR';
    return;
  }
  img.alt = `학생용 입장 QR · ${url}`;
  img.src = qrImageUrl(url, 220);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function renderLiveRows(data) {
  const tbody = document.getElementById('live-tbody');
  const countEl = document.getElementById('player-count');
  if (!tbody) return;
  lastLiveList = HalomathLive.collectLiveList(data);
  if (countEl) {
    countEl.textContent = lastLiveList.length
      ? `${lastLiveList.length}명 참여`
      : '0명 참여';
  }
  if (!lastLiveList.length) {
    tbody.innerHTML = '<tr class="live-host-empty-row"><td colspan="3">아직 기록이 없습니다. 학생이 입장하면 여기에 표시됩니다.</td></tr>';
    return;
  }
  tbody.innerHTML = lastLiveList.map((item, i) => {
    const rank = i === 0 ? '🥇 1위' : i === 1 ? '🥈 2위' : i === 2 ? '🥉 3위' : `${i + 1}위`;
    const rowClass = i < 3 ? ` class="live-host-rank-top live-host-rank-${i + 1}"` : '';
    return `<tr${rowClass}><td>${rank}</td><td>${escapeHtml(item.name)}</td><td><strong>${item.score}점</strong></td></tr>`;
  }).join('');
}

function listenLiveBoard(code) {
  if (!window.HalomathLive) return;
  if (pollTimer) clearInterval(pollTimer);
  const refresh = () => {
    HalomathLive.refreshHostAuth().catch(() => {});
    HalomathLive.getPlayers(code)
      .then(renderLiveRows)
      .catch((err) => console.warn('live board refresh failed:', err));
  };
  refresh();
  pollTimer = setInterval(refresh, 3000);
}

function returnToLobby() {
  if (window.HalomathLive) HalomathLive.returnToLobby(window);
  else window.location.replace('index.html?ended=1');
}

function bindHost(code) {
  currentRoomCode = code;
  document.title = `🍧 세션 ${code} | 할로매쓰`;
  const codeEl = document.getElementById('host-code');
  const badgeEl = document.getElementById('host-code-badge');
  const linkEl = document.getElementById('host-link');
  const playBtn = document.getElementById('btn-host-play');
  const playHref = absolutePlayUrl(code);
  if (codeEl) codeEl.textContent = code;
  if (badgeEl) badgeEl.textContent = code;
  if (linkEl) linkEl.value = playHref;
  if (playBtn) playBtn.href = playUrl(code);
  setStudentQr(playHref);
  HalomathLive.saveLastRoom(code);
  listenLiveBoard(code);
}

function disarmAutoEnd() {
  autoEndArmed = false;
}

function leaveHostIfClosing(event) {
  if (!autoEndArmed || !currentRoomCode || !window.HalomathLive) return;
  if (event && event.persisted) return;
  autoEndArmed = false;
  closeAllQrWindows();
  HalomathLive.leaveHostWindow(currentRoomCode, hostCreatedAt, hostUid);
}

window.addEventListener('pagehide', leaveHostIfClosing);
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !currentRoomCode || !window.HalomathLive) return;
  autoEndArmed = true;
  HalomathLive.markHostOpen(currentRoomCode, hostCreatedAt, hostUid).catch(() => {});
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'r')) {
    autoEndArmed = false;
  }
});

async function sweepExpiredRoom(code) {
  const status = document.getElementById('host-status');
  if (!window.HalomathLive) return false;
  try {
    const meta = await HalomathLive.getMeta(code);
    if (!meta) {
      if (status) status.textContent = '이 세션은 이미 종료되었습니다.';
      HalomathLive.saveLastRoom('');
      return true;
    }
    if (!HalomathLive.isExpired(meta.createdAt)) return false;
    const expiredList = HalomathLive.collectLiveList(await HalomathLive.getPlayers(code));
    if (expiredList.length) {
      const saveFile = window.confirm('이 세션 기록을 삭제합니다.\n순위를 파일로 저장할까요?');
      if (saveFile) HalomathLive.downloadLiveRanks(code, expiredList);
    }
    await HalomathLive.deleteRoom(code);
    if (status) status.textContent = '이 세션 기록을 삭제했습니다.';
    return true;
  } catch (err) {
    console.warn('expired session cleanup failed:', err);
    return false;
  }
}

document.getElementById('btn-end-session').addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const status = document.getElementById('host-status');
  const btn = document.getElementById('btn-end-session');
  const code = currentRoomCode;

  if (!code) {
    if (status) status.textContent = '세션 코드가 없습니다. 시작 화면으로 돌아갑니다.';
    returnToLobby();
    return;
  }
  if (!window.HalomathLive) {
    window.alert('세션 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    return;
  }

  try {
    const shouldLeave = await HalomathLive.promptEndRoom(code);
    if (!shouldLeave) return;
  } catch (err) {
    console.warn(err);
    HalomathLive.saveLastRoom('');
  }

  disarmAutoEnd();

  if (pollTimer) clearInterval(pollTimer);
  if (btn) btn.disabled = true;
  closeAllQrWindows();
  returnToLobby();
  HalomathLive.deleteRoom(code).catch((err) => console.warn('live room delete failed:', err));
});

document.getElementById('btn-save-ranks').addEventListener('click', () => {
  const status = document.getElementById('host-status');
  if (!lastLiveList.length) {
    if (status) status.textContent = '저장할 순위가 아직 없습니다.';
    return;
  }
  HalomathLive.downloadLiveRanks(currentRoomCode, lastLiveList);
  if (status) status.textContent = '순위 CSV를 이 컴퓨터에 저장했습니다.';
});

document.getElementById('btn-copy-link').addEventListener('click', async () => {
  const linkEl = document.getElementById('host-link');
  const btn = document.getElementById('btn-copy-link');
  const status = document.getElementById('host-status');
  if (!linkEl || !linkEl.value) return;
  try {
    await navigator.clipboard.writeText(linkEl.value);
  } catch (e) {
    linkEl.select();
    document.execCommand('copy');
  }
  if (btn) {
    const prev = btn.textContent;
    btn.textContent = '복사됨!';
    setTimeout(() => { btn.textContent = prev; }, 1500);
  }
  if (status) status.textContent = '입장 링크를 복사했습니다.';
});

document.getElementById('btn-qr-pip').addEventListener('click', async () => {
  const status = document.getElementById('host-status');
  if (!currentRoomCode) return;
  const playHref = absolutePlayUrl(currentRoomCode);
  const opened = await openQrPip(currentRoomCode, playHref);
  if (status) {
    status.textContent = opened
      ? 'QR 미니 창을 열었습니다. 다른 창 위에 떠 있습니다.'
      : '미니 창을 열지 못했습니다. 크롬·엣지에서 다시 시도해 주세요.';
  }
});

document.getElementById('btn-qr-popout').addEventListener('click', () => {
  const status = document.getElementById('host-status');
  if (!currentRoomCode) return;
  const opened = openQrPopout(currentRoomCode);
  if (status) {
    status.textContent = opened
      ? 'QR 작은 창을 열었습니다. 화면 구석에 두고 쓰세요.'
      : '팝업이 막혔습니다. 주소창에서 팝업을 허용해 주세요.';
  }
});

(async function startHost() {
  const status = document.getElementById('host-status');
  if (!window.HalomathLive) {
    if (status) status.textContent = '세션 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const code = HalomathLive.normalizeCode(params.get('room') || '');
  if (!code) {
    if (status) status.textContent = '세션 코드가 없습니다. 시작 화면에서 세션을 열어 주세요.';
    return;
  }
  try {
    await HalomathLive.ensureHostAuth();
  } catch (err) {
    if (status) status.textContent = HalomathLive.hostAuthErrorMessage(err);
    return;
  }
  bindHost(code);
  const pipBtn = document.getElementById('btn-qr-pip');
  const pipNote = document.getElementById('qr-popout-note');
  if (pipBtn) pipBtn.hidden = !canUseQrPip();
  if (pipNote && !canUseQrPip()) {
    pipNote.textContent = '프로젝터에 QR이 작게 보이면 「작은 창」을 화면 구석에 두세요.';
  }
  try {
    const meta = await HalomathLive.getMeta(code);
    if (!meta) {
      if (status) status.textContent = '이 세션은 이미 종료되었습니다.';
      HalomathLive.saveLastRoom('');
      return;
    }
    hostCreatedAt = Number(meta.createdAt) || Date.now();
    hostUid = String(meta.hostUid || '');
    const expired = await sweepExpiredRoom(code);
    if (expired) return;
    await HalomathLive.markHostOpen(code, hostCreatedAt, hostUid);
  } catch (err) {
    console.warn('host session restore failed:', err);
  }
  if (status) status.textContent = '';
}());
