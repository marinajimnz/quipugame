# Constitución — Quinteto

> Nombre en clave provisional. Documento vivo: cualquier cambio aquí obliga a revisar las specs que dependan de él.
> Ubicación destino en el repo: `.specify/memory/constitution.md`

---

## 1. Qué es Quinteto

Juego de lógica y deducción por turnos, online, para 2–4 jugadores, en formato aplicación móvil (PWA).

Cada jugador tiene 5 fichas numeradas que **todos ven menos él**. Mediante pistas que se van revelando públicamente, cada jugador deduce sus propios números. Gana el primero que los anuncia correctamente.

Partidas de 10–15 minutos, con emparejamiento por nivel (ELO), ranking y salas privadas por código.

---

## 2. Principios (no negociables)

### P1. El servidor es la única autoridad

Toda la lógica de juego — repartir fichas, resolver pistas, validar declaraciones, calcular ELO — se ejecuta en el servidor. El cliente **solo** envía intenciones y pinta el estado que recibe.

Ningún cálculo de juego se replica en el cliente "por rapidez". Si hace falta respuesta inmediata, se usa actualización optimista que el servidor confirma o revierte.

### P2. La información oculta nunca sale del servidor

Los números de las fichas propias de un jugador **jamás** se envían a su cliente, ni cifrados, ni en un campo que la UI "no pinte". Si un dato no debe verse, no viaja.

Corolario: toda consulta de estado de partida pasa por una vista o función que filtra por el jugador que pregunta. No existe un endpoint que devuelva el estado completo "en crudo".

Esto se verifica con tests, no con confianza: por cada feature que toque estado de partida debe existir un test que compruebe que un jugador no puede leer sus propios números.

### P3. Las reglas viven en un solo sitio

Las reglas del juego se definen una vez, en la spec del MVP, y se implementan una vez, en el motor del servidor. Bots, tutorial, modo práctica y partida online usan **el mismo motor**. No hay una "versión simplificada para el bot".

### P4. Móvil primero, y de verdad

Diseño para pantalla de 360–430 px de ancho, en vertical, con una sola mano. Objetivos táctiles de 44 px mínimo. Nada de hover como único medio de interacción. El escritorio es una versión centrada y ampliada del móvil, no al revés.

La partida debe ser jugable con conexión intermitente: reconexión transparente y recuperación de estado sin perder el turno.

### P5. Alcance pequeño, iteración corta

Se construye una feature completa y jugable antes de empezar la siguiente. "Completa" significa: funciona, tiene tests de la lógica, y se puede jugar de principio a fin.

Si una feature no cabe en una semana de trabajo, se parte.

### P6. Accesibilidad e idioma desde el día uno

- El color **nunca** es el único portador de información: cada color de ficha lleva además un símbolo o patrón distinguible.
- Contraste mínimo AA en texto e iconos.
- Todos los textos de interfaz salen de ficheros de traducción. Arranca en español, preparado para inglés.

### P7. Propiedad intelectual limpia

Quinteto es una implementación original de una mecánica de deducción. No se reutiliza nombre, arte, iconografía, textos de reglas ni personajes de ningún juego publicado. La terminología de la interfaz es propia.

### P8. Simplicidad de infraestructura

Un solo proveedor para base de datos, autenticación y tiempo real. No se añade un servicio nuevo (Redis, cola, servidor dedicado) hasta que una limitación medida lo exija. La justificación se documenta en el `plan.md` correspondiente.

---

## 3. Stack técnico

| Capa | Elección | Notas |
|---|---|---|
| Cliente | Next.js (App Router) + TypeScript, instalable como PWA | React 19, Server Components donde aporte |
| Estilos | Tailwind CSS | Tokens de diseño centralizados |
| Estado cliente | Zustand o Context + reducer | Decisión en el `plan.md` |
| Backend | Supabase | Postgres, Auth, Realtime, Edge Functions |
| Lógica de juego | Funciones de Postgres (`plpgsql`) invocadas por RPC, `SECURITY DEFINER` | Transaccional y atómico por diseño |
| Tiempo real | Supabase Realtime (Postgres Changes + Broadcast) | |
| Tareas periódicas | `pg_cron` | Emparejamiento, limpieza, turnos de bot |
| Tests | Vitest (cliente e integración contra la base de datos), Playwright (E2E) | Sin pgTAP ni Docker: la lógica de juego se prueba llamando a las funciones por RPC con clientes reales |
| Despliegue | Vercel (cliente) + Supabase gestionado | |

**Restricción:** el MVP debe funcionar dentro de los planes gratuitos de Vercel y Supabase.

---

## 4. Convenciones

- **Idioma del código:** inglés para identificadores, tablas, columnas y ramas. Español para textos de interfaz y documentación.
- **Base de datos:** `snake_case`, tablas en plural, claves primarias `id` de tipo `uuid`.
- **TypeScript:** `strict: true`. Tipos de la base de datos generados con `supabase gen types`, nunca escritos a mano.
- **Ramas:** `NNN-nombre-corto`, numeradas igual que la carpeta de su spec.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`…).
- **Migraciones:** toda migración de esquema es un fichero versionado en `supabase/migrations/`. No se toca el esquema desde el panel web.

---

## 5. Flujo de trabajo (SpecKit)

1. `/speckit.constitution` — este documento.
2. `/speckit.specify` — qué se construye y por qué. Sin decisiones técnicas.
3. `/speckit.plan` — cómo se construye. Esquema, endpoints, componentes.
4. `/speckit.tasks` — tareas ejecutables y ordenadas.
5. `/speckit.implement` — el agente implementa.

Regla: **ninguna tarea de implementación empieza sin su spec y su plan aprobados.** Si durante la implementación se descubre que la spec estaba mal, se para y se corrige la spec primero.

---

## 6. Criterios de calidad para dar una feature por terminada

- [ ] La lógica de juego tiene tests que cubren los casos límite descritos en la spec.
- [ ] Existe un test que verifica que la información oculta sigue oculta (si la feature toca estado de partida).
- [ ] Funciona en un móvil real de 360 px de ancho.
- [ ] Sobrevive a una desconexión de 30 segundos y recuperación.
- [ ] No hay textos de interfaz escritos directamente en los componentes.
- [ ] Las políticas de seguridad a nivel de fila (RLS) están activas en toda tabla nueva.
