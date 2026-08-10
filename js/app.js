/**
 * TheStation - Main Application Controller
 */

class StationApp {
  constructor() {
    this.currentTab = 'dashboard';
    this._domReady(() => this._init());
  }

  _domReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  _init() {
    this._bindNav();
    this._bindDash();
    this._loadInitial();
  }

  _bindNav() {
    // Sidebar + mobile bottom nav
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        if (tab) { this.switchTab(tab); this._closeDrawer(); }
      });
    });

    const toggle = document.getElementById('mobile-drawer-toggle');
    const close = document.getElementById('mobile-drawer-close');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (toggle) toggle.addEventListener('click', () => this._openDrawer());
    if (close) close.addEventListener('click', () => this._closeDrawer());
    if (backdrop) backdrop.addEventListener('click', () => this._closeDrawer());
  }

  _bindDash() {
    document.querySelectorAll('.stat-card[data-filter]').forEach(card => {
      card.addEventListener('click', () => {
        this.switchTab('scripts');
        const btn = document.querySelector(`.script-filter-btn[data-filter="${card.dataset.filter}"]`);
        if (btn) btn.click();
      });
    });

    const qns = document.getElementById('quick-action-new-script');
    const qyt = document.getElementById('quick-action-yt');
    const qim = document.getElementById('quick-action-img');
    const qtt = document.getElementById('quick-action-tts');
    if (qns) qns.addEventListener('click', () => { this.switchTab('scripts'); if (window.scriptManager) window.scriptManager.createNewScript(); });
    if (qyt) qyt.addEventListener('click', () => this.switchTab('youtube'));
    if (qim) qim.addEventListener('click', () => this.switchTab('images'));
    if (qtt) qtt.addEventListener('click', () => this.switchTab('tts'));
  }

  switchTab(name) {
    this.currentTab = name;
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === name));
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    const view = document.getElementById(`view-${name}`);
    if (view) view.style.display = 'block';

    if (name === 'dashboard') this._loadDash();
    else if (name === 'scripts' && window.scriptManager) window.scriptManager.loadScripts();
    else if (name === 'youtube' && window.youtubeTool) window.youtubeTool.renderRecentSearches();
    else if (name === 'images' && window.imageSearchTool) window.imageSearchTool.renderRecentSearches();
    else if (name === 'tts' && window.ttsEngine) window.ttsEngine.renderTTSHistory();
    else if (name === 'settings' && window.settingsManager) window.settingsManager.loadSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _openDrawer() {
    document.getElementById('app-sidebar')?.classList.add('mobile-open');
    document.getElementById('sidebar-backdrop')?.classList.add('active');
  }

  _closeDrawer() {
    document.getElementById('app-sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
  }

  async _loadInitial() {
    // Don't await isReady here - just fire and display
    this._loadDash();
  }

  async _loadDash() {
    let scripts = [];
    try {
      scripts = await Promise.race([
        window.stationDB.getAllScripts(),
        new Promise(r => setTimeout(() => r([]), 4000))
      ]);
    } catch { scripts = []; }

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const total = scripts.length;
    set('dash-stat-total', total);
    set('dash-stat-written', scripts.filter(s => s.status === 'WRITTEN').length);
    set('dash-stat-ready', scripts.filter(s => s.status === 'READY').length);
    set('dash-stat-cancelled', scripts.filter(s => s.status === 'CANCELLED').length);

    const rc = document.getElementById('dash-recent-scripts');
    if (rc) {
      if (total === 0) {
        rc.innerHTML = '<div class="empty-state-sm"><p>لا توجد سكربتات بعد. اضغط على إنشاء سكربت جديد!</p></div>';
      } else {
        const esc = s => String(s || '').replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]||t));
        rc.innerHTML = [...scripts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3).map(s => {
          const txt = (s.content || '').replace(/<[^>]*>/g, '').trim();
          const prev = txt.length > 80 ? txt.slice(0, 80) + '...' : (txt || 'بدون محتوى');
          const badge = s.status === 'READY' ? '<span class="badge badge-ready">🟢 جاهز</span>' : s.status === 'WRITTEN' ? '<span class="badge badge-written">🟡 مكتوب</span>' : '<span class="badge badge-cancelled">🔴 ملغي</span>';
          return `<div class="dash-script-item card"><div class="dash-script-header"><h4>${esc(s.title)}</h4>${badge}</div><p class="dash-script-preview">${esc(prev)}</p><button class="btn btn-sm btn-primary" onclick="window.app.openScriptFromDash('${s.id}')"> 📂 فتح</button></div>`;
        }).join('');
      }
    }

    const ytD = document.getElementById('dash-recent-yt');
    const imD = document.getElementById('dash-recent-img');
    if (ytD) {
      try {
        const yt = await window.stationDB.getRecentSearches('youtube', 3);
        ytD.innerHTML = yt.length ? yt.map(s => `<button class="recent-search-tag" onclick="window.app.quickSearchYT('${s.query.replace(/'/g, "\\'")}')">🎬 ${s.query}</button>`).join('') : '<p class="text-muted">لا يوجد بحث سابق</p>';
      } catch { ytD.innerHTML = ''; }
    }
    if (imD) {
      try {
        const im = await window.stationDB.getRecentSearches('image', 3);
        imD.innerHTML = im.length ? im.map(s => `<button class="recent-search-tag" onclick="window.app.quickSearchImg('${s.query.replace(/'/g, "\\'")}')">🖼️ ${s.query}</button>`).join('') : '<p class="text-muted">لا يوجد بحث سابق</p>';
      } catch { imD.innerHTML = ''; }
    }
  }

  openScriptFromDash(id) { this.switchTab('scripts'); if (window.scriptManager) window.scriptManager.openScriptEditor(id); }
  quickSearchYT(q) { this.switchTab('youtube'); if (window.youtubeTool) window.youtubeTool.performSearch(q); }
  quickSearchImg(q) { this.switchTab('images'); if (window.imageSearchTool) window.imageSearchTool.performSearch(q); }
}

window.showToast = function(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-message">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
};

window.app = new StationApp();
