import L from 'leaflet';
export default class HomePresenter {
  constructor({ view, model, ui }) {
    this._view = view;
    this._model = model;
    this._ui = ui;
    this._map = null;
    this._markers = [];
  }

  async init() {
    if (this._ui && this._ui.showLoading) this._ui.showLoading(true);
    const stories = await this._model.fetchStories({ size: 100, location: 1 });
    if (this._ui && this._ui.showLoading) this._ui.showLoading(false);
    if (this._view && typeof this._view.renderList === 'function') {
        this._view.renderList(stories);
    }
    this._view.renderList(stories);
    this._initMap(stories);
    this._bindListClicks();
  }

  _initMap(stories = []) {
    const container = this._view.getMapContainer();
    if (!container) return;
    if (this._map) {
      try { this._map.remove(); } catch (e) {}
      this._map = null;
    }
    this._map = L.map(container, { center: [0, 0], zoom: 2 });
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    });
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© OpenTopoMap'
    });

    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "OpenTopoMap": topoLayer
    };
    osmLayer.addTo(this._map);
    L.control.layers(baseMaps).addTo(this._map);

    if (stories && stories.length) {
      const bounds = [];
      stories.forEach(s => {
        if (s.lat != null && s.lon != null) {
          const icon = window.DEFAULT_LEAFLET_ICON || undefined;
          const marker = L.marker([s.lat, s.lon], { icon }).addTo(this._map);
          marker.bindPopup(`<strong>${s.name}</strong><p>${s.description}</p><img src="${s.photoUrl}" alt="${s.name}" style="width:100px;height:auto;display:block;margin-top:6px"/>`);
          this._markers.push(marker);
          bounds.push([s.lat, s.lon]);
        }
      });
      if (bounds.length) this._map.fitBounds(bounds, { padding: [40, 40] });
    }

    setTimeout(() => { try { this._map.invalidateSize(); } catch (e) {} }, 200);
  }

  _bindListClicks() {
    const list = this._view.getListContainer();
    if (!list) return;
    list.addEventListener('click', (e) => {
      const el = e.target.closest('[data-story-id]');
      if (!el) return;
      const id = el.getAttribute('data-story-id');
      const idx = this._view._stories.findIndex(s => s.id === id);
      if (idx >= 0 && this._markers[idx]) {
        this._markers[idx].openPopup();
        this._map.setView(this._markers[idx].getLatLng(), 14);
      }
    });
  }
}
