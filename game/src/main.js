import * as THREE from 'three';
import { buildShopWorld } from './world/shop.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createDialogue } from './dialogue.js';
import { ITEMS, createStock } from './economy.js';
import { createCustomerManager } from './customers.js';
import { createShift } from './shift.js';
import { TOOL_LABELS, attachHeldTool, createThrownProjectile, updateProjectile } from './tools.js';
import { createCleaningSystem } from './cleaning.js';
import { createDecorState, FRAME_PRICE, FRAME_COUNT } from './decor.js';
import { makeFrameMaterial } from './materials/index.js';

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

// La caméra doit être dans le graphe de scène pour que ses enfants (outil
// tenu en main, lampe torse) soient réellement rendus.
scene.add(camera);
const heldToolGroup = new THREE.Group();
camera.add(heldToolGroup);

// Lampe frontale/torse : indépendante de l'outil en main (un seul objet à la
// fois dans la main, mais la lampe n'occupe pas ce créneau).
let flashlightOn = true;
// Intensité modeste + chute physique (decay=2) : une lampe torse très proche
// de la caméra sature vite l'écran (ACES tonemapping) si elle est trop
// puissante ou tombe trop lentement — la boutique a déjà un bon éclairage
// ambiant, la lampe ne sert qu'à compléter les coins sombres.
const flashlight = new THREE.SpotLight(0xfff2c0, 3.5, 9, Math.PI / 6.5, 0.4, 2);
flashlight.position.set(0.1, -0.15, 0.05);
camera.add(flashlight);
camera.add(flashlight.target);
flashlight.target.position.set(0.1, -0.15, -3);
flashlight.visible = flashlightOn;

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
const cleaning = createCleaningSystem(shop.group, shop.cleaningSpots);
const decorState = createDecorState(stock);

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
const registerDecorEl = document.getElementById('register-decor');

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

  registerDecorEl.innerHTML = '';
  const decorRow = document.createElement('div');
  decorRow.className = 'recipe-row';
  decorRow.innerHTML = `<span>🖼️ Cadre magicien — ${FRAME_PRICE} € (${decorState.filled}/${FRAME_COUNT})</span>`;
  const decorBtn = document.createElement('button');
  decorBtn.className = 'recipe-craft-btn';
  decorBtn.type = 'button';
  decorBtn.textContent = 'Acheter';
  decorBtn.disabled = !decorState.canBuy();
  decorBtn.addEventListener('click', () => {
    const index = decorState.buy();
    if (index >= 0) {
      shop.frames[index].material.dispose();
      shop.frames[index].material = makeFrameMaterial(index % 3);
      audio.registerBeep();
      renderRegisterPanel();
    }
  });
  decorRow.appendChild(decorBtn);
  registerDecorEl.appendChild(decorRow);
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

// ---------- Placard de ménage : équiper/ranger balai ou débouche-chiotte ----------
const closetPanel = document.getElementById('closet-panel');
const closetClose = document.getElementById('closet-close');
const closetCurrentEl = document.getElementById('closet-current');
const closetListEl = document.getElementById('closet-list');

let heldTool = null; // null | 'balai' | 'debouchoir'
let closetOpen = false;

function setHeldTool(toolId) {
  heldTool = toolId;
  attachHeldTool(heldToolGroup, heldTool);
}

function renderClosetPanel() {
  closetCurrentEl.textContent = heldTool ? `En main : ${TOOL_LABELS[heldTool]}` : 'Rien en main.';
  closetListEl.innerHTML = '';
  Object.entries(TOOL_LABELS).forEach(([id, label]) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.innerHTML = `<span>${label}</span>`;
    const btn = document.createElement('button');
    btn.className = 'recipe-craft-btn';
    btn.type = 'button';
    btn.textContent = 'Prendre';
    btn.disabled = heldTool === id;
    btn.addEventListener('click', () => {
      setHeldTool(id);
      renderClosetPanel();
    });
    row.appendChild(btn);
    closetListEl.appendChild(row);
  });

  const putAwayRow = document.createElement('div');
  putAwayRow.className = 'recipe-row';
  putAwayRow.innerHTML = '<span>Ranger l\'outil en main</span>';
  const putAwayBtn = document.createElement('button');
  putAwayBtn.className = 'recipe-craft-btn';
  putAwayBtn.type = 'button';
  putAwayBtn.textContent = 'Ranger';
  putAwayBtn.disabled = !heldTool;
  putAwayBtn.addEventListener('click', () => {
    setHeldTool(null);
    renderClosetPanel();
  });
  putAwayRow.appendChild(putAwayBtn);
  closetListEl.appendChild(putAwayRow);
}

function openClosetPanel() {
  closetOpen = true;
  closetPanel.classList.remove('hidden');
  interactHint.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  renderClosetPanel();
}
function closeClosetPanel() {
  closetOpen = false;
  closetPanel.classList.add('hidden');
}
closetClose.addEventListener('click', closeClosetPanel);

// ---------- Outil en main : nettoyage (clic gauche) + lancer (clic droit) ----------
const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
const TOOL_USE_RANGE = 3.2;
const projectiles = [];
let throwCharging = false;
let throwChargeStart = 0;
const MAX_CHARGE_MS = 1100;

function aimedStain() {
  if (!heldTool) return null;
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const hits = raycaster.intersectObjects(cleaning.activeMeshes(), false);
  if (!hits.length || hits[0].distance > TOOL_USE_RANGE) return null;
  return hits[0];
}

function useHeldTool() {
  const hit = aimedStain();
  if (!hit) return;
  if (cleaning.clean(hit.object, heldTool)) audio.registerBeep();
}

function throwHeldTool(force) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const projectile = createThrownProjectile(heldTool, camera.position, dir, force);
  scene.add(projectile.mesh);
  projectiles.push(projectile);
  setHeldTool(null);
}

function isPlayingUnpaused() {
  return (
    started &&
    document.pointerLockElement === document.getElementById('app') &&
    !registerOpen &&
    !trashOpen &&
    !closetOpen &&
    !dialogue.isOpen &&
    !shift.ended
  );
}

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousedown', (e) => {
  if (!isPlayingUnpaused() || !heldTool) return;
  if (e.button === 0) useHeldTool();
  else if (e.button === 2) {
    throwCharging = true;
    throwChargeStart = performance.now();
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 2 || !throwCharging) return;
  throwCharging = false;
  const heldMs = Math.min(performance.now() - throwChargeStart, MAX_CHARGE_MS);
  throwHeldTool(heldMs / MAX_CHARGE_MS);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    flashlightOn = !flashlightOn;
    flashlight.visible = flashlightOn;
  }
});

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
  if (closetOpen) {
    closeClosetPanel();
    return;
  }
  if (target === 'phone') openPhoneCall();
  else if (target === 'npc') openNpcTalk();
  else if (target === 'register') openRegisterPanel();
  else if (target === 'trash') openTrashPanel();
  else if (target === 'closet') openClosetPanel();
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

const INTERACT_LABELS = { phone: 'Téléphone', register: 'Caisse', trash: 'Poubelle', closet: 'Placard' };
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
  const dCloset = Math.hypot(p.x - shop.closetPoint.x, p.z - shop.closetPoint.z);
  if (dCloset < shop.closetPoint.radius) return 'closet';
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
  if (!onScreen || dist > 8 || registerOpen || trashOpen || closetOpen || dialogue.isOpen) {
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

const toolHint = document.getElementById('tool-hint');
const toolHintLabel = document.getElementById('tool-hint-label');

function updateToolHint(paused) {
  const hit = paused ? null : aimedStain();
  if (!hit) {
    toolHint.classList.add('hidden');
    return;
  }
  toolHintLabel.textContent = heldTool === 'balai' ? 'Balayer' : 'Déboucher';
  toolHint.classList.remove('hidden');
}

const clock = new THREE.Clock();
let wasOutside = true;
let shiftEndShown = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (started) {
    const menuOpen = registerOpen || trashOpen || closetOpen || dialogue.isOpen;
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

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const settled = updateProjectile(projectiles[i], dt);
      if (settled) projectiles.splice(i, 1);
    }

    shop.npc.group.visible = !!customers.current;

    const p = controls.position;
    const isOutside = p.z < -3.6;
    if (wasOutside && !isOutside) audio.doorChime();
    wasOutside = isOutside;

    moneyEl.textContent = stock.stock.argent;
    timeEl.textContent = shift.formatted();
    if (!cleaning.allClean) {
      hud.setObjective('Nettoyer le magasin', `taches nettoyées (${cleaning.cleanedCount}/${cleaning.total})`);
    } else {
      hud.setObjective(customers.current ? 'Un client attend au comptoir !' : 'En attente de clients...');
    }

    target = paused ? null : nearestTarget(p);
    touchInteractBtn.classList.toggle('hidden', !target && !menuOpen);
    if (target === 'npc') interactLabel.textContent = shop.npc.name;
    else if (target) interactLabel.textContent = INTERACT_LABELS[target];
    interactHint.classList.toggle('hidden', !target || menuOpen);

    updateToolHint(paused);
    updateNpcTag();
  }

  renderer.render(scene, camera);
}

tick();
