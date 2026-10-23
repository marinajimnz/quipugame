# Quipu

Juego de deducción por turnos para 2–4 jugadores (PWA). Next.js + Supabase + Vercel.

Metodología: Spec-Driven Development con SpecKit. Léelos en este orden:

1. `.specify/memory/constitution.md`
2. `specs/001-mvp/spec.md`
3. `specs/001-mvp/plan.md`
4. `specs/001-mvp/tasks.md`
5. `DESIGN.md`

## Base de datos

No hay base local (no usamos Docker). La carpeta `supabase/` está enlazada al proyecto
Supabase en `eu-central-1` mediante `supabase link`; el ref está en `supabase/.temp/project-ref`
(no versionado) y en `specs/001-mvp/tasks.md`.

```bash
supabase link --project-ref xxyigxrjaflwnehztdsr   # una vez por máquina
supabase db push --linked --dry-run                       # ver qué migraciones se aplicarían
supabase db push --linked                         # aplicarlas
```

Toda migración es un fichero versionado en `supabase/migrations/`. No se toca el esquema desde el panel.

## Tabla de puntos

`supabase/seed/points_table.sql` y `src/game/pointsTable.ts` los genera
`scripts/generate_points_table.py`. No se editan a mano:

```bash
python3 scripts/generate_points_table.py
```
