import * as THREE from 'three';
import { generateMaze } from './maze.js';
import { buildWorld } from './world.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createPostFX } from './postfx.js';
import { createHud } from './hud.js';

const canvas = document.getElementById('scene');
const bootScreen = document.getElementById('boot-screen');
const startBtn = document.getElementById('start-btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 34);

const maze = generateMaze(24, 3.2, Date.now() & 0xffffffff);
const world = buildWorld(maze);
scene.add(world.group);
scene.fog = world.fog;
scene.background = new THREE.Color(0x59532f);

const audio = createAudio();

const controls = createControls({
  camera,
  maze,
  cellSize: world.cellSize,
  startPos: world.startWorldPos,
  initialYaw: maze.startYaw(),
  onStep: () => audio.footstep(),
});

const postfx = createPostFX(renderer, scene, camera);
const hud = createHud();

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  postfx.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

let started = false;
startBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  bootScreen.classList.add('hidden');
  audio.start();
  hud.show();
  const appEl = document.getElementById('app');
  if (appEl.requestFullscreen) {
    appEl.requestFullscreen().catch(() => {});
  }
});

const clock = new THREE.Clock();
let nextCrackle = 4 + Math.random() * 10;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (started) {
    controls.update(dt);
    world.update(dt, camera.position);
    hud.update(dt);
    postfx.update(t);

    nextCrackle -= dt;
    if (nextCrackle <= 0) {
      audio.crackle();
      nextCrackle = 5 + Math.random() * 14;
    }
  }

  postfx.composer.render();
}

tick();
