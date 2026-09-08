/**
 * Pulling a new build into an installed home-screen app.
 *
 * iOS keeps its own copy of the page and its assets, so a plain reload can keep
 * serving the old build indefinitely. Clearing the caches and then loading a URL
 * the cache has never seen is what actually forces a fresh fetch.
 */

/** Marks the reload as fresh; stripped again once the new build is running. */
const CACHE_BUSTER = 'v'

export async function updateApp(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Cache API unavailable or blocked — the query string below still works.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
  } catch {
    // Nothing registered today, but a stale worker from an older build would
    // otherwise keep serving its own copy.
  }

  const url = new URL(window.location.href)
  url.searchParams.set(CACHE_BUSTER, Date.now().toString(36))
  window.location.replace(url.toString())
}

/**
 * Drops the cache-busting parameter after the fresh load, so the address stays
 * clean and keeps matching the manifest's start_url.
 */
export function clearUpdateMarker(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(CACHE_BUSTER)) return
    url.searchParams.delete(CACHE_BUSTER)
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    // Cosmetic only.
  }
}
