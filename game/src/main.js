import * as THREE from 'three';
import { buildShopWorld } from './world/shop.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createDialogue } from './dialogue.js';
import { createStock } from './economy.js';
import { createCustomerManager } from './customers.js';
import { createShift } from './shift.js';
import { createCleaningSystem } from './cleaning.js';
import { createDecorState } from './decor.js';
import { createSettingsPanel } from './settings.js';
import { createRegisterPanel } from './panels/registerPanel.js';
import { createTrashPanel } from './panels/trashPanel.js';
import { createClosetPanel } from './panels/closetPanel.js';
import { createToolRuntime } from './toolRuntime.js';
import { createShiftEndScreen } from './shiftEnd.js';
import { createShiftStart } from './shiftStart.js';
import { createCustomerMovement } from './customerMovement.js';
import { createHorrorDirector } from './horror.js';

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

const NIGHT_SKY = 0x070c16;
scene.background = new THREE.Color(NIGHT_SKY);
// Brouillard resserré (avant : 16-42) : une boutique de nuit qui se referme
// vite sur elle-même donne davantage l'impression d'être seul avec autre
// chose, plutôt qu'un simple choix de rendu lointain.
scene.fog = new THREE.Fog(NIGHT_SKY, 11, 34);

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
// Intensité modeste + chute physique (decay=2.2) : dans une boutique aussi
// petite (pièces d'environ 7x7m), le joueur se retrouve régulièrement à
// 1-2m d'un mur en la regardant en face — une lampe trop puissante y sature
// complètement l'écran (ACES tonemapping) à cette distance, pas seulement à
// bout portant. La boutique a déjà un bon éclairage ambiant, la lampe ne
// sert qu'à compléter les coins sombres.
const flashlight = new THREE.SpotLight(0xfff2c0, 0.55, 7, Math.PI / 6.5, 0.55, 2.4);
flashlight.position.set(0.1, -0.15, 0.05);
camera.add(flashlight);
camera.add(flashlight.target);
flashlight.target.position.set(0.1, -0.15, -3);
flashlight.visible = flashlightOn;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    flashlightOn = !flashlightOn;
    flashlight.visible = flashlightOn;
  }
});

// Lumière d'ambiance nocturne (lune + rebond du sol) : sans assez de lumière
// de base, une scène de nuit rendue en PBR (MeshStandardMaterial) tombe à
// un noir quasi total dès qu'on s'éloigne des points lumineux — un vrai
// parking de nuit reste éclairé par le ciel + l'enseigne + les lampadaires.
const ambientLight = new THREE.HemisphereLight(0x5a72a8, 0x2a2418, 0.95);
scene.add(ambientLight);
const moon = new THREE.DirectionalLight(0x9fb0d8, 0.55);
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

createSettingsPanel({ controls });

// ---------- Panneaux plein écran + outil tenu en main ----------
// `isPlayingUnpaused` est utilisée par toolRuntime (clic pour nettoyer/jeter)
// mais dépend des panneaux créés juste après : les variables sont déclarées
// ici et assignées plus bas, la fermeture ne les lit qu'au moment du clic,
// une fois tout initialisé.
let registerPanel;
let trashPanel;
let closetPanel;

function isPlayingUnpaused() {
  return (
    started &&
    document.pointerLockElement === document.getElementById('app') &&
    !registerPanel.isOpen &&
    !trashPanel.isOpen &&
    !closetPanel.isOpen &&
    !dialogue.isOpen &&
    !shift.ended
  );
}

const toolRuntime = createToolRuntime({ scene, camera, heldToolGroup, cleaning, audio, isPlayingUnpaused });
closetPanel = createClosetPanel({ toolRuntime });
registerPanel = createRegisterPanel({ stock, customers, shift, audio, decorState, shopFrames: shop.frames });
trashPanel = createTrashPanel({ stock });

const shiftEndScreen = createShiftEndScreen({ stock, shift });
const shiftStart = createShiftStart({ controls, shop });
const customerMovement = createCustomerMovement({
  npcGroup: shop.npc.group,
  shelfSlots: shop.shelfSlots,
  waitSpot: { x: shop.npc.position.x, z: shop.npc.position.z },
});
const horror = createHorrorDirector({ scene, camera, shift, dialogue, audio, flashlight, ambientLight });

// ---------- Téléphone / PNJ : dialogues ----------
const interactHint = document.getElementById('interact-hint');
const interactLabel = document.getElementById('interact-label');
const touchInteractBtn = document.getElementById('touch-interact');
const npcTag = document.getElementById('npc-tag');
const npcTagName = document.getElementById('npc-tag-name');
const npcTagRequest = document.getElementById('npc-tag-request');
const moneyEl = document.getElementById('money-value');
const timeEl = document.getElementById('time-value');

let target = null; // 'phone' | 'npc' | 'register' | 'trash' | 'closet' | null

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
  if (registerPanel.isOpen) {
    registerPanel.close();
    return;
  }
  if (trashPanel.isOpen) {
    trashPanel.close();
    return;
  }
  if (closetPanel.isOpen) {
    closetPanel.close();
    return;
  }
  if (target === 'sign') shiftStart.begin();
  else if (target === 'phone') openPhoneCall();
  else if (target === 'npc') openNpcTalk();
  else if (target === 'register') registerPanel.open();
  else if (target === 'trash') trashPanel.open();
  else if (target === 'closet') closetPanel.open();
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

const INTERACT_LABELS = { sign: 'Enseigne', phone: 'Téléphone', register: 'Caisse', trash: 'Poubelle', closet: 'Placard' };
const npcHeadWorldPos = new THREE.Vector3();
const npcHeadScreenPos = new THREE.Vector3();

function nearestTarget(p) {
  if (!shiftStart.started) {
    const dSign = Math.hypot(p.x - shop.signPoint.x, p.z - shop.signPoint.z);
    if (dSign < shop.signPoint.radius) return 'sign';
  }
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

function updateNpcTag(menuOpen) {
  if (!customers.current) {
    npcTag.classList.add('hidden');
    return;
  }
  const dist = camera.position.distanceTo(shop.npc.position);
  npcHeadWorldPos.set(shop.npc.position.x, 1.72, shop.npc.position.z);
  npcHeadScreenPos.copy(npcHeadWorldPos).project(camera);
  const onScreen = npcHeadScreenPos.z < 1 && Math.abs(npcHeadScreenPos.x) < 0.95 && Math.abs(npcHeadScreenPos.y) < 0.95;
  if (!onScreen || dist > 8 || menuOpen || dialogue.isOpen) {
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
    const menuOpen = registerPanel.isOpen || trashPanel.isOpen || closetPanel.isOpen || dialogue.isOpen;
    const paused = menuOpen || shift.ended;
    if (!paused) controls.update(dt);
    if (controls.pollInteractPressed()) handleInteractPress();

    if (shiftStart.started && !shift.ended) {
      shift.update(dt);
      customers.update(dt);
      horror.update(dt);
    }
    if (shift.ended && !shiftEndShown) {
      shiftEndShown = true;
      horror.endShift();
      shiftEndScreen.show();
    }

    toolRuntime.updateProjectiles(dt);
    shop.doors.forEach((door) => door.update(dt, controls.position));

    shop.npc.group.visible = !!customers.current;
    customerMovement.update(dt, customers.current);

    const p = controls.position;
    const isOutside = p.z < -3.6;
    if (wasOutside && !isOutside) audio.doorChime();
    wasOutside = isOutside;

    moneyEl.textContent = stock.stock.argent;
    timeEl.textContent = shift.formatted();
    if (!shiftStart.started) {
      const sub = cleaning.allClean ? "l'enseigne est à l'entrée" : `taches nettoyées (${cleaning.cleanedCount}/${cleaning.total}) puis l'enseigne à l'entrée`;
      hud.setObjective('Préparez la boutique avant d\'ouvrir', sub);
    } else if (!cleaning.allClean) {
      hud.setObjective('Nettoyer le magasin', `taches nettoyées (${cleaning.cleanedCount}/${cleaning.total})`);
    } else {
      hud.setObjective(customers.current ? 'Un client attend au comptoir !' : 'En attente de clients...');
    }

    target = paused ? null : nearestTarget(p);
    touchInteractBtn.classList.toggle('hidden', !target && !menuOpen);
    if (target === 'npc') interactLabel.textContent = shop.npc.name;
    else if (target) interactLabel.textContent = INTERACT_LABELS[target];
    interactHint.classList.toggle('hidden', !target || menuOpen);

    toolRuntime.updateToolHint(paused);
    updateNpcTag(menuOpen);
  }

  renderer.render(scene, camera);
}

tick();
