import * as THREE from 'three';

// Utilisé par tous les thèmes avec `lights: true` (backrooms, pool, kitty) :
// le plan émissif du néon plafonnier, coloré par thème via `color`.
export function makeLightStripMaterial(color = 0xfff6d8) {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
  });
}
