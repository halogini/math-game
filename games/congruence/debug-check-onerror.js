window.onerror = function(msg, src, line, col, err) {
  document.getElementById('output').textContent +=
    'ERROR at line ' + line + ': ' + msg + '\n' + (err ? err.stack : '') + '\n\n';
  return true;
};
