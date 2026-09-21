// Bruit cohérent (value noise + fBm) partagé par tous les thèmes : un vrai
// matériau a des variations corrélées sur plusieurs échelles (fibres,
// humidité, usure), jamais du bruit blanc pixel par pixel — c'est ce qui
// faisait ressembler les premières textures à de la neige TV plutôt qu'à du
// papier peint ou de la moquette.

export function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Grille bouclée (wrap-around) : g[cells] === g[0] implicitement via le
// modulo, donc le résultat s'accorde parfaitement avec lui-même une fois
// répété (texture.repeat) — pas de raccord visible ni de motif qui "saute".
function valueNoiseLayer(size, cells, rand) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const out = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const fy = (py / size) * cells;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = smootherstep(fy - Math.floor(fy));
    for (let px = 0; px < size; px++) {
      const fx = (px / size) * cells;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = smootherstep(fx - Math.floor(fx));
      const a = g[y0 * cells + x0] * (1 - tx) + g[y0 * cells + x1] * tx;
      const b = g[y1 * cells + x0] * (1 - tx) + g[y1 * cells + x1] * tx;
      out[py * size + px] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

// Fractal Brownian motion : superpose plusieurs octaves du bruit ci-dessus
// (grossier -> fin) pour une variation naturelle, valeurs normalisées 0..1.
function fbm(size, octaves, baseCells, rand) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let totalAmp = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoiseLayer(size, cells, rand);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp;
    totalAmp += amp;
    amp *= 0.55;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= totalAmp;
  return out;
}

export function addNoise(ctx, size, amount, rand = Math.random) {
  const noise = fbm(size, 4, 4, rand);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const n = (noise[p] - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Variation de teinte à grande échelle (plaques d'humidité, usure inégale) :
// applique une couleur en la modulant par une nappe de bruit basse fréquence,
// pour qu'aucune zone du mur/sol n'ait exactement la même couleur.
export function grungeTint(ctx, size, { color, strength = 0.3, cells = 3, octaves = 3, rand = Math.random }) {
  const noise = fbm(size, octaves, cells, rand);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const [cr, cg, cb] = color;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const t = Math.max(0, noise[p] - 0.5) * 2 * strength;
    d[i] = d[i] * (1 - t) + cr * t;
    d[i + 1] = d[i + 1] * (1 - t) + cg * t;
    d[i + 2] = d[i + 2] * (1 - t) + cb * t;
  }
  ctx.putImageData(img, 0, 0);
}

export function stain(ctx, size, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
