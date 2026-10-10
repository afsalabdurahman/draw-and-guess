import { useCanvasStore } from '../store/useCanvasStore';
import { useGameStore } from '../store/useGameStore';
import { socket } from '../socket';
import { Pen, Eraser, PaintBucket, Undo, Trash2 } from 'lucide-react';

const COLORS = [
  '#000000', '#4b5563', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#a855f7',
  '#ec4899', '#f43f5e', '#84cc16', '#06b6d4'
];

export default function Toolbox() {
  const { tool, color, size, setTool, setColor, setSize } = useCanvasStore();
  const roomId = useGameStore((state) => state.roomId);
  const playerId = useGameStore((state) => state.playerId);
  const drawerId = useGameStore((state) => state.drawerId);
  
  const isDrawer = playerId && drawerId === playerId;
  
  if (!isDrawer) {
    return null;
  }
  const undo = () => {
    useCanvasStore.getState().undo();
    socket.emit('undo', { roomId, id: crypto.randomUUID() });
  };
  
  const clear = () => {
    useCanvasStore.getState().clear();
    socket.emit('clear', { roomId, id: crypto.randomUUID() });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-6">
      
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase">Tools</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setTool('pen')}
            className={`p-3 rounded-lg flex items-center justify-center transition-colors ${tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="Pen"
          >
            <Pen size={20} />
          </button>
          <button 
            onClick={() => setTool('fill')}
            className={`p-3 rounded-lg flex items-center justify-center transition-colors ${tool === 'fill' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="Fill Bucket"
          >
            <PaintBucket size={20} />
          </button>
          <button 
            onClick={() => setTool('eraser')}
            className={`p-3 rounded-lg flex items-center justify-center transition-colors ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="Eraser"
          >
            <Eraser size={20} />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase">Color</h3>
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase">Size: {size}px</h3>
        <input 
          type="range" 
          min="2" max="40" 
          value={size}
          onChange={(e) => setSize(parseInt(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="mt-auto">
        <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase">Actions</h3>
        <div className="flex gap-2">
          <button 
            onClick={undo}
            className="flex-1 p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center gap-2 transition-colors"
          >
            <Undo size={18} /> Undo
          </button>
          <button 
            onClick={clear}
            className="flex-1 p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={18} /> Clear
          </button>
        </div>
      </div>
      
    </div>
  );
}
