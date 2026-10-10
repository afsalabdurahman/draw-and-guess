import { roomManager } from './RoomManager.js';
import { timerManager } from './TimerManager.js';
import { defaultWords } from '../game/words.js';
import { generateInitialMask, revealHint } from '../game/hints.js';
import { calculateDrawerScore } from '../game/scoring.js';

const getRoomAndPlayers = (roomId) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return null;
  return room;
};

export const broadcastRoomState = (io, roomId) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  const publicPlayers = room.players.map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected
  }));

  io.to(roomId).emit('room:state', { 
    players: publicPlayers, 
    phase: room.phase,
    hostId: room.hostId,
    drawerId: room.drawerId,
    settings: room.settings
  });
};

export const startGame = (io, roomId) => {
  const room = getRoomAndPlayers(roomId);
  if (!room) return;

  room.players.forEach(p => {
    p.score = 0;
  });

  room.round = 1;
  room.turnQueue = room.players.filter(p => p.connected).map(p => p.id);
  room.currentTurnIndex = 0;

  startChoosingWord(io, roomId, room.turnQueue[room.currentTurnIndex]);
};

export const startChoosingWord = (io, roomId, drawerId) => {
  const room = getRoomAndPlayers(roomId);
  if (!room) return;
  
  timerManager.clearAll(roomId);

  room.phase = 'CHOOSING_WORD';
  room.drawerId = drawerId;
  room.secretWord = null;
  room.hintMask = null;
  room.ops = [];
  room.guessedPlayers.clear();
  room.turnScores = {};
  
  const shuffled = [...defaultWords].sort(() => 0.5 - Math.random());
  room.wordChoices = shuffled.slice(0, 3);

  broadcastRoomState(io, roomId);

  const drawerPlayer = room.players.find(p => p.id === drawerId);
  if (drawerPlayer && drawerPlayer.socketId) {
    io.to(drawerPlayer.socketId).emit('word:choices', { choices: room.wordChoices });
  }

  timerManager.set(roomId, 'autopick', () => {
    handleWordPick(io, roomId, room.wordChoices[0]);
  }, 15000);
};

export const handleWordPick = (io, roomId, word) => {
  const room = getRoomAndPlayers(roomId);
  if (!room || room.phase !== 'CHOOSING_WORD') return;
  
  if (!room.wordChoices.includes(word)) {
    word = room.wordChoices[0];
  }

  startDrawing(io, roomId, word);
};

export const startDrawing = (io, roomId, word) => {
  const room = getRoomAndPlayers(roomId);
  if (!room) return;
  
  timerManager.clearAll(roomId);

  room.phase = 'DRAWING';
  room.secretWord = word;
  room.startedAt = Date.now();
  room.turnStartTime = room.startedAt;
  
  const duration = room.settings.drawTimeSec * 1000;
  room.endsAt = room.startedAt + duration;
  
  room.hintMask = generateInitialMask(word);

  broadcastRoomState(io, roomId);

  io.to(roomId).emit('turn:start', {
    drawerId: room.drawerId,
    endsAt: room.endsAt,
    wordLength: word.length,
    hintMask: room.hintMask
  });

  const drawerPlayer = room.players.find(p => p.id === room.drawerId);
  if (drawerPlayer && drawerPlayer.socketId) {
    io.to(drawerPlayer.socketId).emit('turn:secret_word', { word });
  }

  timerManager.set(roomId, 'turnEnd', () => {
    endTurn(io, roomId);
  }, duration);

  const sendHint = () => {
    if (room.phase === 'DRAWING') {
      room.hintMask = revealHint(room.hintMask, room.secretWord);
      room.players.forEach(p => {
         if (p.id !== room.drawerId && p.socketId) {
             io.to(p.socketId).emit('turn:hint_update', { hintMask: room.hintMask });
         }
      });
    }
  };

  timerManager.set(roomId, 'hint1', sendHint, duration * 0.4);
  timerManager.set(roomId, 'hint2', sendHint, duration * 0.7);
};

export const checkTurnEarlyEnd = (io, roomId) => {
  const room = getRoomAndPlayers(roomId);
  if (!room || room.phase !== 'DRAWING') return;

  const nonDrawers = room.players.filter(p => p.id !== room.drawerId && p.connected);
  const allGuessed = nonDrawers.length > 0 && nonDrawers.every(p => room.guessedPlayers.has(p.id));
  
  if (allGuessed) {
    endTurn(io, roomId);
  }
};

export const endTurn = (io, roomId) => {
  const room = getRoomAndPlayers(roomId);
  if (!room) return;
  
  timerManager.clearAll(roomId);
  room.phase = 'TURN_END';

  // Calculate drawer score
  const guesserScores = Object.values(room.turnScores);
  const drawerScore = calculateDrawerScore(guesserScores);
  if (drawerScore > 0) {
    room.turnScores[room.drawerId] = drawerScore;
  }

  // Update total scores
  room.players.forEach(p => {
    if (room.turnScores[p.id]) {
      p.score += room.turnScores[p.id];
    }
  });
  
  broadcastRoomState(io, roomId);
  io.to(roomId).emit('turn:end', { word: room.secretWord, turnScores: room.turnScores });

  timerManager.set(roomId, 'nextTurn', () => {
    room.currentTurnIndex++;
    if (room.currentTurnIndex >= room.turnQueue.length) {
      room.round++;
      if (room.round > room.settings.rounds) {
        endGame(io, roomId);
        return;
      }
      room.turnQueue = room.players.filter(p => p.connected).map(p => p.id);
      room.currentTurnIndex = 0;
    }
    
    if (room.turnQueue.length > 0) {
      startChoosingWord(io, roomId, room.turnQueue[room.currentTurnIndex]);
    } else {
      endGame(io, roomId);
    }
  }, 5000);
};

export const endGame = (io, roomId) => {
  const room = getRoomAndPlayers(roomId);
  if (!room) return;
  
  timerManager.clearAll(roomId);
  room.phase = 'GAME_END';
  
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  room.finalScores = sortedPlayers.map(p => ({
    id: p.id,
    name: p.name,
    score: p.score
  }));

  broadcastRoomState(io, roomId);
  io.to(roomId).emit('game:end', { finalScores: room.finalScores });
};
