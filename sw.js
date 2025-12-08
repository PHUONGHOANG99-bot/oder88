// Service Worker for PWA Support
const CACHE_NAME = "oder88-shop-v39";
const urlsToCache = [
    "/",
    "/index.html",
    "/assets/style.css",
    "/assets/script.js",
    "/assets/products.json",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
];

// Install event
self.addEventListener("install", (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Opened cache");
            // Only cache files without query strings
            const urlsWithoutQuery = urlsToCache.map((url) => {
                const urlObj = new URL(url, self.location.origin);
                urlObj.search = "";
                return urlObj.toString();
            });
            return cache.addAll(urlsWithoutQuery);
        })
    );
});

// Fetch event - Always fetch fresh HTML, CSS and JS
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // For HTML, CSS and JS files, always fetch from network first (skip cache)
    // Also skip cache if URL has query string (cache busting)
    if (
        url.pathname.includes(".html") ||
        url.pathname.includes(".css") ||
        url.pathname.includes(".js") ||
        url.search.includes("v=") ||
        url.search.includes("?")
    ) {
        event.respondWith(
            fetch(event.request, {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            })
                .then((response) => {
                    // Don't cache files with query strings
                    if (response && response.status === 200 && !url.search) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache (but only for files without query strings)
                    if (!url.search) {
                        return caches.match(event.request);
                    }
                    return new Response("Network error", { status: 408 });
                })
        );
        return;
    }

    // For other files, use cache first strategy
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }
            return fetch(event.request).then((response) => {
                // Check if we received a valid response
                if (
                    !response ||
                    response.status !== 200 ||
                    response.type !== "basic"
                ) {
                    return response;
                }

                // IMPORTANT: Clone the response. A response is a stream
                // and because we want the browser to consume the response
                // as well as the cache consuming the response, we need
                // to clone it so we have two streams.
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});

// Activate event - Clear old caches
self.addEventListener("activate", (event) => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            console.log("Deleting old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Force update all clients immediately
                return self.clients.claim().then(() => {
                    // Send message to all clients to reload
                    return self.clients.matchAll().then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: "SW_UPDATED",
                                action: "reload",
                            });
                        });
                    });
                });
            })
            .then(() => {
                // Delete all old caches
                return caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            if (cacheName !== CACHE_NAME) {
                                console.log("Deleting old cache:", cacheName);
                                return caches.delete(cacheName);
                            }
                        })
                    );
                });
            })
    );
});
