import * as THREE from 'three';
import { buildShopWorld } from './world/shop.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createDialogue } from './dialogue.js';
import { ITEMS, createStock } from './economy.js';
import { createCustomerManager } from './customers.js';
import { createShift } from './shift.js';

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
// Le client n'existe (visuellement) que lorsqu'il y a une commande en cours
// (voir tick()) — cache-le dès la première image, avant même le démarrage.
shop.npc.group.visible = false;

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
const dialogue = createDialogue();
const stock = createStock();
const customers = createCustomerManager(stock);
const shift = createShift();

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

// ---------- Caisse : commande du client en cours + stock ----------
const registerPanel = document.getElementById('register-panel');
const registerClose = document.getElementById('register-close');
const registerMoneyEl = document.getElementById('register-money-value');
const registerOrderEl = document.getElementById('register-order');
const registerStockEl = document.getElementById('register-stock');

const trashPanel = document.getElementById('trash-panel');
const trashClose = document.getElementById('trash-close');
const trashListEl = document.getElementById('trash-list');

const moneyEl = document.getElementById('money-value');
const timeEl = document.getElementById('time-value');
const interactHint = document.getElementById('interact-hint');
const interactLabel = document.getElementById('interact-label');
const touchInteractBtn = document.getElementById('touch-interact');
const npcTag = document.getElementById('npc-tag');
const npcTagName = document.getElementById('npc-tag-name');
const npcTagRequest = document.getElementById('npc-tag-request');

let registerOpen = false;
let trashOpen = false;
let target = null; // 'phone' | 'npc' | 'register' | 'trash' | null

function renderRegisterPanel() {
  registerMoneyEl.textContent = stock.stock.argent;

  registerOrderEl.innerHTML = '';
  const order = customers.current;
  if (order) {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${order.icon} ${order.label} — ${order.price} €</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Encaisser';
    btn.disabled = !stock.has(order.id);
    btn.addEventListener('click', () => {
      if (customers.serve()) {
        shift.recordSale();
        audio.registerBeep();
        renderRegisterPanel();
      }
    });
    row.appendChild(btn);
    registerOrderEl.appendChild(row);
  } else {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = '<span>Aucun client pour le moment.</span>';
    registerOrderEl.appendChild(row);
  }

  registerStockEl.innerHTML = ITEMS.map((item) => `<span>${item.icon} ${item.label} : ${stock.stock[item.id]}</span>`).join('');
}

function openRegisterPanel() {
  registerOpen = true;
  registerPanel.classList.remove('hidden');
  interactHint.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  renderRegisterPanel();
}
function closeRegisterPanel() {
  registerOpen = false;
  registerPanel.classList.add('hidden');
}
registerClose.addEventListener('click', closeRegisterPanel);

function renderTrashPanel() {
  trashListEl.innerHTML = '';
  ITEMS.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${item.icon} ${item.label} : ${stock.stock[item.id]}</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Jeter';
    btn.disabled = !stock.has(item.id);
    btn.addEventListener('click', () => {
      if (stock.discard(item.id)) renderTrashPanel();
    });
    row.appendChild(btn);
    trashListEl.appendChild(row);
  });
}

function openTrashPanel() {
  trashOpen = true;
  trashPanel.classList.remove('hidden');
  interactHint.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  renderTrashPanel();
}
function closeTrashPanel() {
  trashOpen = false;
  trashPanel.classList.add('hidden');
}
trashClose.addEventListener('click', closeTrashPanel);

// Appel téléphonique : reprend telle quelle la réplique d'ouverture de la
// référence ("Salut, c'est Rosa."), suivie d'une commande à venir plus tard.
function openPhoneCall() {
  if (document.pointerLockElement) document.exitPointerLock();
  dialogue.start('Rosa', ["Salut, c'est Rosa.", 'Vous auriez un chapeau magique ? Je passe le chercher plus tard.'], '📞');
}

function openNpcTalk() {
  const order = customers.current;
  if (!order) return;
  if (document.pointerLockElement) document.exitPointerLock();
  dialogue.start(shop.npc.name, [`Bonjour ! Je voudrais ${order.article} ${order.label.toLowerCase()}, s'il vous plaît.`], '💬');
}

function handleInteractPress() {
  if (shift.ended) return;
  if (dialogue.isOpen) {
    dialogue.advance();
    return;
  }
  if (registerOpen) {
    closeRegisterPanel();
    return;
  }
  if (trashOpen) {
    closeTrashPanel();
    return;
  }
  if (target === 'phone') openPhoneCall();
  else if (target === 'npc') openNpcTalk();
  else if (target === 'register') openRegisterPanel();
  else if (target === 'trash') openTrashPanel();
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') handleInteractPress();
});
touchInteractBtn.addEventListener('click', handleInteractPress);

// ---------- Fin de session ("l'après-midi") ----------
const shiftEndEl = document.getElementById('shift-end');
const shiftEndMoneyEl = document.getElementById('shift-end-money');
const shiftEndServedEl = document.getElementById('shift-end-served');
const shiftEndRestartBtn = document.getElementById('shift-end-restart');

function showShiftEnd() {
  shiftEndMoneyEl.textContent = stock.stock.argent;
  shiftEndServedEl.textContent = shift.served;
  shiftEndEl.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
// Recharger la page est le moyen le plus simple de repartir sur un état
// propre (stock, argent, minuterie) sans avoir à dupliquer la logique
// d'initialisation ailleurs.
shiftEndRestartBtn.addEventListener('click', () => window.location.reload());

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

const INTERACT_LABELS = { phone: 'Téléphone', register: 'Caisse', trash: 'Poubelle' };
const npcHeadWorldPos = new THREE.Vector3();
const npcHeadScreenPos = new THREE.Vector3();

function nearestTarget(p) {
  const dPhone = Math.hypot(p.x - shop.phonePoint.x, p.z - shop.phonePoint.z);
  if (dPhone < shop.phonePoint.radius) return 'phone';
  if (customers.current) {
    const dNpc = Math.hypot(p.x - shop.npc.position.x, p.z - shop.npc.position.z);
    if (dNpc < shop.npc.radius) return 'npc';
  }
  const dRegister = Math.hypot(p.x - shop.registerPoint.x, p.z - shop.registerPoint.z);
  if (dRegister < shop.registerPoint.radius) return 'register';
  const dTrash = Math.hypot(p.x - shop.trashPoint.x, p.z - shop.trashPoint.z);
  if (dTrash < shop.trashPoint.radius) return 'trash';
  return null;
}

function updateNpcTag() {
  if (!customers.current) {
    npcTag.classList.add('hidden');
    return;
  }
  const dist = camera.position.distanceTo(shop.npc.position);
  npcHeadWorldPos.set(shop.npc.position.x, 1.72, shop.npc.position.z);
  npcHeadScreenPos.copy(npcHeadWorldPos).project(camera);
  const onScreen = npcHeadScreenPos.z < 1 && Math.abs(npcHeadScreenPos.x) < 0.95 && Math.abs(npcHeadScreenPos.y) < 0.95;
  if (!onScreen || dist > 8 || registerOpen || trashOpen || dialogue.isOpen) {
    npcTag.classList.add('hidden');
    return;
  }
  npcTagName.textContent = shop.npc.name;
  npcTagRequest.textContent = `${customers.current.icon} ${customers.current.label}`;
  const sx = (npcHeadScreenPos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-npcHeadScreenPos.y * 0.5 + 0.5) * window.innerHeight;
  npcTag.style.left = `${sx}px`;
  npcTag.style.top = `${sy}px`;
  npcTag.classList.remove('hidden');
}

const clock = new THREE.Clock();
let wasOutside = true;
let shiftEndShown = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (started) {
    const menuOpen = registerOpen || trashOpen || dialogue.isOpen;
    const paused = menuOpen || shift.ended;
    if (!paused) controls.update(dt);
    if (controls.pollInteractPressed()) handleInteractPress();

    if (!shift.ended) {
      shift.update(dt);
      customers.update(dt);
    }
    if (shift.ended && !shiftEndShown) {
      shiftEndShown = true;
      showShiftEnd();
    }

    shop.npc.group.visible = !!customers.current;

    const p = controls.position;
    const isOutside = p.z < -3.6;
    if (wasOutside && !isOutside) audio.doorChime();
    wasOutside = isOutside;

    moneyEl.textContent = stock.stock.argent;
    timeEl.textContent = shift.formatted();
    hud.setObjective(customers.current ? 'Un client attend au comptoir !' : 'En attente de clients...');

    target = paused ? null : nearestTarget(p);
    touchInteractBtn.classList.toggle('hidden', !target && !menuOpen);
    if (target === 'npc') interactLabel.textContent = shop.npc.name;
    else if (target) interactLabel.textContent = INTERACT_LABELS[target];
    interactHint.classList.toggle('hidden', !target || menuOpen);

    updateNpcTag();
  }

  renderer.render(scene, camera);
}

tick();
