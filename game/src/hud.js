export function createHud() {
  const hud = document.getElementById('hud');
  const touchUi = document.getElementById('touch-ui');
  const objectiveText = document.getElementById('objective-text');
  const objectiveSub = document.getElementById('objective-sub');

  function show() {
    hud.classList.add('visible');
    touchUi.classList.add('visible');
  }

  function setObjective(text, sub = null) {
    objectiveText.textContent = text;
    if (sub) {
      objectiveSub.textContent = sub;
      objectiveSub.classList.remove('hidden');
    } else {
      objectiveSub.classList.add('hidden');
    }
  }

  return { show, setObjective };
}
