export default class HomeView {
  constructor() {
    this._el = null;
    this._stories = [];
  }

  render() {
    const section = document.createElement('section');
    section.innerHTML = `
      <h2>Daftar Story</h2>
      <div class="card">
        <div class="map-wrapper">
          <div id="map-home" class="map-container" role="application" aria-label="Story Map"></div>
        </div>
        <div class="filter-row">
          <label for="filter-input">Filter daftar</label>
          <input id="filter-input" placeholder="Filter nama atau deskripsi" />
        </div>
        <div class="stories-list" aria-live="polite"></div>
      </div>
    `;
    this._el = section;
    return section;
  }

  bindEvents() {
    const input = this._el.querySelector('#filter-input');
    if (!input) return;

    input.addEventListener('input', (e) => {
      const q = (e.target.value || '').toLowerCase();
      const filtered = this._stories.filter(s => {
        return (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
      });
      this.renderList(filtered);
    });
  }

  renderList(stories = []) {
    this._stories = Array.isArray(stories) ? stories : [];
    const container = this.getListContainer();
    if (!container) return;

    if (!this._stories.length) {
      container.innerHTML = `<div class="empty">Belum ada story</div>`;
      return;
    }

    container.innerHTML = this._stories.map(s => {
      const created = s.createdAt ? new Date(s.createdAt).toLocaleString('id-ID') : '';
      return `
        <article class="story-item" data-story-id="${s.id || ''}" tabindex="0" role="article" aria-label="Story ${s.name || ''}">
          <img src="${s.photoUrl || '/assets/icon-192.png'}" alt="${s.name || ''}" class="story-thumb" width="80" height="80"/>
          <div class="story-meta">
            <h3 class="story-name">${s.name || ''}</h3>
            <div class="story-date">${created}</div>
            <p class="story-desc">${s.description || ''}</p>
          </div>
          <a href="#/story/${s.id}" class="btn-detail" aria-label="Lihat detail ${s.name || ''}">
            👁️ Detail
          </a>
        </article>
      `;
    }).join('');
  }

  getMapContainer() {
    return this._el ? this._el.querySelector('#map-home') : null;
  }

  getListContainer() {
    return this._el ? this._el.querySelector('.stories-list') : null;
  }
}