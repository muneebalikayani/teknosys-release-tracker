import { store } from '../data/store.js';

export function openReleaseModal({ mode = 'create', id = null, defaultDate = '' } = {}) {
  let modalEl = document.getElementById('release-modal-overlay');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'release-modal-overlay';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  const isEdit = mode === 'edit' && id !== null;
  const rel = isEdit ? store.getReleaseById(id) : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const initialStartDate = rel ? rel.startDate : (defaultDate || todayStr);
  const initialTargetDeploy = rel ? rel.targetDeploy : (defaultDate || todayStr);

  modalEl.innerHTML = `
    <div class="modal-card modal-lg">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-eyebrow">${isEdit ? 'UPDATE RECORD' : 'NEW RELEASE ENTRY'}</span>
          <h2 class="modal-title">${isEdit ? 'Edit Release Record' : 'Create New Release'}</h2>
        </div>
        <button class="modal-close-btn" id="modal-close">&times;</button>
      </div>

      <form id="release-form" class="modal-body">
        <!-- Live Holiday Conflict Indicator Banner -->
        <div id="modal-conflict-banner" class="alert-banner warning-banner" style="display: none;">
          <div class="banner-icon">⚠️</div>
          <div class="banner-content">
            <div class="banner-title" id="conflict-banner-title">Holiday Conflict Detected</div>
            <div class="banner-text" id="conflict-banner-desc">Target deployment falls within a public holiday period.</div>
          </div>
        </div>

        <div class="form-grid-2">
          <!-- Release Name -->
          <div class="form-group col-span-2">
            <label class="form-label required">Release Name</label>
            <input type="text" name="name" class="form-input" required maxlength="200" 
                   placeholder="e.g. BVS Sales Old Age flag Core" 
                   value="${escapeHtml(rel ? rel.name : '')}">
          </div>

          <!-- Developer Name -->
          <div class="form-group">
            <label class="form-label required">Developer Name</label>
            <input type="text" name="developer" class="form-input" required maxlength="100" 
                   placeholder="e.g. Rabia Qayyum" 
                   value="${escapeHtml(rel ? rel.developer : '')}">
          </div>

          <!-- Version / Tag -->
          <div class="form-group">
            <label class="form-label">Version / Tag</label>
            <input type="text" name="version" class="form-input font-mono" maxlength="30" 
                   placeholder="e.g. v1, v2.1" 
                   value="${escapeHtml(rel ? rel.version : 'v1')}">
          </div>

          <!-- Platform -->
          <div class="form-group">
            <label class="form-label required">Platform</label>
            <select name="platform" class="form-select" required>
              ${store.platforms.map(p => `
                <option value="${p}" ${rel && rel.platform === p ? 'selected' : (!rel && p === 'GSM' ? 'selected' : '')}>${p}</option>
              `).join('')}
            </select>
          </div>

          <!-- Deployment Type -->
          <div class="form-group">
            <label class="form-label required">Deployment Type</label>
            <select name="type" class="form-select" required>
              ${store.deploymentTypes.map(t => `
                <option value="${t}" ${rel && rel.type === t ? 'selected' : (!rel && t === 'Scheduled' ? 'selected' : '')}>${t}</option>
              `).join('')}
            </select>
          </div>

          <!-- Start Date -->
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" name="startDate" id="input-start-date" class="form-input font-mono" 
                   value="${initialStartDate}">
          </div>

          <!-- Target Deploy Date -->
          <div class="form-group">
            <label class="form-label required">Target Deploy Date</label>
            <input type="date" name="targetDeploy" id="input-target-deploy" class="form-input font-mono" required 
                   value="${initialTargetDeploy}">
            <span class="field-hint">Checked in real-time against holiday dates</span>
          </div>

          <!-- Current Stage -->
          <div class="form-group">
            <label class="form-label required">Current Stage</label>
            <select name="stage" class="form-select" required>
              ${store.stages.map(s => `
                <option value="${s}" ${rel && rel.stage === s ? 'selected' : (!rel && s === 'Development' ? 'selected' : '')}>${s}</option>
              `).join('')}
            </select>
          </div>

          <!-- Stage Owner -->
          <div class="form-group">
            <label class="form-label required">Stage Owner</label>
            <select name="owner" class="form-select" required>
              ${store.owners.map(o => `
                <option value="${o}" ${rel && rel.owner === o ? 'selected' : (!rel && o === 'Dev Team' ? 'selected' : '')}>${o}</option>
              `).join('')}
            </select>
          </div>

          <!-- Status -->
          <div class="form-group">
            <label class="form-label required">Status</label>
            <select name="status" class="form-select" required>
              ${store.statuses.map(st => `
                <option value="${st}" ${rel && rel.status === st ? 'selected' : (!rel && st === 'On Track' ? 'selected' : '')}>${st}</option>
              `).join('')}
            </select>
          </div>

          <!-- Ticket RITM -->
          <div class="form-group">
            <label class="form-label">RITM Number</label>
            <input type="text" name="ritm" class="form-input font-mono" maxlength="30" 
                   placeholder="e.g. RITM0129384" 
                   value="${escapeHtml(rel ? rel.ritm : '')}">
          </div>

          <!-- Ticket CR -->
          <div class="form-group">
            <label class="form-label">Change Request (CR)</label>
            <input type="text" name="cr" class="form-input font-mono" maxlength="30" 
                   placeholder="e.g. CR-90218" 
                   value="${escapeHtml(rel ? rel.cr : '')}">
          </div>

          <!-- DB Objects Changed -->
          <div class="form-group col-span-2">
            <label class="form-label">Impacted Database Objects</label>
            <textarea name="dbObjects" class="form-textarea font-mono" rows="2" maxlength="1000"
                      placeholder="e.g. DW_SALES_FACT, SP_LOAD_BVS_SALES, VW_DAILY_KPIS (comma separated)">${escapeHtml(rel ? rel.dbObjects : '')}</textarea>
            <span class="field-hint">Impacted tables, views, stored procedures affected (comma separated)</span>
          </div>

          <!-- Notes / Blockers -->
          <div class="form-group col-span-2">
            <label class="form-label">Notes / Blockers</label>
            <input type="text" name="notes" class="form-input" maxlength="200" 
                   placeholder="e.g. Blocked on SIT data refresh from upstream core" 
                   value="${escapeHtml(rel ? rel.notes : '')}">
          </div>

          <!-- Email -->
          <div class="form-group col-span-2">
            <label class="form-label">Notification Email / Reference</label>
            <input type="text" name="email" class="form-input" 
                   placeholder="e.g. dev-team@teknosys.com or reference thread" 
                   value="${escapeHtml(rel ? rel.email : '')}">
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-submit">
            ${isEdit ? 'Update Release' : 'Save Release'}
          </button>
        </div>
      </form>
    </div>
  `;

  modalEl.classList.add('show');

  // Real-time conflict checking
  const targetDeployInput = modalEl.querySelector('#input-target-deploy');
  const conflictBanner = modalEl.querySelector('#modal-conflict-banner');
  const conflictTitle = modalEl.querySelector('#conflict-banner-title');
  const conflictDesc = modalEl.querySelector('#conflict-banner-desc');

  const checkConflict = () => {
    const val = targetDeployInput.value;
    const conflict = store.checkHolidayConflict(val);
    if (conflict) {
      conflictTitle.textContent = `⚠️ Holiday Conflict: ${conflict.holiday.name}`;
      conflictDesc.textContent = `Holiday period: ${conflict.holiday.startDate} to ${conflict.holiday.endDate || conflict.holiday.startDate}. Target deployments during public holidays are restricted.`;
      conflictBanner.style.display = 'flex';
      targetDeployInput.classList.add('input-conflict');
    } else {
      conflictBanner.style.display = 'none';
      targetDeployInput.classList.remove('input-conflict');
    }
  };

  targetDeployInput.addEventListener('input', checkConflict);
  checkConflict(); // Run initial check

  // Close handlers
  const closeModal = () => {
    modalEl.classList.remove('show');
  };

  modalEl.querySelector('#modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#modal-cancel').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Submit handler
  const form = modalEl.querySelector('#release-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (isEdit) {
      store.updateRelease(id, data);
    } else {
      store.addRelease(data);
    }

    closeModal();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
