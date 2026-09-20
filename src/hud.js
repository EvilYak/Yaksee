export function createHud() {
  const hud = document.getElementById('hud');
  const timestampEl = document.getElementById('timestamp');
  const touchUi = document.getElementById('touch-ui');
  const batteryEl = document.getElementById('battery');

  let elapsed = Math.random() * 3600; // le compteur camescope ne part jamais de zéro
  let battery = 87;
  let batteryTimer = 0;

  function pad(n) {
    return String(Math.floor(n)).padStart(2, '0');
  }

  function show() {
    hud.classList.add('visible');
    touchUi.classList.add('visible');
  }

  function update(dt) {
    elapsed += dt;
    const h = Math.floor(elapsed / 3600) % 24;
    const m = Math.floor(elapsed / 60) % 60;
    const s = Math.floor(elapsed) % 60;
    const f = Math.floor((elapsed % 1) * 30);
    timestampEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;

    batteryTimer += dt;
    if (batteryTimer > 25 && battery > 5) {
      batteryTimer = 0;
      battery -= 1;
      batteryEl.textContent = `🔋 ${battery}%`;
    }
  }

  return { show, update };
}
