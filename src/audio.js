// Toute l'ambiance sonore est synthétisée via Web Audio API (aucun fichier audio
// à charger) : bourdonnement de néons, souffle de ventilation, pas sur moquette.

export function createAudio() {
  let ctx = null;
  let master = null;
  let started = false;

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }

  function noiseBuffer(duration, ctxRef) {
    const buffer = ctxRef.createBuffer(1, ctxRef.sampleRate * duration, ctxRef.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function start() {
    if (started) return;
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    started = true;

    // Bourdonnement électrique grave (néons + ventilation lointaine).
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 68;
    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 41;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.09;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 220;
    drone.connect(droneFilter);
    drone2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    drone2.start();

    // Bourdonnement 100/120Hz caractéristique des tubes fluorescents.
    const buzz = ctx.createOscillator();
    buzz.type = 'square';
    buzz.frequency.value = 120;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.012;
    buzz.connect(buzzGain);
    buzzGain.connect(master);
    buzz.start();

    // Souffle d'air continu (bruit filtré).
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(2, ctx);
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 900;
    hissFilter.Q.value = 0.4;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.02;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hiss.start();

    // Légère variation lente pour que le drone respire (pas parfaitement statique).
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();
  }

  function footstep(theme, sprinting) {
    if (!started || !ctx) return;
    if (theme === 'pool') {
      splash(sprinting);
      return;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.18, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320 + Math.random() * 140;
    const gain = ctx.createGain();
    const peak = (sprinting ? 0.34 : 0.25) + Math.random() * 0.08;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.2);
  }

  // Pas dans l'eau des pool rooms : un "plouf" grave + des éclaboussures aiguës.
  function splash(sprinting) {
    const t = ctx.currentTime;
    const thud = ctx.createBufferSource();
    thud.buffer = noiseBuffer(0.12, ctx);
    const thudFilter = ctx.createBiquadFilter();
    thudFilter.type = 'lowpass';
    thudFilter.frequency.value = 220;
    const thudGain = ctx.createGain();
    const thudPeak = (sprinting ? 0.3 : 0.22) + Math.random() * 0.05;
    thudGain.gain.setValueAtTime(0.0001, t);
    thudGain.gain.linearRampToValueAtTime(thudPeak, t + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    thud.connect(thudFilter);
    thudFilter.connect(thudGain);
    thudGain.connect(master);
    thud.start(t);
    thud.stop(t + 0.16);

    const spray = ctx.createBufferSource();
    spray.buffer = noiseBuffer(0.2, ctx);
    const sprayFilter = ctx.createBiquadFilter();
    sprayFilter.type = 'highpass';
    sprayFilter.frequency.value = 2200 + Math.random() * 800;
    const sprayGain = ctx.createGain();
    const sprayPeak = (sprinting ? 0.17 : 0.12) + Math.random() * 0.05;
    sprayGain.gain.setValueAtTime(0.0001, t);
    sprayGain.gain.linearRampToValueAtTime(sprayPeak, t + 0.008);
    sprayGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    spray.connect(sprayFilter);
    sprayFilter.connect(sprayGain);
    sprayGain.connect(master);
    spray.start(t);
    spray.stop(t + 0.24);
  }

  // Craquement/grésillement bref, déclenché aléatoirement pour l'ambiance found-footage.
  function crackle() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.06, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return { start, footstep, crackle };
}
