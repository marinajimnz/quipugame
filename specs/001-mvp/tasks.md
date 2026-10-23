# Tareas 001 — MVP

> Ubicación: `specs/001-mvp/tasks.md`
> Rama: `001-mvp`
> Depende de: `.specify/memory/constitution.md`, `specs/001-mvp/spec.md`, `specs/001-mvp/plan.md`, `DESIGN.md`
> Estado: **borrador para revisión — no se implementa nada hasta aprobarlo**

## Cómo leer este fichero

- Las tareas están agrupadas por los ocho hitos de la sección 9 del plan. Un hito no empieza hasta que el anterior es jugable y tiene sus tests en verde (P5).
- `[P]` = puede hacerse en paralelo con las otras `[P]` del mismo bloque (ficheros distintos, sin dependencia entre ellas).
- Cada tarea dice **qué ficheros toca** y **cómo se comprueba que está hecha**.
- Restricciones no negociables, marcadas en cada tarea que las toca:
  - **🔒R1** — `game_tiles` lleva RLS activada y **ninguna** política. Solo se accede desde funciones `SECURITY DEFINER`.
  - **🔒R2** — Ninguna función devuelve al jugador los números de sus propias fichas mientras la partida esté activa y él siga activo (ver C1).
  - **🔒R3** — Toda función que muta una partida la bloquea primero con `select ... from games where id = ... for update`.
- La tabla de puntos (`supabase/seed/points_table.sql`, `src/game/pointsTable.ts`) **no se edita a mano**. Se regenera con `scripts/generate_points_table.py`. Comprobado el 2026-10-23: el script con la semilla `20261023` reproduce byte a byte los dos ficheros del paquete.

### Convenciones técnicas que se aplican a todas las tareas de base de datos

- Las funciones que el cliente puede llamar viven en `public` y son **envoltorios finos**: resuelven `auth.uid()` → `game_players.id` y delegan en una función interna.
- Las funciones internas (`deal_game`, `apply_elo`, `advance_turn`, las de bots y las de `pg_cron`) viven en el esquema `game_internal`, que **no** está expuesto por PostgREST, y con `revoke execute ... from public, anon, authenticated`. Motivo: una función `SECURITY DEFINER` en `public` es invocable por RPC por cualquiera; `deal_game` expuesta sería una fuga.
- Toda función `SECURITY DEFINER` lleva `set search_path = ''` y nombres totalmente cualificados.
- Las mutaciones internas reciben `p_player_id` (no `auth.uid()`), para que humanos, bots y `tick_timeouts` usen exactamente el mismo código (P3).

---

## Hito 0 — Antes de empezar: contradicciones resueltas en spec y plan

**Estado: resueltas el 2026-10-23 con las recomendaciones de la tabla.** Ya están reflejadas en la constitución (P2), `spec.md`, `plan.md`, `DESIGN.md`, `HANDOFF.md` y el script. Pendientes de otras fases: los cinco glifos de color (C2, diseño) y el nombre definitivo (C12). La tabla se conserva como registro.

La constitución (§5) dice que si la spec está mal se para y se corrige primero. Al leer los cuatro documentos he encontrado estos puntos. Los cinco primeros afectan al esquema del hito 1 o a las restricciones no negociables, así que hay que cerrarlos antes de escribir la primera migración.

| # | Problema | Dónde | Propuesta |
|---|---|---|---|
| C1 | **Choque con 🔒R2.** HU-5 dice que, al fallar la declaración, el jugador eliminado "ve cuáles eran sus números reales y puede seguir observando" — con la partida aún activa. El plan dice que `resolved_number` es siempre `null` mientras la partida está activa. | spec HU-5 · plan §3 `get_game_state` · HANDOFF | O bien se enseñan al acabar la partida (cumple R2 tal cual), o bien R2 pasa a decir "mientras **el jugador** siga activo". Lo segundo no filtra nada a nadie: los demás ya ven esas fichas. **Recomiendo lo segundo**, pero cambia una restricción no negociable y lo decides tú. |
| C2 | **Choque con P6.** Una ficha sin resolver y el reverso se distinguen **solo por el color** (contorno punteado + "?"; cuadros concéntricos). Viola "el color nunca es el único portador de información". | DESIGN "Estados" · constitución P6 | Añadir un glifo andino por color (escalonado, concéntrico, ortogonal) presente en todos los estados de la ficha. Afecta a `TileDetailed`/`TileCompact` (hito 4). |
| C3 | La spec dice que el cliente consulta una **vista filtrada** y que "es el único camino". El plan (D3) decide **función, no vista**. El plan dice que, si choca, manda la spec. | spec §6 · plan D3 | Corregir la spec a "una función que filtra por el jugador" (la constitución P2 ya admite "vista o función"). |
| C4 | `rooms` no tiene columna `status`, pero `expire_rooms()` hace `status = 'cancelled'` sobre salas. | plan §2.2 y §4 | Añadir `rooms.status` (`open`, `started`, `expired`) o borrar la sala al caducar. Recomiendo la columna. |
| C5 | Faltan columnas para tres reglas: (a) empate por reserva agotada + una ronda más; (b) "la partida se marca para que el ELO nunca se aplique dos veces"; (c) qué ficha se reveló en este turno (la necesita el turno automático si la fase ya es `clue`). | spec §4.5 · plan §3 `apply_elo` · plan §4 `tick_timeouts` | Añadir a `games`: `final_round_until_seat smallint null`, `elo_applied_at timestamptz null`, `revealed_tile smallint null`. |
| C6 | `game_events.kind` no incluye `game_started`, que `deal_game` emite. | plan §2.2 vs §3 | Añadir `game_started` y `turn_skipped` (reserva vacía) a la lista. |
| C7 | El test de ELO pide "suma cero", pero no lo es cuando los dos jugadores tienen K distinto (uno con < 20 partidas) o cuando actúa el suelo de 100. | plan §8 | El test comprueba suma cero solo con K iguales y sin suelo; con K distintos comprueba cada Δ por separado. |
| C8 | Turno automático por tiempo: no está definido qué pasa si el jugador ya reveló (fase `clue`) o si la reserva está vacía. | plan §4 | Fase `clue` → `classify` sobre `revealed_tile`. Reserva vacía → `classify` sobre una ficha al azar del mazo visible. |
| C9 | Si el jugador activo declara mal **en su propio turno**, nadie dice que el turno pase al siguiente. Igual con `abandon_game` y "último en pie gana". | spec §4.4 · plan §3 | `declare_code` y `abandon_game` llaman a `advance_turn` si el afectado era el jugador activo, y comprueban "último en pie". |
| C10 | El invitado necesita `display_name` único de 3–16 caracteres desde el primer segundo (la columna es obligatoria). | spec HU-1 · plan §2.2 | El disparador de alta asigna `Invitado-XXXXX` y el jugador lo cambia cuando quiera. |
| C11 | El perfil muestra "partidas jugadas / ganadas", pero `profiles` solo tiene `ranked_games` / `ranked_wins`. | spec HU-1 · plan §2.2 | Decidir si cuentan todas las partidas o solo clasificatorias. Recomiendo añadir `games_played` y `games_won` (todas) y mantener las de clasificatoria para K y ranking. |
| C12 | El nombre es "Quinteto" en la constitución, la spec y el script, y "Quipu" en el plan, DESIGN y HANDOFF. | varios | Abierto. Mientras tanto el código usa un identificador neutro (`app`) y la marca sale de `messages/es.json`, así el cambio es de una línea. |
| C13 | `generate_points_table.py` escribe las salidas en el directorio actual, no en `supabase/seed/` ni en `src/game/`. Regenerar exige mover ficheros a mano. | script | Cambiar **solo las rutas de salida** del script (no la semilla ni la tabla) y añadir la comprobación de T016. |

- [x] **T000** Resolver C1–C13 y reflejar las decisiones en `spec.md`, `plan.md` y, si toca C1, en la constitución.
  - Ficheros: `specs/001-mvp/spec.md`, `specs/001-mvp/plan.md`, `.specify/memory/constitution.md`, `DESIGN.md`
  - Hecho cuando: cada fila de la tabla anterior tiene decisión escrita en el documento que manda, y esta sección se reduce a un enlace a esos cambios.

---

## Hito 1 — Esquema, semilla y RLS

*Deja funcionando: base de datos (proyecto Supabase enlazado) con las 60 fichas y todas las políticas puestas.*

- [x] **T001** Inicializar la carpeta `supabase/` y enlazarla al proyecto `xxyigxrjaflwnehztdsr` (`supabase link`). Sin Docker: no hay base local.
  - Ficheros: `supabase/config.toml`, `.gitignore`, `README.md`
  - Hecho cuando: `supabase db push --linked --dry-run` lista las migraciones sin errores; `config.toml` apunta la semilla a `./seed/points_table.sql`; `pg_cron` y `citext` están habilitadas en el proyecto.

- [x] **T002** Migración de tipos enumerados (`game_mode`, `game_status`, `player_state`, `turn_phase`, `tile_place`, `clue_kind`) y esquema `game_internal`.
  - Ficheros: `supabase/migrations/<ts>_types.sql`
  - Hecho cuando: `supabase db push` aplica; `game_internal` no aparece en `[api] schemas` de `config.toml`.

- [x] **T003** [P] Tabla `tile_definitions` con RLS (lectura pública, sin escritura) y semilla.
  - Ficheros: `supabase/migrations/<ts>_tile_definitions.sql`
  - Hecho cuando: tras `db push`, `select count(*)` = 60; `color_index = (number - 1) % 5` en todas las filas (constraint `check`).

- [x] **T004** [P] Tabla `profiles` + disparador sobre `auth.users` que crea el perfil (con nombre de invitado según C10) + `grant update (display_name, avatar_key)` a `authenticated` (RLS no restringe columnas; lo hace el `grant`).
  - Ficheros: `supabase/migrations/<ts>_profiles.sql`
  - Hecho cuando: crear un usuario en `auth.users` crea su perfil con ELO 1000 e `is_guest` correcto; `check (elo >= 100)`; `check (char_length(display_name) between 3 and 16)`.

- [x] **T005** Tablas `games` (con las columnas que añada C5), `game_players`, `game_clues`, `game_events` con sus restricciones `unique`.
  - Ficheros: `supabase/migrations/<ts>_games.sql`
  - Hecho cuando: `db push` aplica; `unique (game_id, seat)`, `unique (game_id, profile_id)`, `unique (game_id, seq)` existen.

- [x] **T006** Tabla `game_tiles`. 🔒R1
  - Ficheros: `supabase/migrations/<ts>_game_tiles.sql`
  - Hecho cuando: `alter table game_tiles enable row level security` y `force row level security`; cero políticas; `revoke all on game_tiles from anon, authenticated`; `unique (game_id, number)`, `unique (game_id, owner_id, slot)`.

- [x] **T007** [P] Tablas `rooms` (con `status` según C4) y `room_members`.
  - Ficheros: `supabase/migrations/<ts>_rooms.sql`
  - Hecho cuando: `check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$')`; `check (seats between 2 and 4)`.

- [x] **T008** [P] Tablas `matchmaking_queue` y `elo_history`.
  - Ficheros: `supabase/migrations/<ts>_ranked.sql`
  - Hecho cuando: `db push` aplica.

- [x] **T009** Función `is_participant(p_game_id)` (`stable`, `security definer`) y todas las políticas de la tabla 2.3 del plan. Las salas por código se leen con una función `get_room_by_code`, no con una política. 🔒R1
  - Ficheros: `supabase/migrations/<ts>_policies.sql`
  - Hecho cuando: los tests de T011 pasan.

- [x] **T010** Montar Vitest para integración con la base de datos: ayudantes para crear usuarios anónimos reales (`supabase-js`), clientes autenticados por usuario, una partida de N jugadores y limpieza al final. Una conexión de administración (`SUPABASE_SERVICE_ROLE_KEY`, solo en `.env.local`) para sembrar y limpiar datos de prueba. Los tests rechazan ejecutarse si `SUPABASE_URL` no es el de la lista permitida.
  - Ficheros: `tests/db/helpers.ts`
  - Hecho cuando: `npm run test:db` ejecuta un test trivial en verde y limpia lo que crea.

- [x] **T011** Tests de esquema y del grupo **fuga (parte 1)**. 🔒R1
  - Ficheros: `tests/db/schema.test.ts`, `tests/db/fuga/game_tiles.test.ts`
  - Hecho cuando, todo en verde:
    - toda tabla de `public` tiene `relrowsecurity = true` (consulta a `pg_class`, así una tabla nueva sin RLS rompe el test);
    - `game_tiles` tiene exactamente 0 filas en `pg_policies`;
    - como `anon` y como `authenticated`, `select * from game_tiles` falla por permisos;
    - un usuario no puede actualizar su `elo` ni el perfil de otro;
    - `tile_definitions`: 60 filas, 20 de cada valor, 4/4/4 por color.

- [x] **T012** [P] Hacer que `generate_points_table.py` escriba en `supabase/seed/` y `src/game/` (C13). Solo cambian las rutas de salida.
  - Ficheros: `scripts/generate_points_table.py`
  - Hecho cuando: ejecutarlo desde la raíz deja `git status` limpio.

- [ ] **T013** CI: en cada commit, aplicar migraciones y `npm run test:db` (incluye siempre el grupo fuga) + regenerar la tabla de puntos y fallar si `git diff` no está vacío.
  - Ficheros: `.github/workflows/ci.yml`
  - Hecho cuando: un PR de prueba que edita a mano una fila de `points_table.sql` falla en CI.

---

## Hito 2 — Motor de juego

*Deja funcionando: `deal_game`, `reveal_tile`, `ask_clue`, `declare_code`, `get_game_state` con los tests de integración en verde, incluido el grupo de fuga.*

- [ ] **T020** Ayudantes internos: `game_internal.lock_game(p_game_id)` (hace el `select ... for update` y devuelve la fila), `emit_event(...)` (incrementa `event_seq` y escribe en `game_events`; exige el bloqueo tomado), `caller_player(p_game_id)` (`auth.uid()` → `game_players.id`). 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_helpers.sql`
  - Hecho cuando: test que comprueba que `emit_event` produce `seq` correlativos sin huecos tras 20 llamadas.

- [ ] **T021** `game_internal.advance_turn(game)`: siguiente asiento `active`, `phase = 'reveal'`, nuevo `turn_deadline`, `revealed_tile = null`; detecta fin de partida por último en pie y por reserva agotada + ronda completa (C5a). 🔒R3 (lo llaman funciones que ya tienen el bloqueo; comprueba que lo tienen).
  - Ficheros: `supabase/migrations/<ts>_engine_turn.sql`
  - Hecho cuando: tests de salto de eliminados, vuelta al asiento 0 y empate por reserva agotada.

- [ ] **T022** `game_internal.deal_game(p_game_id)`. 🔒R1 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_deal.sql`, `tests/db/engine/deal.test.ts`
  - Hecho cuando (grupo **reparto**, repetido 50 veces con semillas distintas): 60 fichas; 5 por jugador, una de cada color; `slot` ascendente por número; sin repetidos; 5 en `pool`, una de cada color; evento `game_started` cuyo `payload` **no** contiene números de soportes.

- [ ] **T023** `reveal_tile(p_game_id, p_color)` (público) → `game_internal.reveal_tile_as(p_player_id, ...)`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_reveal.sql`, `tests/db/engine/turn.test.ts`
  - Hecho cuando (grupo **turno**): error fuera de turno; error en fase `clue`; `no_tiles_of_color` con color agotado; con reserva vacía emite `turn_skipped` y pasa a `clue`; guarda `revealed_tile`.

- [ ] **T024** `ask_clue(p_game_id, p_tile, p_kind, p_slot)` → `ask_clue_as`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_clue.sql`, `tests/db/engine/clue.test.ts`
  - Hecho cuando (grupo **pistas**): `classify` devuelve 0, 1, 2, 3, 4 y 5 en seis montajes fijos; `compare` responde bien con fichas de 1, 2 y 3 puntos, en sí y en no; la ficha pasa a `spent`; error si la ficha no está en `pool`, si `classify` trae `p_slot` o si `compare` no lo trae; el turno avanza. El evento `clue_asked` lleva solo ficha, tipo, ranura y respuesta.

- [ ] **T025** `declare_code(p_game_id, p_numbers)` → `declare_code_as`. Devuelve solo `{ correct: boolean }`. Llama a `advance_turn` si el declarante era el activo (C9). 🔒R2 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_declare.sql`, `tests/db/engine/declare.test.ts`
  - Hecho cuando (grupo **declaración**): acierto → `finished` + ganador; fallo → `eliminated` y `has_declared = true`; segunda declaración rechazada; declarar fuera de turno funciona; último en pie gana; todos eliminados → sin ganador; el valor de retorno y el evento `eliminated` no contienen los números reales; tras eliminarse, `get_game_state` sí los devuelve a ese jugador (C1).

- [ ] **T026** `abandon_game(p_game_id)` → `abandon_as`. Comprueba último en pie y avanza turno si toca (C9). 🔒R3
  - Ficheros: `supabase/migrations/<ts>_engine_abandon.sql`, `tests/db/engine/abandon.test.ts`
  - Hecho cuando: abandonar deja `state = 'abandoned'`; con 2 jugadores el otro gana.

- [ ] **T027** `game_internal.state_for_player(p_game_id, p_player_id) → jsonb` y `get_game_state(p_game_id)` como envoltorio. Es el **único** constructor de estado; los bots lo usarán también (T042). 🔒R1 🔒R2
  - Ficheros: `supabase/migrations/<ts>_engine_state.sql`
  - Hecho cuando: devuelve la forma JSON del plan §3; `me.support[].resolved_number` es `null` con la partida activa y se rellena al terminar.

- [ ] **T028** Grupo **fuga (parte 2)** — obligatorio, se ejecuta en cada commit. 🔒R1 🔒R2
  - Ficheros: `tests/db/fuga/state.test.ts`, `tests/db/fuga/events.test.ts`, `tests/db/fuga/surface.test.ts`
  - Hecho cuando, en una partida simulada de 3 jugadores y 15 turnos, para cada jugador y después de cada turno:
    - ningún valor bajo las claves `number`, `tile_number` o `resolved_number` del JSON de `get_game_state` pertenece a sus propias fichas;
    - lo mismo en todos los `payload` de `game_events` y en todas las filas de `game_clues` que puede leer;
    - como `authenticated`, ejecutar cualquier función de `game_internal` falla por permisos;
    - **lista blanca**: las funciones `security definer` de `public` son exactamente las aprobadas. Una función nueva sin añadir a la lista rompe el test.

- [ ] **T029** Grupo **concurrencia**: dos declaraciones correctas casi simultáneas producen un solo ganador. Dos clientes reales declaran a la vez con `Promise.all`.
  - Ficheros: `tests/db/engine/concurrency.test.ts`
  - Hecho cuando: 20 repeticiones, siempre exactamente un `game_ended` y un ganador; la segunda declaración recibe "partida no activa".

---

## Hito 3 — Cuentas y perfil

*Deja funcionando: registro, invitado, nombre y avatar.*

- [ ] **T030** Esqueleto del cliente: Next.js (App Router, React 19), TypeScript `strict`, Tailwind con los tokens de `DESIGN.md` como variables CSS, Bricolage Grotesque 800 e Inter 400/500/600 con `next/font`, cifras tabulares, ESLint, Vitest. Mueve `src/game/pointsTable.ts` sin tocar su contenido.
  - Ficheros: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`, `vitest.config.ts`
  - Hecho cuando: `npm run build`, `npm run lint` y `npm test` en verde; la página de inicio se ve a 360 px sin scroll horizontal.

- [ ] **T031** [P] Traducciones: `next-intl`, `messages/es.json` (con la marca como clave, ver C12) y una regla de lint que prohíbe texto literal en JSX (`react/jsx-no-literals`).
  - Ficheros: `messages/es.json`, `i18n/`, `.eslintrc`
  - Hecho cuando: un componente con texto literal hace fallar `npm run lint`.

- [ ] **T032** [P] Cliente de Supabase (`@supabase/ssr`), middleware de sesión, `.env.example`, script `npm run db:types` que genera `src/types/database.ts` con `supabase gen types`.
  - Ficheros: `lib/supabase/`, `middleware.ts`, `.env.example`, `src/types/database.ts`
  - Hecho cuando: los tipos se generan y se importan; CI falla si `database.ts` no está al día con las migraciones.

- [ ] **T033** Entrar como invitado (inicio de sesión anónimo) desde el primer toque.
  - Ficheros: `supabase/config.toml`, `app/(auth)/entrar/page.tsx`
  - Hecho cuando: un navegador nuevo entra sin formulario y tiene perfil `Invitado-XXXXX`.

- [ ] **T034** Registro e inicio con correo + contraseña y con un proveedor OAuth (¿Google? — decisión pendiente).
  - Ficheros: `app/(auth)/entrar/page.tsx`, `supabase/config.toml`
  - Hecho cuando: los dos caminos funcionan en local (OAuth con credenciales de desarrollo).

- [ ] **T035** Convertir invitado en cuenta permanente en un paso, en una hoja que no saca de la pantalla actual. Disparador que pone `is_guest = false`.
  - Ficheros: `components/account/ConvertSheet.tsx`, `supabase/migrations/<ts>_guest_conversion.sql`
  - Hecho cuando: test de integración del disparador; prueba manual: el `id`, las partidas y el nombre se conservan.

- [ ] **T036** Perfil: elegir nombre (3–16, único, mensaje claro si está cogido) y avatar del catálogo provisional; página `/perfil` con nombre, avatar, ELO, partidas jugadas, ganadas y porcentaje (según C11).
  - Ficheros: `app/(app)/perfil/page.tsx`, `lib/avatars.ts`, `components/profile/`
  - Hecho cuando: Vitest de la validación del nombre; un nombre duplicado muestra el error traducido.

---

## Hito 4 — Partida jugable contra bot `normal`

*Deja funcionando: el primer bucle completo, tú contra el servidor. **Es el hito que dice si el juego engancha**: llegar pronto y jugarlo mucho.*

- [ ] **T040** `start_practice_game(p_bots, p_difficulty) → uuid`: crea partida `practice` con 1 humano + 1–3 bots y llama a `deal_game`. Invitados permitidos. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_practice.sql`, `tests/db/engine/practice.test.ts`
  - Hecho cuando: test que crea la partida y comprueba asientos, bots y reparto.

- [ ] **T041** Candidatos del bot: `game_internal.bot_candidates(p_state jsonb) → jsonb`. Recibe **el JSON de `state_for_player`**, no un `game_id`, así que no puede leer `game_tiles` aunque quiera. 🔒R1 🔒R2
  - Ficheros: `supabase/migrations/<ts>_bot_candidates.sql`, `tests/db/bots/candidates.test.ts`
  - Hecho cuando: tests con estados fijos (color por ranura, números vistos, orden ascendente, pistas `classify` y `compare`); test de fuga que comprueba en `pg_proc.prosrc` que ninguna función `bot_*` menciona `game_tiles`.

- [ ] **T042** Decisión del bot `easy` (pista al azar; declara con ≤ 2 candidatos por ranura) y `normal` (pista que más descarta en el peor caso; declara con un único candidato en las 5). Juega a través de `reveal_tile_as`, `ask_clue_as` y `declare_code_as`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_bot_play.sql`, `tests/db/bots/play.test.ts`
  - Hecho cuando: 100 partidas bot contra bot terminan sin error; el bot `normal` nunca declara mal.

- [ ] **T043** `game_internal.play_bot_turns()` en `pg_cron` cada 5 s con `pg_try_advisory_lock`; espera aleatoria de 2–6 s por turno (spec HU-6). Los bots también pueden declarar fuera de su turno en cada pasada. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_cron_bots.sql`
  - Hecho cuando: una partida de práctica avanza sola en local; dos ejecuciones solapadas no juegan el mismo turno dos veces (test con el candado tomado).

- [ ] **T044** [P] `TileDetailed` y `TileCompact` (misma API de props, dibujo distinto) y `Tile` que despacha según `size`. Estados resuelta/pública, sin resolver y reverso; tintas de `DESIGN.md`; excepción `#5FA38F`; puntos siempre visibles; glifo por color (C2). Página de muestra `/dev/fichas`.
  - Ficheros: `components/game/Tile.tsx`, `TileDetailed.tsx`, `TileCompact.tsx`, `app/dev/fichas/page.tsx`
  - Hecho cuando: revisión visual a 44, 52, 72, 100 y 140 px; cada estado distinguible en escala de grises.

- [ ] **T045** [P] `Support`, `Pool` (decidir aquí dos filas de tres frente a una de seis con 44 px y aire suficiente; ver HANDOFF), `TurnBar`, `ClueList` e historial desplegable.
  - Ficheros: `components/game/Support.tsx`, `Pool.tsx`, `TurnBar.tsx`, `ClueList.tsx`, `History.tsx`
  - Hecho cuando: con un estado de ejemplo se ven bien a 360 y 430 px; todos los objetivos táctiles ≥ 44 px.

- [ ] **T046** Página `/partida/[id]`: TanStack Query con una clave por partida sobre `get_game_state`; de momento, refresco por sondeo cada 1,5 s (lo sustituye Realtime en T053). Flujo del turno: color → ficha del mazo → `classify` o `compare` + ranura → confirmar. Optimista solo el estado "enviando".
  - Ficheros: `app/(app)/partida/[id]/page.tsx`, `lib/game/useGameState.ts`, `components/game/TurnActions.tsx`
  - Hecho cuando: se juega una partida completa contra un bot `normal` en el móvil.

- [ ] **T047** [P] `DeductionBoard`: 60 números, tachado manual, tachado automático de lo públicamente imposible con aspecto distinto, candidatos por ranura. Zustand persistido en `localStorage` con la clave de la partida. Es una ayuda visual: no decide nada del juego (P1).
  - Ficheros: `components/game/DeductionBoard.tsx`, `lib/game/deductionStore.ts`, `lib/game/autoStrike.ts`
  - Hecho cuando: Vitest de `autoStrike` (fichas ajenas, mazo, gastadas); recargar la página conserva los tachados.

- [ ] **T048** [P] `DeclareSheet`: resumen de los 5 números, confirmación explícita de "una sola oportunidad", validación local (distintos, ascendentes, color correcto por ranura). Botón accesible siempre, también fuera de turno.
  - Ficheros: `components/game/DeclareSheet.tsx`, `lib/game/validateDeclaration.ts`
  - Hecho cuando: Vitest de `validateDeclaration`.

- [ ] **T049** Inicio con "Practicar" (número de bots y dificultad) y pantalla de final (ganador, tus números, volver).
  - Ficheros: `app/(app)/page.tsx`, `components/game/GameOver.tsx`
  - Hecho cuando: de abrir la app a estar jugando en < 30 s como invitado.

- [ ] **T050** Prueba de juego: al menos 10 partidas reales, anotando duración, momentos de confusión y si el bot `normal` es demasiado fácil o difícil.
  - Ficheros: `specs/001-mvp/playtest.md`
  - Hecho cuando: el fichero existe con las notas. Si la media supera 20 minutos, se abre la discusión de 5 → 4 fichas (plan §10) **antes** del hito 5.

---

## Hito 5 — Salas privadas y tiempo real

*Deja funcionando: dos personas jugando con código.*

- [ ] **T051** `create_room`, `join_room`, `leave_room`, `start_game` (relleno con bots si procede), `get_room_by_code`. 🔒R3 en `start_game`.
  - Ficheros: `supabase/migrations/<ts>_rooms_fn.sql`, `tests/db/rooms/rooms.test.ts`
  - Hecho cuando: tests de código sin caracteres ambiguos y reintento ante colisión; sala llena, caducada o iniciada rechaza; solo el anfitrión inicia y con ≥ 2.

- [ ] **T052** Publicación de Realtime para `games`, `game_players`, `game_events`, `game_clues`, `room_members`. 🔒R1
  - Ficheros: `supabase/migrations/<ts>_realtime.sql`, `tests/db/fuga/realtime.test.ts`
  - Hecho cuando: test que comprueba que `game_tiles` **no** está en `pg_publication_tables`.

- [ ] **T053** Un canal por partida; cada cambio invalida la consulta (no escribe en la caché); detección de huecos en `seq` → `get_game_state` completo. Sustituye el sondeo de T046.
  - Ficheros: `lib/game/useGameChannel.ts`
  - Hecho cuando: Vitest del detector de huecos; con dos navegadores, una acción aparece en el otro sin sondeo.

- [ ] **T054** Pantalla `/sala/[codigo]`: miembros en tiempo real, compartir enlace (Web Share API con copia de respaldo), botón de iniciar solo para el anfitrión. Abrir el enlace sin sesión entra como invitado y se une.
  - Ficheros: `app/(app)/sala/[codigo]/page.tsx`, `components/room/`
  - Hecho cuando: un enlace abierto en otro dispositivo entra directamente en la sala.

- [ ] **T055** Playwright: dos navegadores — crear sala, unirse, jugar tres turnos, declarar, ver resultado.
  - Ficheros: `e2e/private-game.spec.ts`, `playwright.config.ts`
  - Hecho cuando: verde en local y en CI.

- [ ] **T056** Medir con dos móviles reales la propagación de eventos (objetivo p95 < 500 ms) y la latencia de acción (p95 < 300 ms).
  - Ficheros: `specs/001-mvp/measurements.md`
  - Hecho cuando: están los números. Si no se llega, plan §10: subir de plan antes que cambiar de arquitectura.

---

## Hito 6 — Cronómetro, abandono y reconexión

*Deja funcionando: la partida ya no se cuelga.*

- [ ] **T060** `game_internal.tick_timeouts()` en `pg_cron` con candado: turno automático (C8), `timeouts += 1`, al tercero consecutivo `abandoned`. Toda acción manual pone `timeouts = 0`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_cron_timeouts.sql`, `tests/db/engine/timeout.test.ts`
  - Hecho cuando (grupo **tiempo**): moviendo `turn_deadline` al pasado se juega solo, en fase `reveal`, en fase `clue` y con reserva vacía; tres seguidos eliminan; uno manual entre medias reinicia la cuenta.
  - Nota: con el plan a 10 s un turno puede durar hasta 70 s. Propongo 2 s; es barato porque solo mira partidas con plazo vencido.

- [ ] **T061** [P] `game_internal.expire_rooms()` en `pg_cron` cada 60 s.
  - Ficheros: `supabase/migrations/<ts>_cron_rooms.sql`
  - Hecho cuando: test con `expires_at` en el pasado.

- [ ] **T062** [P] Presencia: `touch_presence(p_game_id)` cada 15 s actualiza `last_seen_at`; la interfaz marca "desconectado" a los 30 s. (No muta el estado de juego, no necesita el bloqueo.)
  - Ficheros: `supabase/migrations/<ts>_presence.sql`, `components/game/PlayerBadge.tsx`
  - Hecho cuando: cerrar una pestaña marca al jugador como desconectado en la otra.

- [ ] **T063** Reconexión en el cliente: aviso de conexión perdida, reintento automático, `get_game_state` completo al volver; cronómetro calculado desde `turn_deadline` del servidor corrigiendo el desfase de reloj.
  - Ficheros: `lib/game/useConnection.ts`, `components/game/ConnectionBanner.tsx`
  - Hecho cuando: Playwright con `context.setOffline(true)` 30 s y vuelta: el estado es el actual y el turno no se ha perdido salvo que expirara.

- [ ] **T064** Volver a la partida en curso al abrir la app (`get_my_active_game()`) y botón de abandonar con confirmación.
  - Ficheros: `supabase/migrations/<ts>_active_game.sql`, `app/(app)/page.tsx`
  - Hecho cuando: cerrar y reabrir la app en mitad de una partida lleva directo a ella.

---

## Hito 7 — Cola, ELO y clasificación

*Deja funcionando: modo clasificatorio completo.*

- [ ] **T070** `join_queue()` (rechaza invitados, ya en cola o en partida activa) y `leave_queue()`.
  - Ficheros: `supabase/migrations/<ts>_queue.sql`, `tests/db/ranked/queue.test.ts`
  - Hecho cuando: tests de cada rechazo.

- [ ] **T071** `game_internal.resolve_matchmaking()` en `pg_cron` cada 3 s con candado: ventana `50 + 25 × floor(espera / 10)`, tope 400; empareja al más antiguo con el ELO más cercano; crea la partida `ranked` y llama a `deal_game`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_cron_matchmaking.sql`, `tests/db/ranked/matchmaking.test.ts`
  - Hecho cuando: tests de ventana a 0, 10, 60 y 200 s; nunca empareja fuera de la ventana; nadie entra en dos partidas.

- [ ] **T072** `game_internal.apply_elo(p_game_id)` con `elo_applied_at` (C5b), escritura en `elo_history` y en `profiles`. Lo llaman `declare_code_as`, `abandon_as` y el turno automático cuando terminan una partida `ranked`. 🔒R3
  - Ficheros: `supabase/migrations/<ts>_elo.sql`, `tests/db/ranked/elo.test.ts`
  - Hecho cuando (grupo **ELO**, con C7): K = 32 / 24 / 16 por tramo; suelo de 100; suma cero con K iguales; abandono cuenta como derrota; llamarla dos veces no cambia nada.

- [ ] **T073** Pantalla `/cola`: tiempo de espera, rango que se busca, cancelar; a los 90 s, ofrecer seguir o jugar contra bot. Si el usuario es invitado, se abre `ConvertSheet` (T035).
  - Ficheros: `app/(app)/cola/page.tsx`
  - Hecho cuando: dos cuentas en dos navegadores se emparejan y juegan.

- [ ] **T074** [P] Resultado con variación de ELO bien visible.
  - Ficheros: `components/game/GameOver.tsx`
  - Hecho cuando: se ve +Δ / −Δ al acabar una clasificatoria.

- [ ] **T075** [P] `get_leaderboard()` (top 100 con ≥ 5 clasificatorias + tu posición) y página `/clasificacion`.
  - Ficheros: `supabase/migrations/<ts>_leaderboard.sql`, `app/(app)/clasificacion/page.tsx`
  - Hecho cuando: test con 120 perfiles; un jugador en el puesto 110 ve su posición.

---

## Hito 8 — PWA, reglas y pulido

*Deja funcionando: instalable y presentable.*

- [ ] **T080** `manifest.json`, iconos y service worker que cachea el armazón y `/reglas`; las rutas de partida van siempre a red.
  - Ficheros: `app/manifest.ts`, `public/icons/`, `app/sw.ts`
  - Hecho cuando: Lighthouse marca la app como instalable; en modo avión abren `/reglas` y el tablero de deducción de una partida guardada.

- [ ] **T081** [P] Página `/reglas` con el origen del nombre (DESIGN, "Sobre el nombre"), referencia andina, nada mesoamericano.
  - Ficheros: `app/reglas/page.tsx`, `messages/es.json`
  - Hecho cuando: revisada contra spec §4.

- [ ] **T082** [P] Preparar inglés: `messages/en.json` con las mismas claves y una prueba que falla si a uno le faltan claves del otro.
  - Ficheros: `messages/en.json`, `tests/i18n.test.ts`
  - Hecho cuando: Vitest en verde.

- [ ] **T083** [P] Accesibilidad: `axe` en Playwright sobre inicio, partida y declaración; contraste AA; objetivos de 44 px.
  - Ficheros: `e2e/a11y.spec.ts`
  - Hecho cuando: cero violaciones serias.

- [ ] **T084** [P] Rendimiento: tiempo hasta interactivo < 3 s en 4G con móvil de gama media (Lighthouse con perfil móvil).
  - Ficheros: `specs/001-mvp/measurements.md`
  - Hecho cuando: el número está anotado y cumple.

- [ ] **T085** Prueba de carga: 100 partidas simultáneas de bots contra la instancia de Supabase.
  - Ficheros: `scripts/load_test.ts`, `specs/001-mvp/measurements.md`
  - Hecho cuando: latencias de acción y propagación dentro de objetivo, y conexiones Realtime por debajo del límite del plan gratuito.

- [ ] **T086** Bot `hard`. **Recortable**: si no está a tiempo, sale del MVP (plan §7 y §10).
  - Ficheros: `supabase/migrations/<ts>_bot_hard.sql`, `tests/db/bots/hard.test.ts`
  - Hecho cuando: gana al `normal` en más del 60 % de 200 partidas.

- [ ] **T087** Despliegue: proyecto Supabase gestionado (migraciones por CLI, nunca desde el panel), Vercel, variables de entorno.
  - Ficheros: `README.md`, `.github/workflows/deploy.yml`
  - Hecho cuando: la URL pública funciona y la CI de fuga corre también contra la base desplegada.

- [ ] **T088** Revisión final con la lista de la constitución §6 para cada hito.
  - Ficheros: `specs/001-mvp/checklist.md`
  - Hecho cuando: todas las casillas marcadas, incluida la prueba en un móvil real de 360 px.
