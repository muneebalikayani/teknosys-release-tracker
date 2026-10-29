import {
  DEFAULT_RELEASES,
  DEFAULT_HOLIDAYS,
  DEFAULT_PLATFORMS,
  DEFAULT_DEPLOYMENT_TYPES,
  DEFAULT_STAGES,
  DEFAULT_OWNERS,
  DEFAULT_STATUSES
} from './defaultData.js';
import {
  isSupabaseConfigured,
  fetchReleasesFromSupabase,
  fetchHolidaysFromSupabase,
  upsertReleaseInSupabase,
  deleteReleaseInSupabase,
  upsertHolidayInSupabase,
  deleteHolidayInSupabase,
  subscribeToSupabaseRealtime
} from '../services/supabase.js';
import { fetchCloudStore, pushCloudStore } from '../services/cloudSync.js';

class ReleaseStore {
  constructor() {
    this.storageKeyReleases = 'teknosys_dw_releases_v6';
    this.storageKeyHolidays = 'teknosys_dw_holidays_v2';
    this.listeners = new Set();

    // Supabase Cloud State
    this.isSupabaseConnected = false;
    this.isSyncing = false;
    this.unsubscribeRealtime = null;

    this.releases = this.loadReleases();
    this.saveReleases();
    this.holidays = this.loadHolidays();

    // Ensure all releases have their holidayConflict evaluated
    this.recalculateAllHolidayConflicts();

    // Zero-config Live Cloud Sync (connects all team members automatically)
    this.initCloudSync();

    // Auto-connect to Supabase if custom credentials exist
    this.initSupabase();

    this.platforms = DEFAULT_PLATFORMS.filter(p => p !== 'JLV');
    this.deploymentTypes = [...DEFAULT_DEPLOYMENT_TYPES];
    this.stages = [...DEFAULT_STAGES];
    this.owners = [...DEFAULT_OWNERS];
    this.statuses = [...DEFAULT_STATUSES];

    // Filter and view state
    this.currentView = 'dashboard'; // 'dashboard' | 'releases' | 'board' | 'calendar' | 'timeline' | 'year' | 'holidays'
    this.boardGroupBy = 'stage'; // 'stage' | 'status'

    this.filters = {
      search: '',
      impactedObject: '',
      platform: 'ALL',
      type: 'ALL',
      stage: 'ALL',
      status: 'ALL',
      owner: 'ALL',
      developer: 'ALL',
      month: 'ALL', // 1-12 or 'ALL'
      year: 'ALL', // e.g. 2026 or 'ALL'
      hasConflict: false
    };

    // Sorting state (default: reverse order by ID)
    this.sort = {
      column: 'id',
      direction: 'desc'
    };

    // Dashboard specific month/year filter (defaults to current month/year or 10/2026)
    const today = new Date();
    this.dashboardFilter = {
      month: today.getMonth() + 1, // 10 for October
      year: today.getFullYear()
    };
  }

  // --- Persistence ---
  loadReleases() {
    const DEFAULT_IMPACTED_OBJECTS = {
      3: 'JTR_PRD_01_OPTM_STD_0_V.DWN_5079_POSTPAID_MULTIPLAY_90_DAYS, JTR_PRD_01_SHRD_STD_0_V.POSTPAID_MULTIPLAY_MONTHY'
    };

    const FABRICATED_OBJECT_FRAGMENTS = [
      'VW_MWALLET_RECHARGE',
      'MWALLET_TXN_FACT',
      'DW_PREPAID_LIFECYCLE',
      'TRAFFIC_ACTIVE_FIXTURE',
      'DW_BVS_SALES_BASE',
      'SP_LOAD_BVS_CORE',
      'OMNI_API_EXPORT_TBL',
      'VW_OMNI_INTEGRATION',
      'UCB_CHARGING_BASE',
      'DW_UCIP_CDR_MART',
      'DW_POSTPAID_LIFECYCLE',
      'SP_POSTPAID_FIX',
      'SEMANTIC_BVS_SALES',
      'VW_BVS_AGE_FLAG',
      'LKP_UCIP_CODES',
      'SP_REFRESH_UCIP_LKP',
      'RPT_DAILY_KPIS',
      'VW_EXEC_METRICS',
      'MART_REWARD_HUB',
      'DW_CEO_CAT_DIM',
      'RPT_APP_KPIS',
      'VW_DFS_METRICS',
      'DDL_POSTPAID_FACT',
      'TPT_JAZZ_ADVANCE_LOAD',
      'DW_ADVANCE_RECHARGE',
      'SRC_SIMOSA_PARENT_CHILD',
      'DW_SIMOSA_HIERARCHY',
      'VW_LIVE_APP_HIERARCHY',
      'DW_HIERARCHY_FACT',
      'DW_DEKHO_LIFECYCLE',
      'SNAPSHOT_DISCONTINUATION',
      'DFS_WALLET_LIFECYCLE_FACT',
      'DIM_DFS_CHANNELS',
      'VW_SBSCRPN_KEY',
      'DW_SDS_5G_ATTR',
      'DIM_5G_CELL_SITE',
      'DW_POSTPAID_ROX',
      'VW_ROX_ACHIEVEMENT',
      'CPS_LICENSE_LOG',
      'RPT_DAILY_OFT',
      'LKP_NBO_SOURCING',
      'DW_NBO_FACT',
      'DW_SALES_FACT_5G',
      'FACT_DAILY_SALES',
      'DW_POSTPAID_LIVE_BASE',
      'SCRIPT_DASHBOARD_KPIS',
      'VW_DAY_WISE_KPI',
      'API_POSTPAID_CONVERSION',
      'DW_CONVERSION_LOG',
      'API_JAZZ_CX_IVR',
      'DW_IVR_LOGS',
      'SRC_FIKRFREE_BASE',
      'DW_FIKRFREE_MART',
      'DW_MSPH_SUBSCRIBER_SUMMARY',
      'DIM_MSPH_CELLS',
      'LKP_UCIP_GAMENOW',
      'SP_REFRESH_UCIP',
      'ODS_699_SUBSCRIBERS',
      'LKP_WHITELIST_PLAN',
      'DIM_TAMASHA_IP_LIST',
      'VW_STREAMING_TRAFFIC',
      'DW_DIGITAL_FUNNEL_DAILY',
      'MART_TAMASHA_DEF',
      'B2C_SALES_FACT',
      'SP_LOAD_B2C_SALES',
      'RPT_DAILY_KPI_PROD',
      'VW_REG_BASE_METRICS',
      'READYCASH_RECOVERY_FACT',
      'COMMUTATIVE_REC_LOG',
      'SIT_MTD_BTEQ',
      'DW_REVENUE_MTD',
      'REF_DATA_SOURCING',
      'DIM_REF_DFS',
      'API_NBO_DEPLOYMENT',
      'DW_NBO_SUBSCRIBERS'
    ];

    const sanitizeDbObjects = (id, dbObjects) => {
      if (!dbObjects) return DEFAULT_IMPACTED_OBJECTS[id] || '';
      for (const fake of FABRICATED_OBJECT_FRAGMENTS) {
        if (dbObjects.includes(fake)) {
          return DEFAULT_IMPACTED_OBJECTS[id] || '';
        }
      }
      return dbObjects;
    };

    try {
      let saved = localStorage.getItem(this.storageKeyReleases);
      if (!saved) {
        // Seamless migration from legacy storage keys
        for (const oldKey of ['teknosys_dw_releases_v5', 'teknosys_dw_releases_v4', 'teknosys_dw_releases_v3', 'teknosys_dw_releases_v2']) {
          const old = localStorage.getItem(oldKey);
          if (old) {
            try {
              const oldParsed = JSON.parse(old);
              if (Array.isArray(oldParsed) && oldParsed.length > 0) {
                const existingIds = new Set(oldParsed.map(r => r.id));
                const missingDefaults = DEFAULT_RELEASES.filter(d => !existingIds.has(d.id));
                const merged = [...oldParsed, ...missingDefaults].map(r => {
                  if (r.platform === 'JLV') r.platform = 'GSM';
                  r.dbObjects = sanitizeDbObjects(r.id, r.dbObjects);
                  return r;
                });
                localStorage.setItem(this.storageKeyReleases, JSON.stringify(merged));
                saved = JSON.stringify(merged);
                break;
              }
            } catch (err) {}
          }
        }
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map(r => r.id));
          const missingDefaults = DEFAULT_RELEASES.filter(d => !existingIds.has(d.id));
          const fullList = missingDefaults.length > 0 ? [...parsed, ...missingDefaults] : parsed;
          return fullList.map(r => {
            if (r.platform === 'JLV') r.platform = 'GSM';
            if (r.stage === 'SIT') r.stage = 'UAT';
            if (r.stage === 'Pre-Prod') r.stage = 'Production';
            if (r.stage === 'CAB / RFC' || r.stage === 'CAB/RFC' || (typeof r.stage === 'string' && r.stage.toLowerCase() === 'cab / rfc')) {
              r.stage = 'CAB';
            }
            if (r.stage === 'Code Freeze' || (typeof r.stage === 'string' && r.stage.toLowerCase() === 'code freeze')) {
              r.stage = 'CAB';
            }
            if (r.stage === 'On Hold') {
              r.status = 'On Hold';
              r.stage = 'Development';
            }
            if (r.type === 'Urgent') {
              r.type = 'Emergency';
            }
            r.dbObjects = sanitizeDbObjects(r.id, r.dbObjects);
            return r;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load releases from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_RELEASES)).map(r => {
      if (r.platform === 'JLV') r.platform = 'GSM';
      if (r.type === 'Urgent') r.type = 'Emergency';
      if (r.stage === 'CAB / RFC' || r.stage === 'CAB/RFC' || (typeof r.stage === 'string' && r.stage.toLowerCase() === 'cab / rfc')) {
        r.stage = 'CAB';
      }
      if (r.stage === 'Code Freeze' || (typeof r.stage === 'string' && r.stage.toLowerCase() === 'code freeze')) {
        r.stage = 'CAB';
      }
      r.dbObjects = sanitizeDbObjects(r.id, r.dbObjects);
      return r;
    });
  }

  normalizeStage(stage) {
    if (!stage) return 'Development';
    const s = String(stage).trim();
    if (s === 'CAB / RFC' || s === 'CAB/RFC' || s.toLowerCase() === 'cab / rfc' || s.toLowerCase() === 'cab/rfc') return 'CAB';
    if (s.toLowerCase() === 'code freeze') return 'CAB';
    if (s === 'SIT') return 'UAT';
    if (s === 'Pre-Prod') return 'Production';
    return s;
  }

  normalizeRelease(r) {
    if (!r) return r;
    const item = { ...r };
    if (item.platform === 'JLV') item.platform = 'GSM';
    if (item.type === 'Urgent') item.type = 'Emergency';
    if (item.stage === 'On Hold') {
      item.status = 'On Hold';
      item.stage = 'Development';
    } else {
      item.stage = this.normalizeStage(item.stage);
    }
    return item;
  }

  saveReleases() {
    try {
      localStorage.setItem(this.storageKeyReleases, JSON.stringify(this.releases));
    } catch (e) {
      console.error('Failed to save releases to localStorage:', e);
    }
  }

  loadHolidays() {
    try {
      const saved = localStorage.getItem(this.storageKeyHolidays);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load holidays from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_HOLIDAYS));
  }

  saveHolidays() {
    try {
      localStorage.setItem(this.storageKeyHolidays, JSON.stringify(this.holidays));
    } catch (e) {
      console.error('Failed to save holidays to localStorage:', e);
    }
  }

  // --- Event Emitter ---
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const callback of this.listeners) {
      callback();
    }
  }

  // --- Zero-Config Live Cloud Sync (Vercel Global Storage) ---
  async initCloudSync() {
    try {
      this.isSyncing = true;
      this.notify();

      const cloudData = await fetchCloudStore();
      if (cloudData && Array.isArray(cloudData.releases) && cloudData.releases.length > 0) {
        this.releases = cloudData.releases.map(r => this.normalizeRelease(r));
        this.saveReleases();
        if (Array.isArray(cloudData.holidays) && cloudData.holidays.length > 0) {
          this.holidays = cloudData.holidays;
          this.saveHolidays();
        }
        this.recalculateAllHolidayConflicts();
        this.isCloudConnected = true;
      }
      this.startPolling();
    } catch (err) {
      console.warn('Initial cloud sync error:', err);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // --- Supabase Cloud Sync & Realtime ---
  async initSupabase() {
    if (!isSupabaseConfigured()) {
      this.isSupabaseConnected = false;
      this.notify();
      return;
    }

    try {
      this.isSyncing = true;
      this.notify();

      const [cloudReleases, cloudHolidays] = await Promise.all([
        fetchReleasesFromSupabase(),
        fetchHolidaysFromSupabase()
      ]);

      if (cloudReleases && cloudReleases.length > 0) {
        this.releases = cloudReleases;
        this.saveReleases();
      }

      if (cloudHolidays && cloudHolidays.length > 0) {
        this.holidays = cloudHolidays;
        this.saveHolidays();
      }

      this.recalculateAllHolidayConflicts();
      this.isSupabaseConnected = true;

      // Subscribe to Realtime Postgres updates
      if (this.unsubscribeRealtime) this.unsubscribeRealtime();
      this.unsubscribeRealtime = subscribeToSupabaseRealtime(
        (payload) => this.handleRealtimeRelease(payload),
        (payload) => this.handleRealtimeHoliday(payload)
      );

      // Start reliable background polling (every 15 seconds)
      this.startPolling();
    } catch (err) {
      console.warn('Could not sync with Supabase PostgreSQL, using local storage cache:', err);
      this.isSupabaseConnected = false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  handleRealtimeRelease(payload) {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const row = payload.new;
      const mapped = {
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
      const idx = this.releases.findIndex(r => r.id === mapped.id);
      if (idx >= 0) {
        this.releases[idx] = mapped;
      } else {
        this.releases.unshift(mapped);
      }
      this.saveReleases();
      this.notify();
    } else if (payload.eventType === 'DELETE') {
      const id = Number(payload.old.id);
      this.releases = this.releases.filter(r => r.id !== id);
      this.saveReleases();
      this.notify();
    }
  }

  handleRealtimeHoliday(payload) {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const row = payload.new;
      const mapped = {
        id: Number(row.id),
        name: row.name || '',
        startDate: row.start_date || '',
        endDate: row.end_date || row.start_date || '',
        notes: row.notes || ''
      };
      const idx = this.holidays.findIndex(h => h.id === mapped.id);
      if (idx >= 0) {
        this.holidays[idx] = mapped;
      } else {
        this.holidays.push(mapped);
      }
      this.saveHolidays();
      this.recalculateAllHolidayConflicts();
      this.notify();
    } else if (payload.eventType === 'DELETE') {
      const id = Number(payload.old.id);
      this.holidays = this.holidays.filter(h => h.id !== id);
      this.saveHolidays();
      this.recalculateAllHolidayConflicts();
      this.notify();
    }
  }

  disconnectSupabase() {
    this.stopPolling();
    if (this.unsubscribeRealtime) {
      this.unsubscribeRealtime();
      this.unsubscribeRealtime = null;
    }
    this.isSupabaseConnected = false;
    this.notify();
  }

  async syncNow() {
    this.isSyncing = true;
    this.notify();
    try {
      const cloudData = await fetchCloudStore();
      if (cloudData && Array.isArray(cloudData.releases) && cloudData.releases.length > 0) {
        this.releases = cloudData.releases;
        if (Array.isArray(cloudData.holidays) && cloudData.holidays.length > 0) {
          this.holidays = cloudData.holidays;
          this.saveHolidays();
        }
        this.saveReleases();
        this.recalculateAllHolidayConflicts();
      }
      if (this.isSupabaseConnected) {
        await this.initSupabase();
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (!this.isSyncing) {
        try {
          const cloudData = await fetchCloudStore();
          if (cloudData && Array.isArray(cloudData.releases)) {
            const normalizedCloud = cloudData.releases.map(r => this.normalizeRelease(r));
            const currSummary = this.releases.map(r => `${r.id}:${r.stage}:${r.status}:${r.targetDeploy}:${r.name}`).join('|');
            const newSummary = normalizedCloud.map(r => `${r.id}:${r.stage}:${r.status}:${r.targetDeploy}:${r.name}`).join('|');
            if (currSummary !== newSummary) {
              console.log('🔄 Live update received from team member, refreshing views...');
              this.releases = normalizedCloud;
              if (Array.isArray(cloudData.holidays) && cloudData.holidays.length > 0) {
                this.holidays = cloudData.holidays;
                this.saveHolidays();
              }
              this.saveReleases();
              this.recalculateAllHolidayConflicts();
              this.notify();
            }
          }
        } catch (e) {
          // background poll catch
        }
      }
    }, 6000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // --- Holiday Conflict Calculation ---
  // Exactly implements the Excel sheet logic:
  // IF TargetDeploy falls within [HolidayStart, HolidayEnd] -> "Conflict: " + HolidayName
  checkHolidayConflict(targetDeployDate) {
    if (!targetDeployDate) return null;
    const target = targetDeployDate.trim();
    if (!target) return null;

    for (const holiday of this.holidays) {
      if (!holiday.startDate) continue;
      const start = holiday.startDate;
      const end = holiday.endDate || holiday.startDate;
      if (target >= start && target <= end) {
        return {
          holiday,
          conflictText: `Conflict: ${holiday.name}`
        };
      }
    }
    return null;
  }

  recalculateAllHolidayConflicts() {
    let changed = false;
    for (const release of this.releases) {
      const conflict = this.checkHolidayConflict(release.targetDeploy);
      const newConflictText = conflict ? conflict.conflictText : '';
      if (release.holidayConflict !== newConflictText) {
        release.holidayConflict = newConflictText;
        changed = true;
      }
    }
    if (changed) {
      this.saveReleases();
    }
  }

  // --- CRUD for Releases ---
  addRelease(data) {
    const nextId = this.releases.length > 0
      ? Math.max(...this.releases.map(r => Number(r.id) || 0)) + 1
      : 1;

    const conflict = this.checkHolidayConflict(data.targetDeploy);

    const newRelease = {
      id: nextId,
      name: (data.name || '').trim(),
      ritm: (data.ritm || '').trim(),
      cr: (data.cr || '').trim(),
      developer: (data.developer || '').trim(),
      version: (data.version || 'v1').trim(),
      platform: data.platform || 'GSM',
      type: data.type || 'Scheduled',
      startDate: data.startDate || '',
      targetDeploy: data.targetDeploy || '',
      stage: data.stage || 'Development',
      owner: data.owner || 'Dev Team',
      status: data.status || 'On Track',
      dbObjects: (data.dbObjects || '').trim(),
      notes: (data.notes || '').trim(),
      email: (data.email || '').trim(),
      holidayConflict: conflict ? conflict.conflictText : ''
    };

    this.releases.push(newRelease);
    this.saveReleases();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      upsertReleaseInSupabase(newRelease).catch(err => {
        console.error('Failed to sync new release to Supabase:', err);
      });
    }

    return newRelease;
  }

  updateRelease(id, updates) {
    const index = this.releases.findIndex(r => r.id === id);
    if (index === -1) return null;

    const current = this.releases[index];
    const updated = { ...current, ...updates };

    if (updates.targetDeploy !== undefined) {
      const conflict = this.checkHolidayConflict(updated.targetDeploy);
      updated.holidayConflict = conflict ? conflict.conflictText : '';
    }

    this.releases[index] = updated;
    this.saveReleases();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      upsertReleaseInSupabase(updated).catch(err => {
        console.error('Failed to sync updated release to Supabase:', err);
      });
    }

    return updated;
  }

  deleteRelease(id) {
    const index = this.releases.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.releases.splice(index, 1);
    this.saveReleases();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      deleteReleaseInSupabase(id).catch(err => {
        console.error('Failed to sync deleted release from Supabase:', err);
      });
    }

    return true;
  }

  duplicateRelease(id) {
    const original = this.releases.find(r => r.id === id);
    if (!original) return null;
    const copy = { ...original };
    delete copy.id;
    copy.name = `${original.name} (Copy)`;
    return this.addRelease(copy);
  }

  getReleaseById(id) {
    return this.releases.find(r => r.id === id) || null;
  }

  // --- CRUD for Holidays ---
  addHoliday(data) {
    const nextId = this.holidays.length > 0
      ? Math.max(...this.holidays.map(h => Number(h.id) || 0)) + 1
      : 1;

    const newHoliday = {
      id: nextId,
      name: (data.name || '').trim(),
      startDate: data.startDate || '',
      endDate: data.endDate || data.startDate || '',
      notes: (data.notes || '').trim()
    };

    this.holidays.push(newHoliday);
    this.saveHolidays();
    this.recalculateAllHolidayConflicts();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      upsertHolidayInSupabase(newHoliday).catch(err => {
        console.error('Failed to sync new holiday to Supabase:', err);
      });
    }

    return newHoliday;
  }

  updateHoliday(id, updates) {
    const index = this.holidays.findIndex(h => h.id === id);
    if (index === -1) return null;

    this.holidays[index] = { ...this.holidays[index], ...updates };
    this.saveHolidays();
    this.recalculateAllHolidayConflicts();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      upsertHolidayInSupabase(this.holidays[index]).catch(err => {
        console.error('Failed to sync updated holiday to Supabase:', err);
      });
    }

    return this.holidays[index];
  }

  deleteHoliday(id) {
    const index = this.holidays.findIndex(h => h.id === id);
    if (index === -1) return false;
    this.holidays.splice(index, 1);
    this.saveHolidays();
    this.recalculateAllHolidayConflicts();
    this.notify();

    // Push to zero-config cloud store for all team members
    pushCloudStore(this.releases, this.holidays).catch(() => {});

    if (this.isSupabaseConnected) {
      deleteHolidayInSupabase(id).catch(err => {
        console.error('Failed to sync deleted holiday from Supabase:', err);
      });
    }

    return true;
  }

  getFilteredReleases() {
    const filtered = this.releases.filter(rel => {
      // Search (General: release title, developer, version, tickets, notes)
      if (this.filters.search) {
        const query = this.filters.search.toLowerCase();
        const searchCorpus = [
          rel.name,
          rel.developer,
          rel.version,
          rel.platform,
          rel.type,
          rel.stage,
          rel.owner,
          rel.status,
          rel.ritm,
          rel.cr,
          rel.notes
        ].join(' ').toLowerCase();

        if (!searchCorpus.includes(query)) return false;
      }

      // Impacted DB Object Search: searches strictly and only in Database Objects Changed
      if (this.filters.impactedObject && this.filters.impactedObject !== 'ALL' && this.filters.impactedObject.trim()) {
        const objQuery = this.filters.impactedObject.trim().toLowerCase();
        if (!rel.dbObjects) return false;
        if (!rel.dbObjects.toLowerCase().includes(objQuery)) return false;
      }

      // Platform
      if (this.filters.platform !== 'ALL' && rel.platform !== this.filters.platform) {
        return false;
      }

      // Deployment Type
      if (this.filters.type !== 'ALL' && rel.type !== this.filters.type) {
        return false;
      }

      // Stage
      if (this.filters.stage !== 'ALL' && rel.stage !== this.filters.stage) {
        return false;
      }

      // Status
      if (this.filters.status !== 'ALL' && rel.status !== this.filters.status) {
        return false;
      }

      // Owner
      if (this.filters.owner !== 'ALL' && rel.owner !== this.filters.owner) {
        return false;
      }

      // Developer
      if (this.filters.developer && this.filters.developer !== 'ALL' && rel.developer !== this.filters.developer) {
        return false;
      }

      // Month
      if (this.filters.month !== 'ALL' && rel.targetDeploy) {
        const m = parseInt(rel.targetDeploy.split('-')[1], 10);
        if (m !== parseInt(this.filters.month, 10)) return false;
      }

      // Year
      if (this.filters.year !== 'ALL' && rel.targetDeploy) {
        const y = parseInt(rel.targetDeploy.split('-')[0], 10);
        if (y !== parseInt(this.filters.year, 10)) return false;
      }

      // Has Holiday Conflict
      if (this.filters.hasConflict && (!rel.holidayConflict || !rel.holidayConflict.startsWith('Conflict:'))) {
        return false;
      }

      return true;
    });

    // Apply sorting (default reverse order by ID)
    const col = this.sort?.column || 'id';
    const dir = this.sort?.direction === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (col === 'id') {
        return (Number(a.id || 0) - Number(b.id || 0)) * dir;
      }
      if (col === 'targetDeploy' || col === 'startDate') {
        const valA = a[col] || '';
        const valB = b[col] || '';
        if (!valA && !valB) return 0;
        if (!valA) return 1; // empty dates always sink to bottom
        if (!valB) return -1;
        return valA.localeCompare(valB) * dir;
      }
      const valA = (a[col] || '').toString().toLowerCase();
      const valB = (b[col] || '').toString().toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  }

  getAllDbObjects() {
    const set = new Set();
    this.releases.forEach(rel => {
      if (rel.dbObjects) {
        rel.dbObjects.split(/[,;\n\r\t\s]+/).forEach(obj => {
          const trimmed = obj.trim().replace(/^[,;]+|[,;]+$/g, '');
          if (trimmed && !['none', 'na', 'n/a', 'nil', 'nothing', '-'].includes(trimmed.toLowerCase())) {
            set.add(trimmed);
          }
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  setSort(column, direction = null, notify = false) {
    if (!direction) {
      if (this.sort.column === column) {
        this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        this.sort.column = column;
        this.sort.direction = (column === 'id' || column === 'targetDeploy') ? 'desc' : 'asc';
      }
    } else {
      this.sort.column = column;
      this.sort.direction = direction;
    }
    if (notify) {
      this.notify();
    }
  }

  // --- Metrics Computation (Excel Dashboard Logic) ---
  getMetrics(month = null, year = null) {
    const targetReleases = this.releases.filter(rel => {
      if (!month && !year) return true;
      if (!rel.targetDeploy) return false;
      const parts = rel.targetDeploy.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (year && y !== parseInt(year, 10)) return false;
      if (month && m !== parseInt(month, 10)) return false;
      return true;
    });

    const total = targetReleases.length;
    const completed = targetReleases.filter(r => r.status === 'Completed').length;
    const open = total - completed;

    // Due soon: targetDeploy within next 3 days and not completed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    const dueSoon = targetReleases.filter(r => {
      if (r.status === 'Completed' || !r.targetDeploy) return false;
      const targetDate = new Date(r.targetDeploy + 'T00:00:00');
      return targetDate >= today && targetDate <= threeDaysLater;
    }).length;

    const completionRate = total > 0 ? (completed / total) : 0;

    // By Platform
    const byPlatform = {};
    for (const p of this.platforms) byPlatform[p] = 0;
    for (const r of targetReleases) {
      if (r.platform) byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1;
    }

    // By Type
    const byType = {};
    for (const t of this.deploymentTypes) {
      if (t !== 'Urgent') byType[t] = 0;
    }
    for (const r of targetReleases) {
      const type = (r.type === 'Urgent' ? 'Emergency' : r.type);
      if (type && byType.hasOwnProperty(type)) {
        byType[type] = (byType[type] || 0) + 1;
      }
    }

    // By Status
    const byStatus = {};
    for (const s of this.statuses) byStatus[s] = 0;
    for (const r of targetReleases) {
      if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    // By Stage
    const byStage = {};
    for (const st of this.stages) byStage[st] = 0;
    for (const r of targetReleases) {
      if (r.stage) byStage[r.stage] = (byStage[r.stage] || 0) + 1;
    }

    // Holiday conflicts count in target releases
    const holidayConflictsCount = targetReleases.filter(r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:')).length;

    return {
      total,
      completed,
      open,
      dueSoon,
      completionRate,
      byPlatform,
      byType,
      byStatus,
      byStage,
      holidayConflictsCount,
      holidaysDefined: this.holidays.length
    };
  }

  // --- Advanced Analytics Engine ---
  getAdvancedAnalytics(month = null, year = null) {
    const targetReleases = this.releases.filter(rel => {
      if (!month && !year) return true;
      if (!rel.targetDeploy) return false;
      const parts = rel.targetDeploy.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (year && y !== parseInt(year, 10)) return false;
      if (month && m !== parseInt(month, 10)) return false;
      return true;
    });

    const activeYear = year || 2026;
    const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. Monthly Throughput Trend (across 12 months of activeYear)
    const monthlyTrend = monthShorts.map((name, idx) => {
      const mNum = idx + 1;
      const monthRels = this.releases.filter(r => {
        if (!r.targetDeploy) return false;
        const [yStr, mStr] = r.targetDeploy.split('-');
        return parseInt(mStr, 10) === mNum && parseInt(yStr, 10) === activeYear;
      });
      const completed = monthRels.filter(r => r.status === 'Completed').length;
      const open = monthRels.length - completed;
      return {
        month: mNum,
        name,
        total: monthRels.length,
        completed,
        open
      };
    });

    // 2. Cycle Time & Lead Time in Days
    const cycleTimeReleases = targetReleases.filter(r => r.startDate && r.targetDeploy && r.targetDeploy >= r.startDate);
    const cycleTimes = cycleTimeReleases.map(r => {
      const s = new Date(r.startDate + 'T00:00:00');
      const t = new Date(r.targetDeploy + 'T00:00:00');
      const days = Math.max(1, Math.round((t - s) / (1000 * 60 * 60 * 24)));
      return { ...r, days };
    });

    const avgLeadTime = cycleTimes.length > 0
      ? (cycleTimes.reduce((acc, r) => acc + r.days, 0) / cycleTimes.length).toFixed(1)
      : '0.0';

    const hotfixCycles = cycleTimes.filter(r => r.type === 'Hotfix' || r.type === 'Emergency');
    const scheduledCycles = cycleTimes.filter(r => r.type === 'Scheduled');

    const avgHotfixLeadTime = hotfixCycles.length > 0
      ? (hotfixCycles.reduce((acc, r) => acc + r.days, 0) / hotfixCycles.length).toFixed(1)
      : '1.5';

    const avgScheduledLeadTime = scheduledCycles.length > 0
      ? (scheduledCycles.reduce((acc, r) => acc + r.days, 0) / scheduledCycles.length).toFixed(1)
      : '14.0';

    // Platform Lead Times
    const platformLeadTimes = {};
    for (const p of this.platforms) {
      const pRels = cycleTimes.filter(r => r.platform === p);
      if (pRels.length > 0) {
        const avg = (pRels.reduce((acc, r) => acc + r.days, 0) / pRels.length).toFixed(1);
        platformLeadTimes[p] = { avg: parseFloat(avg), count: pRels.length };
      } else {
        platformLeadTimes[p] = { avg: 0, count: 0 };
      }
    }

    // 3. Developer Workload & Delivery Velocity
    const devMap = {};
    for (const r of targetReleases) {
      const dev = (r.developer || 'Unassigned').trim();
      if (!devMap[dev]) {
        devMap[dev] = { name: dev, total: 0, completed: 0, open: 0, atRisk: 0, platforms: new Set() };
      }
      devMap[dev].total++;
      if (r.status === 'Completed') devMap[dev].completed++;
      else devMap[dev].open++;
      if (r.status === 'At Risk' || r.status === 'Delayed') devMap[dev].atRisk++;
      if (r.platform) devMap[dev].platforms.add(r.platform);
    }

    const devWorkload = Object.values(devMap)
      .map(d => ({
        ...d,
        platforms: Array.from(d.platforms),
        completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    // 4. Change Management & Stability Ratios
    const totalCount = targetReleases.length;
    const scheduledCount = targetReleases.filter(r => r.type === 'Scheduled').length;
    const hotfixCount = targetReleases.filter(r => r.type === 'Hotfix').length;
    const emergencyCount = targetReleases.filter(r => r.type === 'Emergency').length;

    const plannedStabilityPct = totalCount > 0
      ? Math.round((scheduledCount / totalCount) * 100)
      : 100;
    const reactivePct = totalCount > 0
      ? Math.round(((hotfixCount + emergencyCount) / totalCount) * 100)
      : 0;

    // Audit compliance: RITM or CR documented
    const auditCompliantCount = targetReleases.filter(r => (r.ritm && r.ritm.trim()) || (r.cr && r.cr.trim())).length;
    const auditCompliancePct = totalCount > 0
      ? Math.round((auditCompliantCount / totalCount) * 100)
      : 0;

    // 5. Database & Schema Impact Footprint
    const dbChangesCount = targetReleases.filter(r => {
      if (!r.dbObjects) return false;
      const val = r.dbObjects.trim().toLowerCase();
      return val && val !== 'na' && val !== 'none' && val !== 'no' && val !== 'nil';
    }).length;
    const dbChangesPct = totalCount > 0 ? Math.round((dbChangesCount / totalCount) * 100) : 0;

    // 6. Next Holiday Countdown & Proactive Advisory
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    const upcomingHolidays = this.holidays
      .filter(h => h.startDate && h.startDate >= todayYMD)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : (this.holidays[0] || null);
    let daysToNextHoliday = null;
    let releasesNearHoliday = [];

    if (nextHoliday && nextHoliday.startDate) {
      const hDate = new Date(nextHoliday.startDate + 'T00:00:00');
      const diffMs = hDate - now;
      daysToNextHoliday = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const hEnd = nextHoliday.endDate || nextHoliday.startDate;
      releasesNearHoliday = this.releases.filter(r => {
        if (!r.targetDeploy || r.status === 'Completed') return false;
        return (r.targetDeploy >= nextHoliday.startDate && r.targetDeploy <= hEnd) || r.holidayConflict;
      });
    }

    return {
      monthlyTrend,
      avgLeadTime,
      avgHotfixLeadTime,
      avgScheduledLeadTime,
      platformLeadTimes,
      devWorkload,
      plannedStabilityPct,
      reactivePct,
      scheduledCount,
      hotfixCount,
      emergencyCount,
      auditCompliancePct,
      auditCompliantCount,
      dbChangesCount,
      dbChangesPct,
      nextHoliday,
      daysToNextHoliday,
      releasesNearHoliday
    };
  }

  // Get all conflicts for report
  getConflictingReleases() {
    return this.releases.filter(r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:'));
  }
}

export const store = new ReleaseStore();

