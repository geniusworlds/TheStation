/**
 * TheStation - Settings & Data Backup Engine
 * API key configurations, JSON Database Backup/Restore, Data clearing.
 */

class SettingsManager {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
  }

  bindEvents() {
    const saveKeysBtn = document.getElementById('save-api-keys-btn');
    if (saveKeysBtn) {
      saveKeysBtn.addEventListener('click', () => this.saveApiKeys());
    }

    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBackup());
    }

    const importFileInput = document.getElementById('import-data-file');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => this.importBackup(e));
    }

    const resetBtn = document.getElementById('reset-db-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetDatabase());
    }
  }

  async loadSettings() {
    if (!window.stationDB) return;

    const ytKey = await window.stationDB.getSetting('youtube_api_key', '');
    const imgKey = await window.stationDB.getSetting('image_api_key', '');

    const ytKeyInput = document.getElementById('setting-yt-key');
    const imgKeyInput = document.getElementById('setting-img-key');

    if (ytKeyInput) ytKeyInput.value = ytKey;
    if (imgKeyInput) imgKeyInput.value = imgKey;
  }

  async saveApiKeys() {
    if (!window.stationDB) return;

    const ytKeyInput = document.getElementById('setting-yt-key');
    const imgKeyInput = document.getElementById('setting-img-key');

    const ytKey = ytKeyInput ? ytKeyInput.value.trim() : '';
    const imgKey = imgKeyInput ? imgKeyInput.value.trim() : '';

    await window.stationDB.setSetting('youtube_api_key', ytKey);
    await window.stationDB.setSetting('image_api_key', imgKey);

    if (window.showToast) window.showToast('تم حفظ إعدادات مفاتيح البرمجة API بنجاح', 'success');
  }

  async exportBackup() {
    if (!window.stationDB) return;

    const backupJson = await window.stationDB.exportFullBackup();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `TheStation_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    if (window.showToast) window.showToast('تم تصدير النسخة الاحتياطية بنجاح!', 'success');
  }

  async importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await window.stationDB.importFullBackup(e.target.result);
      if (result.success) {
        if (window.showToast) window.showToast(`تم استيراد ${result.count} سكربت بنجاح!`, 'success');
        if (window.scriptManager) window.scriptManager.loadScripts();
      } else {
        if (window.showToast) window.showToast(`خطأ في استيراد البيانات: ${result.error}`, 'danger');
      }
    };
    reader.readAsText(file);
  }

  async resetDatabase() {
    if (confirm('تنبيه: هل أنت أثق من رغبتك في مسح كافة البيانات والسكربتات نهائياً؟')) {
      indexedDB.deleteDatabase('TheStationDB');
      localStorage.clear();
      alert('تم مسح البيانات. سيتم إعادة تحميل الصفحة الآن.');
      window.location.reload();
    }
  }
}

window.settingsManager = new SettingsManager();
