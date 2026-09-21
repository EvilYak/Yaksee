// Lance le service : le joueur doit ouvrir la boutique (retourner l'enseigne
// FERMÉ -> OUVERT à la porte) plutôt que le minuteur démarrant tout seul au
// chargement — ça laisse le temps de nettoyer avant l'arrivée des clients,
// et évite qu'un client soit déjà planté là dès l'écran de démarrage.
const FADE_MS = 460;

export function createShiftStart({ controls, shop }) {
  const fadeEl = document.getElementById('fade-overlay');
  let opening = false;
  let started = false;

  function begin() {
    if (opening || started) return;
    opening = true;
    shop.shopSign.material = shop.openSignMat;
    fadeEl.classList.add('visible');
    setTimeout(() => {
      controls.teleport(shop.counterStandPos.x, shop.counterStandPos.z, shop.counterStandYaw);
      started = true;
      setTimeout(() => fadeEl.classList.remove('visible'), 60);
    }, FADE_MS);
  }

  return {
    begin,
    get started() {
      return started;
    },
  };
}
