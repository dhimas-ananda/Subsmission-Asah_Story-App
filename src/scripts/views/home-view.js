export default class HomeView{
    constructor(){
        this._el = null
        this._map = null
        this._markers = []
        this._items = []
    }
    render(){
        const container = document.createElement('section')
        container.innerHTML = `
        <div class="map-card" role="region" aria-label="Peta cerita">
            <div class="map-card-header" style="display:flex;align-items:center;justify-content:space-between">
            <h2 id="map-title" tabindex="0">Story Map</h2>
            <div aria-hidden="true" style="font-size:.9rem;color:var(--muted)">Klik marker atau daftar untuk melihat detail</div>
            </div>
            <div id="map-home" class="map-container" role="application" aria-labelledby="map-title"></div>
        </div>

        <div class="list-card" role="region" aria-label="Daftar story" style="margin-top:1rem">
            <div style="display:flex;gap:.5rem;align-items:center">
            <label for="filter-input" class="visually-hidden">Filter daftar</label>
            <input id="filter-input" placeholder="Filter nama atau deskripsi" aria-label="Filter daftar" />
            </div>
            <ul id="story-list" class="story-list" aria-live="polite" role="list" style="margin-top:1rem"></ul>
        </div>
        `
        this._el = container
        return container
    }
    bindEvents(){
        const filter = this._el.querySelector('#filter-input')
        filter.addEventListener('input', (e) => {
        const q = (e.target.value || '').toLowerCase().trim()
        const filtered = this._items.filter(it => {
            return !q || (it.name && it.name.toLowerCase().includes(q)) || (it.description && it.description.toLowerCase().includes(q))
        })
        this.showList(filtered)
        this.placeMarkers(filtered)
        })
    }
    showStories(items){
        this._items = items.slice()
        this.showList(this._items)
        this.placeMarkers(this._items)
    }
    showList(items){
        const list = this._el.querySelector('#story-list')
        list.innerHTML = ''
        items.forEach((it, idx) => {
        const li = document.createElement('li')
        li.className = 'story-item'
        li.tabIndex = 0
        li.setAttribute('role','listitem')
        li.dataset.index = idx
        const imgAlt = it.name ? `${it.name}` : ''
        li.innerHTML = `
            <img src="${it.photoUrl || ''}" alt="${imgAlt}" />
            <div>
            <strong class="story-title">${it.name || ''}</strong>
            <div class="story-meta" aria-hidden="true">${it.createdAt || ''}</div>
            <p class="story-desc">${it.description || ''}</p>
            </div>
        `
        li.addEventListener('click', () => {
            if(!this._map || !this._markers) return
            const marker = this._markers[idx]
            if(marker){
            marker.openPopup()
            this._map.setView(marker.getLatLng(), Math.max(this._map.getZoom(), 8), { animate: true })
            } else {
            }
            const els = this._el.querySelectorAll('.story-item')
            els.forEach(e => e.classList.remove('active'))
            li.classList.add('active')
        })
        li.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault()
            li.click()
            }
        })
        list.appendChild(li)
        })
    }
    initMap(){
        const mapEl = this._el.querySelector('#map-home')
        if(this._map){
        try{ this._map.remove() }catch(e){}
        this._map = null
        }
        const map = L.map(mapEl).setView([0,0],2)
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' })
        const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'OpenTopoMap' })
        const watercolor = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', { attribution: 'Stamen' })
        osm.addTo(map)
        const baseMaps = {"OpenStreetMap": osm, "Topographic": topo, "Watercolor": watercolor}
        L.control.layers(baseMaps).addTo(map)
        setTimeout(()=> { try{ map.invalidateSize() }catch(e){} }, 150)
        this._map = map
        return map
    }
    placeMarkers(items){
        if(!this._map) this.initMap()
        if(this._markers && this._markers.length > 0){
        this._markers.forEach(m => { if(m) this._map.removeLayer(m) })
        }
        this._markers = []

        const defaultIcon = window.DEFAULT_LEAFLET_ICON || L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
        })

        items.forEach((it, idx) => {
        if(it.lat && it.lon){
            const m = L.marker([it.lat, it.lon], { icon: defaultIcon }).addTo(this._map)
            const popupHtml = `<strong>${it.name || ''}</strong><p>${it.description || ''}</p>`
            m.bindPopup(popupHtml)
            m.on('click', () => {
            const els = this._el.querySelectorAll('.story-item')
            els.forEach(e => e.classList.remove('active'))
            const li = els[idx]
            if(li) li.classList.add('active')
            })
            this._markers.push(m)
        }else{
            this._markers.push(null)
        }
        })

        const latlngs = this._markers.filter(Boolean).map(m=>m.getLatLng())
        if(latlngs.length > 0){
        const bounds = L.latLngBounds(latlngs)
        this._map.fitBounds(bounds.pad(0.2))
        }
    }
}
