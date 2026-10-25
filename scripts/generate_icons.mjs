// Genera los iconos de la PWA: la «Q» del logotipo con su extrusión de colores sobre --espacio.
// Uso: node --experimental-strip-types scripts/generate_icons.mjs
// La letra sale de components/brand/wordmarkData.ts (scripts/build_wordmark.py). Colores de src/styles/tokens.css.
import sharp from 'sharp';
import { WORDMARK_Q } from '../components/brand/wordmarkData.ts';

const C = { espacio: '#2A1B47', crema: '#FDF6E8', capas: ['#3E7BC4', '#E8529E', '#F2A93B', '#8FD14F'] };

// `pad`: margen interior (0–1); los iconos "maskable" necesitan su zona segura (80 % central).
function svg({ size, rounded, pad }) {
  const inner = size * (1 - 2 * pad);
  const step = Math.max(1, size * 0.014);
  const extra = step * C.capas.length;
  // La letra más su extrusión tiene que caber en el cuadrado interior.
  const k = Math.min((inner - extra) / WORDMARK_Q.w, (inner - extra) / WORDMARK_Q.h) * 0.92;
  const w = WORDMARK_Q.w * k + extra;
  const h = WORDMARK_Q.h * k + extra;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const letter = (dx, dy, fill) =>
    `<path transform="translate(${x + dx} ${y + dy}) scale(${k})" d="${WORDMARK_Q.d}" fill="${fill}"/>`;
  const layers = C.capas.map((c, i) => letter(step * (C.capas.length - i), step * (C.capas.length - i), c)).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${C.espacio}"/>
    ${layers}${letter(0, 0, C.crema)}
  </svg>`;
}

const out = [
  ['public/icons/icon-192.png', { size: 192, rounded: true, pad: 0.1 }],
  ['public/icons/icon-512.png', { size: 512, rounded: true, pad: 0.1 }],
  ['public/icons/icon-maskable-512.png', { size: 512, rounded: false, pad: 0.2 }],
  ['app/apple-icon.png', { size: 180, rounded: false, pad: 0.14 }],
  ['app/icon.png', { size: 64, rounded: true, pad: 0.06 }],
];

for (const [file, opts] of out) {
  await sharp(Buffer.from(svg(opts))).png().toFile(file);
  console.log('escrito', file);
}
