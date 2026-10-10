export const normalize = (s) => {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
};

// Standard Levenshtein distance
export const levenshtein = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

export const checkGuess = (rawGuess, rawSecret) => {
  const guess = normalize(rawGuess);
  const secret = normalize(rawSecret);

  if (guess === secret) {
    return 'MATCH';
  }

  const distance = levenshtein(guess, secret);
  if (distance === 1 && secret.length >= 4) {
    return 'CLOSE';
  }

  return 'MISS';
};
