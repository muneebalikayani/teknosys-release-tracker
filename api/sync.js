import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const BLOB_URL = 'https://ydlimtlndkdmvrwd.public.blob.vercel-storage.com/teknosys_store.json';

  if (req.method === 'GET') {
    try {
      const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const resp = await fetch(`${BLOB_URL}?t=${nonce}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        return res.status(200).json(data);
      }
      return res.status(404).json({ error: 'Blob not initialized' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { releases, holidays } = req.body || {};
      if (!Array.isArray(releases)) {
        return res.status(400).json({ error: 'releases must be an array' });
      }

      const payload = {
        releases: releases || [],
        holidays: holidays || [],
        updatedAt: new Date().toISOString()
      };

      await put('teknosys_store.json', JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0
      });

      return res.status(200).json({
        success: true,
        updatedAt: payload.updatedAt,
        releaseCount: payload.releases.length,
        holidayCount: payload.holidays.length
      });
    } catch (err) {
      console.error('Error saving to Vercel Blob:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
