import { importFile } from './excelManager.js';

export function openImportModal() {
  let modalEl = document.getElementById('import-modal-overlay');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'import-modal-overlay';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-eyebrow">DATA SYNC</span>
          <h2 class="modal-title">Import Releases & Holidays</h2>
        </div>
        <button class="modal-close-btn" id="import-modal-close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="modal-desc">
          Upload an Excel workbook (<code>.xlsx</code>) or CSV export. The system will match your columns and update the release tracker.
        </p>

        <!-- Dropzone -->
        <div class="file-dropzone" id="file-dropzone">
          <input type="file" id="file-input" accept=".xlsx, .xls, .csv" style="display: none;">
          <div class="dropzone-content">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <div class="dropzone-text">
              <strong id="dropzone-filename">Drag and drop your spreadsheet here</strong>
              <span>or click to browse files</span>
            </div>
            <span class="file-types-hint">Supported: .xlsx, .xls, .csv</span>
          </div>
        </div>

        <!-- Import Mode -->
        <div class="form-group mt-4">
          <label class="form-label">Import Mode</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="import-mode" value="merge" checked>
              <div>
                <strong>Merge & Update</strong>
                <span>Updates existing releases by name and adds new entries</span>
              </div>
            </label>
            <label class="radio-label">
              <input type="radio" name="import-mode" value="replace">
              <div>
                <strong>Full Replace</strong>
                <span>Replaces current dataset completely with the imported file</span>
              </div>
            </label>
          </div>
        </div>

        <div id="import-status-msg" class="import-status" style="display: none;"></div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="import-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="import-process-btn" disabled>
          Import Data
        </button>
      </div>
    </div>
  `;

  modalEl.classList.add('show');

  const closeModal = () => modalEl.classList.remove('show');
  modalEl.querySelector('#import-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#import-cancel-btn').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  const dropzone = modalEl.querySelector('#file-dropzone');
  const fileInput = modalEl.querySelector('#file-input');
  const filenameDisplay = modalEl.querySelector('#dropzone-filename');
  const processBtn = modalEl.querySelector('#import-process-btn');
  const statusMsg = modalEl.querySelector('#import-status-msg');

  let selectedFile = null;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  function handleFileSelected(file) {
    selectedFile = file;
    filenameDisplay.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    processBtn.disabled = false;
  }

  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    processBtn.disabled = true;
    processBtn.textContent = 'Importing...';
    statusMsg.style.display = 'block';
    statusMsg.className = 'import-status info';
    statusMsg.textContent = 'Processing spreadsheet...';

    const mode = modalEl.querySelector('input[name="import-mode"]:checked').value;

    try {
      const result = await importFile(selectedFile, mode);
      statusMsg.className = 'import-status success';
      statusMsg.textContent = `Success! Imported ${result.releasesImported} release(s) and ${result.holidaysImported} holiday(s).`;
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err) {
      console.error(err);
      statusMsg.className = 'import-status error';
      statusMsg.textContent = `Import failed: ${err.message || 'Invalid format'}`;
      processBtn.disabled = false;
      processBtn.textContent = 'Try Again';
    }
  });
}
