import * as THREE from 'three';
import { makeLightStripMaterial, makeHouseMaterial, makeRoofMaterial, makeMirrorDecalMaterial, makeWaterMaterial } from './materials/index.js';
import { ZONES, DEFAULT_THEME, DEFAULT_WALL_HEIGHT } from './zones.js';
import { addChunkedInstances } from './world/chunking.js';
import { rectWorldExtent, buildFloorWithHoles, collectCellEdges, buildEdgeGridMesh } from './world/geometry.js';
import { buildHouse, buildMirror, buildStreetlight, buildPillar, buildStopSign, buildCrate } from './world/decor.js';
import { buildThemeConfig } from './world/theme-config.js';

export const WALL_HEIGHT = DEFAULT_WALL_HEIGHT;
const WALL_THICKNESS = 0.12;

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
  const flatCeilingEdges = collectCellEdges(maze, size, C, new Set(['backrooms', 'pool', 'kitty']));
  group.add(
    buildEdgeGridMesh(flatCeilingEdges, { thickness: 0.05, depth: 0.05, y: WALL_HEIGHT - 0.025, color: 0x736c58 }, C),
  );

  // ---------- Sol : joints en relief (moquette/carrelage) sous les mêmes zones ----------
  group.add(buildEdgeGridMesh(flatCeilingEdges, { thickness: 0.035, depth: 0.018, y: 0.009, color: 0x241f10 }, C));

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
    addChunkedInstances(group, v, geos.v, cfg.wall, place, C);
    addChunkedInstances(group, h, geos.h, cfg.wall, place, C);
  }

  // ---------- Linteaux aux ouvertures des zones "ouvertes" (hôtel, quartier) ----------
  // forceOpenBorder() laisse quelques passages sans mur sur le pourtour de ces
  // grandes salles. Sans rien au-dessus, on voit à travers le plafond bas et
  // sombre du couloir juste derrière flotter à côté du plafond haut de la
  // salle : un linteau referme le haut de chaque ouverture, comme une vraie
  // porte, pour ne plus laisser ce décor se télescoper à vue.
  const doorHeight = 2.3;
  for (const name in ZONES) {
    if (!ZONES[name].open) continue;
    const [zx0, zy0, zw, zh] = ZONES[name].rect;
    const cfg = themes[name];
    if (cfg.wallHeight <= doorHeight) continue;
    const lintelH = cfg.wallHeight - doorHeight;
    const lintelY = doorHeight + lintelH / 2;
    const lintelV = [];
    const lintelHz = [];
    for (let y = zy0; y < zy0 + zh; y++) {
      if (zx0 - 1 >= 0 && !maze.hasWallE(zx0 - 1, y)) lintelV.push([(zx0 - 1) * C + C / 2, y * C]);
      if (zx0 + zw - 1 <= size - 2 && !maze.hasWallE(zx0 + zw - 1, y)) lintelV.push([(zx0 + zw - 1) * C + C / 2, y * C]);
    }
    for (let x = zx0; x < zx0 + zw; x++) {
      if (zy0 - 1 >= 0 && !maze.hasWallS(x, zy0 - 1)) lintelHz.push([x * C, (zy0 - 1) * C + C / 2]);
      if (zy0 + zh - 1 <= size - 2 && !maze.hasWallS(x, zy0 + zh - 1)) lintelHz.push([x * C, (zy0 + zh - 1) * C + C / 2]);
    }
    const lintelPlace = (d, [px, pz]) => d.position.set(px, lintelY, pz);
    addChunkedInstances(group, lintelV, new THREE.BoxGeometry(WALL_THICKNESS, lintelH, C), cfg.wall, lintelPlace, C);
    addChunkedInstances(group, lintelHz, new THREE.BoxGeometry(C, lintelH, WALL_THICKNESS), cfg.wall, lintelPlace, C);
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
    addChunkedInstances(group, bucket2.v, baseboardVGeo, mat, baseboardPlace, C);
    addChunkedInstances(group, bucket2.h, baseboardHGeo, mat, baseboardPlace, C);
  }

  // ---------- Caisses éparpillées dans les couloirs backrooms ----------
  // Un peu de désordre entreposé au sol, pas des couloirs parfaitement vides.
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (maze.themeAt(x, y) !== 'backrooms') continue;
      if (Math.random() > 0.05) continue;
      const angle = Math.random() * Math.PI * 2;
      const offset = 0.75 + Math.random() * 0.25;
      const crate = buildCrate(0.45 + Math.random() * 0.3);
      crate.position.set(x * C + Math.cos(angle) * offset, 0, y * C + Math.sin(angle) * offset);
      crate.rotation.y = Math.random() * Math.PI * 2;
      group.add(crate);
    }
  }

  // ---------- Néons plafonniers (uniquement zones "lights: true") ----------
  // Un vrai panneau fluorescent encastré (large, presque carré), pas une fine
  // barrette : c'est ce qui se reconnaît immédiatement au plafond, pas juste
  // un filet de lumière qu'il faut chercher.
  const stripGeo = new THREE.PlaneGeometry(1.6, 0.85);
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
  const dummy = new THREE.Object3D();
  const strips = new THREE.InstancedMesh(stripGeo, makeLightStripMaterial(0xffffff), stripPositions.length);
  strips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(stripPositions.length * 3), 3);
  const flickerIdx = [];
  const stripTint = [];
  const color = new THREE.Color();

  stripPositions.forEach(([px, pz, rotated, tint], i) => {
    // Le plan lumineux doit rester le point le plus bas (donc le plus proche du
    // joueur qui regarde vers le haut) pour ne jamais être caché par le caisson.
    dummy.position.set(px, WALL_HEIGHT - 0.08, pz);
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
  // plutôt qu'un simple plan lumineux plaqué au plafond. Il est collé contre le
  // plafond (plus loin du joueur que le plan lumineux) pour ne former qu'un
  // liseré sombre visible autour du néon, sans jamais le recouvrir.
  if (stripPositions.length) {
    const housingGeo = new THREE.BoxGeometry(1.84, 0.06, 1.05);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2b28, roughness: 0.7 });
    const housing = new THREE.InstancedMesh(housingGeo, housingMat, stripPositions.length);
    stripPositions.forEach(([px, pz, rotated], i) => {
      dummy.position.set(px, WALL_HEIGHT - 0.03, pz);
      dummy.rotation.set(0, rotated ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      housing.setMatrixAt(i, dummy.matrix);
    });
    housing.instanceMatrix.needsUpdate = true;
    group.add(housing);
  }

  // Les néons ne sont qu'un plan émissif : sans vraie lumière, ils n'éclairent
  // rien autour d'eux et le mur en dessous reste à la teinte ambiante globale,
  // toujours la même. Des centaines de PointLight réels (un par néon) ne sont
  // pas soutenables ; on fait tourner un petit pool de lumières réelles sur
  // les quelques néons les plus proches du joueur à chaque frame, pour que
  // les murs et le décor proches d'un néon soient visiblement mieux éclairés
  // que ceux qui n'en ont pas — l'effet se voit, pas juste le plan lumineux.
  const NEON_LIGHT_POOL = 6;
  const NEON_LIGHT_RADIUS = 8;
  const neonLightPool = [];
  for (let i = 0; i < NEON_LIGHT_POOL; i++) {
    const light = new THREE.PointLight(0xffffff, 0, NEON_LIGHT_RADIUS - 1.5, 2);
    group.add(light);
    neonLightPool.push(light);
  }

  // ---------- Quartier pavillonnaire : maisons + réverbères ----------
  // Palette de teintes de toiture réalistes (bardeaux bruns, ardoise
  // rouge-brun, anthracite, vert mousse éteint) : un matériau par maison,
  // sinon les 6 toits sont un seul et même bloc marron uniforme partagé.
  const roofPalette = [
    { hue: 22, sat: 30 },
    { hue: 8, sat: 22 },
    { hue: 212, sat: 6 },
    { hue: 96, sat: 14 },
  ];
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
    const roof = roofPalette[Math.floor(Math.random() * roofPalette.length)];
    const roofMat = makeRoofMaterial(roof.hue, roof.sat);
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

  // Panneaux stop de part et d'autre de l'allée, un peu avant et après le
  // croisement central — un vrai petit quartier a une signalisation, pas
  // juste des maisons posées dans l'herbe.
  [
    [nbhd.cx - pathHalfWidth - 0.5, nbhd.cz - nbhd.h * 0.12],
    [nbhd.cx + pathHalfWidth + 0.5, nbhd.cz + nbhd.h * 0.12],
  ].forEach(([sx, sz]) => {
    const sign = buildStopSign();
    sign.position.set(sx, 0, sz);
    group.add(sign);
  });

  // ---------- Hôtel : colonnade + jardinières décoratives ----------
  // Une cour de 45m de côté avec seulement des jardinières aux coins se lit
  // comme une salle vide — une vraie cour d'hôtel a des piliers de soutien.
  const pillarInset = 0.72;
  const pillarSpots = [-pillarInset, -pillarInset * 0.34, pillarInset * 0.34, pillarInset].flatMap((fx) =>
    [-pillarInset, -pillarInset * 0.34, pillarInset * 0.34, pillarInset].map((fz) => [fx, fz]),
  );
  const htl = rectWorldExtent(ZONES.hotel.rect, C);
  pillarSpots.forEach(([fx, fz]) => {
    const pillar = buildPillar(themes.hotel.wallHeight - 0.05);
    pillar.position.set(htl.cx + fx * (htl.w / 2), 0, htl.cz + fz * (htl.h / 2));
    group.add(pillar);
  });

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
    buildEdgeGridMesh(
      collectCellEdges(maze, size, C, new Set(['hotel'])),
      { thickness: 0.035, depth: 0.02, y: 0.011, color: 0x131316 },
      C,
    ),
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
  // Les Backrooms sont éclairées par des néons de bureau toujours allumés,
  // pas par une lampe de poche dans le noir : l'ambiance doit rester assez
  // claire pour lire le papier peint sans avoir à coller la lampe dessus.
  const hemi = new THREE.HemisphereLight(0xfff3d0, 0x453c1e, 3.1);
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

    // Réassigne le pool de vraies lumières aux néons les plus proches du
    // joueur (recalculé chaque frame : balayage de stripPositions, trivial
    // niveau CPU, sans commune mesure avec le coût qu'aurait une vraie
    // lumière par néon sur des centaines d'instances).
    if (stripPositions.length) {
      const radius2 = NEON_LIGHT_RADIUS * NEON_LIGHT_RADIUS;
      const nearest = [];
      for (let i = 0; i < stripPositions.length; i++) {
        const px = stripPositions[i][0];
        const pz = stripPositions[i][1];
        const dx = px - cameraPosition.x;
        const dz = pz - cameraPosition.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius2) continue;
        nearest.push([d2, i]);
      }
      nearest.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < neonLightPool.length; i++) {
        const light = neonLightPool[i];
        const entry = nearest[i];
        if (!entry) {
          light.intensity = 0;
          continue;
        }
        const [d2, idx] = entry;
        const [px, pz, , tint] = stripPositions[idx];
        light.position.set(px, WALL_HEIGHT - 0.5, pz);
        light.color.copy(tint);
        const falloff = Math.max(0, 1 - Math.sqrt(d2) / NEON_LIGHT_RADIUS);
        light.intensity = 6 * falloff;
      }
    }

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
