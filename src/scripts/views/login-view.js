export default class LoginView{
    constructor(){
        this._el = null
        this.onSubmit = null
    }
    render(){
        const container = document.createElement('section')
        container.innerHTML = `
        <h2>Login</h2>
        <form id="login-form" aria-label="Login form">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required />
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required minlength="8" />
            <div style="margin-top:.5rem">
            <button id="login-btn" type="submit">Login</button>
            </div>
        </form>
        <div id="login-message" aria-live="polite"></div>
        `
        this._el = container
        return container
    }
    bindEvents(){
        const form = this._el.querySelector('#login-form')
        form.addEventListener('submit', (e) => {
        e.preventDefault()
        const data = { email: form.email.value, password: form.password.value }
        this.onSubmit && this.onSubmit(data)
        })
    }
    showMessage(text){
        this._el.querySelector('#login-message').textContent = text
    }
}
