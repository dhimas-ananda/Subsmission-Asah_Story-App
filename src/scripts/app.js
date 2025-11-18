import StoryModel from './models/story-model.js'
import AuthModel from './models/auth-model.js'
import HomeView from './views/home-view.js'
import AddView from './views/add-view.js'
import LoginView from './views/login-view.js'
import RegisterView from './views/register-view.js'
import StoryDetailView from './views/story-detail-view.js'
import BookmarksView from './views/bookmarks-view.js'
import HomePresenter from './presenters/home-presenter.js'
import AddPresenter from './presenters/add-presenter.js'
import LoginPresenter from './presenters/login-presenter.js'
import RegisterPresenter from './presenters/register-presenter.js'
import StoryDetailPresenter from './presenters/story-detail-presenter.js'
import BookmarksPresenter from './presenters/bookmarks-presenter.js'
import { idbGetAll } from './lib/idb.js';

(async function initDB() {
  try {
    console.log('🗄️ Initializing IndexedDB...');
    await idbGetAll('outbox'); 
    console.log('✅ IndexedDB ready');
  } catch (e) {
    console.error('❌ Failed to initialize IndexedDB:', e);
  }
})();

window.addEventListener('online', () => {
  document.body.classList.remove('offline');
  console.log('🌐 Back online');
  
  if (window.ui && window.ui.showToast) {
    window.ui.showToast('🌐 Kembali online');
  }
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) {
        console.log('📤 Triggering outbox flush...');
        reg.active.postMessage('flush-outbox');
      }
    });
  }
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  console.log('📴 Went offline');
  
  if (window.ui && window.ui.showToast) {
    window.ui.showToast('📴 Anda offline. Data akan disinkronkan saat online.');
  }
});

if (!navigator.onLine) {
  document.body.classList.add('offline');
}

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
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
}) : null;

const root = document.getElementById('main-content-inner')
const nav = document.getElementById('main-nav')
const TRANSITION_DURATION = 420

const ui = {
  showLoading(state) {
    const el = document.getElementById('loading-overlay')
    if (!el) return
    if (state) {
      el.classList.remove('hidden')
      el.setAttribute('aria-hidden', 'false')
    } else {
      el.classList.add('hidden')
      el.setAttribute('aria-hidden', 'true')
    }
  },
  showAlert(msg) {
    alert(msg)
  },
  showToast(msg) {
    const t = document.createElement('div')
    t.className = 'app-toast'
    t.setAttribute('role', 'status')
    t.textContent = msg
    document.body.appendChild(t)
    setTimeout(() => t.classList.add('visible'), 10)
    setTimeout(() => {
      t.classList.remove('visible')
      setTimeout(() => t.remove(), 300)
    }, 2600)
  },
  updateNav(username) {
    nav.innerHTML = ''
    
    const aHome = document.createElement('a')
    aHome.href = '#/'
    aHome.textContent = 'Home'
    
    const aBookmarks = document.createElement('a')
    aBookmarks.href = '#/bookmarks'
    aBookmarks.textContent = 'Bookmarks'
    
    const aAdd = document.createElement('a')
    aAdd.href = '#/add'
    aAdd.textContent = 'Tambah'
    
    nav.appendChild(aHome)
    nav.appendChild(aAdd)
    nav.appendChild(aBookmarks)
    
    if (username) {
      const span = document.createElement('a')
      span.href = '#/'
      span.textContent = username
      span.setAttribute('aria-current', 'page')
      
      const btnLogout = document.createElement('a')
      btnLogout.href = '#/'
      btnLogout.textContent = 'Logout'
      btnLogout.addEventListener('click', (e) => {
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
      const aLogin = document.createElement('a')
      aLogin.href = '#/login'
      aLogin.textContent = 'Login'
      
      const aRegister = document.createElement('a')
      aRegister.href = '#/register'
      aRegister.textContent = 'Register'
      
      nav.appendChild(aLogin)
      nav.appendChild(aRegister)
    }
  }
}

window.ui = ui

const models = { story: new StoryModel(), auth: new AuthModel() }

let current = { view: null, presenter: null }

function mount(view, presenter) {
  if (current.presenter && current.presenter.destroy) {
    try { current.presenter.destroy() } catch (e) {}
  }
  if (current.presenter && current.presenter.stop) {
    try { current.presenter.stop() } catch (e) {}
  }
  
  root.innerHTML = ''
  const node = view.render()
  root.appendChild(node)
  
  if (view.bindEvents) view.bindEvents()
  
  if (presenter && presenter.init) {
    presenter.init()
  }
  
  const heading = node.querySelector('h2, h1')
  if (heading) heading.focus()
  
  current = { view, presenter }
}

function fallbackRouteTransition(newRouteApply) {
  const el = document.getElementById('main-content-inner')
  if (!el) {
    newRouteApply()
    return
  }
  
  el.classList.add('route-exit')
  setTimeout(() => {
    newRouteApply()
    el.classList.remove('route-exit')
    el.classList.add('route-enter')
    setTimeout(() => {
      el.classList.remove('route-enter')
    }, TRANSITION_DURATION)
  }, 80)
}

function parseRoute(route) {
  const parts = route.split('/')
  
  if (route === '/' || route === '') {
    return { type: 'home', params: {} }
  } else if (route === '/bookmarks') {
    return { type: 'bookmarks', params: {} }
  } else if (route.startsWith('/add')) {
    return { type: 'add', params: {} }
  } else if (route.startsWith('/login')) {
    return { type: 'login', params: {} }
  } else if (route.startsWith('/register')) {
    return { type: 'register', params: {} }
  } else if (route.startsWith('/story/')) {
    const id = parts[2]
    if (id) {
      return { type: 'story-detail', params: { id } }
    }
  }
  
  return { type: 'not-found', params: {} }
}

function applyRoute(route) {
  const parsed = parseRoute(route)
  
  switch (parsed.type) {
    case 'home': {
      const view = new HomeView()
      const presenter = new HomePresenter({ view, model: models.story, router: goTo, ui })
      mount(view, presenter)
      break
    }
    
    case 'bookmarks': {
      const view = new BookmarksView()
      const presenter = new BookmarksPresenter({ view, ui })
      mount(view, presenter)
      break
    }
    
    case 'story-detail': {
        const view = new StoryDetailView()
        const presenter = new StoryDetailPresenter({ view, model: models.story, ui })
        mount(view, null)  
        presenter.init(parsed.params.id) 
        current = { view, presenter }  
        break
    }
    
    case 'add': {
      const view = new AddView()
      const presenter = new AddPresenter({ view, model: models.story, ui })
      mount(view, presenter)
      break
    }
    
    case 'login': {
      const view = new LoginView()
      const presenter = new LoginPresenter({ view, model: models.auth, ui })
      mount(view, presenter)
      break
    }
    
    case 'register': {
      const view = new RegisterView()
      const presenter = new RegisterPresenter({ view, model: models.auth, ui })
      mount(view, presenter)
      break
    }
    
    default: {
      root.innerHTML = '<section><h2>Not found</h2><p>Halaman yang Anda cari tidak ditemukan.</p><a href="#/" class="btn-primary">Kembali ke Home</a></section>'
    }
  }
}

function goTo(hash) {
  const route = (hash || location.hash || '#/').replace(/^#/, '')
  
  if (document.startViewTransition) {
    document.startViewTransition(() => applyRoute(route))
  } else {
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
  if (detail && detail.username) {
    ui.updateNav(detail.username)
  } else {
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

window.addEventListener('load', () => {
  import('./notification.js').then(module => {
    if (module.initPushButton) {
      module.initPushButton();
    }
  }).catch(e => {
    console.error('Error loading notification module:', e);
  });
});

window.addEventListener('online', () => {
  document.body.classList.remove('offline');
  if (ui && ui.showToast) {
    ui.showToast('Kembali online');
  }
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) {
        reg.active.postMessage('flush-outbox');
      }
    });
  }
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  if (ui && ui.showAlert) {
    ui.showAlert('Anda sedang offline. Data akan disinkronkan saat online kembali.');
  }
});

if (!navigator.onLine) {
  document.body.classList.add('offline');
}