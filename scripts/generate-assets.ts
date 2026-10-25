// Genera los patrones y elementos decorativos con fal.ai a partir de assets.manifest.json.
// Solo fondos y decorado: nada de fichas, números ni interfaz (se dibujan por código).
//
//   npm run assets                    genera lo que falte (idempotente)
//   npm run assets -- --force         regenera todo
//   npm run assets -- --only estrellas,nube-1
//   npm run assets -- --dry           muestra el plan sin llamar a fal.ai ni gastar nada
//
// Lee FAL_KEY del entorno (.env.local).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fal } from '@fal-ai/client';
import sharp from 'sharp';

interface Asset {
  name: string;
  output: string;
  model: string;
  style?: string;
  size: { width: number; height: number };
  prompt: string;
  post: 'whiteToAlpha' | 'removeBackground';
  tile?: boolean;
  seed?: number;
}
interface Manifest {
  negativo: string;
  removeBackgroundModel: string;
  grano: { intensidad: number };
  assets: Asset[];
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const dry = args.includes('--dry');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

const manifest: Manifest = JSON.parse(readFileSync('assets.manifest.json', 'utf8'));
const todo = manifest.assets.filter((a) => (!only || only.includes(a.name)) && (force || !existsSync(a.output)));

function loadEnvLocal() {
  if (process.env.FAL_KEY || !existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*FAL_KEY\s*=\s*(.*)\s*$/);
    if (m) process.env.FAL_KEY = m[1].replace(/^["']|["']$/g, '');
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`descarga fallida (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Blanco sobre negro -> blanco puro con la luminosidad como alfa.
async function whiteToAlpha(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4, 255);
  for (let i = 0; i < data.length; i++) out[i * 4 + 3] = data[i];
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Granulado de película: ruido fino por píxel que solo toca lo opaco. En las formas casi blancas
// solo oscurece (no hay margen para aclarar), así que se ven motas sutiles en vez de ruido simétrico.
async function addGrain(png: Buffer, amount: number): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  let seed = 20261025;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const n = (rand() + rand() + rand() - 1.5) * 2 * amount; // aprox. gaussiano
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, out[i + c] + n));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function save(path: string, buf: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

// Vista previa 2x2 para ver a ojo si el patrón repite sin costura. Va sobre fondo oscuro.
async function tilePreview(a: Asset, png: Buffer) {
  const { width, height } = await sharp(png).metadata();
  const w = width ?? a.size.width;
  const h = height ?? a.size.height;
  const tile = await sharp(png).png().toBuffer();
  const preview = await sharp({ create: { width: w * 2, height: h * 2, channels: 4, background: '#2A1B47' } })
    .composite([[0, 0], [w, 0], [0, h], [w, h]].map(([left, top]) => ({ input: tile, left, top })))
    .png()
    .toBuffer();
  await save(`.assets-preview/${a.name}-2x2.png`, preview);
}

async function generate(a: Asset) {
  const prompt = `${a.prompt}. Avoid: ${manifest.negativo}`;
  const input: Record<string, unknown> = { prompt, image_size: a.size };
  if (a.style) input.style = a.style;
  if (a.seed !== undefined) input.seed = a.seed;

  const result = await fal.subscribe(a.model, { input, logs: false });
  const url = (result.data as { images: { url: string }[] }).images[0].url;
  let png = await download(url);

  if (a.post === 'whiteToAlpha') {
    png = await whiteToAlpha(png);
  } else {
    const cut = await fal.subscribe(manifest.removeBackgroundModel, { input: { image_url: url }, logs: false });
    png = await download((cut.data as { image: { url: string } }).image.url);
  }

  png = await addGrain(png, manifest.grano.intensidad);
  await save(a.output, png);
  if (a.tile) await tilePreview(a, png);
}

async function main() {
  console.log(`${todo.length} de ${manifest.assets.length} assets por generar${force ? ' (--force)' : ''}`);
  for (const a of todo) console.log(`  ${a.output}  ←  ${a.model}  ${a.size.width}×${a.size.height}  [${a.post}]`);
  if (dry || todo.length === 0) return;

  loadEnvLocal();
  if (!process.env.FAL_KEY) throw new Error('Falta FAL_KEY en el entorno o en .env.local');
  fal.config({ credentials: process.env.FAL_KEY });

  for (const a of todo) {
    process.stdout.write(`generando ${a.name}… `);
    await generate(a);
    console.log('ok');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
