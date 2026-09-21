import * as THREE from 'three';

// Outils tenus en main : pas de modèle de main/bras (voir character.js pour
// le pourquoi), juste l'outil lui-même qui flotte en vue caméra — "si tu as
// un balai bah y'a juste le balai".

function buildBroom() {
  const g = new THREE.Group();
  const handleMat = new THREE.MeshBasicMaterial({ color: 0xc9a877 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0x7a5a2a });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.85, 6), handleMat);
  handle.position.y = 0.42;
  g.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.16, 8), headMat);
  g.add(head);
  return g;
}

function buildPlunger() {
  const g = new THREE.Group();
  const handleMat = new THREE.MeshBasicMaterial({ color: 0xc9a877 });
  const cupMat = new THREE.MeshBasicMaterial({ color: 0x8a2020 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.65, 6), handleMat);
  handle.position.y = 0.36;
  g.add(handle);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), cupMat);
  cup.rotation.x = Math.PI;
  g.add(cup);
  return g;
}

export const TOOL_BUILDERS = { balai: buildBroom, debouchoir: buildPlunger };
export const TOOL_LABELS = { balai: 'Balai', debouchoir: 'Débouche-chiotte' };

// Vue caméra de l'outil tenu, façon "arme" FPS bas-poly : décalé en bas à
// droite du champ de vision, jamais au centre.
export function attachHeldTool(cameraGroup, toolId) {
  cameraGroup.clear();
  if (!toolId || !TOOL_BUILDERS[toolId]) return;
  const tool = TOOL_BUILDERS[toolId]();
  tool.position.set(0.22, -0.32, -0.45);
  tool.rotation.set(-0.3, 0.5, 0.5);
  cameraGroup.add(tool);
}

// Un outil jeté : même géométrie, mais posé dans le monde et animé par une
// trajectoire balistique simple (pas de vrai moteur physique) jusqu'à ce
// qu'il touche le sol.
export function createThrownProjectile(toolId, originPos, direction, force) {
  const mesh = TOOL_BUILDERS[toolId]();
  mesh.position.copy(originPos);
  const velocity = direction.clone().multiplyScalar(1.5 + force * 5).add(new THREE.Vector3(0, 1.2 + force * 1.8, 0));
  return { mesh, velocity, spin: (Math.random() - 0.5) * 10 };
}

export function updateProjectile(p, dt) {
  p.velocity.y -= 9.8 * dt;
  p.mesh.position.addScaledVector(p.velocity, dt);
  p.mesh.rotation.x += p.spin * dt;
  if (p.mesh.position.y <= 0.05) {
    p.mesh.position.y = 0.05;
    p.velocity.set(0, 0, 0);
    p.spin = 0;
    return true; // posé au sol
  }
  return false;
}
