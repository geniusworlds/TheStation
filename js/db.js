/**
 * TheStation - IndexedDB & LocalStorage Data Engine
 * Safe version: always resolves, never hangs on await.
 */

const DB_NAME = 'TheStationDB';
const DB_VERSION = 1;

class StationDB {
  constructor() {
    this.db = null;
    this.isReady = this._initWithTimeout();
  }

  // Resolves in max 3 seconds - never hangs
  _initWithTimeout() {
    return Promise.race([
      this._initDB(),
      new Promise(resolve => setTimeout(() => resolve(false), 3000))
    ]);
  }

  _initDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) { resolve(false); return; }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('scripts')) {
          const s = db.createObjectStore('scripts', { keyPath: 'id' });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('searches')) {
          const s = db.createObjectStore('searches', { keyPath: 'id' });
          s.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('tts_history')) {
          db.createObjectStore('tts_history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(true);
      };

      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
  }

  // LS helpers
  _lsGet(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
  _lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  async getAllScripts() {
    if (!this.db) return this._lsGet('ts_scripts', []);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['scripts'], 'readonly');
        tx.objectStore('scripts').getAll().onsuccess = (e) => resolve(e.target.result || []);
        tx.onerror = () => resolve(this._lsGet('ts_scripts', []));
      } catch { resolve(this._lsGet('ts_scripts', [])); }
    });
  }

  async getScriptById(id) {
    if (!this.db) return (this._lsGet('ts_scripts', [])).find(s => s.id === id) || null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['scripts'], 'readonly');
        tx.objectStore('scripts').get(id).onsuccess = (e) => resolve(e.target.result || null);
        tx.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async saveScript(script) {
    if (!script.id) script.id = 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    script.updatedAt = new Date().toISOString();
    if (!script.createdAt) script.createdAt = script.updatedAt;

    if (!this.db) {
      const arr = this._lsGet('ts_scripts', []);
      const i = arr.findIndex(s => s.id === script.id);
      if (i >= 0) arr[i] = script; else arr.push(script);
      this._lsSet('ts_scripts', arr);
      return script;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['scripts'], 'readwrite');
        tx.objectStore('scripts').put(script).onsuccess = () => resolve(script);
        tx.onerror = () => resolve(script);
      } catch { resolve(script); }
    });
  }

  async deleteScript(id) {
    if (!this.db) {
      this._lsSet('ts_scripts', this._lsGet('ts_scripts', []).filter(s => s.id !== id));
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['scripts'], 'readwrite');
        tx.objectStore('scripts').delete(id).onsuccess = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  }

  async addRecentSearch(type, query) {
    if (!query?.trim()) return;
    const item = { id: `${type}_${Date.now()}`, type, query: query.trim(), timestamp: new Date().toISOString() };
    if (!this.db) {
      let arr = this._lsGet('ts_searches', []).filter(s => !(s.type === type && s.query.toLowerCase() === query.toLowerCase()));
      arr.unshift(item); this._lsSet('ts_searches', arr.slice(0, 20)); return;
    }
    try {
      const tx = this.db.transaction(['searches'], 'readwrite');
      tx.objectStore('searches').put(item);
    } catch {}
  }

  async getRecentSearches(type, limit = 5) {
    if (!this.db) {
      return this._lsGet('ts_searches', []).filter(s => s.type === type)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['searches'], 'readonly');
        tx.objectStore('searches').getAll().onsuccess = (e) => {
          resolve((e.target.result || []).filter(s => s.type === type)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit));
        };
        tx.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  async saveTTSHistory(item) {
    if (!item.id) item.id = 'tts_' + Date.now();
    item.timestamp = new Date().toISOString();
    if (!this.db) {
      const arr = this._lsGet('ts_tts', []);
      arr.unshift(item); this._lsSet('ts_tts', arr.slice(0, 20)); return item;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['tts_history'], 'readwrite');
        tx.objectStore('tts_history').put(item).onsuccess = () => resolve(item);
        tx.onerror = () => resolve(item);
      } catch { resolve(item); }
    });
  }

  async getTTSHistory(limit = 10) {
    if (!this.db) {
      return this._lsGet('ts_tts', []).slice(0, limit);
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['tts_history'], 'readonly');
        tx.objectStore('tts_history').getAll().onsuccess = (e) => {
          const all = (e.target.result || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(all.slice(0, limit));
        };
        tx.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  async deleteTTSHistory(id) {
    if (!this.db) {
      this._lsSet('ts_tts', this._lsGet('ts_tts', []).filter(h => h.id !== id)); return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['tts_history'], 'readwrite');
        tx.objectStore('tts_history').delete(id).onsuccess = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  }

  async getSetting(key, def = null) {
    if (!this.db) return this._lsGet('ts_settings', {})[key] ?? def;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['settings'], 'readonly');
        tx.objectStore('settings').get(key).onsuccess = (e) => resolve(e.target.result ? e.target.result.value : def);
        tx.onerror = () => resolve(def);
      } catch { resolve(def); }
    });
  }

  async setSetting(key, value) {
    if (!this.db) {
      const s = this._lsGet('ts_settings', {}); s[key] = value; this._lsSet('ts_settings', s); return;
    }
    try {
      const tx = this.db.transaction(['settings'], 'readwrite');
      tx.objectStore('settings').put({ key, value });
    } catch {}
  }

  async exportFullBackup() {
    const scripts = await this.getAllScripts();
    return JSON.stringify({ appName: 'TheStation', version: '1.0.0', exportedAt: new Date().toISOString(), scripts }, null, 2);
  }

  async importFullBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.scripts)) throw new Error('ملف غير صالح');
      for (const s of data.scripts) await this.saveScript(s);
      return { success: true, count: data.scripts.length };
    } catch (e) { return { success: false, error: e.message }; }
  }
}

window.stationDB = new StationDB();
