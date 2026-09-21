import * as THREE from 'three';
import { makeCanvas, addNoise, grungeTint, stain } from './noise.js';
import { toTexture, toBumpTexture, enableUvVariation } from './texture-utils.js';

// Le motif "papier peint" reconnaissable des Backrooms Level 0 : une ogive
// verticale élancée (largeur << hauteur, pas un "nœud papillon" horizontal)
// répétée en quinconce comme un vrai papier peint imprimé, pas juste du
// bruit — c'est ce qui manquait pour que le mur soit identifiable au premier
// coup d'œil au lieu de lire comme une tache informe.
function drawOgiveMotif(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.quadraticCurveTo(cx + w, cy - h * 0.32, cx, cy);
  ctx.quadraticCurveTo(cx - w, cy - h * 0.32, cx, cy - h);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + h);
  ctx.quadraticCurveTo(cx + w, cy + h * 0.32, cx, cy);
  ctx.quadraticCurveTo(cx - w, cy + h * 0.32, cx, cy + h);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawWallpaperPattern(ctx, size, { cols, rows, color, alpha, lineWidth }) {
  const cellW = size / cols;
  const cellH = size / rows;
  ctx.save();
  ctx.strokeStyle = `rgba(${color},${alpha})`;
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.lineWidth = lineWidth;
  for (let ry = -1; ry <= rows; ry++) {
    const offsetX = ry % 2 === 0 ? 0 : cellW / 2;
    for (let rx = -1; rx <= cols; rx++) {
      const cx = rx * cellW + cellW / 2 + offsetX;
      const cy = ry * cellH + cellH / 2;
      drawOgiveMotif(ctx, cx, cy, cellW * 0.22, cellH * 0.44);
    }
  }
  ctx.restore();
}

export function makeWallpaperMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b7a24a';
  ctx.fillRect(0, 0, size, size);

  // Motif imprimé avant le vieillissement (taches/bruit par-dessus, comme un
  // vrai papier peint qui se salit après avoir été posé). Deux passes légèrement
  // décalées façon gaufrage : un trait clair en haut-gauche, un trait sombre en
  // bas-droite du même motif, pour un léger relief avant même le bump map.
  ctx.save();
  ctx.translate(-1, -1);
  drawWallpaperPattern(ctx, size, { cols: 10, rows: 8, color: '206,190,130', alpha: 0.22, lineWidth: 1.6 });
  ctx.restore();
  ctx.save();
  ctx.translate(1, 1);
  drawWallpaperPattern(ctx, size, { cols: 10, rows: 8, color: '80,66,28', alpha: 0.38, lineWidth: 1.6 });
  ctx.restore();

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
