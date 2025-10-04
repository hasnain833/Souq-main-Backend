// Simple in-memory TTL cache with LRU-ish eviction
// Not suitable for multi-instance clustering; for serverless or single node it helps reduce repeated reads.

class TTLCache {
  constructor({ max = 500, ttlMs = 90_000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  _now() {
    return Date.now();
  }

  get(key) {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (item.expiresAt < this._now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency: delete and set again
    this.map.delete(key);
    this.map.set(key, item);
    return item.value;
  }

  set(key, value, ttlOverrideMs) {
    const expiresAt = this._now() + (ttlOverrideMs ?? this.ttlMs);
    // Evict if over capacity (delete oldest)
    if (this.map.size >= this.max) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(key, { value, expiresAt });
  }

  del(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

// Create a shared singleton to be reused across modules/process lifetime
const globalKey = '__souq_ttl_cache__';
if (!global[globalKey]) {
  global[globalKey] = new TTLCache({ max: 1000, ttlMs: 90_000 });
}

module.exports = global[globalKey];
