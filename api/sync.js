import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const BLOB_URL = 'https://ydlimtlndkdmvrwd.public.blob.vercel-storage.com/teknosys_store.json';

  if (req.method === 'GET') {
    try {
      const resp = await fetch(`${BLOB_URL}?t=${Date.now()}`, { cache: 'no-store' });
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
        allowOverwrite: true
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
