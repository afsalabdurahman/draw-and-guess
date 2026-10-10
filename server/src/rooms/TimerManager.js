export class TimerManager {
  constructor() {
    this.timers = new Map(); // roomId -> Map<timerName, timeoutId>
  }

  set(roomId, name, callback, ms) {
    this.clear(roomId, name);
    const id = setTimeout(callback, ms);
    
    if (!this.timers.has(roomId)) {
      this.timers.set(roomId, new Map());
    }
    this.timers.get(roomId).set(name, id);
  }

  clear(roomId, name) {
    if (this.timers.has(roomId)) {
      const roomTimers = this.timers.get(roomId);
      if (roomTimers.has(name)) {
        clearTimeout(roomTimers.get(name));
        roomTimers.delete(name);
      }
    }
  }

  clearAll(roomId) {
    if (this.timers.has(roomId)) {
      const roomTimers = this.timers.get(roomId);
      roomTimers.forEach(id => clearTimeout(id));
      this.timers.delete(roomId);
    }
  }
}

export const timerManager = new TimerManager();
