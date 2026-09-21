// Toute l'ambiance sonore est synthétisée via Web Audio API (aucun fichier audio
// à charger) : léger bourdonnement de frigo/néon, pas sur carrelage ou asphalte,
// carillon de porte, bip de caisse.

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

    // Bourdonnement discret de frigo/néon d'arrière-boutique, très en retrait.
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 92;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.025;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start();
  }

  function footstep(surface, sprinting) {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.14, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'tile' ? 'highpass' : 'lowpass';
    filter.frequency.value = surface === 'tile' ? 700 + Math.random() * 300 : 250 + Math.random() * 120;
    const gain = ctx.createGain();
    const peak = (sprinting ? 0.3 : 0.2) + Math.random() * 0.06;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.15);
  }

  // Petit carillon de porte deux notes (cloche de magasin classique).
  function doorChime() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = t + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  // Bip de confirmation (caisse / fabrication réussie).
  function registerBeep() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  return { start, footstep, doorChime, registerBeep };
}
