# Lista final del MVP (T088)

Revisión contra los criterios de la constitución §6 y los requisitos no funcionales de la spec
§12, a 2026-10-24. **Hecho** = comprobado; **Parcial** = comprobado con limitaciones (dichas);
**Pendiente** = sin hacer.

## Criterios de la constitución §6

| Criterio | Estado | Cómo se comprobó |
|---|---|---|
| La lógica de juego tiene tests de los casos límite de la spec | Hecho | 150 tests de integración contra el proyecto Supabase (reparto, turnos, pistas en sus 6 + 3 casos, declaración, abandono, concurrencia, tiempo, bots, salas, cola, ELO, clasificación) y 105 partidas simuladas entre bots sin un solo fallo del bot normal. |
| Un test verifica que la información oculta sigue oculta | Hecho | Grupo fuga (`tests/db/fuga/`): `game_tiles` sin políticas ni permisos; nadie lee sus números por `get_game_state`, eventos, pistas, tabla directa ni Realtime; superficie de funciones; los bots solo reciben el JSON de estado. |
| Funciona en un móvil real de 360 px | **Parcial** | Probado en el navegador a 360 y 390 px (sin scroll horizontal). **Falta un móvil real.** |
| Sobrevive a una desconexión de 30 s | **Parcial** | Corte de red simulado de 10 s: aviso, reconexión y estado actual. El cronómetro es del servidor y el turno agotado lo juega el servidor (probado). **Falta el E2E de 30 s con Playwright** (pendiente de permiso para descargar el navegador). |
| No hay textos de interfaz en los componentes | Hecho | Regla de lint `react/jsx-no-literals` y test de que toda clave usada existe en `es.json`; `en.json` con las mismas claves y argumentos. |
| RLS activa en toda tabla nueva | Hecho | Test de esquema que recorre todas las tablas de `public`. |

## Requisitos no funcionales (spec §12)

| Requisito | Estado | Detalle |
|---|---|---|
| Tiempo hasta interactivo < 3 s en 4G | **Parcial (estimado)** | La partida pesa ~320 KB comprimidos (237 KB de JS, 69 KB de fuentes, ~15 KB de HTML y CSS). En "4G lento" de Lighthouse (1,6 Mbps, 150 ms) solo la descarga son ~1,6 s más las idas y vueltas: estará cerca del límite en móviles modestos. **No medido con Lighthouse** (no hay Chrome en este equipo). |
| Latencia de una acción < 300 ms (p95) | Parcial | Desde un portátil: p50 67 ms, p95 100–304 ms según la ejecución (`measurements.md`). |
| Propagación a los rivales < 500 ms (p95) | Parcial | Desde un portátil: p95 398–535 ms desde que el servidor confirma. Falta con dos móviles. |
| 100 partidas simultáneas sin degradación | **Pendiente** | T085 sin hacer: carga real sobre el proyecto de producción, mejor con la base de desarrollo. Los trabajos de `pg_cron` tardan 3–6 ms por ejecución sin carga. |
| Sin conexión: reglas y tablero de deducción | Parcial | Service worker con su lógica probada en un entorno simulado (7 tests). **No se pudo registrar en el navegador de esta app** (lo bloquea); falta probarlo en un navegador real en modo avión. |
| Contraste AA; el color nunca solo | Hecho | Contrastes calculados (WCAG) y corregidos: errores, texto secundario, texto sobre lila y fichas sin resolver (`DESIGN.md`). `axe-core` (WCAG 2.2 AA) en 8 pantallas con hojas abiertas: 0 violaciones; ningún objetivo táctil < 44 px. Glifo propio por color en todos los estados. |

## Tareas abiertas

| Tarea | Qué falta | Quién |
|---|---|---|
| T013 | CI de base de datos: secretos de GitHub (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`) | Tú |
| T034 | OAuth (Google): aplazado | Decisión |
| T050 | Prueba de juego: 10 partidas, duración, dudas, dificultad del bot | Tú |
| T055 / T063 | E2E con Playwright (dos navegadores; desconexión de 30 s) | Permiso para descargar ~170 MB |
| T056 | Latencia con dos móviles reales | Tú |
| T084 | Lighthouse en móvil | Chrome en el equipo, o PageSpeed Insights sobre la URL pública |
| T085 | Prueba de carga de 100 partidas | Tu OK (carga sobre el proyecto) |
| T086 | Bot difícil: hoy juega como el normal. El plan permite sacarlo del MVP | Decisión |
| — | Base de datos de desarrollo antes de abrir a jugadores reales (los tests escriben en producción) | Tú + yo |
| — | Supabase → URL Configuration (Site URL y Redirect URLs) para el registro por correo | Tú |
| — | Catálogo de avatares, glifos definitivos, nombre y dominio | Diseño |
