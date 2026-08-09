/**
 * TheStation - Main Application Controller & Router
 * Manages view switching, responsive navigation, notifications, and dashboard stats.
 */

class StationApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindNavigationEvents();
      this.bindDashboardEvents();
      this.loadInitialData();
    });
  }

  bindNavigationEvents() {
    // Desktop & Mobile Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = link.dataset.tab;
        if (targetTab) {
          this.switchTab(targetTab);
          this.closeMobileDrawer();
        }
      });
    });

    // Mobile Drawer Toggle
    const drawerToggle = document.getElementById('mobile-drawer-toggle');
    const drawerClose = document.getElementById('mobile-drawer-close');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (drawerToggle) {
      drawerToggle.addEventListener('click', () => this.toggleMobileDrawer(true));
    }
    if (drawerClose) {
      drawerClose.addEventListener('click', () => this.toggleMobileDrawer(false));
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => this.toggleMobileDrawer(false));
    }
  }

  bindDashboardEvents() {
    // Stat Cards Clicks -> Navigate to Scripts with Filter
    document.querySelectorAll('.stat-card[data-filter]').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.dataset.filter;
        this.switchTab('scripts');
        
        // Trigger filter selection
        const filterBtn = document.querySelector(`.script-filter-btn[data-filter="${filter}"]`);
        if (filterBtn) filterBtn.click();
      });
    });

    // Dashboard Quick Actions
    const quickNewScript = document.getElementById('quick-action-new-script');
    const quickYt = document.getElementById('quick-action-yt');
    const quickImg = document.getElementById('quick-action-img');
    const quickTts = document.getElementById('quick-action-tts');

    if (quickNewScript) {
      quickNewScript.addEventListener('click', () => {
        this.switchTab('scripts');
        if (window.scriptManager) window.scriptManager.createNewScript();
      });
    }

    if (quickYt) {
      quickYt.addEventListener('click', () => this.switchTab('youtube'));
    }

    if (quickImg) {
      quickImg.addEventListener('click', () => this.switchTab('images'));
    }

    if (quickTts) {
      quickTts.addEventListener('click', () => this.switchTab('tts'));
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update Nav Active States
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.tab === tabName) link.classList.add('active');
      else link.classList.remove('active');
    });

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(view => {
      view.style.display = 'none';
    });

    // Show target view
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
      targetView.style.display = 'block';
    }

    // Tab specific load actions
    if (tabName === 'dashboard') {
      this.loadDashboardData();
    } else if (tabName === 'scripts') {
      if (window.scriptManager) window.scriptManager.loadScripts();
    } else if (tabName === 'youtube') {
      if (window.youtubeTool) window.youtubeTool.renderRecentSearches();
    } else if (tabName === 'images') {
      if (window.imageSearchTool) window.imageSearchTool.renderRecentSearches();
    } else if (tabName === 'tts') {
      if (window.ttsEngine) window.ttsEngine.renderTTSHistory();
    } else if (tabName === 'settings') {
      if (window.settingsManager) window.settingsManager.loadSettings();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileDrawer(open) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    if (open) {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('active');
    } else {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    }
  }

  closeMobileDrawer() {
    this.toggleMobileDrawer(false);
  }

  async loadInitialData() {
    if (window.stationDB) {
      await window.stationDB.isReady;
    }
    this.loadDashboardData();
  }

  async loadDashboardData() {
    if (!window.stationDB) return;

    const scripts = await window.stationDB.getAllScripts();

    // Update Statistics
    const total = scripts.length;
    const written = scripts.filter(s => s.status === 'WRITTEN').length;
    const ready = scripts.filter(s => s.status === 'READY').length;
    const cancelled = scripts.filter(s => s.status === 'CANCELLED').length;

    const dashTotal = document.getElementById('dash-stat-total');
    const dashWritten = document.getElementById('dash-stat-written');
    const dashReady = document.getElementById('dash-stat-ready');
    const dashCancelled = document.getElementById('dash-stat-cancelled');

    if (dashTotal) dashTotal.textContent = total;
    if (dashWritten) dashWritten.textContent = written;
    if (dashReady) dashReady.textContent = ready;
    if (dashCancelled) dashCancelled.textContent = cancelled;

    // Recent Scripts on Dashboard
    const recentScriptsContainer = document.getElementById('dash-recent-scripts');
    if (recentScriptsContainer) {
      const recentScripts = [...scripts]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 3);

      if (recentScripts.length === 0) {
        recentScriptsContainer.innerHTML = `
          <div class="empty-state-sm">
            <p>لا توجد سكربتات بعد. قم بإنشاء أول سكربت لك الآن!</p>
          </div>
        `;
      } else {
        recentScriptsContainer.innerHTML = recentScripts.map(s => {
          const plainText = s.content ? s.content.replace(/<[^>]*>/g, '').trim() : '';
          const preview = plainText.length > 80 ? plainText.substring(0, 80) + '...' : (plainText || 'بدون محتوى');
          
          let badgeHTML = '';
          if (s.status === 'READY') badgeHTML = '<span class="badge badge-ready">🟢 جاهز</span>';
          else if (s.status === 'WRITTEN') badgeHTML = '<span class="badge badge-written">🟡 مكتوب</span>';
          else badgeHTML = '<span class="badge badge-cancelled">🔴 ملغي</span>';

          return `
            <div class="dash-script-item card">
              <div class="dash-script-header">
                <h4>${window.scriptManager ? window.scriptManager.escapeHTML(s.title) : s.title}</h4>
                ${badgeHTML}
              </div>
              <p class="dash-script-preview">${window.scriptManager ? window.scriptManager.escapeHTML(preview) : preview}</p>
              <button class="btn btn-sm btn-primary" onclick="window.app.openScriptFromDash('${s.id}')">
                📂 فتح السكربت
              </button>
            </div>
          `;
        }).join('');
      }
    }

    // Recent Searches on Dashboard
    const ytRecentDash = document.getElementById('dash-recent-yt');
    const imgRecentDash = document.getElementById('dash-recent-img');

    if (ytRecentDash) {
      const ytSearches = await window.stationDB.getRecentSearches('youtube', 3);
      ytRecentDash.innerHTML = ytSearches.length > 0 
        ? ytSearches.map(s => `<button class="recent-search-tag" onclick="window.app.quickSearchYT('${window.scriptManager.escapeHTML(s.query)}')">🎬 ${window.scriptManager.escapeHTML(s.query)}</button>`).join('')
        : '<p class="text-muted">لا يوجد عمليات بحث سابقة</p>';
    }

    if (imgRecentDash) {
      const imgSearches = await window.stationDB.getRecentSearches('image', 3);
      imgRecentDash.innerHTML = imgSearches.length > 0
        ? imgSearches.map(s => `<button class="recent-search-tag" onclick="window.app.quickSearchImg('${window.scriptManager.escapeHTML(s.query)}')">🖼️ ${window.scriptManager.escapeHTML(s.query)}</button>`).join('')
        : '<p class="text-muted">لا يوجد عمليات بحث سابقة</p>';
    }
  }

  openScriptFromDash(id) {
    this.switchTab('scripts');
    if (window.scriptManager) window.scriptManager.openScriptEditor(id);
  }

  quickSearchYT(query) {
    this.switchTab('youtube');
    if (window.youtubeTool) window.youtubeTool.performSearch(query);
  }

  quickSearchImg(query) {
    this.switchTab('images');
    if (window.imageSearchTool) window.imageSearchTool.performSearch(query);
  }
}

// Global Toast Notification Helper
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

window.app = new StationApp();
