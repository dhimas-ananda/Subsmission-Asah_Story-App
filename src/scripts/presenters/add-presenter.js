import L from 'leaflet';
import { queueStoryForSync } from '../services/offline-sync.js';

export default class AddPresenter {
  constructor({ view, model, router, ui }) {
    this._view = view;
    this._model = model;
    this._router = router;
    this._ui = ui;
    this._map = null;
    this._marker = null;
    this._stream = null;
    this._bound = false;
    this._submitting = false;
    this._observer = null;
    this._mapInitialized = false;
    this._invalidateTimer = null;
  }

  init() {
    this._bind();
    this._observeMapContainer();
    setTimeout(() => {
      if (!this._mapInitialized) this._initMap();
    }, 350);
  }

  _bind() {
    if (this._bound) return;
    this._bound = true;

    const fileInput = this._view && typeof this._view.getFileInput === 'function' ? this._view.getFileInput() : null;
    const form = this._view && typeof this._view.getForm === 'function' ? this._view.getForm() : null;
    if (fileInput) fileInput.addEventListener('change', (e) => this._onFileChange(e));
    if (form) form.addEventListener('submit', (e) => this._onSubmit(e));

    const rootContainer = document.getElementById('main-content-inner') || document.body;
    this._rootClickHandler = (e) => {
      const cameraBtn = e.target && e.target.closest && e.target.closest('#camera-btn');
      const cancelBtn = e.target && e.target.closest && e.target.closest('#cancel-camera');
      const captureBtn = e.target && e.target.closest && e.target.closest('#capture-btn');
      if (cameraBtn) {
        e.preventDefault();
        this._openCamera();
      } else if (cancelBtn) {
        e.preventDefault();
        this._stopCamera();
      } else if (captureBtn) {
        e.preventDefault();
        this._onCaptureClick();
      }
    };
    rootContainer.addEventListener('click', this._rootClickHandler);
    this._hashChangeHandler = () => this._checkMapVisibility();
    this._visibilityHandler = () => this._checkMapVisibility();
    window.addEventListener('hashchange', this._hashChangeHandler);
    window.addEventListener('visibilitychange', this._visibilityHandler);
  }

  _onFileChange(e) {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (this._view && typeof this._view.showPreview === 'function') this._view.showPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async _openCamera() {
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        const msg = 'Perangkat tidak mendukung kamera';
        if (this._ui && typeof this._ui.showAlert === 'function') this._ui.showAlert(msg);
        return;
      }
      if (this._stream) this._stopCamera();
      const constraints = { video: { facingMode: 'environment' } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._stream = stream;
      if (this._view && typeof this._view.showCameraStream === 'function') this._view.showCameraStream(stream);
    } catch (err) {
      let msg = 'Gagal membuka kamera';
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) msg = 'Izin kamera ditolak. Periksa permission.';
      if (this._ui && typeof this._ui.showAlert === 'function') this._ui.showAlert(msg);
    }
  }

  _onCaptureClick() {
    try {
      const video = document.getElementById('camera-video');
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
        const input = this._view && typeof this._view.getFileInput === 'function' ? this._view.getFileInput() : null;
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const reader = new FileReader();
          reader.onload = () => { if (this._view && typeof this._view.showPreview === 'function') this._view.showPreview(reader.result); };
          reader.readAsDataURL(file);
        }
      }, 'image/png');
    } catch (e) {}
  }

  _stopCamera() {
    if (this._stream) {
      try { this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this._stream = null;
    }
    if (this._view && typeof this._view.hideCameraStream === 'function') this._view.hideCameraStream();
  }

  _observeMapContainer() {
    const container = this._view && typeof this._view.getMapContainer === 'function' ? this._view.getMapContainer() : null;
    if (!container) {
      setTimeout(() => this._observeMapContainer(), 150);
      return;
    }
    if (this._mapInitialized) return;
    try {
      this._observer = new IntersectionObserver((entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            if (this._observer) { try { this._observer.disconnect(); } catch(e) {} }
            this._observer = null;
            this._initMap();
            break;
          }
        }
      }, { threshold: 0.05 });
      this._observer.observe(container);
    } catch (e) {
      this._initMap();
    }
  }

  _checkMapVisibility() {
    if (!this._map) return;
    clearTimeout(this._invalidateTimer);
    this._invalidateTimer = setTimeout(() => {
      try { this._map.invalidateSize(); } catch (e) {}
    }, 200);
  }

  _initMap() {
    if (this._mapInitialized) return;
    const container = this._view && typeof this._view.getMapContainer === 'function' ? this._view.getMapContainer() : null;
    if (!container) return;
    try {
      this._map = L.map(container, { center: [0, 0], zoom: 2 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this._map);
      this._map.on('click', (e) => {
        const { lat, lng } = e.latlng || {};
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        if (this._marker) try { this._map.removeLayer(this._marker); } catch (e) {}
        const icon = window.DEFAULT_LEAFLET_ICON || (L && L.icon ? L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25,41], iconAnchor: [12,41] }) : null);
        try { this._marker = L.marker([lat, lng], { icon }).addTo(this._map); } catch(e) {}
        if (this._view && typeof this._view.setLatInput === 'function') this._view.setLatInput(lat);
        if (this._view && typeof this._view.setLonInput === 'function') this._view.setLonInput(lng);
      });
      setTimeout(() => { try { this._map.invalidateSize(); } catch (e) {} }, 200);
      this._mapInitialized = true;
    } catch (e) {}
  }

  async _onSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    this._submitting = true;
    if (this._ui && typeof this._ui.showLoading === 'function') this._ui.showLoading(true);
    const form = this._view && typeof this._view.getForm === 'function' ? this._view.getForm() : null;
    const fd = form ? new FormData(form) : new FormData();
    const token = localStorage.getItem('authToken');
    try {
      if (!navigator.onLine) {
        await queueStoryForSync(fd, token);
        if (this._ui && typeof this._ui.showToast === 'function') this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
        location.hash = '#/';
        return;
      }
      const resp = await this._model.createStory(fd, token);
      if (resp && resp.error === false) {
        if (this._ui && typeof this._ui.showToast === 'function') this._ui.showToast('Berhasil menambahkan story');
        location.hash = '#/';
        return;
      } else {
        if (!navigator.onLine) {
          await queueStoryForSync(fd, token);
          if (this._ui && typeof this._ui.showToast === 'function') this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
          location.hash = '#/';
          return;
        }
        if (this._ui && typeof this._ui.showAlert === 'function') this._ui.showAlert((resp && resp.message) || 'Gagal menambahkan story');
      }
    } catch (err) {
      if (!navigator.onLine) {
        await queueStoryForSync(fd, token);
        if (this._ui && typeof this._ui.showToast === 'function') this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
        location.hash = '#/';
      } else {
        if (this._ui && typeof this._ui.showAlert === 'function') this._ui.showAlert('Terjadi kesalahan');
      }
    } finally {
      if (this._ui && typeof this._ui.showLoading === 'function') this._ui.showLoading(false);
      this._submitting = false;
    }
  }

  stop() {
    this._stopCamera();
    if (this._observer) { try { this._observer.disconnect(); } catch (e) {} this._observer = null; }
    if (this._map) { try { this._map.remove(); } catch (e) {} this._map = null; this._mapInitialized = false; this._marker = null; }
    if (this._rootClickHandler) {
      const rootContainer = document.getElementById('main-content-inner') || document.body;
      try { rootContainer.removeEventListener('click', this._rootClickHandler); } catch (e) {}
      this._rootClickHandler = null;
    }
    if (this._hashChangeHandler) { try { window.removeEventListener('hashchange', this._hashChangeHandler); } catch(e) {} this._hashChangeHandler = null; }
    if (this._visibilityHandler) { try { window.removeEventListener('visibilitychange', this._visibilityHandler); } catch(e) {} this._visibilityHandler = null; }
    this._bound = false;
  }
}
