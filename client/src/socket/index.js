import { io } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';
import { useCanvasStore } from '../store/useCanvasStore';

export const socket = io('http://localhost:4000', {
  autoConnect: false,
});

socket.on('connect', () => {
  const localTime = Date.now();
  socket.emit('time:sync', {}, (response) => {
    if (response && response.serverTime) {
      const offset = response.serverTime - localTime;
      useGameStore.getState().setGameState({ timeOffset: offset });
    }
  });
});

socket.on('room:state', (state) => {
  useGameStore.getState().setGameState(state);
});

socket.on('canvas:snapshot', ({ ops }) => {
  useCanvasStore.getState().setOps(ops);
});

socket.on('canvas:op', (op) => {
  useCanvasStore.getState().addOp(op);
});

socket.on('canvas:points', ({ id, points }) => {
  useCanvasStore.getState().addPoints(id, points);
});

socket.on('canvas:undo', () => {
  useCanvasStore.getState().undo();
});

socket.on('word:choices', ({ choices }) => {
  useGameStore.getState().setGameState({ wordChoices: choices });
});

socket.on('turn:start', ({ drawerId, endsAt, hintMask }) => {
  useGameStore.getState().setGameState({ drawerId, endsAt, hintMask });
  useCanvasStore.getState().setOps([]);
});

socket.on('turn:secret_word', ({ word }) => {
  useGameStore.getState().setGameState({ secretWord: word });
});

socket.on('turn:hint_update', ({ hintMask }) => {
  useGameStore.getState().setGameState({ hintMask });
});

socket.on('turn:end', ({ word, turnScores }) => {
  useGameStore.getState().setGameState({ secretWord: word, turnScores });
});

socket.on('game:end', ({ finalScores }) => {
  useGameStore.getState().setGameState({ finalScores });
});

// Helper for emitting with promise
export const emitPromise = (event, data) => {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
};
