import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 2.3;
const RUN_SPEED = 4.2;

const GAMEPAD_DEADZONE = 0.16;
const GAMEPAD_LOOK_SPEED = 2.6;
const GAMEPAD_SPRINT_BUTTON = 0;

function applyDeadzone(v, dz = GAMEPAD_DEADZONE) {
  if (Math.abs(v) < dz) return 0;
  return (v - Math.sign(v) * dz) / (1 - dz);
}

export function createControls({ camera, colliders, bounds, startPos, initialYaw, onStep }) {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickBase = document.getElementById('joystick-base');
  const joystickNub = document.getElementById('joystick-nub');
  const lookZone = document.getElementById('look-zone');
  const app = document.getElementById('app');

  const position = startPos.clone();
  let yaw = initialYaw ?? 0;
  let pitch = 0;
  let bobPhase = 0;
  let bobLast = 0;

  let sensitivity = 1;
  let invertY = 1;
  function setSensitivity(mult) {
    sensitivity = mult;
  }
  function setInvertY(enabled) {
    invertY = enabled ? -1 : 1;
  }
  function applyLook(dYaw, dPitch) {
    yaw -= dYaw * sensitivity;
    pitch -= dPitch * sensitivity * invertY;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
  }

  const moveVec = { x: 0, y: 0 };
  let joyMagnitude = 0;
  const keys = new Set();

  // ---------- Joystick tactile ----------
  let joyPointerId = null;
  const joyRadius = 46;
  const JOY_RUN_THRESHOLD = 0.92;

  function joyReset() {
    joystickNub.style.transform = 'translate(0,0)';
    moveVec.x = 0;
    moveVec.y = 0;
    joyMagnitude = 0;
  }

  joystickZone.addEventListener('pointerdown', (e) => {
    if (joyPointerId !== null) return;
    joyPointerId = e.pointerId;
    joystickZone.setPointerCapture(e.pointerId);
    updateJoystick(e);
  });
  joystickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    updateJoystick(e);
  });
  function endJoy(e) {
    if (e.pointerId !== joyPointerId) return;
    joyPointerId = null;
    joyReset();
  }
  joystickZone.addEventListener('pointerup', endJoy);
  joystickZone.addEventListener('pointercancel', endJoy);

  function updateJoystick(e) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.min(joyRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    joystickNub.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVec.x = dx / joyRadius;
    moveVec.y = -dy / joyRadius;
    joyMagnitude = dist / joyRadius;
  }

  // ---------- Regard tactile (drag) ----------
  let lookPointerId = null;
  let lastLookX = 0;
  let lastLookY = 0;
  const TOUCH_SENS = 0.0032;

  lookZone.addEventListener('pointerdown', (e) => {
    if (lookPointerId !== null) return;
    lookPointerId = e.pointerId;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
  });
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointerId) return;
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    applyLook(dx * TOUCH_SENS, dy * TOUCH_SENS);
  });
  function endLook(e) {
    if (e.pointerId !== lookPointerId) return;
    lookPointerId = null;
  }
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  // ---------- Souris + clavier (bureau) ----------
  const MOUSE_SENS = 0.0026;
  const DRAG_SENS = 0.0026;
  let mouseDown = false;
  let pointerLockSupported = 'pointerLockElement' in document;

  function isDesktop() {
    return window.innerWidth >= 900;
  }

  function requestLock() {
    if (!pointerLockSupported || !isDesktop()) return;
    if (document.pointerLockElement === app) return;
    const result = app.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  app.addEventListener('click', requestLock);

  document.addEventListener('pointerlockerror', () => {
    pointerLockSupported = false;
  });

  app.addEventListener('mousedown', () => {
    if (!isDesktop()) return;
    mouseDown = true;
  });
  window.addEventListener('mouseup', () => (mouseDown = false));
  window.addEventListener('mousemove', (e) => {
    if (!isDesktop()) return;
    const locked = document.pointerLockElement === app;
    if (locked) {
      applyLook(e.movementX * MOUSE_SENS, e.movementY * MOUSE_SENS);
    } else if (!pointerLockSupported && mouseDown) {
      applyLook(e.movementX * DRAG_SENS, e.movementY * DRAG_SENS);
    }
  });
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  function keyboardVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    return { x, y };
  }

  // ---------- Manette (Gamepad API, pollée à chaque frame) ----------
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) return { x: 0, y: 0, lookX: 0, lookY: 0, sprint: false };

    const x = applyDeadzone(pad.axes[0] || 0);
    const y = -applyDeadzone(pad.axes[1] || 0);
    const lookX = applyDeadzone(pad.axes[2] || 0);
    const lookY = applyDeadzone(pad.axes[3] || 0);
    const sprint = !!(pad.buttons[GAMEPAD_SPRINT_BUTTON] && pad.buttons[GAMEPAD_SPRINT_BUTTON].pressed);
    return { x, y, lookX, lookY, sprint };
  }

  // ---------- Collision : boîtes alignées aux axes (mur, comptoir, voiture...) ----------
  // Plus de grille de labyrinthe ici : chaque obstacle de la boutique/parking
  // est une AABB dans `colliders`. On résout un axe à la fois (X puis Z) pour
  // pouvoir glisser le long d'un mur au lieu de se bloquer en diagonale.
  function collides(x, z) {
    for (const c of colliders) {
      if (
        x + PLAYER_RADIUS > c.minX &&
        x - PLAYER_RADIUS < c.maxX &&
        z + PLAYER_RADIUS > c.minZ &&
        z - PLAYER_RADIUS < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  function resolveAxis(x, z, dx, dz) {
    let nx = x;
    let nz = z;
    if (dx !== 0) {
      const tryX = x + dx;
      if (!collides(tryX, z)) nx = tryX;
    }
    if (dz !== 0) {
      const tryZ = z + dz;
      if (!collides(nx, tryZ)) nz = tryZ;
    }
    return { x: nx, z: nz };
  }

  function update(dt) {
    const kb = keyboardVector();
    const gp = pollGamepad();

    if (gp.lookX || gp.lookY) {
      applyLook(gp.lookX * GAMEPAD_LOOK_SPEED * dt, gp.lookY * GAMEPAD_LOOK_SPEED * dt);
    }

    const inX = THREE.MathUtils.clamp(moveVec.x + kb.x + gp.x, -1, 1);
    const inY = THREE.MathUtils.clamp(moveVec.y + kb.y + gp.y, -1, 1);
    const speedScale = Math.min(1, Math.hypot(inX, inY));

    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || joyMagnitude > JOY_RUN_THRESHOLD || gp.sprint;
    const moveSpeed = sprinting ? RUN_SPEED : WALK_SPEED;

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const forwardX = -sinY;
    const forwardZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    const dx = (forwardX * inY + rightX * inX) * moveSpeed * dt;
    const dz = (forwardZ * inY + rightZ * inX) * moveSpeed * dt;

    const resolved = resolveAxis(position.x, position.z, dx, dz);
    position.x = THREE.MathUtils.clamp(resolved.x, bounds.minX, bounds.maxX);
    position.z = THREE.MathUtils.clamp(resolved.z, bounds.minZ, bounds.maxZ);

    let bobY = 0;
    let bobX = 0;
    if (speedScale > 0.05) {
      const bobRate = sprinting ? 13 : 9;
      const bobAmp = sprinting ? 0.065 : 0.045;
      bobPhase += dt * bobRate * speedScale;
      bobY = Math.abs(Math.sin(bobPhase)) * bobAmp;
      bobX = Math.sin(bobPhase * 0.5) * 0.02;
      const s = Math.sin(bobPhase);
      if (bobLast <= 0 && s > 0 && onStep) onStep(position, sprinting);
      bobLast = s;
    } else {
      bobPhase = 0;
      bobLast = 0;
    }

    camera.position.set(position.x + bobX, EYE_HEIGHT + bobY, position.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    return { moving: speedScale > 0.05, sprinting, position };
  }

  return { update, position, setSensitivity, setInvertY };
}
