# Arranque en Claude Code

## Antes de empezar

1. Crea un repositorio vacío y entra en él.
2. Descomprime este paquete en la raíz.
3. Instala SpecKit si no lo tienes: `uvx --from git+https://github.com/github/spec-kit.git specify init --here`
   (si ya hay un `.specify/`, deja el que viene en el paquete: contiene la constitución).
4. Abre Claude Code en esa carpeta.

## Qué trae el paquete

```
.specify/memory/constitution.md      principios, stack y convenciones
specs/001-mvp/spec.md                qué se construye y por qué
specs/001-mvp/plan.md                cómo se construye
DESIGN.md                            paleta, tipografía, anatomía de la ficha
scripts/generate_points_table.py     genera y verifica la tabla de puntos
supabase/seed/points_table.sql       datos semilla de las 60 fichas
src/game/pointsTable.ts              la misma tabla para el cliente
```

## Prompt de arranque

Pega esto en Claude Code:

---

Este repositorio sigue Spec-Driven Development con SpecKit. Ya existen la constitución, la spec y el plan del primer hito.

Lee, en este orden y antes de escribir nada:

1. `.specify/memory/constitution.md`
2. `specs/001-mvp/spec.md`
3. `specs/001-mvp/plan.md`
4. `DESIGN.md`

Luego genera `specs/001-mvp/tasks.md` con las tareas de implementación, ordenadas y agrupadas por los ocho hitos de la sección 9 del plan. Cada tarea debe decir qué ficheros toca y cómo se comprueba que está hecha. No empieces a implementar todavía: enséñame las tareas primero.

Tres restricciones que no son negociables y que debes comprobar en cada tarea que las toque:

- `game_tiles` lleva RLS activada y ninguna política de lectura. El único acceso es desde funciones `SECURITY DEFINER`.
- Ninguna función devuelve al jugador los números de sus propias fichas mientras la partida esté activa **y él siga activo**. Un jugador eliminado o que ha abandonado, o cualquiera al terminar la partida, sí los recibe.
- Toda función que muta una partida la bloquea primero con `select ... from games where id = ... for update`.

La tabla de puntos de `supabase/seed/points_table.sql` y `src/game/pointsTable.ts` es la del tablero físico (puntos 1, 2, 3 de cinco en cinco) y la genera `scripts/generate_points_table.py`. No la edites a mano: si hay que cambiarla, se cambia el script y se vuelve a ejecutar, y se añade una migración que actualice `tile_definitions`.

---

## Después de las tareas

Cuando apruebes `tasks.md`, el ciclo normal es implementar hito a hito. El plan recomienda llegar pronto al hito 4 (partida jugable contra un bot) y jugarlo mucho antes de construir salas, cola o ELO: es el que responde si el juego engancha.

## Lo que queda abierto

- Nombre definitivo y dominio. "Quipu" es provisional.
- Catálogo de avatares.
- Las fichas del mazo están a 52 px con poco aire entre ellas; probablemente haya que pasar a dos filas de tres.
