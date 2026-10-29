import { store } from '../data/store.js';
import { exportReleasesToExcel, exportReleasesToCSV } from './excelManager.js';

export function renderReleaseList(container) {
  if (!window._releaseListMode) {
    // Default to card view on very narrow screens (< 640px), otherwise table
    window._releaseListMode = window.innerWidth <= 640 ? 'cards' : 'table';
  }
  const viewMode = window._releaseListMode;

  // Preserve search input focus and cursor position if user is typing
  const activeEl = document.activeElement;
  const wasSearchFocused = activeEl && activeEl.id === 'filter-search';
  const selStart = wasSearchFocused ? activeEl.selectionStart : null;
  const selEnd = wasSearchFocused ? activeEl.selectionEnd : null;

  const wasImpactedFocused = activeEl && activeEl.id === 'filter-impacted-object';
  const impactedSelStart = wasImpactedFocused ? activeEl.selectionStart : null;
  const impactedSelEnd = wasImpactedFocused ? activeEl.selectionEnd : null;

  const releases = store.getFilteredReleases();
  const totalCount = store.releases.length;
  const filteredCount = releases.length;
  const allDbObjects = store.getAllDbObjects();

  const platforms = ['ALL', ...store.platforms];
  const types = ['ALL', ...store.deploymentTypes];
  const stages = ['ALL', ...store.stages];
  const statuses = ['ALL', ...store.statuses];
  const owners = ['ALL', ...store.owners];
  const currentSortKey = `${store.sort?.column || 'id'}-${store.sort?.direction || 'desc'}`;

  const hasActiveFilters = Boolean(
    store.filters.search || 
    (store.filters.impactedObject && store.filters.impactedObject !== 'ALL') ||
    store.filters.platform !== 'ALL' || 
    store.filters.type !== 'ALL' || 
    store.filters.stage !== 'ALL' || 
    store.filters.status !== 'ALL' || 
    store.filters.owner !== 'ALL' || 
    store.filters.hasConflict
  );

  container.innerHTML = `
    <div class="releases-view-container">
      <!-- Toolbar -->
      <div class="releases-toolbar">
        <div class="toolbar-title-group">
          <h1 class="page-title">Release Calendar Tracker</h1>
          <p class="page-subtitle" id="releases-count-subtitle">Showing ${filteredCount} of ${totalCount} releases tracked</p>
        </div>

        <div class="toolbar-actions">
          <!-- View Mode Toggle (Table vs Cards) -->
          <div class="segmented-control view-mode-control" title="Toggle Display Mode">
            <button class="seg-btn ${viewMode === 'table' ? 'active' : ''}" id="btn-view-table">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              Table
            </button>
            <button class="seg-btn ${viewMode === 'cards' ? 'active' : ''}" id="btn-view-cards">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Cards
            </button>
          </div>

          <button class="btn btn-primary" id="btn-create-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>New Release</span>
          </button>
          
          <div class="dropdown-wrapper">
            <button class="btn btn-secondary" id="export-dropdown-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Export</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="dropdown-menu" id="export-menu">
              <button class="dropdown-item" id="btn-export-excel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                Export Excel (.xlsx)
              </button>
              <button class="dropdown-item" id="btn-export-csv">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Export CSV (.csv)
              </button>
            </div>
          </div>

          <button class="btn btn-secondary" id="btn-import-excel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>Import</span>
          </button>
        </div>
      </div>

      <!-- Filter Controls Bar with Dual Dedicated Search Bars -->
      <div class="filter-bar card">
        <div class="search-bars-grid">
          <!-- General Search Bar -->
          <div class="search-box-wrapper">
            <div class="search-bar-label-row">
              <label class="search-bar-label" for="filter-search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                General Search
              </label>
              <span class="search-bar-hint">Release, dev, CR, RITM...</span>
            </div>
            <div class="search-box">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="filter-search" class="search-input" placeholder="Search releases, developers, CR, RITM..." value="${escapeHtml(store.filters.search || '')}" autocomplete="off">
              <button id="clear-search-btn" class="clear-input-btn" style="${store.filters.search ? 'display: inline-flex;' : 'display: none;'}" title="Clear search">&times;</button>
            </div>
          </div>

          <!-- Separate Dedicated Impacted Objects Search Bar -->
          <div class="search-box-wrapper" id="impacted-search-wrapper">
            <div class="search-bar-label-row">
              <label class="search-bar-label text-cyan" for="filter-impacted-object">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                Database Objects Changed
              </label>
              <span class="search-bar-hint">${allDbObjects.length} objects available</span>
            </div>
            <div class="search-box search-box-impacted">
              <svg class="search-icon search-icon-cyan" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              <input type="text" id="filter-impacted-object" class="search-input search-input-impacted font-mono" placeholder="Search database object (e.g. JTR_PRD_..., DW_...)" value="${escapeHtml(store.filters.impactedObject && store.filters.impactedObject !== 'ALL' ? store.filters.impactedObject : '')}" autocomplete="off">
              <button id="clear-impacted-btn" class="clear-input-btn" style="${store.filters.impactedObject && store.filters.impactedObject !== 'ALL' ? 'display: inline-flex;' : 'display: none;'}" title="Clear object filter">&times;</button>
              
              <!-- Floating Suggestions Dropdown -->
              <div id="impacted-suggestions-dropdown" class="suggestions-dropdown" style="display: none;"></div>
            </div>
          </div>
        </div>

        <div class="filter-dropdowns">
          <div class="filter-item">
            <label class="filter-label">Platform</label>
            <select id="filter-platform" class="filter-select">
              ${platforms.map(p => `<option value="${p}" ${store.filters.platform === p ? 'selected' : ''}>${p === 'ALL' ? 'All Platforms' : p}</option>`).join('')}
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Type</label>
            <select id="filter-type" class="filter-select">
              ${types.map(t => `<option value="${t}" ${store.filters.type === t ? 'selected' : ''}>${t === 'ALL' ? 'All Types' : t}</option>`).join('')}
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Stage</label>
            <select id="filter-stage" class="filter-select">
              ${stages.map(s => `<option value="${s}" ${store.filters.stage === s ? 'selected' : ''}>${s === 'ALL' ? 'All Stages' : s}</option>`).join('')}
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Status</label>
            <select id="filter-status" class="filter-select">
              ${statuses.map(st => `<option value="${st}" ${store.filters.status === st ? 'selected' : ''}>${st === 'ALL' ? 'All Statuses' : st}</option>`).join('')}
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Owner</label>
            <select id="filter-owner" class="filter-select">
              ${owners.map(o => `<option value="${o}" ${store.filters.owner === o ? 'selected' : ''}>${o === 'ALL' ? 'All Owners' : o}</option>`).join('')}
            </select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Sort</label>
            <select id="filter-sort" class="filter-select">
              <option value="id-desc" ${currentSortKey === 'id-desc' ? 'selected' : ''}># ID (Reverse: 44 → 1)</option>
              <option value="id-asc" ${currentSortKey === 'id-asc' ? 'selected' : ''}># ID (1 → 44)</option>
              <option value="targetDeploy-desc" ${currentSortKey === 'targetDeploy-desc' ? 'selected' : ''}>Timeline (Newest)</option>
              <option value="targetDeploy-asc" ${currentSortKey === 'targetDeploy-asc' ? 'selected' : ''}>Timeline (Oldest)</option>
              <option value="name-asc" ${currentSortKey === 'name-asc' ? 'selected' : ''}>Release Name (A → Z)</option>
              <option value="name-desc" ${currentSortKey === 'name-desc' ? 'selected' : ''}>Release Name (Z → A)</option>
              <option value="developer-asc" ${currentSortKey === 'developer-asc' ? 'selected' : ''}>Developer (A → Z)</option>
              <option value="platform-asc" ${currentSortKey === 'platform-asc' ? 'selected' : ''}>Platform</option>
              <option value="stage-asc" ${currentSortKey === 'stage-asc' ? 'selected' : ''}>Stage</option>
              <option value="status-asc" ${currentSortKey === 'status-asc' ? 'selected' : ''}>Status</option>
            </select>
          </div>

          <div class="filter-item checkbox-filter">
            <label class="checkbox-label" title="Show only releases with holiday conflict">
              <input type="checkbox" id="filter-conflict" ${store.filters.hasConflict ? 'checked' : ''}>
              <span>⚠️ Conflicts</span>
            </label>
          </div>

          <div id="reset-filter-wrap" style="${hasActiveFilters ? 'display: inline-block;' : 'display: none;'}">
            <button class="btn btn-ghost btn-sm reset-filter-link" id="btn-reset-filters" title="Reset all filters">Clear Filters</button>
          </div>
        </div>
      </div>

      <!-- Main Display Area: Table or Card Grid -->
      <div id="releases-content-area">
        ${getReleasesListHTML(releases, viewMode)}
      </div>
    </div>
  `;

  setupTableEvents(container);

  // Restore cursor and focus if the user was typing in either search input
  if (wasSearchFocused) {
    const newSearchInput = container.querySelector('#filter-search');
    if (newSearchInput) {
      newSearchInput.focus();
      if (typeof selStart === 'number' && typeof selEnd === 'number') {
        newSearchInput.setSelectionRange(selStart, selEnd);
      }
    }
  } else if (wasImpactedFocused) {
    const newImpactedInput = container.querySelector('#filter-impacted-object');
    if (newImpactedInput) {
      newImpactedInput.focus();
      if (typeof impactedSelStart === 'number' && typeof impactedSelEnd === 'number') {
        newImpactedInput.setSelectionRange(impactedSelStart, impactedSelEnd);
      }
    }
  }
}

export function getReleasesListHTML(releases, viewMode) {
  if (releases.length === 0) {
    return `
      <div class="empty-state card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <h3>No releases found</h3>
        <p>Try adjusting your search query or active filters, or create a new release.</p>
        <button class="btn btn-secondary btn-sm" id="empty-reset-filters">Clear All Filters</button>
      </div>
    `;
  }

  if (viewMode === 'cards') {
    return `
      <div class="release-cards-grid">
        ${releases.map(rel => {
          const hasConflict = rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:');
          const isOnHold = rel.status === 'On Hold';
          const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
          const stageSlug = (rel.stage || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
          const platformSlug = (rel.platform || '').toLowerCase();
          const typeSlug = (rel.type || '').toLowerCase();

          return `
            <div class="mobile-release-card card ${hasConflict ? 'card-conflict-border' : ''} ${isOnHold ? 'card-on-hold-border' : ''}" data-release-id="${rel.id}">
              <div class="m-card-header">
                <div class="m-card-tags">
                  <span class="card-id font-mono">#${rel.id}</span>
                  <span class="platform-tag platform-${platformSlug}">${rel.platform || '-'}</span>
                  <span class="type-pill type-${typeSlug}">${rel.type || '-'}</span>
                  ${rel.version ? `<span class="badge-version">${escapeHtml(rel.version)}</span>` : ''}
                </div>
                <div class="m-card-status">
                  <span class="status-pill status-${statusSlug}">${rel.status || 'Pending'}</span>
                </div>
              </div>

              <h3 class="m-card-title clickable-title" data-release-id="${rel.id}">
                ${escapeHtml(rel.name)}
              </h3>

              ${hasConflict ? `
                <div class="m-card-conflict">
                  ⚠️ Holiday Conflict: <strong>${escapeHtml(rel.holidayConflict.replace('Conflict: ', ''))}</strong>
                </div>
              ` : ''}

              <div class="m-card-meta-grid">
                <div class="m-meta-item">
                  <span class="m-meta-label">Developer</span>
                  <div class="developer-cell">
                    <span class="dev-avatar-sm">${getInitials(rel.developer)}</span>
                    <span class="dev-name">${escapeHtml(rel.developer || 'Unassigned')}</span>
                  </div>
                </div>

                <div class="m-meta-item">
                  <span class="m-meta-label">Current Stage</span>
                  <span class="stage-tag stage-${stageSlug}">${rel.stage}</span>
                </div>

                <div class="m-meta-item">
                  <span class="m-meta-label">Target Deploy</span>
                  <span class="font-mono ${hasConflict ? 'text-danger font-bold' : ''}">${rel.targetDeploy || '—'}</span>
                </div>

                <div class="m-meta-item">
                  <span class="m-meta-label">Stage Owner</span>
                  <span class="text-muted text-xs">${escapeHtml(rel.owner || '—')}</span>
                </div>
              </div>

              <div class="m-card-actions">
                <button class="btn btn-sm btn-secondary act-view" data-release-id="${rel.id}">View Details</button>
                <button class="btn btn-sm btn-ghost act-edit" data-release-id="${rel.id}">Edit</button>
                <button class="btn btn-sm btn-ghost act-duplicate" data-release-id="${rel.id}">Copy</button>
                <button class="btn btn-sm btn-ghost text-danger act-delete" data-release-id="${rel.id}">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Table View
  return `
    <div class="table-scroll-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
      <span>Swipe horizontally to scroll table columns</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </div>

    <div class="table-container card">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-id sortable-th ${store.sort?.column === 'id' ? 'sorted-active' : ''}" data-sort-col="id" title="Click to sort by # ID"># <span class="sort-icon">${getSortIcon('id')}</span></th>
            <th class="col-name sortable-th ${store.sort?.column === 'name' ? 'sorted-active' : ''}" data-sort-col="name" title="Click to sort by Release Name">Release Name <span class="sort-icon">${getSortIcon('name')}</span></th>
            <th class="col-platform sortable-th ${store.sort?.column === 'platform' ? 'sorted-active' : ''}" data-sort-col="platform" title="Click to sort by Platform">Platform <span class="sort-icon">${getSortIcon('platform')}</span></th>
            <th class="col-type sortable-th ${store.sort?.column === 'type' ? 'sorted-active' : ''}" data-sort-col="type" title="Click to sort by Type">Type <span class="sort-icon">${getSortIcon('type')}</span></th>
            <th class="col-dev sortable-th ${store.sort?.column === 'developer' ? 'sorted-active' : ''}" data-sort-col="developer" title="Click to sort by Developer">Developer <span class="sort-icon">${getSortIcon('developer')}</span></th>
            <th class="col-dates sortable-th ${store.sort?.column === 'targetDeploy' ? 'sorted-active' : ''}" data-sort-col="targetDeploy" title="Click to sort by Timeline">Timeline <span class="sort-icon">${getSortIcon('targetDeploy')}</span></th>
            <th class="col-stage sortable-th ${store.sort?.column === 'stage' ? 'sorted-active' : ''}" data-sort-col="stage" title="Click to sort by Stage">Current Stage <span class="sort-icon">${getSortIcon('stage')}</span></th>
            <th class="col-owner sortable-th ${store.sort?.column === 'owner' ? 'sorted-active' : ''}" data-sort-col="owner" title="Click to sort by Stage Owner">Stage Owner <span class="sort-icon">${getSortIcon('owner')}</span></th>
            <th class="col-status sortable-th ${store.sort?.column === 'status' ? 'sorted-active' : ''}" data-sort-col="status" title="Click to sort by Status">Status <span class="sort-icon">${getSortIcon('status')}</span></th>
            <th class="col-conflict">Holiday Check</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${releases.map(rel => {
            const hasConflict = rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:');
            const isOnHold = rel.status === 'On Hold';
            const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
            const stageSlug = (rel.stage || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
            const platformSlug = (rel.platform || '').toLowerCase();
            const typeSlug = (rel.type || '').toLowerCase();

            return `
              <tr class="table-row ${hasConflict ? 'row-conflict' : ''} ${isOnHold ? 'row-on-hold' : ''}" data-release-id="${rel.id}">
                <td class="col-id font-mono">${rel.id}</td>
                
                <td class="col-name">
                  <div class="release-cell-title">
                    <span class="rel-name-text clickable-title" data-release-id="${rel.id}">${escapeHtml(rel.name)}</span>
                    <div class="rel-badges">
                      ${rel.version ? `<span class="badge-version">${escapeHtml(rel.version)}</span>` : ''}
                      ${rel.ritm ? `<span class="badge-ticket">RITM: ${escapeHtml(rel.ritm)}</span>` : ''}
                      ${rel.cr ? `<span class="badge-ticket">CR: ${escapeHtml(rel.cr)}</span>` : ''}
                    </div>
                  </div>
                </td>

                <td class="col-platform">
                  <span class="platform-tag platform-${platformSlug}">${rel.platform || '-'}</span>
                </td>

                <td class="col-type">
                  <span class="type-pill type-${typeSlug}">${rel.type || '-'}</span>
                </td>

                <td class="col-dev">
                  <div class="developer-cell">
                    <span class="dev-avatar">${getInitials(rel.developer)}</span>
                    <span class="dev-name">${escapeHtml(rel.developer || 'Unassigned')}</span>
                  </div>
                </td>

                <td class="col-dates">
                  <div class="timeline-cell">
                    <div class="date-row">
                      <span class="date-label">Start:</span>
                      <span class="date-val">${rel.startDate || '—'}</span>
                    </div>
                    <div class="date-row">
                      <span class="date-label">Target:</span>
                      <span class="date-val font-semibold ${hasConflict ? 'text-danger' : ''}">${rel.targetDeploy || '—'}</span>
                    </div>
                  </div>
                </td>

                <td class="col-stage">
                  <select class="inline-stage-select stage-${stageSlug}" data-release-id="${rel.id}">
                    ${store.stages.map(s => `
                      <option value="${s}" ${rel.stage === s ? 'selected' : ''}>${s}</option>
                    `).join('')}
                  </select>
                </td>

                <td class="col-owner text-muted">
                  ${escapeHtml(rel.owner || '—')}
                </td>

                <td class="col-status">
                  <select class="inline-status-select status-${statusSlug}" data-release-id="${rel.id}">
                    ${store.statuses.map(st => `
                      <option value="${st}" ${rel.status === st ? 'selected' : ''}>${st}</option>
                    `).join('')}
                  </select>
                </td>

                <td class="col-conflict">
                  ${hasConflict ? `
                    <div class="conflict-badge" title="${escapeHtml(rel.holidayConflict)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>${escapeHtml(rel.holidayConflict.replace('Conflict: ', ''))}</span>
                    </div>
                  ` : `
                    <span class="conflict-clear" title="No holiday conflict">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Clear
                    </span>
                  `}
                </td>

                <td class="col-actions">
                  <div class="actions-cell">
                    <button class="btn-icon-subtle act-view" data-release-id="${rel.id}" title="View Details & Lifecycle">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button class="btn-icon-subtle act-edit" data-release-id="${rel.id}" title="Edit Release">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon-subtle act-duplicate" data-release-id="${rel.id}" title="Duplicate Release">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button class="btn-icon-subtle text-danger act-delete" data-release-id="${rel.id}" title="Delete Release">
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
  `;
}

function renderListResults(container) {
  const contentArea = container.querySelector('#releases-content-area');
  const countSubtitle = container.querySelector('#releases-count-subtitle');
  if (!contentArea) return;

  const releases = store.getFilteredReleases();
  const totalCount = store.releases.length;
  const filteredCount = releases.length;
  const viewMode = window._releaseListMode || 'table';

  if (countSubtitle) {
    countSubtitle.textContent = `Showing ${filteredCount} of ${totalCount} releases tracked`;
  }

  contentArea.innerHTML = getReleasesListHTML(releases, viewMode);
  bindItemEvents(container);
}

function updateActiveFilterBtn(container) {
  const resetWrap = container.querySelector('#reset-filter-wrap');
  if (!resetWrap) return;

  const hasActiveFilters = Boolean(
    store.filters.search || 
    (store.filters.impactedObject && store.filters.impactedObject !== 'ALL') || 
    store.filters.platform !== 'ALL' || 
    store.filters.type !== 'ALL' || 
    store.filters.stage !== 'ALL' || 
    store.filters.status !== 'ALL' || 
    store.filters.owner !== 'ALL' || 
    store.filters.hasConflict
  );

  resetWrap.style.display = hasActiveFilters ? 'inline-block' : 'none';
}

function setupTableEvents(container) {
  // Mode toggles
  container.querySelector('#btn-view-table')?.addEventListener('click', () => {
    window._releaseListMode = 'table';
    container.querySelector('#btn-view-table')?.classList.add('active');
    container.querySelector('#btn-view-cards')?.classList.remove('active');
    renderListResults(container);
  });

  container.querySelector('#btn-view-cards')?.addEventListener('click', () => {
    window._releaseListMode = 'cards';
    container.querySelector('#btn-view-cards')?.classList.add('active');
    container.querySelector('#btn-view-table')?.classList.remove('active');
    renderListResults(container);
  });

  // New Release Button
  const createBtn = container.querySelector('#btn-create-release');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
    });
  }

  // Export dropdown
  const exportBtn = container.querySelector('#export-dropdown-btn');
  const exportMenu = container.querySelector('#export-menu');
  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      exportMenu.classList.remove('show');
    });

    container.querySelector('#btn-export-excel')?.addEventListener('click', () => {
      exportReleasesToExcel();
      exportMenu.classList.remove('show');
    });

    container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      exportReleasesToCSV();
      exportMenu.classList.remove('show');
    });
  }

  // Import button
  container.querySelector('#btn-import-excel')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-import-modal'));
  });

  // --- General Search Input ---
  const searchInput = container.querySelector('#filter-search');
  const clearBtn = container.querySelector('#clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.filters.search = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = e.target.value ? 'inline-flex' : 'none';
      }
      updateActiveFilterBtn(container);
      renderListResults(container);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      store.filters.search = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      clearBtn.style.display = 'none';
      updateActiveFilterBtn(container);
      renderListResults(container);
    });
  }

  // --- Dedicated Impacted Objects Search Bar & Autocomplete Suggestions ---
  const impactedInput = container.querySelector('#filter-impacted-object');
  const clearImpactedBtn = container.querySelector('#clear-impacted-btn');
  const suggestionsDropdown = container.querySelector('#impacted-suggestions-dropdown');
  let activeIndex = -1;

  const renderSuggestions = () => {
    if (!suggestionsDropdown || !impactedInput) return;
    const q = (impactedInput.value || '').trim();
    const qLower = q.toLowerCase();
    const allObjects = store.getAllDbObjects();

    const filteredObjects = qLower
      ? allObjects.filter(obj => obj.toLowerCase().includes(qLower))
      : allObjects;

    if (filteredObjects.length === 0) {
      suggestionsDropdown.innerHTML = `
        <div class="no-suggestions-notice">No database objects found matching "${escapeHtml(q)}"</div>
      `;
      suggestionsDropdown.style.display = 'block';
      return;
    }

    const displayList = filteredObjects.slice(0, 30);
    const headerText = qLower
      ? `Matching Database Objects (${filteredObjects.length})`
      : `All Impacted Objects (${filteredObjects.length})`;

    suggestionsDropdown.innerHTML = `
      <div class="suggestion-header">${headerText}</div>
      ${displayList.map((obj, idx) => {
        const count = store.releases.filter(r => {
          if (!r.dbObjects) return false;
          const parts = r.dbObjects.split(/[,;\n\r\t\s]+/).map(p => p.trim().replace(/^[,;]+|[,;]+$/g, '').toLowerCase());
          return parts.includes(obj.toLowerCase());
        }).length;
        let displayName = escapeHtml(obj);
        if (qLower) {
          const matchIdx = obj.toLowerCase().indexOf(qLower);
          if (matchIdx !== -1) {
            displayName = escapeHtml(obj.slice(0, matchIdx)) +
              '<mark>' + escapeHtml(obj.slice(matchIdx, matchIdx + q.length)) + '</mark>' +
              escapeHtml(obj.slice(matchIdx + q.length));
          }
        }
        return `
          <div class="suggestion-item ${idx === activeIndex ? 'active' : ''}" data-obj-name="${escapeHtml(obj)}">
            <span class="suggestion-name">${displayName}</span>
            <span class="suggestion-count">${count} ${count === 1 ? 'rel' : 'rels'}</span>
          </div>
        `;
      }).join('')}
    `;
    suggestionsDropdown.style.display = 'block';

    // Bind click events on suggestions
    suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const objName = item.dataset.objName;
        impactedInput.value = objName;
        store.filters.impactedObject = objName;
        if (clearImpactedBtn) {
          clearImpactedBtn.style.display = 'inline-flex';
        }
        suggestionsDropdown.style.display = 'none';
        activeIndex = -1;
        updateActiveFilterBtn(container);
        renderListResults(container);
      });
    });
  };

  if (impactedInput) {
    impactedInput.addEventListener('input', (e) => {
      activeIndex = -1;
      const val = e.target.value;
      store.filters.impactedObject = val.trim();
      if (clearImpactedBtn) {
        clearImpactedBtn.style.display = val ? 'inline-flex' : 'none';
      }
      renderSuggestions();
      updateActiveFilterBtn(container);
      renderListResults(container);
    });

    impactedInput.addEventListener('focus', () => {
      renderSuggestions();
    });

    impactedInput.addEventListener('keydown', (e) => {
      const items = suggestionsDropdown ? suggestionsDropdown.querySelectorAll('.suggestion-item') : [];
      if (!items || items.length === 0 || suggestionsDropdown.style.display === 'none') {
        if (e.key === 'ArrowDown') {
          renderSuggestions();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          items[activeIndex].click();
        }
      } else if (e.key === 'Escape') {
        suggestionsDropdown.style.display = 'none';
        activeIndex = -1;
      }
    });
  }

  if (clearImpactedBtn) {
    clearImpactedBtn.addEventListener('click', () => {
      store.filters.impactedObject = '';
      if (impactedInput) {
        impactedInput.value = '';
        impactedInput.focus();
      }
      clearImpactedBtn.style.display = 'none';
      if (suggestionsDropdown) {
        suggestionsDropdown.style.display = 'none';
      }
      updateActiveFilterBtn(container);
      renderListResults(container);
    });
  }

  // Dismiss suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!container.querySelector('#impacted-search-wrapper')?.contains(e.target)) {
      if (suggestionsDropdown) {
        suggestionsDropdown.style.display = 'none';
      }
    }
  });

  // Dropdown filters
  const platformSel = container.querySelector('#filter-platform');
  const typeSel = container.querySelector('#filter-type');
  const stageSel = container.querySelector('#filter-stage');
  const statusSel = container.querySelector('#filter-status');
  const ownerSel = container.querySelector('#filter-owner');
  const conflictCheck = container.querySelector('#filter-conflict');

  const updateFiltersAndRender = () => {
    updateActiveFilterBtn(container);
    renderListResults(container);
  };

  platformSel?.addEventListener('change', (e) => {
    store.filters.platform = e.target.value;
    updateFiltersAndRender();
  });
  typeSel?.addEventListener('change', (e) => {
    store.filters.type = e.target.value;
    updateFiltersAndRender();
  });
  stageSel?.addEventListener('change', (e) => {
    store.filters.stage = e.target.value;
    updateFiltersAndRender();
  });
  statusSel?.addEventListener('change', (e) => {
    store.filters.status = e.target.value;
    updateFiltersAndRender();
  });
  ownerSel?.addEventListener('change', (e) => {
    store.filters.owner = e.target.value;
    updateFiltersAndRender();
  });
  conflictCheck?.addEventListener('change', (e) => {
    store.filters.hasConflict = e.target.checked;
    updateFiltersAndRender();
  });

  const sortSel = container.querySelector('#filter-sort');
  sortSel?.addEventListener('change', (e) => {
    const [col, dir] = e.target.value.split('-');
    store.setSort(col, dir);
    renderListResults(container);
  });

  // Reset filters
  const resetBtn = container.querySelector('#btn-reset-filters');
  resetBtn?.addEventListener('click', () => {
    store.filters = {
      search: '',
      impactedObject: '',
      platform: 'ALL',
      type: 'ALL',
      stage: 'ALL',
      status: 'ALL',
      owner: 'ALL',
      month: 'ALL',
      year: 'ALL',
      hasConflict: false
    };
    renderReleaseList(container);
  });

  bindItemEvents(container);
}

function bindItemEvents(container) {
  // Sortable column headers
  container.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortCol;
      if (!col) return;
      store.setSort(col);
      const sortSel = container.querySelector('#filter-sort');
      if (sortSel) {
        sortSel.value = `${store.sort.column}-${store.sort.direction}`;
      }
      renderListResults(container);
    });
  });

  // Empty state reset button
  container.querySelector('#empty-reset-filters')?.addEventListener('click', () => {
    store.filters = {
      search: '',
      impactedObject: '',
      platform: 'ALL',
      type: 'ALL',
      stage: 'ALL',
      status: 'ALL',
      owner: 'ALL',
      month: 'ALL',
      year: 'ALL',
      hasConflict: false
    };
    renderReleaseList(container);
  });

  // Inline Stage Change
  container.querySelectorAll('.inline-stage-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.releaseId, 10);
      const newStage = e.target.value;
      store.updateRelease(id, { stage: newStage });
    });
  });

  // Inline Status Change
  container.querySelectorAll('.inline-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.releaseId, 10);
      const newStatus = e.target.value;
      store.updateRelease(id, { status: newStatus });
    });
  });

  // Action buttons
  container.querySelectorAll('.clickable-title, .act-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.releaseId, 10);
      window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
    });
  });

  container.querySelectorAll('.act-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.releaseId, 10);
      window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'edit', id } }));
    });
  });

  container.querySelectorAll('.act-duplicate').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.releaseId, 10);
      store.duplicateRelease(id);
    });
  });

  container.querySelectorAll('.act-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.releaseId, 10);
      const rel = store.getReleaseById(id);
      if (confirm(`Are you sure you want to delete release: "${rel ? rel.name : id}"?`)) {
        store.deleteRelease(id);
      }
    });
  });
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

function getSortIcon(col) {
  if (store.sort?.column !== col) {
    return '↕';
  }
  return store.sort.direction === 'asc' ? '▲' : '▼';
}
