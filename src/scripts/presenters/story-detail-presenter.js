import L from 'leaflet';
import { bookmarkStory, unbookmarkStory, isStoryBookmarked } from '../services/idb-service.js';

export default class StoryDetailPresenter {
  constructor({ view, model, ui }) {
    this._view = view;
    this._model = model;
    this._ui = ui;
    this._map = null;
    this._storyId = null;
    this._currentStory = null;
  }

  async init(storyId) {
    if (!storyId) {
      console.error('Story ID is required');
      this._view.showError('Story ID tidak valid');
      return;
    }
    console.log('Loading story with ID:', storyId);
    
    this._ui.showLoading(true);
    
    try {
      const story = await this._model.fetchStoryDetail(storyId);
      this._currentStory = story;
      
      const { isStoryBookmarked } = await import('../services/idb-service.js');
      const bookmarked = await isStoryBookmarked(story.id);
      
      this._view.renderStoryDetail(story, bookmarked);
      
      if (story.lat && story.lon) {
        this._view.renderDetailMap(story.lat, story.lon, story.name);
      }
      
    } catch (error) {
      console.error('Error loading story detail:', error);
      this._view.showError('Gagal memuat detail story');
    } finally {
      this._ui.showLoading(false);
    }
    this._view.onBookmarkToggle(async () => {
      await this._handleBookmarkToggle();
    });
    this._view.onBackClick(() => {
      window.location.hash = '#/';
    });
  }

  _initDetailMap(lat, lon, name) {
    const container = this._view.getMapContainer();
    if (!container) return;

    if (this._map) {
      try { this._map.remove(); } catch (e) {}
      this._map = null;
    }

    this._map = L.map(container, {
      center: [lat, lon],
      zoom: 13
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this._map);

    const icon = window.DEFAULT_LEAFLET_ICON || undefined;
    L.marker([lat, lon], { icon })
      .addTo(this._map)
      .bindPopup(`<strong>${name}</strong>`)
      .openPopup();

    setTimeout(() => {
      try { this._map.invalidateSize(); } catch (e) {}
    }, 200);
  }

  _bindBackButton() {
    const backBtn = this._view.getElement().querySelector('#back-button');
    if (!backBtn) return;

    backBtn.addEventListener('click', () => {
      window.location.hash = '#/';
    });
  }

  _bindBookmarkButton() {
    const bookmarkBtn = this._view.getElement().querySelector('#bookmark-button');
    if (!bookmarkBtn) return;

    bookmarkBtn.addEventListener('click', async () => {
      const story = this._view.getStory();
      if (!story) return;

      const currentlyBookmarked = await isStoryBookmarked(this._storyId);
      
      if (currentlyBookmarked) {
        const result = await unbookmarkStory(this._storyId);
        if (result.success) {
          this._view._updateBookmarkButton(false);
          this._view.showToast('Bookmark berhasil dihapus!', 'success');
        } else {
          this._view.showToast('Gagal menghapus bookmark', 'error');
        }
      } else {
        const result = await bookmarkStory(story);
        if (result.success) {
          this._view._updateBookmarkButton(true);
          this._view.showToast('Story berhasil di-bookmark!', 'success');
        } else {
          this._view.showToast('Gagal menyimpan bookmark', 'error');
        }
      }
    });
  }

  async _handleBookmarkToggle() {
    if (!this._currentStory) return;
    const { bookmarkStory, unbookmarkStory, isStoryBookmarked } = await import('../services/idb-service.js');
    
    try {
      const isBookmarked = await isStoryBookmarked(this._currentStory.id);
      
      if (isBookmarked) {
        await unbookmarkStory(this._currentStory.id);
        this._ui.showToast('❌ Bookmark dihapus');
        this._view.updateBookmarkButton(false);
      } else {
        await bookmarkStory(this._currentStory);
        this._ui.showToast('✅ Story berhasil di-bookmark!');
        this._view.updateBookmarkButton(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      this._ui.showToast('❌ Gagal mengubah bookmark');
    }
  }

  destroy() {
    if (this._map) {
      try { this._map.remove(); } catch (e) {}
      this._map = null;
    }
    this._view.cleanup();
  }
}