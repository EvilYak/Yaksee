import * as THREE from 'three';
import { makeCanvas, addNoise, grungeTint } from './noise.js';
import { toTexture, makeLabelTexture } from './texture-utils.js';

// Matériaux de "The Plant Shop" : parking, façade, intérieur boutique. Même
// approche que le reste du projet (textures canvas procédurales, aucun
// fichier à charger), mais palette et motifs propres à une boutique éclairée
// de jour/soir plutôt qu'à un couloir liminal.

export function makeAsphaltMaterial() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2b2e';
  ctx.fillRect(0, 0, size, size);
  grungeTint(ctx, size, { color: [18, 18, 20], strength: 0.35, cells: 5, octaves: 3 });
  addNoise(ctx, size, 14);
  // Granulat clair épars.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 40 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const map = toTexture(c, 10, 10);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.02 });
}

export function makeParkingLineMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xd9cfa3, transparent: true, opacity: 0.75 });
}

export function makeBrickMaterial() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3d33';
  ctx.fillRect(0, 0, size, size);
  const rows = 16;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : rowH * 1.1;
    const cols = 9;
    const colW = size / cols;
    for (let cIdx = -1; cIdx <= cols; cIdx++) {
      const bx = cIdx * colW + offset;
      const by = r * rowH;
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(94 * shade)},${Math.floor(58 * shade)},${Math.floor(46 * shade)})`;
      ctx.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
    }
  }
  grungeTint(ctx, size, { color: [30, 20, 16], strength: 0.2, cells: 4, octaves: 2 });
  addNoise(ctx, size, 10);
  const map = toTexture(c, 4, 2.4);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

export function makeWallPaintMaterial(hex = '#c9a84a') {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  grungeTint(ctx, size, { color: [255, 236, 190], strength: 0.12, cells: 3, octaves: 3 });
  addNoise(ctx, size, 6);
  const map = toTexture(c, 2, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
}

export function makeShopFloorMaterial() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#152a2c';
  ctx.fillRect(0, 0, size, size);
  grungeTint(ctx, size, { color: [8, 16, 18], strength: 0.3, cells: 6, octaves: 3 });
  addNoise(ctx, size, 8);
  const map = toTexture(c, 6, 4);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

export function makeWoodMaterial(hex = '#8a5a34') {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  // Fibres verticales.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, size);
    ctx.stroke();
  }
  grungeTint(ctx, size, { color: [40, 20, 8], strength: 0.15, cells: 4, octaves: 2 });
  addNoise(ctx, size, 6);
  const map = toTexture(c, 2, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
}

// Verre simple (transparence classique, pas de transmission physique) : le
// rendu par transmission (MeshPhysicalMaterial.transmission) recalcule une
// passe de rendu complète par objet et par frame, bien trop coûteux ici
// pour un gain visuel marginal sur une vitre.
export function makeGlassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9fc9d6,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
    metalness: 0.1,
  });
}

export function makeMetalMaterial(hex = '#8a8a8f') {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.65 });
}

// Tableau noir d'arrière-boutique : les recettes viennent telles quelles de
// la référence fournie par l'utilisateur (contenu du jeu, pas une invention).
// `lines` est paramétrable : le même tableau noir sert de liste de prix ici,
// et servait de recettes dans une version précédente de la boutique.
export function makeChalkboardMaterial(lines = ['GRAINES + EAU']) {
  const map = makeLabelTexture({
    width: 640,
    height: 360,
    bg: '#1f3a2c',
    fg: '#e8e6c8',
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 1,
    align: 'left',
    lines,
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
}

export function makeSignMaterial(text, { bg = '#141210', fg = '#e8e0c0', fontSize = 64 } = {}) {
  const map = makeLabelTexture({ width: 768, height: 192, bg, fg, fontSize, lines: [text] });
  return new THREE.MeshBasicMaterial({ map, toneMapped: false });
}

export function makeDoorMaterial(text, { bg = '#4a2e22', fg = '#d9cfa3' } = {}) {
  const map = makeLabelTexture({ width: 256, height: 384, bg, fg, fontSize: 30, lines: text.split('\n') });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
}

export function makePotMaterial() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b56a3f';
  ctx.fillRect(0, 0, size, size);
  grungeTint(ctx, size, { color: [70, 34, 16], strength: 0.25, cells: 4, octaves: 2 });
  addNoise(ctx, size, 8);
  const map = toTexture(c, 1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

export function makeFoliageMaterial(hex = '#3f7a3a') {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  grungeTint(ctx, size, { color: [20, 50, 20], strength: 0.3, cells: 5, octaves: 3 });
  addNoise(ctx, size, 10);
  const map = toTexture(c, 1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.8, flatShading: true });
}

export function makeCarPaintMaterial(hex = '#c7c2b0') {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.5 });
}

// Cadres muraux achetables : de simples dessins au trait sur un fond de
// cadre, pas des photos — l'ambiance "magicien" vient du motif, pas d'une
// image réelle.
export function makeFrameMaterial(variant = null) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0e6c8';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#3a2f1a';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, size - 32, size - 32);
  ctx.strokeStyle = '#141210';
  ctx.fillStyle = '#141210';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (variant === 0) {
    // Chapeau + baguette croisée + étincelle.
    ctx.fillRect(size * 0.34, size * 0.42, size * 0.32, size * 0.2);
    ctx.fillRect(size * 0.26, size * 0.6, size * 0.48, size * 0.07);
    ctx.save();
    ctx.translate(size * 0.5, size * 0.42);
    ctx.rotate(-0.55);
    ctx.fillRect(-size * 0.28, -size * 0.015, size * 0.56, size * 0.03);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(size * 0.72, size * 0.24, size * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.66, size * 0.32, size * 0.015, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 1) {
    // Lapin qui sort du chapeau.
    ctx.fillRect(size * 0.32, size * 0.55, size * 0.36, size * 0.18);
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.42, size * 0.11, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(size * 0.5 + side * size * 0.05, size * 0.22);
      ctx.rotate(side * 0.15);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.025, size * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (variant === 2) {
    // Éventail de cartes.
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(size * 0.5, size * 0.58);
      ctx.rotate(i * 0.22);
      ctx.strokeRect(-size * 0.09, -size * 0.24, size * 0.18, size * 0.28);
      ctx.restore();
    }
  }
  // variant absent/inconnu : cadre vide (juste la bordure), en attente d'achat.

  const map = toTexture(c, 1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

