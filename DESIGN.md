# Referencia de diseño — Quipu

Dirección visual: **vector plano brillante**. Colores saturados, esquinas muy redondeadas, sombras sólidas sin degradado y fondo espacial oscuro. Sustituye por completo a la dirección anterior (piedra tallada andina, crema y grafito).

Lo visual es decorado: no hay mapa de niveles, progresión ni campaña, y no cambia ninguna regla ni ninguna tabla. Las 60 fichas, los 5 colores, la tabla de puntos y `color_index = (número − 1) % 5` siguen como en `specs/001-mvp/spec.md`.

Los tokens viven en `src/styles/tokens.css`. Ningún componente escribe un color a pelo.

---

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--espacio` | `#2A1B47` | Fondo de aplicación |
| `--espacio-claro` | `#3B2A5E` | Paneles y tarjetas |
| `--espacio-borde` | `#563F86` | Bordes de panel |
| `--crema` | `#FDF6E8` | Texto principal, tinta clara |
| `--grafito` | `#2E2440` | Tinta oscura, sombras |
| `--acento` | `#FFC93C` | Amarillo: acción principal, destacados |
| `--lima` | `#A8E05F` | Confirmaciones, tu turno |

### Colores de ficha

| Índice | Color | Cara | Canto (−25 %) | Tinta del número | Símbolo |
|---|---|---|---|---|---|
| 0 | Ámbar | `#F2A93B` | `#B87B22` | `--grafito` | círculo |
| 1 | Lima | `#8FD14F` | `#679B33` | `--grafito` | triángulo |
| 2 | Rosa | `#E8529E` | `#AE3571` | `--crema` | cuadrado |
| 3 | Rojo | `#D94444` | `#9E2C2C` | `--crema` | rombo |
| 4 | Azul | `#3E7BC4` | `#2A5588` | `--crema` | hexágono |

### Contraste medido (WCAG 2.x)

| Par | Ratio | Veredicto |
|---|---|---|
| Número sobre ámbar (`--grafito`) | 7,29 | AA |
| Número sobre lima (`--grafito`) | 7,90 | AA |
| Número sobre rosa (`--crema`) | 3,18 | AA solo para texto grande |
| Número sobre rojo (`--crema`) | 4,02 | AA solo para texto grande |
| Número sobre azul (`--crema`) | 4,04 | AA solo para texto grande |
| `--crema` sobre `--espacio` | 14,5 | AAA |
| `--crema` sobre `--espacio-claro` | 11,6 | AAA |
| `--grafito` sobre `--acento` | 9,5 | AAA |
| `--grafito` sobre `--lima` | 9,4 | AAA |

**Qué significa lo de rosa, rojo y azul.** El número de la ficha es texto grande en negrita (≥ 22 px a partir de una ficha de 44 px), y para texto grande el mínimo AA es 3:1, que cumplen. No llegan a 4,5:1, así que **no usar esa tinta para texto pequeño** sobre esos colores. Si se quiere 4,5:1 hay que oscurecer la cara de rosa, rojo y azul unos puntos; cambiar la tinta no basta (grafito sobre rosa da 4,25).

Las caras de rojo y azul sobre `--espacio` dan 3,6:1, justo por encima del 3:1 que exige WCAG 1.4.11 a los componentes gráficos.

---

## Tipografía

- **Display** (títulos, números de ficha, botones): Bricolage Grotesque, peso 800.
- **Interfaz** (cuerpo, etiquetas): Inter, pesos 400 / 500 / 600.
- **Logotipo**: Chango, convertida a trazados (no se carga como fuente).
- Cifras tabulares en cronómetros, contadores y números de ficha.

---

## La ficha

Se dibuja **siempre en SVG por código** (`components/game/Tile.tsx`). Nunca con imágenes generadas: los números tienen que ser nítidos a 44 px y los modelos de imagen los deforman.

Un cuadrado de esquinas muy redondeadas (radio del 22 % del lado). Lienzo 100 × 108, con tres zonas:

1. **Canto inferior.** Una banda del color oscuro que asoma un 8 % por debajo de la cara. Da el aire de botón físico.
2. **Cara.** El color de la ficha.
3. **Contenido**, de arriba abajo: un símbolo pequeño en la esquina superior izquierda, el número grande y centrado, y una barra horizontal partida en tres segmentos de los que se rellenan tantos como puntos tenga la ficha. Los segmentos vacíos quedan a un 25 % de opacidad.

**Un solo componente, un solo dibujo.** `Tile` escala con `size`. Por debajo de 56 px se oculta el símbolo y quedan número y puntos. Alto = ancho × 1,08. Objetivo táctil mínimo de 44 px.

El símbolo es lo que impide que el color sea el único portador de información (P6). Son figuras sólidas legibles a 16 px: círculo, triángulo, cuadrado, rombo y hexágono.

### Estados

| Estado | Aspecto |
|---|---|
| Pública o resuelta | Cara y canto a color, símbolo y número en la tinta, barra de puntos |
| Sin resolver (las tuyas) | Cara y canto al 40 % de opacidad sobre el fondo oscuro, candado crema en el centro, barra con los tres segmentos solo contorneados. El símbolo se mantiene a todo color para distinguir la ficha |
| Reverso (reserva) | Cara a todo color, sin número, símbolo grande y centrado en la tinta |
| Seleccionada | Aro `--acento` de 3 px separado de la ficha |

El símbolo en las fichas públicas va en la tinta del número (no en el color de la ficha) porque en el color de la cara no se vería.

---

## Botones y paneles

Los botones comparten la anatomía de la ficha: esquinas muy redondeadas, cara y **canto inferior** un 25 % más oscuro (`color-mix`). Al pulsar, la cara baja 2 px y el canto se encoge de 6 a 3 px.

| Variante | Cara | Tinta |
|---|---|---|
| Principal | `--acento` | `--grafito` |
| Confirmar | `--lima` | `--grafito` |
| Neutro | `--espacio-borde` | `--crema` |

`Panel`: tarjeta sobre `--espacio-claro`, borde de 2 px en `--espacio-borde`, radio de 28 px y sombra sólida `0 6px 0 --grafito`. Nada de sombras con desenfoque.

---

## Logotipo

`components/brand/Wordmark.tsx`, con props `size` (ancho en px) y `showTagline`. Rotulación gruesa con extrusión de color en capas y puntos dentro de las letras. Es lenguaje de feria clásico, construido aquí de forma original.

- Tipografía base Chango (SIL OFL), convertida a trazados con `scripts/build_wordmark.py`, que escribe `components/brand/wordmarkData.ts`. No editar ese archivo a mano.
- Cuatro copias del trazado detrás, cada una 3 px más abajo y a la derecha, de la más lejana a la más cercana: azul, rosa, ámbar, lima.
- Capa frontal en `--crema`.
- Una fila de círculos de `--acento` siguiendo el eje de cada letra, con separación uniforme.
- Debajo, opcional, un descriptor en Inter 600, mayúsculas, `letter-spacing: 0.3em`. El texto sale de `messages/*.json` (`app.descriptor`).

---

## Fondos recoloreables

El color vive en la variable `--tinte`, no en la imagen. Los mismos archivos sirven a todas las pantallas: el morado de la partida, el gris de ajustes o cualquier otro son el mismo patrón con otro `--tinte`, y el color se puede animar.

```tsx
<Fondo tinte="var(--espacio)">{children}</Fondo>
<Fondo tinte="#8E8AA3" grano="todo">{children}</Fondo>
<Fondo plano>{children}</Fondo>
```

`Fondo` (`components/layout/Fondo.tsx`) apila, de abajo arriba:

1. **Color** `--tinte`.
2. **Ondas** (`ondas.png`, 1024 px): regiones redondeadas en negro al 20 % de opacidad. Dan las bandas del mismo tono, más oscuras.
3. **Estrellas** (`estrellas.png`, 512 px): estrellas de cuatro puntas redondeadas, puntos y motas, en blanco al 22 %. Sin cruces.
4. **Grano** (`grano.png`, 256 px): ruido gris medio con `mix-blend-mode: overlay` al 45 %.

`grano="fondo"` (por defecto) pone el grano detrás del contenido; `grano="todo"` lo pone también encima de fichas y botones, que es lo que tienen las ilustraciones de referencia; `grano={false}` lo quita.

Estos tres archivos **no se generan con IA**. Los dibuja `scripts/build_patterns.py` con una semilla fija, y por construcción repiten sin costura (las formas se colocan sobre un toro y el ruido es periódico). Para cambiar la densidad, el tamaño de las estrellas o la intensidad del grano se edita el script y se vuelve a ejecutar.

---

## Assets generados con fal.ai

fal.ai genera **solo** decorado: nubes e islas flotantes. Nada de fichas, números, interfaz ni patrones de fondo.

El manifiesto es `assets.manifest.json` y el script `scripts/generate-assets.ts` (`npm run assets`). Es idempotente: salta lo que ya existe salvo con `--force`. Con `--dry` enseña el plan sin gastar nada.

| Asset | Salida | Tamaño | Cómo queda transparente |
|---|---|---|---|
| Nubes ×3 | `public/decor/nube-{1,2,3}.png` | 512 | Blanco sobre negro → alfa |
| Islas flotantes ×3 | `public/decor/isla-{1,2,3}.png` | 768 | `fal-ai/bria/background/remove` |

Recraft v3 no admite fondo transparente ni prompt negativo. El script lo resuelve pidiendo blanco sobre negro y convirtiendo la luminosidad en alfa, y añadiendo el negativo al prompt como «Avoid: …».

**Granulado.** Todo lo generado recibe al final un ruido fino por píxel (`grano.intensidad` en el manifiesto, 14 por defecto) que solo toca los píxeles opacos. Es el mismo aire de película de las ilustraciones de referencia. En las formas casi blancas, como las nubes, solo puede oscurecer, así que quedan motas sutiles.

---

## Reglas de interfaz

- El color nunca es el único portador de información. Toda ficha lleva símbolo o número además del color.
- Objetivo táctil mínimo de 44 px.
- Contraste AA en texto e iconos (ver la tabla de arriba para las tintas de rosa, rojo y azul).
- Todo texto de interfaz sale de `messages/es.json`. Nada escrito directamente en los componentes.
- Diseñado para 390 px de ancho en vertical. El escritorio es la misma pantalla centrada.

---

## Estado de la migración

Hecho: tokens, `Tile`, `Wordmark`, `Fondo` (con ondas, estrellas y grano), `Boton`, `Panel` y la página de muestra `/estilo` (solo en desarrollo).

Pendiente: las pantallas existentes (`app/`, `components/game`, `components/ui/Button.tsx`, `Sheet`, etc.) siguen con los tokens y clases antiguos (`crema`, `grafito`, `lila`, `blanco`) de `app/globals.css`, y sobre su fondo claro la ficha nueva ya aparece con el estilo nuevo. Hay que migrarlas pantalla a pantalla. `Support`, `Pool` y `DeductionBoard` solo cambian de colores; su lógica no se toca.

## Sobre el nombre

Un quipu es el sistema andino de cuerdas anudadas que registraba cifras. Con el estilo nuevo la referencia andina desaparece del diseño; el nombre «Quipu» sigue siendo provisional y puede cambiar. Falta comprobar dominio, marca y tiendas.
