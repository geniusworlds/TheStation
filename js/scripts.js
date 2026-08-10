/**
 * TheStation - Script Management & Rich Editor Engine
 */

class ScriptManager {
  constructor() {
    this.currentFilter = 'ALL';
    this.searchQuery = '';
    this.currentScript = null;
    this.autoSaveTimer = null;
    this.scripts = [];
    this._domReady(() => this.bindEvents());
  }

  _domReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  bindEvents() {
    document.querySelectorAll('.script-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.script-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderScriptsList();
      });
    });

    const searchInput = document.getElementById('script-search-input');
    if (searchInput) searchInput.addEventListener('input', (e) => { this.searchQuery = e.target.value.toLowerCase().trim(); this.renderScriptsList(); });

    const newBtn = document.getElementById('create-script-btn');
    if (newBtn) newBtn.addEventListener('click', () => this.createNewScript());

    const statusSelect = document.getElementById('editor-status-select');
    if (statusSelect) statusSelect.addEventListener('change', () => { if (this.currentScript) { this.currentScript.status = statusSelect.value; this.triggerAutoSave(); this.updateEditorStatusBadge(); } });

    const titleInput = document.getElementById('editor-title-input');
    if (titleInput) titleInput.addEventListener('input', () => { if (this.currentScript) { this.currentScript.title = titleInput.value; this.triggerAutoSave(); } });

    const contentArea = document.getElementById('editor-content-area');
    if (contentArea) contentArea.addEventListener('input', () => { if (this.currentScript) { this.currentScript.content = contentArea.innerHTML; this.updateCounts(); this.triggerAutoSave(); } });

    document.querySelectorAll('.editor-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd, val = btn.dataset.val || null;
        if (cmd === 'insertTatweel') document.execCommand('insertText', false, '\u0640');
        else if (cmd === 'formatBlock') document.execCommand('formatBlock', false, val);
        else document.execCommand(cmd, false, val);
        const ca = document.getElementById('editor-content-area');
        if (ca && this.currentScript) { this.currentScript.content = ca.innerHTML; this.updateCounts(); this.triggerAutoSave(); }
      });
    });
  }

  async loadScripts() {
    const container = document.getElementById('scripts-list-container');
    if (container) container.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
    try {
      this.scripts = await Promise.race([
        window.stationDB.getAllScripts(),
        new Promise(resolve => setTimeout(() => resolve([]), 5000))
      ]);
    } catch { this.scripts = []; }
    this.updateCounters();
    this.renderScriptsList();
  }

  updateCounters() {
    const t = this.scripts.length;
    const w = this.scripts.filter(s => s.status === 'WRITTEN').length;
    const r = this.scripts.filter(s => s.status === 'READY').length;
    const c = this.scripts.filter(s => s.status === 'CANCELLED').length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('count-all', t); set('count-written', w); set('count-ready', r); set('count-cancelled', c);
    set('dash-stat-total', t); set('dash-stat-written', w); set('dash-stat-ready', r); set('dash-stat-cancelled', c);
  }

  renderScriptsList() {
    const container = document.getElementById('scripts-list-container');
    if (!container) return;
    let filtered = [...this.scripts];
    if (this.currentFilter !== 'ALL') filtered = filtered.filter(s => s.status === this.currentFilter);
    if (this.searchQuery) filtered = filtered.filter(s => (s.title || '').toLowerCase().includes(this.searchQuery) || (s.content || '').replace(/<[^>]*>/g, '').toLowerCase().includes(this.searchQuery));
    filtered.sort((a, b) => { if (a.isPinned && !b.isPinned) return -1; if (!a.isPinned && b.isPinned) return 1; return new Date(b.updatedAt) - new Date(a.updatedAt); });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state card"><div class="empty-icon">📝</div><h3>لا توجد سكربتات</h3><p>اضغط على زر إنشاء سكربت جديد للبدء.</p><button class="btn btn-primary" onclick="window.scriptManager.createNewScript()">+ إنشاء سكربت جديد</button></div>`;
      return;
    }
    container.innerHTML = filtered.map(s => this._cardHTML(s)).join('');
  }

  _cardHTML(s) {
    const txt = (s.content || '').replace(/<[^>]*>/g, '').trim();
    const preview = txt.length > 120 ? txt.substring(0, 120) + '...' : (txt || 'لا يوجد محتوى.');
    const badge = s.status === 'READY' ? '<span class="badge badge-ready">🟢 جاهز</span>' : s.status === 'WRITTEN' ? '<span class="badge badge-written">🟡 مكتوب</span>' : '<span class="badge badge-cancelled">🔴 ملغي</span>';
    return `<div class="script-card card ${s.isPinned ? 'pinned' : ''}">
      <div class="script-card-header"><h3 class="script-card-title">${this.esc(s.title || 'بدون عنوان')}</h3>
      <button class="btn-icon pin-btn" onclick="window.scriptManager.togglePin('${s.id}',event)">📌</button></div>
      <div class="script-card-status">${badge}<span class="script-card-date">${this.relTime(s.updatedAt)}</span></div>
      <p class="script-card-preview">${this.esc(preview)}</p>
      <div class="script-card-actions">
        <button class="btn btn-sm btn-primary" onclick="window.scriptManager.openScriptEditor('${s.id}')"> 📂 فتح</button>
        <button class="btn btn-sm btn-secondary" onclick="window.scriptManager.duplicateScript('${s.id}',event)">📋 تكرار</button>
        <button class="btn btn-sm btn-danger-ghost" onclick="window.scriptManager.deleteScript('${s.id}',event)">🗑️</button>
      </div></div>`;
  }

  async createNewScript() {
    const saved = await window.stationDB.saveScript({ title: 'سكربت جديد', content: '<p>اكتب هنا...</p>', status: 'WRITTEN', isPinned: false, audioUrl: null });
    await this.loadScripts();
    this.openScriptEditor(saved.id);
    if (window.showToast) window.showToast('تم إنشاء السكربت بنجاح', 'success');
  }

  async openScriptEditor(id) {
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
    const m = { READY: ['badge badge-ready', '🟢 جاهز'], WRITTEN: ['badge badge-written', '🟡 مكتوب'], CANCELLED: ['badge badge-cancelled', '🔴 ملغي'] };
    const [cls, txt] = m[s.value] || m.WRITTEN;
    b.className = cls; b.textContent = txt;
  }

  updateCounts() {
    const c = document.getElementById('editor-content-area');
    if (!c) return;
    const txt = c.innerText || '';
    const words = txt.trim() ? txt.trim().split(/\s+/).length : 0;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('editor-char-count', `${txt.length} حرف`);
    set('editor-word-count', `${words} كلمة`);
    set('editor-read-time', `~ ${Math.ceil(words / 130)} دقيقة`);
  }

  triggerAutoSave() {
    const i = document.getElementById('autosave-indicator');
    if (i) i.textContent = 'جاري الحفظ...';
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.triggerAutoSaveNow(), 1200);
  }

  async triggerAutoSaveNow() {
    if (!this.currentScript) return;
    await window.stationDB.saveScript(this.currentScript);
    const i = document.getElementById('autosave-indicator');
    if (i) i.textContent = 'تم الحفظ ✓';
  }

  async togglePin(id, e) {
    if (e) e.stopPropagation();
    const s = await window.stationDB.getScriptById(id);
    if (s) { s.isPinned = !s.isPinned; await window.stationDB.saveScript(s); await this.loadScripts(); }
  }

  async duplicateScript(id, e) {
    if (e) e.stopPropagation();
    const s = await window.stationDB.getScriptById(id);
    if (s) { await window.stationDB.saveScript({ title: (s.title || 'سكربت') + ' (نسخة)', content: s.content, status: s.status, isPinned: false }); await this.loadScripts(); if (window.showToast) window.showToast('تم التكرار بنجاح', 'success'); }
  }

  async deleteScript(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('حذف هذا السكربت؟')) return;
    await window.stationDB.deleteScript(id);
    await this.loadScripts();
    if (window.showToast) window.showToast('تم الحذف', 'info');
  }

  copyCurrentScriptText() {
    const c = document.getElementById('editor-content-area');
    if (c) navigator.clipboard.writeText(c.innerText || '').then(() => { if (window.showToast) window.showToast('تم النسخ', 'success'); });
  }

  relTime(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (d < 60) return 'منذ لحظات';
    if (d < 3600) return `منذ ${Math.floor(d/60)} دقيقة`;
    if (d < 86400) return `منذ ${Math.floor(d/3600)} ساعة`;
    return `منذ ${Math.floor(d/86400)} يوم`;
  }

  esc(str) {
    return String(str || '').replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
  }

  // alias for compatibility
  escapeHTML(str) { return this.esc(str); }
  formatRelativeTime(iso) { return this.relTime(iso); }
}

window.scriptManager = new ScriptManager();
