// Genera los iconos de la PWA: fondo espacial con estrellas, el logotipo «QUIPU» con su extrusión
// y una ficha de cada color con su símbolo. El favicon pequeño (64 px) lleva solo la «Q».
// Uso: node --experimental-strip-types scripts/generate_icons.mjs
// Letras: components/brand/wordmarkData.ts (scripts/build_wordmark.py) · símbolos: components/game/tileColors.ts
// Colores: src/styles/tokens.css · fondo: public/patterns (scripts/build_patterns.py)
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SYMBOLS } from '../components/game/tileColors.ts';
import { WORDMARK_DOTS, WORDMARK_H, WORDMARK_PATH, WORDMARK_Q, WORDMARK_W } from '../components/brand/wordmarkData.ts';

const C = {
  espacio: '#2A1B47', crema: '#FDF6E8', grafito: '#2E2440', acento: '#FFC93C',
  capas: ['#3E7BC4', '#E8529E', '#F2A93B', '#8FD14F'], // extrusión, de la más lejana a la más cercana
  cara: ['#F2A93B', '#8FD14F', '#E8529E', '#D94444', '#3E7BC4'],
  canto: ['#B87B22', '#679B33', '#AE3571', '#9E2C2C', '#2A5588'],
  tinta: ['#2E2440', '#2E2440', '#FDF6E8', '#FDF6E8', '#FDF6E8'],
};
const png = (name) => `data:image/png;base64,${readFileSync(`public/patterns/${name}.png`).toString('base64')}`;
const PATTERNS = { ondas: png('ondas'), estrellas: png('estrellas') };

function background(size, rounded) {
  return `<defs><clipPath id="c"><rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}"/></clipPath></defs>
    <g clip-path="url(#c)">
      <rect width="${size}" height="${size}" fill="${C.espacio}"/>
      <image href="${PATTERNS.ondas}" width="${size}" height="${size}" opacity="0.22" preserveAspectRatio="xMidYMid slice"/>
      <image href="${PATTERNS.estrellas}" width="${size}" height="${size}" opacity="0.3" preserveAspectRatio="xMidYMid slice"/>
    </g>`;
}

function tile(i, x, y, t) {
  const k = t / 100;
  return `<g transform="translate(${x} ${y}) scale(${k})">
    <rect y="8" width="100" height="100" rx="22" fill="${C.canto[i]}"/>
    <rect width="100" height="100" rx="22" fill="${C.cara[i]}"/>
    <path d="${SYMBOLS[i]}" transform="translate(50 50) scale(27)" fill="${C.tinta[i]}"/>
  </g>`;
}

// Composición completa: logotipo arriba, cinco fichas debajo.
function full({ size, rounded, pad }) {
  const inner = size * (1 - 2 * pad);
  const step = Math.max(1, size * 0.006);
  const extra = step * C.capas.length;
  const wordW = inner;
  const sc = (wordW - extra) / WORDMARK_W;
  const wordH = WORDMARK_H * sc + extra;
  const gap = size * 0.075;
  const gapTiles = inner * 0.03;
  const t = (inner - 4 * gapTiles) / 5;
  const tilesH = t * 1.08;
  const top = (size - (wordH + gap + tilesH)) / 2;
  const x0 = (size - inner) / 2;
  const word = (dx, dy, fill) =>
    `<path transform="translate(${x0 + dx} ${top + dy}) scale(${sc})" d="${WORDMARK_PATH}" fill="${fill}"/>`;
  const layers = C.capas.map((c, i) => word(step * (C.capas.length - i), step * (C.capas.length - i), c)).join('');
  const dots = size >= 180
    ? WORDMARK_DOTS.map(([cx, cy, r]) => `<circle cx="${x0 + cx * sc}" cy="${top + cy * sc}" r="${r * sc}" fill="${C.acento}"/>`).join('')
    : '';
  const tiles = [0, 1, 2, 3, 4].map((i) => tile(i, x0 + i * (t + gapTiles), top + wordH + gap, t)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background(size, rounded)}${layers}${word(0, 0, C.crema)}${dots}${tiles}
  </svg>`;
}

// Favicon: solo la «Q».
function letter({ size, rounded, pad }) {
  const inner = size * (1 - 2 * pad);
  const step = Math.max(1, size * 0.014);
  const extra = step * C.capas.length;
  const k = Math.min((inner - extra) / WORDMARK_Q.w, (inner - extra) / WORDMARK_Q.h) * 0.92;
  const x = (size - (WORDMARK_Q.w * k + extra)) / 2;
  const y = (size - (WORDMARK_Q.h * k + extra)) / 2;
  const q = (dx, dy, fill) => `<path transform="translate(${x + dx} ${y + dy}) scale(${k})" d="${WORDMARK_Q.d}" fill="${fill}"/>`;
  const layers = C.capas.map((c, i) => q(step * (C.capas.length - i), step * (C.capas.length - i), c)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${C.espacio}"/>${layers}${q(0, 0, C.crema)}
  </svg>`;
}

// Grano de película: ruido fino por píxel que solo toca lo opaco (misma idea que el fondo de la app).
async function render(svg, grain) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (grain) {
    let seed = 20261025;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const n = (rand() + rand() + rand() - 1.5) * 2 * grain;
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, data[i + c] + n));
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

const out = [
  ['public/icons/icon-192.png', full({ size: 192, rounded: true, pad: 0.09 }), 5],
  ['public/icons/icon-512.png', full({ size: 512, rounded: true, pad: 0.09 }), 7],
  // "maskable": la zona segura es el 80 % central
  ['public/icons/icon-maskable-512.png', full({ size: 512, rounded: false, pad: 0.17 }), 7],
  ['app/apple-icon.png', full({ size: 180, rounded: false, pad: 0.1 }), 5],
  ['app/icon.png', letter({ size: 64, rounded: true, pad: 0.06 }), 0],
];

for (const [file, svg, grain] of out) {
  await (await render(svg, grain)).toFile(file);
  console.log('escrito', file);
}
