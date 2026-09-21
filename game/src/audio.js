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

    // Sous-harmonique légèrement désaccordée, en dessous du seuil conscient :
    // c'est elle qui donne l'impression que "quelque chose ne va pas" sans
    // qu'on puisse dire pourquoi.
    const undertone = ctx.createOscillator();
    undertone.type = 'sine';
    undertone.frequency.value = 61;
    const undertoneGain = ctx.createGain();
    undertoneGain.gain.value = 0.014;
    undertone.connect(undertoneGain);
    undertoneGain.connect(master);
    undertone.start();
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

  // Confirmation de caisse : deux notes qui montent vite ("cha-ching"),
  // pas un simple bip carré isolé.
  function registerBeep() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    [1046.5, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = t + i * 0.045;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  // Coup de balai : un souffle de bruit filtré, plus deux petits crissements
  // (le contact des brins sur le sol) — pas le même bip que la caisse.
  function sweep() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.22, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.24);
  }

  // Débouche-chiotte : ventouse grave + squelch, très différent du balai.
  function plunge() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(t);
    osc.stop(t + 0.23);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.18, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t + 0.04);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.2);
  }

  // Impact sourd d'un outil jeté qui atterrit.
  function thud() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Salve de bruit filtré façon parasite radio/télé — coupure de lumière,
  // appel qui dérape.
  function staticBurst() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.3, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.3);
  }

  // Grondement grave qui descend et s'éteint lentement — accompagne une
  // apparition ou un message qui s'affiche.
  function dreadSting() {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.26, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 1.55);
  }

  return { start, footstep, doorChime, registerBeep, sweep, plunge, thud, staticBurst, dreadSting };
}
