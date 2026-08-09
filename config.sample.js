/**
 * 할로매쓰 (HaloMath) Environment & Security Configuration Sample
 * 
 * 외부 배포 시 Firebase 설정 및 환경 변수를 소스 코드와 분리하여
 * 주입할 수 있도록 제공되는 구성 템플릿입니다.
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
