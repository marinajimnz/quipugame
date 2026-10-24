# Referencia de diseño — Quipu

Resumen de las decisiones visuales ya cerradas. Las pantallas completas están en el lienzo de diseño, enlazado al final.

---

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--crema` | `#FFF2E9` | Fondo de aplicación |
| `--blanco` | `#FFFFFF` | Tarjetas y paneles |
| `--grafito` | `#4C4C4C` | Texto, piedra de las fichas, botón primario |
| `--piedra-hueco` | `#2E2E2E` | Sombra del hueco tallado |
| `--lila` | `#BAA9D2` | Acento de interfaz: lo que es tuyo (tu turno, tu soporte, selección) |

Colores de ficha. El índice se deriva del número: `color_index = (número − 1) % 5`.

| Índice | Nombre | Hex | Tinta del número |
|---|---|---|---|
| 0 | Amarillo | `#FFCB30` | `--grafito` |
| 1 | Rosa | `#F49BB4` | `--grafito` |
| 2 | Rojo | `#EF514E` | `--crema` |
| 3 | Azul | `#2D6AB3` | `--crema` |
| 4 | Verde | `#006E58` | `--crema` |

La tinta no es decorativa: es la única combinación que mantiene contraste suficiente en los cinco colores. No cambiarla sin volver a medir.

Fichas sin resolver y reversos: el color va sobre grafito y, como elemento gráfico, necesita 3:1
(WCAG 1.4.11). Amarillo (5,66:1) y rosa (4,17:1) ya cumplen; rojo, azul y verde usan una variante
más clara. Medido el 2026-10-24:

| Índice | Color | Sin resolver | Contraste sobre grafito |
|---|---|---|---|
| 2 | Rojo `#EF514E` (2,44:1) | `#F58A87` | 3,63:1 |
| 3 | Azul `#2D6AB3` (1,56:1) | `#9BBBE6` | 4,35:1 |
| 4 | Verde `#006E58` | `#80C0AC` (antes `#5FA38F`, 2,91:1) | 4,11:1 |

Las tintas de número cumplen como **texto grande** (≥ 18,66 px en negrita): crema sobre rojo da
3,21:1 y grafito sobre rosa 4,17:1, que no llegarían a 4,5:1 en texto pequeño. Por eso las fichas
con número no se dibujan por debajo de 48 px de ancho y el tablero de deducción usa 20 px.

Texto de interfaz (AA, 4,5:1 sobre crema y blanco): `--grafito-suave #666666` para texto
secundario (5,23:1) en lugar de bajar la opacidad, y `--error #B83A36` para errores (5,17:1; el rojo
de ficha da 3,21:1). Sobre lila, el texto pequeño va en `--piedra-hueco` (6,27:1; grafito da 3,96:1).

---

## Tipografía

- **Display** (títulos, números de ficha, marca): Bricolage Grotesque, peso 800.
- **Interfaz** (cuerpo, etiquetas): Inter, pesos 400 / 500 / 600.
- Cifras tabulares en cronómetros y contadores.

---

## La ficha

Placa de piedra granulada con el pigmento incrustado en el hueco tallado. Técnica: cada forma de color lleva detrás la misma forma ligeramente mayor en `--piedra-hueco`, que simula el corte.

**Dos variantes, no una escalada.** El SVG ornamentado no sobrevive por debajo de unos 100 px.

| Variante | Tamaño | Qué lleva |
|---|---|---|
| `TileDetailed` | ≥ 100 px | Esquinas, barras paralelas en los cuatro márgenes, marco, panel central, número, puntos |
| `TileCompact` | 44–99 px | Cuatro esquinas, panel central, número, puntos |

**Estados.**

- *Resuelta o pública*: panel relleno del color, número grabado en la tinta correspondiente, puntos marcados.
- *Sin resolver*: panel vacío con contorno punteado en el color e interrogación. Se lee como piedra todavía por labrar. Sin puntos, porque tampoco los conoces.
- *Reverso*: cuadros concéntricos en el color de la ficha, sin número.

**Un glifo por color, en todos los estados.** Sin resolver y reverso se distinguían solo por el color, lo que incumple P6. Cada color lleva además un glifo propio, geométrico y andino (escalonado, concéntrico u ortogonal), visible también en las fichas sin resolver y en el reverso. Los cinco glifos están por diseñar.

**Los puntos van siempre visibles en la ficha.** Es el dato que necesita la pista de comparar, y tenerlo ahí ahorra consultar el tablero.

---

## Reglas de interfaz

- El color nunca es el único portador de información. Toda ficha lleva número o forma además del color.
- Objetivo táctil mínimo de 44 px. Las fichas del mazo están justo en el límite con poco aire entre ellas; es un punto pendiente de resolver, probablemente pasando a dos filas de tres.
- Contraste AA en texto e iconos.
- Todo texto de interfaz sale de `messages/es.json`. Nada escrito directamente en los componentes.
- Diseñado para 390 px de ancho en vertical. El escritorio es la misma pantalla centrada.

---

## Sobre el nombre

Un quipu es el sistema andino de cuerdas anudadas que registraba cifras por posición. Se usaba desde mucho antes del Tahuantinsuyo —hay cuerdas anudadas en Caral de hace unos 5.000 años— y el Estado inca fue quien lo llevó a su máxima escala.

Dos consecuencias para el diseño:

1. La referencia es **andina**, no mesoamericana. Nada de calendarios aztecas, glifos mayas, cabezas de perfil ni volutas. La geometría es escalonada, concéntrica y ortogonal.
2. La aplicación debe explicar en algún sitio de dónde viene el nombre.

El nombre es provisional: falta comprobar dominio, marca y tiendas.

---

## Lienzo de diseño

Las pantallas completas, la hoja de fichas, la paleta aplicada y tres direcciones visuales alternativas:

https://claude.ai/artifact/DynbetwXe2Hno39eP8MbVm
