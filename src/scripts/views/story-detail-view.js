export default class StoryDetailView {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('section');
    this._el.className = 'story-detail-section';
    this._el.innerHTML = `
      <div class="story-detail-header">
        <button id="btn-back" class="btn-back" aria-label="Kembali ke Home">
          ← Kembali
        </button>
        <button id="btn-bookmark" class="btn-bookmark" aria-label="Bookmark story ini">
          <span class="bookmark-icon">🔖</span>
          <span class="bookmark-text">Simpan</span>
        </button>
      </div>
      <div id="story-detail-content">
        <div class="loader">Memuat story...</div>
      </div>
    `;
    return this._el;
  }

  showError(message) {
    const content = this._el.querySelector('#story-detail-content');
    content.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Terjadi Kesalahan</h3>
        <p>${message}</p>
        <a href="#/" class="btn-primary">Kembali ke Home</a>
      </div>
    `;
  }

  renderStoryDetail(story, isBookmarked) {
    if (!story) {
      this.showError('Story tidak ditemukan');
      return;
    }

    this._story = story;
    const content = this._el.querySelector('#story-detail-content');
    const created = story.createdAt ? new Date(story.createdAt).toLocaleString('id-ID') : '-';
    
    content.innerHTML = `
      <article class="story-detail-card">
        ${story.photoUrl ? `
          <div class="story-photo">
            <img src="${story.photoUrl}" alt="${story.name}" loading="lazy" />
          </div>
        ` : ''}
        
        <div class="story-info">
          <h1 class="story-title">${story.name}</h1>
          
          <div class="story-meta-row">
            <div class="story-author">
              <strong>👤 Author:</strong> ${story.name || 'Anonymous'}
            </div>
            
            <div class="story-date">
              <strong>📅 Dibuat:</strong> ${created}
            </div>
          </div>
          
          <div class="story-description">
            <h3>📝 Deskripsi:</h3>
            <p>${story.description}</p>
          </div>
          
          ${story.lat && story.lon ? `
            <div class="story-location">
              <h3>📍 Lokasi Story</h3>
              <p>Koordinat: ${story.lat}, ${story.lon}</p>
              <div id="detail-map" class="detail-map-container" role="application" aria-label="Story Location Map"></div>
            </div>
          ` : ''}
        </div>
      </article>
    `;

    this.updateBookmarkButton(isBookmarked);
  }

  updateBookmarkButton(isBookmarked) {
    const btn = this._el.querySelector('#btn-bookmark');
    const icon = btn.querySelector('.bookmark-icon');
    const text = btn.querySelector('.bookmark-text');
    
    if (isBookmarked) {
      btn.classList.add('bookmarked');
      icon.textContent = '✅';
      text.textContent = 'Tersimpan';
    } else {
      btn.classList.remove('bookmarked');
      icon.textContent = '🔖';
      text.textContent = 'Simpan';
    }
  }

  renderDetailMap(lat, lon, name) {
    const mapEl = this._el.querySelector('#detail-map');
    if (!mapEl || !window.L) return;

    try {
      const map = L.map(mapEl).setView([lat, lon], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      const icon = window.DEFAULT_LEAFLET_ICON || undefined;
      L.marker([lat, lon], { icon }).addTo(map)
        .bindPopup(`<strong>${name}</strong>`)
        .openPopup();
    } catch (e) {
      console.error('Error rendering map:', e);
    }
  }

  onBookmarkToggle(handler) {
    const btn = this._el.querySelector('#btn-bookmark');
    btn.addEventListener('click', handler);
  }

  onBackClick(handler) {
    const btn = this._el.querySelector('#btn-back');
    btn.addEventListener('click', handler);
  }
}