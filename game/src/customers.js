import { ITEMS } from './economy.js';

// Un seul client à la fois : arrive, demande un objet (parmi ceux encore en
// stock), attend au comptoir jusqu'à être servi (ou que la journée finisse).
// Pas de PNJ en file d'attente ni de patience limitée dans cette version —
// juste la boucle demandée : un client arrive, dit ce qu'il veut, on encaisse.

const SPAWN_DELAY_MIN = 8;
const SPAWN_DELAY_MAX = 16;
const FIRST_SPAWN_DELAY = 3;

export function createCustomerManager(stock) {
  let current = null; // { id, label, price, icon }
  let nextSpawnIn = FIRST_SPAWN_DELAY;

  function update(dt) {
    if (current) return;
    nextSpawnIn -= dt;
    if (nextSpawnIn > 0) return;
    const available = ITEMS.filter((item) => stock.has(item.id));
    if (available.length > 0) {
      current = available[Math.floor(Math.random() * available.length)];
    }
    nextSpawnIn = SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
  }

  // Vend l'objet demandé et libère le client. Retourne l'objet vendu (pour
  // le son/le message) ou false si rien n'était en attente / plus de stock.
  function serve() {
    if (!current) return false;
    const sold = stock.sell(current.id);
    if (!sold) return false;
    current = null;
    return sold;
  }

  return {
    update,
    serve,
    get current() {
      return current;
    },
  };
}
