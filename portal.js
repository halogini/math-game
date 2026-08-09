/**
 * 할로매쓰 (HaloMath) Main Portal Engine & Channel Isolation Logic
 */

// Dynamic Firebase Configuration (Supports window.ENV or Default Fallback)
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBiY1JBwYxtROIGFW7RUIJ4k7QZHVfNcEA",
  authDomain: "math-game-halogini.firebaseapp.com",
  databaseURL: "https://math-game-halogini-default-rtdb.firebaseio.com",
  projectId: "math-game-halogini",
  storageBucket: "math-game-halogini.firebasestorage.app",
  messagingSenderId: "42232060061",
  appId: "1:42232060061:web:ad26f83ca7d1285b3e5c74",
  measurementId: "G-F13LE342GQ"
};

const firebaseConfig = (window.ENV && window.ENV.FIREBASE_CONFIG) ? window.ENV.FIREBASE_CONFIG : defaultFirebaseConfig;

let firebaseDb = null;
if (window.firebase) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.database();
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

// Security & Input Validation Helpers
function sanitizeInput(str, maxLen = 12) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"/]/g, '')
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------
  // Channel Mode Detection Logic (?mode=dorms vs ?mode=school)
  // ----------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const currentPath = window.location.pathname.toLowerCase();
  
  let activeMode = 'school'; // Default channel mode
  
  const modeParam = urlParams.get('mode');
  if (modeParam === 'dorms' || modeParam === 'dorems' || currentPath.includes('/dorms') || currentPath.includes('/dorems')) {
    activeMode = 'dorms';
  } else if (modeParam === 'school' || currentPath.includes('/school')) {
    activeMode = 'school';
  }

  // Persistent Player Profile Keys
  const nameStorageKey = `halomath_name_${activeMode}`;
  const idStorageKey = `halomath_id_${activeMode}`;

  let playerName = sanitizeInput(localStorage.getItem(nameStorageKey) || '', 12);
  let studentId = activeMode === 'school' ? sanitizeInput(localStorage.getItem(idStorageKey) || '', 10) : '';

  // DOM Elements
  const portalTitle = document.getElementById('portal-title');
  const portalSubtitle = document.getElementById('portal-subtitle');
  const displayProfileName = document.getElementById('display-profile-name');
  const displayProfileId = document.getElementById('display-profile-id');
  const btnEditProfile = document.getElementById('btn-edit-profile');

  const profileModal = document.getElementById('profile-modal');
  const profileForm = document.getElementById('profile-form');
  const modalTitle = document.getElementById('modal-title');
  const labelPlayerName = document.getElementById('label-player-name');
  const inputPlayerName = document.getElementById('input-player-name');
  const studentIdGroup = document.getElementById('student-id-group');
  const inputStudentId = document.getElementById('input-student-id');

  const btnPlayBingsoo = document.getElementById('btn-play-bingsoo');
  const btnPlayCongruence = document.getElementById('btn-play-congruence');
  const leaderboardTitle = document.getElementById('leaderboard-title');
  const leaderboardTableHeaderId = document.getElementById('th-header-id');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');

  // ----------------------------------------------------
  // Apply Channel Isolation UI & Branding
  // ----------------------------------------------------
  applyChannelBranding();

  function applyChannelBranding() {
    if (activeMode === 'dorms') {
      portalTitle.textContent = '🌐 할로매쓰 - dorms 수학 아케이드';
      portalSubtitle.textContent = 'dorms 회원들과 함께 즐기는 신나는 수학 미니게임 마당!';
      
      modalTitle.textContent = '🌐 도전자 닉네임 설정';
      labelPlayerName.textContent = '도전자 닉네임:';
      inputPlayerName.placeholder = '예: dorms마스터';

      // Completely Hide & Remove Student ID group for Dorems mode
      if (studentIdGroup) {
        studentIdGroup.style.display = 'none';
        inputStudentId.removeAttribute('required');
      }

      leaderboardTitle.textContent = '🏆 dorms 명예의 전당 (Top 20)';
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = 'none';
      }

      if (btnPlayBingsoo) {
        btnPlayBingsoo.href = `games/bingsoo/index.html?mode=dorms`;
      }
      if (btnPlayCongruence) {
        btnPlayCongruence.href = `games/congruence/index.html?mode=dorms`;
      }
    } else {
      // School Mode
      portalTitle.textContent = '🏫 할로매쓰 - 수학 미니게임 아케이드';
      portalSubtitle.textContent = '우리 학교 친구들과 펼치는 유쾌하고 똑똑한 수학 미니게임 대결!';

      modalTitle.textContent = '🏫 도전자 프로필 등록';
      labelPlayerName.textContent = '도전자 이름:';
      inputPlayerName.placeholder = '예: 홍길동';

      if (studentIdGroup) {
        studentIdGroup.style.display = 'flex';
        inputStudentId.setAttribute('required', 'true');
      }

      leaderboardTitle.textContent = '🏆 우리 학교 명예의 전당 (Top 20)';
      if (leaderboardTableHeaderId) {
        leaderboardTableHeaderId.style.display = '';
      }

      if (btnPlayBingsoo) {
        btnPlayBingsoo.href = `games/bingsoo/index.html?mode=school`;
      }
      if (btnPlayCongruence) {
        btnPlayCongruence.href = `games/congruence/index.html?mode=school`;
      }
    }

    updateProfileDisplay();
  }

  function updateProfileDisplay() {
    if (playerName) {
      displayProfileName.textContent = playerName;
      if (activeMode === 'school') {
        displayProfileId.textContent = studentId ? `학번: ${studentId}` : '학번: 미입력';
        displayProfileId.style.display = '';
      } else {
        displayProfileId.style.display = 'none';
      }
    } else {
      displayProfileName.textContent = '도전자 미등록';
      displayProfileId.textContent = '클릭하여 프로필 설정';
    }
  }

  // Check Profile Registration
  if (!playerName || (activeMode === 'school' && !studentId)) {
    profileModal.classList.remove('hidden');
  }

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
      inputPlayerName.value = playerName;
      if (activeMode === 'school') {
        inputStudentId.value = studentId;
      }
      profileModal.classList.remove('hidden');
    });
  }

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cleanName = sanitizeInput(inputPlayerName.value, 12);
    
    if (!cleanName) {
      alert('닉네임/이름을 올바르게 입력해 주세요.');
      return;
    }

    if (activeMode === 'school') {
      const cleanId = sanitizeInput(inputStudentId.value, 10);
      if (!cleanId || !/^[a-zA-Z0-9가-힣\-]+$/.test(cleanId)) {
        alert('학번은 1자 이상 10자 이하의 영문, 숫자, 한글로 입력해 주세요.');
        return;
      }
      studentId = cleanId;
      localStorage.setItem(idStorageKey, studentId);
    }

    playerName = cleanName;
    localStorage.setItem(nameStorageKey, playerName);

    updateProfileDisplay();
    profileModal.classList.add('hidden');
  });

  // ----------------------------------------------------
  // Channel Isolated Leaderboard Listener
  // ----------------------------------------------------
  listenRealtimeLeaderboard();

  function listenRealtimeLeaderboard() {
    if (!firebaseDb) return;

    firebaseDb.ref('scores').orderByChild('score').limitToLast(100).on('value', (snapshot) => {
      const list = [];
      snapshot.forEach(childSnap => {
        const val = childSnap.val();
        if (val) {
          const valStudentId = sanitizeInput(val.studentId || '', 10);
          const isDormsEntry = (valStudentId === 'DORMS' || valStudentId === 'DOREMS' || val.channel === 'dorms' || val.channel === 'dorems');

          if (activeMode === 'dorms' && isDormsEntry) {
            list.push({
              name: sanitizeInput(val.name, 12),
              studentId: '',
              score: Math.max(0, Math.min(500, parseInt(val.score, 10) || 0))
            });
          } else if (activeMode === 'school' && !isDormsEntry) {
            list.push({
              name: sanitizeInput(val.name, 12),
              studentId: valStudentId,
              score: Math.max(0, Math.min(500, parseInt(val.score, 10) || 0))
            });
          }
        }
      });
      list.reverse();
      renderLeaderboardTable(list.slice(0, 20));
    }, (err) => {
      console.error("Leaderboard fetch error:", err);
    });
  }

  function renderLeaderboardTable(list) {
    if (!leaderboardTbody) return;
    leaderboardTbody.innerHTML = '';

    const colSpan = activeMode === 'school' ? 4 : 3;

    if (!list || list.length === 0) {
      leaderboardTbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:16px; text-align:center; color:#64748b;">아직 등록된 기록이 없습니다. 첫 번째 챔피언이 되어 보세요!</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      let rankDisplay = `${index + 1}위`;
      if (index === 0) rankDisplay = `🥇 1위`;
      else if (index === 1) rankDisplay = `🥈 2위`;
      else if (index === 2) rankDisplay = `🥉 3위`;

      let idTd = '';
      if (activeMode === 'school') {
        idTd = `<td>${escapeHtml(item.studentId || '미입력')}</td>`;
      }

      tr.innerHTML = `
        <td class="rank-${index + 1}">${rankDisplay}</td>
        <td>${escapeHtml(item.name || '익명')}</td>
        ${idTd}
        <td><strong>${item.score}점</strong></td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }
});
