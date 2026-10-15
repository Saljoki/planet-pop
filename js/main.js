import { App } from './App.js';

window.app = new App();

// Offline play and "install as an app": a service worker caches every game file (see sw.js).
if ('serviceWorker' in navigator && window.isSecureContext) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Offline mode unavailable', err)));
}
