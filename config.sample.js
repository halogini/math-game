/**
 * 할로매쓰 (HaloMath) 공개 웹 설정 템플릿
 *
 * Firebase 웹 API 키는 브라우저 SDK가 쓰는 공개 식별값입니다.
 * 비밀 서버 키·service account·관리자 비밀번호는 여기에 넣지 마세요.
 * 선생님 계정은 Firebase 콘솔 > Authentication > Users 에서 만듭니다.
 */

window.ENV = window.ENV || {
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyBiY1JBwYxtROIGFW7RUIJ4k7QZHVfNcEA",
    authDomain: "math-game-halogini.firebaseapp.com",
    databaseURL: "https://math-game-halogini-default-rtdb.firebaseio.com",
    projectId: "math-game-halogini",
    storageBucket: "math-game-halogini.firebasestorage.app",
    messagingSenderId: "42232060061",
    appId: "1:42232060061:web:ad26f83ca7d1285b3e5c74",
    measurementId: "G-F13LE342GQ"
  },
  /**
   * 세션 호스트 Firebase Auth UID (익명 계정).
   * 진행 창에서 한 번 세션을 연 뒤 Firebase 콘솔 > Authentication 에서 UID를 복사해 넣으세요.
   * 여기에 없는 호스트는 「외부 수업 세션」으로 집계됩니다.
   */
  SESSION_OWNER_HOST_UIDS: [
    // "paste-your-anonymous-host-uid-here"
  ]
};
