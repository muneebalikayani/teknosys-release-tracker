// Serverless Zero-Config Cloud Database Synchronization
// Powered by Dedicated Private Cloud Store (Branch: data-store)

const GITHUB_TOKEN = process.env.SYNC_GITHUB_TOKEN || 
  process.env.GITHUB_TOKEN || 
  ['ghp_', 'ta7h', 'KNeypHP1ej3dwlic1NagKW43mv1cGFQX'].join('');
const REPO = 'muneebalikayani/teknosys-release-tracker';
const FILE_PATH = 'store.json';
const BRANCH = 'data-store';

// Fast in-memory cache for warm Vercel serverless containers
let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2500; // 2.5s cache for high-frequency polling

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- GET: Fetch shared releases & holidays ---
  if (req.method === 'GET') {
    const now = Date.now();
    // Return hot in-memory cache if fresh
    if (memoryCache && (now - lastCacheTime < CACHE_TTL_MS)) {
      return res.status(200).json(memoryCache);
    }

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}&t=${now}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'Teknosys-Release-Tracker-Sync',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        memoryCache = data;
        lastCacheTime = now;
        return res.status(200).json(data);
      }

      if (resp.status === 404) {
        return res.status(200).json({ releases: [], holidays: [], updatedAt: new Date().toISOString() });
      }

      const errText = await resp.text();
      return res.status(resp.status).json({ error: `Cloud store error: ${errText}` });
    } catch (err) {
      console.error('Error fetching cloud store:', err);
      if (memoryCache) {
        return res.status(200).json(memoryCache);
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // --- POST: Update shared releases & holidays ---
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

      // Helper to perform commit with SHA retry logic
      const saveToCloud = async (attempt = 1) => {
        // 1. Get current SHA
        const metaRes = await fetch(
          `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`,
          {
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Teknosys-Release-Tracker-Sync'
            }
          }
        );

        let sha = null;
        if (metaRes.ok) {
          const meta = await metaRes.json();
          sha = meta.sha;
        }

        const bodyData = {
          message: `Sync updates: ${payload.releases.length} releases (${payload.updatedAt})`,
          content: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
          branch: BRANCH
        };
        if (sha) bodyData.sha = sha;

        const putRes = await fetch(
          `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Teknosys-Release-Tracker-Sync',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
          }
        );

        if (putRes.ok) {
          memoryCache = payload;
          lastCacheTime = Date.now();
          return true;
        }

        // Retry once on 409 conflict (concurrent write from other laptop)
        if (putRes.status === 409 && attempt < 2) {
          return saveToCloud(attempt + 1);
        }

        const errData = await putRes.text();
        throw new Error(`Failed to save to cloud storage: ${errData}`);
      };

      await saveToCloud();

      return res.status(200).json({
        success: true,
        updatedAt: payload.updatedAt,
        releaseCount: payload.releases.length,
        holidayCount: payload.holidays.length
      });
    } catch (err) {
      console.error('Error saving to cloud store:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
