import { create } from 'zustand';

export const useGameStore = create((set) => ({
  roomId: null,
  players: [],
  phase: 'LOBBY',
  playerId: null,
  reconnectToken: null,
  hostId: null,
  drawerId: null,
  wordChoices: [],
  secretWord: null,
  hintMask: null,
  endsAt: 0,
  timeOffset: 0,
  paused: false,
  turnScores: {},
  finalScores: [],
  settings: {
    rounds: 3,
    drawTimeSec: 80,
    wordList: 'default',
    maxPlayers: 8
  },

  setRoomInfo: (roomId, playerId, reconnectToken) => set({ roomId, playerId, reconnectToken }),
  setGameState: (state) => set((prev) => ({ ...prev, ...state })),
}));
