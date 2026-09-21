import * as THREE from 'three';

// Le labyrinthe entier tient dans quelques gros InstancedMesh si on ne les
// découpe pas — le moteur devrait alors redessiner toute la carte à chaque
// image, même hors champ de vision. addChunkedInstances répartit plutôt
// chaque catégorie de géométrie (murs, plinthes, joints...) en petits
// paquets spatiaux : chacun obtient son propre volume englobant, donc son
// propre frustum culling.
const CHUNK_CELLS = 8;

const dummy = new THREE.Object3D();

function groupByChunk(list, chunkWorldSize) {
  const map = new Map();
  for (const entry of list) {
    const key = `${Math.floor(entry[0] / chunkWorldSize)},${Math.floor(entry[1] / chunkWorldSize)}`;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(entry);
  }
  return map;
}

// Un même matériau répété sur toute la carte se voit immédiatement (le même
// motif de taches revient à chaque pan de mur) — quand `material` est un
// tableau de variantes, chaque chunk en tire une au hasard, mais de façon
// stable (hash de sa clé) pour ne pas changer d'une frame à l'autre.
function pickVariant(material, key) {
  if (!Array.isArray(material)) return material;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return material[Math.abs(h) % material.length];
}

// Hash déterministe (position -> [0,1)) pour tirer un décalage UV stable par
// instance : même bâtiment reconstruit = même décalage, pas de scintillement
// d'une frame à l'autre ni d'une partie à l'autre.
function hash01(x, y, salt) {
  const s = Math.sin(x * 127.1 + y * 311.7 + salt * 269.5) * 43758.5453123;
  return s - Math.floor(s);
}

// Place `list` (tableau de [px, pz, ...]) en un ou plusieurs InstancedMesh
// regroupés spatialement par chunk de CHUNK_CELLS*cellSize. `placeFn(dummy,
// entry)` positionne/oriente l'objet scratch avant chaque instance.
export function addChunkedInstances(targetGroup, list, geometry, material, placeFn, cellSize) {
  if (!list.length) return;
  const chunkWorldSize = CHUNK_CELLS * cellSize;
  groupByChunk(list, chunkWorldSize).forEach((entries, key) => {
    const mat = pickVariant(material, key);
    const uvVariation = !!(mat && mat.userData && mat.userData.uvVariation);
    // Les attributs instanciés vivent sur la géométrie : elle est partagée
    // entre tous les chunks/thèmes (voir geosFor dans world.js), donc on la
    // clone dès qu'on doit y poser un attribut propre à ce chunk précis.
    const geo = uvVariation ? geometry.clone() : geometry;
    const mesh = new THREE.InstancedMesh(geo, mat, entries.length);
    if (uvVariation) {
      const offsets = new Float32Array(entries.length * 2);
      const flips = new Float32Array(entries.length);
      entries.forEach(([px, pz], i) => {
        offsets[i * 2] = hash01(px, pz, 1.3);
        offsets[i * 2 + 1] = hash01(px, pz, 7.9);
        flips[i] = hash01(px, pz, 4.1) > 0.5 ? 1 : 0;
      });
      geo.setAttribute('instanceUvOffset', new THREE.InstancedBufferAttribute(offsets, 2));
      geo.setAttribute('instanceUvFlip', new THREE.InstancedBufferAttribute(flips, 1));
    }
    entries.forEach((entry, i) => {
      placeFn(dummy, entry);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    targetGroup.add(mesh);
  });
}
