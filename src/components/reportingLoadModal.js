import { store } from '../data/store.js';
import { showToast } from '../utils/toast.js';

export function openReportingLoadModal() {
  let modalEl = document.getElementById('reporting-load-modal-overlay');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'reporting-load-modal-overlay';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  const existingReportingHolidays = store.holidays.filter(h => 
    h.type === 'reporting_load' || 
    h.isReportingLoad || 
    (h.name && h.name.toLowerCase().includes('reporting load')) ||
    (h.notes && h.notes.toLowerCase().includes('reporting load'))
  );

  modalEl.innerHTML = `
    <div class="modal-card modal-card-md">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-eyebrow">HOLIDAY RESTRICTION POLICY</span>
          <h2 class="modal-title">Month-End Reporting Windows (Days 1–6)</h2>
        </div>
        <button class="modal-close-btn" id="reporting-modal-close" type="button" aria-label="Close modal">&times;</button>
      </div>

      <div class="modal-form-wrap">
        <div class="modal-body">
          <!-- Policy Explanation Banner -->
          <div class="alert-banner warning-banner reporting-load-info-banner">
            <div class="banner-icon">⚠️</div>
            <div class="banner-content">
              <div class="banner-title">Month-End Reporting Load Policy</div>
              <div class="banner-text">
                Adding this automatically marks the <strong>1st through 6th</strong> of each month as a high reporting load window. 
                Users will still be <strong>allowed to add/save releases</strong> on these dates, but the system will display a prominent alert:
                <br><em>"Only add very important deployments due to month end reporting load."</em>
              </div>
            </div>
          </div>

          <div class="form-grid" style="margin-top: 1rem;">
            <div class="form-group">
              <label class="form-label required">Select Calendar Year(s)</label>
              <select id="reporting-load-year" class="form-select font-mono">
                <option value="2026">2026 Calendar (12 Months: Jan – Dec 2026)</option>
                <option value="2027">2027 Calendar (12 Months: Jan – Dec 2027)</option>
                <option value="both" selected>Both 2026 & 2027 (24 Months: Jan 2026 – Dec 2027)</option>
              </select>
              <span class="field-hint">Generates 6-day periods (01st to 06th) for every month in selected year</span>
            </div>

            <div class="reporting-load-status-card card">
              <div class="status-summary-row">
                <span class="status-label">Currently Configured:</span>
                <span class="status-count-badge font-mono font-bold">${existingReportingHolidays.length} Reporting Windows</span>
              </div>
              <p class="text-xs text-muted" style="margin-top: 4px;">
                ${existingReportingHolidays.length > 0 
                  ? 'Active month-end periods are currently protecting uptime during financial & BI reporting closes.' 
                  : 'No month-end reporting windows currently configured.'}
              </p>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <div>
            ${existingReportingHolidays.length > 0 ? `
              <button type="button" class="btn btn-ghost text-danger" id="btn-clear-reporting-windows" title="Remove all month-end reporting load windows">
                Clear All (${existingReportingHolidays.length})
              </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" id="reporting-modal-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-submit-reporting-windows">
              Generate 1st–6th Windows
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  modalEl.classList.add('show');

  const closeModal = () => modalEl.classList.remove('show');
  modalEl.querySelector('#reporting-modal-close').onclick = closeModal;
  modalEl.querySelector('#reporting-modal-cancel').onclick = closeModal;

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

  // Submit generate
  modalEl.querySelector('#btn-submit-reporting-windows')?.addEventListener('click', () => {
    const yearVal = modalEl.querySelector('#reporting-load-year')?.value || 'both';
    let years = [2026, 2027];
    if (yearVal === '2026') years = [2026];
    if (yearVal === '2027') years = [2027];

    const added = store.addReportingLoadHolidays(years);
    closeModal();

    if (added > 0) {
      showToast({
        title: 'MONTH-END WINDOWS CONFIGURED',
        message: `Successfully added <strong>${added}</strong> month-end reporting windows (1st–6th). Releases scheduled on these dates will show the high load alert.`,
        type: 'success',
        duration: 5000
      });
    } else {
      showToast({
        title: 'ALREADY CONFIGURED',
        message: 'All 1st–6th reporting windows for the selected period are already in your holiday calendar.',
        type: 'info',
        duration: 4000
      });
    }

    // Dispatch event to refresh holiday view
    window.dispatchEvent(new CustomEvent('refresh-holiday-view'));
  });

  // Clear existing
  modalEl.querySelector('#btn-clear-reporting-windows')?.addEventListener('click', () => {
    if (confirm(`Remove all ${existingReportingHolidays.length} month-end reporting windows from the holiday calendar?`)) {
      const removed = store.deleteReportingLoadHolidays();
      closeModal();
      showToast({
        title: 'WINDOWS REMOVED',
        message: `Removed ${removed} month-end reporting windows.`,
        type: 'info',
        duration: 4000
      });
      window.dispatchEvent(new CustomEvent('refresh-holiday-view'));
    }
  });
}
