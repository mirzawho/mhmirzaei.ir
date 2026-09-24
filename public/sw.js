// Native service worker for mhmirzaei.ir.
// Strategy: cache-first for same-origin static assets, network-first for
// HTML navigations, offline fallback page when both fail.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `mhmirzaei-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Static assets that are safe to serve from cache indefinitely.
const STATIC_EXTENSIONS = /\.(?:css|js|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|webmanifest)$/i;

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Remove every cache left over from previous versions.
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith('mhmirzaei-') && name !== CACHE_NAME)
					.map((name) => caches.delete(name)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;

	// Only handle safe, same-origin GET requests.
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));
		return;
	}

	if (STATIC_EXTENSIONS.test(url.pathname)) {
		event.respondWith(handleStaticAsset(request));
	}
});

// Network-first: fresh pages when online, cached page when offline.
async function handleNavigation(request) {
	try {
		return await fetch(request);
	} catch {
		const cached = await caches.match(request);
		if (cached) return cached;
		return caches.match(OFFLINE_URL);
	}
}

// Cache-first: static assets are content-addressed by Astro and immutable.
async function handleStaticAsset(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response('', { status: 504, statusText: 'Offline' });
	}
}
