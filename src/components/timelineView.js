import { store } from '../data/store.js';

export function renderTimelineView(container) {
  if (!window._timelineYear) {
    window._timelineYear = 2026;
  }
  const year = window._timelineYear;

  const filteredReleases = store.getFilteredReleases();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthIdx = new Date().getMonth(); // 0-indexed

  container.innerHTML = `
    <div class="timeline-view-container">
      <!-- Header -->
      <div class="timeline-header-bar">
        <div>
          <h1 class="page-title">Release Timeline (Gantt View)</h1>
          <p class="page-subtitle">Visual timeline bars running from Start Date to Target Deploy, color-coded by status</p>
        </div>

        <div class="timeline-controls">
          <div class="year-selector-group">
            <label class="control-label">Year:</label>
            <select id="timeline-year-select" class="control-select">
              <option value="2026" ${year === 2026 ? 'selected' : ''}>2026</option>
              <option value="2027" ${year === 2027 ? 'selected' : ''}>2027</option>
            </select>
          </div>

          <button class="btn btn-primary" id="btn-timeline-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      <!-- Timeline Legend -->
      <div class="timeline-legend card">
        <div class="legend-group">
          <span class="legend-title">Status Key:</span>
          <div class="legend-item"><span class="gantt-bar-sample status-completed"></span> Completed</div>
          <div class="legend-item"><span class="gantt-bar-sample status-on-track"></span> On Track</div>
          <div class="legend-item"><span class="gantt-bar-sample status-at-risk"></span> At Risk</div>
          <div class="legend-item"><span class="gantt-bar-sample status-delayed"></span> Delayed</div>
          <div class="legend-item"><span class="gantt-bar-sample status-on-hold"></span> On Hold</div>
        </div>
        <div class="legend-item current-month-badge">
          <span>★ Current Month Highlight</span>
        </div>
      </div>

      <!-- Gantt Chart Container -->
      <div class="gantt-container card">
        <div class="gantt-table-wrapper">
          <div class="gantt-header-row">
            <div class="gantt-col-fixed gantt-header-meta">
              <span class="gantt-th col-id">#</span>
              <span class="gantt-th col-title">Release Name</span>
              <span class="gantt-th col-stage">Stage</span>
              <span class="gantt-th col-status">Status</span>
            </div>
            <div class="gantt-months-grid">
              ${months.map((m, idx) => `
                <div class="gantt-month-th ${idx === currentMonthIdx && year === new Date().getFullYear() ? 'month-current' : ''}">
                  <span>${m}</span>
                  <small>${year}</small>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Gantt Rows -->
          <div class="gantt-body">
            ${filteredReleases.length === 0 ? `
              <div class="empty-state p-6">
                <p>No releases match the current filters.</p>
              </div>
            ` : filteredReleases.map(rel => {
              const statusSlug = (rel.status || 'on-track').toLowerCase().replace(/\s+/g, '-');
              const stageSlug = (rel.stage || 'dev').toLowerCase().replace(/[^a-z0-9]/g, '-');
              const { leftPct, widthPct, hasBar } = calculateGanttPosition(rel.startDate, rel.targetDeploy, year);

              return `
                <div class="gantt-row" data-release-id="${rel.id}">
                  <div class="gantt-col-fixed gantt-row-meta">
                    <span class="col-id font-mono">${rel.id}</span>
                    <span class="col-title clickable-title" title="${escapeHtml(rel.name)}">${escapeHtml(rel.name)}</span>
                    <span class="col-stage"><span class="stage-tag stage-${stageSlug}">${rel.stage}</span></span>
                    <span class="col-status"><span class="status-pill status-${statusSlug}">${rel.status || '—'}</span></span>
                  </div>

                  <div class="gantt-timeline-track">
                    <!-- Background Month Grid Lines -->
                    <div class="gantt-grid-lines">
                      ${months.map((_, idx) => `
                        <div class="gantt-grid-col ${idx === currentMonthIdx && year === new Date().getFullYear() ? 'month-current-bg' : ''}"></div>
                      `).join('')}
                    </div>

                    <!-- Gantt Bar -->
                    ${hasBar ? `
                      <div class="gantt-bar-item status-${statusSlug}" 
                           style="left: ${leftPct}%; width: ${Math.max(widthPct, 2)}%;"
                           title="${escapeHtml(rel.name)} (${rel.startDate || '?'} → ${rel.targetDeploy || '?'})">
                        <span class="gantt-bar-label">${escapeHtml(rel.name)}</span>
                      </div>
                    ` : `
                      <span class="no-dates-label">No valid dates</span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  setupTimelineEvents(container);
}

function calculateGanttPosition(startDateStr, targetDeployStr, year) {
  if (!startDateStr && !targetDeployStr) {
    return { leftPct: 0, widthPct: 0, hasBar: false };
  }

  const sStr = startDateStr || targetDeployStr;
  const eStr = targetDeployStr || startDateStr;

  const startYear = new Date(year, 0, 1).getTime();
  const endYear = new Date(year, 11, 31, 23, 59, 59).getTime();
  const yearSpan = endYear - startYear;

  const sDate = new Date(sStr + 'T00:00:00').getTime();
  const eDate = new Date(eStr + 'T23:59:59').getTime();

  // If outside this year completely
  if (eDate < startYear || sDate > endYear) {
    return { leftPct: 0, widthPct: 0, hasBar: false };
  }

  const clampedStart = Math.max(sDate, startYear);
  const clampedEnd = Math.min(eDate, endYear);

  const leftPct = ((clampedStart - startYear) / yearSpan) * 100;
  const widthPct = ((clampedEnd - clampedStart) / yearSpan) * 100;

  return {
    leftPct: Math.max(0, Math.min(100, leftPct)),
    widthPct: Math.max(1, Math.min(100 - leftPct, widthPct)),
    hasBar: true
  };
}

function setupTimelineEvents(container) {
  const ySelect = container.querySelector('#timeline-year-select');
  ySelect?.addEventListener('change', (e) => {
    window._timelineYear = parseInt(e.target.value, 10);
    renderTimelineView(container);
  });

  container.querySelector('#btn-timeline-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  container.querySelectorAll('.clickable-title, .gantt-bar-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const row = el.closest('.gantt-row');
      if (row) {
        const id = parseInt(row.dataset.releaseId, 10);
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
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
