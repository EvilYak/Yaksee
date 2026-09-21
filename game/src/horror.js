import * as THREE from 'three';
import { buildCharacterBody } from './world/character.js';

// Le "service" n'est plus juste une simulation de vente : quelque chose
// d'autre partage la boutique avec le joueur cette nuit-là. Ce module pilote
// tout ce qui relève de l'horreur — une présence scriptée qu'on aperçoit
// puis qui disparaît, des coupures de lumière, un appel téléphonique qui
// dérape, un message qui s'affiche puis s'efface — sur une frise temporelle
// fixe calée sur le temps écoulé depuis l'ouverture (shift.remaining).

function makeVoidFaceTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.lineTo(Math.random() * size, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Même squelette bas-poly que le client (character.js), repeint en
// silhouette sans traits — pas un second modèle à entretenir.
function buildPresence() {
  const figure = buildCharacterBody({ shirtColor: 0x0a0a0a, pantsColor: 0x050505, skinColor: 0x2c2c2c });
  figure.scale.set(1, 1.08, 1);
  if (figure.userData.faceMesh) {
    figure.userData.faceMesh.material.map = makeVoidFaceTexture();
    figure.userData.faceMesh.material.needsUpdate = true;
  }
  if (figure.userData.headMesh) {
    figure.userData.headMesh.material.color.set(0x080808);
  }
  return figure;
}

// Points d'apparition, dans des coins déjà construits de la boutique : le
// fond du parking (vue depuis la réception), le fond de l'arrière-boutique,
// et un coin de la réception elle-même — celui-ci disparaît si le joueur le
// regarde en face, plutôt qu'au bout d'un temps fixe.
const SLOT_PARKING = { x: 2.5, z: -17, yaw: 0, duration: 5 };
const SLOT_BACKROOM = { x: 9.3, z: 0, yaw: Math.PI / 2, duration: 5 };
// Près de l'entrée : dans le dos d'un joueur occupé au comptoir (qui fait
// face au fond du magasin la plupart du temps), pas dans son champ de vision
// par défaut — sans quoi l'effet "disparaît dès qu'on regarde" se
// déclencherait presque tout seul avant même d'avoir été vu.
const SLOT_RECEPTION = { x: 0, z: -3.1, yaw: 0, maxDuration: 9 };

function buildTimeline(shiftDurationSeconds) {
  return [
    { at: 40, run: 'flicker' },
    { at: 95, run: 'parking' },
    { at: 150, run: 'phoneCall' },
    { at: 185, run: 'reception' },
    { at: 220, run: 'backroom' },
    { at: Math.max(250, shiftDurationSeconds - 25), run: 'flash' },
  ].sort((a, b) => a.at - b.at);
}

export function createHorrorDirector({ scene, camera, shift, dialogue, audio, flashlight, ambientLight }) {
  const figure = buildPresence();
  figure.visible = false;
  scene.add(figure);

  const glitchEl = document.getElementById('glitch-overlay');
  const flashEl = document.getElementById('horror-flash');
  const baseAmbient = ambientLight.intensity;

  const timeline = buildTimeline(shift.remaining);
  let elapsed = 0;
  let slotKind = null; // 'timed' | 'reception' | null
  let slotTimer = 0;
  const screenPos = new THREE.Vector3();

  function showTimed(slot) {
    figure.position.set(slot.x, 0, slot.z);
    figure.rotation.y = slot.yaw;
    figure.visible = true;
    slotKind = 'timed';
    slotTimer = slot.duration;
  }

  function triggerGlitchVisual(ms) {
    glitchEl.classList.add('visible');
    setTimeout(() => glitchEl.classList.remove('visible'), ms);
  }

  function triggerFlicker() {
    let n = 0;
    const id = setInterval(() => {
      const dark = n % 2 === 0;
      flashlight.visible = !dark;
      ambientLight.intensity = dark ? baseAmbient * 0.15 : baseAmbient;
      n += 1;
      if (n > 5) {
        clearInterval(id);
        flashlight.visible = true;
        ambientLight.intensity = baseAmbient;
      }
    }, 90);
    audio.staticBurst();
  }

  function triggerParking() {
    showTimed(SLOT_PARKING);
    audio.dreadSting();
  }

  function triggerReception() {
    figure.position.set(SLOT_RECEPTION.x, 0, SLOT_RECEPTION.z);
    figure.rotation.y = SLOT_RECEPTION.yaw;
    figure.visible = true;
    slotKind = 'reception';
    slotTimer = SLOT_RECEPTION.maxDuration;
  }

  function triggerBackroom() {
    showTimed(SLOT_BACKROOM);
    triggerGlitchVisual(260);
    audio.dreadSting();
  }

  function triggerPhoneCall() {
    if (dialogue.isOpen) return;
    if (document.pointerLockElement) document.exitPointerLock();
    audio.staticBurst();
    dialogue.start('Rosa', ['...vous êtes seul(e) ?', 'Ne vous retournez pas.'], '📞');
  }

  function triggerFlash() {
    flashEl.textContent = 'NOUS AVONS BESOIN DE PLUS DE NOUS...';
    flashEl.classList.add('visible');
    triggerGlitchVisual(320);
    audio.dreadSting();
    setTimeout(() => flashEl.classList.remove('visible'), 900);
  }

  const RUNNERS = {
    flicker: triggerFlicker,
    parking: triggerParking,
    reception: triggerReception,
    backroom: triggerBackroom,
    phoneCall: triggerPhoneCall,
    flash: triggerFlash,
  };

  function update(dt) {
    elapsed += dt;
    while (timeline.length && elapsed >= timeline[0].at) {
      const beat = timeline.shift();
      const run = RUNNERS[beat.run];
      if (run) run();
    }

    if (slotKind === 'timed') {
      slotTimer -= dt;
      if (slotTimer <= 0) {
        figure.visible = false;
        slotKind = null;
      }
    } else if (slotKind === 'reception') {
      slotTimer -= dt;
      screenPos.set(figure.position.x, 1.6, figure.position.z).project(camera);
      const lookingAtIt = screenPos.z < 1 && Math.abs(screenPos.x) < 0.62 && Math.abs(screenPos.y) < 0.65;
      if (lookingAtIt || slotTimer <= 0) {
        figure.visible = false;
        slotKind = null;
      }
    }
  }

  // Nettoyage à la fin du service : plus d'apparition ni d'effet résiduel
  // pendant que l'écran de bilan est affiché.
  function endShift() {
    figure.visible = false;
    slotKind = null;
    glitchEl.classList.remove('visible');
    flashEl.classList.remove('visible');
    flashlight.visible = true;
    ambientLight.intensity = baseAmbient;
  }

  return { update, endShift };
}
