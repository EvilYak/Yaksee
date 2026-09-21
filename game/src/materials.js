import * as THREE from 'three';

// Toutes les textures sont générées en canvas (pas de fichiers externes à charger,
// donc rien à télécharger et un build 100% autonome).

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// ---------------------------------------------------------------------------
// Bruit cohérent (value noise + fBm) : un vrai matériau a des variations
// corrélées sur plusieurs échelles (fibres, humidité, usure), jamais du bruit
// blanc pixel par pixel — c'est ce qui faisait ressembler les premières
// textures à de la neige TV plutôt qu'à du papier peint ou de la moquette.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Grille bouclée (wrap-around) : g[cells] === g[0] implicitement via le
// modulo, donc le résultat s'accorde parfaitement avec lui-même une fois
// répété (texture.repeat) — pas de raccord visible ni de motif qui "saute".
function valueNoiseLayer(size, cells, rand) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const out = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const fy = (py / size) * cells;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = smootherstep(fy - Math.floor(fy));
    for (let px = 0; px < size; px++) {
      const fx = (px / size) * cells;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = smootherstep(fx - Math.floor(fx));
      const a = g[y0 * cells + x0] * (1 - tx) + g[y0 * cells + x1] * tx;
      const b = g[y1 * cells + x0] * (1 - tx) + g[y1 * cells + x1] * tx;
      out[py * size + px] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

// Fractal Brownian motion : superpose plusieurs octaves du bruit ci-dessus
// (grossier -> fin) pour une variation naturelle, valeurs normalisées 0..1.
function fbm(size, octaves, baseCells, rand) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let totalAmp = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoiseLayer(size, cells, rand);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp;
    totalAmp += amp;
    amp *= 0.55;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= totalAmp;
  return out;
}

function addNoise(ctx, size, amount, rand = Math.random) {
  const noise = fbm(size, 4, 4, rand);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const n = (noise[p] - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Variation de teinte à grande échelle (plaques d'humidité, usure inégale) :
// applique une couleur en la modulant par une nappe de bruit basse fréquence,
// pour qu'aucune zone du mur/sol n'ait exactement la même couleur.
function grungeTint(ctx, size, { color, strength = 0.3, cells = 3, octaves = 3, rand = Math.random }) {
  const noise = fbm(size, octaves, cells, rand);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const [cr, cg, cb] = color;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const t = Math.max(0, noise[p] - 0.5) * 2 * strength;
    d[i] = d[i] * (1 - t) + cr * t;
    d[i + 1] = d[i + 1] * (1 - t) + cg * t;
    d[i + 2] = d[i + 2] * (1 - t) + cb * t;
  }
  ctx.putImageData(img, 0, 0);
}

function stain(ctx, size, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Bump map généré à partir du canvas niveaux de gris (relief léger sans vraie normal map).
function toBumpTexture(canvas, repeatX, repeatY) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// Un même matériau instancié (InstancedMesh) affiche par défaut EXACTEMENT
// la même image sur chaque pan de mur — c'est ce qui se voit comme des
// "carrés qui se répètent". Comme three.js n'a pas de canal UV2/UV3 par
// instance, on triche au niveau du shader : chaque instance reçoit un
// décalage UV et un éventuel flip (attributs instanciés posés dans
// world.js), appliqués après le mapping UV standard. La texture reste
// bouclée (RepeatWrapping) donc le décalage fait juste glisser la fenêtre
// d'échantillonnage dans le même bruit périodique — un pan de mur voisin
// montre une portion différente du même motif au lieu d'un copier-coller.
function enableUvVariation(material, { flip = true } = {}) {
  material.userData.uvVariation = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 instanceUvOffset;\nattribute float instanceUvFlip;\n',
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = ${flip ? '(instanceUvFlip > 0.5 ? vMapUv.yx : vMapUv)' : 'vMapUv'} + instanceUvOffset;
#endif
#ifdef USE_BUMPMAP
  vBumpMapUv = ${flip ? '(instanceUvFlip > 0.5 ? vBumpMapUv.yx : vBumpMapUv)' : 'vBumpMapUv'} + instanceUvOffset;
#endif
`,
      );
  };
  return material;
}

export function makeWallpaperMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b7a24a';
  ctx.fillRect(0, 0, size, size);

  // Décoloration inégale à grande échelle (jamais deux zones du mur de la
  // même teinte exacte, comme un vrai papier peint vieilli).
  grungeTint(ctx, size, { color: [92, 78, 32], strength: 0.35, cells: 3, octaves: 3 });
  grungeTint(ctx, size, { color: [140, 128, 90], strength: 0.18, cells: 5, octaves: 2 });

  // Légère variation verticale (bandes de papier peint / lés).
  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    ctx.fillRect(x, 0, 64, size);
  }

  // Taches d'humidité, du diffus au franc.
  for (let i = 0; i < 10; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 30 + Math.random() * 90, '70,60,20', 0.18);
  }
  for (let i = 0; i < 5; i++) {
    stain(ctx, size, Math.random() * size, size * (0.6 + Math.random() * 0.4), 20 + Math.random() * 50, '30,25,10', 0.24);
  }

  addNoise(ctx, size, 16);

  const bump = makeCanvas(256);
  const bctx = bump.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  addNoise(bctx, 256, 55);

  // Une tuile = un pan de mur entier (pas de répétition visible dans un même
  // pan). Même repeat que le bump : le flip par instance (voir
  // enableUvVariation) doit tourner les deux ensemble, sinon le relief se
  // désynchronise de la couleur dès qu'un pan est retourné.
  const map = toTexture(canvas, 1, 1);
  const bumpMap = toBumpTexture(bump, 1, 1);

  return enableUvVariation(
    new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.6,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );
}

export function makeCarpetMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#7d6a2e';
  ctx.fillRect(0, 0, size, size);

  // Usure inégale (zones de passage plus sombres/tassées) avant le grain fin.
  // repeat(18,18) sur tout le sol : cells élevé pour que ce soit du grain
  // d'usure, pas une même tache qui reviendrait 18 fois de suite.
  grungeTint(ctx, size, { color: [45, 38, 16], strength: 0.4, cells: 10, octaves: 3 });
  grungeTint(ctx, size, { color: [110, 96, 50], strength: 0.15, cells: 16, octaves: 2 });

  // Motif "moquette de bureau" : petit damier bruité (structure des dalles).
  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const v = Math.random() * 0.14;
      ctx.fillStyle = `rgba(0,0,0,${v})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }

  for (let i = 0; i < 6; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 40 + Math.random() * 100, '20,20,10', 0.25);
  }

  addNoise(ctx, size, 24);

  const bump = makeCanvas(256);
  const bctx = bump.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  addNoise(bctx, 256, 90);

  const map = toTexture(canvas, 18, 18);
  const bumpMap = toBumpTexture(bump, 18, 18);

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.9,
    roughness: 1.0,
    metalness: 0.0,
  });
}

export function makeCeilingMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d8d2b8';
  ctx.fillRect(0, 0, size, size);

  // Jaunissement/humidité diffus avant la grille (nicotine, infiltrations).
  grungeTint(ctx, size, { color: [150, 130, 70], strength: 0.28, cells: 3, octaves: 3 });

  const tile = size / 4;
  ctx.strokeStyle = 'rgba(90,85,60,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tile, 0);
    ctx.lineTo(i * tile, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tile);
    ctx.lineTo(size, i * tile);
    ctx.stroke();
  }

  // Quelques dalles tachées / sombres.
  for (let i = 0; i < 5; i++) {
    const tx = Math.floor(Math.random() * 4) * tile;
    const ty = Math.floor(Math.random() * 4) * tile;
    stain(ctx, size, tx + tile / 2, ty + tile / 2, tile * 0.6, '60,55,30', 0.3);
  }

  addNoise(ctx, size, 14);

  const map = toTexture(canvas, 3, 3);

  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.95,
    metalness: 0.0,
  });
}

export function makeLightStripMaterial(color = 0xfff6d8) {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
  });
}

// ---------------------------------------------------------------------------
// Pool rooms : carrelage blanc/crème humide, joints de mortier, quelques
// carreaux tachés ou légèrement décolorés.
// ---------------------------------------------------------------------------
function tileCanvas({ base, grout, stainColor, tilesPerSide = 8, stainCount = 5 }) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // cells plus élevé = grain plus fin : un carrelage peut répéter sa grille
  // (réaliste), mais pas la même grosse tache organique à chaque répétition.
  grungeTint(ctx, size, { color: [70, 75, 55], strength: 0.14, cells: 9, octaves: 3 });

  const cell = size / tilesPerSide;
  for (let y = 0; y < tilesPerSide; y++) {
    for (let x = 0; x < tilesPerSide; x++) {
      if (Math.random() < 0.08) {
        ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  ctx.strokeStyle = grout;
  ctx.lineWidth = 2.5;
  for (let i = 0; i <= tilesPerSide; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  for (let i = 0; i < stainCount; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 30 + Math.random() * 70, stainColor, 0.16);
  }
  addNoise(ctx, size, 8);
  return canvas;
}

export function makePoolTileMaterial() {
  const canvas = tileCanvas({ base: '#d9d3bf', grout: 'rgba(140,135,110,0.55)', stainColor: '110,120,90' });
  const map = toTexture(canvas, 3.5, 1.6);
  return enableUvVariation(new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.05 }), { flip: false });
}

export function makePoolFloorMaterial() {
  const canvas = tileCanvas({ base: '#c3bda3', grout: 'rgba(90,95,75,0.6)', stainColor: '70,90,70', tilesPerSide: 10, stainCount: 9 });
  const map = toTexture(canvas, 12, 12);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.08 });
}

export function makePoolCeilingMaterial() {
  const canvas = tileCanvas({ base: '#e6e1cd', grout: 'rgba(150,145,120,0.4)', stainColor: '120,120,95', tilesPerSide: 6, stainCount: 4 });
  const map = toTexture(canvas, 3, 3);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

// Eau peu profonde qui recouvre le sol des pool rooms : teinte translucide +
// ridules animées (deux calques de bruit qui dérivent à des vitesses
// différentes), assez brillante pour accrocher les reflets des néons.
export function makeWaterMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6f9aa0';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 40 + Math.random() * 90, '210,235,235', 0.08);
  }
  addNoise(ctx, size, 10);
  const map = toTexture(canvas, 6, 6);

  const bump = makeCanvas(256);
  const bctx = bump.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    stain(bctx, 256, Math.random() * 256, Math.random() * 256, 20 + Math.random() * 40, '255,255,255', 0.2);
  }
  const bumpMap = toBumpTexture(bump, 9, 9);

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.25,
    color: 0xbfe4e8,
    transparent: true,
    opacity: 0.62,
    roughness: 0.12,
    metalness: 0.05,
    depthWrite: false,
  });
  // Deux calques de bruit qui dérivent à vitesses différentes pour casser la
  // répétition — on garde une référence pour les animer depuis world.js.
  mat.userData.animatedMaps = [map, bumpMap];
  return mat;
}

// ---------------------------------------------------------------------------
// Hôtel : façade à fenêtres (certaines allumées), sol de cour pavée.
// ---------------------------------------------------------------------------
export function makeHotelFacadeMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cfc9bd';
  ctx.fillRect(0, 0, size, size);
  addNoise(ctx, size, 6);

  const cols = 2;
  const rows = 2;
  const padX = size / cols;
  const padY = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * padX + padX * 0.18;
      const wy = r * padY + padY * 0.18;
      const ww = padX * 0.64;
      const wh = padY * 0.6;
      ctx.fillStyle = '#2a2a26';
      ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      const roll = Math.random();
      let pane = '#12151c';
      if (roll < 0.3) pane = '#f4d98a';
      else if (roll < 0.45) pane = '#9fc7e8';
      ctx.fillStyle = pane;
      ctx.fillRect(wx, wy, ww, wh);
      if (pane !== '#12151c') {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(wx, wy, ww, wh * 0.3);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy + wh / 2 - 1, ww, 2);
    }
  }
  const map = toTexture(canvas, 2.4, 4.2);
  return enableUvVariation(new THREE.MeshStandardMaterial({ map, roughness: 0.75, metalness: 0.05 }), { flip: false });
}

export function makeCourtyardFloorMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3a3c';
  ctx.fillRect(0, 0, size, size);
  const cell = size / 6;
  ctx.strokeStyle = 'rgba(220,220,215,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  addNoise(ctx, size, 10);
  const map = toTexture(canvas, 5, 5);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.1 });
}

// ---------------------------------------------------------------------------
// Quartier pavillonnaire : mur-ciel peint (nuages), pelouse + allée, stuc.
// ---------------------------------------------------------------------------
export function makeSkyCloudsMaterial() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bfe0e6');
  sky.addColorStop(1, '#e7ecd9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  function cloud(cx, cy, scale) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const puffs = [
      [0, 0, 1], [0.6, -0.15, 0.75], [-0.6, -0.1, 0.7],
      [0.25, 0.15, 0.8], [-0.3, 0.18, 0.7],
    ];
    puffs.forEach(([dx, dy, s]) => {
      ctx.beginPath();
      ctx.ellipse(cx + dx * scale, cy + dy * scale, s * scale, s * scale * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  for (let i = 0; i < 9; i++) {
    cloud(Math.random() * w, h * (0.12 + Math.random() * 0.4), 34 + Math.random() * 40);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 1);
  return enableUvVariation(new THREE.MeshBasicMaterial({ map, toneMapped: false }), { flip: false });
}

export function makeGrassPathMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6f9a4c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 40},${70 + Math.random() * 50},${30 + Math.random() * 30},0.5)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.fillStyle = '#9a9284';
  ctx.fillRect(size * 0.42, 0, size * 0.16, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();
  const map = toTexture(canvas, 7, 7);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function makeHouseMaterial(hue = 96) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `hsl(${hue}, 32%, 62%)`;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = `hsla(${hue}, 30%, 40%, 0.25)`;
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  addNoise(ctx, size, 6);
  const map = toTexture(canvas, 2, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

export function makeRoofMaterial() {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3b3229';
  ctx.fillRect(0, 0, size, size);
  addNoise(ctx, size, 10);
  const map = toTexture(canvas, 2, 2);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.DoubleSide });
}

export function makeWindowDecalMaterial(color = 0xffdf9e) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
}

export function makeDoorDecalMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x5a3b2b, roughness: 0.7, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------------------
// Niveau "Kitty" : rose poudré, papier peint à motifs doux, miroirs ovales.
// ---------------------------------------------------------------------------
export function makeKittyWallpaperMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9a9c6';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 16 + Math.random() * 20;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 1.4, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 40 + Math.random() * 60, '255,255,255', 0.08);
  }
  addNoise(ctx, size, 8);

  const map = toTexture(canvas, 1, 1);
  return enableUvVariation(new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.05 }));
}

export function makeKittyCarpetMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b06a8c';
  ctx.fillRect(0, 0, size, size);
  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const v = Math.random() * 0.12;
      ctx.fillStyle = `rgba(0,0,0,${v})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  addNoise(ctx, size, 16);
  const map = toTexture(canvas, 18, 18);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function makeKittyCeilingMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5dbe8';
  ctx.fillRect(0, 0, size, size);
  const tile = size / 4;
  ctx.strokeStyle = 'rgba(190,140,165,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tile, 0);
    ctx.lineTo(i * tile, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tile);
    ctx.lineTo(size, i * tile);
    ctx.stroke();
  }
  addNoise(ctx, size, 8);
  const map = toTexture(canvas, 3, 3);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

export function makeMirrorDecalMaterial() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#cfe4ea');
  g.addColorStop(0.5, '#8fa7ae');
  g.addColorStop(1, '#5c6d73');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(size * 0.2, 0);
  ctx.lineTo(size * 0.4, 0);
  ctx.lineTo(size * 0.05, size);
  ctx.lineTo(0, size * 0.8);
  ctx.closePath();
  ctx.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.15, metalness: 0.6, side: THREE.DoubleSide });
}
