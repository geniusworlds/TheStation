/**
 * TheStation - Script Management & Rich Editor Engine
 */

class ScriptManager {
  constructor() {
    this.currentFilter = 'ALL';
    this.searchQuery = '';
    this.currentScript = null;
    this.autoSaveTimer = null;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Filter buttons
    document.querySelectorAll('.script-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
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
    if (newBtn) {
      newBtn.addEventListener('click', () => this.createNewScript());
    }

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
          document.execCommand('insertText', false, 'ـ');
        } else if (command === 'formatBlock') {
          document.execCommand('formatBlock', false, value);
        } else {
          document.execCommand(command, false, value);
        }

        const contentArea = document.getElementById('editor-content-area');
        if (contentArea && this.currentScript) {
          this.currentScript.content = contentArea.innerHTML;
          this.updateCounts();
          this.triggerAutoSave();
        }
      });
    });
  }

  async loadScripts() {
    this.scripts = await window.stationDB.getAllScripts();
    this.updateCounters();
    this.renderScriptsList();
  }

  updateCounters() {
    const total = this.scripts.length;
    const written = this.scripts.filter(s => s.status === 'WRITTEN').length;
    const ready = this.scripts.filter(s => s.status === 'READY').length;
    const cancelled = this.scripts.filter(s => s.status === 'CANCELLED').length;

    // Update Tab Counters
    const countAll = document.getElementById('count-all');
    const countWritten = document.getElementById('count-written');
    const countReady = document.getElementById('count-ready');
    const countCancelled = document.getElementById('count-cancelled');

    if (countAll) countAll.textContent = total;
    if (countWritten) countWritten.textContent = written;
    if (countReady) countReady.textContent = ready;
    if (countCancelled) countCancelled.textContent = cancelled;

    // Update Dashboard Cards
    const dashTotal = document.getElementById('dash-stat-total');
    const dashWritten = document.getElementById('dash-stat-written');
    const dashReady = document.getElementById('dash-stat-ready');
    const dashCancelled = document.getElementById('dash-stat-cancelled');

    if (dashTotal) dashTotal.textContent = total;
    if (dashWritten) dashWritten.textContent = written;
    if (dashReady) dashReady.textContent = ready;
    if (dashCancelled) dashCancelled.textContent = cancelled;
  }

  renderScriptsList() {
    const container = document.getElementById('scripts-list-container');
    if (!container) return;

    let filtered = [...this.scripts];

    // Filter by Status
    if (this.currentFilter !== 'ALL') {
      filtered = filtered.filter(s => s.status === this.currentFilter);
    }

    // Filter by Search
    if (this.searchQuery) {
      filtered = filtered.filter(s => {
        const titleMatch = s.title && s.title.toLowerCase().includes(this.searchQuery);
        const textContent = s.content ? s.content.replace(/<[^>]*>/g, '').toLowerCase() : '';
        return titleMatch || textContent.includes(this.searchQuery);
      });
    }

    // Sort: Pinned first, then by updatedAt descending
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
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(script => this.createScriptCardHTML(script)).join('');
  }

  createScriptCardHTML(script) {
    const plainText = script.content ? script.content.replace(/<[^>]*>/g, '').trim() : '';
    const preview = plainText.length > 120 ? plainText.substring(0, 120) + '...' : (plainText || 'لا يوجد محتوى بعد.');
    const formattedDate = this.formatRelativeTime(script.updatedAt);

    let statusBadge = '';
    if (script.status === 'READY') {
      statusBadge = `<span class="badge badge-ready">🟢 جاهز</span>`;
    } else if (script.status === 'WRITTEN') {
      statusBadge = `<span class="badge badge-written">🟡 مكتوب</span>`;
    } else {
      statusBadge = `<span class="badge badge-cancelled">🔴 ملغي</span>`;
    }

    const pinClass = script.isPinned ? 'pinned' : '';

    return `
      <div class="script-card card ${pinClass}">
        <div class="script-card-header">
          <h3 class="script-card-title">${this.escapeHTML(script.title || 'بدون عنوان')}</h3>
          <button class="btn-icon pin-btn ${pinClass}" title="${script.isPinned ? 'إلغاء التثبيت' : 'تثبيت السكربت'}" onclick="window.scriptManager.togglePin('${script.id}', event)">
            📌
          </button>
        </div>

        <div class="script-card-status">
          ${statusBadge}
          <span class="script-card-date">آخر تعديل: ${formattedDate}</span>
        </div>

        <p class="script-card-preview">${this.escapeHTML(preview)}</p>

        <div class="script-card-actions">
          <button class="btn btn-sm btn-primary" onclick="window.scriptManager.openScriptEditor('${script.id}')">
            📂 فتح السكربت
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.scriptManager.duplicateScript('${script.id}', event)" title="نسخ السكربت">
            📋 تكرار
          </button>
          <button class="btn btn-sm btn-danger-ghost" onclick="window.scriptManager.deleteScript('${script.id}', event)" title="حذف السكربت">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  async createNewScript() {
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
    const script = await window.stationDB.getScriptById(id);
    if (!script) return;

    this.currentScript = script;

    const editorTitleInput = document.getElementById('editor-title-input');
    const editorStatusSelect = document.getElementById('editor-status-select');
    const editorContentArea = document.getElementById('editor-content-area');

    if (editorTitleInput) editorTitleInput.value = script.title || '';
    if (editorStatusSelect) editorStatusSelect.value = script.status || 'WRITTEN';
    if (editorContentArea) editorContentArea.innerHTML = script.content || '';

    this.updateEditorStatusBadge();
    this.updateCounts();

    // Show Editor view, hide list view
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
    const statusSelect = document.getElementById('editor-status-select');
    const badgeContainer = document.getElementById('editor-status-badge');
    if (!statusSelect || !badgeContainer) return;

    const val = statusSelect.value;
    if (val === 'READY') {
      badgeContainer.className = 'badge badge-ready';
      badgeContainer.textContent = '🟢 جاهز';
    } else if (val === 'WRITTEN') {
      badgeContainer.className = 'badge badge-written';
      badgeContainer.textContent = '🟡 مكتوب';
    } else {
      badgeContainer.className = 'badge badge-cancelled';
      badgeContainer.textContent = '🔴 ملغي';
    }
  }

  updateCounts() {
    const contentArea = document.getElementById('editor-content-area');
    if (!contentArea) return;

    const plainText = contentArea.innerText || contentArea.textContent || '';
    const charCount = plainText.length;
    const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    const readingTimeMinutes = Math.ceil(words / 130);

    const charCounterEl = document.getElementById('editor-char-count');
    const wordCounterEl = document.getElementById('editor-word-count');
    const timeCounterEl = document.getElementById('editor-read-time');

    if (charCounterEl) charCounterEl.textContent = `${charCount} حرف`;
    if (wordCounterEl) wordCounterEl.textContent = `${words} كلمة`;
    if (timeCounterEl) timeCounterEl.textContent = `~ ${readingTimeMinutes} دقيقة قراءة`;
  }

  triggerAutoSave() {
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) indicator.textContent = 'جاري الحفظ...';

    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.triggerAutoSaveNow();
    }, 1000);
  }

  async triggerAutoSaveNow() {
    if (!this.currentScript) return;
    await window.stationDB.saveScript(this.currentScript);
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) indicator.textContent = 'تم الحفظ تلقائياً ✓';
  }

  async togglePin(id, event) {
    if (event) event.stopPropagation();
    const script = await window.stationDB.getScriptById(id);
    if (script) {
      script.isPinned = !script.isPinned;
      await window.stationDB.saveScript(script);
      await this.loadScripts();
    }
  }

  async duplicateScript(id, event) {
    if (event) event.stopPropagation();
    const script = await window.stationDB.getScriptById(id);
    if (script) {
      const copy = {
        title: (script.title || 'سكربت') + ' (نسخة)',
        content: script.content,
        status: script.status,
        isPinned: false,
        audioUrl: script.audioUrl
      };
      await window.stationDB.saveScript(copy);
      await this.loadScripts();
      if (window.showToast) window.showToast('تم نسخ السكربت بنجاح', 'success');
    }
  }

  async deleteScript(id, event) {
    if (event) event.stopPropagation();
    if (confirm('هل أنت تأكد من رغبتك في حذف هذا السكربت؟')) {
      await window.stationDB.deleteScript(id);
      await this.loadScripts();
      if (window.showToast) window.showToast('تم حذف السكربت', 'info');
    }
  }

  copyCurrentScriptText() {
    const contentArea = document.getElementById('editor-content-area');
    if (!contentArea) return;
    const plainText = contentArea.innerText || contentArea.textContent || '';
    navigator.clipboard.writeText(plainText).then(() => {
      if (window.showToast) window.showToast('تم نسخ نص السكربت إلى الحافظة', 'success');
    });
  }

  formatRelativeTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'منذ لحظات';
    if (diffSeconds < 3600) return `منذ ${Math.floor(diffSeconds / 60)} دقيقة`;
    if (diffSeconds < 86400) return `منذ ${Math.floor(diffSeconds / 3600)} ساعة`;
    if (diffSeconds < 604800) return `منذ ${Math.floor(diffSeconds / 86400)} يوم`;
    return date.toLocaleDateString('ar-SA');
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.scriptManager = new ScriptManager();
