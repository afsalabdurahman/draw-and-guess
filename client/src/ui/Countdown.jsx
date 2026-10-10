import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function Countdown() {
  const endsAt = useGameStore((state) => state.endsAt);
  const timeOffset = useGameStore((state) => state.timeOffset);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now() + timeOffset;
      const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endsAt, timeOffset]);

  if (!endsAt) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/80 backdrop-blur text-white font-mono text-2xl font-bold py-2 px-6 rounded-full shadow border border-slate-700 z-10">
      {timeLeft}s
    </div>
  );
}
