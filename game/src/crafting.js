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

export const RESOURCE_LABELS = {
  graines: 'Graines',
  eau: 'Eau',
  pot: 'Pots',
  terre: 'Terre',
  verre: 'Verres',
  pousse: 'Pousses',
  plante: 'Plantes',
  bouquet: 'Bouquets',
};

export function createInventory() {
  // Stock de départ volontairement réduit : de quoi tester la chaîne
  // complète une à deux fois, pas un stock illimité.
  const stock = { graines: 4, eau: 6, pot: 3, terre: 3, verre: 2, pousse: 0, plante: 0, bouquet: 0 };

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

  return { stock, canCraft, craft };
}
