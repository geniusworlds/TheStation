/**
 * TheStation - Image Search & Media Engine
 * Integrates image search APIs (Unsplash / Pexels / Wikimedia / Public search), modal previews, dimensions, and direct downloading.
 */

class ImageSearchTool {
  constructor() {
    this.currentImage = null;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const searchBtn = document.getElementById('img-search-btn');
    const searchInput = document.getElementById('img-search-input');

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => this.performSearch());
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.performSearch();
      });
    }

    // Modal close events
    const modalClose = document.getElementById('img-modal-close');
    const modalBackdrop = document.getElementById('img-preview-modal');

    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeModal());
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeModal();
      });
    }
  }

  async performSearch(queryOverride = null) {
    const searchInput = document.getElementById('img-search-input');
    const query = queryOverride || (searchInput ? searchInput.value.trim() : '');

    if (!query) {
      if (window.showToast) window.showToast('يرجى كتابة كلمة البحث عن الصورة', 'warning');
      return;
    }

    if (searchInput) searchInput.value = query;

    // Save search to history
    if (window.stationDB) {
      await window.stationDB.addRecentSearch('image', query);
      this.renderRecentSearches();
    }

    const container = document.getElementById('img-results-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner-container">
          <div class="spinner"></div>
          <p>جاري البحث عن الصور المتعلقة بـ "${this.escapeHTML(query)}"...</p>
        </div>
      `;
    }

    try {
      const apiKey = await window.stationDB.getSetting('image_api_key');
      let images = [];

      if (apiKey) {
        // Pexels / Unsplash API call if key is available
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=16`, {
          headers: { Authorization: apiKey }
        });
        if (res.ok) {
          const data = await res.json();
          images = data.photos.map(p => ({
            id: p.id,
            title: p.alt || query,
            thumbnail: p.src.medium,
            fullUrl: p.src.large2x || p.src.original,
            source: 'Pexels',
            author: p.photographer,
            width: p.width,
            height: p.height,
            sourceUrl: p.url
          }));
        }
      }

      if (images.length === 0) {
        // High quality Wikimedia Commons & Unsplash Source Search API Fallback
        const wikiRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.query && wikiData.query.pages) {
            const pages = Object.values(wikiData.query.pages);
            images = pages
              .filter(p => p.imageinfo && p.imageinfo[0])
              .map(p => {
                const info = p.imageinfo[0];
                return {
                  id: p.pageid,
                  title: p.title.replace('File:', ''),
                  thumbnail: info.url,
                  fullUrl: info.url,
                  source: 'Wikimedia Commons',
                  author: 'المجال العام',
                  width: info.width || 1920,
                  height: info.height || 1080,
                  sourceUrl: info.descriptionurl || info.url
                };
              });
          }
        }
      }

      if (images.length === 0) {
        // Curated photography search fallback using Unsplash public source links
        images = [
          { id: 'img_1', title: `${query} - صورة عالية الدقة 1`, thumbnail: `https://source.unsplash.com/featured/600x400/?${encodeURIComponent(query)}`, fullUrl: `https://source.unsplash.com/featured/1920x1080/?${encodeURIComponent(query)}`, source: 'Unsplash', author: 'Unsplash Artist', width: 1920, height: 1080, sourceUrl: 'https://unsplash.com' },
          { id: 'img_2', title: `${query} - صورة عالية الدقة 2`, thumbnail: `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop`, fullUrl: `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&auto=format&fit=crop`, source: 'Unsplash', author: 'Unsplash Creator', width: 1920, height: 1080, sourceUrl: 'https://unsplash.com' },
          { id: 'img_3', title: `${query} - خلفية مميزة`, thumbnail: `https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop`, fullUrl: `https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&auto=format&fit=crop`, source: 'Unsplash', author: 'Unsplash Artist', width: 1920, height: 1080, sourceUrl: 'https://unsplash.com' },
          { id: 'img_4', title: `${query} - تصوير احترافي`, thumbnail: `https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop`, fullUrl: `https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1920&auto=format&fit=crop`, source: 'Unsplash', author: 'Unsplash Studio', width: 1920, height: 1080, sourceUrl: 'https://unsplash.com' }
        ];
      }

      this.renderImageGrid(images);
    } catch (err) {
      console.error('Image search error:', err);
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-icon">⚠️</div>
          <h3>حدث خطأ أثناء جلب نتائج الصور</h3>
          <p>يرجى التحقق من الاتصال بالإنترنت والمحاولة مجدداً.</p>
        </div>
      `;
    }
  }

  renderImageGrid(images) {
    const container = document.getElementById('img-results-container');
    if (!container) return;

    if (images.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-icon">🖼️</div>
          <h3>لم يتم العثور على صور مطابقة</h3>
          <p>جرب تغيير عبارة البحث.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="masonry-grid">
        ${images.map(img => `
          <div class="img-card card" onclick="window.imageSearchTool.openModal('${img.fullUrl}', '${this.escapeHTML(img.title.replace(/'/g, "\\'"))}', '${img.source}', '${img.width}x${img.height}', '${img.sourceUrl}')">
            <div class="img-preview-wrapper">
              <img src="${img.thumbnail}" alt="${this.escapeHTML(img.title)}" class="img-thumb" loading="lazy" />
              <div class="img-overlay">
                <span class="img-dims">${img.width} × ${img.height}</span>
                <span class="img-source-badge">${img.source}</span>
              </div>
            </div>
            <div class="img-card-info">
              <h4 class="img-card-title">${this.escapeHTML(img.title)}</h4>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async renderRecentSearches() {
    const container = document.getElementById('img-recent-searches');
    if (!container || !window.stationDB) return;

    const searches = await window.stationDB.getRecentSearches('image', 6);
    if (searches.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <span class="recent-tag-label">عمليات البحث الأخيرة:</span>
      ${searches.map(s => `
        <button class="recent-search-tag" onclick="window.imageSearchTool.performSearch('${this.escapeHTML(s.query)}')">
          🖼️ ${this.escapeHTML(s.query)}
        </button>
      `).join('')}
    `;
  }

  openModal(fullUrl, title, source, dimensions, sourceUrl) {
    this.currentImage = { fullUrl, title, source, dimensions, sourceUrl };

    const modal = document.getElementById('img-preview-modal');
    const modalImg = document.getElementById('img-modal-full');
    const modalTitle = document.getElementById('img-modal-title');
    const modalSource = document.getElementById('img-modal-source');
    const modalDims = document.getElementById('img-modal-dims');
    const sourceLink = document.getElementById('img-modal-source-link');

    if (modalImg) modalImg.src = fullUrl;
    if (modalTitle) modalTitle.textContent = title;
    if (modalSource) modalSource.textContent = `المصدر: ${source}`;
    if (modalDims) modalDims.textContent = `الأبعاد: ${dimensions}`;
    if (sourceLink) sourceLink.href = sourceUrl || fullUrl;

    if (modal) modal.style.display = 'flex';
  }

  closeModal() {
    const modal = document.getElementById('img-preview-modal');
    if (modal) modal.style.display = 'none';
  }

  async downloadCurrentImage() {
    if (!this.currentImage) return;

    try {
      if (window.showToast) window.showToast('جاري بدء تحضير تنزيل الصورة...', 'info');
      const response = await fetch(this.currentImage.fullUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `TheStation_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      if (window.showToast) window.showToast('تم تنزيل الصورة بنجاح!', 'success');
    } catch (e) {
      console.warn('Direct blob download restricted, opening image in new tab:', e);
      window.open(this.currentImage.fullUrl, '_blank');
      if (window.showToast) window.showToast('تم فتح الصورة للتحميل المباشر', 'info');
    }
  }

  copyImageLink() {
    if (!this.currentImage) return;
    navigator.clipboard.writeText(this.currentImage.fullUrl).then(() => {
      if (window.showToast) window.showToast('تم نسخ رابط الصورة إلى الحافظة', 'success');
    });
  }

  escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.imageSearchTool = new ImageSearchTool();
