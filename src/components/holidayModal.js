import { store } from '../data/store.js';
import { showToast } from '../utils/toast.js';

export function openHolidayModal({ mode = 'create', id = null } = {}) {
  let modalEl = document.getElementById('holiday-modal-overlay');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'holiday-modal-overlay';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  const isEdit = mode === 'edit' && id !== null;
  const hol = isEdit ? store.holidays.find(h => Number(h.id) === Number(id)) : null;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const curYear = today.getFullYear();
  const curMonth = String(today.getMonth() + 1).padStart(2, '0');
  const firstDayStr = `${curYear}-${curMonth}-01`;
  const sixthDayStr = `${curYear}-${curMonth}-06`;

  const isInitiallyReporting = hol ? Boolean(
    hol.type === 'reporting_load' || 
    hol.isReportingLoad || 
    (hol.name && hol.name.toLowerCase().includes('reporting load'))
  ) : false;

  modalEl.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-eyebrow">${isEdit ? 'UPDATE HOLIDAY' : 'NEW HOLIDAY'}</span>
          <h2 class="modal-title">${isEdit ? 'Edit Holiday' : 'Add Holiday'}</h2>
        </div>
        <button class="modal-close-btn" id="holiday-modal-close" type="button" aria-label="Close modal">&times;</button>
      </div>

      <form id="holiday-form" class="modal-form-wrap">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label required">Restriction Type / Policy</label>
              <select name="type" id="hol-type-select" class="form-select">
                <option value="public" ${!isInitiallyReporting ? 'selected' : ''}>Public Holiday (Restricted Deployments)</option>
                <option value="reporting_load" ${isInitiallyReporting ? 'selected' : ''}>Month-End Reporting Load (1st–6th: High Priority Only)</option>
              </select>
              <span class="field-hint" id="hol-policy-hint">
                ${isInitiallyReporting 
                  ? '⚠️ Deployments allowed, but triggers alert: "Only add very important deployments due to month end reporting load."' 
                  : 'Standard public telecom blackout window'}
              </span>
            </div>

            <div class="form-group">
              <label class="form-label required">Holiday / Window Name</label>
              <input type="text" name="name" id="hol-name-input" class="form-input" required 
                     placeholder="e.g. Eid-ul-Fitr, Month-End Reporting Load" 
                     value="${escapeHtml(hol ? hol.name : '')}">
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label required">Start Date</label>
                <input type="date" name="startDate" id="hol-start-date" class="form-input font-mono" required 
                       value="${hol ? hol.startDate : todayStr}">
              </div>

              <div class="form-group">
                <label class="form-label required">End Date</label>
                <input type="date" name="endDate" id="hol-end-date" class="form-input font-mono" required 
                       value="${hol ? hol.endDate : todayStr}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span class="field-hint">Same date for 1-day</span>
                  <button type="button" class="btn btn-ghost btn-xs text-accent" id="btn-quick-first-6" title="Set to 1st through 6th of this month">
                    ⚡ 1st–6th of Month
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <input type="text" name="notes" id="hol-notes-input" class="form-input" 
                     placeholder="e.g. Fixed public holiday, High reporting load window" 
                     value="${escapeHtml(hol ? hol.notes : '')}">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="holiday-modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">
            ${isEdit ? 'Update Holiday' : 'Save Holiday'}
          </button>
        </div>
      </form>
    </div>
  `;

  modalEl.classList.add('show');

  const closeModal = () => modalEl.classList.remove('show');
  modalEl.querySelector('#holiday-modal-close').onclick = closeModal;
  modalEl.querySelector('#holiday-modal-cancel').onclick = closeModal;

  // Handle Quick 1st-6th Button
  modalEl.querySelector('#btn-quick-first-6')?.addEventListener('click', () => {
    const sInput = modalEl.querySelector('#hol-start-date');
    const eInput = modalEl.querySelector('#hol-end-date');
    const nameInput = modalEl.querySelector('#hol-name-input');
    const typeSelect = modalEl.querySelector('#hol-type-select');
    const notesInput = modalEl.querySelector('#hol-notes-input');

    sInput.value = firstDayStr;
    eInput.value = sixthDayStr;
    if (typeSelect) typeSelect.value = 'reporting_load';
    if (!nameInput.value || nameInput.value === 'New Holiday') {
      nameInput.value = `Month-End Reporting Load (${today.toLocaleString('en-US', { month: 'short' })} ${curYear})`;
    }
    if (!notesInput.value) {
      notesInput.value = 'Month-end reporting load. Only very important deployments allowed.';
    }
    const hint = modalEl.querySelector('#hol-policy-hint');
    if (hint) {
      hint.textContent = '⚠️ Deployments allowed, but triggers alert: "Only add very important deployments due to month end reporting load."';
    }
  });

  // Handle Type Select change
  modalEl.querySelector('#hol-type-select')?.addEventListener('change', (e) => {
    const isRep = e.target.value === 'reporting_load';
    const nameInput = modalEl.querySelector('#hol-name-input');
    const notesInput = modalEl.querySelector('#hol-notes-input');
    const hint = modalEl.querySelector('#hol-policy-hint');

    if (isRep) {
      if (!nameInput.value || nameInput.value === 'New Holiday') {
        nameInput.value = `Month-End Reporting Load (${today.toLocaleString('en-US', { month: 'short' })} ${curYear})`;
      }
      if (!notesInput.value) {
        notesInput.value = 'Month-end reporting load. Only very important deployments allowed.';
      }
      if (hint) {
        hint.textContent = '⚠️ Deployments allowed, but triggers alert: "Only add very important deployments due to month end reporting load."';
      }
    } else {
      if (hint) {
        hint.textContent = 'Standard public telecom blackout window';
      }
    }
  });

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

  const form = modalEl.querySelector('#holiday-form');
  form.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (data.endDate < data.startDate) {
      alert('End Date cannot be earlier than Start Date.');
      return;
    }

    const isRep = data.type === 'reporting_load';
    data.isReportingLoad = isRep;

    if (isEdit) {
      store.updateHoliday(id, data);
      showToast(`Holiday "${data.name}" updated successfully!`, 'success');
    } else {
      store.addHoliday(data);
      showToast(`Holiday "${data.name}" added successfully!`, 'success');
    }

    closeModal();
    window.dispatchEvent(new CustomEvent('refresh-holiday-view'));
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
