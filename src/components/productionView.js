import { store } from '../data/store.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml, formatDay, formatMonth } from '../utils/format.js';

/** Build concise missing-ticket label for non-compliant Production releases. */
function getMissingTicketsLabel(check) {
  if (check.missingCr && check.missingRitm) return 'Missing CR & RITM';
  if (check.missingCr) return 'Missing CR';
  if (check.missingRitm) return 'Missing RITM';
  return '';
}

/** Evaluate completion governance status for a release in Production. */
function evaluateGovernance(rel) {
  const check = store.validateDeploymentCompletion({
    ...rel,
    stage: 'Completed',
    status: 'Completed'
  });
  return {
    compliant: check.valid,
    missingLabel: getMissingTicketsLabel(check)
  };
}

/** Render the dedicated Production Deployments · Governance Compliance view. */
export function renderProductionView(container) {
  if (!window._productionFilters) {
    window._productionFilters = { search: '', platform: 'ALL', governance: 'ALL' };
  }
  const filters = window._productionFilters;

  // Preserve search focus & caret across store-driven re-renders
  const activeEl = document.activeElement;
  const wasSearchFocused = activeEl && activeEl.id === 'prod-search-input';
  const selStart = wasSearchFocused ? activeEl.selectionStart : null;
  const selEnd = wasSearchFocused ? activeEl.selectionEnd : null;

  const allProduction = store.getProductionGovernanceReleases();
  const annotated = allProduction.map(rel => ({
    rel,
    gov: evaluateGovernance(rel)
  }));

  const missingGovCount = annotated.filter(item => !item.gov.compliant).length;
  const compliantCount = annotated.length - missingGovCount;

  const query = (filters.search || '').trim().toLowerCase();
  const hasActiveFilters = Boolean(query || filters.platform !== 'ALL' || filters.governance !== 'ALL');

  const visibleItems = annotated.filter(({ rel, gov }) => {
    if (filters.platform !== 'ALL' && rel.platform !== filters.platform) {
      return false;
    }
    if (filters.governance === 'REQUIRED' && gov.compliant) {
      return false;
    }
    if (filters.governance === 'COMPLIANT' && !gov.compliant) {
      return false;
    }
    if (!query) return true;

    const haystack = [
      rel.name,
      rel.developer,
      rel.cr,
      rel.ritm,
      rel.platform,
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
    <div class="upcoming-view-container production-view-container">
      <!-- Page Header -->
      <div class="upcoming-header-bar">
        <div>
          <h1 class="page-title">Production Deployments · Governance</h1>
          <p class="page-subtitle">Deployments currently in Production requiring Change Request (CR) & RITM governance compliance before closure</p>
        </div>

        <div class="upcoming-header-actions">
          <button class="btn btn-secondary" id="prod-view-upcoming-btn" title="View Pre-Production Upcoming Deployments">
            ← Upcoming Deployments
          </button>
          <button class="btn btn-secondary" id="prod-view-register-btn" title="Open full Release Register">
            View All in Register →
          </button>
          <button class="btn btn-primary" id="btn-prod-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      ${missingGovCount > 0 ? `
        <div class="alert-banner warning-banner" id="prod-governance-banner">
          <div class="banner-icon">🛡️</div>
          <div class="banner-content">
            <div class="banner-title">Governance Compliance Required (${missingGovCount} Production Deployment${missingGovCount !== 1 ? 's' : ''})</div>
            <div class="banner-text">ServiceNow <strong>Change Request (CR)</strong> and <strong>RITM Number</strong> are both mandatory before Production deployments can be marked Completed.</div>
          </div>
        </div>
      ` : ''}

      <!-- Summary Stats Strip -->
      <div class="holidays-stats-grid">
        <div class="card stat-mini-card card-glow-indigo">
          <span class="stat-mini-label">IN PRODUCTION</span>
          <span class="stat-mini-val">${allProduction.length}</span>
          <span class="stat-mini-sub">Active non-completed deployments</span>
        </div>

        <div class="card stat-mini-card ${missingGovCount > 0 ? 'card-glow-amber' : 'card-glow-emerald'}">
          <span class="stat-mini-label">GOVERNANCE COMPLIANCE REQUIRED</span>
          <span class="stat-mini-val ${missingGovCount > 0 ? 'text-amber' : 'text-success'}">${missingGovCount}</span>
          <span class="stat-mini-sub">${missingGovCount > 0 ? 'Missing CR and/or RITM ticket' : 'All Production items have tickets linked'}</span>
        </div>

        <div class="card stat-mini-card card-glow-emerald">
          <span class="stat-mini-label">COMPLIANT & READY</span>
          <span class="stat-mini-val text-success">${compliantCount}</span>
          <span class="stat-mini-sub">Both CR & RITM tickets linked</span>
        </div>
      </div>

      <!-- Production Governance Queue Card -->
      <div class="card upcoming-board-card">
        <div class="card-header upcoming-card-header">
          <div class="upcoming-header-title-group">
            <h3 class="card-title">Production Governance Queue</h3>
            <span class="badge-count">${hasActiveFilters ? `${visibleItems.length} of ${allProduction.length}` : `${allProduction.length} in production`}</span>
          </div>

          <div class="upcoming-controls">
            <div class="upcoming-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon upcoming-search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="prod-search-input"
                class="search-input upcoming-search-input"
                placeholder="Search release, dev, CR, RITM..."
                value="${escapeHtml(filters.search)}"
              />
            </div>

            <select id="prod-platform-select" class="control-select" aria-label="Filter by Platform">
              ${platforms.map(p => `
                <option value="${escapeHtml(p)}" ${filters.platform === p ? 'selected' : ''}>
                  ${p === 'ALL' ? 'All Platforms' : escapeHtml(p)}
                </option>
              `).join('')}
            </select>

            <select id="prod-gov-select" class="control-select" aria-label="Filter by Governance Status">
              <option value="ALL" ${filters.governance === 'ALL' ? 'selected' : ''}>All Governance States</option>
              <option value="REQUIRED" ${filters.governance === 'REQUIRED' ? 'selected' : ''}>Governance Required</option>
              <option value="COMPLIANT" ${filters.governance === 'COMPLIANT' ? 'selected' : ''}>Compliant (Ready)</option>
            </select>

            ${hasActiveFilters ? `
              <button class="btn btn-sm btn-ghost" id="prod-clear-filters">Clear</button>
            ` : ''}
          </div>
        </div>

        <div class="feed-content">
          ${visibleItems.length === 0 ? `
            <div class="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <h3>${hasActiveFilters ? 'No Matching Production Deployments' : 'No Pending Production Deployments'}</h3>
              <p>${hasActiveFilters ? 'No Production deployments match the current filter criteria.' : 'All Production deployments have already been completed.'}</p>
            </div>
          ` : `
            <div class="upcoming-list">
              ${visibleItems.map(({ rel, gov }) => {
                const platformSlug = (rel.platform || '').toLowerCase();
                const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
                const monthStr = rel.targetDeploy ? formatMonth(rel.targetDeploy) : 'PROD';
                const dayStr = rel.targetDeploy ? formatDay(rel.targetDeploy) : 'LIVE';

                return `
                  <div class="upcoming-item production-gov-item ${gov.compliant ? 'production-item-compliant' : 'production-item-gov-required'}" data-release-id="${rel.id}">
                    <div class="upcoming-date-box">
                      <span class="date-month">${escapeHtml(monthStr)}</span>
                      <span class="date-day">${escapeHtml(dayStr)}</span>
                    </div>
                    <div class="upcoming-info">
                      <div class="upcoming-title-row">
                        <span class="upcoming-name">${escapeHtml(rel.name)}</span>
                        ${rel.platform ? `<span class="platform-tag platform-${platformSlug}">${escapeHtml(rel.platform)}</span>` : ''}
                        ${rel.version ? `<span class="badge-version">${escapeHtml(rel.version)}</span>` : ''}
                        ${gov.compliant ? `
                          <span class="governance-ok-pill" title="CR and RITM linked — ready for completion">✓ Governance Compliant</span>
                        ` : `
                          <span class="governance-req-pill" title="Attach CR and RITM before completing deployment">🛡️ Governance Compliance Required · ${escapeHtml(gov.missingLabel)}</span>
                        `}
                      </div>
                      <div class="upcoming-meta">
                        <span>Dev: <strong>${escapeHtml(rel.developer || 'Unassigned')}</strong></span>
                        <span>Stage: <strong>Production</strong></span>
                        <span class="status-pill status-${statusSlug}">${escapeHtml(rel.status || 'Pending')}</span>
                        ${rel.cr ? `<span class="badge-ticket">CR: ${escapeHtml(rel.cr)}</span>` : ''}
                        ${rel.ritm ? `<span class="badge-ticket">RITM: ${escapeHtml(rel.ritm)}</span>` : ''}
                      </div>
                    </div>
                    <div class="production-item-actions">
                      ${gov.compliant ? `
                        <button type="button" class="btn btn-sm btn-primary prod-complete-release" data-release-id="${rel.id}" title="Mark Deployment as Completed">Mark Completed</button>
                      ` : `
                        <button type="button" class="btn btn-sm btn-outline-warning prod-attach-tickets" data-release-id="${rel.id}" title="Attach CR & RITM governance tickets">Add CR / RITM</button>
                      `}
                      <button type="button" class="btn btn-sm btn-icon open-rel-detail" data-release-id="${rel.id}" title="View Details" aria-label="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
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
    const newSearch = container.querySelector('#prod-search-input');
    if (newSearch) {
      newSearch.focus();
      if (selStart !== null && selEnd !== null) {
        newSearch.setSelectionRange(selStart, selEnd);
      }
    }
  }

  setupProductionEvents(container);
}

function setupProductionEvents(container) {
  container.querySelector('#prod-view-upcoming-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'upcoming' } }));
  });

  container.querySelector('#prod-view-register-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
  });

  container.querySelector('#btn-prod-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  container.querySelector('#prod-search-input')?.addEventListener('input', (e) => {
    window._productionFilters.search = e.target.value;
    renderProductionView(container);
  });

  container.querySelector('#prod-platform-select')?.addEventListener('change', (e) => {
    window._productionFilters.platform = e.target.value;
    renderProductionView(container);
  });

  container.querySelector('#prod-gov-select')?.addEventListener('change', (e) => {
    window._productionFilters.governance = e.target.value;
    renderProductionView(container);
  });

  container.querySelector('#prod-clear-filters')?.addEventListener('click', () => {
    window._productionFilters = { search: '', platform: 'ALL', governance: 'ALL' };
    renderProductionView(container);
  });

  container.querySelectorAll('.prod-attach-tickets').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'edit', id } }));
      }
    });
  });

  container.querySelectorAll('.prod-complete-release').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.releaseId, 10);
      if (!id) return;
      const updated = store.updateRelease(id, { stage: 'Completed', status: 'Completed' });
      if (updated) {
        showToast({
          title: 'DEPLOYMENT COMPLETED',
          message: `Release #${updated.id} (<strong>${escapeHtml(updated.name)}</strong>) marked as Completed with verified governance tickets.`,
          type: 'success',
          duration: 4500
        });
      }
    });
  });

  container.querySelectorAll('.production-gov-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });
}

