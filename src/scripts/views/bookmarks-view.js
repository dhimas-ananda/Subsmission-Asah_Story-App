export default class BookmarksView {
  constructor() {
    this._el = null;
    this._bookmarks = [];
  }

  render() {
    this._el = document.createElement('section');
    this._el.className = 'bookmarks-section';
    this._el.innerHTML = `
      <div class="bookmarks-header">
        <h2>📚 Story yang Anda Bookmark</h2>
        <span id="bookmarks-count" class="bookmarks-count">Total: 0 story</span>
      </div>
      
      <div class="bookmarks-controls">
        <div class="filter-group">
          <label for="filter-search">🔍 Cari Story:</label>
          <input 
            type="text" 
            id="filter-search" 
            placeholder="Cari berdasarkan nama atau deskripsi..." 
            aria-label="Filter bookmarks"
          />
        </div>
        
        <div class="sort-group">
          <label for="sort-select">📊 Urutkan:</label>
          <select id="sort-select" aria-label="Sort bookmarks">
            <option value="newest">Terbaru Ditambahkan</option>
            <option value="oldest">Terlama Ditambahkan</option>
            <option value="name-asc">Nama (A-Z)</option>
            <option value="name-desc">Nama (Z-A)</option>
          </select>
        </div>
      </div>
      
      <div id="bookmarks-list" class="bookmarks-list" role="list">
        <div class="loader">Memuat bookmarks...</div>
      </div>
    `;
    return this._el;
  }

  bindEvents() {
    const searchInput = this._el.querySelector('#filter-search');
    const sortSelect = this._el.querySelector('#sort-select');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this._onFilterChange && this._onFilterChange();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this._onSortChange && this._onSortChange();
      });
    }
  }

  getFilterValue() {
    const input = this._el.querySelector('#filter-search');
    return input ? input.value.toLowerCase().trim() : '';
  }

  getSortValue() {
    const select = this._el.querySelector('#sort-select');
    return select ? select.value : 'newest';
  }

  onFilterChange(handler) {
    this._onFilterChange = handler;
  }

  onSortChange(handler) {
    this._onSortChange = handler;
  }

  onDeleteBookmark(handler) {
    this._deleteHandler = handler;
  }

  renderBookmarks(bookmarks = []) {
    this._bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    
    const countElement = this._el.querySelector('#bookmarks-count');
    const listElement = this._el.querySelector('#bookmarks-list');

    countElement.textContent = `Total: ${this._bookmarks.length} story`;

    if (this._bookmarks.length === 0) {
      const hasFilter = this.getFilterValue() !== '';
      
      if (hasFilter) {
        listElement.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3>Tidak Ada Hasil</h3>
            <p>Tidak ditemukan story yang sesuai dengan pencarian Anda.</p>
          </div>
        `;
      } else {
        listElement.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>Belum Ada Story yang Anda Bookmark</h3>
            <p>Story yang Anda simpan akan muncul di sini.</p>
            <p>Klik tombol "Simpan" pada halaman detail story untuk menyimpan story favorit Anda!</p>
            <a href="#/" class="btn-primary">Lihat Daftar Story</a>
          </div>
        `;
      }
      return;
    }

    listElement.innerHTML = this._bookmarks.map(story => {
      const created = story.createdAt ? new Date(story.createdAt).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';
      
      return `
        <article class="bookmark-item" data-story-id="${story.id}" role="listitem">
          ${story.photoUrl ? `
            <div class="bookmark-thumb">
              <img src="${story.photoUrl}" alt="${story.name}" loading="lazy" />
            </div>
          ` : ''}
          
          <div class="bookmark-content">
            <h3 class="bookmark-title">${this._highlightText(story.name)}</h3>
            <div class="bookmark-meta">
              <span class="bookmark-author">👤 ${story.authorName || 'Anonymous'}</span>
              <span class="bookmark-date">📅 ${created}</span>
            </div>
            <p class="bookmark-description">${this._highlightText(this._truncateText(story.description, 150))}</p>
            ${story.lat && story.lon ? `
              <div class="bookmark-location">📍 ${story.lat}, ${story.lon}</div>
            ` : ''}
          </div>
          
          <div class="bookmark-actions">
            <a href="#/story/${story.id}" class="btn-view" aria-label="Lihat detail ${story.name}">
              👁️ Lihat Detail
            </a>
            <button class="btn-delete" data-id="${story.id}" aria-label="Hapus bookmark ${story.name}">
              🗑️ Hapus
            </button>
          </div>
        </article>
      `;
    }).join('');

    const deleteButtons = listElement.querySelectorAll('.btn-delete');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (this._deleteHandler) this._deleteHandler(id);
      });
    });
  }

  _truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  _highlightText(text) {
    const filter = this.getFilterValue();
    if (!filter || !text) return text;
    
    const regex = new RegExp(`(${filter})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}