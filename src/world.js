import * as THREE from 'three';
import { makeWallpaperMaterial, makeCarpetMaterial, makeCeilingMaterial, makeLightStripMaterial } from './materials.js';

export const WALL_HEIGHT = 2.7;
const WALL_THICKNESS = 0.12;

export function buildWorld(maze) {
  const { size, cellSize: C } = maze;
  const group = new THREE.Group();

  const wallpaper = makeWallpaperMaterial();
  const carpet = makeCarpetMaterial();
  const ceilingMat = makeCeilingMaterial();
  const lightMat = makeLightStripMaterial();

  // ---------- Sol & plafond ----------
  const extent = size * C;
  const floorGeo = new THREE.PlaneGeometry(extent, extent);
  const floor = new THREE.Mesh(floorGeo, carpet);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((size - 1) * C * 0.5, 0, (size - 1) * C * 0.5);
  group.add(floor);

  const ceiling = new THREE.Mesh(floorGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((size - 1) * C * 0.5, WALL_HEIGHT, (size - 1) * C * 0.5);
  group.add(ceiling);

  // ---------- Murs (InstancedMesh : un draw call par orientation) ----------
  const vGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, C);
  const hGeo = new THREE.BoxGeometry(C, WALL_HEIGHT, WALL_THICKNESS);

  const vPositions = [];
  const hPositions = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (maze.hasWallE(x, y)) vPositions.push([x * C + C / 2, y * C]);
      if (maze.hasWallS(x, y)) hPositions.push([x * C, y * C + C / 2]);
    }
  }
  for (let x = 0; x < size; x++) hPositions.push([x * C, -C / 2]); // bordure nord
  for (let y = 0; y < size; y++) vPositions.push([-C / 2, y * C]); // bordure ouest

  const vMesh = new THREE.InstancedMesh(vGeo, wallpaper, vPositions.length);
  const dummy = new THREE.Object3D();
  vPositions.forEach(([px, pz], i) => {
    dummy.position.set(px, WALL_HEIGHT / 2, pz);
    dummy.updateMatrix();
    vMesh.setMatrixAt(i, dummy.matrix);
  });
  vMesh.instanceMatrix.needsUpdate = true;
  group.add(vMesh);

  const hMesh = new THREE.InstancedMesh(hGeo, wallpaper, hPositions.length);
  hPositions.forEach(([px, pz], i) => {
    dummy.position.set(px, WALL_HEIGHT / 2, pz);
    dummy.updateMatrix();
    hMesh.setMatrixAt(i, dummy.matrix);
  });
  hMesh.instanceMatrix.needsUpdate = true;
  group.add(hMesh);

  // ---------- Néons plafonniers ----------
  const stripGeo = new THREE.PlaneGeometry(1.7, 0.22);
  const stripPositions = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if ((x + y) % 3 === 0) {
        stripPositions.push([x * C, y * C, (x * 7 + y * 13) % 2 === 0]);
      }
    }
  }
  const strips = new THREE.InstancedMesh(stripGeo, lightMat, stripPositions.length);
  strips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(stripPositions.length * 3), 3);
  const flickerIdx = [];
  const deadIdx = [];
  const color = new THREE.Color();

  stripPositions.forEach(([px, pz, rotated], i) => {
    dummy.position.set(px, WALL_HEIGHT - 0.04, pz);
    dummy.rotation.set(-Math.PI / 2, 0, rotated ? Math.PI / 2 : 0);
    dummy.updateMatrix();
    strips.setMatrixAt(i, dummy.matrix);

    const r = Math.random();
    if (r < 0.08) {
      deadIdx.push(i);
      color.setRGB(0.08, 0.08, 0.07);
    } else if (r < 0.28) {
      flickerIdx.push(i);
      color.setRGB(1, 0.95, 0.8);
    } else {
      color.setRGB(1, 0.95, 0.8);
    }
    strips.setColorAt(i, color);
  });
  strips.instanceMatrix.needsUpdate = true;
  strips.instanceColor.needsUpdate = true;
  group.add(strips);

  // ---------- Lumières réelles : ambiance globale + halo suivant la caméra ----------
  // Unités photométriques (candela / lux) : le rendu physique de three.js veut des
  // valeurs bien plus hautes que l'ancien modèle "arbitraire".
  const hemi = new THREE.HemisphereLight(0xfff3d0, 0x2a2410, 2.6);
  group.add(hemi);

  const followLight = new THREE.PointLight(0xfff2cc, 24, 10, 2);
  followLight.position.set(0, 1.65, 0);
  group.add(followLight);

  const fog = new THREE.FogExp2(0x8c8256, 0.055);

  let t = 0;
  function update(dt, cameraPosition) {
    t += dt;
    followLight.position.x = cameraPosition.x;
    followLight.position.z = cameraPosition.z;
    followLight.intensity = 23 + Math.sin(t * 11) * 1.4 + Math.sin(t * 3.1) * 1;

    flickerIdx.forEach((i) => {
      const n = Math.sin(t * 14 + i) * Math.sin(t * 3.3 + i * 7.1);
      const on = n > -0.35 || Math.sin(t * 0.6 + i * 2.7) > 0.85;
      const b = on ? 0.85 + Math.random() * 0.15 : 0.05 + Math.random() * 0.1;
      color.setRGB(b, b * 0.95, b * 0.8);
      strips.setColorAt(i, color);
    });
    strips.instanceColor.needsUpdate = true;
  }

  return { group, fog, update, cellSize: C, size, startWorldPos: cellToWorld(maze.startCell(), C) };
}

export function cellToWorld([cx, cy], cellSize) {
  return new THREE.Vector3(cx * cellSize, 1.65, cy * cellSize);
}
