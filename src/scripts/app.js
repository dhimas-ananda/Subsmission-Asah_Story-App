import StoryModel from './models/story-model.js'
import AuthModel from './models/auth-model.js'
import HomeView from './views/home-view.js'
import AddView from './views/add-view.js'
import LoginView from './views/login-view.js'
import RegisterView from './views/register-view.js'
import HomePresenter from './presenters/home-presenter.js'
import AddPresenter from './presenters/add-presenter.js'
import LoginPresenter from './presenters/login-presenter.js'
import RegisterPresenter from './presenters/register-presenter.js'

if (typeof L !== 'undefined' && L && L.Icon && L.Icon.Default) {
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
}
window.DEFAULT_LEAFLET_ICON = (typeof L !== 'undefined') ? L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25,41],
    iconAnchor: [12,41],
    popupAnchor: [1,-34],
    shadowSize: [41,41]
}) : null;

const root = document.getElementById('main-content-inner')
const nav = document.getElementById('main-nav')
const TRANSITION_DURATION = 420

const ui = {
    showLoading(state){
        const el = document.getElementById('loading-overlay')
        if(!el) return
        if(state){
        el.classList.remove('hidden')
        el.setAttribute('aria-hidden','false')
        }else{
        el.classList.add('hidden')
        el.setAttribute('aria-hidden','true')
        }
    },
    showAlert(msg){
        alert(msg)
    },
    showToast(msg){
        const t = document.createElement('div')
        t.className = 'app-toast'
        t.setAttribute('role','status')
        t.textContent = msg
        document.body.appendChild(t)
        setTimeout(()=> t.classList.add('visible'), 10)
        setTimeout(()=> {
        t.classList.remove('visible')
        setTimeout(()=> t.remove(), 300)
        }, 2600)
    },
    updateNav(username){
        nav.innerHTML = ''
        const aHome = document.createElement('a'); aHome.href = '#/'; aHome.textContent = 'Home'
        const aAdd = document.createElement('a'); aAdd.href = '#/add'; aAdd.textContent = 'Tambah'
        nav.appendChild(aHome)
        nav.appendChild(aAdd)
        if(username){
        const span = document.createElement('a'); span.href = '#/'; span.textContent = username; span.setAttribute('aria-current','page')
        const btnLogout = document.createElement('a'); btnLogout.href = '#/'; btnLogout.textContent = 'Logout'; btnLogout.addEventListener('click', (e) => {
            e.preventDefault()
            localStorage.removeItem('authToken')
            localStorage.removeItem('username')
            window.dispatchEvent(new CustomEvent('auth:changed', { detail: null }))
            ui.showToast('Logout berhasil')
            goTo('#/')
        })
        nav.appendChild(span)
        nav.appendChild(btnLogout)
        } else {
        const aLogin = document.createElement('a'); aLogin.href = '#/login'; aLogin.textContent = 'Login'
        const aRegister = document.createElement('a'); aRegister.href = '#/register'; aRegister.textContent = 'Register'
        nav.appendChild(aLogin)
        nav.appendChild(aRegister)
        }
    }
}

const models = { story: new StoryModel(), auth: new AuthModel() }
let current = { view: null, presenter: null }

function mount(view, presenter){
    if(current.presenter && current.presenter.stop){
        try{ current.presenter.stop() }catch(e){}
    }
    root.innerHTML = ''
    const node = view.render()
    root.appendChild(node)
    if(view.bindEvents) view.bindEvents()
    if(presenter && presenter.init) presenter.init()
    const heading = node.querySelector('h2')
    if(heading) heading.focus()
    current = { view, presenter }
}

function fallbackRouteTransition(newRouteApply){
    const el = document.getElementById('main-content-inner')
    if(!el) {
        newRouteApply()
        return
    }
    el.classList.add('route-exit')
    setTimeout(() => {
        newRouteApply()
        el.classList.remove('route-exit')
        el.classList.add('route-enter')
        setTimeout(()=> {
        el.classList.remove('route-enter')
        }, TRANSITION_DURATION)
    }, 80)
}

function applyRoute(route){
    if(route === '/' || route === ''){
        const view = new HomeView()
        const presenter = new HomePresenter({ view, model: models.story, router: goTo, ui })
        mount(view, presenter)
    }else if(route.startsWith('/add')){
        const view = new AddView()
        const presenter = new AddPresenter({ view, model: models.story, ui })
        mount(view, presenter)
    }else if(route.startsWith('/login')){
        const view = new LoginView()
        const presenter = new LoginPresenter({ view, model: models.auth, ui })
        mount(view, presenter)
    }else if(route.startsWith('/register')){
        const view = new RegisterView()
        const presenter = new RegisterPresenter({ view, model: models.auth, ui })
        mount(view, presenter)
    }else{
        root.innerHTML = '<section><h2>Not found</h2></section>'
    }
}

function goTo(hash){
    const route = (hash || location.hash || '#/').replace(/^#/, '')
    if(document.startViewTransition){
        document.startViewTransition(() => applyRoute(route))
    }else{
        fallbackRouteTransition(() => applyRoute(route))
    }
}

window.addEventListener('hashchange', () => goTo(location.hash))
window.addEventListener('load', () => {
    const username = localStorage.getItem('username') || null
    ui.updateNav(username)
    goTo(location.hash)
})

window.addEventListener('auth:changed', (e) => {
    const detail = e.detail
    if(detail && detail.username){
        ui.updateNav(detail.username)
    }else{
        ui.updateNav(null)
    }
})
window.addEventListener('login:success', (e) => {
    const d = e.detail || {}
    localStorage.setItem('authToken', d.token)
    localStorage.setItem('username', d.username || '')
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { username: d.username } }))
    ui.showToast('Login berhasil')
    goTo('#/')
})
window.addEventListener('register:success', (e) => {
    ui.showToast('Register berhasil, silakan login')
    goTo('#/login')
})
