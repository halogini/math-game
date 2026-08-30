/**
 * 할로매쓰 (HaloMath) 공개 웹 설정 템플릿
 *
 * Firebase 웹 API 키는 브라우저 SDK가 쓰는 공개 식별값입니다.
 * 비밀 서버 키·service account 는 여기에 넣지 마세요.
 * 실제 데이터 보호는 Firebase 보안 규칙으로 합니다.
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
  }
};
