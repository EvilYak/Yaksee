import * as THREE from 'three';
import { makeCanvas, addNoise } from './noise.js';
import { toTexture, enableUvVariation } from './texture-utils.js';

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
