// Écran de fin de session ("l'après-midi terminé") : bilan + bouton pour
// recommencer. Recharger la page est le moyen le plus simple de repartir sur
// un état propre (stock, argent, minuterie) sans dupliquer l'initialisation.
export function createShiftEndScreen({ stock, shift }) {
  const el = document.getElementById('shift-end');
  const moneyEl = document.getElementById('shift-end-money');
  const servedEl = document.getElementById('shift-end-served');
  const restartBtn = document.getElementById('shift-end-restart');

  restartBtn.addEventListener('click', () => window.location.reload());

  function show() {
    moneyEl.textContent = stock.stock.argent;
    servedEl.textContent = shift.served;
    el.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return { show };
}
