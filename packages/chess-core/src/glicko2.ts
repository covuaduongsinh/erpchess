/**
 * Rating Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2013) cho rating nội bộ của
 * học viện. Một lần gọi = một "kỳ xếp hạng": mọi ván của người chơi trong kỳ được tính cùng lúc.
 */

export type Rating = { rating: number; rd: number; vol: number };
/** Kết quả một ván: rating/RD của đối thủ và điểm (1 thắng, 0.5 hoà, 0 thua). */
export type GameResult = { rating: number; rd: number; score: 0 | 0.5 | 1 };

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;
const MAX_RD = 350;

export function newRating(): Rating {
  return { rating: 1500, rd: MAX_RD, vol: 0.06 };
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

export function glicko2Update(player: Rating, games: readonly GameResult[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  if (games.length === 0) {
    const rd = Math.min(MAX_RD, Math.sqrt(phi * phi + sigma * sigma) * SCALE);
    return { rating: player.rating, rd, vol: sigma };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const game of games) {
    const muJ = (game.rating - 1500) / SCALE;
    const phiJ = game.rd / SCALE;
    const e = expected(mu, muJ, phiJ);
    vInv += g(phiJ) ** 2 * e * (1 - e);
    deltaSum += g(phiJ) * (game.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Bước 5: tìm độ biến động mới bằng phương pháp Illinois
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - d)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * SCALE + 1500,
    rd: Math.min(MAX_RD, newPhi * SCALE),
    vol: newSigma,
  };
}
