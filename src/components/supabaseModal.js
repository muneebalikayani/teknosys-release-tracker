import {
  getSupabaseCredentials,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  seedSupabaseFromLocal
} from '../services/supabase.js';
import { store } from '../data/store.js';

export function openSupabaseModal() {
  // Remove existing modal if any
  const existing = document.getElementById('supabase-modal');
  if (existing) existing.remove();

  const creds = getSupabaseCredentials();
  const isConfigured = Boolean(creds.url && creds.anonKey);

  const modalEl = document.createElement('div');
  modalEl.className = 'modal-backdrop active';
  modalEl.id = 'supabase-modal';

  modalEl.innerHTML = `
    <div class="modal-card modal-lg" style="max-width: 650px;">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <span class="modal-badge-type" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:4px;">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            POSTGRESQL CLOUD DATABASE
          </span>
          <h2 class="modal-title" style="margin-top: 4px;">Supabase Database Connection</h2>
          <p class="modal-subtitle">Connect your PostgreSQL database for real-time team collaboration.</p>
        </div>
        <button class="modal-close-btn" id="db-modal-close">&times;</button>
      </div>

      <div class="modal-body" style="padding: 1.5rem;">
        <!-- Status Banner -->
        <div id="db-status-banner" class="alert-banner ${isConfigured ? 'success-banner' : 'info-banner'}" style="margin-bottom: 1.25rem;">
          <div class="banner-icon">${isConfigured ? '🟢' : '☁️'}</div>
          <div class="banner-content">
            <div class="banner-title" id="db-status-title">
              ${isConfigured ? 'Configured with Supabase' : 'Local Storage Mode Active'}
            </div>
            <div class="banner-text" id="db-status-desc">
              ${isConfigured 
                ? `Connected via: ${creds.url} (${creds.source})` 
                : 'Data is currently saved locally in your browser. Connect to Supabase to enable real-time team synchronization.'}
            </div>
          </div>
        </div>

        <!-- Connection Form -->
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label required">Supabase Project URL</label>
          <input type="url" id="db-input-url" class="form-input font-mono" 
                 placeholder="https://xyzcompany.supabase.co" 
                 value="${escapeAttr(creds.url || '')}">
          <span class="field-hint">Found in Supabase Dashboard -> Project Settings -> API</span>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label required">Supabase Anon Public API Key</label>
          <input type="password" id="db-input-key" class="form-input font-mono" 
                 placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
                 value="${escapeAttr(creds.anonKey || '')}">
          <span class="field-hint">Found in Supabase Dashboard -> Project Settings -> API (Public anon key)</span>
        </div>

        <!-- Action Result Message Box -->
        <div id="db-action-result" style="display: none; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem;"></div>

        <!-- Button Toolbar -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
          <button class="btn btn-primary" id="btn-db-save-test" style="flex: 1; min-width: 180px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Save & Connect
          </button>
          
          <button class="btn btn-secondary" id="btn-db-sync-seed" title="Upload local 37 releases & 21 holidays to Supabase" style="min-width: 170px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Upload Local Data
          </button>

          ${isConfigured ? `
            <button class="btn btn-secondary" id="btn-db-disconnect" style="color: #ef4444;" title="Switch back to browser localStorage">
              Disconnect
            </button>
          ` : ''}
        </div>

        <!-- 3-Step Setup Quick Guide -->
        <div class="card" style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem 1.25rem;">
          <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>📖 Setup Guide in 3 Steps (2 Minutes)</span>
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" class="link-subtle" style="font-size: 0.8rem; text-decoration: underline;">Open Supabase ↗</a>
          </div>
          <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.82rem; color: var(--text-muted); line-height: 1.6;">
            <li><strong>Create free project:</strong> Log in to <a href="https://supabase.com" target="_blank" class="link-subtle">supabase.com</a> and click <em>New Project</em>.</li>
            <li><strong>Run schema SQL:</strong> Go to <strong>SQL Editor</strong> -> click <strong>New Query</strong> -> paste the SQL from <code style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px;">supabase/schema.sql</code> and click <strong>Run</strong>.</li>
            <li><strong>Paste API Keys:</strong> Go to <strong>Project Settings -> API</strong>, copy your <strong>Project URL</strong> and <strong>anon key</strong>, paste them above, and click <strong>Save & Connect</strong>!</li>
          </ol>
        </div>
      </div>

      <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary" id="db-modal-btn-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Helper to show inline feedback
  const showResult = (msg, isSuccess) => {
    const box = modalEl.querySelector('#db-action-result');
    if (!box) return;
    box.style.display = 'block';
    box.style.background = isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    box.style.color = isSuccess ? '#10b981' : '#ef4444';
    box.style.border = `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`;
    box.textContent = msg;
  };

  // Close handlers
  const closeModal = () => modalEl.remove();
  modalEl.querySelector('#db-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#db-modal-btn-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Save & Test
  const saveBtn = modalEl.querySelector('#btn-db-save-test');
  saveBtn.addEventListener('click', async () => {
    const url = modalEl.querySelector('#db-input-url').value.trim();
    const key = modalEl.querySelector('#db-input-key').value.trim();

    if (!url || !key) {
      showResult('Please provide both the Project URL and Anon API Key.', false);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Connecting...</span>`;

    const testRes = await testSupabaseConnection(url, key);
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Save & Connect
    `;

    if (testRes.success) {
      saveSupabaseConfig(url, key);
      showResult('✅ Connected successfully! Syncing live data from Supabase...', true);
      await store.initSupabase();
      setTimeout(() => {
        closeModal();
      }, 1200);
    } else {
      showResult(`❌ Connection Failed: ${testRes.message}`, false);
    }
  });

  // Seed / Sync Local Data to Supabase
  const seedBtn = modalEl.querySelector('#btn-db-sync-seed');
  seedBtn.addEventListener('click', async () => {
    const url = modalEl.querySelector('#db-input-url').value.trim();
    const key = modalEl.querySelector('#db-input-key').value.trim();

    if (!url || !key) {
      showResult('Please enter your Supabase URL & Key before uploading data.', false);
      return;
    }

    seedBtn.disabled = true;
    seedBtn.textContent = 'Uploading...';

    saveSupabaseConfig(url, key);
    try {
      await seedSupabaseFromLocal(store.releases, store.holidays);
      showResult(`✅ Successfully uploaded ${store.releases.length} releases and ${store.holidays.length} holidays to Supabase PostgreSQL!`, true);
      await store.initSupabase();
    } catch (err) {
      showResult(`❌ Upload Error: ${err.message}. Did you run the schema.sql script in Supabase SQL editor?`, false);
    } finally {
      seedBtn.disabled = false;
      seedBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Upload Local Data
      `;
    }
  });

  // Disconnect
  const disconnectBtn = modalEl.querySelector('#btn-db-disconnect');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      clearSupabaseConfig();
      store.disconnectSupabase();
      showResult('Switched back to local browser storage.', true);
      setTimeout(() => closeModal(), 900);
    });
  }
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
