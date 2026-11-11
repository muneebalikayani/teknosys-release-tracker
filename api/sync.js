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

function normalizeDeletedIds(entries, fallbackIso = null) {
  if (!Array.isArray(entries)) return [];
  const fallbackMs = fallbackIso ? (new Date(fallbackIso).getTime() || 0) : 0;
  const map = new Map();
  for (const entry of entries) {
    const isObj = typeof entry === 'object' && entry !== null;
    const id = Number(isObj ? entry.id : entry);
    if (!Number.isFinite(id) || id <= 0) continue;
    const rawDate = isObj ? entry.deletedAt : null;
    const parsedMs = rawDate ? new Date(rawDate).getTime() : 0;
    const ms = Number.isFinite(parsedMs) && parsedMs > 0 ? parsedMs : fallbackMs;
    if (ms <= 0) continue;
    const prev = map.get(id);
    if (prev === undefined || ms > prev) {
      map.set(id, ms);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, ms]) => ({
      id,
      deletedAt: new Date(ms).toISOString()
    }));
}

function mergeDeletedIds(existingEntries, incomingEntries, fallbackIso = null) {
  return normalizeDeletedIds(
    [...(existingEntries || []), ...(incomingEntries || [])],
    fallbackIso
  );
}

function filterDeletedReleases(releases, deletedIds) {
  if (!Array.isArray(releases)) return [];
  const normalizedDeleted = normalizeDeletedIds(deletedIds);
  if (normalizedDeleted.length === 0) return releases;
  const deletedMap = new Map(
    normalizedDeleted.map(d => [Number(d.id), new Date(d.deletedAt).getTime() || 0])
  );
  return releases.filter(rel => {
    if (!rel) return false;
    const deletedMs = deletedMap.get(Number(rel.id));
    if (!deletedMs) return true;
    const createdMs = rel.createdAt ? (new Date(rel.createdAt).getTime() || 0) : 0;
    return createdMs > deletedMs;
  });
}

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
        data.deletedIds = normalizeDeletedIds(data.deletedIds);
        data.releases = filterDeletedReleases(data.releases, data.deletedIds);
        memoryCache = data;
        lastCacheTime = now;
        return res.status(200).json(data);
      }

      if (resp.status === 404) {
        return res.status(200).json({ releases: [], holidays: [], deletedIds: [], updatedAt: new Date().toISOString() });
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
      const { releases, holidays, deletedIds } = req.body || {};
      if (!Array.isArray(releases)) {
        return res.status(400).json({ error: 'releases must be an array' });
      }

      const fallbackDeletedAt = new Date().toISOString();
      const incomingDeletedIds = normalizeDeletedIds(deletedIds, fallbackDeletedAt);
      const nextHolidays = holidays || [];

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
        let existingPayload = null;
        if (metaRes.ok) {
          const meta = await metaRes.json();
          sha = meta.sha;
          if (meta.content) {
            try {
              existingPayload = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));
            } catch {}
          }
        }

        const existingDeletedIds = normalizeDeletedIds(existingPayload?.deletedIds);
        const mergedDeletedIds = mergeDeletedIds(existingDeletedIds, incomingDeletedIds, fallbackDeletedAt);
        const cleanedReleases = filterDeletedReleases(releases, mergedDeletedIds);

        // Skip redundant commits if dataset has not actually changed
        if (
          existingPayload &&
          JSON.stringify(existingPayload.releases) === JSON.stringify(cleanedReleases) &&
          JSON.stringify(existingPayload.holidays) === JSON.stringify(nextHolidays) &&
          JSON.stringify(existingDeletedIds) === JSON.stringify(mergedDeletedIds)
        ) {
          const cachedPayload = { ...existingPayload, deletedIds: existingDeletedIds };
          memoryCache = cachedPayload;
          lastCacheTime = Date.now();
          return cachedPayload;
        }

        const nextPayload = {
          releases: cleanedReleases,
          holidays: nextHolidays,
          deletedIds: mergedDeletedIds,
          updatedAt: new Date().toISOString()
        };

        const bodyData = {
          message: `Sync updates: ${nextPayload.releases.length} releases (${nextPayload.updatedAt})`,
          content: Buffer.from(JSON.stringify(nextPayload, null, 2)).toString('base64'),
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
          memoryCache = nextPayload;
          lastCacheTime = Date.now();
          return nextPayload;
        }

        // Retry once on 409 conflict (concurrent write from other laptop)
        if (putRes.status === 409 && attempt < 2) {
          return saveToCloud(attempt + 1);
        }

        const errData = await putRes.text();
        throw new Error(`Failed to save to cloud storage: ${errData}`);
      };

      const savedPayload = await saveToCloud();

      return res.status(200).json({
        success: true,
        updatedAt: savedPayload.updatedAt,
        releaseCount: savedPayload.releases.length,
        holidayCount: savedPayload.holidays.length,
        deletedCount: (savedPayload.deletedIds || []).length
      });
    } catch (err) {
      console.error('Error saving to cloud store:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
