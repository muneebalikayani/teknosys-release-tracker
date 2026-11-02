import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_CONFIG = 'teknosys_supabase_config';

let supabaseClient = null;

/**
 * Retrieve current Supabase credentials.
 * Priority: localStorage (runtime override) -> import.meta.env
 */
export function getSupabaseCredentials() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.url && parsed.anonKey) {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim(), source: 'localStorage' };
      }
    }
  } catch (e) {
    console.warn('Error reading stored Supabase config:', e);
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey && !envUrl.includes('your-project-id')) {
    return { url: envUrl.trim(), anonKey: envKey.trim(), source: 'env' };
  }

  return { url: '', anonKey: '', source: 'none' };
}

/**
 * Check if valid Supabase configuration is present
 */
export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith('http'));
}

/**
 * Initialize or get active Supabase client instance
 */
export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('http')) {
    supabaseClient = null;
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  }

  return supabaseClient;
}

/**
 * Save credentials to localStorage and re-initialize client
 */
export function saveSupabaseConfig(url, anonKey) {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  supabaseClient = null;
  return getSupabaseClient();
}

/**
 * Clear credentials
 */
export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  supabaseClient = null;
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(overrideUrl, overrideKey) {
  let client;
  if (overrideUrl && overrideKey) {
    try {
      client = createClient(overrideUrl.trim(), overrideKey.trim(), {
        auth: { persistSession: false }
      });
    } catch (e) {
      return { success: false, message: `Invalid URL format: ${e.message}` };
    }
  } else {
    client = getSupabaseClient();
  }

  if (!client) {
    return { success: false, message: 'Supabase is not configured. Please supply Project URL and Anon API Key.' };
  }

  try {
    const { data, error } = await client.from('releases').select('id').limit(1);
    if (error) {
      return { success: false, message: `Supabase Error: ${error.message} (${error.code || 'unknown'})` };
    }
    return { success: true, message: 'Connected successfully to Supabase PostgreSQL!' };
  } catch (err) {
    return { success: false, message: `Network/Connection error: ${err.message}` };
  }
}

// -------------------------------------------------------------
// Data Mapping Helpers (JS camelCase <-> PostgreSQL snake_case)
// -------------------------------------------------------------
function mapReleaseToDb(rel) {
  const sanitizeDate = (d) => {
    if (!d || typeof d !== 'string') return null;
    const trimmed = d.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  };

  return {
    id: Number(rel.id),
    name: rel.name || '',
    ritm: rel.ritm || '',
    cr: rel.cr || '',
    developer: rel.developer || '',
    version: rel.version || '',
    platform: rel.platform || 'GSM',
    type: rel.type || 'Scheduled',
    start_date: sanitizeDate(rel.startDate),
    target_deploy: sanitizeDate(rel.targetDeploy) || new Date().toISOString().slice(0, 10),
    stage: rel.stage || 'Development',
    owner: rel.owner || 'Dev Team',
    status: rel.status || 'On Track',
    db_objects: rel.dbObjects || '',
    notes: rel.notes || '',
    email: rel.email || '',
    holiday_conflict: rel.holidayConflict || ''
  };
}

function mapDbToRelease(row) {
  return {
    id: Number(row.id),
    name: row.name || '',
    ritm: row.ritm || '',
    cr: row.cr || '',
    developer: row.developer || '',
    version: row.version || '',
    platform: row.platform || 'GSM',
    type: row.type || 'Scheduled',
    startDate: row.start_date || '',
    targetDeploy: row.target_deploy || '',
    stage: row.stage || 'Development',
    owner: row.owner || 'Dev Team',
    status: row.status || 'On Track',
    dbObjects: row.db_objects || '',
    notes: row.notes || '',
    email: row.email || '',
    holidayConflict: row.holiday_conflict || ''
  };
}

function mapHolidayToDb(h) {
  return {
    id: h.id,
    name: h.name || '',
    start_date: h.startDate,
    end_date: h.endDate || h.startDate,
    notes: h.notes || ''
  };
}

function mapDbToHoliday(row) {
  return {
    id: Number(row.id),
    name: row.name || '',
    startDate: row.start_date || '',
    endDate: row.end_date || row.start_date || '',
    notes: row.notes || ''
  };
}

// -------------------------------------------------------------
// CRUD Operations
// -------------------------------------------------------------
export async function fetchReleasesFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('releases')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('Error fetching releases from Supabase:', error);
    throw error;
  }

  return (data || []).map(mapDbToRelease);
}

export async function fetchHolidaysFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('holidays')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching holidays from Supabase:', error);
    throw error;
  }

  return (data || []).map(mapDbToHoliday);
}

export async function upsertReleaseInSupabase(release) {
  const client = getSupabaseClient();
  if (!client) return null;

  const row = mapReleaseToDb(release);
  const { data, error } = await client
    .from('releases')
    .upsert(row, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('Error upserting release in Supabase:', error);
    throw error;
  }

  return data && data[0] ? mapDbToRelease(data[0]) : release;
}

export async function deleteReleaseInSupabase(id) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { error } = await client
    .from('releases')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting release from Supabase:', error);
    throw error;
  }

  return true;
}

export async function upsertHolidayInSupabase(holiday) {
  const client = getSupabaseClient();
  if (!client) return null;

  const row = mapHolidayToDb(holiday);
  const { data, error } = await client
    .from('holidays')
    .upsert(row, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('Error upserting holiday in Supabase:', error);
    throw error;
  }

  return data && data[0] ? mapDbToHoliday(data[0]) : holiday;
}

export async function deleteHolidayInSupabase(id) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { error } = await client
    .from('holidays')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting holiday from Supabase:', error);
    throw error;
  }

  return true;
}

/**
 * Seed Supabase with local releases & holidays in one batch
 */
export async function seedSupabaseFromLocal(releases, holidays) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  if (holidays && holidays.length > 0) {
    const dbHolidays = holidays.map(mapHolidayToDb);
    const { error: hErr } = await client.from('holidays').upsert(dbHolidays, { onConflict: 'id' });
    if (hErr) throw hErr;
  }

  if (releases && releases.length > 0) {
    const dbReleases = releases.map(mapReleaseToDb);
    const { error: rErr } = await client.from('releases').upsert(dbReleases, { onConflict: 'id' });
    if (rErr) throw rErr;
  }

  return true;
}

/**
 * Setup Realtime channel for live multi-user collaboration
 */
export function subscribeToSupabaseRealtime(onReleaseUpdate, onHolidayUpdate) {
  const client = getSupabaseClient();
  if (!client) return null;

  const channel = client
    .channel('teknosys-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'releases' }, payload => {
      if (onReleaseUpdate) onReleaseUpdate(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, payload => {
      if (onHolidayUpdate) onHolidayUpdate(payload);
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
