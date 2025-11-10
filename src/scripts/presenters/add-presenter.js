import { queueStoryForSync } from '../services/offline-sync.js'
export default class AddPresenter{
    async submit(formData){
    this.ui.showLoading(true)
    try{
        const token = localStorage.getItem('authToken')
        const resp = await this.model.createStory(formData, token)
        if(resp && resp.ok){
        }else{
        if(!navigator.onLine){
            await queueStoryForSync(formData, token)
            this.ui.showToast('Tersimpan offline. Akan disinkronkan saat online.')
            location.hash = '#/'
            return
        } else {
            let txt = await resp.text().catch(()=> 'Gagal mengirim')
            this.ui.showAlert('Gagal mengirim: '+txt)
        }
        }
    } catch(e){
        if(!navigator.onLine){
        await queueStoryForSync(formData, token)
        this.ui.showToast('Tersimpan offline. Akan disinkronkan saat online.')
        location.hash = '#/'
        return
        }
        this.ui.showAlert('Terjadi kesalahan saat mengirim')
    } finally { this.ui.showLoading(false) }
    }

    constructor({view, model, ui}){
        this.view = view
        this.model = model
        this.ui = ui
        this._stream = null
        this._submitting = false
        this._onHashChange = this.stopCamera.bind(this)
    }
    init(){
        this.view.bindEvents()
        this.view.initMap()
        this.view.onStartCamera = this.startCamera.bind(this)
        this.view.onStopCamera = this.stopCamera.bind(this)
        this.view.onTakePhoto = this.takePhoto.bind(this)
        this.view.onSubmit = this.submit.bind(this)
        window.addEventListener('hashchange', this._onHashChange)
    }
    async startCamera(){
        try{
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        this._stream = stream
        this.view.setCameraStream(stream)
        }catch(e){
        this.ui.showAlert('Gagal membuka kamera')
        }
    }
    stopCamera(){
        if(this._stream){
        this._stream.getTracks().forEach(t=>t.stop())
        this._stream = null
        }
        try{
        this.view.clearCamera()
        }catch(e){}
    }
    takePhoto(){
        const video = this.view._el.querySelector('#camera-preview')
        const canvas = this.view._el.querySelector('#camera-canvas')
        if(!video || !canvas) return
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video,0,0,canvas.width,canvas.height)
        canvas.toBlob((blob)=>{
        if(!blob) return
        this.view.setFileFromBlob(blob, 'photo.png')
        this.stopCamera()
        }, 'image/png')
    }
    async submit(formData){
        if(this._submitting) return
        this._submitting = true
        const submitBtn = this.view._el.querySelector('#submit-btn')
        if(submitBtn) submitBtn.disabled = true

        try{
        if(!formData.get('description')){
            this.ui.showAlert('Deskripsi wajib diisi')
            return
        }
        const photo = formData.get('photo')
        if(!photo || (photo.size !== undefined && photo.size === 0)){
            this.ui.showAlert('Foto wajib disertakan')
            return
        }
        if(photo.size > 1024 * 1024){
            this.ui.showAlert('Ukuran foto maksimal 1MB. Silakan pilih gambar lebih kecil.')
            return
        }

        const fd = new FormData()
        fd.append('description', formData.get('description'))
        fd.append('photo', photo)
        const lat = formData.get('lat')
        const lon = formData.get('lon')
        if(lat) fd.append('lat', lat)
        if(lon) fd.append('lon', lon)

        this.ui.showLoading(true)
        const token = localStorage.getItem('authToken')
        const resp = await this.model.createStory(fd, token)
        if(resp && resp.ok){
            this.ui.showToast('Berhasil menambahkan story')
            this.stopCamera()
            try{ this.view.stopMap() }catch(e){}
            location.hash = '#/'
        }else{
            let txt = ''
            try{ txt = await resp.text() }catch(e){ txt = 'Gagal mengirim' }
            this.ui.showAlert('Gagal mengirim: '+txt)
        }
        }catch(e){
        this.ui.showAlert('Terjadi kesalahan saat mengirim')
        console.error(e)
        }finally{
        this._submitting = false
        if(submitBtn) submitBtn.disabled = false
        this.ui.showLoading(false)
        }
    }
    stop(){
        this.stopCamera()
        try{ this.view.stopMap() }catch(e){}
        window.removeEventListener('hashchange', this._onHashChange)
    }
}
