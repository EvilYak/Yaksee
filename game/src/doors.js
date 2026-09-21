import * as THREE from 'three';

// Porte coulissante façon porte de grange : elle glisse le long du mur (même
// axe que la brèche découpée dedans), déclenchée explicitement par le
// joueur (E), pas toute seule à l'approche — personne ne demande une porte
// qui s'ouvre automatiquement. Fermée, elle bloque vraiment le passage (son
// propre collider, activé/désactivé avec l'état de la porte) ; ouverte, le
// collider est levé et on passe.
const SLIDE_SPEED = 2.6;

// Ne gère que des murs dont le pan court le long de l'axe Z (les deux seuls
// cas du jeu : porte staff, porte des WC) — la porte est donc fine sur X
// (l'épaisseur du mur) et longue sur Z (la largeur du passage).
export function createSlidingDoor({ material, width, height, x, gapCenterZ, openTowardPositiveZ = true, collider }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, width), material);
  const closedZ = gapCenterZ;
  const openZ = gapCenterZ + (openTowardPositiveZ ? 1 : -1) * width * 1.3;
  mesh.position.set(x, height / 2, closedZ);

  let open = false;
  if (collider) collider.blocked = true;

  function setOpen(next) {
    open = next;
    if (collider) collider.blocked = !open;
  }

  function toggle() {
    setOpen(!open);
  }

  function update(dt) {
    const targetZ = open ? openZ : closedZ;
    const diff = targetZ - mesh.position.z;
    const step = Math.max(-SLIDE_SPEED * dt, Math.min(SLIDE_SPEED * dt, diff));
    mesh.position.z += step;
  }

  return {
    mesh,
    update,
    toggle,
    get isOpen() {
      return open;
    },
  };
}
