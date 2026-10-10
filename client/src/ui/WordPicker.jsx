import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { socket } from '../socket';

export default function WordPicker() {
  const roomId = useGameStore((state) => state.roomId);
  const wordChoices = useGameStore((state) => state.wordChoices) || [];
  const [timeLeft, setTimeLeft] = useState(15);
  
  useEffect(() => {
    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
            clearInterval(interval);
            return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [wordChoices]);

  const pickWord = (word) => {
    socket.emit('word:pick', { roomId, word });
  };

  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Choose a Word</h2>
        <p className="text-slate-400 mb-8">You have <span className="text-yellow-400 font-bold">{timeLeft}s</span> to pick a word, or one will be chosen for you!</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {wordChoices.map((word, idx) => (
            <button
              key={idx}
              onClick={() => pickWord(word)}
              className="bg-slate-700 hover:bg-blue-600 text-white font-semibold py-4 px-2 rounded-xl text-lg transition-colors capitalize shadow"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
