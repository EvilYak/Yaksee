import * as THREE from 'three';
import { makeCanvas, addNoise, stain } from './noise.js';
import { toTexture, enableUvVariation } from './texture-utils.js';

// ---------------------------------------------------------------------------
// Niveau "Kitty" : rose poudré, papier peint à motifs doux, miroirs ovales.
// ---------------------------------------------------------------------------
export function makeKittyWallpaperMaterial() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9a9c6';
  ctx.fillRect(0, 0, size, size);

  // Des bulles alignées en quinconce, toutes de même taille et même
  // orientation : un vrai motif de papier peint répétitif, pas un nuage de
  // formes posées au hasard qui se chevauchent ("bordélique").
  const cols = 5;
  const rows = 4;
  const cellW = size / cols;
  const cellH = size / rows;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let ry = -1; ry <= rows; ry++) {
    const offsetX = ry % 2 === 0 ? 0 : cellW / 2;
    for (let rx = -1; rx <= cols; rx++) {
      const cx = rx * cellW + cellW / 2 + offsetX;
      const cy = ry * cellH + cellH / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.22, cellH * 0.32, Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 6; i++) {
    stain(ctx, size, Math.random() * size, Math.random() * size, 40 + Math.random() * 60, '255,255,255', 0.06);
  }
  addNoise(ctx, size, 8);

  const map = toTexture(canvas, 1, 1);
  // flip: false — les bulles sont inclinées à angle fixe ; les transposer
  // par instance les ferait pivoter à 90° au lieu de garder l'inclinaison
  // voulue (même bug que le chevron des backrooms).
  return enableUvVariation(new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.05 }), { flip: false });
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
