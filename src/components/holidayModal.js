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
  const todayStr = new Date().toISOString().slice(0, 10);

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
              <label class="form-label required">Holiday Name</label>
              <input type="text" name="name" class="form-input" required 
                     placeholder="e.g. Eid-ul-Fitr, Independence Day" 
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
                <span class="field-hint">Same date for single-day holidays</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes / Type</label>
              <input type="text" name="notes" class="form-input" 
                     placeholder="e.g. Fixed public holiday, Tentative (moon sighting)" 
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

    if (isEdit) {
      store.updateHoliday(id, data);
      showToast(`Holiday "${data.name}" updated successfully!`, 'success');
    } else {
      store.addHoliday(data);
      showToast(`Holiday "${data.name}" added successfully!`, 'success');
    }

    closeModal();
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
