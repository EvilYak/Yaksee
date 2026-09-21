import * as THREE from 'three';

export function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Bump map généré à partir du canvas niveaux de gris (relief léger sans vraie normal map).
export function toBumpTexture(canvas, repeatX, repeatY) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// Un même matériau instancié (InstancedMesh) affiche par défaut EXACTEMENT
// la même image sur chaque pan de mur — c'est ce qui se voit comme des
// "carrés qui se répètent". Comme three.js n'a pas de canal UV2/UV3 par
// instance, on triche au niveau du shader : chaque instance reçoit un
// décalage UV et un éventuel flip (attributs instanciés posés dans
// world/walls.js), appliqués après le mapping UV standard. La texture reste
// bouclée (RepeatWrapping) donc le décalage fait juste glisser la fenêtre
// d'échantillonnage dans le même bruit périodique — un pan de mur voisin
// montre une portion différente du même motif au lieu d'un copier-coller.
export function enableUvVariation(material, { flip = true } = {}) {
  material.userData.uvVariation = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 instanceUvOffset;\nattribute float instanceUvFlip;\n',
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = ${flip ? '(instanceUvFlip > 0.5 ? vMapUv.yx : vMapUv)' : 'vMapUv'} + instanceUvOffset;
#endif
#ifdef USE_BUMPMAP
  vBumpMapUv = ${flip ? '(instanceUvFlip > 0.5 ? vBumpMapUv.yx : vBumpMapUv)' : 'vBumpMapUv'} + instanceUvOffset;
#endif
`,
      );
  };
  return material;
}
