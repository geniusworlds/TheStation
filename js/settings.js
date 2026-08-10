/**
 * TheStation - Settings Manager
 */

class SettingsManager {
  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    } else {
      this.bindEvents();
    }
  }

  bindEvents() {
    const saveApiBtn = document.getElementById('save-api-keys-btn');
    if (saveApiBtn) saveApiBtn.addEventListener('click', () => this.saveApiKeys());

    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());

    const importFile = document.getElementById('import-data-file');
    if (importFile) importFile.addEventListener('change', (e) => this.importData(e));

    const resetBtn = document.getElementById('reset-db-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetData());
  }

  async loadSettings() {
    await window.stationDB.isReady;
    const ytKey = await window.stationDB.getSetting('yt_api_key', '');
    const imgKey = await window.stationDB.getSetting('img_api_key', '');
    const ytInput = document.getElementById('setting-yt-key');
    const imgInput = document.getElementById('setting-img-key');
    if (ytInput) ytInput.value = ytKey || '';
    if (imgInput) imgInput.value = imgKey || '';
  }

  async saveApiKeys() {
    await window.stationDB.isReady;
    const ytKey = document.getElementById('setting-yt-key')?.value?.trim() || '';
    const imgKey = document.getElementById('setting-img-key')?.value?.trim() || '';
    await window.stationDB.setSetting('yt_api_key', ytKey);
    await window.stationDB.setSetting('img_api_key', imgKey);
    if (window.showToast) window.showToast('تم حفظ مفاتيح API بنجاح', 'success');
  }

  async exportData() {
    await window.stationDB.isReady;
    const json = await window.stationDB.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thestation-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      await window.stationDB.isReady;
      const result = await window.stationDB.importFullBackup(e.target.result);
      if (result.success) {
        if (window.showToast) window.showToast(`تم استيراد ${result.count} سكربت بنجاح`, 'success');
        if (window.scriptManager) window.scriptManager.loadScripts();
      } else {
        if (window.showToast) window.showToast('خطأ في استيراد النسخة: ' + result.error, 'error');
      }
    };
    reader.readAsText(file);
  }

  async resetData() {
    if (!confirm('تحذير: سيتم حذف جميع البيانات بشكل نهائي. هل أنت متأكد؟')) return;
    localStorage.clear();
    indexedDB.deleteDatabase('TheStationDB');
    if (window.showToast) window.showToast('تم مسح جميع البيانات. سيتم إعادة تحميل الصفحة...', 'info');
    setTimeout(() => location.reload(), 2000);
  }
}

window.settingsManager = new SettingsManager();
