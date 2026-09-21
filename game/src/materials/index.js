// Toutes les textures sont générées en canvas (pas de fichiers externes à
// charger, donc rien à télécharger et un build 100% autonome). Ce fichier ne
// fait que ré-exporter, pour que le reste du code importe toujours depuis
// './materials/index.js' sans se soucier de la découpe interne.

export {
  makeAsphaltMaterial,
  makeParkingLineMaterial,
  makeBrickMaterial,
  makeWallPaintMaterial,
  makeShopFloorMaterial,
  makeWoodMaterial,
  makeGlassMaterial,
  makeMetalMaterial,
  makeChalkboardMaterial,
  makeSignMaterial,
  makeDoorMaterial,
  makePotMaterial,
  makeFoliageMaterial,
  makeCarPaintMaterial,
  makeFrameMaterial,
  makeBarkMaterial,
  makeFabricMaterial,
  makeNightSkyMaterial,
} from './shop.js';
