// Toutes les textures sont générées en canvas (pas de fichiers externes à
// charger, donc rien à télécharger et un build 100% autonome). Un module par
// thème (voir zones.js) : chaque fichier ne connaît que ses propres matériaux,
// les helpers de bruit/texture partagés vivent dans noise.js et
// texture-utils.js. Ce fichier ne fait que ré-exporter, pour que le reste du
// code importe toujours depuis './materials/index.js' sans se soucier de la
// découpe interne.

export { makeLightStripMaterial } from './common.js';
export { makeWallpaperMaterial, makeCarpetMaterial, makeCeilingMaterial } from './backrooms.js';
export { makePoolTileMaterial, makePoolFloorMaterial, makePoolCeilingMaterial, makeWaterMaterial } from './pool.js';
export { makeHotelFacadeMaterial, makeCourtyardFloorMaterial } from './hotel.js';
export {
  makeSkyCloudsMaterial,
  makeGrassPathMaterial,
  makeHouseMaterial,
  makeRoofMaterial,
  makeWindowDecalMaterial,
  makeDoorDecalMaterial,
} from './neighborhood.js';
export {
  makeKittyWallpaperMaterial,
  makeKittyCarpetMaterial,
  makeKittyCeilingMaterial,
  makeMirrorDecalMaterial,
} from './kitty.js';
