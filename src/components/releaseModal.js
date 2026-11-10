import { store } from '../data/store.js';
import { showToast } from '../utils/toast.js';

export function openReleaseModal({ mode = 'create', id = null, defaultDate = '' } = {}) {
  // Always clean up existing release modal overlay first to avoid lingering elements
  const existing = document.getElementById('release-modal-overlay');
  if (existing) existing.remove();

  const modalEl = document.createElement('div');
  modalEl.id = 'release-modal-overlay';
  modalEl.className = 'modal-overlay';
  document.body.appendChild(modalEl);

  const isEdit = mode === 'edit' && id !== null && id !== undefined;
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
        <button class="modal-close-btn" id="modal-close" type="button" aria-label="Close modal">&times;</button>
      </div>

      <form id="release-form" class="modal-form-wrap">
        <div class="modal-body">
          <!-- Live Holiday Conflict Indicator Banner -->
          <div id="modal-conflict-banner" class="alert-banner warning-banner" style="display: none;">
            <div class="banner-icon">⚠️</div>
            <div class="banner-content">
              <div class="banner-title" id="conflict-banner-title">Holiday Conflict Detected</div>
              <div class="banner-text" id="conflict-banner-desc">Target deployment falls within a public holiday period.</div>
            </div>
          </div>

          <!-- Mandatory Governance Banner for Completed Deployments -->
          <div id="modal-completion-banner" class="alert-banner warning-banner" style="display: none;">
            <div class="banner-icon">🛡️</div>
            <div class="banner-content">
              <div class="banner-title">Deployment Completion Governance</div>
              <div class="banner-text">ServiceNow <strong>Change Request (CR)</strong> and <strong>RITM Number</strong> are both mandatory before completing a deployment.</div>
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
              <label class="form-label required" id="label-stage">Current Stage</label>
              <select name="stage" id="input-stage" class="form-select" required>
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
              <label class="form-label required" id="label-status">Status</label>
              <select name="status" id="input-status" class="form-select" required>
                ${store.statuses.map(st => `
                  <option value="${st}" ${rel && rel.status === st ? 'selected' : (!rel && st === 'On Track' ? 'selected' : '')}>${st}</option>
                `).join('')}
              </select>
            </div>

            <!-- Ticket RITM -->
            <div class="form-group">
              <label class="form-label" id="label-ritm">RITM Number</label>
              <input type="text" name="ritm" id="input-ritm" class="form-input font-mono" maxlength="30" 
                     placeholder="e.g. RITM0129384" 
                     value="${escapeHtml(rel ? rel.ritm : '')}">
              <span class="field-hint" id="hint-ritm">Required for Completed deployments</span>
            </div>

            <!-- Ticket CR -->
            <div class="form-group">
              <label class="form-label" id="label-cr">Change Request (CR)</label>
              <input type="text" name="cr" id="input-cr" class="form-input font-mono" maxlength="30" 
                     placeholder="e.g. CR-90218 or CHG0154162" 
                     value="${escapeHtml(rel ? rel.cr : '')}">
              <span class="field-hint" id="hint-cr">Required for Completed deployments</span>
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

            <!-- GitLab Deployment Link -->
            <div class="form-group col-span-2">
              <label class="form-label" style="display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fc6d26" stroke-width="2">
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"></path>
                </svg>
                GitLab Deployment Link
              </label>
              <input type="url" name="gitlabUrl" id="input-gitlab-url" class="form-input font-mono" 
                     placeholder="e.g. https://gitlab.com/org/repo/-/pipelines/12345 or MR link" 
                     value="${escapeHtml(rel ? (rel.gitlabUrl || rel.gitlab || '') : '')}">
              <span class="field-hint">Optional direct URL to GitLab MR, Pipeline, or Deployment job</span>
            </div>
          </div>
        </div>

        <!-- Pinned Fixed Footer: Always Visible and Accessible -->
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

  // Elements
  const form = modalEl.querySelector('#release-form');
  const targetDeployInput = modalEl.querySelector('#input-target-deploy');
  const conflictBanner = modalEl.querySelector('#modal-conflict-banner');
  const conflictTitle = modalEl.querySelector('#conflict-banner-title');
  const conflictDesc = modalEl.querySelector('#conflict-banner-desc');

  const stageSelect = modalEl.querySelector('#input-stage');
  const statusSelect = modalEl.querySelector('#input-status');
  const completionBanner = modalEl.querySelector('#modal-completion-banner');
  const labelRitm = modalEl.querySelector('#label-ritm');
  const labelCr = modalEl.querySelector('#label-cr');
  const inputRitm = modalEl.querySelector('#input-ritm');
  const inputCr = modalEl.querySelector('#input-cr');
  const hintRitm = modalEl.querySelector('#hint-ritm');
  const hintCr = modalEl.querySelector('#hint-cr');

  // Governance state updater: marks CR & RITM required when stage or status is Completed
  const updateGovernanceState = () => {
    const isCompleted = (stageSelect.value === 'Completed' || statusSelect.value === 'Completed');
    if (isCompleted) {
      completionBanner.style.display = 'flex';
      labelRitm.classList.add('required');
      labelRitm.innerHTML = `RITM Number <span class="governance-req-hint">(Required to complete)</span>`;
      labelCr.classList.add('required');
      labelCr.innerHTML = `Change Request (CR) <span class="governance-req-hint">(Required to complete)</span>`;
      hintRitm.style.color = '#f97316';
      hintCr.style.color = '#f97316';
    } else {
      completionBanner.style.display = 'none';
      labelRitm.classList.remove('required');
      labelRitm.textContent = `RITM Number`;
      labelCr.classList.remove('required');
      labelCr.textContent = `Change Request (CR)`;
      hintRitm.style.color = '';
      hintCr.style.color = '';
      inputRitm.classList.remove('input-field-error');
      inputCr.classList.remove('input-field-error');
    }
  };

  stageSelect.addEventListener('change', updateGovernanceState);
  statusSelect.addEventListener('change', updateGovernanceState);
  updateGovernanceState(); // Initial evaluation

  // Clear error styles when user types in CR / RITM
  inputRitm.addEventListener('input', () => {
    if (inputRitm.value.trim()) inputRitm.classList.remove('input-field-error');
  });
  inputCr.addEventListener('input', () => {
    if (inputCr.value.trim()) inputCr.classList.remove('input-field-error');
  });

  // Real-time holiday conflict checking
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
  checkConflict();

  // Close handlers
  const closeModal = () => {
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.remove();
  };

  modalEl.querySelector('#modal-close').onclick = closeModal;
  modalEl.querySelector('#modal-cancel').onclick = closeModal;

  // Safe backdrop click handling
  let isBackdropClick = false;
  modalEl.onmousedown = (e) => {
    isBackdropClick = (e.target === modalEl);
  };
  modalEl.onmouseup = (e) => {
    if (isBackdropClick && e.target === modalEl) {
      closeModal();
    }
    isBackdropClick = false;
  };

  // Submit handler with strict Governance Enforcement
  form.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Deployment Governance Check: CR and RITM are mandatory to complete deployment
    const isCompleted = (data.stage === 'Completed' || data.status === 'Completed');
    const crVal = (data.cr || '').trim();
    const ritmVal = (data.ritm || '').trim();

    if (isCompleted && (!crVal || !ritmVal)) {
      if (!crVal && !ritmVal) {
        showToast({
          title: 'GOVERNANCE COMPLIANCE REQUIRED',
          message: 'Both <strong>Change Request (CR)</strong> and <strong>RITM Number</strong> are mandatory to complete a deployment.',
          type: 'warning',
          duration: 6000
        });
        inputRitm.classList.add('input-field-error');
        inputCr.classList.add('input-field-error');
        inputRitm.focus();
      } else if (!crVal) {
        showToast({
          title: 'GOVERNANCE COMPLIANCE REQUIRED',
          message: '<strong>Change Request (CR)</strong> ticket number is mandatory to complete a deployment.',
          type: 'warning',
          duration: 6000
        });
        inputCr.classList.add('input-field-error');
        inputCr.focus();
      } else {
        showToast({
          title: 'GOVERNANCE COMPLIANCE REQUIRED',
          message: '<strong>RITM Number</strong> ticket is mandatory to complete a deployment.',
          type: 'warning',
          duration: 6000
        });
        inputRitm.classList.add('input-field-error');
        inputRitm.focus();
      }
      return; // Block submission
    }

    try {
      let resultRelease = null;
      if (isEdit) {
        resultRelease = store.updateRelease(id, data);
        showToast({
          title: 'RECORD UPDATED',
          message: `Release "<strong>${escapeHtml(data.name)}</strong>" updated successfully.`,
          type: 'success',
          duration: 4000
        });
      } else {
        resultRelease = store.addRelease(data);
        if (resultRelease) {
          store.currentView = 'releases';
          showToast({
            title: 'NEW RELEASE CREATED',
            message: `Release #${resultRelease.id} "<strong>${escapeHtml(data.name)}</strong>" scheduled successfully and added to list.`,
            type: 'success',
            duration: 4500
          });
        }
      }

      // If the calendar is currently active, ensure it navigates to the release's month
      if (resultRelease && resultRelease.targetDeploy && window._calState) {
        const parts = resultRelease.targetDeploy.split('-');
        if (parts.length >= 2) {
          const relYear = parseInt(parts[0], 10);
          const relMonth = parseInt(parts[1], 10);
          if (window._calState.month !== relMonth || window._calState.year !== relYear) {
            window._calState.month = relMonth;
            window._calState.year = relYear;
          }
        }
      }
    } catch (err) {
      console.error('Error during release save:', err);
    } finally {
      closeModal();
    }
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
