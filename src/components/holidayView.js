import { store } from '../data/store.js';

export function renderHolidayView(container) {
  const holidays = store.holidays;

  // Compute how many releases clash with each holiday
  const holidayStats = holidays.map(h => {
    const start = h.startDate;
    const end = h.endDate || h.startDate;
    const clashes = store.releases.filter(r => {
      if (!r.targetDeploy) return false;
      return r.targetDeploy >= start && r.targetDeploy <= end;
    });

    let durationDays = 1;
    if (start && end && start !== end) {
      const d1 = new Date(start + 'T00:00:00').getTime();
      const d2 = new Date(end + 'T00:00:00').getTime();
      durationDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }

    return {
      ...h,
      durationDays,
      clashes
    };
  });

  const totalClashes = holidayStats.reduce((sum, h) => sum + h.clashes.length, 0);

  container.innerHTML = `
    <div class="holidays-view-container">
      <!-- Header -->
      <div class="holidays-header-bar">
        <div>
          <h1 class="page-title">Telecom DW Holidays</h1>
          <p class="page-subtitle">Target deployment dates falling on any listed holiday are automatically flagged to protect telecom uptime</p>
        </div>

        <div class="holidays-controls">
          <button class="btn btn-primary" id="btn-add-holiday">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Holiday
          </button>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="holidays-stats-grid">
        <div class="card stat-mini-card">
          <span class="stat-mini-label">DEFINED HOLIDAYS</span>
          <span class="stat-mini-val">${holidays.length}</span>
          <span class="stat-mini-sub">2026 - 2027 Calendar</span>
        </div>

        <div class="card stat-mini-card ${totalClashes > 0 ? 'card-glow-rose' : 'card-glow-emerald'}">
          <span class="stat-mini-label">ACTIVE RELEASE CONFLICTS</span>
          <span class="stat-mini-val ${totalClashes > 0 ? 'text-danger' : 'text-success'}">${totalClashes}</span>
          <span class="stat-mini-sub">${totalClashes > 0 ? 'Requires date rescheduling' : 'Zero conflict clean calendar'}</span>
        </div>

        <div class="card stat-mini-card">
          <span class="stat-mini-label">AUTOMATIC CONFLICT LOGIC</span>
          <span class="stat-mini-val font-sans text-sm font-semibold text-accent">Active & Running</span>
          <span class="stat-mini-sub">Live check on every target deploy date</span>
        </div>
      </div>

      <!-- Holidays Table -->
      <div class="table-container card">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-id">#</th>
              <th>Holiday Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Duration</th>
              <th>Notes / Type</th>
              <th>Conflicting Releases</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${holidayStats.map(h => {
              const hasClash = h.clashes.length > 0;
              return `
                <tr class="table-row ${hasClash ? 'row-conflict' : ''}" data-holiday-id="${h.id}">
                  <td class="col-id font-mono">${h.id}</td>

                  <td>
                    <div class="holiday-name-cell">
                      <strong>${escapeHtml(h.name)}</strong>
                    </div>
                  </td>

                  <td class="font-mono">${h.startDate || '—'}</td>
                  <td class="font-mono">${h.endDate || h.startDate || '—'}</td>

                  <td>
                    <span class="duration-badge">${h.durationDays} day${h.durationDays > 1 ? 's' : ''}</span>
                  </td>

                  <td class="text-muted">${escapeHtml(h.notes || '—')}</td>

                  <td>
                    ${hasClash ? `
                      <span class="conflict-badge" title="${h.clashes.map(r => r.name).join(', ')}">
                        ⚠️ ${h.clashes.length} Release${h.clashes.length > 1 ? 's' : ''} Conflict
                      </span>
                    ` : `
                      <span class="text-success text-xs font-semibold">✓ No Conflicts</span>
                    `}
                  </td>

                  <td class="col-actions">
                    <div class="actions-cell">
                      <button class="btn-icon-subtle edit-holiday-btn" data-holiday-id="${h.id}" title="Edit Holiday">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button class="btn-icon-subtle text-danger delete-holiday-btn" data-holiday-id="${h.id}" title="Delete Holiday">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setupHolidayEvents(container);
}

function setupHolidayEvents(container) {
  container.querySelector('#btn-add-holiday')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-holiday-modal', { detail: { mode: 'create' } }));
  });

  container.querySelectorAll('.edit-holiday-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.holidayId, 10);
      window.dispatchEvent(new CustomEvent('open-holiday-modal', { detail: { mode: 'edit', id } }));
    });
  });

  container.querySelectorAll('.delete-holiday-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.holidayId, 10);
      const h = store.holidays.find(x => x.id === id);
      if (confirm(`Delete holiday: "${h ? h.name : id}"?`)) {
        store.deleteHoliday(id);
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
