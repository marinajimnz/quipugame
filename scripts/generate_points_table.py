"""
Escribe la tabla de puntos de las 60 fichas de Quinteto, copiada del tablero físico.

En el tablero, los puntos de cada número se repiten 1, 2, 3, 1, 2, 3… de cinco en cinco:
  1-5 → 1, 6-10 → 2, 11-15 → 3, 16-20 → 1, 21-25 → 2, 26-30 → 3, 31-35 → 1, …, 56-60 → 3

Restricciones (se comprueban al generar):
  - 60 fichas, numeradas 1..60
  - color(n) = (n - 1) % 5
  - dentro de cada color (12 fichas): exactamente 4 fichas de 1, 4 de 2 y 4 de 3 puntos
  - en total: 20 fichas de cada valor
"""

from pathlib import Path

VALUES = (1, 2, 3)


def color_of(n):
    return (n - 1) % 5


def points_of(n):
    return ((n - 1) // 5) % 3 + 1


def generate():
    return {n: points_of(n) for n in range(1, 61)}


def check_balance(points):
    total = {v: sum(1 for p in points.values() if p == v) for v in VALUES}
    assert all(total[v] == 20 for v in VALUES), f"reparto global incorrecto: {total}"
    for c in range(5):
        per = {v: sum(1 for n, p in points.items() if color_of(n) == c and p == v) for v in VALUES}
        assert all(per[v] == 4 for v in VALUES), f"color {c} desequilibrado: {per}"


def main():
    points = generate()
    check_balance(points)
    print_table(points)
    write_outputs(points)


def print_table(points):
    print("Tabla por numero (numero:puntos)\n")
    for start in range(1, 61, 10):
        print("  " + "  ".join(f"{n:2d}:{points[n]}" for n in range(start, start + 10)))


def write_outputs(points):
    root = Path(__file__).resolve().parent.parent
    sql_path = root / "supabase" / "seed" / "points_table.sql"
    ts_path = root / "src" / "game" / "pointsTable.ts"
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    ts_path.parent.mkdir(parents=True, exist_ok=True)

    with open(sql_path, "w") as f:
        f.write("-- Tabla de puntos de Quinteto, copiada del tablero fisico (generate_points_table.py).\n")
        f.write("-- No modificar a mano: regenerar con el script.\n\n")
        f.write("insert into tile_definitions (number, color_index, points) values\n")
        filas = [f"  ({n}, {color_of(n)}, {points[n]})" for n in range(1, 61)]
        f.write(",\n".join(filas) + ";\n")

    with open(ts_path, "w") as f:
        f.write("// Tabla de puntos de Quinteto, copiada del tablero fisico (generate_points_table.py).\n")
        f.write("// No modificar a mano: regenerar con el script.\n\n")
        f.write("export const TILE_POINTS: Readonly<Record<number, 1 | 2 | 3>> = {\n")
        for start in range(1, 61, 10):
            fila = ", ".join(f"{n}: {points[n]}" for n in range(start, start + 10))
            f.write(f"  {fila},\n")
        f.write("} as const;\n\n")
        f.write("export const colorOfTile = (n: number): 0 | 1 | 2 | 3 | 4 =>\n")
        f.write("  ((n - 1) % 5) as 0 | 1 | 2 | 3 | 4;\n")

    print(f"\nEscritos {sql_path.relative_to(root)} y {ts_path.relative_to(root)}")
    print("La migracion que actualiza la base de datos se escribe a mano: supabase/migrations/20261026130000_points_from_board.sql")


if __name__ == "__main__":
    main()
