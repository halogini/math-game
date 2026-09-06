window.onerror = function(msg, url, line, col, err) {
  document.getElementById('log').textContent += `Error: ${msg}\nLine: ${line}, Col: ${col}\n\n`;
  return true;
};
