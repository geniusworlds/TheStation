/**
 * TheStation - IndexedDB & LocalStorage Data Engine
 * Handles persistent storage for Scripts, Searches, TTS History, and Settings.
 */

const DB_NAME = 'TheStationDB';
const DB_VERSION = 1;

class StationDB {
  constructor() {
    this.db = null;
    this.isReady = this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to LocalStorage');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Scripts Store
        if (!db.objectStoreNames.contains('scripts')) {
          const scriptStore = db.createObjectStore('scripts', { keyPath: 'id' });
          scriptStore.createIndex('status', 'status', { unique: false });
          scriptStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          scriptStore.createIndex('isPinned', 'isPinned', { unique: false });
        }

        // Recent Searches Store
        if (!db.objectStoreNames.contains('searches')) {
          const searchStore = db.createObjectStore('searches', { keyPath: 'id' });
          searchStore.createIndex('type', 'type', { unique: false });
          searchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // TTS History Store
        if (!db.objectStoreNames.contains('tts_history')) {
          const ttsStore = db.createObjectStore('tts_history', { keyPath: 'id' });
          ttsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.seedInitialData().then(() => resolve(true));
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        resolve(false);
      };
    });
  }

  async seedInitialData() {
    const scripts = await this.getAllScripts();
    if (scripts.length === 0) {
      const initialScripts = [
        {
          id: 'script_sample_1',
          title: 'مراجعة وتقييم أحدث تحديثات لعبة FC 26',
          content: '<h2>مقدمة الفيديو</h2><p>أهلاً بكم يا شباب في هذا الفيديو الجديد على قناة ذا ستيشن! اليوم نلقي نظرة شاملة على أبرز التحديثات والتغييرات الجديدة في لعبة FC 26...</p><h3>أهم النقاط</h3><ul><li>تحسين أسلوب اللعب والحركة</li><li>تطوير طور المهنة (Career Mode)</li><li>إضافة الملاعب العربية الجديدة</li></ul><p>لا تنسوا الاشتراك في القناة وتفعيل زر الجرس ليصلكم كل جديد!</p>',
          status: 'READY', // READY = 🟢 جاهز
          isPinned: true,
          audioUrl: null,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'script_sample_2',
          title: 'ملخص وثائقي: تاريخ الألعاب الإلكترونية في السعودية',
          content: '<h2>الفصل الأول: البدايات</h2><p>شهدت المملكة العربية السعودية طفرة هائلة في عالم الألعاب الإلكترونية والرياضات الرقمية خلال السنوات الأخيرة...</p><p>نستعرض في هذا السكربت محطات التحول الرئيسية والبطولات العالمية التي استضافتها الرياض.</p>',
          status: 'WRITTEN', // WRITTEN = 🟡 مكتوب
          isPinned: false,
          audioUrl: null,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          id: 'script_sample_3',
          title: 'فيديو تجريبي ملغي - تغطية مؤتمر التكنولوجيا',
          content: '<p>مسودة سابقة لتغطية مؤتمر التكنولوجيا، تم إلغاء السكربت واستبداله بالتغطية الحية.</p>',
          status: 'CANCELLED', // CANCELLED = 🔴 ملغي
          isPinned: false,
          audioUrl: null,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        }
      ];

      for (const script of initialScripts) {
        await this.saveScript(script);
      }
    }
  }

  // --- SCRIPTS STORAGE ---
  async getAllScripts() {
    await this.isReady;
    if (!this.db) return JSON.parse(localStorage.getItem('ts_scripts') || '[]');

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['scripts'], 'readonly');
      const store = transaction.objectStore('scripts');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve(JSON.parse(localStorage.getItem('ts_scripts') || '[]'));
    });
  }

  async getScriptById(id) {
    await this.isReady;
    if (!this.db) {
      const scripts = JSON.parse(localStorage.getItem('ts_scripts') || '[]');
      return scripts.find(s => s.id === id) || null;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['scripts'], 'readonly');
      const store = transaction.objectStore('scripts');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async saveScript(script) {
    await this.isReady;
    if (!script.id) script.id = 'script_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    script.updatedAt = new Date().toISOString();
    if (!script.createdAt) script.createdAt = script.updatedAt;

    if (!this.db) {
      const scripts = JSON.parse(localStorage.getItem('ts_scripts') || '[]');
      const index = scripts.findIndex(s => s.id === script.id);
      if (index >= 0) scripts[index] = script;
      else scripts.push(script);
      localStorage.setItem('ts_scripts', JSON.stringify(scripts));
      return script;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scripts'], 'readwrite');
      const store = transaction.objectStore('scripts');
      const request = store.put(script);

      request.onsuccess = () => resolve(script);
      request.onerror = (e) => reject(e);
    });
  }

  async deleteScript(id) {
    await this.isReady;
    if (!this.db) {
      let scripts = JSON.parse(localStorage.getItem('ts_scripts') || '[]');
      scripts = scripts.filter(s => s.id !== id);
      localStorage.setItem('ts_scripts', JSON.stringify(scripts));
      return true;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['scripts'], 'readwrite');
      const store = transaction.objectStore('scripts');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  // --- RECENT SEARCHES STORAGE ---
  async addRecentSearch(type, query) {
    if (!query || !query.trim()) return;
    query = query.trim();
    await this.isReady;

    const searchItem = {
      id: `${type}_${Date.now()}`,
      type, // 'youtube' or 'image'
      query,
      timestamp: new Date().toISOString()
    };

    if (!this.db) {
      let searches = JSON.parse(localStorage.getItem('ts_searches') || '[]');
      searches = searches.filter(s => !(s.type === type && s.query.toLowerCase() === query.toLowerCase()));
      searches.unshift(searchItem);
      searches = searches.slice(0, 10);
      localStorage.setItem('ts_searches', JSON.stringify(searches));
      return;
    }

    const transaction = this.db.transaction(['searches'], 'readwrite');
    const store = transaction.objectStore('searches');
    store.put(searchItem);
  }

  async getRecentSearches(type, limit = 5) {
    await this.isReady;
    if (!this.db) {
      const searches = JSON.parse(localStorage.getItem('ts_searches') || '[]');
      return searches
        .filter(s => s.type === type)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['searches'], 'readonly');
      const store = transaction.objectStore('searches');
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        const filtered = all
          .filter(s => s.type === type)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit);
        resolve(filtered);
      };
      request.onerror = () => resolve([]);
    });
  }

  // --- TTS HISTORY STORAGE ---
  async saveTTSHistory(item) {
    await this.isReady;
    if (!item.id) item.id = 'tts_' + Date.now();
    item.timestamp = new Date().toISOString();

    if (!this.db) {
      const history = JSON.parse(localStorage.getItem('ts_tts_history') || '[]');
      history.unshift(item);
      localStorage.setItem('ts_tts_history', JSON.stringify(history.slice(0, 20)));
      return item;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['tts_history'], 'readwrite');
      const store = transaction.objectStore('tts_history');
      store.put(item);
      resolve(item);
    });
  }

  async getTTSHistory(limit = 10) {
    await this.isReady;
    if (!this.db) {
      const history = JSON.parse(localStorage.getItem('ts_tts_history') || '[]');
      return history.slice(0, limit);
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['tts_history'], 'readonly');
      const store = transaction.objectStore('tts_history');
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(all.slice(0, limit));
      };
      request.onerror = () => resolve([]);
    });
  }

  async deleteTTSHistory(id) {
    await this.isReady;
    if (!this.db) {
      let history = JSON.parse(localStorage.getItem('ts_tts_history') || '[]');
      history = history.filter(h => h.id !== id);
      localStorage.setItem('ts_tts_history', JSON.stringify(history));
      return true;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['tts_history'], 'readwrite');
      const store = transaction.objectStore('tts_history');
      store.delete(id);
      resolve(true);
    });
  }

  // --- SETTINGS STORAGE ---
  async getSetting(key, defaultValue = null) {
    await this.isReady;
    if (!this.db) {
      const settings = JSON.parse(localStorage.getItem('ts_settings') || '{}');
      return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ? request.result.value : defaultValue);
      request.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    await this.isReady;
    if (!this.db) {
      const settings = JSON.parse(localStorage.getItem('ts_settings') || '{}');
      settings[key] = value;
      localStorage.setItem('ts_settings', JSON.stringify(settings));
      return;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      store.put({ key, value });
      resolve();
    });
  }

  // --- EXPORT / IMPORT BACKUP ---
  async exportFullBackup() {
    const scripts = await this.getAllScripts();
    const searches = await this.getRecentSearches('youtube', 50);
    const imageSearches = await this.getRecentSearches('image', 50);
    const ttsHistory = await this.getTTSHistory(50);

    const backupData = {
      appName: 'TheStation',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      scripts,
      searches: [...searches, ...imageSearches],
      ttsHistory
    };

    return JSON.stringify(backupData, null, 2);
  }

  async importFullBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.scripts || !Array.isArray(data.scripts)) {
        throw new Error('ملف النسخة الاحتياطية غير صالح.');
      }

      for (const script of data.scripts) {
        await this.saveScript(script);
      }

      if (data.ttsHistory && Array.isArray(data.ttsHistory)) {
        for (const tts of data.ttsHistory) {
          await this.saveTTSHistory(tts);
        }
      }

      return { success: true, count: data.scripts.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

window.stationDB = new StationDB();
