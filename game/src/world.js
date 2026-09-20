import * as THREE from 'three';
import {
  makeWallpaperMaterial,
  makeCarpetMaterial,
  makeCeilingMaterial,
  makeLightStripMaterial,
  makePoolTileMaterial,
  makePoolFloorMaterial,
  makePoolCeilingMaterial,
  makeHotelFacadeMaterial,
  makeCourtyardFloorMaterial,
  makeSkyCloudsMaterial,
  makeGrassPathMaterial,
  makeHouseMaterial,
  makeRoofMaterial,
  makeWindowDecalMaterial,
  makeDoorDecalMaterial,
  makeKittyWallpaperMaterial,
  makeKittyCarpetMaterial,
  makeKittyCeilingMaterial,
  makeMirrorDecalMaterial,
  makeWaterMaterial,
} from './materials.js';
import { ZONES, DEFAULT_THEME, DEFAULT_WALL_HEIGHT, wallHeightFor } from './zones.js';

export const WALL_HEIGHT = DEFAULT_WALL_HEIGHT;
const WALL_THICKNESS = 0.12;

function buildThemeConfig() {
  return {
    backrooms: {
      wall: [makeWallpaperMaterial(), makeWallpaperMaterial(), makeWallpaperMaterial()],
      floor: makeCarpetMaterial(),
      ceiling: makeCeilingMaterial(),
      lightColor: new THREE.Color(0xfff6d8),
      fog: new THREE.Color(0x8c8256),
      fogDensity: 0.055,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    pool: {
      wall: makePoolTileMaterial(),
      floor: makePoolFloorMaterial(),
      ceiling: makePoolCeilingMaterial(),
      lightColor: new THREE.Color(0xdff2ff),
      fog: new THREE.Color(0x93a8ab),
      fogDensity: 0.05,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    kitty: {
      wall: [makeKittyWallpaperMaterial(), makeKittyWallpaperMaterial(), makeKittyWallpaperMaterial()],
      floor: makeKittyCarpetMaterial(),
      ceiling: makeKittyCeilingMaterial(),
      lightColor: new THREE.Color(0xffd3ec),
      fog: new THREE.Color(0xd9a8c4),
      fogDensity: 0.05,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    hotel: {
      wall: makeHotelFacadeMaterial(),
      floor: makeCourtyardFloorMaterial(),
      ceiling: new THREE.MeshBasicMaterial({ color: 0x14151c, toneMapped: false }),
      lightColor: new THREE.Color(0xbcd4ff),
      fog: new THREE.Color(0x2c3044),
      fogDensity: 0.024,
      wallHeight: wallHeightFor('hotel'),
      lights: false,
    },
    neighborhood: {
      wall: makeSkyCloudsMaterial(),
      floor: makeGrassPathMaterial(),
      ceiling: new THREE.MeshBasicMaterial({ color: 0xcfe6e8, toneMapped: false }),
      lightColor: new THREE.Color(0xfff1d0),
      fog: new THREE.Color(0xdde7d8),
      fogDensity: 0.02,
      wallHeight: wallHeightFor('neighborhood'),
      lights: false,
    },
  };
}

function rectWorldExtent([x0, y0, w, h], C) {
  const minX = x0 * C - C / 2;
  const maxX = (x0 + w - 1) * C + C / 2;
  const minZ = y0 * C - C / 2;
  const maxZ = (y0 + h - 1) * C + C / 2;
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, h: maxZ - minZ };
}

function buildFloorWithHoles(size, C, holeRects, material) {
  const half = C / 2;
  const minX = -half;
  const maxX = (size - 1) * C + half;
  const minZ = -half;
  const maxZ = (size - 1) * C + half;
  const shape = new THREE.Shape();
  shape.moveTo(minX, minZ);
  shape.lineTo(maxX, minZ);
  shape.lineTo(maxX, maxZ);
  shape.lineTo(minX, maxZ);
  shape.closePath();
  holeRects.forEach((rect) => {
    const e = rectWorldExtent(rect, C);
    const hole = new THREE.Path();
    hole.moveTo(e.minX, e.minZ);
    hole.lineTo(e.maxX, e.minZ);
    hole.lineTo(e.maxX, e.maxZ);
    hole.lineTo(e.minX, e.maxZ);
    hole.closePath();
    shape.holes.push(hole);
  });
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Vrai toit à deux pans (deux plaques inclinées + pignons triangulaires),
// au lieu d'un simple pavé posé à plat.
function buildRoof(width, wallHeight, depth, roofRise, mat) {
  const group = new THREE.Group();
  const halfW = width / 2;
  const slopeLen = Math.sqrt(halfW * halfW + roofRise * roofRise);
  const angle = Math.atan2(roofRise, halfW);
  const overhang = 0.35;
  const slabGeo = new THREE.BoxGeometry(slopeLen + overhang, 0.1, depth + overhang);

  const left = new THREE.Mesh(slabGeo, mat);
  left.position.set(-halfW / 2, wallHeight + roofRise / 2, 0);
  left.rotation.z = angle;
  group.add(left);

  const right = new THREE.Mesh(slabGeo, mat);
  right.position.set(halfW / 2, wallHeight + roofRise / 2, 0);
  right.rotation.z = -angle;
  group.add(right);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfW, 0);
  gableShape.lineTo(halfW, 0);
  gableShape.lineTo(0, roofRise);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);

  const gableFront = new THREE.Mesh(gableGeo, mat);
  gableFront.position.set(0, wallHeight, depth / 2);
  group.add(gableFront);

  const gableBack = new THREE.Mesh(gableGeo, mat);
  gableBack.position.set(0, wallHeight, -depth / 2);
  gableBack.rotation.y = Math.PI;
  group.add(gableBack);

  // Faîtière : couvre la jonction entre les deux pans (sinon un petit interstice
  // reste visible à l'épaisseur des plaques, comme un toit sans faîtage réel).
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, depth + overhang + 0.05), mat);
  ridge.position.set(0, wallHeight + roofRise, 0);
  group.add(ridge);

  return group;
}

// Porte avec un vrai battant en relief (pas un simple décalque plat) + poignée.
function buildDoor(width, height, mat) {
  const group = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), mat);
  panel.position.z = 0.04;
  group.add(panel);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8c98a, metalness: 0.7, roughness: 0.3 }),
  );
  handle.position.set(width * 0.32, 0, 0.11);
  group.add(handle);

  return group;
}

// Fenêtre avec cadre saillant + appui, la vitre elle-même a un peu d'épaisseur.
function buildWindow(width, height, paneColor, frameMat) {
  const group = new THREE.Group();

  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.06), frameMat);
  group.add(frame);

  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), makeWindowDecalMaterial(paneColor));
  pane.position.z = 0.025;
  group.add(pane);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 0.06, 0.16), frameMat);
  sill.position.set(0, -height / 2 - 0.06, 0.08);
  group.add(sill);

  return group;
}

function buildHouse({ width, wallHeight, depth, roofRise, hue, roofMat }) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), makeHouseMaterial(hue));
  body.position.y = wallHeight / 2;
  group.add(body);

  group.add(buildRoof(width, wallHeight, depth, roofRise, roofMat));

  const door = buildDoor(0.9, 1.9, makeDoorDecalMaterial());
  door.position.set(0, 0.95, depth / 2);
  group.add(door);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.7 });
  const litColors = [0xffdf9e, 0xffdf9e, 0x9fc7e8];
  [-1, 1].forEach((side) => {
    const lit = Math.random() < 0.65;
    const c = lit ? litColors[Math.floor(Math.random() * litColors.length)] : 0x2a2a24;
    const win = buildWindow(0.85, 1.05, c, frameMat);
    win.position.set(side * width * 0.28, wallHeight * 0.62, depth / 2);
    group.add(win);
  });

  return group;
}

// Miroir avec un vrai cadre en relief (tore) au lieu d'un simple disque plat.
function buildMirror(glassMat, frameMat) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), glassMat);
  group.add(glass);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 8, 24), frameMat);
  frame.position.z = -0.015;
  group.add(frame);
  group.scale.set(1, 1.4, 1);
  return group;
}

function buildStreetlight() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x27282a, roughness: 0.6, metalness: 0.4 }),
  );
  pole.position.y = 1.55;
  group.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, toneMapped: false }),
  );
  bulb.position.y = 3.15;
  group.add(bulb);

  return group;
}

export function buildWorld(maze) {
  const { size, cellSize: C } = maze;
  const group = new THREE.Group();
  const themes = buildThemeConfig();

  function pickWallTheme(cx1, cy1, cx2, cy2) {
    const inRange = cx2 >= 0 && cx2 < size && cy2 >= 0 && cy2 < size;
    const t1 = maze.themeAt(cx1, cy1);
    const t2 = inRange ? maze.themeAt(cx2, cy2) : t1;
    if (t1 !== DEFAULT_THEME) return t1;
    if (t2 !== DEFAULT_THEME) return t2;
    return DEFAULT_THEME;
  }

  const dummy = new THREE.Object3D();

  // Le labyrinthe entier tient dans quelques gros InstancedMesh si on ne les
  // découpe pas — le moteur devrait alors redessiner toute la carte à chaque
  // image, même hors champ de vision. On répartit plutôt chaque catégorie de
  // géométrie (murs, plinthes, joints...) en petits paquets spatiaux : chacun
  // obtient son propre volume englobant, donc son propre frustum culling.
  const CHUNK_CELLS = 8;
  const chunkWorldSize = CHUNK_CELLS * C;
  function chunkKeyOf(px, pz) {
    return `${Math.floor(px / chunkWorldSize)},${Math.floor(pz / chunkWorldSize)}`;
  }
  function groupByChunk(list) {
    const map = new Map();
    for (const entry of list) {
      const key = chunkKeyOf(entry[0], entry[1]);
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(entry);
    }
    return map;
  }
  // Un même matériau répété sur toute la carte se voit immédiatement (le
  // même motif de taches revient à chaque pan de mur) — quand `material`
  // est un tableau de variantes, chaque chunk en tire une au hasard, mais de
  // façon stable (hash de sa clé) pour ne pas changer d'une frame à l'autre.
  function pickVariant(material, key) {
    if (!Array.isArray(material)) return material;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return material[Math.abs(h) % material.length];
  }

  function addChunkedInstances(targetGroup, list, geometry, material, placeFn) {
    if (!list.length) return;
    groupByChunk(list).forEach((entries, key) => {
      const mat = pickVariant(material, key);
      const mesh = new THREE.InstancedMesh(geometry, mat, entries.length);
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

  // Toutes les frontières internes de cellules dont le thème appartient à
  // `themeSet` — sert à quadriller le plafond (T-bar) et le sol (joints)
  // avec de vrais segments 3D plutôt qu'une texture peinte.
  function collectCellEdges(themeSet) {
    const v = [];
    const h = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (!themeSet.has(maze.themeAt(x, y))) continue;
        if (x < size - 1) v.push([x * C + C / 2, y * C]);
        if (y < size - 1) h.push([x * C, y * C + C / 2]);
      }
    }
    return { v, h };
  }

  function buildEdgeGridMesh(edges, { thickness, depth, y, color }) {
    const gridGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    const vGeo = new THREE.BoxGeometry(thickness, depth, C);
    const hGeo = new THREE.BoxGeometry(C, depth, thickness);
    const place = (d, [px, pz]) => d.position.set(px, y, pz);
    addChunkedInstances(gridGroup, edges.v, vGeo, mat, place);
    addChunkedInstances(gridGroup, edges.h, hGeo, mat, place);
    return gridGroup;
  }

  // ---------- Sol : base "backrooms" pleine étendue + poches thématiques ----------
  const extent = size * C;
  const floorGeo = new THREE.PlaneGeometry(extent, extent);
  const floor = new THREE.Mesh(floorGeo, themes.backrooms.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((size - 1) * C * 0.5, 0, (size - 1) * C * 0.5);
  group.add(floor);

  const zoneRects = Object.keys(ZONES).map((name) => ZONES[name].rect);
  for (const name in ZONES) {
    const e = rectWorldExtent(ZONES[name].rect, C);
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.h), themes[name].floor);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(e.cx, 0.01, e.cz);
    group.add(patch);
  }

  // ---------- Eau peu profonde qui recouvre tout le sol des pool rooms ----------
  const poolExt = rectWorldExtent(ZONES.pool.rect, C);
  const waterMat = makeWaterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(poolExt.w, poolExt.h), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(poolExt.cx, 0.045, poolExt.cz);
  group.add(water);

  // ---------- Plafond : plaque trouée (poches) + capuchon dédié par poche ----------
  const ceilingBase = buildFloorWithHoles(size, C, zoneRects, themes.backrooms.ceiling);
  ceilingBase.position.y = WALL_HEIGHT;
  group.add(ceilingBase);

  for (const name in ZONES) {
    const e = rectWorldExtent(ZONES[name].rect, C);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.h), themes[name].ceiling);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(e.cx, themes[name].wallHeight, e.cz);
    group.add(cap);
  }

  // ---------- Plafond suspendu : vraie grille en relief (T-bar), pas une texture ----------
  const flatCeilingEdges = collectCellEdges(new Set(['backrooms', 'pool', 'kitty']));
  group.add(
    buildEdgeGridMesh(flatCeilingEdges, { thickness: 0.05, depth: 0.05, y: WALL_HEIGHT - 0.025, color: 0x736c58 }),
  );

  // ---------- Sol : joints en relief (moquette/carrelage) sous les mêmes zones ----------
  group.add(
    buildEdgeGridMesh(flatCeilingEdges, { thickness: 0.035, depth: 0.018, y: 0.009, color: 0x241f10 }),
  );

  // ---------- Murs : regroupés par thème + hauteur (InstancedMesh) ----------
  const wallBuckets = {}; // theme -> { v: [[x,z]], h: [[x,z]] }
  function bucket(theme) {
    if (!wallBuckets[theme]) wallBuckets[theme] = { v: [], h: [] };
    return wallBuckets[theme];
  }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (maze.hasWallE(x, y)) {
        bucket(pickWallTheme(x, y, x + 1, y)).v.push([x * C + C / 2, y * C]);
      }
      if (maze.hasWallS(x, y)) {
        bucket(pickWallTheme(x, y, x, y + 1)).h.push([x * C, y * C + C / 2]);
      }
    }
  }
  for (let x = 0; x < size; x++) bucket(maze.themeAt(x, 0)).h.push([x * C, -C / 2]);
  for (let y = 0; y < size; y++) bucket(maze.themeAt(0, y)).v.push([-C / 2, y * C]);

  const geoCache = new Map();
  function geosFor(height) {
    if (!geoCache.has(height)) {
      geoCache.set(height, {
        v: new THREE.BoxGeometry(WALL_THICKNESS, height, C),
        h: new THREE.BoxGeometry(C, height, WALL_THICKNESS),
      });
    }
    return geoCache.get(height);
  }

  for (const theme in wallBuckets) {
    const cfg = themes[theme];
    const { v, h } = wallBuckets[theme];
    const geos = geosFor(cfg.wallHeight);
    const place = (d, [px, pz]) => d.position.set(px, cfg.wallHeight / 2, pz);
    addChunkedInstances(group, v, geos.v, cfg.wall, place);
    addChunkedInstances(group, h, geos.h, cfg.wall, place);
  }

  // ---------- Plinthes : relief réel au pied des murs (zones intérieures) ----------
  const baseboardColors = { backrooms: 0x4a3f1c, pool: 0x7d7a68, kitty: 0x7a3f57 };
  const baseboardVGeo = new THREE.BoxGeometry(WALL_THICKNESS + 0.03, 0.15, C);
  const baseboardHGeo = new THREE.BoxGeometry(C, 0.15, WALL_THICKNESS + 0.03);
  const baseboardPlace = (d, [px, pz]) => d.position.set(px, 0.075, pz);
  for (const theme in baseboardColors) {
    const bucket2 = wallBuckets[theme];
    if (!bucket2) continue;
    const mat = new THREE.MeshStandardMaterial({ color: baseboardColors[theme], roughness: 0.85 });
    addChunkedInstances(group, bucket2.v, baseboardVGeo, mat, baseboardPlace);
    addChunkedInstances(group, bucket2.h, baseboardHGeo, mat, baseboardPlace);
  }

  // ---------- Néons plafonniers (uniquement zones "lights: true") ----------
  const stripGeo = new THREE.PlaneGeometry(1.7, 0.22);
  const stripPositions = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const theme = maze.themeAt(x, y);
      if (!themes[theme].lights) continue;
      if ((x + y) % 3 === 0) {
        stripPositions.push([x * C, y * C, (x * 7 + y * 13) % 2 === 0, themes[theme].lightColor]);
      }
    }
  }
  const strips = new THREE.InstancedMesh(stripGeo, makeLightStripMaterial(0xffffff), stripPositions.length);
  strips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(stripPositions.length * 3), 3);
  const flickerIdx = [];
  const stripTint = [];
  const color = new THREE.Color();

  stripPositions.forEach(([px, pz, rotated, tint], i) => {
    dummy.position.set(px, WALL_HEIGHT - 0.04, pz);
    dummy.rotation.set(-Math.PI / 2, 0, rotated ? Math.PI / 2 : 0);
    dummy.updateMatrix();
    strips.setMatrixAt(i, dummy.matrix);
    stripTint[i] = tint;

    const r = Math.random();
    if (r < 0.08) {
      color.copy(tint).multiplyScalar(0.08);
    } else {
      if (r < 0.28) flickerIdx.push(i);
      color.copy(tint);
    }
    strips.setColorAt(i, color);
  });
  strips.instanceMatrix.needsUpdate = true;
  strips.instanceColor.needsUpdate = true;
  group.add(strips);

  // Caisson (troffer) en relief autour de chaque néon, pour un vrai encastrement
  // plutôt qu'un simple plan lumineux plaqué au plafond.
  if (stripPositions.length) {
    const housingGeo = new THREE.BoxGeometry(1.94, 0.08, 0.46);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2b28, roughness: 0.7 });
    const housing = new THREE.InstancedMesh(housingGeo, housingMat, stripPositions.length);
    stripPositions.forEach(([px, pz, rotated], i) => {
      dummy.position.set(px, WALL_HEIGHT - 0.1, pz);
      dummy.rotation.set(0, rotated ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      housing.setMatrixAt(i, dummy.matrix);
    });
    housing.instanceMatrix.needsUpdate = true;
    group.add(housing);
  }

  // ---------- Quartier pavillonnaire : maisons + réverbères ----------
  const roofMat = makeRoofMaterial();
  const nbhd = rectWorldExtent(ZONES.neighborhood.rect, C);
  const margin = 1.6;
  const houseSpots = [
    [nbhd.minX + margin + 1.2, nbhd.minZ + margin, 0],
    [nbhd.cx, nbhd.minZ + margin, 0],
    [nbhd.maxX - margin - 1.2, nbhd.minZ + margin, 0],
    [nbhd.minX + margin + 1.2, nbhd.maxZ - margin, Math.PI],
    [nbhd.cx, nbhd.maxZ - margin, Math.PI],
    [nbhd.maxX - margin - 1.2, nbhd.maxZ - margin, Math.PI],
  ];
  houseSpots.forEach(([hx, hz, ry]) => {
    const hue = Math.random() < 0.82 ? 95 + Math.random() * 45 : 195 + Math.random() * 20;
    const house = buildHouse({ width: 4.4, wallHeight: 3.1, depth: 5.2, roofRise: 1.5, hue, roofMat });
    house.position.set(hx, 0, hz);
    house.rotation.y = ry;
    group.add(house);
  });
  [0.3, 0.5, 0.7].forEach((t) => {
    const light = buildStreetlight();
    light.position.set(nbhd.cx, 0, nbhd.minZ + (nbhd.maxZ - nbhd.minZ) * t);
    group.add(light);
  });

  // Bordures de trottoir en relief de part et d'autre de l'allée (pas juste peintes au sol).
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.8 });
  const curbGeo = new THREE.BoxGeometry(0.1, 0.09, nbhd.h);
  const pathHalfWidth = nbhd.w * 0.08;
  [-1, 1].forEach((side) => {
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(nbhd.cx + side * pathHalfWidth, 0.045, nbhd.cz);
    group.add(curb);
  });

  // ---------- Hôtel : jardinières décoratives ----------
  const htl = rectWorldExtent(ZONES.hotel.rect, C);
  const planterMat = makeHouseMaterial(120);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), planterMat);
    planter.position.set(htl.cx + sx * (htl.w / 2 - 1.4), 0.25, htl.cz + sz * (htl.h / 2 - 1.4));
    group.add(planter);
  });

  // Bandeaux de façade en relief (marquent les étages), pas juste de la texture plate.
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb7afa0, roughness: 0.6 });
  const trimThickness = WALL_THICKNESS + 0.12;
  [2.6, 5.0].forEach((ty) => {
    const north = new THREE.Mesh(new THREE.BoxGeometry(htl.w, 0.22, trimThickness), trimMat);
    north.position.set(htl.cx, ty, htl.minZ);
    group.add(north);
    const south = north.clone();
    south.position.z = htl.maxZ;
    group.add(south);
    const west = new THREE.Mesh(new THREE.BoxGeometry(trimThickness, 0.22, htl.h), trimMat);
    west.position.set(htl.minX, ty, htl.cz);
    group.add(west);
    const east = west.clone();
    east.position.x = htl.maxX;
    group.add(east);
  });

  // Joints de pavés en relief au sol de la cour (même technique que les couloirs).
  group.add(
    buildEdgeGridMesh(collectCellEdges(new Set(['hotel'])), {
      thickness: 0.035,
      depth: 0.02,
      y: 0.011,
      color: 0x131316,
    }),
  );

  // ---------- Kitty : miroirs ovals (cadre en relief) accrochés aux murs ----------
  const mirrorGlassMat = makeMirrorDecalMaterial();
  const mirrorFrameMat = new THREE.MeshStandardMaterial({ color: 0xcfa15a, metalness: 0.6, roughness: 0.35 });
  const kittyWalls = wallBuckets.kitty;
  if (kittyWalls) {
    const pick = (arr, n) => {
      const out = [];
      const pool = [...arr];
      for (let i = 0; i < n && pool.length; i++) {
        out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      return out;
    };
    pick(kittyWalls.v, 4).forEach(([px, pz]) => {
      const mirror = buildMirror(mirrorGlassMat, mirrorFrameMat);
      mirror.position.set(px + (Math.random() < 0.5 ? 0.1 : -0.1), 1.55, pz);
      mirror.rotation.y = Math.PI / 2;
      group.add(mirror);
    });
    pick(kittyWalls.h, 4).forEach(([px, pz]) => {
      const mirror = buildMirror(mirrorGlassMat, mirrorFrameMat);
      mirror.position.set(px, 1.55, pz + (Math.random() < 0.5 ? 0.1 : -0.1));
      group.add(mirror);
    });
  }

  // ---------- Lumières réelles : ambiance globale + lampe du joueur (togglable) ----------
  const hemi = new THREE.HemisphereLight(0xfff3d0, 0x2a2410, 2.6);
  group.add(hemi);

  const followLight = new THREE.PointLight(0xfff2cc, 24, 10, 2);
  followLight.position.set(0, 1.65, 0);
  group.add(followLight);

  const fog = new THREE.FogExp2(0x8c8256, 0.055);
  const currentFogColor = fog.color.clone();
  const currentLampColor = followLight.color.clone();

  let t = 0;
  function update(dt, cameraPosition, camera) {
    t += dt;
    followLight.position.x = cameraPosition.x;
    followLight.position.z = cameraPosition.z;
    if (followLight.visible) {
      followLight.intensity = 23 + Math.sin(t * 11) * 1.4 + Math.sin(t * 3.1) * 1;
    }

    // Ridules d'eau : deux calques qui dérivent à des vitesses différentes.
    waterMat.map.offset.set(t * 0.012, t * 0.008);
    waterMat.bumpMap.offset.set(-t * 0.02, t * 0.015);

    flickerIdx.forEach((i) => {
      const n = Math.sin(t * 14 + i) * Math.sin(t * 3.3 + i * 7.1);
      const on = n > -0.35 || Math.sin(t * 0.6 + i * 2.7) > 0.85;
      const b = on ? 0.85 + Math.random() * 0.15 : 0.05 + Math.random() * 0.1;
      color.copy(stripTint[i]).multiplyScalar(b);
      strips.setColorAt(i, color);
    });
    strips.instanceColor.needsUpdate = true;

    // Le brouillard prend doucement la teinte de la zone où se trouve le joueur.
    const cx = Math.round(cameraPosition.x / C);
    const cy = Math.round(cameraPosition.z / C);
    const theme = maze.themeAt(cx, cy);
    const cfg = themes[theme] || themes.backrooms;
    const lerpRate = Math.min(1, dt * 1.2);
    currentFogColor.lerp(cfg.fog, lerpRate);
    fog.color.copy(currentFogColor);
    fog.density += (cfg.fogDensity - fog.density) * lerpRate;
    currentLampColor.lerp(cfg.lightColor, lerpRate);
    followLight.color.copy(currentLampColor);

    // Au-delà de cette distance le brouillard masque déjà tout : inutile de
    // soumettre cette géométrie au moteur de rendu (moins de tris hors-écran).
    if (camera) {
      // FogExp2 utilise exp(-(density*distance)^2) : ~98% de brouillard vers
      // distance = 2.0 / density, ce qui donne une limite bien plus courte
      // dans les couloirs denses que dans les zones ouvertes (hôtel/quartier).
      const targetFar = THREE.MathUtils.clamp(2.0 / fog.density, 20, 60);
      camera.far += (targetFar - camera.far) * lerpRate;
      camera.updateProjectionMatrix();
    }
  }

  function setLampEnabled(enabled) {
    followLight.visible = enabled;
  }

  return {
    group,
    fog,
    update,
    setLampEnabled,
    cellSize: C,
    size,
    startWorldPos: cellToWorld(maze.startCell(), C),
  };
}

export function cellToWorld([cx, cy], cellSize) {
  return new THREE.Vector3(cx * cellSize, 1.65, cy * cellSize);
}
