export default class HomePresenter {
    constructor({ view, model, router, ui }) {
        this.view = view;
        this.model = model;
        this.router = router;
        this.ui = ui;
    }
    async init() {
        this.ui.showLoading(true);
        try {
        this.view.bindEvents();
        this.view.initMap();
        const token = localStorage.getItem('authToken') || null;
        const data = await this.model.fetchStories(token);

        if (!data || data.error) {
            const msg = (data && data.message) ? data.message : 'Gagal memuat story. Silakan login.';
            this.ui.showAlert(msg);
            this.view.showStories([]);
            return;
        }

        const raw = data.listStory || data.list || [];
        const items = raw.map((i) => ({
            id: i.id || i.storyId || i._id || '',
            name: i.name || '',
            description: i.description || '',
            photoUrl: i.photoUrl || i.photo || i.photo_url || '',
            lat: (i.lat !== undefined && i.lon !== undefined) ? Number(i.lat) : (i.lat ? Number(i.lat) : (i.latitude ? Number(i.latitude) : null)),
            lon: (i.lon !== undefined && i.lat !== undefined) ? Number(i.lon) : (i.lon ? Number(i.lon) : (i.longitude ? Number(i.longitude) : null)),
            createdAt: i.createdAt || i.created_at || '',
        }));

        this.view.showStories(items);
        this.view.placeMarkers(items);
        } catch (err) {
        this.ui.showAlert('Terjadi kesalahan saat memuat story');
        console.error(err);
        } finally {
        this.ui.showLoading(false);
        }
    }
}
