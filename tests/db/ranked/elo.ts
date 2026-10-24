// Fórmula de ELO de la spec §10, con el mismo redondeo que Postgres (round: mitades lejos de cero).
const roundHalfAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

export function kFactor(elo: number, rankedGames: number): number {
  return rankedGames < 20 ? 32 : elo < 2000 ? 24 : 16;
}

export function expectedElo(elo: number, rival: number, score: 0 | 0.5 | 1, rankedGames: number): number {
  const e = 1 / (1 + 10 ** ((rival - elo) / 400));
  return Math.max(100, elo + roundHalfAway(kFactor(elo, rankedGames) * (score - e)));
}
