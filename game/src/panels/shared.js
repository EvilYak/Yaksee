// Petit utilitaire commun aux panneaux plein écran (caisse, poubelle,
// placard) : masquer l'indice d'interaction et relâcher le pointeur avant
// d'afficher une interface cliquable par-dessus la scène 3D.

const interactHint = document.getElementById('interact-hint');

export function prepareOpen() {
  interactHint.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
