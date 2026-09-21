// Système de fabrication/échange de ressources, au comptoir de la boutique.
// Les recettes reprennent telles quelles celles du tableau noir de référence
// (GRAINES + EAU / PLANTE = POT + TERRE + (X) / FLEUR = VERRE + EAU + (X)FLEUR) :
// (X) désigne le produit de l'étape précédente qu'on réutilise en entrée.

export const RECIPES = [
  {
    id: 'pousse',
    label: 'Graines + Eau → Pousse',
    inputs: { graines: 1, eau: 1 },
    output: { id: 'pousse', qty: 1 },
  },
  {
    id: 'plante',
    label: 'Pot + Terre + Pousse → Plante',
    inputs: { pot: 1, terre: 1, pousse: 1 },
    output: { id: 'plante', qty: 1 },
  },
  {
    id: 'bouquet',
    label: 'Verre + Eau + Plante → Bouquet',
    inputs: { verre: 1, eau: 1, plante: 1 },
    output: { id: 'bouquet', qty: 1 },
  },
];

// Achat de matières premières et vente des produits finis : sans ça, l'argent
// n'a aucun usage et le stock de départ finit par tout bloquer.
export const BUY_PRICES = { graines: 1, pot: 2, terre: 1, verre: 3 };
export const SELL_PRICES = { plante: 8, bouquet: 15 };

export const RESOURCE_LABELS = {
  graines: 'Graines',
  eau: 'Eau',
  pot: 'Pots',
  terre: 'Terre',
  verre: 'Verres',
  pousse: 'Pousses',
  plante: 'Plantes',
  bouquet: 'Bouquets',
  argent: 'Argent',
};

export function createInventory() {
  // Stock de départ volontairement réduit : de quoi tester la chaîne
  // complète une à deux fois, pas un stock illimité — l'argent gagné en
  // vendant sert ensuite à racheter des matières premières.
  const stock = { graines: 4, eau: 6, pot: 3, terre: 3, verre: 2, pousse: 0, plante: 0, bouquet: 0, argent: 20 };

  function canCraft(recipe) {
    return Object.entries(recipe.inputs).every(([id, qty]) => (stock[id] || 0) >= qty);
  }

  function craft(recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !canCraft(recipe)) return false;
    Object.entries(recipe.inputs).forEach(([id, qty]) => {
      stock[id] -= qty;
    });
    stock[recipe.output.id] = (stock[recipe.output.id] || 0) + recipe.output.qty;
    return true;
  }

  function canBuy(id) {
    return stock.argent >= (BUY_PRICES[id] || Infinity);
  }

  function buy(id) {
    if (!canBuy(id)) return false;
    stock.argent -= BUY_PRICES[id];
    stock[id] = (stock[id] || 0) + 1;
    return true;
  }

  function canSell(id) {
    return (stock[id] || 0) > 0 && SELL_PRICES[id] !== undefined;
  }

  function sell(id) {
    if (!canSell(id)) return false;
    stock[id] -= 1;
    stock.argent += SELL_PRICES[id];
    return true;
  }

  return { stock, canCraft, craft, canBuy, buy, canSell, sell };
}
