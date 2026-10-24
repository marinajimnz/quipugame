import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

// T082: el inglés tiene exactamente las mismas claves y los mismos huecos ({name}, {count}…).

type Tree = { [k: string]: string | string[] | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || Array.isArray(v)) out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

// Nombres de los argumentos ICU ({name}, {count, plural, …}), sin confundirlos con el texto de las
// opciones ({Sí}, {agotado}…): un pequeño analizador de llaves.
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`llaves sin cerrar: ${text}`);
}

function args(text: string, out = new Set<string>()): string[] {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = closing(text, i);
    const inner = text.slice(i + 1, end);
    const [name, type, ...rest] = inner.split(',');
    out.add(name.trim());
    if (type && ['plural', 'select', 'selectordinal'].includes(type.trim())) {
      const options = rest.join(',');
      for (let j = 0; j < options.length; j++) {
        if (options[j] !== '{') continue;
        const close = closing(options, j);
        args(options.slice(j + 1, close), out); // texto de la opción: puede contener argumentos
        j = close;
      }
    }
    i = end;
  }
  return [...out].sort();
}

const ES = flatten(es as Tree);
const EN = flatten(en as Tree);

describe('messages/en.json', () => {
  it('tiene las mismas claves que es.json', () => {
    expect([...EN.keys()].sort()).toEqual([...ES.keys()].sort());
  });

  it.each([...ES.keys()])('%s usa los mismos argumentos', (key) => {
    const a = ES.get(key)!;
    const b = EN.get(key)!;
    if (Array.isArray(a)) {
      expect(Array.isArray(b) && b.length === a.length, key).toBe(true);
      return;
    }
    expect(args(b as string), key).toEqual(args(a));
  });

  it('no deja textos vacíos', () => {
    for (const [key, v] of EN) expect(Array.isArray(v) ? v.every(Boolean) : v.trim().length > 0, key).toBe(true);
  });
});
