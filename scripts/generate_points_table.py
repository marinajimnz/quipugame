"""
Genera y verifica la tabla de puntos de las 60 fichas de Quinteto.

Restricciones duras:
  - 60 fichas, numeradas 1..60
  - color(n) = (n - 1) % 5
  - dentro de cada color (12 fichas): exactamente 4 fichas de 1, 4 de 2 y 4 de 3 puntos
  - en total: 20 fichas de cada valor

Criterios de calidad (una tabla candidata debe pasarlos todos):
  C1  Sin formula aritmetica trivial: ningun (n % k) ni ((n-1)//k) predice los puntos
  C2  Sin rachas largas: como mucho 3 numeros consecutivos con el mismo valor
  C3  Reparto parejo por bloques de 10: cada bloque tiene entre 2 y 5 fichas de cada valor
  C4  Correlacion casi nula entre numero y puntos
  C5  Dentro de cada color, la secuencia de 12 valores no es periodica
  C6  Sin simetria especular (puntos(n) != puntos(61-n) para una mayoria clara)
"""

import random
from itertools import groupby

SEED = 20261023
VALUES = (1, 2, 3)


def color_of(n):
    return (n - 1) % 5


def generate(rng):
    """Construye una tabla respetando el equilibrio 4/4/4 por color."""
    points = {}
    for c in range(5):
        numbers = [n for n in range(1, 61) if color_of(n) == c]
        pool = [v for v in VALUES for _ in range(4)]
        rng.shuffle(pool)
        for n, v in zip(numbers, pool):
            points[n] = v
    return points


# --- Verificaciones -------------------------------------------------------

def check_balance(points):
    total = {v: sum(1 for p in points.values() if p == v) for v in VALUES}
    if any(total[v] != 20 for v in VALUES):
        return False, f"reparto global incorrecto: {total}"
    for c in range(5):
        per = {v: sum(1 for n, p in points.items() if color_of(n) == c and p == v) for v in VALUES}
        if any(per[v] != 4 for v in VALUES):
            return False, f"color {c} desequilibrado: {per}"
    return True, "reparto 4/4/4 por color correcto"


def check_no_formula(points):
    """C1: ninguna formula sencilla debe reproducir la tabla ni acercarse."""
    worst = 0.0
    for k in range(2, 16):
        for name, f in (("n % k", lambda n: n % k), ("(n-1)//k", lambda n: (n - 1) // k)):
            buckets = {}
            for n, p in points.items():
                buckets.setdefault(f(n), []).append(p)
            # precision de la mejor regla "si bucket == x entonces puntos = y"
            hits = sum(max(b.count(v) for v in VALUES) for b in buckets.values())
            acc = hits / 60
            worst = max(worst, acc)
            if acc > 0.60:
                return False, f"formula {name} con k={k} predice el {acc:.0%}"
    return True, f"ninguna formula supera el {worst:.0%} de acierto (azar ~39%)"


def check_runs(points):
    seq = [points[n] for n in range(1, 61)]
    longest = max(len(list(g)) for _, g in groupby(seq))
    if longest > 3:
        return False, f"racha de {longest} consecutivos"
    return True, f"racha maxima de {longest} consecutivos"


def check_blocks(points):
    for start in range(1, 61, 10):
        block = [points[n] for n in range(start, start + 10)]
        for v in VALUES:
            c = block.count(v)
            if not 2 <= c <= 5:
                return False, f"bloque {start}-{start+9}: {c} fichas de valor {v}"
    return True, "todos los bloques de 10 entre 2 y 5 fichas por valor"


def check_correlation(points):
    ns = list(range(1, 61))
    ps = [points[n] for n in ns]
    mn, mp = sum(ns) / 60, sum(ps) / 60
    num = sum((n - mn) * (p - mp) for n, p in zip(ns, ps))
    den = (sum((n - mn) ** 2 for n in ns) * sum((p - mp) ** 2 for p in ps)) ** 0.5
    r = num / den
    if abs(r) > 0.15:
        return False, f"correlacion numero/puntos r={r:+.3f}"
    return True, f"correlacion numero/puntos r={r:+.3f}"


def check_periodicity(points):
    for c in range(5):
        seq = [points[n] for n in range(1, 61) if color_of(n) == c]
        for period in (2, 3, 4, 6):
            if all(seq[i] == seq[i % period] for i in range(len(seq))):
                return False, f"color {c} es periodico con periodo {period}"
    return True, "ninguna secuencia de color es periodica"


def check_mirror(points):
    same = sum(1 for n in range(1, 61) if points[n] == points[61 - n])
    if same > 30:
        return False, f"simetria especular en {same}/60 fichas"
    return True, f"simetria especular solo en {same}/60 fichas"


CHECKS = [
    ("equilibrio", check_balance),
    ("C1 sin formula", check_no_formula),
    ("C2 rachas", check_runs),
    ("C3 bloques", check_blocks),
    ("C4 correlacion", check_correlation),
    ("C5 periodicidad", check_periodicity),
    ("C6 simetria", check_mirror),
]


def main():
    rng = random.Random(SEED)
    for attempt in range(1, 10001):
        points = generate(rng)
        results = [(name, *fn(points)) for name, fn in CHECKS]
        if all(ok for _, ok, _ in results):
            print(f"Tabla valida encontrada en el intento {attempt} (semilla {SEED})\n")
            for name, _, msg in results:
                print(f"  OK  {name:18s} {msg}")
            print()
            print_table(points)
            write_outputs(points)
            return
    raise SystemExit("no se encontro tabla valida")


def print_table(points):
    nombres = ["Color 0", "Color 1", "Color 2", "Color 3", "Color 4"]
    print("Tabla por color (numero:puntos)\n")
    for c in range(5):
        fichas = [f"{n:2d}:{points[n]}" for n in range(1, 61) if color_of(n) == c]
        print(f"  {nombres[c]}  " + "  ".join(fichas))
    print("\nTabla por numero\n")
    for start in range(1, 61, 10):
        fila = "  ".join(f"{n:2d}:{points[n]}" for n in range(start, start + 10))
        print(f"  {fila}")


def write_outputs(points):
    with open("points_table.sql", "w") as f:
        f.write("-- Tabla de puntos de Quinteto. Generada por generate_points_table.py\n")
        f.write(f"-- Semilla {SEED}. No modificar a mano: regenerar y volver a verificar.\n\n")
        f.write("insert into tile_definitions (number, color_index, points) values\n")
        filas = [f"  ({n}, {color_of(n)}, {points[n]})" for n in range(1, 61)]
        f.write(",\n".join(filas) + ";\n")

    with open("pointsTable.ts", "w") as f:
        f.write("// Tabla de puntos de Quinteto. Generada por generate_points_table.py\n")
        f.write(f"// Semilla {SEED}. No modificar a mano: regenerar y volver a verificar.\n\n")
        f.write("export const TILE_POINTS: Readonly<Record<number, 1 | 2 | 3>> = {\n")
        for start in range(1, 61, 10):
            fila = ", ".join(f"{n}: {points[n]}" for n in range(start, start + 10))
            f.write(f"  {fila},\n")
        f.write("} as const;\n\n")
        f.write("export const colorOfTile = (n: number): 0 | 1 | 2 | 3 | 4 =>\n")
        f.write("  ((n - 1) % 5) as 0 | 1 | 2 | 3 | 4;\n")

    print("\nEscritos points_table.sql y pointsTable.ts")


if __name__ == "__main__":
    main()
