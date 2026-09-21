// Catalogue de la boutique de magie + stock. Pas de fabrication cette fois :
// on vend des objets déjà prêts (baguette, cartes, pièce, chapeau) contre de
// l'argent, à des clients qui arrivent au comptoir (voir customers.js).

export const ITEMS = [
  { id: 'baguette', label: 'Baguette magique', article: 'une', price: 12, icon: '🪄' },
  { id: 'cartes', label: 'Paquet de cartes', article: 'un', price: 8, icon: '🃏' },
  { id: 'piece', label: 'Pièce magique', article: 'une', price: 5, icon: '🪙' },
  { id: 'chapeau', label: 'Chapeau magique', article: 'un', price: 20, icon: '🎩' },
];

export function findItem(id) {
  return ITEMS.find((item) => item.id === id);
}

export function createStock() {
  // Stock de départ volontairement limité (pas de réassort cette version) :
  // gérer ce qu'il reste fait partie du jeu.
  const stock = { baguette: 6, cartes: 6, piece: 8, chapeau: 4, argent: 0 };

  function has(id) {
    return (stock[id] || 0) > 0;
  }

  function take(id) {
    if (!has(id)) return false;
    stock[id] -= 1;
    return true;
  }

  function discard(id) {
    return take(id);
  }

  function sell(id) {
    const item = findItem(id);
    if (!item || !take(id)) return false;
    stock.argent += item.price;
    return item;
  }

  return { stock, has, take, discard, sell };
}
