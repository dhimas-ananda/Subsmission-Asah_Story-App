if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('ServiceWorker registered', reg);

        navigator.serviceWorker.addEventListener('message', (ev) => {
            const data = ev.data || {};
            if (data.type === 'navigate' && data.url) {
            location.href = data.url;
            }
        });

        if (reg.sync) {
            console.log('Background sync supported');
        } else {
            console.log('Background sync not supported - will use online event fallback');
        }
        } catch (err) {
        console.error('SW registration failed', err);
        }
    });
}