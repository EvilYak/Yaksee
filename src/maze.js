// Génération procédurale du plan : labyrinthe parfait (recursive backtracker),
// relâché avec des boucles et quelques salles ouvertes, puis quatre "poches"
// thématiques (pool rooms, hôtel, quartier pavillonnaire, niveau kitty) sont
// évidées ou simplement reliées dans les coins de la grille (voir zones.js).

import { ZONES, themeAt as zoneThemeAt } from './zones.js';

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function carveOpenBlock(vWall, hWall, size, x0, y0, w, h) {
  for (let x = x0; x <= x0 + w - 2; x++) {
    for (let y = y0; y < y0 + h; y++) {
      if (x >= 0 && x < size - 1 && y >= 0 && y < size) vWall[x][y] = 0;
    }
  }
  for (let x = x0; x < x0 + w; x++) {
    for (let y = y0; y <= y0 + h - 2; y++) {
      if (x >= 0 && x < size && y >= 0 && y < size - 1) hWall[x][y] = 0;
    }
  }
}

function forceOpenBorder(vWall, hWall, size, x0, y0, w, h, rand, count) {
  const edges = [];
  if (x0 - 1 >= 0) for (let y = y0; y < y0 + h; y++) edges.push(['v', x0 - 1, y]);
  if (x0 + w - 1 <= size - 2) for (let y = y0; y < y0 + h; y++) edges.push(['v', x0 + w - 1, y]);
  if (y0 - 1 >= 0) for (let x = x0; x < x0 + w; x++) edges.push(['h', x, y0 - 1]);
  if (y0 + h - 1 <= size - 2) for (let x = x0; x < x0 + w; x++) edges.push(['h', x, y0 + h - 1]);

  for (let i = 0; i < count && edges.length; i++) {
    const idx = Math.floor(rand() * edges.length);
    const [kind, ex, ey] = edges.splice(idx, 1)[0];
    if (kind === 'v') vWall[ex][ey] = 0;
    else hWall[ex][ey] = 0;
  }
}

export function generateMaze(size, cellSize, seed = 1337) {
  const rand = mulberry32(seed);
  // vWall[x][y] = mur entre (x,y) et (x+1,y) ; hWall[x][y] = mur entre (x,y) et (x,y+1)
  const vWall = Array.from({ length: size - 1 }, () => new Uint8Array(size).fill(1));
  const hWall = Array.from({ length: size }, () => new Uint8Array(size - 1).fill(1));
  const visited = Array.from({ length: size }, () => new Uint8Array(size));

  const stack = [[0, 0]];
  visited[0][0] = 1;

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = [];
    if (cx > 0 && !visited[cx - 1][cy]) neighbors.push([cx - 1, cy, 'W']);
    if (cx < size - 1 && !visited[cx + 1][cy]) neighbors.push([cx + 1, cy, 'E']);
    if (cy > 0 && !visited[cx][cy - 1]) neighbors.push([cx, cy - 1, 'N']);
    if (cy < size - 1 && !visited[cx][cy + 1]) neighbors.push([cx, cy + 1, 'S']);

    if (!neighbors.length) {
      stack.pop();
      continue;
    }

    const [nx, ny, dir] = neighbors[Math.floor(rand() * neighbors.length)];
    if (dir === 'E') vWall[cx][cy] = 0;
    if (dir === 'W') vWall[nx][ny] = 0;
    if (dir === 'S') hWall[cx][cy] = 0;
    if (dir === 'N') hWall[nx][ny] = 0;
    visited[nx][ny] = 1;
    stack.push([nx, ny]);
  }

  // Casse quelques murs pour créer des boucles / recoins ouverts (moins "labyrinthe pur").
  const loopChance = 0.14;
  for (let x = 0; x < size - 1; x++) {
    for (let y = 0; y < size; y++) {
      if (vWall[x][y] && rand() < loopChance) vWall[x][y] = 0;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size - 1; y++) {
      if (hWall[x][y] && rand() < loopChance) hWall[x][y] = 0;
    }
  }

  // Quelques salles ouvertes (blocs rectangulaires vidés) type "salle humide".
  const roomCount = Math.max(3, Math.floor(size / 6));
  for (let i = 0; i < roomCount; i++) {
    const w = 2 + Math.floor(rand() * 3);
    const h = 2 + Math.floor(rand() * 3);
    const ox = Math.floor(rand() * Math.max(1, size - w - 1));
    const oy = Math.floor(rand() * Math.max(1, size - h - 1));
    for (let x = ox; x < ox + w - 1; x++) {
      for (let y = oy; y < oy + h; y++) {
        if (x >= 0 && x < size - 1 && y >= 0 && y < size) vWall[x][y] = 0;
      }
    }
    for (let x = ox; x < ox + w; x++) {
      for (let y = oy; y < oy + h - 1; y++) {
        if (x >= 0 && x < size && y >= 0 && y < size - 1) hWall[x][y] = 0;
      }
    }
  }

  // Poches thématiques : les zones "ouvertes" (hôtel, quartier) sont évidées
  // pour former une grande salle, avec quelques entrées forcées sur leur pourtour.
  for (const name in ZONES) {
    const zone = ZONES[name];
    if (!zone.open) continue;
    const [x0, y0, w, h] = zone.rect;
    carveOpenBlock(vWall, hWall, size, x0, y0, w, h);
    forceOpenBorder(vWall, hWall, size, x0, y0, w, h, rand, 3);
  }

  return {
    size,
    cellSize,
    vWall,
    hWall,
    hasWallE(x, y) {
      if (x < 0 || x >= size - 1 || y < 0 || y >= size) return true;
      return !!vWall[x][y];
    },
    hasWallW(x, y) {
      return this.hasWallE(x - 1, y);
    },
    hasWallS(x, y) {
      if (x < 0 || x >= size || y < 0 || y >= size - 1) return true;
      return !!hWall[x][y];
    },
    hasWallN(x, y) {
      return this.hasWallS(x, y - 1);
    },
    themeAt(cx, cy) {
      return zoneThemeAt(cx, cy);
    },
    // Centre du monde: le joueur démarre au centre de la grille, en zone backrooms.
    startCell() {
      return [Math.floor(size / 2), Math.floor(size / 2)];
    },
    // Direction ouverte au départ, pour ne pas spawn nez contre un mur.
    startYaw() {
      const [cx, cy] = this.startCell();
      const options = [
        { open: !this.hasWallN(cx, cy), yaw: 0 },
        { open: !this.hasWallS(cx, cy), yaw: Math.PI },
        { open: !this.hasWallE(cx, cy), yaw: -Math.PI / 2 },
        { open: !this.hasWallW(cx, cy), yaw: Math.PI / 2 },
      ].filter((o) => o.open);
      if (!options.length) return 0;
      return options[Math.floor(rand() * options.length)].yaw;
    },
  };
}
