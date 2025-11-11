export default class AddView {
  constructor() {
    this._mapId = 'map-add';
  }
  render() {
    const main = document.getElementById('main-content-inner') || document.getElementById('app') || document.body;
    const container = document.createElement('section');
    container.className = 'add-page';
    container.innerHTML = `
      <form id="add-form" class="form-add" aria-label="Form tambah story">
        <h2 tabindex="0">Tambah Story</h2>
        <label for="photo">Foto</label>
        <input id="photo" name="photo" type="file" accept="image/*" aria-describedby="photo-desc" />
        <div style="margin-top:8px">
          <button type="button" id="camera-btn" aria-label="Buka kamera">Buka Kamera</button>
          <button type="button" id="cancel-camera" aria-label="Tutup kamera" style="display:none">Tutup Kamera</button>
        </div>
        <div id="camera-preview" style="display:none;margin-top:8px">
          <video id="camera-video" autoplay playsinline style="max-width:100%"></video>
          <div style="margin-top:6px">
            <button id="capture-btn" type="button">Ambil Foto</button>
          </div>
        </div>
        <div id="preview-wrap" aria-hidden="true" style="margin-top:8px"></div>
        <label for="desc">Deskripsi</label>
        <textarea id="desc" name="description" rows="4"></textarea>
        <div id="${this._mapId}" class="map-container" style="height:360px;margin-top:12px;border:1px solid #ddd;border-radius:8px" role="application" aria-label="Peta pilih lokasi"></div>
        <input id="lat" name="lat" type="hidden" />
        <input id="lon" name="lon" type="hidden" />
        <div style="margin-top:8px">
          <button type="submit">Kirim</button>
        </div>
      </form>
    `;
    main.innerHTML = '';
    main.appendChild(container);
    return container;
  }
  getMapContainer() { return document.getElementById(this._mapId); }
  getFileInput() { return document.getElementById('photo'); }
  getCameraButton() { return document.getElementById('camera-btn'); }
  getCancelCameraButton() { return document.getElementById('cancel-camera'); }
  getForm() { return document.getElementById('add-form'); }
  showPreview(dataUrl) {
    const wrap = document.getElementById('preview-wrap');
    wrap.innerHTML = `<img src="${dataUrl}" alt="preview" style="max-width:100%;border-radius:6px" />`;
    wrap.setAttribute('aria-hidden', 'false');
  }
  showCameraStream(stream) {
    const preview = document.getElementById('camera-preview');
    const video = document.getElementById('camera-video');
    const cancelBtn = document.getElementById('cancel-camera');
    preview.style.display = 'block';
    cancelBtn.style.display = 'inline-block';
    video.srcObject = stream;
    video.play().catch(()=>{});
  }
  hideCameraStream() {
    const preview = document.getElementById('camera-preview');
    const video = document.getElementById('camera-video');
    const cancelBtn = document.getElementById('cancel-camera');
    preview.style.display = 'none';
    cancelBtn.style.display = 'none';
    if (video && video.srcObject) {
      try {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(t => t.stop());
      } catch (e) {}
      video.srcObject = null;
    }
  }
  setLatInput(lat) { const el = document.getElementById('lat'); if (el) el.value = lat; }
  setLonInput(lon) { const el = document.getElementById('lon'); if (el) el.value = lon; }
}
