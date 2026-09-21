import * as THREE from 'three';

// Porte coulissante façon porte de grange : elle glisse le long du mur (même
// axe que la brèche découpée dedans) quand le joueur s'approche, plutôt
// qu'un pivot à gonds — beaucoup plus simple à positionner sans jamais
// laisser un "trou" visible, et ça se lit très bien pour une porte de
// service. Le passage lui-même n'a pas de collider (comme avant) : seule la
// brèche dans le mur compte pour la collision, la porte n'est qu'un habillage
// qui se pousse hors du passage.
const OPEN_RADIUS = 1.9;
const SLIDE_SPEED = 2.2;

// Ne gère que des murs dont le pan court le long de l'axe Z (les deux seuls
// cas du jeu : porte staff, porte des WC) — la porte est donc fine sur X
// (l'épaisseur du mur) et longue sur Z (la largeur du passage).
export function createSlidingDoor({ material, width, height, x, gapCenterZ, openTowardPositiveZ = true }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, width), material);
  const closedZ = gapCenterZ;
  const openZ = gapCenterZ + (openTowardPositiveZ ? 1 : -1) * width * 1.3;
  mesh.position.set(x, height / 2, closedZ);

  function update(dt, playerPos) {
    const dist = Math.hypot(playerPos.x - x, playerPos.z - gapCenterZ);
    const targetZ = dist < OPEN_RADIUS ? openZ : closedZ;
    const diff = targetZ - mesh.position.z;
    const step = Math.max(-SLIDE_SPEED * dt, Math.min(SLIDE_SPEED * dt, diff));
    mesh.position.z += step;
  }

  return { mesh, update };
}
