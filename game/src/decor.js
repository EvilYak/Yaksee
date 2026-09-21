// Achat de décoration (cadres muraux) depuis l'ordinateur de la caisse.
// Chaque achat remplit le prochain cadre vide avec un motif "magicien"
// différent (voir materials/shop.js:makeFrameMaterial) — pas de placement
// libre, juste remplir les emplacements déjà prévus dans la boutique.

export const FRAME_PRICE = 15;
export const FRAME_COUNT = 3;

export function createDecorState(stock) {
  let filled = 0;

  function canBuy() {
    return filled < FRAME_COUNT && stock.stock.argent >= FRAME_PRICE;
  }

  // Retourne l'index du cadre à remplir (0-based) ou -1 si l'achat échoue.
  function buy() {
    if (!canBuy()) return -1;
    stock.stock.argent -= FRAME_PRICE;
    const index = filled;
    filled += 1;
    return index;
  }

  return {
    canBuy,
    buy,
    get filled() {
      return filled;
    },
  };
}
