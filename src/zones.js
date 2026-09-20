// Découpage du monde en zones thématiques : quatre poches dans les coins
// d'une grande grille, reliées entre elles par le labyrinthe "backrooms"
// classique qui occupe le reste de la carte.

export const GRID_SIZE = 50;
export const CELL_SIZE = 3.2;
export const DEFAULT_THEME = 'backrooms';
export const DEFAULT_WALL_HEIGHT = 2.7;

// rect = [x0, y0, w, h] en coordonnées de cellules.
// open = true -> l'intérieur du rectangle est entièrement dégagé (grande salle)
// au lieu de garder la structure labyrinthique.
export const ZONES = {
  pool: {
    rect: [34, 2, 14, 14],
    open: false,
    wallHeight: DEFAULT_WALL_HEIGHT,
  },
  hotel: {
    rect: [34, 34, 14, 14],
    open: true,
    wallHeight: 6.4,
  },
  neighborhood: {
    rect: [2, 34, 14, 14],
    open: true,
    wallHeight: 6.8,
  },
  kitty: {
    rect: [2, 2, 14, 14],
    open: false,
    wallHeight: DEFAULT_WALL_HEIGHT,
  },
};

export function themeAt(cx, cy) {
  for (const name in ZONES) {
    const [x0, y0, w, h] = ZONES[name].rect;
    if (cx >= x0 && cx < x0 + w && cy >= y0 && cy < y0 + h) return name;
  }
  return DEFAULT_THEME;
}

export function wallHeightFor(theme) {
  return ZONES[theme] ? ZONES[theme].wallHeight : DEFAULT_WALL_HEIGHT;
}

export function isOpenZone(theme) {
  return !!(ZONES[theme] && ZONES[theme].open);
}
