// Service Worker for PWA Support
const CACHE_NAME = "oder88-shop-v47";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withScope = (path) => `${SCOPE_PATH}${path}`.replace(/\/{2,}/g, "/");

const urlsToCache = [
    withScope("/"),
    withScope("/index.html"),
    withScope("/assets/style.css"),
    withScope("/assets/script.js"),
    withScope("/assets/products.json"),
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
];

// Install event
self.addEventListener("install", (event) => {
    console.log("🔄 New SW version installing:", CACHE_NAME);
    // Skip waiting to activate immediately - this ensures new version takes over right away
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("✅ Opened new cache:", CACHE_NAME);
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
    const noQueryUrl = new URL(url.pathname, url.origin).toString();

    // For HTML, CSS and JS files, ALWAYS fetch from network first (never use cache)
    // This ensures users always get the latest version when version number changes
    if (
        url.pathname.includes(".html") ||
        url.pathname.includes(".css") ||
        url.pathname.includes(".js") ||
        url.search.includes("v=") ||
        url.search.length > 0
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
                    // Only cache if response is successful
                    // Use the full URL with query string as cache key to prevent version conflicts
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            // Cache with full URL (including version) to avoid serving old version
                            cache.put(event.request.url, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try to get from cache (for offline support)
                    // But prefer exact URL match first, then fallback to no-query
                    return caches.match(event.request.url).then((cached) => {
                        if (cached) return cached;
                        return caches.match(noQueryUrl).then((cached) => {
                            return cached || new Response("Network error", { status: 408 });
                        });
                    });
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

// Activate event - Clear old caches and notify clients
self.addEventListener("activate", (event) => {
    console.log("✅ SW activated:", CACHE_NAME);
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        // First, claim all clients immediately
        self.clients.claim().then(() => {
            // Delete all old caches
            return caches.keys().then((cacheNames) => {
                const hasOldCache = cacheNames.some(name => name !== CACHE_NAME);
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log("🗑️ Deleting old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                ).then(() => hasOldCache);
            });
        })
        .then((hadOldCache) => {
            // Chỉ notify clients nếu có cache cũ được xóa (tức là có update thực sự)
            // Không notify nếu đây là lần đầu install
            if (hadOldCache) {
                return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
                    console.log("📢 Notifying", clients.length, "clients to reload");
                    clients.forEach((client) => {
                        client.postMessage({
                            type: "SW_UPDATED",
                            action: "reload",
                            version: CACHE_NAME,
                        });
                    });
                });
            }
        })
    );
});

// Listen for messages from clients
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "CHECK_UPDATE") {
        // Client is asking to check for updates
        event.waitUntil(
            self.registration.update().then(() => {
                console.log("✅ Update check completed");
            })
        );
    }
});
