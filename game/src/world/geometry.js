import * as THREE from 'three';
import { addChunkedInstances } from './chunking.js';

export function rectWorldExtent([x0, y0, w, h], C) {
  const minX = x0 * C - C / 2;
  const maxX = (x0 + w - 1) * C + C / 2;
  const minZ = y0 * C - C / 2;
  const maxZ = (y0 + h - 1) * C + C / 2;
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, h: maxZ - minZ };
}

// Grand plan de sol/plafond avec des trous rectangulaires découpés dessus
// (une poche thématique par zone), plutôt qu'un plan plein qu'il faudrait
// masquer par-dessus.
export function buildFloorWithHoles(size, C, holeRects, material) {
  const half = C / 2;
  const minX = -half;
  const maxX = (size - 1) * C + half;
  const minZ = -half;
  const maxZ = (size - 1) * C + half;
  const shape = new THREE.Shape();
  shape.moveTo(minX, minZ);
  shape.lineTo(maxX, minZ);
  shape.lineTo(maxX, maxZ);
  shape.lineTo(minX, maxZ);
  shape.closePath();
  holeRects.forEach((rect) => {
    const e = rectWorldExtent(rect, C);
    const hole = new THREE.Path();
    hole.moveTo(e.minX, e.minZ);
    hole.lineTo(e.maxX, e.minZ);
    hole.lineTo(e.maxX, e.maxZ);
    hole.lineTo(e.minX, e.maxZ);
    hole.closePath();
    shape.holes.push(hole);
  });
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Toutes les frontières internes de cellules dont le thème appartient à
// `themeSet` — sert à quadriller le plafond (T-bar) et le sol (joints) avec
// de vrais segments 3D plutôt qu'une texture peinte.
export function collectCellEdges(maze, size, C, themeSet) {
  const v = [];
  const h = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!themeSet.has(maze.themeAt(x, y))) continue;
      if (x < size - 1) v.push([x * C + C / 2, y * C]);
      if (y < size - 1) h.push([x * C, y * C + C / 2]);
    }
  }
  return { v, h };
}

export function buildEdgeGridMesh(edges, { thickness, depth, y, color }, C) {
  const gridGroup = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const vGeo = new THREE.BoxGeometry(thickness, depth, C);
  const hGeo = new THREE.BoxGeometry(C, depth, thickness);
  const place = (d, [px, pz]) => d.position.set(px, y, pz);
  addChunkedInstances(gridGroup, edges.v, vGeo, mat, place, C);
  addChunkedInstances(gridGroup, edges.h, hGeo, mat, place, C);
  return gridGroup;
}
