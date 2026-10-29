import confetti from 'canvas-confetti';
import { store } from '../data/store.js';

export function openReleaseDetailModal(id) {
  let modalEl = document.getElementById('release-detail-overlay');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'release-detail-overlay';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  const rel = store.getReleaseById(id);
  if (!rel) return;

  const stages = store.stages;
  const currentStageIdx = stages.indexOf(rel.stage);
  const isOnHold = rel.status === 'On Hold';
  const isCompleted = rel.status === 'Completed' || rel.stage === 'Completed';
  const hasConflict = rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:');

  const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
  const platformSlug = (rel.platform || '').toLowerCase();
  const typeSlug = (rel.type || '').toLowerCase();

  modalEl.innerHTML = `
    <div class="modal-card modal-lg release-detail-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="detail-tags-top">
            <span class="font-mono text-muted">RELEASE #${rel.id}</span>
            <span class="platform-tag platform-${platformSlug}">${rel.platform}</span>
            <span class="type-pill type-${typeSlug}">${rel.type}</span>
            <span class="status-pill status-${statusSlug}">${rel.status || 'Pending'}</span>
          </div>
          <h2 class="modal-title">${escapeHtml(rel.name)}</h2>
        </div>
        <button class="modal-close-btn" id="detail-modal-close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Stage Pipeline Stepper -->
        <div class="card pipeline-card">
          <div class="pipeline-header">
            <span class="card-eyebrow">LIFECYCLE PIPELINE PROGRESS</span>
            <div class="current-stage-readout-wrap">
              <span class="current-stage-readout">Current Stage: <strong>${rel.stage}</strong></span>
              ${isOnHold ? `
                <span class="badge-hold-glow">⏸️ On Hold at ${rel.stage}</span>
              ` : ''}
            </div>
          </div>

          <div class="stepper-track">
            ${stages.map((st, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              let stepClass = 'step-upcoming';
              if (isPast) stepClass = 'step-completed';
              if (isCurrent) stepClass = isOnHold ? 'step-current is-on-hold' : 'step-current';

              let dotContent = idx + 1;
              if (isPast) dotContent = '✓';
              else if (isCurrent && isOnHold) dotContent = '⏸';

              return `
                <div class="stepper-step ${stepClass}" data-stage-name="${st}" title="${isCurrent && isOnHold ? 'On Hold at ' + st + ' stage' : 'Click to jump to ' + st}">
                  <div class="step-dot-container">
                    <span class="step-dot">
                      ${dotContent}
                    </span>
                  </div>
                  <span class="step-label">${st}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="pipeline-actions-row">
            <div class="pipeline-left-btns">
              ${currentStageIdx >= 0 && currentStageIdx < stages.length - 1 ? `
                <button class="btn btn-sm btn-secondary" id="btn-advance-stage">
                  Advance Stage ➜ <strong>${stages[currentStageIdx + 1]}</strong>
                </button>
              ` : ''}

              ${isOnHold ? `
                <button class="btn btn-sm btn-outline-warning" id="btn-toggle-hold" title="Resume release workflow">
                  ▶️ Resume Release (On Track)
                </button>
              ` : (!isCompleted ? `
                <button class="btn btn-sm btn-ghost" id="btn-toggle-hold" title="Place release on hold at ${rel.stage}">
                  ⏸️ Put On Hold
                </button>
              ` : '')}
            </div>

            ${!isCompleted ? `
              <button class="btn btn-sm btn-primary" id="btn-mark-completed">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Mark as Completed
              </button>
            ` : `
              <span class="badge-success-glow">Release Completed</span>
            `}
          </div>
        </div>

        <!-- Holiday Conflict Banner if any -->
        ${hasConflict ? `
          <div class="alert-banner warning-banner">
            <div class="banner-icon">⚠️</div>
            <div class="banner-content">
              <div class="banner-title">Telecom Holiday Conflict</div>
              <div class="banner-text">Target Deploy <strong>${rel.targetDeploy}</strong> conflicts with: <em>${escapeHtml(rel.holidayConflict.replace('Conflict: ', ''))}</em>. Deployments are restricted during holiday periods.</div>
            </div>
            <button class="btn btn-sm btn-outline-warning" id="reschedule-btn">Reschedule Date</button>
          </div>
        ` : ''}

        <!-- Details Grid -->
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Developer</span>
            <div class="detail-val-user">
              <span class="dev-avatar">${getInitials(rel.developer)}</span>
              <strong>${escapeHtml(rel.developer || 'Unassigned')}</strong>
            </div>
          </div>

          <div class="detail-item">
            <span class="detail-label">Stage Owner</span>
            <span class="detail-val"><strong>${escapeHtml(rel.owner || '—')}</strong></span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Version / Tag</span>
            <span class="detail-val font-mono">${escapeHtml(rel.version || 'v1')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Start Date</span>
            <span class="detail-val font-mono">${rel.startDate || '—'}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">Target Deploy</span>
            <span class="detail-val font-mono ${hasConflict ? 'text-danger font-bold' : ''}">
              ${rel.targetDeploy || '—'}
            </span>
          </div>

          <div class="detail-item">
            <span class="detail-label">RITM Ticket</span>
            <span class="detail-val font-mono">${escapeHtml(rel.ritm || 'None')}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">CR Number</span>
            <span class="detail-val font-mono">${escapeHtml(rel.cr || 'None')}</span>
          </div>
        </div>

        <!-- DB Objects Changed Card -->
        <div class="card detail-section-card">
          <div class="section-card-header">
            <span class="section-title">Database Objects Changed</span>
            <span class="badge-count">${(() => {
              const objs = (rel.dbObjects || '').split(/[,;\n\r\t\s]+/).map(o => o.trim().replace(/^[,;]+|[,;]+$/g, '')).filter(o => o && !['none','na','n/a','nil','nothing','-'].includes(o.toLowerCase()));
              return objs.length;
            })()} objects</span>
          </div>
          <div class="db-objects-box">
            ${(() => {
              const objs = (rel.dbObjects || '').split(/[,;\n\r\t\s]+/).map(o => o.trim().replace(/^[,;]+|[,;]+$/g, '')).filter(o => o && !['none','na','n/a','nil','nothing','-'].includes(o.toLowerCase()));
              if (objs.length === 0) {
                return '<span class="text-muted text-sm">No database tables, views or procedures specified.</span>';
              }
              return `
                <div class="db-tags-wrap">
                  ${objs.map(obj => `
                    <span class="db-object-chip font-mono">${escapeHtml(obj)}</span>
                  `).join('')}
                </div>
              `;
            })()}
          </div>
        </div>

        <!-- Notes / Blockers -->
        ${rel.notes ? `
          <div class="card detail-section-card">
            <div class="section-card-header">
              <span class="section-title">Notes & Blockers</span>
            </div>
            <div class="notes-content">
              <p>${escapeHtml(rel.notes)}</p>
            </div>
          </div>
        ` : ''}

        <!-- Email / References -->
        ${rel.email ? `
          <div class="card detail-section-card">
            <div class="section-card-header">
              <span class="section-title">Email Notification / Thread</span>
            </div>
            <div class="email-content font-mono text-xs">
              <p>${escapeHtml(rel.email)}</p>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer detail-modal-footer">
        <div class="footer-left-actions">
          <button class="btn btn-ghost text-danger btn-sm" id="detail-delete-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
          </button>
          <button class="btn btn-secondary btn-sm" id="detail-duplicate-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Duplicate
          </button>
        </div>

        <div class="footer-right-actions">
          <button class="btn btn-secondary" id="detail-edit-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Edit Record
          </button>
          <button class="btn btn-primary" id="detail-done-btn">Done</button>
        </div>
      </div>
    </div>
  `;

  modalEl.classList.add('show');

  const closeModal = () => modalEl.classList.remove('show');
  modalEl.querySelector('#detail-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#detail-done-btn').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Advance Stage button
  modalEl.querySelector('#btn-advance-stage')?.addEventListener('click', () => {
    if (currentStageIdx < stages.length - 1) {
      const nextStage = stages[currentStageIdx + 1];
      const updates = { stage: nextStage };
      if (nextStage === 'Completed') {
        updates.status = 'Completed';
        triggerCelebration();
      }
      store.updateRelease(id, updates);
      openReleaseDetailModal(id); // Re-render modal
    }
  });

  // Toggle On Hold button
  modalEl.querySelector('#btn-toggle-hold')?.addEventListener('click', () => {
    if (isOnHold) {
      store.updateRelease(id, { status: 'On Track' });
    } else {
      store.updateRelease(id, { status: 'On Hold' });
    }
    openReleaseDetailModal(id);
  });

  // Mark Completed button
  modalEl.querySelector('#btn-mark-completed')?.addEventListener('click', () => {
    store.updateRelease(id, { stage: 'Completed', status: 'Completed' });
    triggerCelebration();
    openReleaseDetailModal(id);
  });

  // Stepper dots click to jump to stage
  modalEl.querySelectorAll('.stepper-step').forEach(step => {
    step.addEventListener('click', () => {
      const targetStage = step.dataset.stageName;
      if (targetStage) {
        const updates = { stage: targetStage };
        if (targetStage === 'Completed') {
          updates.status = 'Completed';
          triggerCelebration();
        }
        store.updateRelease(id, updates);
        openReleaseDetailModal(id);
      }
    });
  });

  // Reschedule button
  modalEl.querySelector('#reschedule-btn')?.addEventListener('click', () => {
    closeModal();
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'edit', id } }));
  });

  // Edit button
  modalEl.querySelector('#detail-edit-btn').addEventListener('click', () => {
    closeModal();
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'edit', id } }));
  });

  // Duplicate button
  modalEl.querySelector('#detail-duplicate-btn').addEventListener('click', () => {
    closeModal();
    store.duplicateRelease(id);
  });

  // Delete button
  modalEl.querySelector('#detail-delete-btn').addEventListener('click', () => {
    if (confirm(`Are you sure you want to delete release: "${rel.name}"?`)) {
      store.deleteRelease(id);
      closeModal();
    }
  });
}

function triggerCelebration() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (e) {
    // fallback if canvas-confetti fails
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
