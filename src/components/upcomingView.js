import { store } from '../data/store.js';
import { escapeHtml, formatDay, formatMonth, toLocalDateStr } from '../utils/format.js';

/** Compute a concise relative schedule pill label & CSS modifier for a YYYY-MM-DD target date. */
function getRelativeTimingBadge(targetDeploy, todayStr) {
  if (!targetDeploy) return null;
  const targetMs = new Date(`${targetDeploy}T00:00:00`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
  const diffDays = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Today', cls: 'timing-today' };
  if (diffDays === 1) return { label: 'Tomorrow', cls: 'timing-soon' };
  if (diffDays > 1 && diffDays <= 7) return { label: `In ${diffDays}d`, cls: 'timing-soon' };
  if (diffDays > 7) return { label: `In ${diffDays}d`, cls: 'timing-later' };
  return { label: `${Math.abs(diffDays)}d overdue`, cls: 'timing-overdue' };
}

/** Render the dedicated Upcoming Target Deployments tab view (pre-production only). */
export function renderUpcomingView(container) {
  if (!window._upcomingFilters) {
    window._upcomingFilters = { search: '', platform: 'ALL' };
  }
  const filters = window._upcomingFilters;

  // Preserve search focus & caret across store-driven re-renders
  const activeEl = document.activeElement;
  const wasSearchFocused = activeEl && activeEl.id === 'upcoming-search-input';
  const selStart = wasSearchFocused ? activeEl.selectionStart : null;
  const selEnd = wasSearchFocused ? activeEl.selectionEnd : null;

  const allUpcoming = store.getUpcomingReleases();
  const productionCount = store.getProductionGovernanceReleases().length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);
  const weekAhead = new Date(today);
  weekAhead.setDate(today.getDate() + 7);
  const weekAheadStr = toLocalDateStr(weekAhead);

  const dueWithinWeekCount = allUpcoming.filter(
    r => r.targetDeploy >= todayStr && r.targetDeploy <= weekAheadStr
  ).length;
  const cabCount = allUpcoming.filter(r => r.stage === 'CAB').length;
  const conflictsCount = allUpcoming.filter(
    r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:')
  ).length;

  const query = (filters.search || '').trim().toLowerCase();
  const hasActiveFilters = Boolean(query || filters.platform !== 'ALL');

  const visibleReleases = allUpcoming.filter(rel => {
    if (filters.platform !== 'ALL' && rel.platform !== filters.platform) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      rel.name,
      rel.developer,
      rel.cr,
      rel.ritm,
      rel.platform,
      rel.stage,
      rel.status,
      rel.version,
      rel.targetDeploy
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const platforms = ['ALL', ...store.platforms];

  container.innerHTML = `
    <div class="upcoming-view-container">
      <!-- Page Header -->
      <div class="upcoming-header-bar">
        <div>
          <h1 class="page-title">Upcoming Target Deployments</h1>
          <p class="page-subtitle">Pre-production active releases scheduled for deployment</p>
        </div>

        <div class="upcoming-header-actions">
          ${productionCount > 0 ? `
            <button class="btn btn-secondary" id="upcoming-view-production-btn" title="View deployments in Production requiring Governance Compliance">
              🛡️ Production Governance (${productionCount}) →
            </button>
          ` : ''}
          <button class="btn btn-secondary" id="upcoming-view-register-btn" title="Open full Release Register">
            View All in Register →
          </button>
          <button class="btn btn-primary" id="btn-upcoming-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      <!-- Summary Stats Strip -->
      <div class="holidays-stats-grid">
        <div class="card stat-mini-card card-glow-indigo">
          <span class="stat-mini-label">SCHEDULED UPCOMING</span>
          <span class="stat-mini-val">${allUpcoming.length}</span>
          <span class="stat-mini-sub">${cabCount} in CAB review</span>
        </div>

        <div class="card stat-mini-card">
          <span class="stat-mini-label">DUE WITHIN 7 DAYS</span>
          <span class="stat-mini-val">${dueWithinWeekCount}</span>
          <span class="stat-mini-sub">Window: ${todayStr} → ${weekAheadStr}</span>
        </div>

        <div class="card stat-mini-card ${conflictsCount > 0 ? 'card-glow-rose' : 'card-glow-emerald'}">
          <span class="stat-mini-label">HOLIDAY CONFLICTS</span>
          <span class="stat-mini-val ${conflictsCount > 0 ? 'text-danger' : 'text-success'}">${conflictsCount}</span>
          <span class="stat-mini-sub">${conflictsCount > 0 ? 'Requires date rescheduling' : 'Zero conflict clean schedule'}</span>
        </div>
      </div>

      <!-- Upcoming Queue Card -->
      <div class="card upcoming-board-card">
        <div class="card-header upcoming-card-header">
          <div class="upcoming-header-title-group">
            <h3 class="card-title">Deployment Schedule</h3>
            <span class="badge-count">${hasActiveFilters ? `${visibleReleases.length} of ${allUpcoming.length}` : `${allUpcoming.length} active`}</span>
          </div>

          <div class="upcoming-controls">
            <div class="upcoming-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon upcoming-search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="upcoming-search-input"
                class="search-input upcoming-search-input"
                placeholder="Search release, dev, CR, RITM..."
                value="${escapeHtml(filters.search)}"
              />
            </div>

            <select id="upcoming-platform-select" class="control-select" aria-label="Filter by Platform">
              ${platforms.map(p => `
                <option value="${escapeHtml(p)}" ${filters.platform === p ? 'selected' : ''}>
                  ${p === 'ALL' ? 'All Platforms' : escapeHtml(p)}
                </option>
              `).join('')}
            </select>

            ${hasActiveFilters ? `
              <button class="btn btn-sm btn-ghost" id="upcoming-clear-filters">Clear</button>
            ` : ''}
          </div>
        </div>

        <div class="feed-content">
          ${visibleReleases.length === 0 ? `
            <div class="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <h3>${hasActiveFilters ? 'No Matching Deployments' : 'No Upcoming Deployments'}</h3>
              <p>${hasActiveFilters ? 'No upcoming deployments match the selected filters.' : 'No active upcoming releases scheduled.'}</p>
            </div>
          ` : `
            <div class="upcoming-list">
              ${visibleReleases.map(rel => {
                const platformSlug = (rel.platform || '').toLowerCase();
                const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
                const hasConflict = Boolean(rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:'));
                const timing = getRelativeTimingBadge(rel.targetDeploy, todayStr);

                return `
                  <div class="upcoming-item ${hasConflict ? 'upcoming-item-conflict' : ''}" data-release-id="${rel.id}">
                    <div class="upcoming-date-box">
                      <span class="date-month">${escapeHtml(formatMonth(rel.targetDeploy))}</span>
                      <span class="date-day">${escapeHtml(formatDay(rel.targetDeploy))}</span>
                    </div>
                    <div class="upcoming-info">
                      <div class="upcoming-title-row">
                        <span class="upcoming-name">${escapeHtml(rel.name)}</span>
                        ${rel.platform ? `<span class="platform-tag platform-${platformSlug}">${escapeHtml(rel.platform)}</span>` : ''}
                        ${rel.version ? `<span class="badge-version">${escapeHtml(rel.version)}</span>` : ''}
                        ${hasConflict ? `<span class="badge-conflict-pill" title="${escapeHtml(rel.holidayConflict)}">⚠️ Holiday Conflict</span>` : ''}
                      </div>
                      <div class="upcoming-meta">
                        <span>Dev: <strong>${escapeHtml(rel.developer || 'Unassigned')}</strong></span>
                        <span>Stage: <strong>${escapeHtml(rel.stage || 'Unassigned')}</strong></span>
                        <span class="status-pill status-${statusSlug}">${escapeHtml(rel.status || 'Pending')}</span>
                        ${timing ? `<span class="upcoming-timing-pill ${timing.cls}">${escapeHtml(timing.label)}</span>` : ''}
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-icon open-rel-detail" data-release-id="${rel.id}" title="View Details" aria-label="View Details">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  if (wasSearchFocused) {
    const newSearch = container.querySelector('#upcoming-search-input');
    if (newSearch) {
      newSearch.focus();
      if (selStart !== null && selEnd !== null) {
        newSearch.setSelectionRange(selStart, selEnd);
      }
    }
  }

  setupUpcomingEvents(container);
}

function setupUpcomingEvents(container) {
  container.querySelector('#upcoming-view-production-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'production' } }));
  });

  container.querySelector('#upcoming-view-register-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
  });

  container.querySelector('#btn-upcoming-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  container.querySelector('#upcoming-search-input')?.addEventListener('input', (e) => {
    window._upcomingFilters.search = e.target.value;
    renderUpcomingView(container);
  });

  container.querySelector('#upcoming-platform-select')?.addEventListener('change', (e) => {
    window._upcomingFilters.platform = e.target.value;
    renderUpcomingView(container);
  });

  container.querySelector('#upcoming-clear-filters')?.addEventListener('click', () => {
    window._upcomingFilters = { search: '', platform: 'ALL' };
    renderUpcomingView(container);
  });

  container.querySelectorAll('.upcoming-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });
}
