import { useCallback, useRef, useState, useEffect } from 'react';

// Create a singleton audio context to satisfy browser policies
let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const playTone = (freq, type, duration, vol = 0.1) => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
};

export function useSound() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pictionary_muted');
    if (stored === 'true') setMuted(true);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      localStorage.setItem('pictionary_muted', String(next));
      if (!next) getAudioContext(); // Wake up context on user interaction
      return next;
    });
  }, []);

  const playPop = useCallback(() => {
    if (muted) return;
    playTone(400, 'sine', 0.1, 0.2);
  }, [muted]);

  const playTada = useCallback(() => {
    if (muted) return;
    // Simple arpeggio
    playTone(440, 'triangle', 0.1, 0.2);
    setTimeout(() => playTone(554, 'triangle', 0.1, 0.2), 100);
    setTimeout(() => playTone(659, 'triangle', 0.3, 0.2), 200);
  }, [muted]);

  const playTick = useCallback(() => {
    if (muted) return;
    playTone(800, 'square', 0.05, 0.05);
  }, [muted]);

  return { muted, toggleMute, playPop, playTada, playTick };
}
