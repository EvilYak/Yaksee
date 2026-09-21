import * as THREE from 'three';

// Panneau texte générique (enseignes, portes, plaques) : un canvas non
// répété, une texture par appel, pas de bruit ajouté dessus.
export function makeLabelTexture({
  width = 512,
  height = 256,
  bg = '#141210',
  fg = '#e8e0c0',
  lines = [''],
  fontSize = 42,
  fontWeight = '700',
  letterSpacing = 4,
  align = 'center',
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  ctx.font = `${fontWeight} ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lineHeight = fontSize * 1.3;
  const totalH = lineHeight * lines.length;
  const x = align === 'center' ? width / 2 : align === 'right' ? width - 24 : 24;
  lines.forEach((line, i) => {
    const y = height / 2 - totalH / 2 + lineHeight * (i + 0.5);
    if (letterSpacing > 0 && ctx.letterSpacing !== undefined) ctx.letterSpacing = `${letterSpacing}px`;
    ctx.fillText(line, x, y);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

