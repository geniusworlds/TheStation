/**
 * TheStation - Image Search & Media Engine
 */

class ImageSearchTool {
  constructor() {
    this.currentImage = null;
    this._domReady(() => this.bindEvents());
  }

  _domReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  bindEvents() {
    const btn = document.getElementById('img-search-btn');
    const inp = document.getElementById('img-search-input');
    if (btn) btn.addEventListener('click', () => this.performSearch());
    if (inp) inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.performSearch(); });

    const closeBtn = document.getElementById('img-modal-close');
    const backdrop = document.getElementById('img-preview-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) this.closeModal(); });
  }

  async performSearch(queryOverride = null) {
    const inp = document.getElementById('img-search-input');
    const query = (queryOverride || (inp ? inp.value.trim() : '')).trim();

    if (!query) {
      if (window.showToast) window.showToast('يرجى كتابة كلمة البحث', 'warning');
      return;
    }

    if (inp) inp.value = query;
    try { await window.stationDB.addRecentSearch('image', query); this.renderRecentSearches(); } catch {}

    const container = document.getElementById('img-results-container');
    if (container) container.innerHTML = `<div class="loading-spinner-container"><div class="spinner"></div><p>جاري البحث عن "ا${this.esc(query)}"...</p></div>`;

    try {
      // Fix: correct key name 'img_api_key'
      let apiKey = null;
      try { apiKey = await window.stationDB.getSetting('img_api_key'); } catch {}
      let images = [];

      if (apiKey) {
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=16`, { headers: { Authorization: apiKey } });
        if (res.ok) {
          const data = await res.json();
          images = (data.photos || []).map(p => ({ id: p.id, title: p.alt || query, thumbnail: p.src.medium, fullUrl: p.src.large2x || p.src.original, source: 'Pexels', author: p.photographer, width: p.width, height: p.height, sourceUrl: p.url }));
        }
      }

      if (images.length === 0) {
        // Wikimedia Commons fallback
        const wRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=imageinfo&iiprop=url|size&format=json&origin=*`);
        if (wRes.ok) {
          const wData = await wRes.json();
          if (wData.query?.pages) {
            images = Object.values(wData.query.pages)
              .filter(p => p.imageinfo?.[0])
              .map(p => ({ id: p.pageid, title: p.title.replace('File:', ''), thumbnail: p.imageinfo[0].url, fullUrl: p.imageinfo[0].url, source: 'Wikimedia', author: 'المجال العام', width: p.imageinfo[0].width || 1920, height: p.imageinfo[0].height || 1080, sourceUrl: p.imageinfo[0].descriptionurl || p.imageinfo[0].url }));
          }
        }
      }

      if (images.length === 0) {
        // Unsplash source fallback
        images = Array.from({ length: 6 }, (_, i) => ({
          id: `img_${i}`, title: `${query} - صورة ${i+1}`,
          thumbnail: `https://source.unsplash.com/featured/600x400/?${encodeURIComponent(query)}&sig=${i}`,
          fullUrl: `https://source.unsplash.com/1920x1080/?${encodeURIComponent(query)}&sig=${i}`,
          source: 'Unsplash', author: 'Unsplash', width: 1920, height: 1080, sourceUrl: 'https://unsplash.com'
        }));
      }

      this._renderGrid(images);
    } catch (err) {
      const container2 = document.getElementById('img-results-container');
      if (container2) container2.innerHTML = `<div class="empty-state card"><div class="empty-icon">⚠️</div><h3>خطأ أثناء جلب الصور</h3><p>تحقق من الاتصال وأعد المحاولة.</p></div>`;
    }
  }

  _renderGrid(images) {
    const container = document.getElementById('img-results-container');
    if (!container) return;
    if (!images.length) { container.innerHTML = `<div class="empty-state card"><div class="empty-icon">🖼️</div><h3>لا توجد صور مطابقة</h3><p>جرب تغيير كلمة البحث.</p></div>`; return; }
    container.innerHTML = `<div class="masonry-grid">${images.map(img => `
      <div class="img-card card" onclick="window.imageSearchTool.openModal('${img.fullUrl}','${this.esc(img.title.replace(/'/g,"\\'" ))}','${img.source}','${img.width}x${img.height}','${img.sourceUrl}')">
        <div class="img-preview-wrapper">
          <img src="${img.thumbnail}" alt="${this.esc(img.title)}" class="img-thumb" loading="lazy" />
          <div class="img-overlay"><span class="img-dims">${img.width} × ${img.height}</span><span class="img-source-badge">${img.source}</span></div>
        </div>
        <div class="img-card-info"><h4 class="img-card-title">${this.esc(img.title)}</h4></div>
      </div>`).join('')}</div>`;
  }

  async renderRecentSearches() {
    const container = document.getElementById('img-recent-searches');
    if (!container) return;
    try {
      const searches = await window.stationDB.getRecentSearches('image', 6);
      if (!searches.length) { container.style.display = 'none'; return; }
      container.style.display = 'block';
      container.innerHTML = `<span class="recent-tag-label">عمليات البحث الأخيرة:</span>${searches.map(s => `<button class="recent-search-tag" onclick="window.imageSearchTool.performSearch('${this.esc(s.query.replace(/'/g,"\\'" ))}')">🖼️ ${this.esc(s.query)}</button>`).join('')}`;
    } catch { container.style.display = 'none'; }
  }

  openModal(fullUrl, title, source, dimensions, sourceUrl) {
    this.currentImage = { fullUrl, title, source, dimensions, sourceUrl };
    const modal = document.getElementById('img-preview-modal');
    const mImg = document.getElementById('img-modal-full');
    const mTitle = document.getElementById('img-modal-title');
    const mSource = document.getElementById('img-modal-source');
    const mDims = document.getElementById('img-modal-dims');
    const mLink = document.getElementById('img-modal-source-link');
    if (mImg) mImg.src = fullUrl;
    if (mTitle) mTitle.textContent = title;
    if (mSource) mSource.textContent = `المصدر: ${source}`;
    if (mDims) mDims.textContent = `الأبعاد: ${dimensions}`;
    if (mLink) mLink.href = sourceUrl || fullUrl;
    if (modal) modal.style.display = 'flex';
  }

  closeModal() {
    const modal = document.getElementById('img-preview-modal');
    if (modal) modal.style.display = 'none';
  }

  async downloadCurrentImage() {
    if (!this.currentImage) return;
    try {
      if (window.showToast) window.showToast('جاري تحضير التنزيل...', 'info');
      const res = await fetch(this.currentImage.fullUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `TheStation_${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('تم التنزيل بنجاح', 'success');
    } catch {
      window.open(this.currentImage.fullUrl, '_blank');
      if (window.showToast) window.showToast('تم فتح الصورة للتحميل', 'info');
    }
  }

  copyImageLink() {
    if (!this.currentImage) return;
    navigator.clipboard.writeText(this.currentImage.fullUrl).then(() => { if (window.showToast) window.showToast('تم نسخ رابط الصورة', 'success'); });
  }

  esc(str) { return String(str||'').replace(/[&<>'"]/g, t=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]||t)); }
  escapeHTML(str) { return this.esc(str); }
}

window.imageSearchTool = new ImageSearchTool();
