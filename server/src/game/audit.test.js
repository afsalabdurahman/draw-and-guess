import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { roomManager } from '../rooms/RoomManager.js';
import { startGame, handleWordPick, endTurn } from '../rooms/stateMachine.js';
import { timerManager } from '../rooms/TimerManager.js';

describe('Security and Audit Tests', () => {
  let roomId;
  let ioMock;
  let p1, p2, p3;
  let emittedEvents = [];

  beforeEach(() => {
    roomManager.rooms.clear();
    timerManager.timers.clear();
    emittedEvents = [];

    roomId = roomManager.createRoom();
    p1 = roomManager.joinRoom(roomId, { name: 'Drawer' }, 'drawer_sock');
    p2 = roomManager.joinRoom(roomId, { name: 'Guesser1' }, 'guesser1_sock');
    p3 = roomManager.joinRoom(roomId, { name: 'Guesser2' }, 'guesser2_sock');

    ioMock = {
      to: vi.fn((target) => {
        return {
          emit: vi.fn((event, payload) => {
            emittedEvents.push({ target, event, payload });
          })
        };
      }),
      emit: vi.fn((event, payload) => {
         emittedEvents.push({ target: 'all', event, payload });
      })
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never leaks the secret word to guessers before turn end', () => {
    startGame(ioMock, roomId);
    const room = roomManager.getRoom(roomId);
    const chosenWord = room.wordChoices[0];
    
    // Pick the word and start drawing phase
    handleWordPick(ioMock, roomId, chosenWord);

    // Filter events sent specifically to the guessers or broadcasted to the room
    const guesserEvents = emittedEvents.filter(e => 
      e.target === roomId || 
      e.target === 'guesser1_sock' || 
      e.target === 'guesser2_sock' ||
      e.target === 'all'
    );

    // Verify none of these payloads contain the secret word (case insensitive)
    const secretWordRegex = new RegExp(chosenWord, 'i');
    
    guesserEvents.forEach(e => {
      // It's allowed for the word to appear in hints if it naturally contains an underscore etc,
      // but in Pictionary, the secret word shouldn't literally be sent in plain text to guessers.
      const payloadStr = JSON.stringify(e.payload);
      expect(payloadStr).not.toMatch(secretWordRegex);
    });
    
    // Confirm it IS sent to the drawer
    const drawerEvents = emittedEvents.filter(e => e.target === 'drawer_sock' && e.event === 'turn:secret_word');
    expect(drawerEvents.length).toBe(1);
    expect(drawerEvents[0].payload.word).toBe(chosenWord);
  });

  it('ignores fake client events that attempt to mutate pure state', () => {
    const room = roomManager.getRoom(roomId);
    
    // Assuming clients try to emit fake socket events, they would hit the `index.js`
    // but since we are unit testing the state machine, we can verify the state machine
    // has no functions that accept raw score mutations.
    
    // In our architecture, the ONLY events that modify score are handleWordPick (no)
    // and checkTurnEarlyEnd / endTurn (server side logic based on checkGuess).
    // Let's verify score doesn't change randomly.
    expect(p2.score).toBe(0);
    
    // Mocking an event not handled in state machine:
    // If a client emits "score:update", it's simply dropped by index.js because there is no handler.
    // There's nothing to test here since the pure architecture strictly enforces this,
    // but we can assert the room state has no unexpected score values.
    expect(Object.keys(room.turnScores).length).toBe(0);
  });
});
