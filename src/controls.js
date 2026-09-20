import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.3;
const MOVE_SPEED = 2.1; // m/s, rythme de marche réaliste

export function createControls({ camera, maze, cellSize, startPos, initialYaw, onStep }) {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickBase = document.getElementById('joystick-base');
  const joystickNub = document.getElementById('joystick-nub');
  const lookZone = document.getElementById('look-zone');
  const app = document.getElementById('app');

  const position = startPos.clone();
  let yaw = initialYaw ?? Math.random() * Math.PI * 2;
  let pitch = 0;
  let bobPhase = 0;
  let bobLast = 0;

  const moveVec = { x: 0, y: 0 }; // x = strafe, y = avant/arrière, -1..1
  const keys = new Set();

  // ---------- Joystick tactile ----------
  let joyPointerId = null;
  const joyRadius = 46;

  function joyReset() {
    joystickNub.style.transform = 'translate(0,0)';
    moveVec.x = 0;
    moveVec.y = 0;
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
    yaw -= dx * TOUCH_SENS;
    pitch -= dy * TOUCH_SENS;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
  });
  function endLook(e) {
    if (e.pointerId !== lookPointerId) return;
    lookPointerId = null;
  }
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  // ---------- Souris + clavier (bureau) ----------
  const MOUSE_SENS = 0.0026;
  let mouseDown = false;
  app.addEventListener('mousedown', (e) => {
    if (window.innerWidth < 900) return;
    mouseDown = true;
  });
  window.addEventListener('mouseup', () => (mouseDown = false));
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown || window.innerWidth < 900) return;
    yaw -= e.movementX * MOUSE_SENS;
    pitch -= e.movementY * MOUSE_SENS;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
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

  // ---------- Collision grille ----------
  function resolveAxis(current, delta, axis, otherCoord) {
    if (delta === 0) return current;
    let next = current + delta;
    const C = cellSize;
    const cellFrom = Math.floor((current + C / 2) / C);
    const cellTo = Math.floor((next + C / 2) / C);
    if (cellTo === cellFrom) return next;

    const otherCell = Math.floor((otherCoord + C / 2) / C);
    let blocked = false;
    if (axis === 'x') {
      blocked = cellTo > cellFrom
        ? maze.hasWallE(cellFrom, otherCell)
        : maze.hasWallW(cellFrom, otherCell);
    } else {
      blocked = cellTo > cellFrom
        ? maze.hasWallS(otherCell, cellFrom)
        : maze.hasWallN(otherCell, cellFrom);
    }
    if (!blocked) return next;
    const boundary = cellTo > cellFrom
      ? cellFrom * C + C / 2 - PLAYER_RADIUS
      : cellFrom * C - C / 2 + PLAYER_RADIUS;
    return boundary;
  }

  function update(dt) {
    const kb = keyboardVector();
    const inX = THREE.MathUtils.clamp(moveVec.x + kb.x, -1, 1);
    const inY = THREE.MathUtils.clamp(moveVec.y + kb.y, -1, 1);
    const speedScale = Math.min(1, Math.hypot(inX, inY));

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    // Avant de la caméra = -Z en repère three.js par défaut avec cette convention de yaw.
    const forwardX = -sinY;
    const forwardZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    const dx = (forwardX * inY + rightX * inX) * MOVE_SPEED * dt;
    const dz = (forwardZ * inY + rightZ * inX) * MOVE_SPEED * dt;

    position.x = resolveAxis(position.x, dx, 'x', position.z);
    position.z = resolveAxis(position.z, dz, 'z', position.x);

    let bobY = 0;
    let bobX = 0;
    if (speedScale > 0.05) {
      bobPhase += dt * 9 * speedScale;
      bobY = Math.abs(Math.sin(bobPhase)) * 0.045;
      bobX = Math.sin(bobPhase * 0.5) * 0.02;
      const s = Math.sin(bobPhase);
      if (bobLast <= 0 && s > 0) onStep && onStep();
      bobLast = s;
    } else {
      bobPhase = 0;
      bobLast = 0;
    }

    camera.position.set(position.x + bobX, EYE_HEIGHT + bobY, position.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    return { moving: speedScale > 0.05, position };
  }

  return { update, position };
}
