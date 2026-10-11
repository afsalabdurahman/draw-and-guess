import { useState, useEffect, useRef } from 'react';
import { renderOps } from '../canvas/renderer';
const apiUrl = import.meta.env.VITE_API_URL;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function Replay({ roomId, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [turnIndex, setTurnIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef(null);
  const requestRef = useRef();
  const lastTimeRef = useRef();

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${apiUrl}/rooms/${roomId}/replay`);
        if (!res.ok) throw new Error('Failed to fetch replay data');
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [roomId]);

  // Handle Turn Change
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(true);
  }, [turnIndex]);

  // Animation Loop
  const animate = (time) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    if (isPlaying && history.length > 0) {
      const currentTurn = history[turnIndex];
      setCurrentTime(prevTime => {
        let newTime = prevTime + deltaTime * speed;
        if (newTime >= currentTurn.durationMs) {
          setIsPlaying(false);
          return currentTurn.durationMs;
        }
        return newTime;
      });
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, history, turnIndex, speed]);

  // Render Loop
  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    
    const currentTurn = history[turnIndex];
    const visibleOps = [];

    for (const op of currentTurn.ops) {
      if (op.t > currentTime) break; // Ops are ordered by time

      if (op.type === 'stroke') {
        // Interpolate points based on time elapsed since stroke started
        // Assume 20ms per point
        const elapsedSinceStart = currentTime - op.t;
        const visiblePointCount = Math.floor(elapsedSinceStart / 20);
        
        if (visiblePointCount > 0) {
          visibleOps.push({
            ...op,
            points: op.points.slice(0, visiblePointCount)
          });
        }
      } else {
        // clear, fill, undo apply instantly when their t is reached
        visibleOps.push(op);
      }
    }

    renderOps(ctx, visibleOps, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [currentTime, history, turnIndex]);

  const handleScrubberChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setCurrentTime(val);
  };

  if (loading) {
    return <div className="absolute inset-0 bg-slate-900/95 z-[60] flex justify-center items-center text-white text-2xl">Loading Replay...</div>;
  }

  if (error || history.length === 0) {
    return (
      <div className="absolute inset-0 bg-slate-900/95 z-[60] flex flex-col justify-center items-center text-white p-8">
        <h2 className="text-3xl text-red-400 mb-4">Error loading replay</h2>
        <p className="text-slate-400 mb-8">{error || 'No history available'}</p>
        <button onClick={onClose} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Close Replay</button>
      </div>
    );
  }

  const currentTurn = history[turnIndex];

  return (
    <div className="absolute inset-0 bg-slate-900/95 z-[60] flex p-4 gap-4 overflow-hidden">
      
      {/* Sidebar: Turn List */}
      <div className="w-64 bg-slate-800 rounded-xl p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
        <h2 className="text-xl font-bold text-white mb-4">Replays</h2>
        {history.map((turn, i) => (
          <button 
            key={i}
            onClick={() => setTurnIndex(i)}
            className={`p-3 rounded-lg text-left transition-colors ${i === turnIndex ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            <div className="text-xs uppercase text-slate-400 font-bold mb-1">Round {turn.round}</div>
            <div className="font-bold">{turn.drawerName}</div>
            <div className="text-sm">Drew: <span className="text-green-400">{turn.word}</span></div>
          </button>
        ))}
      </div>

      {/* Main Content: Canvas & Controls */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl">
          <div className="text-xl font-bold text-white">
             {currentTurn.drawerName}'s Drawing of <span className="text-green-400 uppercase">{currentTurn.word}</span>
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg">
            Exit Replay
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-white rounded-xl shadow-2xl overflow-hidden flex items-center justify-center">
            <div className="relative w-full aspect-[4/3] max-h-full">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <input 
            type="range" 
            min="0" 
            max={currentTurn.durationMs} 
            value={currentTime} 
            onChange={handleScrubberChange}
            className="w-full accent-blue-500"
          />
          
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg w-32"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <div className="flex gap-2 bg-slate-700 p-1 rounded-lg">
              {[1, 2, 4].map(s => (
                <button 
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-4 py-2 rounded-md font-bold transition-colors ${speed === s ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button 
              onClick={() => { setCurrentTime(0); setIsPlaying(true); }}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg"
            >
              Restart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
