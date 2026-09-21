export function createHud() {
  const hud = document.getElementById('hud');
  const touchUi = document.getElementById('touch-ui');
  const objectiveText = document.getElementById('objective-text');

  function show() {
    hud.classList.add('visible');
    touchUi.classList.add('visible');
  }

  function setObjective(text) {
    objectiveText.textContent = text;
  }

  return { show, setObjective };
}
