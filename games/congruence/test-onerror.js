window.onerror = function(msg, url, line, col, error) {
  document.body.appendChild(document.createTextNode(msg + ' at ' + line + ':' + col));
};
