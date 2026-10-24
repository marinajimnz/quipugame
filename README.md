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

## Iconos

`node scripts/generate_icons.mjs` regenera los iconos de la PWA (`public/icons/`, `app/icon.png`,
`app/apple-icon.png`) a partir de la misma geometría que las fichas.

## Tabla de puntos

`supabase/seed/points_table.sql` y `src/game/pointsTable.ts` los genera
`scripts/generate_points_table.py`. No se editan a mano:

```bash
python3 scripts/generate_points_table.py
```

## Despliegue (Vercel + Supabase)

Producción: https://quiputhegame.vercel.app (rama `main`).

El cliente (Next.js) va en Vercel, región `fra1` (`vercel.json`); la base de datos, la autenticación
y los bots (pg_cron) viven en Supabase, región `eu-central-1`. Los bots juegan desde la base de
datos, así que no dependen de Vercel.

1. **Importar el repo** en vercel.com → *Add New → Project* → `marinajimnz/quipugame`. Framework
   Next.js (se detecta solo), directorio raíz `./`, comandos por defecto.
2. **Variables de entorno** (*Settings → Environment Variables*, en Production, Preview y
   Development). Se incrustan al compilar: ponerlas **antes** del primer despliegue, o redesplegar.

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` / publishable (es pública por diseño) |

   **No** añadas `SUPABASE_SERVICE_ROLE_KEY` a Vercel: la app no la usa y salta toda la seguridad.
   Por la misma razón, no se recomienda instalar la integración de Supabase del Marketplace, que
   la copia a Vercel.
3. **Rama de producción.** Vercel despliega `main`. Mientras el MVP esté en `001-mvp`, esa rama
   genera un *Preview deployment* con su propia URL; para que sea la de producción, cámbiala en
   *Settings → Git → Production Branch* o fusiona `001-mvp` en `main`.
4. **Supabase → Authentication → URL Configuration.** *Site URL* = la URL de producción. En
   *Redirect URLs*: `https://<tu-dominio>/**`, `https://*-<tu-equipo>.vercel.app/**` (previews),
   `http://localhost:3000/**` y `http://localhost:3100/**`. Sin esto, los enlaces de confirmación
   por correo (registro y conversión de invitado) no vuelven a la app.
5. **Probar** en el móvil: *Jugar como invitado* → *Practicar* → jugar una partida.

Notas: el plan *Hobby* de Vercel es solo para uso no comercial. Los *Preview deployments* llevan
por defecto *Vercel Authentication* (solo ven la URL los miembros del equipo): para enseñar una
preview a otras personas, desactívala en *Settings → Deployment Protection*. En el plan gratuito
de Supabase el proyecto se pausa tras una semana sin actividad.
