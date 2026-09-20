import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Un seul shader combiné (grain + vignette + aberration chromatique + léger jitter VHS)
// pour rester léger sur mobile : un seul pass supplémentaire après le rendu principal.
const FoundFootageShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uIntensity: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uIntensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // Léger jitter horizontal façon bande VHS abîmée, par intermittence.
      float line = floor(uv.y * uResolution.y);
      float glitch = step(0.996, hash(vec2(line, floor(uTime * 6.0))));
      uv.x += glitch * (hash(vec2(line, uTime)) - 0.5) * 0.02;

      // Aberration chromatique légère, plus marquée sur les bords.
      vec2 center = uv - 0.5;
      float dist = length(center);
      float ca = 0.0022 * dist * uIntensity;
      float r = texture2D(tDiffuse, uv - center * ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + center * ca).b;
      vec3 color = vec3(r, g, b);

      // Grain de bruit vidéo.
      float grain = (hash(uv * uResolution.xy + uTime * 60.0) - 0.5) * 0.06;
      color += grain;

      // Vignette caméscope.
      float vig = smoothstep(0.9, 0.25, dist);
      color *= mix(0.55, 1.0, vig);

      // Scanlines très subtiles.
      float scan = sin(uv.y * uResolution.y * 1.5) * 0.02;
      color -= scan;

      // Léger virage teinte + contraste pour un rendu "capteur bas de gamme".
      color = (color - 0.5) * 1.05 + 0.5;
      color *= vec3(1.02, 1.0, 0.94);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const fxPass = new ShaderPass(FoundFootageShader);
  fxPass.uniforms.uResolution.value.set(
    window.innerWidth * Math.min(window.devicePixelRatio, 2),
    window.innerHeight * Math.min(window.devicePixelRatio, 2),
  );
  composer.addPass(fxPass);

  function setSize(w, h) {
    composer.setSize(w, h);
    fxPass.uniforms.uResolution.value.set(w * Math.min(window.devicePixelRatio, 2), h * Math.min(window.devicePixelRatio, 2));
  }

  function update(t) {
    fxPass.uniforms.uTime.value = t;
  }

  function setEnabled(enabled) {
    fxPass.enabled = enabled;
  }

  return { composer, setSize, update, setEnabled };
}
