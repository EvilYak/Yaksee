import * as THREE from 'three';
import { makeCanvas, addNoise, grungeTint, stain } from './noise.js';
import { toTexture, toBumpTexture, enableUvVariation } from './texture-utils.js';

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
  // répétition — on garde une référence pour les animer depuis world/.
  mat.userData.animatedMaps = [map, bumpMap];
  return mat;
}
