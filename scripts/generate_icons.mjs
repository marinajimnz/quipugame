// Genera los iconos de la PWA a partir de un SVG (misma geometría que las fichas: placa de piedra
// grafito, esquinas de color y la cruz escalonada en el centro). Uso: node scripts/generate_icons.mjs
import sharp from 'sharp';

const C = { grafito: '#4c4c4c', hueco: '#2e2e2e', f: ['#ffcb30', '#f49bb4', '#ef514e', '#2d6ab3', '#006e58'] };
const CROSS = 'M4 0H8V2H10V4H12V8H10V10H8V12H4V10H2V8H0V4H2V2H4Z';

// `pad`: margen interior (0–1) para los iconos "maskable", cuya zona segura es el 80 % central.
function svg({ size, rounded, pad }) {
  const s = size;
  const inner = s * (1 - 2 * pad);
  const o = s * pad;
  const u = inner / 12; // unidad de la cuadrícula
  const corner = (x, y, color) =>
    `<rect x="${x - u * 0.15}" y="${y - u * 0.15}" width="${u * 1.6}" height="${u * 1.6}" rx="${u * 0.35}" fill="${C.hueco}"/>` +
    `<rect x="${x}" y="${y}" width="${u * 1.3}" height="${u * 1.3}" rx="${u * 0.3}" fill="${color}"/>`;
  const g = (fill, grow) =>
    `<g transform="translate(${o + u * 3} ${o + u * 3}) scale(${u * 0.5})"><path d="${CROSS}" fill="${fill}" stroke="${grow ? fill : 'none'}" stroke-width="${grow ? 0.9 : 0}" stroke-linejoin="miter"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" rx="${rounded ? s * 0.19 : 0}" fill="${C.grafito}"/>
    ${corner(o + u * 0.6, o + u * 0.6, C.f[1])}
    ${corner(o + inner - u * 1.9, o + u * 0.6, C.f[2])}
    ${corner(o + u * 0.6, o + inner - u * 1.9, C.f[3])}
    ${corner(o + inner - u * 1.9, o + inner - u * 1.9, C.f[4])}
    ${g(C.hueco, true)}${g(C.f[0], false)}
  </svg>`;
}

const out = [
  ['public/icons/icon-192.png', { size: 192, rounded: true, pad: 0.06 }],
  ['public/icons/icon-512.png', { size: 512, rounded: true, pad: 0.06 }],
  ['public/icons/icon-maskable-512.png', { size: 512, rounded: false, pad: 0.16 }],
  ['app/apple-icon.png', { size: 180, rounded: false, pad: 0.1 }],
  ['app/icon.png', { size: 64, rounded: true, pad: 0.04 }],
];

for (const [file, opts] of out) {
  await sharp(Buffer.from(svg(opts))).png().toFile(file);
  console.log('escrito', file);
}
