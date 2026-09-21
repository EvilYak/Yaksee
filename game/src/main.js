import * as THREE from 'three';
import { buildShopWorld } from './world/shop.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInventory, RECIPES, RESOURCE_LABELS, BUY_PRICES, SELL_PRICES } from './crafting.js';
import { createDialogue } from './dialogue.js';

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
const dialogue = createDialogue();

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
const craftBuyEl = document.getElementById('craft-buy');
const craftSellEl = document.getElementById('craft-sell');
const craftMoneyEl = document.getElementById('craft-money-value');
const moneyEl = document.getElementById('money-value');
const interactHint = document.getElementById('interact-hint');
const interactLabel = document.getElementById('interact-label');
const touchInteractBtn = document.getElementById('touch-interact');
const npcTag = document.getElementById('npc-tag');
const npcTagName = document.getElementById('npc-tag-name');

let craftOpen = false;
let target = null; // 'phone' | 'npc' | 'craft' | null

function updateMoneyDisplay() {
  moneyEl.textContent = inventory.stock.argent;
  craftMoneyEl.textContent = inventory.stock.argent;
}

function renderCraftPanel() {
  updateMoneyDisplay();
  craftStockEl.innerHTML = Object.entries(inventory.stock)
    .filter(([id]) => id !== 'argent')
    .map(([id, qty]) => `<span>${RESOURCE_LABELS[id] || id} : ${qty}</span>`)
    .join('');

  craftRecipesEl.innerHTML = '';
  RECIPES.forEach((recipe) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${recipe.label}</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Fabriquer';
    btn.disabled = !inventory.canCraft(recipe);
    btn.addEventListener('click', () => {
      if (inventory.craft(recipe.id)) {
        audio.registerBeep();
        renderCraftPanel();
      }
    });
    row.appendChild(btn);
    craftRecipesEl.appendChild(row);
  });

  craftBuyEl.innerHTML = '';
  Object.entries(BUY_PRICES).forEach(([id, price]) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${RESOURCE_LABELS[id]} — ${price} €</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Acheter';
    btn.disabled = !inventory.canBuy(id);
    btn.addEventListener('click', () => {
      if (inventory.buy(id)) {
        audio.registerBeep();
        renderCraftPanel();
      }
    });
    row.appendChild(btn);
    craftBuyEl.appendChild(row);
  });

  craftSellEl.innerHTML = '';
  Object.entries(SELL_PRICES).forEach(([id, price]) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${RESOURCE_LABELS[id]} — ${price} €</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Vendre';
    btn.disabled = !inventory.canSell(id);
    btn.addEventListener('click', () => {
      if (inventory.sell(id)) {
        audio.registerBeep();
        renderCraftPanel();
      }
    });
    row.appendChild(btn);
    craftSellEl.appendChild(row);
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

// Appel téléphonique : reprend telle quelle la réplique d'ouverture de la
// référence ("Salut, c'est Rosa."), suivie d'une commande qui relie l'appel
// à la chaîne de fabrication plutôt que de rester une simple réplique isolée.
function openPhoneCall() {
  if (document.pointerLockElement) document.exitPointerLock();
  dialogue.start('Rosa', ["Salut, c'est Rosa.", 'Vous auriez une plante en pot ? Je passe la chercher tout à l’heure.'], '📞');
}

function openNpcTalk() {
  if (document.pointerLockElement) document.exitPointerLock();
  dialogue.start(shop.npc.name, ['Bonjour ! Vous auriez un bouquet à me vendre ?'], '💬');
}

function handleInteractPress() {
  if (dialogue.isOpen) {
    dialogue.advance();
    return;
  }
  if (craftOpen) {
    closeCraftPanel();
    return;
  }
  if (target === 'phone') openPhoneCall();
  else if (target === 'npc') openNpcTalk();
  else if (target === 'craft') openCraftPanel();
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') handleInteractPress();
});
touchInteractBtn.addEventListener('click', handleInteractPress);

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

const INTERACT_LABELS = { phone: 'Téléphone', craft: 'Comptoir' };
const npcHeadWorldPos = new THREE.Vector3();
const npcHeadScreenPos = new THREE.Vector3();

function nearestTarget(p) {
  const dPhone = Math.hypot(p.x - shop.phonePoint.x, p.z - shop.phonePoint.z);
  if (dPhone < shop.phonePoint.radius) return 'phone';
  const dNpc = Math.hypot(p.x - shop.npc.position.x, p.z - shop.npc.position.z);
  if (dNpc < shop.npc.radius) return 'npc';
  const dCraft = Math.hypot(p.x - shop.craftPoint.x, p.z - shop.craftPoint.z);
  if (dCraft < shop.craftPoint.radius) return 'craft';
  return null;
}

function updateNpcTag() {
  const dist = camera.position.distanceTo(shop.npc.position);
  npcHeadWorldPos.set(shop.npc.position.x, 1.72, shop.npc.position.z);
  npcHeadScreenPos.copy(npcHeadWorldPos).project(camera);
  const onScreen = npcHeadScreenPos.z < 1 && Math.abs(npcHeadScreenPos.x) < 0.95 && Math.abs(npcHeadScreenPos.y) < 0.95;
  if (!onScreen || dist > 8 || craftOpen || dialogue.isOpen) {
    npcTag.classList.add('hidden');
    return;
  }
  npcTagName.textContent = shop.npc.name;
  const sx = (npcHeadScreenPos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-npcHeadScreenPos.y * 0.5 + 0.5) * window.innerHeight;
  npcTag.style.left = `${sx}px`;
  npcTag.style.top = `${sy}px`;
  npcTag.classList.remove('hidden');
}

const clock = new THREE.Clock();
let wasOutside = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (started) {
    const paused = craftOpen || dialogue.isOpen;
    if (!paused) controls.update(dt);

    const p = controls.position;
    const isOutside = p.z < -3.6;
    if (wasOutside && !isOutside) audio.doorChime();
    wasOutside = isOutside;

    moneyEl.textContent = inventory.stock.argent;

    target = paused ? null : nearestTarget(p);
    touchInteractBtn.classList.toggle('hidden', !target && !craftOpen && !dialogue.isOpen);
    if (target === 'npc') interactLabel.textContent = shop.npc.name;
    else if (target) interactLabel.textContent = INTERACT_LABELS[target];
    interactHint.classList.toggle('hidden', !target || craftOpen);

    updateNpcTag();
  }

  renderer.render(scene, camera);
}

tick();
