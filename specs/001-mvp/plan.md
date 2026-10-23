# Plan 001 — MVP de Quipu

> Ubicación destino en el repo: `specs/001-mvp/plan.md`
> Rama: `001-mvp`
> Depende de: `spec-001-mvp.md` y de la constitución

Este documento dice **cómo** se construye lo que describe la spec. Si algo aquí contradice la spec, manda la spec.

---

## 1. Decisiones de arquitectura

### D1 — La lógica de juego vive en funciones de Postgres

Todas las acciones de juego son funciones `plpgsql` marcadas `SECURITY DEFINER`, invocadas por RPC desde el cliente. No hay servidor de juego aparte.

**Por qué.** Una acción de juego es una transacción: valida, muta varias tablas y registra un evento, todo o nada. Postgres hace eso de forma nativa. Un servidor Node intermedio añadiría una capa que puede fallar a mitad y un despliegue más que mantener, sin aportar nada que la base de datos no haga ya.

**Lo que cuesta.** Depurar `plpgsql` es más incómodo que depurar TypeScript, y no se comparte código con el cliente. Se compensa con tests de integración (Vitest + `supabase-js`) que cubren la lógica llamando a las funciones por RPC.

### D2 — La información oculta se protege por ausencia de política, no por filtro

`game_tiles` tiene RLS activada y **ninguna política** `SELECT`. Eso significa que ningún cliente puede leerla jamás, pase lo que pase. El único acceso es a través de funciones `SECURITY DEFINER`, que son las que deciden qué ve cada jugador.

**Por qué así.** Un filtro que hay que acordarse de aplicar se olvida algún día. Una tabla sin política de lectura no se puede leer ni por descuido.

### D3 — El estado se lee por función, no por vista

`get_game_state(p_game_id)` devuelve un único JSON con todo lo que el jugador que llama puede ver. No hay vista filtrada, porque una vista sobre `game_tiles` tendría que volver a resolver "quién pregunta" en cada fila y es más fácil equivocarse.

### D4 — Las tareas periódicas son `pg_cron`

Emparejamiento, turnos agotados, turnos de bot y caducidad de salas. Cuatro trabajos, ningún servicio externo.

**Riesgo asumido.** `pg_cron` tiene granularidad de un segundo en Supabase y los trabajos no se solapan si se protegen con `pg_try_advisory_lock`. Todos lo usan.

### D5 — Dos variantes del componente de ficha

Del diseño: la ficha ornamentada (barras en los márgenes, sombras de hueco) no sobrevive por debajo de unos 100 px. Habrá `<TileDetailed>` y `<TileCompact>`, con la misma API de props y distinto dibujo. No es un `scale()` del mismo SVG.

---

## 2. Esquema de base de datos

### 2.1 Tipos

```sql
create type game_mode    as enum ('ranked', 'private', 'practice');
create type game_status  as enum ('waiting', 'dealing', 'active', 'finished', 'cancelled');
create type player_state as enum ('active', 'eliminated', 'abandoned');
create type turn_phase   as enum ('reveal', 'clue');
create type tile_place   as enum ('reserve', 'support', 'pool', 'spent');
create type clue_kind    as enum ('classify', 'compare');
```

### 2.2 Tablas

**`tile_definitions`** — las 60 fichas del juego. Datos semilla, nunca se modifica en caliente.

| columna | tipo | nota |
|---|---|---|
| `number` | `smallint` PK | 1–60 |
| `color_index` | `smallint` | `(number - 1) % 5`, redundante pero indexable |
| `points` | `smallint` | 1, 2 o 3. Viene de `supabase/seed/points_table.sql` |

**`profiles`** — datos públicos del jugador.

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | referencia a `auth.users(id)` |
| `display_name` | `citext` único | 3–16 caracteres |
| `avatar_key` | `text` | clave de un avatar del catálogo, no una URL |
| `elo` | `integer` | por defecto 1000, nunca por debajo de 100 |
| `ranked_games` | `integer` | |
| `ranked_wins` | `integer` | |
| `is_guest` | `boolean` | `true` mientras sea cuenta anónima |
| `created_at` | `timestamptz` | |

**`games`**

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | |
| `mode` | `game_mode` | |
| `status` | `game_status` | |
| `current_seat` | `smallint` | asiento al que le toca |
| `phase` | `turn_phase` | `reveal` o `clue` dentro del turno |
| `turn_deadline` | `timestamptz` | |
| `winner_player_id` | `uuid` | |
| `event_seq` | `bigint` | contador de eventos, se incrementa dentro de la transacción |
| `created_at`, `started_at`, `finished_at` | `timestamptz` | |

**`game_players`**

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | identidad del jugador **dentro de la partida** |
| `game_id` | `uuid` | |
| `profile_id` | `uuid` nulo | nulo si es bot |
| `seat` | `smallint` | 0…3, orden de turno |
| `is_bot` | `boolean` | |
| `bot_difficulty` | `text` | `easy`, `normal`, `hard` |
| `state` | `player_state` | |
| `has_declared` | `boolean` | la única oportunidad |
| `timeouts` | `smallint` | turnos agotados consecutivos |
| `last_seen_at` | `timestamptz` | para mostrar "desconectado" |

Restricciones: `unique (game_id, seat)`, `unique (game_id, profile_id)`.

**`game_tiles`** — tabla crítica.

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | |
| `game_id` | `uuid` | |
| `number` | `smallint` | referencia a `tile_definitions` |
| `place` | `tile_place` | dónde está |
| `owner_id` | `uuid` nulo | `game_players.id` si está en un soporte |
| `slot` | `smallint` nulo | 0…4, posición ascendente en el soporte |

Restricciones: `unique (game_id, number)`, `unique (game_id, owner_id, slot)`.
RLS activada, **sin ninguna política**.

**`game_clues`** — pistas pedidas, todas públicas.

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | |
| `game_id` | `uuid` | |
| `asker_id` | `uuid` | `game_players.id` |
| `tile_number` | `smallint` | la ficha usada |
| `kind` | `clue_kind` | |
| `target_slot` | `smallint` nulo | solo en `compare` |
| `answer_position` | `smallint` nulo | 0…5, solo en `classify` |
| `answer_same` | `boolean` nulo | solo en `compare` |
| `created_at` | `timestamptz` | |

**`game_events`** — registro ordenado e inmutable.

| columna | tipo | nota |
|---|---|---|
| `id` | `bigint` identidad | |
| `game_id` | `uuid` | |
| `seq` | `bigint` | correlativo por partida |
| `kind` | `text` | `tile_revealed`, `clue_asked`, `declared`, `eliminated`, `game_ended`, `turn_timeout` |
| `actor_id` | `uuid` nulo | |
| `payload` | `jsonb` | **solo información pública** |
| `created_at` | `timestamptz` | |

Restricción: `unique (game_id, seq)`.

> **Regla de oro:** si un dato no puede verlo todo el mundo, no entra en `payload`. Hay un test que recorre todos los eventos de una partida simulada y comprueba que ningún número oculto aparece.

**`rooms`**

| columna | tipo | nota |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` único | 6 caracteres del alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` |
| `host_id` | `uuid` | `profiles.id` |
| `seats` | `smallint` | 2–4 |
| `fill_with_bots` | `boolean` | |
| `game_id` | `uuid` nulo | se rellena al iniciar |
| `expires_at` | `timestamptz` | creación + 30 min |

**`room_members`** — `(room_id, profile_id, joined_at)`.

**`matchmaking_queue`**

| columna | tipo | nota |
|---|---|---|
| `profile_id` | `uuid` PK | |
| `elo` | `integer` | copia en el momento de entrar |
| `joined_at` | `timestamptz` | |

**`elo_history`** — `(id, game_id, profile_id, elo_before, elo_after, delta, k_factor, created_at)`.

### 2.3 Políticas RLS

| tabla | select | insert / update / delete |
|---|---|---|
| `tile_definitions` | público | nadie |
| `profiles` | público | solo el propio `id` puede actualizar, y solo `display_name` y `avatar_key` |
| `games` | si eres participante | nadie (solo funciones) |
| `game_players` | si eres participante de esa partida | nadie |
| `game_clues` | si eres participante | nadie |
| `game_events` | si eres participante | nadie |
| `game_tiles` | **ninguna política** | nadie |
| `rooms`, `room_members` | si eres miembro, o por código exacto | nadie |
| `matchmaking_queue` | solo tu propia fila | nadie |
| `elo_history` | público | nadie |

Función auxiliar `is_participant(p_game_id uuid)`, `stable`, usada por las políticas.

---

## 3. Funciones de juego

Todas empiezan bloqueando la partida:

```sql
select * into v_game from games where id = p_game_id for update;
```

Eso serializa cualquier par de acciones sobre la misma partida, que es lo que resuelve el problema de las dos declaraciones simultáneas.

### `create_room(p_seats smallint, p_fill_bots boolean) → text`
Genera código único (reintenta ante colisión), crea sala y mete al anfitrión. Devuelve el código.

### `join_room(p_code text) → uuid`
Valida que existe, no ha caducado, no está llena y no ha empezado.

### `start_game(p_room_id uuid) → uuid`
Solo el anfitrión. Mínimo 2 participantes. Rellena con bots si procede. Llama a `deal_game`.

### `deal_game(p_game_id uuid)` *(interna)*
1. Inserta las 60 fichas en `game_tiles` con `place = 'reserve'`.
2. Para cada jugador, elige al azar una ficha de cada color de entre las de la reserva, las pasa a `place = 'support'` y les asigna `slot` por orden ascendente de número.
3. Pasa una ficha de cada color a `place = 'pool'`.
4. `status = 'active'`, `current_seat = 0`, `phase = 'reveal'`, `turn_deadline = now() + 60s`.
5. Evento `game_started`.

### `reveal_tile(p_game_id uuid, p_color smallint)`
Valida turno y `phase = 'reveal'`. Elige al azar una ficha de ese color en reserva, la pasa a `pool`. Si no quedan de ese color, error `no_tiles_of_color`. Si la reserva está vacía, salta la acción. `phase = 'clue'`. Evento `tile_revealed` con el número (público).

### `ask_clue(p_game_id uuid, p_tile smallint, p_kind clue_kind, p_slot smallint)`
Valida turno, `phase = 'clue'` y que la ficha está en `pool`.

- `classify`: cuenta cuántas fichas del soporte del jugador tienen número menor que `p_tile`. Ese conteo (0–5) es la respuesta.
- `compare`: compara `points` de `p_tile` con los de la ficha en `slot = p_slot` del jugador.

Inserta en `game_clues`, pasa la ficha a `place = 'spent'`, avanza el turno al siguiente jugador `active`, `phase = 'reveal'`, nuevo `turn_deadline`. Evento `clue_asked`.

> La respuesta la calcula el servidor. En la mesa física la da un vecino; aquí no hace falta, y así nadie puede responder mal.

### `declare_code(p_game_id uuid, p_numbers smallint[])`
Valida que la partida está activa, que el jugador está `active` y que `has_declared = false`. Marca `has_declared = true` pase lo que pase.

Compara el array ordenado con los números reales del soporte.

- Aciertos: `status = 'finished'`, `winner_player_id`, evento `game_ended`, y si `mode = 'ranked'`, `apply_elo`.
- Falla: `state = 'eliminated'`, evento `eliminated`. Si queda un solo jugador `active`, ese gana.

### `abandon_game(p_game_id uuid)`
`state = 'abandoned'`. Cuenta como derrota a efectos de ELO.

### `get_game_state(p_game_id uuid) → jsonb`
Único punto de lectura del estado. Devuelve:

```json
{
  "game":    { "status", "phase", "current_seat", "turn_deadline", "reserve_by_color" },
  "me":      { "player_id", "seat", "state", "has_declared",
               "support": [ { "slot", "color_index", "resolved_number" } ] },
  "players": [ { "player_id", "seat", "display_name", "state",
                 "support": [ { "slot", "number", "points" } ] } ],
  "pool":    [ { "number", "points" } ],
  "clues":   [ … ],
  "event_seq": 128
}
```

`me.support[].resolved_number` es **siempre `null`** mientras la partida está activa. Existe solo para rellenarlo cuando termina y poder enseñar el resultado.

### `apply_elo(p_game_id uuid)` *(interna)*

```
E_a = 1 / (1 + 10^((elo_b − elo_a) / 400))
K   = 32 si ranked_games < 20, 24 si elo < 2000, 16 si no
Δ   = round(K × (S − E))
elo = greatest(100, elo + Δ)
```

Escribe en `elo_history` y actualiza `profiles`. La partida se marca para que nunca se aplique dos veces.

---

## 4. Tareas periódicas

| trabajo | frecuencia | qué hace |
|---|---|---|
| `resolve_matchmaking()` | 3 s | Empareja el jugador más antiguo de la cola con el ELO más cercano dentro de su ventana. Ventana = `50 + 25 × floor(espera_segundos / 10)`, tope 400. Crea la partida y saca a ambos de la cola |
| `tick_timeouts()` | 10 s | Para cada partida activa con `turn_deadline < now()`: juega el turno automáticamente (revela un color al azar y pide `classify` sobre esa misma ficha), `timeouts += 1`. Al tercero consecutivo, elimina por abandono |
| `play_bot_turns()` | 5 s | Para cada partida activa cuyo turno sea de un bot y lleve más de 2 segundos esperando, ejecuta el turno del bot |
| `expire_rooms()` | 60 s | `status = 'cancelled'` en salas con `expires_at < now()` sin partida |

Todos toman `pg_try_advisory_lock` con una clave fija y salen sin hacer nada si ya hay otra ejecución en marcha.

---

## 5. Tiempo real

El cliente abre **un canal por partida** y se suscribe a cambios en cuatro tablas, filtrando por `game_id`:

| tabla | para qué |
|---|---|
| `games` | turno, fase, cronómetro, fin de partida |
| `game_players` | eliminaciones, desconexiones |
| `game_events` | el historial que se va llenando |
| `game_clues` | las pistas que quedan a la vista |

Realtime respeta RLS, así que un espectador no suscrito no recibe nada.

**Detección de huecos.** Cada evento trae `seq`. El cliente guarda el último visto; si llega uno con `seq` mayor que el esperado, descarta el delta y vuelve a pedir `get_game_state`. Es la misma ruta que usa la reconexión, así que se prueba sola.

**Un canal por partida, no por jugador.** Importa para el plan gratuito: dos jugadores comparten canal.

---

## 6. Cliente

### 6.1 Rutas

```
app/
  (auth)/entrar/page.tsx
  (app)/page.tsx                  inicio
  (app)/sala/[codigo]/page.tsx    sala de espera
  (app)/cola/page.tsx             buscando rival
  (app)/partida/[id]/page.tsx     partida
  (app)/clasificacion/page.tsx
  (app)/perfil/page.tsx
  reglas/page.tsx                 accesible sin conexión
```

### 6.2 Componentes de juego

```
components/game/
  Tile.tsx            despacha a Detailed o Compact según prop `size`
  TileDetailed.tsx    SVG ornamentado, ≥100 px
  TileCompact.tsx     SVG simplificado, 44–99 px
  Support.tsx         las 5 ranuras colgando de la barra
  Pool.tsx            mazo visible
  ClueList.tsx        pistas enganchadas al soporte
  TurnBar.tsx         turno, cronómetro, reserva
  DeductionBoard.tsx  tablero de 60 números, tachado manual y automático
  DeclareSheet.tsx    hoja de declaración
```

Props de `Tile`: `{ number | null, colorIndex, points | null, state: 'solved' | 'unknown' | 'public', size, selected, onPress }`.

### 6.3 Estado

- **Servidor:** TanStack Query, una clave por partida. Realtime no escribe en caché directamente: invalida y deja que se refresque. Más llamadas, mucho menos riesgo de desincronización.
- **Local:** Zustand para lo que no sale del dispositivo — tachados manuales del tablero de deducción y candidatos anotados, persistidos en `localStorage` con la clave de la partida.
- **Optimista:** solo el cronómetro y el estado "enviando" de los botones. Ninguna acción de juego se pinta como hecha antes de que el servidor confirme.

### 6.4 PWA

`manifest.json`, iconos del catálogo de diseño, service worker que cachea el armazón de la aplicación y la página de reglas. Las rutas de partida son siempre de red: una partida cacheada es una partida mal pintada.

---

## 7. Bots

El bot corre **en el servidor**, en `plpgsql`, usando las mismas funciones que un humano. No hay lógica de bot en el cliente.

Estado que mantiene, recalculado en cada turno a partir de hechos públicos:

```
candidatos[slot] = { números del color de ese slot }
                   − números visibles en cualquier soporte ajeno
                   − números ya revelados
                   ∩ restricciones de orden ascendente entre slots
                   ∩ restricciones de las pistas que ha pedido
```

| dificultad | elige la pista | declara |
|---|---|---|
| `easy` | al azar | cuando le quedan ≤ 2 candidatos por slot, aceptando fallar |
| `normal` | la que más candidatos descarta en el peor caso | cuando los 5 slots tienen un único candidato |
| `hard` | la que más reduce la incertidumbre esperada | igual, y además aprovecha las pistas de los rivales |

`easy` y `normal` se implementan primero. `hard` puede quedar fuera del primer corte si aprieta el calendario; es la única parte del alcance que admite recorte.

---

## 8. Tests

### Vitest de integración — la lógica de juego

Cada test usa usuarios anónimos reales y llama a las funciones por RPC, como lo hará el cliente. La limpieza borra solo lo que el test creó. No hay base local: el entorno es el proyecto Supabase enlazado.

| grupo | qué cubre |
|---|---|
| reparto | 60 fichas, 5 por jugador una de cada color, orden ascendente, sin repetidos |
| turno | no puedes jugar fuera de turno; no puedes pedir pista antes de revelar; no puedes revelar un color agotado |
| pistas | `classify` devuelve la posición correcta en los 6 casos; `compare` responde bien con 1, 2 y 3 puntos |
| declaración | acierto gana; fallo elimina; segunda declaración rechazada; último en pie gana |
| concurrencia | dos declaraciones simultáneas producen un solo ganador |
| tiempo | turno agotado juega solo; tres seguidos eliminan |
| ELO | suma cero entre los dos jugadores; suelo de 100; K correcto por tramo |
| **fuga** | un jugador no puede leer sus propios números por ninguna vía: `game_tiles` directo, `get_game_state`, eventos, pistas |

El grupo de fuga es obligatorio y se ejecuta en cada commit.

### Vitest — cliente

Reducción de candidatos del tablero de deducción, tachado automático, validación de la declaración antes de enviar.

### Playwright — extremo a extremo

Partida completa entre dos navegadores: crear sala, unirse, jugar tres turnos, declarar, ver resultado. Y una desconexión de 30 segundos con recuperación.

---

## 9. Orden de construcción

Cada hito se termina antes de empezar el siguiente, y "terminado" significa jugable y con tests.

| # | hito | qué deja funcionando |
|---|---|---|
| 1 | Esquema, semilla y RLS | Base de datos con las 60 fichas y las políticas puestas |
| 2 | Motor de juego | `deal_game`, `reveal_tile`, `ask_clue`, `declare_code`, `get_game_state` con los tests de integración en verde, incluido el grupo de fuga |
| 3 | Cuentas y perfil | Registro, invitado, nombre y avatar |
| 4 | Partida jugable contra bot `normal` | Primer bucle completo, sin red: tú contra el servidor |
| 5 | Salas privadas y tiempo real | Dos personas jugando con código |
| 6 | Cronómetro, abandono y reconexión | La partida ya no se cuelga |
| 7 | Cola, ELO y clasificación | Modo clasificatorio completo |
| 8 | PWA, reglas y pulido | Instalable y presentable |

El hito 4 es el que de verdad dice si el juego funciona. Conviene llegar ahí pronto y jugarlo mucho antes de construir nada más.

---

## 10. Lo que puede salir mal

| riesgo | señal temprana | qué hacer |
|---|---|---|
| `plpgsql` se hace inmanejable | el motor pasa de ~800 líneas | partir en funciones auxiliares por área, no migrar a Node |
| Realtime no llega al objetivo de medio segundo | medirlo en el hito 5 con dos móviles reales | subir a un plan de pago antes que cambiar de arquitectura |
| Las partidas se hacen largas | más de 20 minutos de media en pruebas | reducir fichas por jugador de 5 a 4, que es un cambio de constante |
| El bot `hard` se come el calendario | no está listo al llegar al hito 7 | sacarlo del MVP, dejar `easy` y `normal` |
| Nadie en la cola | esperas medias por encima de 2 minutos | ofrecer bot antes, a los 30 segundos en vez de 90 |

---

## 11. Lo que este plan no decide

- Catálogo concreto de avatares.
- Textos de interfaz definitivos (van en `messages/es.json`).
- Estrategia de analítica.
- Nombre definitivo y dominio.
