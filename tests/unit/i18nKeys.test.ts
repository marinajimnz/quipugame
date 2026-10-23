import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import es from '@/messages/es.json';

// Cada t('clave') usada en el código tiene que existir en messages/es.json: next-intl no falla,
// pinta la clave en pantalla ("profile.save").

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], es);
}

describe('claves de traducción', () => {
  const sources = ['app', 'components'].flatMap(files);

  it('encuentra código que usa traducciones', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)('%s solo usa claves que existen', (file) => {
    const src = readFileSync(file, 'utf8');
    // useTranslations('ns') / getTranslations('ns') -> variable (t, tAuth…) -> espacio de nombres
    const scopes = new Map<string, string>();
    for (const m of src.matchAll(/(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:'([\w.]+)')?\s*\)/g)) {
      scopes.set(m[1], m[2] ?? '');
    }

    for (const [fn, ns] of scopes) {
      for (const m of src.matchAll(new RegExp(`\\b${fn}\\(\\s*([\`'])([^\`']+)\\1`, 'g'))) {
        // Las claves dinámicas (errors.${x}) se comprueban solo por su prefijo.
        const key = m[2].replace(/\$\{[^}]*\}.*$/, '').replace(/\.$/, '');
        const full = [ns, key].filter(Boolean).join('.');
        expect(lookup(full), `${file}: falta "${full}" en messages/es.json`).toBeDefined();
      }
    }
  });
});
