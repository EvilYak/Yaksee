// Déplacement du client : il se poste d'abord devant le rayon de l'objet
// demandé (mime le choix de son article), puis rejoint un point d'attente
// près du comptoir après quelques secondes — plutôt que d'apparaître déjà
// planté au même endroit fixe dès que la commande existe.
const BROWSE_SECONDS = 2.6;
const WALK_SECONDS = 1.8;
const DEFAULT_SHELF_Z = 0.8;

export function createCustomerMovement({ npcGroup, shelfSlots, waitSpot }) {
  let phase = 'idle'; // 'idle' | 'browsing' | 'walking' | 'waiting'
  let timer = 0;
  let hadOrder = false;
  const fromPos = { x: 0, z: 0 };

  function update(dt, currentOrder) {
    if (!currentOrder) {
      hadOrder = false;
      phase = 'idle';
      return;
    }

    if (!hadOrder) {
      hadOrder = true;
      phase = 'browsing';
      timer = 0;
      const slot = shelfSlots[currentOrder.id] || { x: waitSpot.x, z: DEFAULT_SHELF_Z };
      npcGroup.position.set(slot.x, 0, slot.z);
      npcGroup.rotation.y = Math.PI / 2;
    }

    timer += dt;
    if (phase === 'browsing' && timer > BROWSE_SECONDS) {
      phase = 'walking';
      timer = 0;
      fromPos.x = npcGroup.position.x;
      fromPos.z = npcGroup.position.z;
      npcGroup.rotation.y = Math.PI * 0.65;
    }
    if (phase === 'walking') {
      const t = Math.min(1, timer / WALK_SECONDS);
      npcGroup.position.x = fromPos.x + (waitSpot.x - fromPos.x) * t;
      npcGroup.position.z = fromPos.z + (waitSpot.z - fromPos.z) * t;
      if (t >= 1) phase = 'waiting';
    }
  }

  return { update };
}
