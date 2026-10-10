import { nanoid } from 'nanoid';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom() {
    const roomId = nanoid(8);
    const room = {
      id: roomId,
      phase: 'LOBBY',
      hostId: null,
      drawerId: null,
      turnStartTime: 0,
      ops: [],
      turnQueue: [],
      currentTurnIndex: 0,
      round: 0,
      secretWord: null,
      wordChoices: [],
      hintMask: null,
      startedAt: 0,
      endsAt: 0,
      guessedPlayers: new Set(),
      turnScores: {},
      finalScores: {},
      settings: {
        rounds: 3,
        drawTimeSec: 80,
        wordList: 'default',
        maxPlayers: 8
      },
      players: [],
    };
    this.rooms.set(roomId, room);
    return roomId;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, playerInfo, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (playerInfo.reconnectToken) {
      const existingPlayer = room.players.find(p => p.token === playerInfo.reconnectToken);
      if (existingPlayer) {
        existingPlayer.connected = true;
        existingPlayer.socketId = socketId;
        
        if (!room.hostId) {
          room.hostId = existingPlayer.id;
        }
        
        return existingPlayer;
      }
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    const newPlayer = {
      id: nanoid(),
      name: playerInfo.name,
      token: nanoid(),
      score: 0,
      connected: true,
      socketId,
    };
    
    room.players.push(newPlayer);
    
    if (!room.hostId) {
      room.hostId = newPlayer.id;
    }

    return newPlayer;
  }

  leaveRoom(roomId, socketId) {
     const room = this.rooms.get(roomId);
     if (room) {
         const player = room.players.find(p => p.socketId === socketId);
         if (player) {
             player.connected = false;
             if (room.hostId === player.id) {
                 this.migrateHost(roomId);
             }
         }
     }
  }

  migrateHost(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const nextHost = room.players.find(p => p.connected);
    if (nextHost) {
      room.hostId = nextHost.id;
    } else {
      room.hostId = null;
    }
  }

  undoOp(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    // Find the last stroke/fill/clear op to undo
    for (let i = room.ops.length - 1; i >= 0; i--) {
      const op = room.ops[i];
      if (op.type === 'stroke' || op.type === 'fill' || op.type === 'clear') {
        room.ops.splice(i, 1);
        break;
      }
    }
  }
}

export const roomManager = new RoomManager();
