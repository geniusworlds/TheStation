/**
 * TheStation - Script Management & Rich Editor Engine
 */

class ScriptManager {
  constructor() {
    this.currentFilter = 'ALL';
    this.searchQuery = '';
    this.currentScript = null;
    this.autoSaveTimer = null;
    // Fix: wait for DOM before binding events
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    } else {
      this.bindEvents();
    }
  }

  bindEvents() {
    // Filter buttons
    document.querySelectorAll('.script-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.script-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderScriptsList();
      });
    });

    // Search input
    const searchInput = document.getElementById('script-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderScriptsList();
      });
    }

    // New Script Button
    const newBtn = document.getElementById('create-script-btn');
    if (newBtn) newBtn.addEventListener('click', () => this.createNewScript());

    // Editor Status Change
    const statusSelect = document.getElementById('editor-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        if (this.currentScript) {
          this.currentScript.status = statusSelect.value;
          this.triggerAutoSave();
          this.updateEditorStatusBadge();
        }
      });
    }

    // Editor Title Change
    const titleInput = document.getElementById('editor-title-input');
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        if (this.currentScript) {
          this.currentScript.title = titleInput.value;
          this.triggerAutoSave();
        }
      });
    }

    // Editor Content Area
    const contentArea = document.getElementById('editor-content-area');
    if (contentArea) {
      contentArea.addEventListener('input', () => {
        if (this.currentScript) {
          this.currentScript.content = contentArea.innerHTML;
          this.updateCounts();
          this.triggerAutoSave();
        }
      });
    }

    // Toolbar formatting buttons
    document.querySelectorAll('.editor-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.cmd;
        const value = btn.dataset.val || null;

        if (command === 'insertTatweel') {
          document.execCommand('insertText', false, '\u0640');
        } else if (command === 'formatBlock') {
          document.execCommand('formatBlock', false, value);
        } else {
          document.execCommand(command, false, value);
        }

        const ca = document.getElementById('editor-content-area');
        if (ca && this.currentScript) {
          this.currentScript.content = ca.innerHTML;
          this.updateCounts();
          this.triggerAutoSave();
        }
      });
    });
  }

  async loadScripts() {
    await window.stationDB.isReady;
    this.scripts = await window.stationDB.getAllScripts();
    this.updateCounters();
    this.renderScriptsList();
  }

  updateCounters() {
    const total = this.scripts.length;
    const written = this.scripts.filter(s => s.status === 'WRITTEN').length;
    const ready = this.scripts.filter(s => s.status === 'READY').length;
    const cancelled = this.scripts.filter(s => s.status === 'CANCELLED').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('count-all', total); set('count-written', written);
    set('count-ready', ready); set('count-cancelled', cancelled);
    set('dash-stat-total', total); set('dash-stat-written', written);
    set('dash-stat-ready', ready); set('dash-stat-cancelled', cancelled);
  }

  renderScriptsList() {
    const container = document.getElementById('scripts-list-container');
    if (!container) return;

    let filtered = [...(this.scripts || [])];
    if (this.currentFilter !== 'ALL') filtered = filtered.filter(s => s.status === this.currentFilter);
    if (this.searchQuery) {
      filtered = filtered.filter(s => {
        const titleMatch = s.title && s.title.toLowerCase().includes(this.searchQuery);
        const textContent = s.content ? s.content.replace(/<[^>]*>/g, '').toLowerCase() : '';
        return titleMatch || textContent.includes(this.searchQuery);
      });
    }
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-icon">📝</div>
          <h3>لم يتم العثور على أي سكربت</h3>
          <p>يمكنك إنشاء سكربت جديد بالضغط على زر "إنشاء سكربت جديد" أعلاه.</p>
          <button class="btn btn-primary" onclick="window.scriptManager.createNewScript()">+ إنشاء سكربت جديد</button>
        </div>`;
      return;
    }
    container.innerHTML = filtered.map(s => this.createScriptCardHTML(s)).join('');
  }

  createScriptCardHTML(script) {
    const plainText = script.content ? script.content.replace(/<[^>]*>/g, '').trim() : '';
    const preview = plainText.length > 120 ? plainText.substring(0, 120) + '...' : (plainText || 'لا يوجد محتوى بعد.');
    const formattedDate = this.formatRelativeTime(script.updatedAt);
    let statusBadge = '';
    if (script.status === 'READY') statusBadge = `<span class="badge badge-ready">🟢 جاهز</span>`;
    else if (script.status === 'WRITTEN') statusBadge = `<span class="badge badge-written">🟡 مكتوب</span>`;
    else statusBadge = `<span class="badge badge-cancelled">🔴 ملغي</span>`;
    const pinClass = script.isPinned ? 'pinned' : '';
    return `
      <div class="script-card card ${pinClass}">
        <div class="script-card-header">
          <h3 class="script-card-title">${this.escapeHTML(script.title || 'بدون عنوان')}</h3>
          <button class="btn-icon pin-btn ${pinClass}" title="${script.isPinned ? 'إلغاء التثبيت' : 'تثبيت السكربت'}" onclick="window.scriptManager.togglePin('${script.id}', event)">📌</button>
        </div>
        <div class="script-card-status">${statusBadge}<span class="script-card-date">آخر تعديل: ${formattedDate}</span></div>
        <p class="script-card-preview">${this.escapeHTML(preview)}</p>
        <div class="script-card-actions">
          <button class="btn btn-sm btn-primary" onclick="window.scriptManager.openScriptEditor('${script.id}')"> 📂 فتح السكربت</button>
          <button class="btn btn-sm btn-secondary" onclick="window.scriptManager.duplicateScript('${script.id}', event)">📋 تكرار</button>
          <button class="btn btn-sm btn-danger-ghost" onclick="window.scriptManager.deleteScript('${script.id}', event)">🗑️</button>
        </div>
      </div>`;
  }

  async createNewScript() {
    await window.stationDB.isReady;
    const newScript = {
      title: 'سكربت جديد',
      content: '<p>اكتب هنا محتوى السكربت الجديد...</p>',
      status: 'WRITTEN',
      isPinned: false,
      audioUrl: null
    };
    const saved = await window.stationDB.saveScript(newScript);
    await this.loadScripts();
    this.openScriptEditor(saved.id);
    if (window.showToast) window.showToast('تم إنشاء السكربت بنجاح', 'success');
  }

  async openScriptEditor(id) {
    await window.stationDB.isReady;
    const script = await window.stationDB.getScriptById(id);
    if (!script) return;
    this.currentScript = script;
    const t = document.getElementById('editor-title-input');
    const s = document.getElementById('editor-status-select');
    const c = document.getElementById('editor-content-area');
    if (t) t.value = script.title || '';
    if (s) s.value = script.status || 'WRITTEN';
    if (c) c.innerHTML = script.content || '';
    this.updateEditorStatusBadge();
    this.updateCounts();
    document.getElementById('scripts-list-view').style.display = 'none';
    document.getElementById('script-editor-view').style.display = 'block';
  }

  closeEditor() {
    this.triggerAutoSaveNow();
    document.getElementById('script-editor-view').style.display = 'none';
    document.getElementById('scripts-list-view').style.display = 'block';
    this.loadScripts();
  }

  updateEditorStatusBadge() {
    const s = document.getElementById('editor-status-select');
    const b = document.getElementById('editor-status-badge');
    if (!s || !b) return;
    const map = { READY: ['badge badge-ready', '🟢 جاهز'], WRITTEN: ['badge badge-written', '🟡 مكتوب'], CANCELLED: ['badge badge-cancelled', '🔴 ملغي'] };
    const [cls, text] = map[s.value] || map['WRITTEN'];
    b.className = cls; b.textContent = text;
  }

  updateCounts() {
    const c = document.getElementById('editor-content-area');
    if (!c) return;
    const plainText = c.innerText || c.textContent || '';
    const chars = plainText.length;
    const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('editor-char-count', `${chars} حرف`);
    set('editor-word-count', `${words} كلمة`);
    set('editor-read-time', `~ ${Math.ceil(words / 130)} دقيقة قراءة`);
  }

  triggerAutoSave() {
    const ind = document.getElementById('autosave-indicator');
    if (ind) ind.textContent = 'جاري الحفظ...';
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.triggerAutoSaveNow(), 1000);
  }

  async triggerAutoSaveNow() {
    if (!this.currentScript) return;
    await window.stationDB.saveScript(this.currentScript);
    const ind = document.getElementById('autosave-indicator');
    if (ind) ind.textContent = 'تم الحفظ تلقائياً ✓';
  }

  async togglePin(id, event) {
    if (event) event.stopPropagation();
    const script = await window.stationDB.getScriptById(id);
    if (script) { script.isPinned = !script.isPinned; await window.stationDB.saveScript(script); await this.loadScripts(); }
  }

  async duplicateScript(id, event) {
    if (event) event.stopPropagation();
    const script = await window.stationDB.getScriptById(id);
    if (script) {
      await window.stationDB.saveScript({ title: (script.title || 'سكربت') + ' (نسخة)', content: script.content, status: script.status, isPinned: false, audioUrl: script.audioUrl });
      await this.loadScripts();
      if (window.showToast) window.showToast('تم نسخ السكربت بنجاح', 'success');
    }
  }

  async deleteScript(id, event) {
    if (event) event.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا السكربت؟')) {
      await window.stationDB.deleteScript(id);
      await this.loadScripts();
      if (window.showToast) window.showToast('تم حذف السكربت', 'info');
    }
  }

  copyCurrentScriptText() {
    const c = document.getElementById('editor-content-area');
    if (!c) return;
    navigator.clipboard.writeText(c.innerText || c.textContent || '').then(() => {
      if (window.showToast) window.showToast('تم نسخ نص السكربت إلى الحافظة', 'success');
    });
  }

  formatRelativeTime(isoString) {
    if (!isoString) return '';
    const diff = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (diff < 60) return 'منذ لحظات';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
    return new Date(isoString).toLocaleDateString('ar-SA');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
}

window.scriptManager = new ScriptManager();
