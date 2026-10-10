import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager.js';

describe('RoomManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('creates a room with default settings', () => {
    const roomId = manager.createRoom();
    const room = manager.getRoom(roomId);
    
    expect(room.hostId).toBeNull();
    expect(room.settings.rounds).toBe(3);
    expect(room.settings.maxPlayers).toBe(8);
  });

  it('assigns host to first player', () => {
    const roomId = manager.createRoom();
    const p1 = manager.joinRoom(roomId, { name: 'P1' }, 'sock1');
    const room = manager.getRoom(roomId);
    
    expect(room.hostId).toBe(p1.id);
    
    const p2 = manager.joinRoom(roomId, { name: 'P2' }, 'sock2');
    expect(room.hostId).toBe(p1.id); // Host stays P1
  });

  it('migrates host when host disconnects', () => {
    const roomId = manager.createRoom();
    const p1 = manager.joinRoom(roomId, { name: 'P1' }, 'sock1');
    const p2 = manager.joinRoom(roomId, { name: 'P2' }, 'sock2');
    
    const room = manager.getRoom(roomId);
    expect(room.hostId).toBe(p1.id);

    manager.leaveRoom(roomId, 'sock1');
    expect(room.hostId).toBe(p2.id); // Migrates to P2
  });
  
  it('prevents joining above dynamic maxPlayers', () => {
    const roomId = manager.createRoom();
    manager.joinRoom(roomId, { name: 'P1' }, 'sock1');
    const room = manager.getRoom(roomId);
    room.settings.maxPlayers = 2; // change max players to 2

    manager.joinRoom(roomId, { name: 'P2' }, 'sock2');
    expect(() => manager.joinRoom(roomId, { name: 'P3' }, 'sock3')).toThrowError('Room is full');
  });
});
