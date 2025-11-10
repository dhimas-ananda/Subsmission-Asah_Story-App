export default class RegisterPresenter{
    constructor({view, model, ui}){
        this.view = view
        this.model = model
        this.ui = ui
    }
    init(){
        this.view.bindEvents()
        this.view.onSubmit = this.submit.bind(this)
    }
    async submit(payload){
        this.ui.showLoading(true)
        try{
        const resp = await this.model.register(payload)
        if(resp && resp.error){
            this.ui.showAlert(resp.message || 'Register gagal')
        }else{
            this.ui.showToast('Register berhasil')
            location.hash = '#/login'
        }
        }catch(e){
        this.ui.showAlert('Terjadi kesalahan saat register')
        }finally{
        this.ui.showLoading(false)
        }
    }
}
