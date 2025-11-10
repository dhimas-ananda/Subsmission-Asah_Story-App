export default class LoginPresenter{
    constructor({view, model, ui}){
        this.view = view
        this.model = model
        this.ui = ui
    }
    init(){
        this.view.bindEvents()
        this.view.onSubmit = this.submit.bind(this)
    }
    async submit(creds){
        this.ui.showLoading(true)
        try{
        const resp = await this.model.login(creds)
        if(resp && resp.loginResult && resp.loginResult.token){
            const token = resp.loginResult.token
            const username = resp.loginResult.name || ''
            localStorage.setItem('authToken', token)
            localStorage.setItem('username', username)
            window.dispatchEvent(new CustomEvent('login:success', { detail: { token, username } }))
        }else{
            const msg = resp && resp.message ? resp.message : 'Login gagal'
            this.ui.showAlert(msg)
        }
        }catch(e){
        this.ui.showAlert('Terjadi kesalahan saat login')
        console.error(e)
        }finally{
        this.ui.showLoading(false)
        }
    }
}
