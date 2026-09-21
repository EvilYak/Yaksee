import * as THREE from 'three';
import { TOOL_LABELS, attachHeldTool, createThrownProjectile, updateProjectile } from './tools.js';

const TOOL_USE_RANGE = 3.2;
const MAX_CHARGE_MS = 1100;
// Un outil jeté qui atterrit reste posé dans le monde (pas de vrai inventaire
// à récupérer au sol) — au-delà de ce nombre, le plus ancien est retiré et
// sa géométrie/son matériau libérés, pour ne pas accumuler des mesh à
// l'infini sur un service qui dure déjà plusieurs minutes.
const MAX_LANDED_TOOLS = 6;

function disposeMesh(mesh) {
  mesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// Regroupe tout ce qui touche à l'outil tenu en main : viewmodel caméra,
// visée/nettoyage au clic gauche, charge-et-lance au clic droit, et la
// petite simulation balistique des outils jetés.
export function createToolRuntime({ scene, camera, heldToolGroup, cleaning, audio, isPlayingUnpaused }) {
  const raycaster = new THREE.Raycaster();
  const SCREEN_CENTER = new THREE.Vector2(0, 0);
  const toolHint = document.getElementById('tool-hint');
  const toolHintLabel = document.getElementById('tool-hint-label');

  let heldTool = null; // null | 'balai' | 'debouchoir'
  const projectiles = []; // outils en vol (physique active)
  const landedTools = []; // outils posés au sol (mesh conservé, plus animé)
  let throwCharging = false;
  let throwChargeStart = 0;

  function setHeldTool(toolId) {
    heldTool = toolId;
    attachHeldTool(heldToolGroup, heldTool);
  }

  function aimedStain() {
    if (!heldTool) return null;
    raycaster.setFromCamera(SCREEN_CENTER, camera);
    const hits = raycaster.intersectObjects(cleaning.activeMeshes(), false);
    if (!hits.length || hits[0].distance > TOOL_USE_RANGE) return null;
    return hits[0];
  }

  function useHeldTool() {
    const hit = aimedStain();
    if (!hit) return;
    if (cleaning.clean(hit.object, heldTool)) {
      if (heldTool === 'balai') audio.sweep();
      else audio.plunge();
    }
  }

  function throwHeldTool(force) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const projectile = createThrownProjectile(heldTool, camera.position, dir, force);
    scene.add(projectile.mesh);
    projectiles.push(projectile);
    setHeldTool(null);
  }

  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousedown', (e) => {
    if (!isPlayingUnpaused() || !heldTool) return;
    if (e.button === 0) useHeldTool();
    else if (e.button === 2) {
      throwCharging = true;
      throwChargeStart = performance.now();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 2 || !throwCharging) return;
    throwCharging = false;
    const heldMs = Math.min(performance.now() - throwChargeStart, MAX_CHARGE_MS);
    throwHeldTool(heldMs / MAX_CHARGE_MS);
  });

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const settled = updateProjectile(projectiles[i], dt);
      if (!settled) continue;
      landedTools.push(projectiles[i].mesh);
      projectiles.splice(i, 1);
      audio.thud();
      if (landedTools.length > MAX_LANDED_TOOLS) {
        const oldest = landedTools.shift();
        scene.remove(oldest);
        disposeMesh(oldest);
      }
    }
  }

  function updateToolHint(paused) {
    const hit = paused ? null : aimedStain();
    if (!hit) {
      toolHint.classList.add('hidden');
      return;
    }
    toolHintLabel.textContent = heldTool === 'balai' ? 'Balayer' : 'Déboucher';
    toolHint.classList.remove('hidden');
  }

  return {
    setHeldTool,
    getHeldTool: () => heldTool,
    updateProjectiles,
    updateToolHint,
  };
}

export { TOOL_LABELS };
