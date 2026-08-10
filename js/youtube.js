/**
 * TheStation - YouTube Video Search & Workspace Engine
 */

class YouTubeTool {
  constructor() {
    this.player = null;
    this.currentVideo = null;
    this.startTime = 0;
    this.endTime = 0;
    this.previewInterval = null;
    this.isPlayerReady = false;
    this._domReady(() => this._init());
  }

  _domReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  _init() {
    this.bindEvents();
    this._loadYTApi();
  }

  _loadYTApi() {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { this.isPlayerReady = false; };
  }

  bindEvents() {
    const btn = document.getElementById('yt-search-btn');
    const inp = document.getElementById('yt-search-input');
    if (btn) btn.addEventListener('click', () => this.performSearch());
    if (inp) inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.performSearch(); });

    const setStart = document.getElementById('yt-set-start-btn');
    const setEnd = document.getElementById('yt-set-end-btn');
    const preview = document.getElementById('yt-preview-section-btn');
    const reset = document.getElementById('yt-reset-section-btn');
    if (setStart) setStart.addEventListener('click', () => this.setStartTimeFromCurrent());
    if (setEnd) setEnd.addEventListener('click', () => this.setEndTimeFromCurrent());
    if (preview) preview.addEventListener('click', () => this.previewSection());
    if (reset) reset.addEventListener('click', () => this.resetSection());

    const startInp = document.getElementById('yt-start-time-input');
    const endInp = document.getElementById('yt-end-time-input');
    if (startInp) startInp.addEventListener('change', () => { this.startTime = this._parseTs(startInp.value); this._updateDuration(); });
    if (endInp) endInp.addEventListener('change', () => { this.endTime = this._parseTs(endInp.value); this._updateDuration(); });
  }

  async performSearch(queryOverride = null) {
    const inp = document.getElementById('yt-search-input');
    const query = (queryOverride || (inp ? inp.value.trim() : '')).trim();

    if (!query) {
      if (window.showToast) window.showToast('يرجى كتابة كلمة البحث', 'warning');
      return;
    }

    if (inp) inp.value = query;

    try { await window.stationDB.addRecentSearch('youtube', query); this.renderRecentSearches(); } catch {}

    const container = document.getElementById('yt-results-container');
    if (container) container.innerHTML = `<div class="loading-spinner-container"><div class="spinner"></div><p>جاري البحث عن "${this.esc(query)}"...</p></div>`;

    try {
      // Fix: correct key name 'yt_api_key'
      let apiKey = null;
      try { apiKey = await window.stationDB.getSetting('yt_api_key'); } catch {}
      let results = [];

      if (apiKey) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
        const data = await res.json();
        if (data.items) {
          results = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: (item.snippet.thumbnails.high || item.snippet.thumbnails.default).url,
            publishedAt: item.snippet.publishedAt ? new Date(item.snippet.publishedAt).toLocaleDateString('ar-SA') : '',
            duration: 'فيديو'
          }));
        }
      }

      if (results.length === 0) {
        // Try Invidious fallback
        const invRes = await fetch(`https://invidious.io.lol/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
        if (invRes.ok) {
          const data = await invRes.json();
          results = data.slice(0, 12).map(item => ({
            id: item.videoId,
            title: item.title,
            channel: item.author,
            thumbnail: item.videoThumbnails ? (item.videoThumbnails.find(t => t.quality === 'medium') || item.videoThumbnails[0]).url : `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            publishedAt: item.publishedText || '',
            duration: this._fmtSecs(item.lengthSeconds || 0)
          }));
        }
      }

      if (results.length === 0) throw new Error('no results');
      this._renderResults(results, query);
    } catch {
      // Final fallback: direct YouTube search button
      this._renderFallback(query);
    }
  }

  _renderFallback(query) {
    const container = document.getElementById('yt-results-container');
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state card">
        <div class="empty-icon">🎬</div>
        <h3>تعذر التوصل لخدمة البحث</h3>
        <p>يمكنك البحث مباشرةً على يوتيوب:</p>
        <a class="btn btn-primary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank">
          🔍 ابحث عن "${this.esc(query)}" على يوتيوب
        </a>
      </div>`;
  }

  _renderResults(results, query) {
    const container = document.getElementById('yt-results-container');
    if (!container) return;
    if (!results || results.length === 0) { this._renderFallback(query); return; }
    container.innerHTML = `<div class="grid-layout">${results.map(v => `
      <div class="yt-video-card card">
        <div class="yt-thumbnail-wrapper">
          <img src="${v.thumbnail}" alt="${this.esc(v.title)}" class="yt-thumbnail" loading="lazy" />
          <span class="yt-duration-badge">${v.duration}</span>
        </div>
        <div class="yt-video-info">
          <h4 class="yt-video-title">${this.esc(v.title)}</h4>
          <p class="yt-video-channel">📺 ${this.esc(v.channel)}</p>
          ${v.publishedAt ? `<p class="yt-video-date">📅 ${v.publishedAt}</p>` : ''}
          <button class="btn btn-primary btn-sm btn-block" onclick="window.youtubeTool.openWorkspace('${v.id}','${this.esc(v.title.replace(/'/g,"\\'"  ))}','${this.esc(v.channel.replace(/'/g,"\\'" ))}')"> 🎬 فتح في مساحة العمل</button>
        </div>
      </div>`).join('')}</div>`;
  }

  async renderRecentSearches() {
    const container = document.getElementById('yt-recent-searches');
    if (!container) return;
    try {
      const searches = await window.stationDB.getRecentSearches('youtube', 6);
      if (searches.length === 0) { container.style.display = 'none'; return; }
      container.style.display = 'block';
      container.innerHTML = `<span class="recent-tag-label">عمليات البحث الأخيرة:</span>${searches.map(s => `<button class="recent-search-tag" onclick="window.youtubeTool.performSearch('${this.esc(s.query.replace(/'/g,"\\'" ))}')">🔍 ${this.esc(s.query)}</button>`).join('')}`;
    } catch { container.style.display = 'none'; }
  }

  openWorkspace(videoId, title, channel) {
    this.currentVideo = { id: videoId, title, channel };
    const titleEl = document.getElementById('yt-workspace-title');
    const channelEl = document.getElementById('yt-workspace-channel');
    const linkEl = document.getElementById('yt-workspace-link');
    if (titleEl) titleEl.textContent = title;
    if (channelEl) channelEl.textContent = channel;
    if (linkEl) { linkEl.href = `https://www.youtube.com/watch?v=${videoId}`; linkEl.textContent = `https://youtu.be/${videoId}`; }
    this._initPlayer(videoId);
    this.resetSection();
    document.getElementById('yt-search-view').style.display = 'none';
    document.getElementById('yt-workspace-view').style.display = 'block';
  }

  closeWorkspace() {
    if (this.player?.pauseVideo) this.player.pauseVideo();
    if (this.previewInterval) clearInterval(this.previewInterval);
    document.getElementById('yt-workspace-view').style.display = 'none';
    document.getElementById('yt-search-view').style.display = 'block';
  }

  _initPlayer(videoId) {
    const div = document.getElementById('yt-iframe-container');
    if (!div) return;
    div.innerHTML = '<div id="yt-player-element"></div>';
    if (window.YT && window.YT.Player) {
      this.player = new window.YT.Player('yt-player-element', {
        height: '390', width: '100%', videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => { this.isPlayerReady = true; } }
      });
    } else {
      div.innerHTML = `<iframe width="100%" height="390" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
    }
  }

  _getCurrentTime() {
    return (this.player && typeof this.player.getCurrentTime === 'function') ? Math.floor(this.player.getCurrentTime()) : 0;
  }

  setStartTimeFromCurrent() {
    this.startTime = this._getCurrentTime();
    const el = document.getElementById('yt-start-time-input');
    if (el) el.value = this._fmtSecs(this.startTime);
    this._updateDuration();
    if (window.showToast) window.showToast(`وقت البداية: ${this._fmtSecs(this.startTime)}`, 'info');
  }

  setEndTimeFromCurrent() {
    this.endTime = this._getCurrentTime();
    const el = document.getElementById('yt-end-time-input');
    if (el) el.value = this._fmtSecs(this.endTime);
    this._updateDuration();
    if (window.showToast) window.showToast(`وقت النهاية: ${this._fmtSecs(this.endTime)}`, 'info');
  }

  _updateDuration() {
    const diff = Math.max(0, this.endTime - this.startTime);
    const el = document.getElementById('yt-section-duration');
    if (el) el.textContent = this._fmtSecs(diff);
    const link = document.getElementById('yt-timestamp-link');
    if (link && this.currentVideo) { link.href = `https://youtu.be/${this.currentVideo.id}?t=${this.startTime}`; link.textContent = `https://youtu.be/${this.currentVideo.id}?t=${this.startTime}`; }
  }

  previewSection() {
    if (this.startTime >= this.endTime) { if (window.showToast) window.showToast('حدد وقت بداية أقل من وقت النهاية', 'warning'); return; }
    if (this.player?.seekTo) {
      this.player.seekTo(this.startTime, true);
      this.player.playVideo();
      if (this.previewInterval) clearInterval(this.previewInterval);
      this.previewInterval = setInterval(() => { if (this._getCurrentTime() >= this.endTime) { this.player.pauseVideo(); clearInterval(this.previewInterval); } }, 500);
    }
  }

  resetSection() {
    this.startTime = 0; this.endTime = 0;
    const s = document.getElementById('yt-start-time-input');
    const e = document.getElementById('yt-end-time-input');
    if (s) s.value = '00:00:00'; if (e) e.value = '00:00:00';
    this._updateDuration();
  }

  _parseTs(ts) {
    if (!ts) return 0;
    const p = ts.split(':').map(Number);
    return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : parseInt(ts)||0;
  }

  _fmtSecs(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    const p = n => String(n).padStart(2,'0');
    return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  }

  esc(str) { return String(str||'').replace(/[&<>'"]/g, t=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]||t)); }
  escapeHTML(str) { return this.esc(str); }
  formatSeconds(s) { return this._fmtSecs(s); }
}

window.youtubeTool = new YouTubeTool();
