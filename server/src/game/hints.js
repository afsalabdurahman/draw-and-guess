export const generateInitialMask = (word) => {
  return word.split('').map(c => (c === ' ' || c === '-') ? c : '_').join(' ');
};

export const revealHint = (currentMask, secretWord) => {
  const maskChars = currentMask.split(' ');
  const secretChars = secretWord.split('');

  // Find all indices that are still hidden
  const hiddenIndices = [];
  for (let i = 0; i < maskChars.length; i++) {
    if (maskChars[i] === '_') {
      hiddenIndices.push(i);
    }
  }

  // Never reveal the very last character
  if (hiddenIndices.length <= 1) {
    return currentMask;
  }

  // Pick a random hidden index to reveal
  const revealIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  maskChars[revealIdx] = secretChars[revealIdx];

  return maskChars.join(' ');
};
