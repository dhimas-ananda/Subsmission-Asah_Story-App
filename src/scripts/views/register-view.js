export default class RegisterView{
    constructor(){
        this._el = null
        this.onSubmit = null
    }
    render(){
        const container = document.createElement('section')
        container.innerHTML = `
        <h2>Register</h2>
        <form id="register-form" aria-label="Register form">
            <label for="name">Nama</label>
            <input id="name" name="name" required />
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required />
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required minlength="8" />
            <div style="margin-top:.5rem">
            <button id="register-btn" type="submit">Register</button>
            </div>
        </form>
        <div id="register-message" aria-live="polite"></div>
        `
        this._el = container
        return container
    }
    bindEvents(){
        const form = this._el.querySelector('#register-form')
        form.addEventListener('submit', (e) => {
        e.preventDefault()
        const data = { name: form.name.value, email: form.email.value, password: form.password.value }
        this.onSubmit && this.onSubmit(data)
        })
    }
    showMessage(text){
        this._el.querySelector('#register-message').textContent = text
    }
}
