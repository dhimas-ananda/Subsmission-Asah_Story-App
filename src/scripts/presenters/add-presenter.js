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
  }

  init() {
    console.log('[AddPresenter] init called, view:', this._view && this._view.constructor && this._view.constructor.name);
    this._bind();
    this._observeMapContainer();
    setTimeout(() => {
      if (!this._mapInitialized) {
        console.log('[AddPresenter] fallback init map triggered');
        this._initMap();
      }
    }, 350);
  }

  _bind() {
    if (this._bound) return;
    this._bound = true;
    console.log('[AddPresenter] binding handlers');

    const fileInput = this._view.getFileInput && this._view.getFileInput();
    const form = this._view.getForm && this._view.getForm();
    if (fileInput) fileInput.addEventListener('change', this._onFileChange.bind(this));
    if (form) form.addEventListener('submit', this._onSubmit.bind(this));

    const rootContainer = document.getElementById('main-content-inner') || document.body;
    rootContainer.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      if (target.matches && target.matches('#camera-btn')) {
        e.preventDefault();
        this._openCamera();
      } else if (target.matches && target.matches('#cancel-camera')) {
        e.preventDefault();
        this._stopCamera();
      } else if (target.matches && target.matches('#capture-btn')) {
        e.preventDefault();
        this._onCaptureClick();
      }
    });
    window.addEventListener('hashchange', () => this._checkMapVisibility());
    window.addEventListener('visibilitychange', () => this._checkMapVisibility());
  }

  _onFileChange(e) {
    const file = e.target && e.target.files && e.target.files[0];
    console.log('[AddPresenter] _onFileChange', !!file);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (this._view && this._view.showPreview) this._view.showPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async _openCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = 'Perangkat tidak mendukung kamera';
        if (this._ui && this._ui.showAlert) this._ui.showAlert(msg);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this._stream = stream;
      if (this._view && this._view.showCameraStream) this._view.showCameraStream(stream);
    } catch (err) {
      console.error('[AddPresenter] getUserMedia error', err);
      let msg = 'Gagal membuka kamera';
      if (err && err.name === 'NotAllowedError') msg = 'Izin kamera ditolak. Periksa permission.';
      if (this._ui && this._ui.showAlert) this._ui.showAlert(msg);
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
        const input = this._view.getFileInput && this._view.getFileInput();
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const reader = new FileReader();
        reader.onload = () => { if (this._view && this._view.showPreview) this._view.showPreview(reader.result); };
        reader.readAsDataURL(file);
      }, 'image/png');
    } catch (e) { console.error('[AddPresenter] capture error', e); }
  }

  _stopCamera() {
    if (this._stream) {
      try { this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this._stream = null;
    }
    if (this._view && this._view.hideCameraStream) this._view.hideCameraStream();
  }

  _observeMapContainer() {
    const container = this._view && this._view.getMapContainer && this._view.getMapContainer();
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
    setTimeout(() => { try { this._map.invalidateSize(); } catch (e) {} }, 200);
  }

  _initMap() {
    if (this._mapInitialized) return;
    const container = this._view && this._view.getMapContainer && this._view.getMapContainer();
    if (!container) return;
    try {
      this._map = L.map(container, { center: [0, 0], zoom: 2 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this._map);
      this._map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (this._marker) this._map.removeLayer(this._marker);
        this._marker = L.marker([lat, lng], { icon: window.DEFAULT_LEAFLET_ICON }).addTo(this._map);
        if (this._view && this._view.setLatInput) this._view.setLatInput(lat);
        if (this._view && this._view.setLonInput) this._view.setLonInput(lng);
      });
      setTimeout(() => { try { this._map.invalidateSize(); } catch (e) {} }, 200);
      this._mapInitialized = true;
      console.log('[AddPresenter] map initialized');
    } catch (e) {
      console.error('[AddPresenter] map init error', e);
    }
  }

  async _onSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;
    this._submitting = true;
    if (this._ui && this._ui.showLoading) this._ui.showLoading(true);
    const form = this._view && this._view.getForm && this._view.getForm();
    const fd = new FormData(form || new HTMLFormElement());
    const token = localStorage.getItem('authToken');
    try {
      if (!navigator.onLine) {
        await queueStoryForSync(fd, token);
        if (this._ui && this._ui.showToast) this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
        location.hash = '#/';
        return;
      }
      const resp = await this._model.createStory(fd, token);
      if (resp && resp.error === false) {
        if (this._ui && this._ui.showToast) this._ui.showToast('Berhasil menambahkan story');
        location.hash = '#/';
        return;
      } else {
        if (!navigator.onLine) {
          await queueStoryForSync(fd, token);
          if (this._ui && this._ui.showToast) this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
          location.hash = '#/';
          return;
        }
        if (this._ui && this._ui.showAlert) this._ui.showAlert((resp && resp.message) || 'Gagal menambahkan story');
      }
    } catch (err) {
      console.error('[AddPresenter] submit error', err);
      if (!navigator.onLine) {
        await queueStoryForSync(fd, token);
        if (this._ui && this._ui.showToast) this._ui.showToast('Tersimpan offline. Akan disinkronkan saat online.');
        location.hash = '#/';
      } else {
        if (this._ui && this._ui.showAlert) this._ui.showAlert('Terjadi kesalahan');
      }
    } finally {
      if (this._ui && this._ui.showLoading) this._ui.showLoading(false);
      this._submitting = false;
    }
  }

  stop() {
    this._stopCamera();
    if (this._observer) {
      try { this._observer.disconnect(); } catch (e) {}
      this._observer = null;
    }
    if (this._map) {
      try { this._map.remove(); } catch (e) {}
      this._map = null;
      this._mapInitialized = false;
      this._marker = null;
    }
    this._bound = false;
  }
}
