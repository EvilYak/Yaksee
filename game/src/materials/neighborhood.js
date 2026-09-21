import * as THREE from 'three';
import { makeCanvas, addNoise } from './noise.js';
import { toTexture, enableUvVariation } from './texture-utils.js';

// ---------------------------------------------------------------------------
// Quartier pavillonnaire : mur-ciel peint (nuages), pelouse + allée, stuc.
// ---------------------------------------------------------------------------
export function makeSkyCloudsMaterial() {
  // Le pan de mur physique est étroit et haut (3.2 m de large pour 6.8 m de
  // haut), alors qu'un canvas "paysage" classique est large et bas : avec un
  // repeat(1,1), le mapping UV écrase l'image dans l'autre sens — les nuages,
  // dessinés espacés sur toute la largeur d'un canvas large, se retrouvaient
  // tous compressés dans la largeur étroite du mur et se touchaient. Le canvas
  // est donc "portrait" ici, au même ratio que le pan de mur, pour que les
  // nuages gardent leurs proportions et leur espacement une fois posés.
  const w = 384;
  const h = 816;
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
  // Peu de nuages, bien espacés sur la hauteur du pan : mieux vaut 4 nuages
  // clairement détachés qu'une nappe blanche continue.
  const rows = 4;
  for (let i = 0; i < rows; i++) {
    const cy = (h / rows) * (i + 0.5) + (Math.random() - 0.5) * (h / rows) * 0.4;
    const cx = w * (0.3 + Math.random() * 0.4);
    cloud(cx, cy, 30 + Math.random() * 20);
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

// hue/sat pilotables : sans ça, toutes les maisons du quartier partagent le
// même toit brun uniforme et se ressemblent toutes, alors que les façades
// (makeHouseMaterial) varient déjà de teinte d'une maison à l'autre.
export function makeRoofMaterial(hue = 26, sat = 24) {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `hsl(${hue}, ${sat}%, 19%)`;
  ctx.fillRect(0, 0, size, size);

  // Rangées de bardeaux en quinconce (pas juste une teinte plate).
  const rowH = size / 9;
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, 10%, 0.55)`;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * rowH);
    ctx.lineTo(size, i * rowH);
    ctx.stroke();
  }
  for (let row = 0; row < 9; row++) {
    const offset = row % 2 === 0 ? 0 : size / 12;
    for (let x = offset; x < size; x += size / 6) {
      ctx.beginPath();
      ctx.moveTo(x, row * rowH);
      ctx.lineTo(x, (row + 1) * rowH);
      ctx.stroke();
    }
  }

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
