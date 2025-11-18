import L from 'leaflet';
import { queueStoryForSync } from '../services/offline-sync.js';
import { ensurePushSubscription } from '../notification.js';

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
    this._bind();
    this._observeMapContainer();
    setTimeout(() => {
      if (!this._mapInitialized) this._initMap();
    }, 350);
  }

  _bind() {
    if (this._bound) return;
    this._bound = true;
    const fileInput = this._view.getFileInput && this._view.getFileInput();
    const form = this._view.getForm && this._view.getForm();
    if (fileInput) fileInput.addEventListener('change', this._onFileChange.bind(this));
    if (form) form.addEventListener('submit', this._onSubmit.bind(this));
    const rootContainer = document.getElementById('main-content-inner') || document.body;
    rootContainer.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      if (target.matches && target.matches('#camera-btn')) { e.preventDefault(); this._openCamera(); }
      else if (target.matches && target.matches('#cancel-camera')) { e.preventDefault(); this._stopCamera(); }
      else if (target.matches && target.matches('#capture-btn')) { e.preventDefault(); this._onCaptureClick(); }
    });
    window.addEventListener('hashchange', () => this._checkMapVisibility());
    window.addEventListener('visibilitychange', () => this._checkMapVisibility());
  }

  _onFileChange(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (this._view && this._view.showPreview) this._view.showPreview(reader.result); };
    reader.readAsDataURL(file);
  }

  async _openCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (this._ui && this._ui.showAlert) this._ui.showAlert('Perangkat tidak mendukung kamera');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this._stream = stream;
      if (this._view && this._view.showCameraStream) this._view.showCameraStream(stream);
    } catch (err) {
      if (this._ui && this._ui.showAlert) {
        if (err && err.name === 'NotAllowedError') this._ui.showAlert('Izin kamera ditolak. Periksa permission.');
        else this._ui.showAlert('Gagal membuka kamera');
      }
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
    } catch (e) {}
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
    if (!container) { setTimeout(() => this._observeMapContainer(), 150); return; }
    if (this._mapInitialized) return;
    try {
      this._observer = new IntersectionObserver((entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting) {
            try { this._observer.disconnect(); } catch(e) {}
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
    } catch (e) {}
  }

  async _onSubmit(e) {
    e.preventDefault();

    if (this._submitting) {
      console.log('⏳ Already submitting...');
      return;
    }

    this._submitting = true;
    console.log('📝 Form submit started');
    console.log('🌐 Online status:', navigator.onLine);

    const form = this._view && this._view.getForm && this._view.getForm();

    if (!form) {
      console.error('❌ Form not found');
      this._submitting = false;
      return;
    }

    const fd = new FormData(form);
    const token = localStorage.getItem('authToken');

    if (!token) {
      console.error('❌ No auth token');
      if (this._ui && this._ui.showAlert) {
        this._ui.showAlert('Login dulu untuk menambah story');
      }
      this._submitting = false;
      location.hash = '#/login';
      return;
    }

    console.log('📋 Form data:');
    for (let [key, value] of fd.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }

    if (navigator.onLine) {
      try {
        const { ensurePushSubscription } = await import('../notification.js');
        await ensurePushSubscription();
      } catch (e) {
        console.log('⚠️ Push subscription optional:', e);
      }
    }

    if (this._ui && this._ui.showLoading) this._ui.showLoading(true);

    try {
      console.log('🚀 Submitting story via model...');
      const resp = await this._model.createStory(fd, token);

      console.log('📡 Model response:', resp);

      if (this._ui && this._ui.showLoading) this._ui.showLoading(false);

      if (resp && resp.error === false) {
        console.log('✅ Story submitted successfully');
        
        if (resp.queued) {
          if (this._ui && this._ui.showToast) {
            this._ui.showToast('📴 Story tersimpan offline. Akan dikirim saat online.');
          }
        } else {
          if (this._ui && this._ui.showToast) {
            this._ui.showToast('✅ Story berhasil ditambahkan!');
          }
        }

        this._submitting = false;
        
        setTimeout(() => {
          location.hash = '#/';
        }, 1500);
        
        return;
      }

      throw new Error(resp?.message || 'Gagal menambahkan story');

    } catch (err) {
      console.error('❌ Submit error:', err);

      if (this._ui && this._ui.showLoading) this._ui.showLoading(false);
      
      if (this._ui && this._ui.showAlert) {
        this._ui.showAlert('Gagal menambahkan story: ' + err.message);
      }

      this._submitting = false;
    }
  }

  stop() {
    this._stopCamera();
    if (this._observer) { try { this._observer.disconnect(); } catch (e) {} this._observer = null; }
    if (this._map) { try { this._map.remove(); } catch (e) {} this._map = null; this._mapInitialized = false; this._marker = null; }
    this._bound = false;
  }
}
