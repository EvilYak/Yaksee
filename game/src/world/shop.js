import * as THREE from 'three';
import {
  makeAsphaltMaterial,
  makeParkingLineMaterial,
  makeBrickMaterial,
  makeWallPaintMaterial,
  makeShopFloorMaterial,
  makeWoodMaterial,
  makeGlassMaterial,
  makeMetalMaterial,
  makeChalkboardMaterial,
  makeSignMaterial,
  makeDoorMaterial,
  makePotMaterial,
  makeFoliageMaterial,
  makeCarPaintMaterial,
  makeFrameMaterial,
} from '../materials/index.js';
import { buildCharacterBody } from './character.js';
import { ITEMS } from '../economy.js';

// Boutique de plantes : une seule scène fixe (pas de génération procédurale
// de plan comme l'ancien labyrinthe) — un petit parking, une façade vitrée,
// un comptoir/caisse, une arrière-boutique avec établi + recettes. Toutes
// les coordonnées sont en mètres, centrées sur l'entrée du magasin (x=0).

const WALL_H = 2.6;
const WALL_T = 0.2;
const DOOR_W = 1.1;
const DOOR_H = 2.05;

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

// Segment de mur plein avec, éventuellement, une brèche (porte/fenêtre) sur
// l'axe X ou Z — construit à partir de 1 à 3 boîtes plutôt que de creuser une
// forme, plus simple pour des murs rectilignes.
function wallWithGap(axis, length, height, thickness, material, gapCenter, gapWidth, gapHeight = height) {
  const group = new THREE.Group();
  const segments = [];
  if (gapWidth <= 0 || gapWidth >= length) {
    segments.push({ offset: 0, len: length });
  } else {
    const gStart = gapCenter - gapWidth / 2;
    const gEnd = gapCenter + gapWidth / 2;
    const leftLen = gStart - -length / 2;
    const rightLen = length / 2 - gEnd;
    if (leftLen > 0.01) segments.push({ offset: -length / 2 + leftLen / 2, len: leftLen });
    if (rightLen > 0.01) segments.push({ offset: gEnd + rightLen / 2, len: rightLen });
    // Linteau au-dessus de la brèche si elle ne monte pas jusqu'au plafond.
    if (gapHeight < height - 0.01) {
      const lintelH = height - gapHeight;
      const lintel = axis === 'x' ? box(gapWidth, lintelH, thickness, material) : box(thickness, lintelH, gapWidth, material);
      lintel.position.y = gapHeight + lintelH / 2;
      if (axis === 'x') lintel.position.x = gapCenter; else lintel.position.z = gapCenter;
      group.add(lintel);
    }
  }
  segments.forEach(({ offset, len }) => {
    const seg = axis === 'x' ? box(len, height, thickness, material) : box(thickness, height, len, material);
    seg.position.y = height / 2;
    if (axis === 'x') seg.position.x = offset; else seg.position.z = offset;
    group.add(seg);
  });
  return group;
}

function aabbFromBox(mesh, cx, cz) {
  const geo = mesh.geometry.parameters;
  return {
    minX: cx - geo.width / 2,
    maxX: cx + geo.width / 2,
    minZ: cz - geo.depth / 2,
    maxZ: cz + geo.depth / 2,
  };
}

function limb(rTop, rBot, h, mat, segments = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), mat);
}

function buildDoor(w, h, doorMat, cx, cz, rotY = 0) {
  const g = new THREE.Group();
  const leaf = box(w, h, 0.06, doorMat);
  leaf.position.y = h / 2;
  g.add(leaf);
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  return g;
}

// Articles de la boutique de magie, pour l'étagère et l'arrière-boutique —
// toujours des prismes/cylindres pour les formes rondes (baguette, pièces,
// chapeau), une boîte seulement pour le paquet de cartes qui en est
// réellement une.
function buildMagicProp(id, scale = 1) {
  const g = new THREE.Group();
  if (id === 'baguette') {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.6 });
    const wand = limb(0.008 * scale, 0.014 * scale, 0.26 * scale, woodMat, 6);
    wand.rotation.z = Math.PI / 2;
    wand.position.y = 0.03 * scale;
    g.add(wand);
    const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.016 * scale, 0), new THREE.MeshStandardMaterial({ color: 0xe8e0c0, roughness: 0.3 }));
    tip.position.set(0.13 * scale, 0.03 * scale, 0);
    g.add(tip);
  } else if (id === 'cartes') {
    const deck = box(0.065 * scale, 0.02 * scale, 0.09 * scale, new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.5 }));
    deck.position.y = 0.01 * scale;
    g.add(deck);
  } else if (id === 'piece') {
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const coin = limb(0.028 * scale, 0.028 * scale, 0.006 * scale, coinMat, 10);
      coin.position.y = 0.003 * scale + i * 0.007 * scale;
      g.add(coin);
    }
  } else if (id === 'chapeau') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    const brim = limb(0.11 * scale, 0.11 * scale, 0.015 * scale, hatMat, 12);
    brim.position.y = 0.008 * scale;
    g.add(brim);
    const body = limb(0.075 * scale, 0.08 * scale, 0.13 * scale, hatMat, 12);
    body.position.y = 0.08 * scale;
    g.add(body);
  }
  return g;
}

export function buildShopWorld() {
  const group = new THREE.Group();

  const asphaltMat = makeAsphaltMaterial();
  const lineMat = makeParkingLineMaterial();
  const brickMat = makeBrickMaterial();
  const wallMat = makeWallPaintMaterial('#c9a84a');
  const backWallMat = makeWallPaintMaterial('#b89a4a');
  const floorMat = makeShopFloorMaterial();
  const woodMat = makeWoodMaterial('#8a5a34');
  const counterMat = makeWoodMaterial('#6b4226');
  const glassMat = makeGlassMaterial();
  const metalMat = makeMetalMaterial();
  const chalkMat = makeChalkboardMaterial(ITEMS.map((item) => `${item.icon} ${item.label} — ${item.price} €`));
  const signMat = makeSignMaterial('THE MAGIC SHOP', { bg: '#141210', fg: '#eef0d8', fontSize: 52 });
  const staffDoorMat = makeDoorMaterial('STAFF\nONLY');
  const bathDoorMat = makeDoorMaterial('WC');
  const potMat = makePotMaterial();
  const foliageMat = makeFoliageMaterial('#3f7a3a');
  const foliageMat2 = makeFoliageMaterial('#5a8f3f');
  const carMat = makeCarPaintMaterial('#c7c2b0');
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const colliders = [];
  const addCollider = (mesh, cx, cz) => colliders.push(aabbFromBox(mesh, cx, cz));

  // ---------- Parking (z négatif = extérieur) ----------
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), asphaltMat);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0, -11);
  group.add(lot);

  for (let i = -3; i <= 3; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4), lineMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 2.6, 0.01, -14.5);
    group.add(stripe);
  }

  // Voiture garée près de l'entrée.
  const car = new THREE.Group();
  const body = box(1.8, 0.55, 4.1, carMat);
  body.position.y = 0.55;
  car.add(body);
  const cabin = box(1.5, 0.42, 2.0, carMat);
  cabin.position.set(0, 1.03, -0.2);
  car.add(cabin);
  [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]].forEach(([wx, wz]) => {
    const wheel = limb(0.32, 0.32, 0.24, tireMat, 12);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.32, wz);
    car.add(wheel);
  });
  car.position.set(4.4, 0, -7.2);
  car.rotation.y = 0.06;
  group.add(car);
  colliders.push({ minX: 3.4, maxX: 5.4, minZ: -9.4, maxZ: -5.0 });

  // Lampadaire de parking.
  function streetlight(x, z) {
    const g = new THREE.Group();
    const pole = limb(0.05, 0.06, 3.4, metalMat, 8);
    pole.position.y = 1.7;
    g.add(pole);
    const head = limb(0.09, 0.05, 0.35, metalMat, 8);
    head.position.y = 3.5;
    g.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }));
    bulb.position.y = 3.35;
    g.add(bulb);
    const light = new THREE.PointLight(0xfff2c0, 26, 14, 2);
    light.position.y = 3.3;
    g.add(light);
    g.position.set(x, 0, z);
    return g;
  }
  group.add(streetlight(-6.5, -9));
  group.add(streetlight(6, -6.5));
  colliders.push({ minX: -6.65, maxX: -6.35, minZ: -9.15, maxZ: -8.85 });
  colliders.push({ minX: 5.85, maxX: 6.15, minZ: -6.65, maxZ: -6.35 });

  // Rampe d'éclairage de façade (vitrine + enseigne), fixée juste au-dessus
  // de la porte pour que la brique et le texte de l'enseigne restent lisibles
  // même loin du halo des lampadaires.
  const facadeWash = new THREE.PointLight(0xffe9b8, 16, 11, 2);
  facadeWash.position.set(0, 3.2, -3.1);
  group.add(facadeWash);

  // Silhouettes d'arbres en fond de parking.
  const treeMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Group();
    const trunk = limb(0.12, 0.16, 1.6, treeMat, 6);
    trunk.position.y = 0.8;
    t.add(trunk);
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + Math.random() * 0.6, 0), treeMat);
    foliage.position.y = 2.4 + Math.random() * 0.6;
    t.add(foliage);
    t.position.set(-9 + Math.random() * 18, 0, -15.5 - Math.random() * 1.5);
    group.add(t);
  }

  // ---------- Enveloppe du bâtiment (réception : x -5..5, z -3.5..3.5) ----------
  const rx0 = -5, rx1 = 5, rz0 = -3.5, rz1 = 3.5;
  const frontWall = wallWithGap('x', rx1 - rx0, WALL_H, WALL_T, brickMat, 0, DOOR_W, DOOR_H);
  frontWall.position.set(0, 0, rz0);
  group.add(frontWall);
  colliders.push({ minX: rx0, maxX: -DOOR_W / 2, minZ: rz0 - WALL_T / 2, maxZ: rz0 + WALL_T / 2 });
  colliders.push({ minX: DOOR_W / 2, maxX: rx1, minZ: rz0 - WALL_T / 2, maxZ: rz0 + WALL_T / 2 });

  // Vitrines de part et d'autre de la porte.
  const glassLWidth = -DOOR_W / 2 - rx0;
  const winL = box(glassLWidth - 0.3, 1.7, 0.05, glassMat);
  winL.position.set(rx0 + glassLWidth / 2 + 0.15, 1.5, rz0 + 0.03);
  group.add(winL);
  const glassRWidth = rx1 - DOOR_W / 2;
  const winR = box(glassRWidth - 0.3, 1.7, 0.05, glassMat);
  winR.position.set(DOOR_W / 2 + glassRWidth / 2 + 0.15, 1.5, rz0 + 0.03);
  group.add(winR);

  // Enseigne + texte extérieur. Une PlaneGeometry par défaut regarde vers
  // +Z ; côté parking (z négatif) on approche par -Z, donc sans un demi-tour
  // ces panneaux montreraient leur dos — invisibles, pas juste mal cadrés.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), signMat);
  sign.position.set(0.9, WALL_H + 0.15, rz0 - WALL_T / 2 - 0.05);
  sign.rotation.y = Math.PI;
  group.add(sign);
  const tagline = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.32), makeSignMaterial("everything's an illusion.", { bg: '#5a3d33', fg: '#e8e0c0', fontSize: 24 }));
  tagline.position.set(-3, WALL_H - 0.35, rz0 - WALL_T / 2 - 0.05);
  tagline.rotation.y = Math.PI;
  group.add(tagline);

  const backWallMain = wallWithGap('x', rx1 - rx0, WALL_H, WALL_T, wallMat, 0, 0);
  backWallMain.position.set(0, 0, rz1);
  group.add(backWallMain);
  colliders.push({ minX: rx0, maxX: rx1, minZ: rz1 - WALL_T / 2, maxZ: rz1 + WALL_T / 2 });

  // Cadres muraux vides, à remplir depuis la caisse (voir decor.js) —
  // rotation.y=PI comme le tableau noir : sans ça ils regarderaient dans le
  // mur au lieu de la pièce (même piège que l'enseigne/tableau plus tôt).
  const frames = [-3, 0, 3].map((x) => {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), makeFrameMaterial());
    frame.position.set(x, 1.7, rz1 - WALL_T / 2 - 0.05);
    frame.rotation.y = Math.PI;
    group.add(frame);
    return frame;
  });

  const leftWall = wallWithGap('z', rz1 - rz0, WALL_H, WALL_T, brickMat, 0, 0);
  leftWall.position.set(rx0, 0, 0);
  group.add(leftWall);
  colliders.push({ minX: rx0 - WALL_T / 2, maxX: rx0 + WALL_T / 2, minZ: rz0, maxZ: rz1 });

  // Mur droit avec la porte vers l'arrière-boutique.
  const rightWall = wallWithGap('z', rz1 - rz0, WALL_H, WALL_T, wallMat, 0, DOOR_W, DOOR_H);
  rightWall.position.set(rx1, 0, 0);
  group.add(rightWall);
  colliders.push({ minX: rx1 - WALL_T / 2, maxX: rx1 + WALL_T / 2, minZ: rz0, maxZ: -DOOR_W / 2 });
  colliders.push({ minX: rx1 - WALL_T / 2, maxX: rx1 + WALL_T / 2, minZ: DOOR_W / 2, maxZ: rz1 });

  // Sol + plafond de la réception.
  const floor1 = new THREE.Mesh(new THREE.PlaneGeometry(rx1 - rx0, rz1 - rz0), floorMat);
  floor1.rotation.x = -Math.PI / 2;
  floor1.position.set((rx0 + rx1) / 2, 0, (rz0 + rz1) / 2);
  group.add(floor1);
  const ceil1 = new THREE.Mesh(new THREE.PlaneGeometry(rx1 - rx0, rz1 - rz0), wallMat);
  ceil1.rotation.x = Math.PI / 2;
  ceil1.position.set((rx0 + rx1) / 2, WALL_H, (rz0 + rz1) / 2);
  group.add(ceil1);

  // Plafonniers.
  [[-2, -1], [2, -1], [0, 1.8]].forEach(([x, z]) => {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }));
    fixture.position.set(x, WALL_H - 0.04, z);
    group.add(fixture);
    const light = new THREE.PointLight(0xfff6d8, 6, 7, 2);
    light.position.set(x, WALL_H - 0.3, z);
    group.add(light);
  });

  // ---------- Comptoir + caisse (côté mur droit) ----------
  const counter = box(1.1, 0.95, 2.4, counterMat);
  counter.position.set(4.3, 0.475, -1.9);
  group.add(counter);
  addCollider(counter, 4.3, -1.9);

  const register = box(0.35, 0.28, 0.3, metalMat);
  register.position.set(4.25, 0.95 + 0.14, -2.3);
  group.add(register);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ color: 0x2a4a6a, toneMapped: false }));
  screen.position.set(4.25, 1.13, -2.14);
  screen.rotation.y = Math.PI;
  group.add(screen);

  // Fleurs en vase sur le comptoir.
  for (let i = 0; i < 3; i++) {
    const vase = limb(0.05, 0.04, 0.14, potMat, 8);
    vase.position.set(4.3, 0.95 + 0.07, -1.4 + i * 0.3);
    group.add(vase);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), i % 2 === 0 ? foliageMat2 : foliageMat);
    bloom.position.set(4.3, 0.95 + 0.2, -1.4 + i * 0.3);
    group.add(bloom);
  }

  const registerPoint = { x: 4.3, z: -2.2, radius: 1.7 };

  // Radio de comptoir (décor pour l'instant — la musique viendra plus tard).
  const radio = new THREE.Group();
  const radioMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.3 });
  const radioBody = box(0.16, 0.1, 0.09, radioMat);
  radioBody.position.y = 0.95 + 0.05;
  radio.add(radioBody);
  const antenna = limb(0.004, 0.004, 0.16, metalMat, 6);
  antenna.position.set(0.06, 0.95 + 0.17, 0);
  antenna.rotation.z = 0.3;
  radio.add(antenna);
  radio.position.set(4.3, 0, -2.7);
  group.add(radio);

  // Téléphone du comptoir (appels de commande) : combiné + base, posé côté
  // client pour rester visible sans être caché par la caisse.
  const phoneBase = box(0.14, 0.05, 0.2, metalMat);
  phoneBase.position.set(4.35, 0.95 + 0.025, -0.9);
  group.add(phoneBase);
  const phoneHandset = limb(0.03, 0.03, 0.22, metalMat, 8);
  phoneHandset.rotation.z = Math.PI / 2;
  phoneHandset.position.set(4.35, 0.95 + 0.09, -0.88);
  group.add(phoneHandset);
  const phonePoint = { x: 4.35, z: -0.9, radius: 1.1 };

  // Client en attente près de l'entrée : personnage bas-poly (character.js),
  // visage encore un espace réservé — voir buildCharacterBody pour poser une
  // vraie photo plus tard (group.userData.faceMesh.material.map = ...).
  const customer = buildCharacterBody({ shirtColor: 0x8fa0a8, pantsColor: 0x24242a });
  customer.position.set(0.8, 0, -0.6);
  customer.rotation.y = Math.PI * 0.65;
  group.add(customer);
  // Rayon volontairement réduit et loin du comptoir/téléphone : les trois
  // zones d'interaction ne doivent jamais se chevaucher, sinon "E" déclenche
  // la mauvaise action selon la position exacte du joueur.
  const npc = { group: customer, position: customer.position, name: 'Client', radius: 1.4 };

  // ---------- Étagère de présentation (mur gauche) ----------
  const shelf = box(0.28, 0.05, 2.6, woodMat);
  shelf.position.set(rx0 + 0.24, 1.0, 0.8);
  group.add(shelf);
  ['baguette', 'cartes', 'piece', 'chapeau'].forEach((id, i) => {
    const prop = buildMagicProp(id, 2.2);
    prop.position.set(rx0 + 0.24, 1.025, -0.1 + i * 0.65);
    group.add(prop);
  });
  colliders.push({ minX: rx0 + 0.1, maxX: rx0 + 0.38, minZ: -0.55, maxZ: 2.15 });

  // Poubelle : jette 1 unité d'un objet en stock (comptoir déjà surchargé,
  // zone volontairement loin des autres points d'interaction).
  const trashCan = limb(0.14, 0.11, 0.32, metalMat, 10);
  trashCan.position.set(-3.5, 0.16, 1.0);
  group.add(trashCan);
  colliders.push({ minX: -3.65, maxX: -3.35, minZ: 0.85, maxZ: 1.15 });
  const trashPoint = { x: -3.5, z: 1.0, radius: 1.0 };

  // Portes décoratives (arrière-boutique visible plus loin, ici juste WC).
  const wcDoor = buildDoor(0.9, 2.0, bathDoorMat, rx0 + 0.03, -2.6, Math.PI / 2);
  group.add(wcDoor);

  // ---------- Arrière-boutique (x 5..10, z -2..2) ----------
  const bx0 = rx1, bx1 = rx1 + 5, bz0 = -2, bz1 = 2;
  const backFront = wallWithGap('z', bz1 - bz0, WALL_H, WALL_T, backWallMat, 0, 0);
  backFront.position.set(bx1, 0, 0);
  group.add(backFront);
  colliders.push({ minX: bx1 - WALL_T / 2, maxX: bx1 + WALL_T / 2, minZ: bz0, maxZ: bz1 });

  const backSide1 = wallWithGap('x', bx1 - bx0, WALL_H, WALL_T, backWallMat, 0, 0);
  backSide1.position.set((bx0 + bx1) / 2, 0, bz0);
  group.add(backSide1);
  colliders.push({ minX: bx0, maxX: bx1, minZ: bz0 - WALL_T / 2, maxZ: bz0 + WALL_T / 2 });

  const backSide2 = wallWithGap('x', bx1 - bx0, WALL_H, WALL_T, backWallMat, 0, 0);
  backSide2.position.set((bx0 + bx1) / 2, 0, bz1);
  group.add(backSide2);
  colliders.push({ minX: bx0, maxX: bx1, minZ: bz1 - WALL_T / 2, maxZ: bz1 + WALL_T / 2 });

  const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0), floorMat);
  floor2.rotation.x = -Math.PI / 2;
  floor2.position.set((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
  group.add(floor2);
  const ceil2 = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0), backWallMat);
  ceil2.rotation.x = Math.PI / 2;
  ceil2.position.set((bx0 + bx1) / 2, WALL_H, (bz0 + bz1) / 2);
  group.add(ceil2);

  const backLight = new THREE.PointLight(0xfff6d8, 5.5, 7, 2);
  backLight.position.set((bx0 + bx1) / 2, WALL_H - 0.3, 0);
  group.add(backLight);
  const backFixture = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }));
  backFixture.position.set((bx0 + bx1) / 2, WALL_H - 0.04, 0);
  group.add(backFixture);

  // Établi de stock + tableau des prix, contre le mur du fond.
  const bench = box(2.4, 0.9, 0.6, woodMat);
  bench.position.set(8.2, 0.45, bz1 - 0.35);
  group.add(bench);
  addCollider(bench, 8.2, bz1 - 0.35);

  const chalkboard = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), chalkMat);
  chalkboard.position.set(8.2, 1.75, bz1 - WALL_T / 2 - 0.05);
  chalkboard.rotation.y = Math.PI;
  group.add(chalkboard);

  // Caisse de stock de secours sur l'établi.
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 });
  const crate = box(0.32, 0.24, 0.3, crateMat);
  crate.position.set(7.2, 0.9 + 0.12, bz1 - 0.35);
  group.add(crate);
  ['piece', 'baguette'].forEach((id, i) => {
    const prop = buildMagicProp(id, 1.6);
    prop.position.set(8.7 + i * 0.22, 0.9 + 0.03, bz1 - 0.35);
    group.add(prop);
  });

  // Porte STAFF ONLY entre les deux salles.
  const staffDoorPanel = box(DOOR_W - 0.1, DOOR_H, 0.06, staffDoorMat);
  staffDoorPanel.position.set(bx0, DOOR_H / 2, 0);
  staffDoorPanel.rotation.y = Math.PI / 2;
  group.add(staffDoorPanel);

  // Placard de ménage (balai + débouche-chiotte), dans le fond de
  // l'arrière-boutique déjà réservée au personnel — assez loin du mur
  // partagé avec la réception pour que son rayon d'interaction ne
  // chevauche jamais numériquement celui de la caisse de l'autre côté.
  const closetMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.8 });
  const closet = box(0.7, 1.9, 0.4, closetMat);
  closet.position.set(7.5, 0.95, bz0 + 0.25);
  group.add(closet);
  addCollider(closet, 7.5, bz0 + 0.25);
  const closetPoint = { x: 7.5, z: bz0 + 0.9, radius: 1.0 };

  // ---------- Taches à nettoyer (réception) ----------
  const cleaningSpots = [
    { x: -1.6, z: 1.4, type: 'dirt' },
    { x: 1.2, z: 0.6, type: 'dirt' },
    { x: -0.4, z: -2.2, type: 'dirt' },
    { x: 2.6, z: 1.8, type: 'dirt' },
    { x: rx0 + 1.0, z: -2.9, type: 'poop' },
    { x: rx0 + 1.6, z: -2.9, type: 'poop' },
  ];

  const startWorldPos = new THREE.Vector3(0, 0, -9);
  const startYaw = Math.PI;

  return {
    group,
    colliders,
    registerPoint,
    phonePoint,
    trashPoint,
    closetPoint,
    npc,
    frames,
    cleaningSpots,
    startWorldPos,
    startYaw,
  };
}
