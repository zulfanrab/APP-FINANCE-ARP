// ============================================================
// ARKA Finance — Live Auto-Update Engine for Vercel Deployments
// Detects new Git commits pushed to Vercel in real-time
// Automatically reloads the web app & PWA without requiring app restart
// ============================================================

export interface VersionInfo {
  version: number;
  buildTime: string;
}

type UpdateCallback = (info: VersionInfo) => void;

let currentVersion: VersionInfo | null = null;
let isUpdateDetected = false;
const updateListeners: Set<UpdateCallback> = new Set();

/** Register a listener for auto-update events */
export function subscribeToAutoUpdate(callback: UpdateCallback): () => void {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
}

function notifyUpdate(info: VersionInfo) {
  if (isUpdateDetected) return;
  isUpdateDetected = true;
  updateListeners.forEach(cb => cb(info));

  // Dispatch custom window event
  window.dispatchEvent(new CustomEvent('arka:app-update-ready', { detail: info }));
}

/** Check remote /version.json on Vercel with strict no-cache headers */
export async function checkForAppUpdates(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) return null;
    const remoteVersion: VersionInfo = await res.json();

    if (!currentVersion) {
      currentVersion = remoteVersion;
      return remoteVersion;
    }

    if (remoteVersion.version !== currentVersion.version) {
      console.log('🚀 ARKA Finance New Vercel Version Detected:', remoteVersion);
      notifyUpdate(remoteVersion);
      return remoteVersion;
    }
  } catch (err) {
    // Quiet network failure catch
  }
  return null;
}

/** Instantly reload application with cache-busting */
export function triggerAppReload() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.update();
      }
    });
  }
  // Hard reload page
  window.location.reload();
}

/** Initialize Auto-Update Engine on app start */
export function initAutoUpdateEngine() {
  // 1. Fetch initial version
  checkForAppUpdates();

  // 2. Poll Vercel for new deployment every 20 seconds
  const intervalId = setInterval(() => {
    if (!isUpdateDetected) {
      checkForAppUpdates();
    }
  }, 20000);

  // 3. Check immediately when user brings app/PWA window to focus or switches tab
  const handleFocusOrVisible = () => {
    if (document.visibilityState === 'visible' && !isUpdateDetected) {
      checkForAppUpdates();
    }
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', handleFocusOrVisible);

  // 4. Service Worker Registration & Update listener
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Check for SW updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New Service Worker installed & ready!
                checkForAppUpdates();
              }
            });
          }
        });
      }).catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    });

    // Listen for controllerchange event
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('focus', handleFocusOrVisible);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
  };
}
