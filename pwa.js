(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  let refreshing = false;
  let hasActiveServiceWorker = navigator.serviceWorker.controller !== null;

  window.addEventListener('load', () => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifestHref = manifestLink ? manifestLink.href : window.location.href;
    const serviceWorkerUrl = new URL('service-worker.js', manifestHref).href;

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasActiveServiceWorker) {
      hasActiveServiceWorker = true;
      return;
    }

    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });
})();
