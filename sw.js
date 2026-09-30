var CACHE_VERSION = 'smo-tracker-v1';
var CACHE_NAME = CACHE_VERSION + '-static';

var APP_SHELL = [
  './',
  './index.html',
  './map.html',
  './notes.html',
  './apc.html',
  './obs.html',

  './style.css',

  './app.js?v=8',
  './sync.js',
  './apc-data.js?v=3',
  './spoiler-log.js?v=1',
  './firebase-progress-sync.js?v=2',
  './firebase-live-sync.js',

  './loading_zone_dictionary.json',

  './manifest.json',

  './assets/SMO-ColoredGlobe.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});


self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (
              cacheName.indexOf('smo-tracker-') === 0 &&
              cacheName !== CACHE_NAME
            ) {
              return caches.delete(cacheName);
            }

            return Promise.resolve();
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});


self.addEventListener('fetch', function (event) {
  var request = event.request;

  /*
   * Only handle GET requests.
   * POST/PUT/etc. should go directly to the network.
   */
  if (request.method !== 'GET') {
    return;
  }

  /*
   * Page navigation:
   *
   * Try the network first so the app can update normally.
   * If there is no connection, use the cached index.html.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var responseClone = response.clone();

            caches.open(CACHE_NAME)
              .then(function (cache) {
                cache.put(request, responseClone);
              });

            return response;
          }

          return caches.match('./index.html');
        })
        .catch(function () {
          return caches.match('./index.html');
        })
    );

    return;
  }


  /*
   * Same-origin application files:
   *
   * Cache first.
   *
   * This makes the app continue working when completely offline.
   */
  var requestUrl = new URL(request.url);

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request)
            .then(function (response) {
              if (response && response.ok) {
                var responseClone = response.clone();

                caches.open(CACHE_NAME)
                  .then(function (cache) {
                    cache.put(request, responseClone);
                  });
              }

              return response;
            });
        })
        .catch(function () {
          return new Response('', {
            status: 503,
            statusText: 'Offline'
          });
        })
    );

    return;
  }


  /*
   * External resources:
   *
   * Let normal browser networking handle these.
   *
   * The tracker has online-only services such as Firebase and
   * the WebSocket synchronization server. They must not be
   * replaced by fake cached responses.
   */
});