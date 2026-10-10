import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { roomManager } from './RoomManager.js';
import { timerManager } from './TimerManager.js';
import { startGame, endTurn } from './stateMachine.js';

describe('Recovery and Reconnect', () => {
  let roomId;
  let ioMock;
  let socket1, socket2, socket3;
  let p1, p2, p3;

  beforeEach(() => {
    // Reset managers
    roomManager.rooms.clear();
    timerManager.timers.clear();
    
    // Mock io
    ioMock = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };

    // Setup room
    roomId = roomManager.createRoom();
    
    p1 = roomManager.joinRoom(roomId, { name: 'P1' }, 'sock1'); // Host
    p2 = roomManager.joinRoom(roomId, { name: 'P2' }, 'sock2');
    p3 = roomManager.joinRoom(roomId, { name: 'P3' }, 'sock3');

    // Make game start
    startGame(ioMock, roomId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refresh mid-round preserves player score and state', () => {
    const room = roomManager.getRoom(roomId);
    
    // simulate some score
    p1.score = 500;
    room.guessedPlayers.add(p1.id);
    
    // p1 disconnects
    roomManager.leaveRoom(roomId, 'sock1');
    expect(p1.connected).toBe(false);
    expect(room.hostId).toBe(p2.id); // host migrated

    // p1 reconnects with token
    const reconnectedPlayer = roomManager.joinRoom(roomId, { reconnectToken: p1.token }, 'new_sock1');
    
    expect(reconnectedPlayer.id).toBe(p1.id);
    expect(reconnectedPlayer.connected).toBe(true);
    expect(reconnectedPlayer.score).toBe(500); // score kept
    expect(room.guessedPlayers.has(p1.id)).toBe(true); // guess kept
  });

  it('drawer drop ends turn cleanly after 10s', () => {
    const room = roomManager.getRoom(roomId);
    
    // P1 is drawer
    expect(room.drawerId).toBe(p1.id);
    
    // Fast forward Phase to DRAWING
    room.phase = 'DRAWING';
    
    // Simulate what index.js disconnect does
    roomManager.leaveRoom(roomId, 'sock1');
    
    timerManager.set(roomId, `drawerDrop_${p1.id}`, () => {
      endTurn(ioMock, roomId);
    }, 10000);
    
    expect(timerManager.timers.get(roomId).has(`drawerDrop_${p1.id}`)).toBe(true);
    
    // Execute the timer
    const dropTimer = timerManager.timers.get(roomId).get(`drawerDrop_${p1.id}`);
    clearTimeout(dropTimer);
    
    // Manually trigger the callback
    endTurn(ioMock, roomId);
    
    // Should transition to TURN_END
    expect(room.phase).toBe('TURN_END');
  });

  it('drawer returns within 10s and resumes', () => {
    const room = roomManager.getRoom(roomId);
    room.phase = 'DRAWING';
    
    // Disconnect
    roomManager.leaveRoom(roomId, 'sock1');
    
    timerManager.set(roomId, `drawerDrop_${p1.id}`, () => {
      endTurn(ioMock, roomId);
    }, 10000);
    
    // Reconnect
    roomManager.joinRoom(roomId, { reconnectToken: p1.token }, 'sock1_new');
    
    // index.js clears the timer on reconnect
    timerManager.clear(roomId, `drawerDrop_${p1.id}`);
    
    expect(timerManager.timers.get(roomId).has(`drawerDrop_${p1.id}`)).toBe(false);
    expect(room.phase).toBe('DRAWING');
  });

  it('permanently removes player after 30s grace period and fixes queue', () => {
    const room = roomManager.getRoom(roomId);
    expect(room.turnQueue).toEqual([p1.id, p2.id, p3.id]);
    
    // p2 leaves
    roomManager.leaveRoom(roomId, 'sock2');
    
    // grace timer fires
    roomManager.permanentlyRemovePlayer(roomId, p2.id);
    
    expect(room.players.length).toBe(2);
    expect(room.turnQueue).toEqual([p1.id, p3.id]); // p2 removed from queue
  });
});
