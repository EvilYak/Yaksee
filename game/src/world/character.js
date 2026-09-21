import * as THREE from 'three';

// Personnage bas-poly façon PS1 : des prismes à peu de faces (cylindres à 6
// côtés, légèrement effilés), pas des cubes à angle droit — un membre fait
// de BoxGeometry pures se lit comme du Minecraft (voxels), pas comme un
// modèle PS1 (toujours des prismes/troncs de cône bas-poly, jamais des
// cubes). La tête reste un socle simple : le matériau est remplacé plus
// tard par une texture "tête libre de droit" fournie par l'utilisateur
// (voir group.userData.headMesh).
const LIMB_SEGMENTS = 6;

function flatMat(color, map) {
  return new THREE.MeshStandardMaterial({ color, map: map || null, flatShading: true, roughness: 1 });
}

// Non éclairé : la lampe du joueur (PointLight qui suit la caméra) est à
// quelques centimètres des avant-bras vus en vue FPS — avec un matériau
// standard, la chute en 1/distance² les brûle en blanc. Les vues d'armes
// PS1 étaient de toute façon rendues à plat, sans réagir à l'éclairage de
// la scène : un MeshBasicMaterial est donc le bon choix, pas un compromis.
function unlitMat(color) {
  return new THREE.MeshBasicMaterial({ color });
}

// Tronc de prisme (rayon en haut != rayon en bas) : un vrai bras/jambe se
// resserre vers l'extrémité, un cube non.
function limb(radiusTop, radiusBottom, height, mat) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, LIMB_SEGMENTS);
  return new THREE.Mesh(geo, mat);
}

export function buildCharacterBody({ shirtColor = 0x3a4a5a, pantsColor = 0x24242a, skinColor = 0xc9a377 } = {}) {
  const group = new THREE.Group();

  const torsoMat = flatMat(shirtColor);
  const skinMat = flatMat(skinColor);
  const pantsMat = flatMat(pantsColor);
  const headMat = flatMat(0xd9c9a8);

  // Torse en tronc de prisme : plus large aux épaules qu'à la taille.
  const torso = limb(0.24, 0.19, 0.52, torsoMat);
  torso.position.y = 1.16;
  group.add(torso);

  const neck = limb(0.06, 0.07, 0.08, skinMat);
  neck.position.y = 1.46;
  group.add(neck);

  // Socle de tête : `group.userData.headMesh.material.map = <texture>` pour
  // poser la tête libre de droit une fois choisie, sans reconstruire le reste.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.24), headMat);
  head.position.y = 1.64;
  group.add(head);
  group.userData.headMesh = head;

  function arm(side) {
    const upper = limb(0.065, 0.058, 0.28, skinMat);
    upper.position.set(side * 0.29, 1.24, 0);
    group.add(upper);
    const lower = limb(0.058, 0.05, 0.24, skinMat);
    lower.position.set(side * 0.29, 0.98, 0.02);
    lower.rotation.x = 0.2;
    group.add(lower);
    return { upper, lower };
  }
  group.userData.leftArm = arm(-1);
  group.userData.rightArm = arm(1);

  function leg(side) {
    const thigh = limb(0.09, 0.08, 0.3, pantsMat);
    thigh.position.set(side * 0.12, 0.42, 0);
    group.add(thigh);
    const shin = limb(0.08, 0.06, 0.28, pantsMat);
    shin.position.set(side * 0.12, 0.14, 0);
    group.add(shin);
    return { thigh, shin };
  }
  group.userData.leftLeg = leg(-1);
  group.userData.rightLeg = leg(1);

  return group;
}

// Avant-bras + mains façon "vue FPS" (comme les mains d'inventaire des
// survival-horror PS1), attachées à la caméra plutôt qu'au sol — on ne voit
// jamais sa propre tête, mais on voit ses bras se balancer en marchant.
export function buildViewArms({ skinColor = 0xc9a377, sleeveColor = 0x3a4a5a } = {}) {
  const group = new THREE.Group();
  const skinMat = unlitMat(skinColor);
  const sleeveMat = unlitMat(sleeveColor);

  function arm(side) {
    const armGroup = new THREE.Group();
    const sleeve = limb(0.055, 0.07, 0.32, sleeveMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = -0.16;
    armGroup.add(sleeve);
    const hand = limb(0.04, 0.05, 0.15, skinMat);
    hand.rotation.x = Math.PI / 2;
    hand.position.z = -0.38;
    armGroup.add(hand);
    armGroup.position.set(side * 0.16, -0.22, -0.28);
    armGroup.rotation.x = -0.15;
    armGroup.rotation.y = side * 0.12;
    armGroup.rotation.z = -side * 0.1;
    return armGroup;
  }

  const left = arm(-1);
  const right = arm(1);
  group.add(left, right);
  group.userData.leftArm = left;
  group.userData.rightArm = right;
  return group;
}
