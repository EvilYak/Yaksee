import * as THREE from 'three';
import { buildShopWorld } from './world/shop.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInventory, RECIPES, RESOURCE_LABELS } from './crafting.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const canvas = document.getElementById('scene');
const bootScreen = document.getElementById('boot-screen');
const startBtn = document.getElementById('start-btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);

const NIGHT_SKY = 0x0b1220;
scene.background = new THREE.Color(NIGHT_SKY);
scene.fog = new THREE.Fog(NIGHT_SKY, 16, 42);

const shop = buildShopWorld();
scene.add(shop.group);

// Lumière d'ambiance nocturne (lune + rebond du sol) : sans assez de lumière
// de base, une scène de nuit rendue en PBR (MeshStandardMaterial) tombe à
// un noir quasi total dès qu'on s'éloigne des points lumineux — un vrai
// parking de nuit reste éclairé par le ciel + l'enseigne + les lampadaires.
scene.add(new THREE.HemisphereLight(0x5a72a8, 0x2a2418, 1.4));
const moon = new THREE.DirectionalLight(0x9fb0d8, 0.7);
moon.position.set(-6, 14, -6);
scene.add(moon);

const audio = createAudio();
const hud = createHud();
const inventory = createInventory();

const bounds = { minX: -11, maxX: 11, minZ: -16.5, maxZ: 4 };

const controls = createControls({
  camera,
  colliders: shop.colliders,
  bounds,
  startPos: shop.startWorldPos,
  initialYaw: shop.startYaw,
  onStep: (pos, sprinting) => {
    const surface = pos.z < -3.6 ? 'asphalt' : 'tile';
    audio.footstep(surface, sprinting);
  },
});

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

// ---------- Réglages : sensibilité de visée + inversion de l'axe Y ----------
const SETTINGS_KEY = 'plantshop-settings';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { sensitivity: parsed.sensitivity ?? 1, invertY: !!parsed.invertY };
  } catch {
    return { sensitivity: 1, invertY: false };
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible (navigation privée...) : le réglage reste actif
    // pour la session en cours, simplement pas mémorisé pour la prochaine.
  }
}

const settingsBtn = document.getElementById('toggle-settings');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const sensSlider = document.getElementById('sens-slider');
const sensValue = document.getElementById('sens-value');
const invertYBtn = document.getElementById('invert-y-toggle');

const settings = loadSettings();
controls.setSensitivity(settings.sensitivity);
controls.setInvertY(settings.invertY);
sensSlider.value = String(settings.sensitivity);
sensValue.textContent = `${settings.sensitivity.toFixed(2)}×`;
invertYBtn.textContent = settings.invertY ? 'OUI' : 'NON';
invertYBtn.classList.toggle('active', settings.invertY);

settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
settingsClose.addEventListener('click', () => settingsPanel.classList.add('hidden'));

sensSlider.addEventListener('input', () => {
  const mult = parseFloat(sensSlider.value);
  settings.sensitivity = mult;
  sensValue.textContent = `${mult.toFixed(2)}×`;
  controls.setSensitivity(mult);
  saveSettings(settings);
});

invertYBtn.addEventListener('click', () => {
  settings.invertY = !settings.invertY;
  invertYBtn.textContent = settings.invertY ? 'OUI' : 'NON';
  invertYBtn.classList.toggle('active', settings.invertY);
  controls.setInvertY(settings.invertY);
  saveSettings(settings);
});

// ---------- Comptoir : fabrication/échange de ressources ----------
const craftPanel = document.getElementById('craft-panel');
const craftClose = document.getElementById('craft-close');
const craftStockEl = document.getElementById('craft-stock');
const craftRecipesEl = document.getElementById('craft-recipes');
const interactHint = document.getElementById('interact-hint');
const touchInteractBtn = document.getElementById('touch-interact');

let craftOpen = false;
let inRange = false;

function renderCraftPanel() {
  craftStockEl.innerHTML = Object.entries(inventory.stock)
    .map(([id, qty]) => `<span>${RESOURCE_LABELS[id] || id} : ${qty}</span>`)
    .join('');

  craftRecipesEl.innerHTML = '';
  RECIPES.forEach((recipe) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    const canCraft = inventory.canCraft(recipe);
    row.innerHTML = `<span>${recipe.label}</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Fabriquer';
    btn.disabled = !canCraft;
    btn.addEventListener('click', () => {
      if (inventory.craft(recipe.id)) {
        audio.registerBeep();
        renderCraftPanel();
      }
    });
    row.appendChild(btn);
    craftRecipesEl.appendChild(row);
  });
}

function openCraftPanel() {
  craftOpen = true;
  craftPanel.classList.remove('hidden');
  interactHint.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  renderCraftPanel();
}
function closeCraftPanel() {
  craftOpen = false;
  craftPanel.classList.add('hidden');
}
craftClose.addEventListener('click', closeCraftPanel);

function tryToggleCraft() {
  if (!inRange && !craftOpen) return;
  if (craftOpen) closeCraftPanel();
  else openCraftPanel();
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') tryToggleCraft();
});
touchInteractBtn.addEventListener('click', tryToggleCraft);

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
let wasOutside = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (started) {
    if (!craftOpen) controls.update(dt);

    const p = controls.position;
    const isOutside = p.z < -3.6;
    if (wasOutside && !isOutside) audio.doorChime();
    wasOutside = isOutside;

    const dx = p.x - shop.craftPoint.x;
    const dz = p.z - shop.craftPoint.z;
    inRange = Math.hypot(dx, dz) < shop.craftPoint.radius;
    touchInteractBtn.classList.toggle('hidden', !inRange);
    if (!craftOpen) interactHint.classList.toggle('hidden', !inRange);
  }

  renderer.render(scene, camera);
}

tick();
