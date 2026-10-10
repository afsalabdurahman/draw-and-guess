import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { roomManager } from './rooms/RoomManager.js';
import {
  roomJoinSchema, settingsUpdateSchema, gameStartSchema,
  strokeStartSchema, strokePointsSchema, strokeEndSchema, fillSchema, simpleOpSchema,
  wordPickSchema, chatSendSchema
} from './net/schemas.js';
import { startGame, handleWordPick, broadcastRoomState, checkTurnEarlyEnd, pauseGame, resumeGame, returnToLobby, endTurn } from './rooms/stateMachine.js';
import { checkGuess } from './game/guess.js';
import { calculateGuesserScore } from './game/scoring.js';
import { timerManager } from './rooms/TimerManager.js';
import { rateLimiter } from './net/rateLimit.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10000,
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.post('/rooms', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const ipBucket = rateLimiter.getIpBucket(ip, 'create_room', 10, 0.05); // max 10 rooms per ~3.3 mins
  if (!ipBucket.consume(1)) {
    return res.status(429).json({ error: 'Too many rooms created' });
  }

  // Cap total rooms
  if (roomManager.rooms.size >= 1000) {
    return res.status(503).json({ error: 'Server is at maximum capacity' });
  }

  const roomId = roomManager.createRoom();
  res.json({ roomId });
});

app.get('/rooms/:id', (req, res) => {
  const room = roomManager.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ exists: false });
  }
  res.json({
    exists: true,
    playerCount: room.players.length,
    phase: room.phase
  });
});

// broadcastRoomState is now imported from stateMachine.js

const validateDrawingOp = (socket, roomId) => {
  const room = roomManager.getRoom(roomId);
  if (!room) throw new Error('Room not found');
  if (room.phase !== 'DRAWING') throw new Error('Not drawing phase');
  if (room.ops.length >= 1500) throw new Error('Too many ops');
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player || player.id !== room.drawerId) throw new Error('Not drawer');
  return room;
};

io.use((socket, next) => {
  const ip = socket.handshake.address;
  if (rateLimiter.isIpBlocked(ip)) {
    return next(new Error('IP is temporarily blocked'));
  }
  next();
});

const checkRateLimit = (socket, event, capacity, rate) => {
  const ip = socket.handshake.address;
  const bucket = rateLimiter.getSocketBucket(socket.id, event, capacity, rate);
  
  if (!bucket.consume(1)) {
    const violations = rateLimiter.recordViolation(socket.id);
    if (violations > 20) {
      rateLimiter.blockIp(ip, 5 * 60 * 1000); // 5 min block
      socket.disconnect(true);
    }
    return false;
  }
  return true;
};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('room:join', (payload, callback) => {
    if (!checkRateLimit(socket, 'join', 5, 0.5)) return;
    try {
      const data = roomJoinSchema.parse(payload);
      const player = roomManager.joinRoom(data.roomId, data, socket.id);
      
      socket.join(data.roomId);
      
      const room = roomManager.getRoom(data.roomId);
      if (!room) throw new Error('Room not found');

      // Clear grace timer if it existed
      timerManager.clear(data.roomId, `grace_${player.id}`);

      // If they were the drawer, clear drawerDrop timer
      if (room.drawerId === player.id) {
        timerManager.clear(data.roomId, `drawerDrop_${player.id}`);
      }

      // Check if room was paused and can now resume
      const connectedPlayers = room.players.filter(p => p.connected).length;
      if (room.paused && connectedPlayers >= 2) {
        resumeGame(io, data.roomId);
      } else {
        broadcastRoomState(io, data.roomId);
      }
      
      // Full snapshot on join
      socket.emit('game:snapshot', {
        phase: room.phase,
        settings: room.settings,
        scores: room.turnScores,
        hintMask: room.hintMask,
        endsAt: room.endsAt,
        ops: room.ops,
        chatHistory: room.chatHistory,
        paused: room.paused
      });

      if (room.phase === 'DRAWING' && room.drawerId === player.id) {
        socket.emit('turn:secret_word', { word: room.secretWord });
      }

      // If it's choosing word and they are drawer, resend choices
      if (room.phase === 'CHOOSING_WORD' && room.drawerId === player.id) {
        socket.emit('word:choices', { choices: room.wordChoices });
      }
      
      if (callback) {
        callback({ success: true, playerId: player.id, reconnectToken: player.token });
      }
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on('settings:update', (payload, callback) => {
    try {
      const data = settingsUpdateSchema.parse(payload);
      const room = roomManager.getRoom(data.roomId);
      if (!room) throw new Error('Room not found');

      if (room.phase !== 'LOBBY') {
        throw new Error('Can only change settings in LOBBY');
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || room.hostId !== player.id) {
        throw new Error('Only host can update settings');
      }

      const newSettings = data.settings;
      
      if (newSettings.wordList && Array.isArray(newSettings.wordList)) {
        const uniqueWords = [...new Set(newSettings.wordList.map(w => w.trim().toLowerCase()))];
        newSettings.wordList = uniqueWords;
      }

      room.settings = { ...room.settings, ...newSettings };
      
      broadcastRoomState(io, data.roomId);

      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on('game:start', (payload, callback) => {
    try {
      const data = gameStartSchema.parse(payload);
      const room = roomManager.getRoom(data.roomId);
      if (!room) throw new Error('Room not found');

      if (room.phase !== 'LOBBY') {
        throw new Error('Game already started');
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || room.hostId !== player.id) {
        throw new Error('Only host can start game');
      }

      const connectedPlayers = room.players.filter(p => p.connected).length;
      if (connectedPlayers < 2) {
        throw new Error('Need at least 2 connected players to start');
      }

      startGame(io, data.roomId);

      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on('time:sync', (payload, callback) => {
    if (callback) callback({ serverTime: Date.now() });
  });

  socket.on('word:pick', (payload) => {
    try {
      const data = wordPickSchema.parse(payload);
      handleWordPick(io, data.roomId, data.word);
    } catch (e) {}
  });
  socket.on('game:reset', (payload, callback) => {
    try {
      const data = gameStartSchema.parse(payload); // reusing schema for roomId
      const room = roomManager.getRoom(data.roomId);
      if (!room) throw new Error('Room not found');

      if (room.phase !== 'GAME_END') {
        throw new Error('Game not ended');
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || room.hostId !== player.id) {
        throw new Error('Only host can reset game');
      }

      room.phase = 'LOBBY';
      room.players.forEach(p => p.score = 0);
      broadcastRoomState(io, data.roomId);

      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });
  socket.on('stroke:start', (payload) => {
    if (!checkRateLimit(socket, 'stroke', 60, 60)) return;
    try {
      const data = strokeStartSchema.parse(payload);
      const room = validateDrawingOp(socket, data.roomId);
      const op = {
        type: 'stroke',
        id: data.id,
        tool: data.tool,
        color: data.color,
        size: data.size,
        points: [data.point],
        t: Date.now() - room.turnStartTime
      };
      room.ops.push(op);
      socket.to(data.roomId).emit('canvas:op', op);
    } catch (err) {}
  });

  socket.on('stroke:points', (payload) => {
    if (!checkRateLimit(socket, 'stroke', 60, 60)) return;
    try {
      const data = strokePointsSchema.parse(payload);
      const room = validateDrawingOp(socket, data.roomId);
      const op = room.ops.find(o => o.id === data.id);
      if (!op || op.type !== 'stroke') return;
      if (op.points.length + data.points.length > 2000) return;
      
      op.points.push(...data.points);
      socket.to(data.roomId).emit('canvas:points', { id: data.id, points: data.points });
    } catch (err) {}
  });

  socket.on('stroke:end', (payload) => {
    if (!checkRateLimit(socket, 'stroke', 60, 60)) return;
    try {
      const data = strokeEndSchema.parse(payload);
      validateDrawingOp(socket, data.roomId);
    } catch (err) {}
  });

  socket.on('fill', (payload) => {
    if (!checkRateLimit(socket, 'ops', 5, 5)) return;
    try {
      const data = fillSchema.parse(payload);
      const room = validateDrawingOp(socket, data.roomId);
      const op = {
        type: 'fill',
        id: data.id,
        color: data.color,
        x: data.x,
        y: data.y,
        t: Date.now() - room.turnStartTime
      };
      room.ops.push(op);
      socket.to(data.roomId).emit('canvas:op', op);
    } catch (err) {}
  });

  socket.on('clear', (payload) => {
    if (!checkRateLimit(socket, 'ops', 5, 5)) return;
    try {
      const data = simpleOpSchema.parse(payload);
      const room = validateDrawingOp(socket, data.roomId);
      const op = { type: 'clear', id: data.id, t: Date.now() - room.turnStartTime };
      room.ops.push(op);
      socket.to(data.roomId).emit('canvas:op', op);
    } catch (err) {}
  });

  socket.on('undo', (payload) => {
    if (!checkRateLimit(socket, 'ops', 5, 5)) return;
    try {
      const data = simpleOpSchema.parse(payload);
      const room = validateDrawingOp(socket, data.roomId);
      roomManager.undoOp(data.roomId);
      socket.to(data.roomId).emit('canvas:undo');
    } catch (err) {}
  });

  socket.on('chat:send', (payload) => {
    if (!checkRateLimit(socket, 'chat', 3, 1.5)) return; // 3 per 2s
    try {
      const data = chatSendSchema.parse(payload);
      const room = roomManager.getRoom(data.roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      const text = data.text.trim();
      if (!text) return;

      // During DRAWING phase, check if it's a guess
      if (room.phase === 'DRAWING' && player.id !== room.drawerId && !room.guessedPlayers.has(player.id)) {
        const guessResult = checkGuess(text, room.secretWord);
        
        if (guessResult === 'MATCH') {
          room.guessedPlayers.add(player.id);
          
          const timeLeft = Math.max(0, room.endsAt - Date.now());
          const orderIndex = room.guessedPlayers.size - 1;
          const score = calculateGuesserScore(timeLeft, room.settings.drawTimeSec * 1000, orderIndex);
          
          room.turnScores[player.id] = score;

          const msg = {
            id: crypto.randomUUID(),
            sender: 'SYSTEM',
            text: `${player.name} guessed the word!`,
            system: true,
            color: 'text-green-400'
          };
          room.chatHistory.push(msg);
          if (room.chatHistory.length > 50) room.chatHistory.shift();

          io.to(data.roomId).emit('chat:message', msg);

          checkTurnEarlyEnd(io, data.roomId);
          return;
        } else if (guessResult === 'CLOSE') {
          socket.emit('chat:message', {
            id: crypto.randomUUID(),
            sender: 'SYSTEM',
            text: `'${text}' is close!`,
            system: true,
            color: 'text-yellow-400'
          });
          return;
        }
      }

      // If drawer or already guessed, it's a secret chat during DRAWING phase
      if (room.phase === 'DRAWING' && (player.id === room.drawerId || room.guessedPlayers.has(player.id))) {
        const secretMsg = {
          id: crypto.randomUUID(),
          sender: player.name,
          text,
          secret: true
        };
        
        // Send to drawer
        const drawerPlayer = room.players.find(p => p.id === room.drawerId);
        if (drawerPlayer && drawerPlayer.socketId) {
          io.to(drawerPlayer.socketId).emit('chat:message', secretMsg);
        }
        
        // Send to all guessed players
        room.guessedPlayers.forEach(pid => {
          const p = room.players.find(x => x.id === pid);
          if (p && p.socketId && p.id !== room.drawerId) {
            io.to(p.socketId).emit('chat:message', secretMsg);
          }
        });
        return;
      }

      // Normal chat
      const normalMsg = {
        id: crypto.randomUUID(),
        sender: player.name,
        text
      };
      room.chatHistory.push(normalMsg);
      if (room.chatHistory.length > 50) room.chatHistory.shift();

      io.to(data.roomId).emit('chat:message', normalMsg);
    } catch (e) {}
  });

  socket.on('disconnect', () => {
    roomManager.rooms.forEach((room, roomId) => {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        roomManager.leaveRoom(roomId, socket.id);
        broadcastRoomState(io, roomId);
        
        // Disconnect rules
        const connectedPlayers = room.players.filter(p => p.connected).length;
        
        // 1. Min players check
        if (connectedPlayers < 2) {
          pauseGame(io, roomId);
        }

        // 2. Drawer drop 10s check
        if (room.phase === 'DRAWING' && room.drawerId === player.id) {
          timerManager.set(roomId, `drawerDrop_${player.id}`, () => {
            const currentRoom = roomManager.getRoom(roomId);
            if (currentRoom && currentRoom.phase === 'DRAWING' && currentRoom.drawerId === player.id) {
               // Give 0 points to drawer (since they disconnected), turnScores logic takes care of this by not setting it
               endTurn(io, roomId);
            }
          }, 10000);
        }

        // 3. 30s Grace timer for permanent removal
        timerManager.set(roomId, `grace_${player.id}`, () => {
          roomManager.permanentlyRemovePlayer(roomId, player.id);
          broadcastRoomState(io, roomId);
          
          const currentConnected = roomManager.getRoom(roomId)?.players.filter(p => p.connected).length || 0;
          if (roomManager.getRoom(roomId)?.paused && currentConnected < 2) {
             returnToLobby(io, roomId);
          } else {
             checkTurnEarlyEnd(io, roomId);
          }
        }, 30000);
        
        // 4. Check if everyone remaining guessed
        checkTurnEarlyEnd(io, roomId);
      }
    });
    rateLimiter.cleanup(socket.id);
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of roomManager.rooms.entries()) {
    const connectedPlayers = room.players.filter(p => p.connected).length;
    // Empty for 5 minutes
    if (connectedPlayers === 0 && room.paused && now - (room.timeRemaining || 0) > 300000) { 
        // Note: the logic above isn't perfectly tracking 'empty time', 
        // a better way: if there's no host (all players permanently removed), delete room.
        if (room.players.length === 0) {
           roomManager.rooms.delete(roomId);
        }
    }
  }
}, 60000);

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
