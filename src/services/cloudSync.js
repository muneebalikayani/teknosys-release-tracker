// Zero-Config Cloud Sync Service (Vercel Serverless + Vercel Blob)
const BLOB_DIRECT_URL = 'https://ydlimtlndkdmvrwd.public.blob.vercel-storage.com/teknosys_store.json';

/**
 * Fetch releases & holidays from the shared cloud store
 */
export async function fetchCloudStore() {
  const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  // Try local API endpoint first (works on Vercel deployment)
  try {
    const res = await fetch(`/api/sync?t=${nonce}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.releases)) {
        return data;
      }
    }
  } catch (e) {
    // Fall back to direct Vercel Blob CDN URL
  }

  // Direct Blob CDN fallback (guaranteed to work from any client browser)
  try {
    const res = await fetch(`${BLOB_DIRECT_URL}?t=${nonce}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.releases)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch from cloud store:', err);
  }

  return null;
}

/**
 * Save releases & holidays to the shared cloud store
 */
export async function pushCloudStore(releases, holidays) {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        releases: releases || [],
        holidays: holidays || []
      })
    });

    if (res.ok) {
      const result = await res.json();
      return result;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with ${res.status}`);
    }
  } catch (err) {
    console.error('Failed to push updates to cloud store:', err);
    throw err;
  }
}
