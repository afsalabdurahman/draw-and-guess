export class TokenBucket {
  constructor(capacity, refillRatePerSec) {
    this.capacity = capacity;
    this.refillRate = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(amount = 1) {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      const tokensToAdd = elapsedSec * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

export class RateLimiter {
  constructor() {
    // Map of IP -> Map of Event -> TokenBucket
    this.socketLimits = new Map();
    // Map of IP -> Map of Event -> TokenBucket
    this.ipLimits = new Map();
    // Map of IP/SocketId -> Violations array (timestamps)
    this.violations = new Map();
    // Map of blocked IPs -> unblock timestamp
    this.blockedIps = new Map();
  }

  getSocketBucket(socketId, eventType, capacity, rate) {
    if (!this.socketLimits.has(socketId)) {
      this.socketLimits.set(socketId, new Map());
    }
    const limits = this.socketLimits.get(socketId);
    if (!limits.has(eventType)) {
      limits.set(eventType, new TokenBucket(capacity, rate));
    }
    return limits.get(eventType);
  }

  getIpBucket(ip, eventType, capacity, rate) {
    if (!this.ipLimits.has(ip)) {
      this.ipLimits.set(ip, new Map());
    }
    const limits = this.ipLimits.get(ip);
    if (!limits.has(eventType)) {
      limits.set(eventType, new TokenBucket(capacity, rate));
    }
    return limits.get(eventType);
  }

  recordViolation(identifier) {
    if (!this.violations.has(identifier)) {
      this.violations.set(identifier, []);
    }
    const history = this.violations.get(identifier);
    const now = Date.now();
    history.push(now);

    // Keep only last 60 seconds of violations
    while (history.length > 0 && history[0] < now - 60000) {
      history.shift();
    }

    return history.length;
  }

  blockIp(ip, durationMs) {
    this.blockedIps.set(ip, Date.now() + durationMs);
  }

  isIpBlocked(ip) {
    if (this.blockedIps.has(ip)) {
      if (Date.now() > this.blockedIps.get(ip)) {
        this.blockedIps.delete(ip);
        return false;
      }
      return true;
    }
    return false;
  }

  cleanup(socketId) {
    this.socketLimits.delete(socketId);
    this.violations.delete(socketId);
  }
}

export const rateLimiter = new RateLimiter();
