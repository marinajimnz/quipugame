# Spec 001 — MVP jugable de Quipu

> Ubicación destino en el repo: `specs/001-mvp/spec.md`
> Rama: `001-mvp`
> Estado: borrador para revisión

Este documento describe **qué** se construye y **por qué**. Las decisiones de implementación (esquema concreto, nombres de funciones, estructura de componentes) van en `plan.md`.

---

## 1. Visión

Un juego de deducción lógica para móvil, rápido de entender y difícil de dominar, que se pueda jugar en 10–15 minutos contra desconocidos de tu nivel o contra amigos.

**Qué lo hace distinto:** la información oculta es la tuya propia. Ves los números de todos menos los tuyos, y tienes que reconstruirlos preguntando. Esa inversión es el gancho.

---

## 2. Usuarios

| Perfil | Necesidad | Qué espera de la app |
|---|---|---|
| Jugador casual | Entretenerse 10 minutos en el transporte | Entrar y estar jugando en menos de 30 segundos |
| Jugador competitivo | Medirse y progresar | Rivales de su nivel, ELO visible, ranking |
| Grupo de amigos | Jugar juntos estando separados | Crear sala y compartir un código |
| Jugador nuevo | Entender las reglas sin leer un manual | Modo práctica contra bots, con ayudas |

---

## 3. Alcance

### Dentro del MVP

1. Cuentas y perfil (registro, avatar, estadísticas básicas).
2. Partida online privada mediante código de sala (2–4 jugadores).
3. Partida clasificatoria con emparejamiento por ELO (2 jugadores) y ranking global.
4. Modo práctica contra bots (1 humano + 1–3 bots), sin efecto en el ELO.
5. Motor de juego completo en servidor, con reconexión y manejo de abandono.

### Fuera del MVP (anotado para después)

- Partidas clasificatorias de 3–4 jugadores.
- Lista de amigos, invitaciones, chat.
- Torneos, temporadas, recompensas cosméticas.
- Notificaciones push y partidas asíncronas por turnos lentos.
- Repetición de partida y estadísticas avanzadas.
- Monetización.

---

## 4. Reglas del juego (fuente de verdad)

Esta sección es normativa. Cualquier ambigüedad se resuelve aquí, no en el código.

### 4.1 Componentes

- **60 fichas**, numeradas del 1 al 60, todas distintas.
- **5 colores**, 12 fichas por color. El color se deriva del número:
  `color_index = (numero − 1) mod 5` → colores 0…4.
  Es decir, el color 0 agrupa 1, 6, 11, …, 56; el color 1 agrupa 2, 7, 12, …, 57; y así.
- Cada ficha tiene además un **valor de puntos**: 1, 2 o 3. Hay 20 fichas de cada valor, repartidas de forma equilibrada: **4 fichas de cada valor de puntos dentro de cada color**.
- La tabla número → puntos es **fija y pública**. No se aleatoriza entre partidas: forma parte del tablero de referencia que el jugador consulta.

**Tabla de puntos: fijada.** Generada con `scripts/generate_points_table.py` (semilla `20261023`) y verificada contra seis criterios: equilibrio 4/4/4 por color, ausencia de fórmula aritmética que la prediga (ninguna supera el 60 % de acierto frente al ~39 % del azar), rachas de como mucho 3 consecutivos, reparto parejo por bloques de 10, correlación número/puntos de +0,047 y ausencia de periodicidad y de simetría especular.

Los datos semilla viven en `supabase/seed/points_table.sql` y su equivalente para el cliente en `src/game/pointsTable.ts`. **No se editan a mano:** si hay que cambiarlos, se regeneran con otra semilla y se vuelven a verificar.

| Número : puntos |
|---|
| 1:2 2:1 3:1 4:2 5:2 6:3 7:1 8:2 9:3 10:2 |
| 11:1 12:3 13:3 14:1 15:3 16:1 17:2 18:3 19:3 20:2 |
| 21:1 22:2 23:1 24:1 25:1 26:3 27:1 28:2 29:3 30:3 |
| 31:2 32:2 33:2 34:1 35:1 36:3 37:1 38:3 39:2 40:3 |
| 41:3 42:3 43:2 44:3 45:1 46:1 47:2 48:1 49:2 50:3 |
| 51:2 52:3 53:3 54:2 55:1 56:2 57:3 58:1 59:1 60:2 |

### 4.2 Preparación

1. Las 60 fichas forman la **reserva**, boca abajo. El color de cada ficha es visible aunque su número no lo sea.
2. Cada jugador recibe **una ficha de cada color** (5 fichas), al azar y sin repetición entre jugadores.
3. Las 5 fichas de cada jugador se ordenan **de menor a mayor número** en su soporte. Esta ordenación es pública.
4. Se revelan **5 fichas de la reserva, una de cada color**, que forman el **mazo visible**.
5. Cada jugador ve: las fichas de todos los demás jugadores, el mazo visible, y el orden ascendente de sus propias fichas. **No ve sus propios números.**

### 4.3 Estructura de un turno

El jugador activo realiza **dos acciones, siempre en este orden**:

**Acción 1 — Revelar.** Elige un color con fichas disponibles en la reserva y revela una. Su número pasa a ser público. La ficha se añade al mazo visible, que pasa temporalmente a tener 6 fichas.

> Si el color elegido está agotado, debe elegir otro. Si la reserva está completamente vacía, se omite esta acción y el mazo visible permanece como está.

**Acción 2 — Pedir una pista.** Elige **una** de las fichas del mazo visible y la usa para una de estas dos preguntas sobre **sus propias fichas ocultas**:

- **CLASIFICAR.** ¿Entre qué dos de mis fichas encajaría esta por número?
  Respuesta: un índice de 0 a 5, donde 0 significa "por debajo de todas" y 5 "por encima de todas".
- **COMPARAR.** ¿Esta ficha tiene el mismo número de puntos que mi ficha de la posición *i*?
  Respuesta: sí o no.

La ficha usada **abandona el mazo visible** y queda expuesta públicamente junto al soporte del jugador, con la respuesta asociada, hasta el final de la partida. El mazo visible vuelve a tener 5 fichas.

Toda pista y toda respuesta son **públicas**: todos los jugadores las ven.

Terminada la acción 2, el turno pasa al siguiente jugador en orden.

### 4.4 Declaración

En **cualquier momento**, incluso fuera de su turno, un jugador puede declarar su código: anuncia sus 5 números en orden ascendente.

- Cada jugador tiene **una única oportunidad** de declarar en toda la partida.
- Si acierta los 5 números, **gana inmediatamente** y la partida termina para todos.
- Si falla aunque sea uno, queda **eliminado**. Los demás siguen jugando. Un jugador eliminado sigue viendo la partida pero no juega turnos.
- Si todos los jugadores menos uno quedan eliminados, el superviviente **gana automáticamente**.

Si dos declaraciones llegan casi a la vez, el servidor las procesa **en orden estricto de llegada**. La primera declaración correcta termina la partida; una declaración posterior ya no se procesa.

### 4.5 Final de partida

La partida termina cuando:

- Un jugador declara correctamente → ese jugador gana.
- Queda un único jugador no eliminado → ese jugador gana.
- Todos los jugadores quedan eliminados → nadie gana (empate técnico).
- Se agota la reserva y se completa una ronda más sin ganador → nadie gana (empate técnico). *Situación muy improbable; existe como red de seguridad.* La "ronda más" empieza en el turno en que la reserva queda vacía y termina cuando el turno vuelve a ese mismo asiento.

### 4.6 Tiempo

- Cada turno tiene un límite de **60 segundos**.
- Si se agota, el servidor juega el turno automáticamente: revela una ficha de un color al azar y pide una pista de CLASIFICAR sobre esa misma ficha. Si el jugador ya había revelado, CLASIFICA la ficha que reveló. Si la reserva está vacía, CLASIFICA una ficha al azar del mazo visible.
- Tres turnos consecutivos agotados equivalen a **abandono**: el jugador se considera eliminado.

---

## 5. Historias de usuario y criterios de aceptación

### HU-1 — Crear cuenta y perfil

**Como** jugador nuevo, **quiero** crear una cuenta rápidamente **para** que mis partidas y mi ELO se guarden.

Criterios:
- Puedo registrarme con correo + contraseña, o con un proveedor OAuth.
- Puedo jugar como invitado, con una cuenta anónima que luego puedo convertir en permanente sin perder progreso.
- Como invitado puedo jugar **contra bots y en salas privadas**. Para entrar en clasificatoria se me pide convertir la cuenta; al hacerlo conservo las partidas jugadas y arranco con el ELO inicial.
- La conversión es un solo paso y no me saca de la pantalla en la que estoy.
- Elijo un nombre visible único de 3 a 16 caracteres.
- Mi perfil muestra: nombre, avatar, ELO actual, partidas jugadas, partidas ganadas y porcentaje de victoria. Jugadas y ganadas cuentan **todas** las partidas; el factor K y el ranking usan solo las clasificatorias.
- Al crear una cuenta (también de invitado) recibo un nombre provisional `Invitado-XXXXX`, que puedo cambiar cuando quiera.

### HU-2 — Jugar con amigos mediante código

**Como** jugador, **quiero** crear una sala y compartir un código **para** jugar con gente concreta.

Criterios:
- Al crear la sala elijo el número de plazas (2–4) y si se rellenan con bots.
- Obtengo un código de 6 caracteres alfanuméricos, legible y sin caracteres ambiguos (sin `0`, `O`, `1`, `I`).
- Puedo compartir el código mediante un enlace que abre la app directamente en la sala.
- La sala muestra en tiempo real quién se ha unido.
- Solo el anfitrión puede iniciar la partida, y solo si hay al menos 2 participantes.
- La sala caduca a los 30 minutos sin iniciarse.
- Estas partidas **no afectan al ELO**.

### HU-3 — Jugar partida clasificatoria

**Como** jugador competitivo, **quiero** que me emparejen con alguien de mi nivel **para** que la partida sea reñida.

Criterios:
- Entro en una cola con un solo toque y veo el tiempo de espera y el rango de ELO que se está buscando.
- El emparejamiento busca inicialmente rivales en ±50 de ELO y **amplía el rango progresivamente** hasta un máximo de ±400.
- Si no se encuentra rival en 90 segundos, se me ofrece esperar más o jugar contra un bot (sin ELO).
- Puedo salir de la cola en cualquier momento.
- Al terminar veo claramente cuánto ELO he ganado o perdido.
- **En el MVP las partidas clasificatorias son de 2 jugadores.** (Las de 3–4 quedan para una fase posterior, porque el reparto de ELO entre varios requiere su propia validación.)

### HU-4 — Jugar una partida

**Como** jugador, **quiero** una interfaz clara **para** poder deducir sin perderme.

Criterios:
- Veo los soportes de todos los jugadores con sus números; el mío muestra 5 huecos con el orden ascendente indicado.
- Veo el mazo visible, el número de fichas restantes en la reserva y de quién es el turno.
- Dispongo de un **tablero de deducción** personal con las 60 fichas, donde puedo tachar y destachar números manualmente.
- La app tacha automáticamente los números que ya son públicamente imposibles (fichas visibles de otros y fichas reveladas), y distingue visualmente los tachados automáticos de los míos.
- Puedo anotar candidatos en cada una de mis 5 posiciones.
- Todas las pistas pedidas por cualquier jugador quedan visibles y consultables durante toda la partida.
- Un historial desplegable muestra los eventos en orden.

### HU-5 — Declarar el código

**Como** jugador, **quiero** declarar mi código **para** intentar ganar.

Criterios:
- El botón de declarar está siempre accesible, también fuera de mi turno.
- Antes de enviar veo un resumen de mis 5 números y una **confirmación explícita** que advierte de que solo tengo una oportunidad.
- La app valida en local que los 5 números son distintos, ascendentes y de los colores correctos.
- Si acierto, la partida termina y veo el resultado.
- Si fallo, quedo eliminado, veo cuáles eran mis números reales y puedo seguir observando.

### HU-6 — Jugar contra bots

**Como** jugador nuevo, **quiero** practicar sin presión **para** aprender las reglas.

Criterios:
- Puedo iniciar una partida contra 1–3 bots eligiendo dificultad (fácil, normal, difícil).
- El bot juega con la misma información pública que un humano: **no conoce sus propios números** ni los que no se han revelado.
- El bot tarda entre 2 y 6 segundos en jugar, para que la partida se siga bien.
- Estas partidas **no afectan al ELO**.

### HU-7 — Consultar el ranking

**Como** jugador competitivo, **quiero** ver dónde estoy **para** tener un objetivo.

Criterios:
- Hay una clasificación global con los 100 mejores por ELO.
- Veo mi propia posición aunque esté fuera del top 100.
- Se muestran nombre, avatar, ELO y partidas jugadas.
- Solo cuentan jugadores con al menos 5 partidas clasificatorias completadas.

### HU-8 — Reconectar

**Como** jugador con mala conexión, **quiero** volver a la partida **para** no perderla por un túnel.

Criterios:
- Si pierdo la conexión, la app lo indica e intenta reconectar automáticamente.
- Al reconectar recupero el estado completo y actual de la partida.
- Mi cronómetro de turno sigue corriendo mientras estoy desconectado.
- Si vuelvo a abrir la app, me lleva directamente a mi partida en curso.

---

## 6. Modelo de datos (conceptual)

Entidades y su razón de ser. Las columnas exactas van en `plan.md`.

| Entidad | Contiene | Notas de seguridad |
|---|---|---|
| `profiles` | Datos públicos del jugador: nombre, avatar, ELO, contadores | Lectura pública, escritura solo del propio usuario |
| `games` | Una partida: modo, estado, jugador activo, ganador, marcas de tiempo | Legible por sus participantes |
| `game_players` | Participación de un jugador en una partida: asiento, estado (activo/eliminado), orden | |
| `game_tiles` | Cada ficha de la partida: número, propietario, posición, visibilidad | **Tabla crítica.** Nunca accesible directamente desde el cliente |
| `game_events` | Registro inmutable y ordenado de todo lo ocurrido: revelaciones, pistas, respuestas, declaraciones | Fuente de verdad para reconstruir y auditar |
| `rooms` | Salas privadas: código, anfitrión, plazas, caducidad | |
| `matchmaking_queue` | Jugadores esperando partida clasificatoria, con su ELO y hora de entrada | |
| `elo_history` | Variación de ELO por partida y jugador | Lectura pública |

**Regla de visibilidad.** El cliente nunca consulta `game_tiles`. Consulta una **función que filtra por el jugador que pregunta** (`get_game_state`), la cual oculta los números de las fichas propias y de la reserva, y expone todo lo demás. Esa función es el único camino.

**Excepción.** Un jugador eliminado o que ha abandonado, o cualquiera cuando la partida ha terminado, sí recibe los números de sus propias fichas: los demás jugadores ya los ven, así que no se revela nada nuevo.

---

## 7. Máquina de estados de una partida

```
          crear sala / entrar en cola
                      │
                      ▼
                 ESPERANDO ────────► CANCELADA
                      │ (plazas cubiertas / anfitrión inicia)
                      ▼
                REPARTIENDO
                      │ (fichas asignadas, mazo visible formado)
                      ▼
            ┌──► EN_CURSO ──────────┐
            │       │               │
            │   turno completado    │ declaración correcta
            │       │               │ o solo queda un jugador
            └───────┘               ▼
                                TERMINADA
```

Transiciones adicionales desde `EN_CURSO`:
- Declaración incorrecta → el jugador pasa a `eliminado`; la partida sigue.
- Turno agotado → el servidor juega el turno automáticamente.
- Tres turnos agotados consecutivos → jugador eliminado por abandono.

---

## 8. Operaciones del servidor

Cada una es **atómica**: valida, aplica y registra el evento en una sola transacción. Si algo falla, no se aplica nada.

| Operación | Entrada | Validaciones clave |
|---|---|---|
| Crear sala | plazas, bots sí/no | Código único no ambiguo |
| Unirse a sala | código | Sala existe, no llena, no iniciada |
| Iniciar partida | id de sala | Solicitante es el anfitrión, ≥2 participantes |
| Entrar en cola | — | No estar ya en cola ni en partida activa |
| Salir de cola | — | |
| Revelar ficha | id de partida, color | Es su turno, fase correcta, quedan fichas de ese color |
| Pedir pista | id de partida, ficha, tipo, posición | Es su turno, fase correcta, ficha está en el mazo visible |
| Declarar código | id de partida, 5 números | Partida en curso, jugador no eliminado, no ha declarado antes |
| Abandonar | id de partida | |

**Resolución del emparejamiento.** Tarea periódica cada 3 segundos: recorre la cola ordenada por antigüedad y empareja al jugador más antiguo con el candidato de ELO más cercano dentro de su ventana actual. La ventana arranca en ±50 y crece 25 puntos cada 10 segundos de espera, hasta ±400.

---

## 9. Tiempo real

El cliente se suscribe a dos canales por partida:

- **Estado**: cambios en la partida y en los jugadores (de quién es el turno, quién ha sido eliminado, fin de partida).
- **Eventos**: nuevos registros en el historial (ficha revelada, pista pedida y su respuesta, declaración).

El cliente **nunca deduce el estado**: lo recibe. Los eventos llegan numerados secuencialmente; si el cliente detecta un hueco en la numeración, pide el estado completo de nuevo.

---

## 10. Sistema de ELO

- ELO inicial: **1000**.
- Factor K: **32** durante las 20 primeras partidas clasificatorias, **24** después, **16** por encima de 2000 puntos.
- Fórmula estándar de Elo para enfrentamiento entre dos jugadores.
- El ELO **nunca baja de 100**.
- Los ajustes de los dos jugadores suman cero solo cuando tienen el mismo factor K y ninguno toca el suelo de 100. En el resto de casos cada jugador se calcula por separado.
- Solo las partidas clasificatorias modifican el ELO. Salas privadas y bots, no.
- Un abandono cuenta como derrota.
- Toda variación se registra en el historial, para poder recalcular si se cambia la fórmula.

**Preparado para 3–4 jugadores (fase posterior):** se compara a cada jugador con cada rival por parejas según su clasificación final, y se reparte el ajuste entre el número de enfrentamientos. Clasificación final: 1.º el ganador; después, empatados, los que no declararon; en último lugar, empatados, los que declararon mal.

---

## 11. Bots

El bot usa el **mismo motor de juego** que un humano y solo accede a información pública.

Mantiene, por cada una de sus 5 posiciones, el conjunto de números todavía posibles, y lo va reduciendo con cada hecho conocido: números ya visibles en otras fichas, el color obligatorio de cada posición, el orden ascendente, y las respuestas a sus propias pistas.

| Dificultad | Elección de pista | Cuándo declara |
|---|---|---|
| Fácil | Al azar | Cuando quedan pocos candidatos, con riesgo de fallar |
| Normal | Heurística: la pista que previsiblemente descarta más candidatos | Cuando las 5 posiciones tienen un único candidato |
| Difícil | La que maximiza la reducción esperada de incertidumbre | Igual, y además aprovecha la información que revelan las pistas de los rivales |

---

## 12. Requisitos no funcionales

| Requisito | Objetivo |
|---|---|
| Tiempo hasta interactivo | < 3 s en 4G, móvil de gama media |
| Latencia de una acción de juego | < 300 ms en percentil 95 |
| Propagación de un evento a los rivales | < 500 ms en percentil 95 |
| Partidas simultáneas soportadas | 100 sin degradación |
| Funcionamiento sin conexión | Pantallas de reglas y tablero de deducción accesibles; las acciones de juego requieren conexión |
| Accesibilidad | AA de contraste; color nunca como único portador de información |

---

## 13. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fuga de información oculta por un endpoint mal filtrado | Rompe el juego por completo | Acceso únicamente por función filtrada; test obligatorio por feature; RLS activa siempre |
| Dos declaraciones simultáneas | Dos ganadores o estado inconsistente | Bloqueo de fila sobre la partida y procesamiento estrictamente secuencial |
| Cola vacía en horas valle | Nadie puede jugar clasificatoria | Ampliación progresiva del rango de ELO y oferta de partida contra bot |
| Abandono masivo | Partidas colgadas | Límite de turno, juego automático y eliminación por abandono |
| Complejidad de las reglas para un jugador nuevo | Abandono en el primer minuto | Modo práctica, tachado automático y ayudas contextuales |
| Límites del plan gratuito de Supabase (conexiones de tiempo real) | Caída en picos | Medir pronto; un canal por partida, no por jugador |

---

## 14. Decisiones

### Cerradas

| Decisión | Resolución |
|---|---|
| Tabla de puntos de las 60 fichas | Generada y verificada por script, semilla `20261023`. Fijada en la sección 4.1 |
| Clasificatorias de 3–4 jugadores | Fuera del MVP. 3 y 4 jugadores solo en salas privadas |
| Cuentas de invitado | Invitado juega contra bots y en salas privadas; clasificatoria exige convertir la cuenta |

### Pendientes

1. **Nombre definitivo del juego** y disponibilidad de dominio, marca y tiendas de aplicaciones. "Quipu" es provisional (antes, "Quinteto").

---

## 15. Métricas de éxito del MVP

- Un jugador nuevo completa su primera partida contra bots sin consultar las reglas escritas.
- El 70 % de las partidas iniciadas llegan a su final.
- La espera media en cola clasificatoria es inferior a 30 segundos en hora punta.
- Ningún incidente de fuga de información oculta.
