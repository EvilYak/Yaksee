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
} from './materials.js';
import { ZONES, DEFAULT_THEME, DEFAULT_WALL_HEIGHT, wallHeightFor } from './zones.js';

export const WALL_HEIGHT = DEFAULT_WALL_HEIGHT;
const WALL_THICKNESS = 0.12;

function buildThemeConfig() {
  return {
    backrooms: {
      wall: makeWallpaperMaterial(),
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
      wall: makeKittyWallpaperMaterial(),
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

function buildHouse({ width, wallHeight, depth, hue, roofMat }) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), makeHouseMaterial(hue));
  body.position.y = wallHeight / 2;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.12, 0.3, depth * 1.12), roofMat);
  roof.position.y = wallHeight + 0.15;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), makeDoorDecalMaterial());
  door.position.set(0, 0.95, depth / 2 + 0.02);
  group.add(door);

  const litColors = [0xffdf9e, 0xffdf9e, 0x9fc7e8];
  [-1, 1].forEach((side) => {
    const lit = Math.random() < 0.65;
    const c = lit ? litColors[Math.floor(Math.random() * litColors.length)] : 0x2a2a24;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), makeWindowDecalMaterial(c));
    win.position.set(side * width * 0.28, wallHeight * 0.62, depth / 2 + 0.02);
    group.add(win);
  });

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

  const dummy = new THREE.Object3D();
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

    if (v.length) {
      const vMesh = new THREE.InstancedMesh(geos.v, cfg.wall, v.length);
      v.forEach(([px, pz], i) => {
        dummy.position.set(px, cfg.wallHeight / 2, pz);
        dummy.updateMatrix();
        vMesh.setMatrixAt(i, dummy.matrix);
      });
      vMesh.instanceMatrix.needsUpdate = true;
      group.add(vMesh);
    }
    if (h.length) {
      const hMesh = new THREE.InstancedMesh(geos.h, cfg.wall, h.length);
      h.forEach(([px, pz], i) => {
        dummy.position.set(px, cfg.wallHeight / 2, pz);
        dummy.updateMatrix();
        hMesh.setMatrixAt(i, dummy.matrix);
      });
      hMesh.instanceMatrix.needsUpdate = true;
      group.add(hMesh);
    }
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
    const house = buildHouse({ width: 4.4, wallHeight: 3.1, depth: 5.2, hue, roofMat });
    house.position.set(hx, 0, hz);
    house.rotation.y = ry;
    group.add(house);
  });
  [0.3, 0.5, 0.7].forEach((t) => {
    const light = buildStreetlight();
    light.position.set(nbhd.cx, 0, nbhd.minZ + (nbhd.maxZ - nbhd.minZ) * t);
    group.add(light);
  });

  // ---------- Hôtel : jardinières décoratives ----------
  const htl = rectWorldExtent(ZONES.hotel.rect, C);
  const planterMat = makeHouseMaterial(120);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), planterMat);
    planter.position.set(htl.cx + sx * (htl.w / 2 - 1.4), 0.25, htl.cz + sz * (htl.h / 2 - 1.4));
    group.add(planter);
  });

  // ---------- Kitty : miroirs ovals accrochés aux murs ----------
  const mirrorMat = makeMirrorDecalMaterial();
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
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), mirrorMat);
      mirror.scale.set(1, 1.4, 1);
      mirror.position.set(px + (Math.random() < 0.5 ? 0.09 : -0.09), 1.55, pz);
      mirror.rotation.y = Math.PI / 2;
      group.add(mirror);
    });
    pick(kittyWalls.h, 4).forEach(([px, pz]) => {
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), mirrorMat);
      mirror.scale.set(1, 1.4, 1);
      mirror.position.set(px, 1.55, pz + (Math.random() < 0.5 ? 0.09 : -0.09));
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
  function update(dt, cameraPosition) {
    t += dt;
    followLight.position.x = cameraPosition.x;
    followLight.position.z = cameraPosition.z;
    if (followLight.visible) {
      followLight.intensity = 23 + Math.sin(t * 11) * 1.4 + Math.sin(t * 3.1) * 1;
    }

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
