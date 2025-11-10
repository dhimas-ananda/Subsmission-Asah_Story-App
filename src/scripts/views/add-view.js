export default class AddView{
    constructor(){
        this._el = null
        this.onSubmit = null
        this.onStartCamera = null
        this.onStopCamera = null
        this.onTakePhoto = null
        this._bound = false
        this._marker = null
    }
    render(){
        const container = document.createElement('section')
        container.innerHTML = `
        <h2>Tambah Story</h2>
        <form id="add-story-form" aria-label="Form tambah story" enctype="multipart/form-data" novalidate>
            <label for="description">Deskripsi</label>
            <textarea id="description" name="description" rows="4" required></textarea>

            <label for="photo">Upload Foto</label>
            <input id="photo" name="photo" type="file" accept="image/*" aria-describedby="photo-desc" />
            <div id="photo-desc" class="visually-hidden">Pilih gambar atau ambil lewat kamera</div>

            <div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <button type="button" id="start-camera">Buka Kamera</button>
            <button type="button" id="stop-camera">Tutup Kamera</button>
            <button type="button" id="take-photo">Ambil Foto</button>
            </div>

            <div style="margin-top:.5rem">
            <video id="camera-preview" autoplay playsinline style="display:none;width:100%;max-height:240px;border:1px solid #ccc;border-radius:8px;"></video>
            <canvas id="camera-canvas" style="display:none;"></canvas>
            </div>

            <div id="photo-preview-wrapper" style="margin-top:.5rem;display:none">
            <label>Preview Foto</label>
            <img id="photo-preview" alt="preview foto" style="display:block;max-width:100%;border-radius:8px;margin-top:.25rem" />
            </div>

            <label for="map-add" style="margin-top:.5rem">Pilih lokasi (klik di peta)</label>
            <div id="map-add" class="map-container" role="application" aria-label="Peta pilih lokasi"></div>
            <input type="hidden" id="lat" name="lat" />
            <input type="hidden" id="lon" name="lon" />

            <div style="margin-top:.75rem">
            <button id="submit-btn" type="submit">Kirim</button>
            </div>
        </form>
        <div id="form-message" aria-live="polite"></div>
        `
        this._el = container
        return container
    }
    bindEvents(){
        if(this._bound) return
        this._bound = true
        const startBtn = this._el.querySelector('#start-camera')
        const stopBtn = this._el.querySelector('#stop-camera')
        const takeBtn = this._el.querySelector('#take-photo')
        const form = this._el.querySelector('#add-story-form')
        const photoInput = this._el.querySelector('#photo')
        startBtn.addEventListener('click', () => this.onStartCamera && this.onStartCamera())
        stopBtn.addEventListener('click', () => this.onStopCamera && this.onStopCamera())
        takeBtn.addEventListener('click', () => this.onTakePhoto && this.onTakePhoto())
        photoInput.addEventListener('change', (e) => {
        this._showPreviewFromFileInput(e.target.files)
        this.onStopCamera && this.onStopCamera()
        })
        form.addEventListener('submit', (e) => {
        e.preventDefault()
        const data = new FormData(form)
        if (data.has('name')) data.delete('name')
        this.onSubmit && this.onSubmit(data)
        })
    }
    setCameraStream(stream){
        const video = this._el.querySelector('#camera-preview')
        video.srcObject = stream
        video.style.display = 'block'
    }
    clearCamera(){
        const video = this._el.querySelector('#camera-preview')
        if(video){
        video.srcObject = null
        video.style.display = 'none'
        }
    }
    setFileFromBlob(blob, filename){
        const file = new File([blob], filename, { type: 'image/png' })
        const input = this._el.querySelector('#photo')
        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files
        this._showPreviewFromFileInput(input.files)
    }
    _showPreviewFromFileInput(files){
        const wrapper = this._el.querySelector('#photo-preview-wrapper')
        const img = this._el.querySelector('#photo-preview')
        if(files && files.length > 0){
        const file = files[0]
        const url = URL.createObjectURL(file)
        img.src = url
        wrapper.style.display = 'block'
        }else{
        img.src = ''
        wrapper.style.display = 'none'
        }
    }
    initMap(){
        const mapEl = this._el.querySelector('#map-add')
        const map = L.map(mapEl).setView([0,0],2)
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
        const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
        osm.addTo(map)
        const baseMaps = {"OpenStreetMap": osm, "Topographic": topo}
        L.control.layers(baseMaps).addTo(map)
        map.on('click', (e) => {
        const lat = e.latlng.lat
        const lon = e.latlng.lng
        this._el.querySelector('#lat').value = lat
        this._el.querySelector('#lon').value = lon
        if(this._marker) map.removeLayer(this._marker)
        const icon = (window.DEFAULT_LEAFLET_ICON) ? window.DEFAULT_LEAFLET_ICON : undefined
        this._marker = L.marker([lat, lon], icon ? { icon } : {}).addTo(map)
        })
        this._map = map
        return map
    }
    stopMap(){
        if(this._map){
        this._map.remove()
        this._map = null
        }
    }
    showMessage(text){
        this._el.querySelector('#form-message').textContent = text
    }
}
