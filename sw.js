/**
 * WebGIS Service Worker for Low-Network & Offline Performance
 * Kalady Grama Panchayat Geographical Resource Mapping
 */

const CACHE_VERSION = 'webgis-v1';
const CACHE_CORE = `webgis-core-${CACHE_VERSION}`;
const CACHE_LAYERS = `webgis-layers-${CACHE_VERSION}`;
const CACHE_TILES = `webgis-tiles-${CACHE_VERSION}`;
const MAX_TILE_CACHE = 600;

// Application shell assets to pre-cache on install
const PRECACHE_ASSETS = [
    './index.html',
    './lsgd-logo.png',
    './KALADY map.jpeg',
    './images (19).jpg',
    './manifest.json',
    './network-manager.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/index.html',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/ol.css',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/ol.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/ol-layerswitcher.css',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/ol-layerswitcher.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/qgis2web.css',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/qgis2web.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/functions.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/qgis2web_expressions.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/resources/Autolinker.min.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/layers/layers.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/layers/WardKalady_12.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/layers/Kalady_7.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/layers/Roads_10.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/layers/Streams_11.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/WardKalady_12_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Kalady_7_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Roads_10_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Streams_11_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Buildings_8_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Contours_9_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Geology_6_style.js',
    './mapsss/proje/qgis2web_2026_10_28-20_19_46_358272/styles/Geomorphology_5_style.js'
];

// Base64 transparent 1x1 PNG for offline tile fallback
const EMPTY_TILE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Install event - precache application shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_CORE).then((cache) => {
            return Promise.allSettled(
                PRECACHE_ASSETS.map((url) => {
                    return fetch(url, { cache: 'no-cache' }).then((response) => {
                        if (response.ok) {
                            return cache.put(url, response);
                        }
                    }).catch(() => {
                        // Tolerate single asset missing during offline install
                    });
                })
            );
        }).then(() => self.skipWaiting())
    );
});

// Activate event - clean up outdated caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (![CACHE_CORE, CACHE_LAYERS, CACHE_TILES].includes(key)) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Helper: Trim tile cache to prevent excessive storage
async function trimCache(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            await cache.delete(keys[0]);
            await trimCache(cacheName, maxItems);
        }
    } catch (e) {
        // Ignore cache cleanup errors
    }
}

// Fetch event - adaptive network handling
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Map Tiles (OSM, Google Satellite, XYZ)
    if (url.hostname.includes('tile.openstreetmap.org') || 
        url.hostname.includes('google.com') || 
        url.pathname.includes('/vt/lyrs=')) {
        event.respondWith(handleTileFetch(event.request));
        return;
    }

    // 2. Large GIS Layer Files (Buildings_8.js, Contours_9.js, Geomorphology, etc.)
    if (url.pathname.includes('/layers/')) {
        event.respondWith(handleLayerFetch(event.request));
        return;
    }

    // 3. Static App Shell & Core Assets (Cache-First with Network Fallback)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version immediately, revalidate in background if online
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_CORE).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {/* Offline */});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_CORE).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                // If offline and request is HTML, fallback to cached index
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// Handle Map Tiles: Cache-First -> Network (with timeout) -> Offline Fallback Tile
async function handleTileFetch(request) {
    const tileCache = await caches.open(CACHE_TILES);
    const cachedTile = await tileCache.match(request);
    if (cachedTile) {
        return cachedTile;
    }

    try {
        // Fetch with a 6-second timeout for poor networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const networkResponse = await fetch(request, {
            mode: 'cors',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            tileCache.put(request, networkResponse.clone());
            trimCache(CACHE_TILES, MAX_TILE_CACHE);
            return networkResponse;
        }
    } catch (err) {
        // Network failed or timed out
    }

    // Return transparent tile fallback so map canvas does not show broken borders
    return fetch(EMPTY_TILE_PNG);
}

// Handle GIS Layers: Stale-While-Revalidate with Persistent Cache
async function handleLayerFetch(request) {
    const layerCache = await caches.open(CACHE_LAYERS);
    const cachedLayer = await layerCache.match(request);

    const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            layerCache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => null);

    return cachedLayer || (await networkFetch);
}

