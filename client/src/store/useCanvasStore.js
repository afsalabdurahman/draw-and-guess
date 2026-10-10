import { create } from 'zustand';

export const useCanvasStore = create((set) => ({
  ops: [],
  tool: 'pen', // 'pen', 'eraser', 'fill'
  color: '#000000',
  size: 5,

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),

  addOp: (op) => set((state) => ({ ops: [...state.ops, op] })),

  addPoints: (id, points) => set((state) => {
    const ops = [...state.ops];
    const opIndex = ops.findIndex(o => o.id === id);
    if (opIndex !== -1 && ops[opIndex].type === 'stroke') {
      ops[opIndex] = { ...ops[opIndex], points: [...ops[opIndex].points, ...points] };
    }
    return { ops };
  }),

  setOps: (ops) => set({ ops }),
  
  undo: () => set((state) => {
    const newOps = [...state.ops];
    for (let i = newOps.length - 1; i >= 0; i--) {
      if (newOps[i].type === 'stroke' || newOps[i].type === 'fill' || newOps[i].type === 'clear') {
        newOps.splice(i, 1);
        break;
      }
    }
    return { ops: newOps };
  }),
  
  clear: () => set((state) => ({
    ops: [...state.ops, { type: 'clear', id: crypto.randomUUID() }]
  })),

  resetCanvas: () => set({ ops: [] }),
}));
