const ids = [
  'geometry-canvas','ce-canvas','channel-badge','display-profile-name',
  'display-profile-id','btn-edit-profile','btn-sound-toggle','hud-round',
  'hud-score','hud-highscore','hud-timer','timer-bar','tool-ruler',
  'tool-protractor','btn-reset-measure','clue-count','clue-efficiency-tag',
  'clues-tags-container','btn-sss','btn-sas','btn-asa','result-modal',
  'result-header','result-icon','result-title','result-score-badge',
  'result-subtitle','counter-example-box','ce-explanation','math-note-text',
  'btn-next-round','btn-view-initial','btn-view-counter','gameover-modal',
  'final-total-score','final-correct-count','final-perfect-count',
  'final-ce-count','new-highscore-banner','btn-restart-game','profile-modal',
  'profile-form','input-player-name','input-student-id','student-id-group',
  'btn-open-leaderboard','btn-close-leaderboard','leaderboard-modal',
  'leaderboard-tbody','btn-send-data','api-status-msg','result-locked-name',
  'result-locked-id','result-locked-id-span','opening-champ-name',
  'opening-champ-id','opening-champ-score','opening-leaderboard-tbody',
  'modal-leaderboard-tbody','gameover-leaderboard-tbody','round-scores-grid',
  'btn-toggle-opening-leaderboard','opening-leaderboard-box',
  'btn-back-portal','final-correct-count','final-perfect-count','final-ce-count',
  'btn-start-game','label-player-name'
];

ids.forEach(id => {
  if (!document.getElementById(id)) {
    const el = document.createElement(
      id === 'geometry-canvas' || id === 'ce-canvas' ? 'canvas' :
      id === 'profile-form' ? 'form' :
      id.startsWith('input-') ? 'input' :
      id.startsWith('btn-') || id.startsWith('tool-') ? 'button' :
      'div'
    );
    el.id = id;
    if (el.tagName === 'CANVAS') {
      el.width = 900; el.height = 420;
    }
    document.body.appendChild(el);
  }
});

document.querySelectorAll('*').forEach(el => {
  if (!el.classList) el.classList = { add:()=>{}, remove:()=>{}, contains:()=>false };
});
