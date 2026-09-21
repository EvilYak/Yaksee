import * as THREE from 'three';
import {
  makeWallpaperMaterial,
  makeCarpetMaterial,
  makeCeilingMaterial,
  makePoolTileMaterial,
  makePoolFloorMaterial,
  makePoolCeilingMaterial,
  makeHotelFacadeMaterial,
  makeCourtyardFloorMaterial,
  makeSkyCloudsMaterial,
  makeGrassPathMaterial,
  makeKittyWallpaperMaterial,
  makeKittyCarpetMaterial,
  makeKittyCeilingMaterial,
} from '../materials/index.js';
import { DEFAULT_WALL_HEIGHT, wallHeightFor } from '../zones.js';

// Un mur "en dur" (backrooms, kitty) reçoit 3 variantes du même matériau,
// piochées par chunk (voir chunking.js) : sur une InstancedMesh, un seul
// matériau montrerait exactement la même image sur chaque pan, ce qui se
// voit tout de suite comme des "carrés qui se répètent".
export function buildThemeConfig() {
  return {
    backrooms: {
      wall: [makeWallpaperMaterial(), makeWallpaperMaterial(), makeWallpaperMaterial()],
      floor: makeCarpetMaterial(),
      ceiling: makeCeilingMaterial(),
      lightColor: new THREE.Color(0xffffff),
      fog: new THREE.Color(0x8c8256),
      fogDensity: 0.055,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    pool: {
      wall: makePoolTileMaterial(),
      floor: makePoolFloorMaterial(),
      ceiling: makePoolCeilingMaterial(),
      lightColor: new THREE.Color(0xdff2ff),
      fog: new THREE.Color(0x93a8ab),
      fogDensity: 0.05,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    kitty: {
      wall: [makeKittyWallpaperMaterial(), makeKittyWallpaperMaterial(), makeKittyWallpaperMaterial()],
      floor: makeKittyCarpetMaterial(),
      ceiling: makeKittyCeilingMaterial(),
      lightColor: new THREE.Color(0xffd3ec),
      fog: new THREE.Color(0xd9a8c4),
      fogDensity: 0.05,
      wallHeight: DEFAULT_WALL_HEIGHT,
      lights: true,
    },
    hotel: {
      wall: makeHotelFacadeMaterial(),
      floor: makeCourtyardFloorMaterial(),
      ceiling: new THREE.MeshBasicMaterial({ color: 0x14151c, toneMapped: false }),
      lightColor: new THREE.Color(0xbcd4ff),
      fog: new THREE.Color(0x2c3044),
      fogDensity: 0.024,
      wallHeight: wallHeightFor('hotel'),
      lights: false,
    },
    neighborhood: {
      wall: makeSkyCloudsMaterial(),
      floor: makeGrassPathMaterial(),
      ceiling: new THREE.MeshBasicMaterial({ color: 0xcfe6e8, toneMapped: false }),
      lightColor: new THREE.Color(0xfff1d0),
      fog: new THREE.Color(0xdde7d8),
      fogDensity: 0.02,
      wallHeight: wallHeightFor('neighborhood'),
      lights: false,
    },
  };
}
