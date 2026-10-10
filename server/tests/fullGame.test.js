import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import express from 'express';
import { roomManager } from '../src/rooms/RoomManager.js';

import {
  roomJoinSchema,
} from '../src/net/schemas.js';
import { startGame, handleWordPick, broadcastRoomState, checkTurnEarlyEnd, endTurn } from '../src/rooms/stateMachine.js';
import { checkGuess } from '../src/game/guess.js';
import { timerManager } from '../src/rooms/TimerManager.js';

describe('Full Game Integration Test', () => {
  let io, server, port;
  let c1, c2, c3;
  let roomId;
  let p1Token, p2Token, p3Token;

  beforeAll(async () => {
    const app = express();
    server = createServer(app);
    io = new Server(server);

    const validateDrawingOp = (socket, roomId) => {
      const room = roomManager.getRoom(roomId);
      if (!room || room.phase !== 'DRAWING') throw new Error('invalid');
      return room;
    };

    io.on('connection', (socket) => {
      socket.on('room:join', (payload, callback) => {
        try {
          const data = roomJoinSchema.parse(payload);
          socket.join(data.roomId);
          const player = roomManager.joinRoom(data.roomId, data, socket.id);
          broadcastRoomState(io, data.roomId);
          if (callback) callback({ success: true, playerId: player.id, reconnectToken: player.token });
        } catch (e) {
          if (callback) callback({ success: false, error: e.message });
        }
      });
      
      socket.on('game:start', (payload, callback) => {
        startGame(io, payload.roomId);
        if (callback) callback({ success: true });
      });

      socket.on('word:pick', (payload) => {
        handleWordPick(io, payload.roomId, payload.word);
      });

      socket.on('stroke:start', (payload) => {
        const room = validateDrawingOp(socket, payload.roomId);
        const op = { type: 'stroke', id: payload.id, tool: payload.tool, color: payload.color, size: payload.size, points: [payload.point], t: 0 };
        room.ops.push(op);
        socket.to(payload.roomId).emit('canvas:op', op);
      });

      socket.on('chat:send', (payload) => {
        const room = roomManager.getRoom(payload.roomId);
        const player = room.players.find(p => p.socketId === socket.id);
        const text = payload.text;

        if (room.phase === 'DRAWING' && player.id !== room.drawerId && !room.guessedPlayers.has(player.id)) {
          const guessResult = checkGuess(text, room.secretWord);
          if (guessResult === 'MATCH') {
            room.guessedPlayers.add(player.id);
            room.turnScores[player.id] = 100;
            io.to(payload.roomId).emit('chat:message', { sender: 'SYSTEM', text: 'guessed the word!', system: true });
            checkTurnEarlyEnd(io, payload.roomId);
            return;
          } else if (guessResult === 'CLOSE') {
            socket.emit('chat:message', { sender: 'SYSTEM', text: 'close!', system: true });
            return;
          }
        }
        
        io.to(payload.roomId).emit('chat:message', { sender: player.name, text });
      });

      socket.on('disconnect', () => {
        roomManager.rooms.forEach((room, rId) => {
          const player = room.players.find(p => p.socketId === socket.id);
          if (player) {
            player.connected = false;
            player.socketId = null;
            broadcastRoomState(io, rId);
            
            if ((room.phase === 'DRAWING' || room.phase === 'CHOOSING_WORD') && room.drawerId === player.id) {
               timerManager.set(rId, 'drawerDisconnect', () => {
                 endTurn(io, rId);
               }, 100);
            }
          }
        });
      });
    });

    await new Promise((resolve) => {
      server.listen(() => {
        port = server.address().port;
        roomId = roomManager.createRoom();
        const room = roomManager.getRoom(roomId);
        room.settings.rounds = 2;
        room.settings.drawTimeSec = 20;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (io) io.close();
    if (server) server.close();
    if (c1) c1.close();
    if (c2) c2.close();
    if (c3) c3.close();
  });

  const createClient = () => {
    return new Promise((resolve) => {
      const client = Client(`http://localhost:${port}`);
      client.on('connect', () => resolve(client));
    });
  };

  const joinClient = (client, name, token = undefined) => {
    return new Promise((resolve) => {
      client.emit('room:join', { roomId, name, reconnectToken: token }, (res) => {
        resolve(res);
      });
    });
  };

  it('completes a full game with 3 clients, handling close guesses, matches, and disconnects', async () => {
    c1 = await createClient();
    c2 = await createClient();
    c3 = await createClient();

    const r1 = await joinClient(c1, 'Alice');
    p1Token = r1.reconnectToken;
    const r2 = await joinClient(c2, 'Bob');
    p2Token = r2.reconnectToken;
    const r3 = await joinClient(c3, 'Charlie');
    p3Token = r3.reconnectToken;

    let room = roomManager.getRoom(roomId);
    expect(room.players.length).toBe(3);

    const waitForEvent = (client, event, label) => {
      console.log(`[${label}] Waiting for ${event}...`);
      return new Promise(resolve => {
        client.once(event, (data) => {
          console.log(`[${label}] Received ${event}`);
          resolve(data);
        });
      });
    };

    c1.emit('game:start', { roomId });
    await waitForEvent(c2, 'room:state', 'c2 game start');

    expect(room.phase).toBe('CHOOSING_WORD');
    expect(room.drawerId).toBe(r1.playerId);
    
    const secretWord = room.wordChoices[0];
    c1.emit('word:pick', { roomId, word: secretWord });
    await waitForEvent(c2, 'turn:start', 'c2 turn start');

    c1.emit('stroke:start', { roomId, id: 's1', tool: 'pen', color: '#000000', size: 5, point: {x: 0.5, y: 0.5} });
    const opMsg = await waitForEvent(c2, 'canvas:op', 'c2 canvas op');
    expect(opMsg.id).toBe('s1');

    const closeWord = secretWord.substring(0, secretWord.length - 1) + (secretWord.endsWith('a') ? 'b' : 'a');
    c2.emit('chat:send', { roomId, text: closeWord });
    const chatMsg = await waitForEvent(c2, 'chat:message', 'c2 chat message');
    expect(chatMsg.system).toBe(true);
    expect(chatMsg.text).toContain('close');

    c3.disconnect();
    await new Promise(r => setTimeout(r, 50));
    expect(room.players.find(p => p.id === r3.playerId).connected).toBe(false);

    c3.connect();
    await joinClient(c3, 'Charlie', p3Token);
    expect(room.players.find(p => p.id === r3.playerId).connected).toBe(true);

    c2.emit('chat:send', { roomId, text: secretWord });
    const matchMsg = await waitForEvent(c1, 'chat:message', 'c1 match message');
    expect(matchMsg.text).toContain('guessed the word');

    c3.emit('chat:send', { roomId, text: secretWord });
    await waitForEvent(c2, 'turn:end', 'c2 turn end 1'); 
    
    expect(room.turnScores[r2.playerId]).toBeGreaterThan(0);
    expect(room.turnScores[r3.playerId]).toBeGreaterThan(0);
    
    await waitForEvent(c1, 'room:state', 'c1 room state after turn 1');
    expect(room.phase).toBe('CHOOSING_WORD');
    expect(room.drawerId).toBe(r2.playerId);

    c2.disconnect();
    
    await waitForEvent(c1, 'turn:end', 'c1 turn end after disconnect');
    
    await waitForEvent(c1, 'room:state', 'c1 room state after disconnect');
    expect(room.drawerId).toBe(r3.playerId);
    
    c3.emit('word:pick', { roomId, word: room.wordChoices[0] });
    await waitForEvent(c1, 'turn:start', 'c1 turn start round 1 p3');

    c1.emit('chat:send', { roomId, text: room.wordChoices[0] });
    
    await waitForEvent(c1, 'turn:end', 'c1 turn end round 1 p3');
    await waitForEvent(c1, 'room:state', 'c1 room state round 2');
    expect(room.round).toBe(2);
  }, 30000);
});
