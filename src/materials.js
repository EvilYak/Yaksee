import * as THREE from 'three';

// Toutes les textures sont générées en canvas (pas de fichiers externes à charger,
// donc rien à télécharger et un build 100% autonome).

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function addNoise(ctx, size, amount, alpha = 0.06) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
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

export function makeWallpaperMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b7a24a';
  ctx.fillRect(0, 0, size, size);

  // Légère variation verticale (bandes de papier peint).
  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
    ctx.fillRect(x, 0, 64, size);
  }

  // Taches d'humidité.
  for (let i = 0; i < 10; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 30 + Math.random() * 90, '70,60,20', 0.18);
  }
  for (let i = 0; i < 4; i++) {
    stain(ctx, size, Math.random() * size, size * (0.6 + Math.random() * 0.4), 20 + Math.random() * 50, '30,25,10', 0.22);
  }

  addNoise(ctx, size, 14);

  const bump = makeCanvas(256);
  const bctx = bump.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  addNoise(bctx, 256, 30);

  const map = toTexture(canvas, 4, 2.2);
  const bumpMap = toBumpTexture(bump, 4, 2.2);

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.6,
    roughness: 0.92,
    metalness: 0.0,
  });
}

export function makeCarpetMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#7d6a2e';
  ctx.fillRect(0, 0, size, size);

  // Motif "moquette de bureau" : petit damier bruité.
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

  addNoise(ctx, size, 20);

  const bump = makeCanvas(256);
  const bctx = bump.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  addNoise(bctx, 256, 60);

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

  addNoise(ctx, size, 10);

  const map = toTexture(canvas, 3, 3);

  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.95,
    metalness: 0.0,
  });
}

export function makeLightStripMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xfff6d8,
    toneMapped: false,
  });
}
