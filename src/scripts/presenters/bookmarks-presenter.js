import { getBookmarkedStories, unbookmarkStory } from '../services/idb-service.js';

export default class BookmarksPresenter {
  constructor({ view, ui }) {
    this._view = view;
    this._ui = ui;
    this._allBookmarks = [];
  }

  async init() {
    this._view.onFilterChange(() => this._applyFilterAndSort());
    this._view.onSortChange(() => this._applyFilterAndSort());
    this._view.onDeleteBookmark((id) => this._handleDelete(id));

    await this._loadBookmarks();
  }

  async _loadBookmarks() {
    this._ui.showLoading(true);
    
    try {
      this._allBookmarks = await getBookmarkedStories();
      this._applyFilterAndSort();
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      this._ui.showToast('❌ Gagal memuat bookmarks');
      this._view.renderBookmarks([]);
    } finally {
      this._ui.showLoading(false);
    }
  }

  _applyFilterAndSort() {
    let filtered = [...this._allBookmarks];

    const filterValue = this._view.getFilterValue();
    if (filterValue) {
      filtered = filtered.filter(story => {
        const name = (story.name || '').toLowerCase();
        const desc = (story.description || '').toLowerCase();
        return name.includes(filterValue) || desc.includes(filterValue);
      });
    }

    const sortValue = this._view.getSortValue();
    filtered = this._sortBookmarks(filtered, sortValue);

    this._view.renderBookmarks(filtered);
  }

  _sortBookmarks(bookmarks, sortType) {
    const sorted = [...bookmarks];

    switch (sortType) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });

      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateA - dateB;
        });

      case 'name-asc':
        return sorted.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

      case 'name-desc':
        return sorted.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });

      default:
        return sorted;
    }
  }

  async _handleDelete(storyId) {
    if (!confirm('Yakin ingin menghapus bookmark ini?')) return;

    this._ui.showLoading(true);
    
    try {
      await unbookmarkStory(storyId);
      this._ui.showToast('✅ Bookmark berhasil dihapus');
      await this._loadBookmarks();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      this._ui.showToast('❌ Gagal menghapus bookmark');
    } finally {
      this._ui.showLoading(false);
    }
  }
}