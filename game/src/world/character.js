import * as THREE from 'three';
import { makeFabricMaterial } from '../materials/index.js';

// Personnage bas-poly façon PS1 : des prismes à peu de faces (cylindres à 6
// côtés, légèrement effilés), pas des cubes à angle droit — un membre fait
// de BoxGeometry pures se lit comme du Minecraft (voxels), pas comme un
// modèle PS1 (toujours des prismes/troncs de cône bas-poly, jamais des
// cubes).
const LIMB_SEGMENTS = 6;

function flatMat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

function toCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Visage : des traits simples dessinés au canvas (yeux, bouche, base de
// cheveux) sur la teinte de peau du personnage — un espace réservé qui se
// lit comme un visage, pas une photo réelle. Prêt à être remplacé par une
// vraie photo fournie par l'utilisateur (voir group.userData.faceMesh —
// `faceMesh.material.map = <texture PNG>`).
function makePlaceholderFaceTexture(skinHex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241f18';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = toCss(skinHex);
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.48, size * 0.3, size * 0.37, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ombre légère sous les pommettes, pour du volume sans vrai éclairage 3D.
  const shade = ctx.createRadialGradient(size / 2, size * 0.62, size * 0.05, size / 2, size * 0.62, size * 0.32);
  shade.addColorStop(0, 'rgba(0,0,0,0.12)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.48, size * 0.3, size * 0.37, 0, 0, Math.PI * 2);
  ctx.fill();

  // Yeux (amandes simples) + sourcils.
  ctx.fillStyle = '#1a140e';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(size / 2 + side * size * 0.13, size * 0.44, size * 0.045, size * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a140e';
    ctx.lineWidth = size * 0.014;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size / 2 + side * size * 0.19, size * 0.35);
    ctx.lineTo(size / 2 + side * size * 0.07, size * 0.33);
    ctx.stroke();
  });

  // Nez : un simple trait.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.47);
  ctx.lineTo(size / 2 - size * 0.02, size * 0.56);
  ctx.stroke();

  // Bouche.
  ctx.strokeStyle = '#6a3428';
  ctx.lineWidth = size * 0.022;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.66);
  ctx.quadraticCurveTo(size * 0.5, size * 0.7, size * 0.6, size * 0.66);
  ctx.stroke();

  // Base de cheveux (bande haute), pour casser la calvitie uniforme du crâne.
  ctx.fillStyle = '#20180f';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.18, size * 0.32, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Tronc de prisme (rayon en haut != rayon en bas) : un vrai bras/jambe se
// resserre vers l'extrémité, un cube non.
function limb(radiusTop, radiusBottom, height, mat) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, LIMB_SEGMENTS);
  return new THREE.Mesh(geo, mat);
}

export function buildCharacterBody({ shirtColor = 0x3a4a5a, pantsColor = 0x24242a, skinColor = 0xc9a377 } = {}) {
  const group = new THREE.Group();

  const torsoMat = makeFabricMaterial(toCss(shirtColor));
  const skinMat = flatMat(skinColor);
  const pantsMat = makeFabricMaterial(toCss(pantsColor));
  const headMat = flatMat(0x2a2620);

  // Torse en tronc de prisme : plus large aux épaules qu'à la taille.
  const torso = limb(0.24, 0.19, 0.52, torsoMat);
  torso.position.y = 1.16;
  group.add(torso);

  const neck = limb(0.06, 0.07, 0.08, skinMat);
  neck.position.y = 1.46;
  group.add(neck);

  // Crâne bas-poly (jamais une boîte) + visage en plan séparé devant, où
  // vient se "plaquer" la photo (voir group.userData.faceMesh plus bas).
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), headMat);
  head.position.y = 1.65;
  head.scale.set(1, 1.15, 0.92);
  group.add(head);
  group.userData.headMesh = head;

  const faceMat = new THREE.MeshBasicMaterial({ map: makePlaceholderFaceTexture(skinColor) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.27), faceMat);
  face.position.set(0, 1.65, 0.125);
  group.add(face);
  group.userData.faceMesh = face;

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
