import { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useGameStore } from '../store/useGameStore';
import { socket } from '../socket';
import { renderOps } from '../canvas/renderer';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function Canvas({ disabled = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const ops = useCanvasStore((state) => state.ops);
  const tool = useCanvasStore((state) => state.tool);
  const color = useCanvasStore((state) => state.color);
  const size = useCanvasStore((state) => state.size);
  const addOp = useCanvasStore((state) => state.addOp);
  
  const roomId = useGameStore((state) => state.roomId);
  const drawerId = useGameStore((state) => state.drawerId);
  const playerId = useGameStore((state) => state.playerId);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentOp, setCurrentOp] = useState(null);
  
  const pointsBuffer = useRef([]);
  const flushInterval = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    renderOps(ctx, ops, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (currentOp) {
      renderOps(ctx, [...ops, currentOp], CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [ops, currentOp]);

  const getNormalizedPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x, y };
  };

  const handlePointerDown = (e) => {
    if (disabled || playerId !== drawerId) return;
    e.preventDefault(); 
    
    const point = getNormalizedPoint(e);
    
    if (tool === 'fill') {
      const op = { type: 'fill', id: crypto.randomUUID(), color, x: point.x, y: point.y };
      addOp(op);
      socket.emit('fill', { roomId, ...op });
    } else {
      setIsDrawing(true);
      const op = { type: 'stroke', id: crypto.randomUUID(), tool, color, size, points: [point] };
      setCurrentOp(op);
      
      socket.emit('stroke:start', { 
          roomId, id: op.id, tool, color, size, point 
      });
      
      pointsBuffer.current = [];
      flushInterval.current = setInterval(() => {
        if (pointsBuffer.current.length > 0) {
          const pointsToSend = [...pointsBuffer.current];
          pointsBuffer.current = [];
          socket.emit('stroke:points', { roomId, id: op.id, points: pointsToSend });
        }
      }, 40);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !currentOp || disabled || playerId !== drawerId) return;
    e.preventDefault();

    const point = getNormalizedPoint(e);
    setCurrentOp((prev) => ({
      ...prev,
      points: [...prev.points, point]
    }));
    
    pointsBuffer.current.push(point);
  };

  const handlePointerUp = (e) => {
    if (!isDrawing || !currentOp || disabled || playerId !== drawerId) return;
    e.preventDefault();
    setIsDrawing(false);
    addOp(currentOp);
    
    if (flushInterval.current) {
        clearInterval(flushInterval.current);
        flushInterval.current = null;
    }
    if (pointsBuffer.current.length > 0) {
        socket.emit('stroke:points', { roomId, id: currentOp.id, points: pointsBuffer.current });
        pointsBuffer.current = [];
    }
    
    socket.emit('stroke:end', { roomId, id: currentOp.id });
    setCurrentOp(null);
  };
  
  const handlePointerLeave = (e) => {
    if (isDrawing) {
        handlePointerUp(e);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full max-h-full object-contain cursor-crosshair shadow-lg bg-white touch-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e); }}
        onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e); }}
        onTouchEnd={(e) => { e.preventDefault(); handlePointerUp(e); }}
        onTouchCancel={(e) => { e.preventDefault(); handlePointerLeave(e); }}
        style={{
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`
        }}
      />
    </div>
  );
}
