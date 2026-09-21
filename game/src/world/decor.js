import * as THREE from 'three';
import { makeHouseMaterial, makeWindowDecalMaterial, makeDoorDecalMaterial } from '../materials/index.js';

// Vrai toit à deux pans (deux plaques inclinées + pignons triangulaires), au
// lieu d'un simple pavé posé à plat.
export function buildRoof(width, wallHeight, depth, roofRise, mat) {
  const group = new THREE.Group();
  const halfW = width / 2;
  const slopeLen = Math.sqrt(halfW * halfW + roofRise * roofRise);
  const angle = Math.atan2(roofRise, halfW);
  const overhang = 0.35;
  const slabGeo = new THREE.BoxGeometry(slopeLen + overhang, 0.1, depth + overhang);

  const left = new THREE.Mesh(slabGeo, mat);
  left.position.set(-halfW / 2, wallHeight + roofRise / 2, 0);
  left.rotation.z = angle;
  group.add(left);

  const right = new THREE.Mesh(slabGeo, mat);
  right.position.set(halfW / 2, wallHeight + roofRise / 2, 0);
  right.rotation.z = -angle;
  group.add(right);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfW, 0);
  gableShape.lineTo(halfW, 0);
  gableShape.lineTo(0, roofRise);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);

  const gableFront = new THREE.Mesh(gableGeo, mat);
  gableFront.position.set(0, wallHeight, depth / 2);
  group.add(gableFront);

  const gableBack = new THREE.Mesh(gableGeo, mat);
  gableBack.position.set(0, wallHeight, -depth / 2);
  gableBack.rotation.y = Math.PI;
  group.add(gableBack);

  // Faîtière : couvre la jonction entre les deux pans (sinon un petit interstice
  // reste visible à l'épaisseur des plaques, comme un toit sans faîtage réel).
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, depth + overhang + 0.05), mat);
  ridge.position.set(0, wallHeight + roofRise, 0);
  group.add(ridge);

  return group;
}

// Porte avec un vrai battant en relief (pas un simple décalque plat) + poignée.
export function buildDoor(width, height, mat) {
  const group = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), mat);
  panel.position.z = 0.04;
  group.add(panel);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8c98a, metalness: 0.7, roughness: 0.3 }),
  );
  handle.position.set(width * 0.32, 0, 0.11);
  group.add(handle);

  return group;
}

// Fenêtre avec cadre saillant + appui, la vitre elle-même a un peu d'épaisseur.
export function buildWindow(width, height, paneColor, frameMat) {
  const group = new THREE.Group();

  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.06), frameMat);
  group.add(frame);

  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), makeWindowDecalMaterial(paneColor));
  pane.position.z = 0.025;
  group.add(pane);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 0.06, 0.16), frameMat);
  sill.position.set(0, -height / 2 - 0.06, 0.08);
  group.add(sill);

  return group;
}

export function buildHouse({ width, wallHeight, depth, roofRise, hue, roofMat }) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), makeHouseMaterial(hue));
  body.position.y = wallHeight / 2;
  group.add(body);

  group.add(buildRoof(width, wallHeight, depth, roofRise, roofMat));

  const door = buildDoor(0.9, 1.9, makeDoorDecalMaterial());
  door.position.set(0, 0.95, depth / 2);
  group.add(door);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.7 });
  const litColors = [0xffdf9e, 0xffdf9e, 0x9fc7e8];
  [-1, 1].forEach((side) => {
    const lit = Math.random() < 0.65;
    const c = lit ? litColors[Math.floor(Math.random() * litColors.length)] : 0x2a2a24;
    const win = buildWindow(0.85, 1.05, c, frameMat);
    win.position.set(side * width * 0.28, wallHeight * 0.62, depth / 2);
    group.add(win);
  });

  return group;
}

// Miroir avec un vrai cadre en relief (tore) au lieu d'un simple disque plat.
export function buildMirror(glassMat, frameMat) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), glassMat);
  group.add(glass);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 8, 24), frameMat);
  frame.position.z = -0.015;
  group.add(frame);
  group.scale.set(1, 1.4, 1);
  return group;
}

export function buildStreetlight() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x27282a, roughness: 0.6, metalness: 0.4 }),
  );
  pole.position.y = 1.55;
  group.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, toneMapped: false }),
  );
  bulb.position.y = 3.15;
  group.add(bulb);

  return group;
}
