import * as THREE from 'three';

// Personnage bas-poly façon PS1 : des boîtes plates, sans lissage, plutôt
// que des formes arrondies/subdivisées — c'est le trait le plus reconnaissable
// de l'esthétique (Resident Evil / Silent Hill 1er du nom). La tête est un
// simple socle : le matériau est remplacé plus tard par une texture "tête
// libre de droit" fournie par l'utilisateur (voir group.userData.headMesh).
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

export function buildCharacterBody({ shirtColor = 0x3a4a5a, pantsColor = 0x24242a, skinColor = 0xc9a377 } = {}) {
  const group = new THREE.Group();

  const torsoMat = flatMat(shirtColor);
  const skinMat = flatMat(skinColor);
  const pantsMat = flatMat(pantsColor);
  const headMat = flatMat(0xd9c9a8);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.24), torsoMat);
  torso.position.y = 1.18;
  group.add(torso);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), skinMat);
  neck.position.y = 1.47;
  group.add(neck);

  // Socle de tête : `group.userData.headMesh.material.map = <texture>` pour
  // poser la tête libre de droit une fois choisie, sans reconstruire le reste.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.24), headMat);
  head.position.y = 1.65;
  group.add(head);
  group.userData.headMesh = head;

  const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.14);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.29, 1.02, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.29, 1.02, 0);
  group.add(rightArm);
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;

  const legGeo = new THREE.BoxGeometry(0.16, 0.56, 0.18);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.12, 0.28, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.12, 0.28, 0);
  group.add(rightLeg);
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;

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
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.32), sleeveMat);
    sleeve.position.z = -0.16;
    armGroup.add(sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), skinMat);
    hand.position.z = -0.38;
    armGroup.add(hand);
    armGroup.position.set(side * 0.16, -0.22, -0.28);
    armGroup.rotation.x = -0.15;
    armGroup.rotation.y = side * 0.12;
    return armGroup;
  }

  const left = arm(-1);
  const right = arm(1);
  group.add(left, right);
  group.userData.leftArm = left;
  group.userData.rightArm = right;
  return group;
}
