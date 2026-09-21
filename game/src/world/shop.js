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
  makeBarkMaterial,
  makeNightSkyMaterial,
} from '../materials/index.js';
import { buildCharacterBody } from './character.js';
import { createSlidingDoor } from '../doors.js';
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

// Articles de la boutique de magie, pour l'étagère et l'arrière-boutique —
// toujours des prismes/cylindres pour les formes rondes (baguette, pièces,
// chapeau), une boîte seulement pour le paquet de cartes qui en est
// réellement une.
// Dos de carte à jouer : bordure + losange central, pour qu'un paquet se
// reconnaisse comme un paquet de cartes et pas comme une boîte rouge unie.
function makeCardBackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a1c1c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#d9c48a';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 56, 56);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(54, 32);
  ctx.lineTo(32, 54);
  ctx.lineTo(10, 32);
  ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMagicProp(id, scale = 1) {
  const g = new THREE.Group();
  if (id === 'baguette') {
    // Poignée (bois sombre + anneaux de prise) + virole en laiton + fût
    // effilé (bois clair) + pointe + gemme — assemblés le long de Y puis
    // couchés sur X, plutôt qu'un unique bâton sans articulation.
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.65 });
    const paleWood = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.55 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.75 });
    const gemMat = new THREE.MeshStandardMaterial({ color: 0xe8e0c0, roughness: 0.25 });

    const rod = new THREE.Group();
    let y = 0;

    const handleH = 0.07 * scale;
    const handle = limb(0.013 * scale, 0.011 * scale, handleH, darkWood, 6);
    handle.position.y = y + handleH / 2;
    rod.add(handle);
    for (let i = 0; i < 2; i++) {
      const ring = limb(0.0145 * scale, 0.0145 * scale, 0.006 * scale, darkWood, 6);
      ring.position.y = y + handleH * (0.3 + i * 0.4);
      rod.add(ring);
    }
    y += handleH;

    const ferruleH = 0.012 * scale;
    const ferrule = limb(0.0115 * scale, 0.0115 * scale, ferruleH, brassMat, 8);
    ferrule.position.y = y + ferruleH / 2;
    rod.add(ferrule);
    y += ferruleH;

    const shaftH = 0.15 * scale;
    const shaft = limb(0.008 * scale, 0.0105 * scale, shaftH, paleWood, 6);
    shaft.position.y = y + shaftH / 2;
    rod.add(shaft);
    y += shaftH;

    const tipH = 0.02 * scale;
    const tip = limb(0.001 * scale, 0.009 * scale, tipH, paleWood, 6);
    tip.position.y = y + tipH / 2;
    rod.add(tip);
    y += tipH;

    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012 * scale, 0), gemMat);
    gem.position.y = y;
    rod.add(gem);

    // Couché le long de Z (parallèle à l'étagère/au mur), pas le long de X :
    // sans ça la baguette pointe droit vers/depuis le mur et ne se voit
    // presque pas de face — juste un point sombre, pas un objet reconnaissable.
    rod.position.y = -y / 2;
    rod.rotation.x = Math.PI / 2;
    g.add(rod);
  } else if (id === 'cartes') {
    // Petit paquet légèrement éventé : plusieurs cartes fines empilées avec
    // un décalage aléatoire, la carte du dessus portant le motif du dos —
    // plus une simple boîte rouge unie.
    const backMat = new THREE.MeshStandardMaterial({ map: makeCardBackTexture(), roughness: 0.5 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe4dcc4, roughness: 0.6 });
    const cardW = 0.062 * scale;
    const cardD = 0.088 * scale;
    const cardH = 0.0022 * scale;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const card = box(cardW, cardH, cardD, i === count - 1 ? backMat : edgeMat);
      card.position.set((Math.random() - 0.5) * 0.004 * scale, i * cardH, (Math.random() - 0.5) * 0.004 * scale);
      card.rotation.y = (Math.random() - 0.5) * 0.18;
      g.add(card);
    }
  } else if (id === 'piece') {
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const coin = limb(0.028 * scale, 0.028 * scale, 0.006 * scale, coinMat, 10);
      coin.position.y = 0.003 * scale + i * 0.007 * scale;
      coin.rotation.y = Math.random() * Math.PI;
      g.add(coin);
    }
  } else if (id === 'chapeau') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x5a1418, roughness: 0.5 });
    const brim = limb(0.11 * scale, 0.11 * scale, 0.015 * scale, hatMat, 12);
    brim.position.y = 0.008 * scale;
    g.add(brim);
    const body = limb(0.075 * scale, 0.08 * scale, 0.13 * scale, hatMat, 12);
    body.position.y = 0.08 * scale;
    g.add(body);
    // Ruban à la base de la calotte, pour casser le noir uniforme.
    const band = limb(0.081 * scale, 0.081 * scale, 0.022 * scale, bandMat, 12);
    band.position.y = 0.028 * scale;
    g.add(band);
  }
  return g;
}

// Poubelle : corps fuselé facetté + bourrelet de renfort + rebord + couvercle
// entrouvert avec anse — plusieurs pièces assemblées, plutôt qu'un unique
// tronc de cône sans détail.
function buildTrashCan(bodyMat) {
  const g = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8b8bc, roughness: 0.35, metalness: 0.6 });

  const body = limb(0.16, 0.125, 0.34, bodyMat, 8);
  body.position.y = 0.17;
  g.add(body);

  const ridge = limb(0.158, 0.158, 0.02, bodyMat, 8);
  ridge.position.y = 0.17;
  g.add(ridge);

  const rim = limb(0.17, 0.16, 0.025, rimMat, 8);
  rim.position.y = 0.3525;
  g.add(rim);

  // Couvercle posé de travers, légèrement entrouvert.
  const lid = limb(0.175, 0.16, 0.03, bodyMat, 8);
  lid.position.set(0.02, 0.385, 0);
  lid.rotation.z = 0.2;
  g.add(lid);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 6, 10, Math.PI), rimMat);
  handle.position.set(0.02, 0.42, 0);
  handle.rotation.set(Math.PI / 2, 0.2, 0);
  g.add(handle);

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

  // Ciel nocturne : une grande sphère texturée (étoiles + lune) qui entoure
  // toute la scène, à la place d'un aplat de couleur uni qui ne donnait
  // aucune impression de ciel une fois en jeu.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 16), makeNightSkyMaterial());
  group.add(sky);

  // ---------- Parking (z négatif = extérieur) ----------
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), asphaltMat);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(0, 0, -11);
  group.add(lot);

  // Sol étendu bien au-delà de la zone jouable : sans lui, le parking
  // s'arrête net à la limite de déplacement et se voit tout de suite comme
  // un petit plateau flottant plutôt qu'un vrai lieu. Légèrement en
  // contrebas pour ne pas entrer en conflit avec l'asphalte du parking.
  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x10120e, roughness: 1 }));
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(0, -0.03, -20);
  group.add(farGround);

  // Route décorative qui prolonge le parking vers l'horizon : hors des
  // limites de déplacement (bounds côté main.js), donc jamais praticable —
  // juste de quoi donner une suite au monde plutôt qu'un bord net.
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 45), asphaltMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.005, -42);
  group.add(road);
  for (let i = 0; i < 9; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.015, -21 - i * 4);
    group.add(dash);
  }

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

  // Arbres en fond de parking : écorce + feuillage texturés (plutôt que des
  // silhouettes noires plates) — sombres pour une scène de nuit, mais avec
  // du grain et de vraies variations de teinte.
  const treeBarkMat = makeBarkMaterial();
  const treeFoliageMat = makeFoliageMaterial('#14301c');
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Group();
    const trunk = limb(0.12, 0.16, 1.6, treeBarkMat, 6);
    trunk.position.y = 0.8;
    t.add(trunk);
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + Math.random() * 0.6, 0), treeFoliageMat);
    foliage.position.y = 2.4 + Math.random() * 0.6;
    t.add(foliage);
    t.position.set(-9 + Math.random() * 18, 0, -15.5 - Math.random() * 1.5);
    group.add(t);
  }

  // Grands arbres en périphérie (mur sur les côtés + rideau derrière la
  // route) pour masquer l'horizon et les bords du monde plutôt que de les
  // laisser à nu — bien plus imposants que ceux du fond de parking.
  for (let i = 0; i < 16; i++) {
    const t = new THREE.Group();
    const trunkH = 2.2 + Math.random() * 1.4;
    const trunk = limb(0.16, 0.22, trunkH, treeBarkMat, 6);
    trunk.position.y = trunkH / 2;
    t.add(trunk);
    const foliageR = 1.7 + Math.random() * 1.1;
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(foliageR, 0), treeFoliageMat);
    foliage.position.y = trunkH + foliageR * 0.6;
    t.add(foliage);
    let x, z;
    if (i < 8) {
      x = (i % 2 === 0 ? -1 : 1) * (12 + Math.random() * 4);
      z = -4 - Math.random() * 20;
    } else {
      x = -16 + Math.random() * 32;
      z = -45 - Math.random() * 15;
    }
    t.position.set(x, 0, z);
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

  // Enseigne FERMÉ / OUVERT, à côté de la porte : le joueur doit venir la
  // retourner pour lancer le service (voir shiftStart.js) plutôt que le
  // service démarrant tout seul dès l'écran de démarrage, client déjà planté
  // au comptoir compris.
  const closedSignMat = makeSignMaterial('FERMÉ', { bg: '#5a1a16', fg: '#f0d8cc', fontSize: 46 });
  const openSignMat = makeSignMaterial('OUVERT', { bg: '#1c3319', fg: '#d4af37', fontSize: 46 });
  const shopSign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), closedSignMat);
  shopSign.position.set(0.85, 1.55, rz0 - WALL_T / 2 - 0.05);
  shopSign.rotation.y = Math.PI;
  group.add(shopSign);
  const signPoint = { x: 0.85, z: rz0 - 0.6, radius: 0.9 };

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

  // Mur gauche avec la porte des WC (avant : un mur plein avec une porte
  // décorative plaquée devant — impossible à ouvrir puisqu'il n'y avait
  // aucune brèche réelle derrière).
  const WC_DOOR_W = 0.9;
  const WC_DOOR_H = 2.0;
  const wcDoorZ = -2.6;
  const leftWall = wallWithGap('z', rz1 - rz0, WALL_H, WALL_T, brickMat, wcDoorZ, WC_DOOR_W, WC_DOOR_H);
  leftWall.position.set(rx0, 0, 0);
  group.add(leftWall);
  colliders.push({ minX: rx0 - WALL_T / 2, maxX: rx0 + WALL_T / 2, minZ: rz0, maxZ: wcDoorZ - WC_DOOR_W / 2 });
  colliders.push({ minX: rx0 - WALL_T / 2, maxX: rx0 + WALL_T / 2, minZ: wcDoorZ + WC_DOOR_W / 2, maxZ: rz1 });

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
    const light = new THREE.PointLight(0xfff6d8, 3, 7, 2);
    light.position.set(x, WALL_H - 0.3, z);
    group.add(light);
  });

  // ---------- Toilettes (petite pièce derrière la porte WC) ----------
  const wcx0 = rx0 - 1.7;
  const wcx1 = rx0;
  const wcz0 = wcDoorZ - 0.8;
  const wcz1 = wcDoorZ + 0.8;

  const wcFloor = new THREE.Mesh(new THREE.PlaneGeometry(wcx1 - wcx0, wcz1 - wcz0), floorMat);
  wcFloor.rotation.x = -Math.PI / 2;
  wcFloor.position.set((wcx0 + wcx1) / 2, 0, (wcz0 + wcz1) / 2);
  group.add(wcFloor);
  const wcCeil = new THREE.Mesh(new THREE.PlaneGeometry(wcx1 - wcx0, wcz1 - wcz0), wallMat);
  wcCeil.rotation.x = Math.PI / 2;
  wcCeil.position.set((wcx0 + wcx1) / 2, WALL_H, (wcz0 + wcz1) / 2);
  group.add(wcCeil);

  const wcBack = wallWithGap('z', wcz1 - wcz0, WALL_H, WALL_T, wallMat, 0, 0);
  wcBack.position.set(wcx0, 0, (wcz0 + wcz1) / 2);
  group.add(wcBack);
  colliders.push({ minX: wcx0 - WALL_T / 2, maxX: wcx0 + WALL_T / 2, minZ: wcz0, maxZ: wcz1 });

  const wcSideA = wallWithGap('x', wcx1 - wcx0, WALL_H, WALL_T, wallMat, 0, 0);
  wcSideA.position.set((wcx0 + wcx1) / 2, 0, wcz0);
  group.add(wcSideA);
  colliders.push({ minX: wcx0, maxX: wcx1, minZ: wcz0 - WALL_T / 2, maxZ: wcz0 + WALL_T / 2 });

  const wcSideB = wallWithGap('x', wcx1 - wcx0, WALL_H, WALL_T, wallMat, 0, 0);
  wcSideB.position.set((wcx0 + wcx1) / 2, 0, wcz1);
  group.add(wcSideB);
  colliders.push({ minX: wcx0, maxX: wcx1, minZ: wcz1 - WALL_T / 2, maxZ: wcz1 + WALL_T / 2 });

  const wcLight = new THREE.PointLight(0xdce8ee, 4, 5, 2);
  wcLight.position.set((wcx0 + wcx1) / 2, WALL_H - 0.3, (wcz0 + wcz1) / 2);
  group.add(wcLight);

  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xeef0e8, roughness: 0.3 });
  const toiletBase = limb(0.11, 0.14, 0.32, porcelainMat, 10);
  toiletBase.position.set(wcx0 + 0.35, 0.16, wcz0 + 0.35);
  group.add(toiletBase);
  const toiletBowl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), porcelainMat);
  toiletBowl.position.set(wcx0 + 0.35, 0.34, wcz0 + 0.35);
  group.add(toiletBowl);
  const sink = box(0.36, 0.08, 0.28, porcelainMat);
  sink.position.set(wcx0 + 0.3, 0.78, wcz1 - 0.3);
  group.add(sink);
  const sinkLeg = limb(0.04, 0.05, 0.78, porcelainMat, 8);
  sinkLeg.position.set(wcx0 + 0.3, 0.39, wcz1 - 0.3);
  group.add(sinkLeg);
  // Miroir : PlaneGeometry par défaut regarde +Z, ici on l'approche par -Z
  // depuis l'intérieur de la pièce (même piège que l'enseigne/tableau noir).
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), glassMat);
  mirror.position.set(wcx0 + 0.3, 1.35, wcz1 - WALL_T / 2 - 0.02);
  mirror.rotation.y = Math.PI;
  group.add(mirror);

  // ---------- Comptoir + caisse (côté mur droit) ----------
  const counter = box(1.1, 0.95, 2.4, counterMat);
  counter.position.set(4.3, 0.475, -1.9);
  group.add(counter);
  addCollider(counter, 4.3, -1.9);

  const register = box(0.35, 0.28, 0.3, metalMat);
  register.position.set(4.25, 0.95 + 0.14, -2.3);
  group.add(register);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), makeSignMaterial('CAISSE', { bg: '#12314a', fg: '#8fe0ff', fontSize: 46 }));
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
  const phonePoint = { x: 4.35, z: -0.9, radius: 0.8 };

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
  // Position où un client vient se poster pour "choisir" son objet avant de
  // rejoindre le comptoir (voir customerMovement.js) : un peu en retrait du
  // rayon, face à l'étagère, même Z que l'objet demandé.
  const shelfSlots = {};
  ['baguette', 'cartes', 'piece', 'chapeau'].forEach((id, i) => {
    const prop = buildMagicProp(id, 2.2);
    const z = -0.1 + i * 0.65;
    prop.position.set(rx0 + 0.24, 1.025, z);
    group.add(prop);
    shelfSlots[id] = { x: rx0 + 0.9, z };
  });
  colliders.push({ minX: rx0 + 0.1, maxX: rx0 + 0.38, minZ: -0.55, maxZ: 2.15 });

  // Poubelle : jette 1 unité d'un objet en stock (comptoir déjà surchargé,
  // zone volontairement loin des autres points d'interaction).
  const trashCan = buildTrashCan(metalMat);
  // Près du comptoir (juste au nord du poste de caisse), pas planquée à
  // l'autre bout de la pièce — un rayon assez petit pour ne chevaucher ni
  // la caisse ni le téléphone, déjà bien remplis dans ce coin.
  trashCan.position.set(3.0, 0, 0.8);
  group.add(trashCan);
  colliders.push({ minX: 2.8, maxX: 3.2, minZ: 0.6, maxZ: 1.0 });
  const trashPoint = { x: 3.0, z: 0.8, radius: 0.7 };

  // Porte des WC : fermée par défaut (son propre collider bloque le
  // passage), s'ouvre/se ferme sur E — plus une simple façade plaquée
  // devant un mur plein, ni une porte qui coulisse toute seule à l'approche
  // (personne n'a demandé ça).
  const wcDoorCollider = { minX: rx0 - WALL_T / 2, maxX: rx0 + WALL_T / 2, minZ: wcDoorZ - WC_DOOR_W / 2, maxZ: wcDoorZ + WC_DOOR_W / 2 };
  colliders.push(wcDoorCollider);
  const wcDoorCtrl = createSlidingDoor({
    material: bathDoorMat,
    width: WC_DOOR_W,
    height: WC_DOOR_H,
    x: rx0,
    gapCenterZ: wcDoorZ,
    openTowardPositiveZ: true,
    collider: wcDoorCollider,
  });
  group.add(wcDoorCtrl.mesh);
  const wcDoorPoint = { x: rx0 + 1.1, z: wcDoorZ, radius: 0.8 };

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

  // Porte STAFF ONLY entre les deux salles : fermée par défaut (bloque
  // vraiment le passage), s'ouvre/se ferme sur E — pas un panneau statique
  // qu'on traversait sans qu'il bouge, ni une porte automatique.
  const staffDoorCollider = { minX: bx0 - WALL_T / 2, maxX: bx0 + WALL_T / 2, minZ: -DOOR_W / 2, maxZ: DOOR_W / 2 };
  colliders.push(staffDoorCollider);
  const staffDoorCtrl = createSlidingDoor({
    material: staffDoorMat,
    width: DOOR_W - 0.1,
    height: DOOR_H,
    x: bx0,
    gapCenterZ: 0,
    openTowardPositiveZ: false,
    collider: staffDoorCollider,
  });
  group.add(staffDoorCtrl.mesh);
  // Centré sur la brèche elle-même (pas juste "à côté") : sans ça, on peut
  // interagir avec la porte depuis un endroit d'où on ne peut pas vraiment
  // la franchir.
  const staffDoorPoint = { x: bx0, z: 0, radius: 0.85 };

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

  // Où le joueur apparaît une fois l'enseigne retournée sur OUVERT (voir
  // shiftStart.js) : côté comptoir, mais avec du recul et face à l'espace
  // ouvert du magasin — pas collé contre le comptoir (sinon la lampe torse
  // sature complètement l'écran à bout portant contre une surface aussi
  // proche, même piège que la première fois qu'elle a été réglée).
  const counterStandPos = new THREE.Vector3(3.0, 0, -1.3);
  const counterStandYaw = 0;

  return {
    group,
    colliders,
    registerPoint,
    phonePoint,
    trashPoint,
    closetPoint,
    signPoint,
    staffDoorPoint,
    wcDoorPoint,
    npc,
    frames,
    shelfSlots,
    cleaningSpots,
    startWorldPos,
    startYaw,
    counterStandPos,
    counterStandYaw,
    shopSign,
    openSignMat,
    doors: [staffDoorCtrl, wcDoorCtrl],
  };
}
