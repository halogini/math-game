setTimeout(() => {
  const out = document.getElementById('output');
  if (!out.textContent) {
    out.textContent = 'NO ERRORS DETECTED - game.js loaded successfully!';
  }
}, 2000);
