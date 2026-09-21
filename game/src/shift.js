// Minuterie de la session ("l'après-midi") : le jeu tourne un temps fixe
// puis s'arrête net avec un bilan, plutôt qu'à durée indéfinie.

const SHIFT_SECONDS = 5 * 60;

export function createShift(durationSeconds = SHIFT_SECONDS) {
  let remaining = durationSeconds;
  let ended = false;
  let served = 0;

  function update(dt) {
    if (ended) return;
    remaining = Math.max(0, remaining - dt);
    if (remaining <= 0) ended = true;
  }

  function recordSale() {
    served += 1;
  }

  function formatted() {
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return {
    update,
    recordSale,
    formatted,
    get remaining() {
      return remaining;
    },
    get ended() {
      return ended;
    },
    get served() {
      return served;
    },
  };
}
