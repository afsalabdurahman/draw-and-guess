const ORDER_BONUS = [50, 30, 20, 10]; // 1st, 2nd, 3rd, 4th... everyone else gets 0 bonus

export const calculateGuesserScore = (timeLeft, drawTime, orderIndex) => {
  const timeFactor = Math.max(0, Math.min(1, timeLeft / drawTime));
  const baseScore = 100 + Math.round(400 * timeFactor);
  const bonus = ORDER_BONUS[orderIndex] || 0;
  return baseScore + bonus;
};

export const calculateDrawerScore = (guesserScores) => {
  if (!guesserScores || guesserScores.length === 0) {
    return 0;
  }
  const sum = guesserScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / guesserScores.length);
};
