# Mediciones 001-mvp

## Latencia de acción y propagación (T056)

Script: `node scripts/measure-latency.mjs [turnos]`. Dos clientes autenticados juegan una partida
real (sala → `start_game` → turnos) contra el proyecto Supabase de producción (`eu-central-1`) y
uno de ellos escucha los eventos del otro por Realtime.

**Medido desde un portátil en España, no desde dos móviles.** La red de un móvil suma su propia
latencia, así que estas cifras son un mejor caso, no la medición pendiente con dos móviles reales.

Objetivos (spec §12, percentil 95): acción < 300 ms · propagación a los rivales < 500 ms.

| Medida | Ejecución 1 (n=12) | Ejecución 2 (n=44) |
|---|---|---|
| Acción: ida y vuelta de la RPC (p50 / p95 / máx.) | 86 / 100 / 100 ms | 67 / 304 / 404 ms |
| Propagación desde que la RPC responde (p50 / p95 / máx.) | 263 / 535 / 535 ms | 305 / 398 / 543 ms |
| Propagación desde que se envía la RPC (p50 / p95 / máx.) | 353 / 615 / 615 ms | 385 / 746 / 846 ms |
| Eventos que no llegaron | 0 | 0 |

Lectura:

- **Acción:** la mediana (67–86 ms) está muy por debajo del objetivo. El p95 oscila entre 100 y
  304 ms según la ejecución: está en el límite, y con una muestra pequeña no se puede afirmar más.
- **Propagación:** contada desde que el servidor confirma, el p95 de la segunda ejecución (398 ms)
  cumple el objetivo; en la primera, con 12 muestras, se quedó en 535 ms. Contada desde el envío
  incluye la propia acción y supera 500 ms en ambas.
- **Pendiente:** repetir con dos móviles reales (T056) y más muestras. Si no se llega, el plan §10
  dice subir de plan de Supabase antes que cambiar de arquitectura.

Además, ningún evento se perdió en 56 jugadas, y la sala mostró al segundo jugador en menos de 3 s
con el sondeo de seguridad a 10 s (es decir, por Realtime).
