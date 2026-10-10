import { useGameStore } from '../store/useGameStore';
import { socket } from '../socket';

export default function Scoreboard() {
  const phase = useGameStore((state) => state.phase);
  const secretWord = useGameStore((state) => state.secretWord);
  const roomId = useGameStore((state) => state.roomId);
  const hostId = useGameStore((state) => state.hostId);
  const playerId = useGameStore((state) => state.playerId);
  
  // We need to listen to turnScores or finalScores from the store, but wait,
  // we didn't add turnScores/finalScores to useGameStore!
  // I need to add them to useGameStore.
  const turnScores = useGameStore((state) => state.turnScores) || {};
  const finalScores = useGameStore((state) => state.finalScores) || [];
  const players = useGameStore((state) => state.players);

  if (phase !== 'TURN_END' && phase !== 'GAME_END') return null;

  const isHost = playerId === hostId;

  return (
    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl p-8 max-w-2xl w-full shadow-2xl flex flex-col items-center">
        
        {phase === 'TURN_END' ? (
          <>
            <h2 className="text-4xl font-black text-white mb-2">Turn Over!</h2>
            <p className="text-xl text-slate-300 mb-8">
              The word was <span className="text-green-400 font-bold uppercase">{secretWord}</span>
            </p>

            <div className="w-full space-y-2 mb-8">
              {players.map(p => {
                const gained = turnScores[p.id] || 0;
                return (
                  <div key={p.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg">
                    <span className="font-bold text-lg text-slate-200">{p.name}</span>
                    <div className="flex items-center gap-4">
                      {gained > 0 && <span className="text-green-400 font-bold">+{gained}</span>}
                      <span className="text-xl font-black text-white">{p.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-slate-400 animate-pulse">Next turn starting soon...</p>
          </>
        ) : (
          <>
            <h2 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 mb-8">Game Over!</h2>
            
            <div className="w-full space-y-3 mb-10">
              {finalScores.map((p, i) => (
                <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-slate-700/50'}`}>
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                      #{i + 1}
                    </span>
                    <span className="font-bold text-xl text-white">{p.name}</span>
                  </div>
                  <span className="text-2xl font-black text-white">{p.score} pts</span>
                </div>
              ))}
            </div>

            {isHost ? (
              <button
                onClick={() => socket.emit('game:reset', { roomId })}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-12 rounded-full shadow-lg text-xl transition-transform hover:scale-105"
              >
                Play Again
              </button>
            ) : (
              <p className="text-slate-400">Waiting for host to play again...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
