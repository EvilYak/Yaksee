import * as THREE from 'three';

// Taches à nettoyer, apparues en cours de service ("le soir il y a des
// saletés") — une tache de saleté classique se nettoie au balai, une tache
// près des toilettes ("gros caca") se débouche/nettoie au débouche-chiotte.
// Rien qu'un décalque plat au sol : pas besoin d'une vraie simulation de
// salissure.

function buildStainMesh(type) {
  const radius = 0.16 + Math.random() * 0.08;
  const geo = new THREE.CircleGeometry(radius, 10);
  const color = type === 'poop' ? 0x2f2210 : 0x2a2418;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

// `spots`: [{ x, z, type: 'dirt' | 'poop' }]
export function createCleaningSystem(group, spots) {
  const stains = spots.map((s) => {
    const mesh = buildStainMesh(s.type);
    mesh.position.x = s.x;
    mesh.position.z = s.z;
    group.add(mesh);
    return { mesh, type: s.type, cleaned: false };
  });

  function requiredTool(type) {
    return type === 'poop' ? 'debouchoir' : 'balai';
  }

  // Nettoie la tache correspondant à `mesh` si l'outil tenu correspond.
  // Retourne true si la tache vient d'être nettoyée.
  function clean(mesh, heldTool) {
    const stain = stains.find((s) => s.mesh === mesh && !s.cleaned);
    if (!stain || requiredTool(stain.type) !== heldTool) return false;
    stain.cleaned = true;
    stain.mesh.visible = false;
    return true;
  }

  function activeMeshes() {
    return stains.filter((s) => !s.cleaned).map((s) => s.mesh);
  }

  return {
    clean,
    activeMeshes,
    total: stains.length,
    get cleanedCount() {
      return stains.filter((s) => s.cleaned).length;
    },
    get allClean() {
      return stains.every((s) => s.cleaned);
    },
  };
}
