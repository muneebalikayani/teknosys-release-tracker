import { store } from '../data/store.js';

export function renderKanbanBoard(container) {
  const groupBy = store.boardGroupBy || 'stage'; // 'stage' or 'status'
  const columns = groupBy === 'stage' ? store.stages : store.statuses;
  const filteredReleases = store.getFilteredReleases();

  container.innerHTML = `
    <div class="kanban-view-container">
      <!-- Kanban Header -->
      <div class="kanban-header-bar">
        <div>
          <h1 class="page-title">Release Workflow Board</h1>
          <p class="page-subtitle">Visual pipeline view grouped by ${groupBy === 'stage' ? 'Lifecycle Stage' : 'Delivery Status'}</p>
        </div>

        <div class="kanban-controls">
          <div class="segmented-control">
            <button class="seg-btn ${groupBy === 'stage' ? 'active' : ''}" id="board-group-stage">Group by Stage</button>
            <button class="seg-btn ${groupBy === 'status' ? 'active' : ''}" id="board-group-status">Group by Status</button>
          </div>

          <button class="btn btn-primary" id="btn-board-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      <!-- Columns Container -->
      <div class="kanban-columns-scroller">
        <div class="kanban-columns-grid">
          ${columns.map(col => {
            const colReleases = filteredReleases.filter(r => {
              if (groupBy === 'stage') return r.stage === col;
              return r.status === col;
            });

            const colSlug = col.toLowerCase().replace(/[^a-z0-9]/g, '-');

            return `
              <div class="kanban-column" data-col-name="${col}">
                <div class="kanban-column-header">
                  <div class="col-title-group">
                    <span class="col-dot dot-${colSlug}"></span>
                    <h3 class="col-name">${col}</h3>
                  </div>
                  <span class="col-counter">${colReleases.length}</span>
                </div>

                <div class="kanban-cards-list">
                  ${colReleases.length === 0 ? `
                    <div class="kanban-empty-col">No releases</div>
                  ` : colReleases.map(rel => {
                    const hasConflict = rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:');
                    const isOnHold = rel.status === 'On Hold';
                    const platformSlug = (rel.platform || '').toLowerCase();
                    const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');

                    return `
                      <div class="kanban-card ${hasConflict ? 'card-conflict-border' : ''} ${isOnHold ? 'card-on-hold-border' : ''}" data-release-id="${rel.id}" draggable="true">
                        <div class="card-tags-row">
                          <span class="card-drag-handle" title="Drag to move">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2"></circle><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="16" cy="12" r="2"></circle><circle cx="8" cy="18" r="2"></circle><circle cx="16" cy="18" r="2"></circle></svg>
                          </span>
                          <span class="platform-tag platform-${platformSlug}">${rel.platform || 'General'}</span>
                          ${rel.version ? `<span class="badge-version">${escapeHtml(rel.version)}</span>` : ''}
                          ${isOnHold ? `<span class="badge-hold-sm" title="On Hold at ${escapeHtml(rel.stage)} stage">⏸️ On Hold</span>` : ''}
                          ${hasConflict ? `
                            <span class="badge-conflict-pill" title="${escapeHtml(rel.holidayConflict)}">
                              ⚠️ Conflict
                            </span>
                          ` : ''}
                        </div>

                        <h4 class="card-release-title">${escapeHtml(rel.name)}</h4>

                        <div class="card-details-row">
                          <div class="card-dev">
                            <span class="dev-avatar-sm">${getInitials(rel.developer)}</span>
                            <span>${escapeHtml(rel.developer || 'Unassigned')}</span>
                          </div>
                          
                          ${groupBy === 'stage' ? `
                            <span class="status-pill status-${statusSlug}">${rel.status || 'Pending'}</span>
                          ` : `
                            <span class="stage-tag">${rel.stage || 'Dev'}</span>
                          `}
                        </div>

                        <div class="card-footer-row">
                          <div class="card-date-info">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>${rel.targetDeploy ? rel.targetDeploy : 'No date'}</span>
                          </div>
                          <span class="card-id font-mono">#${rel.id}</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  setupKanbanEvents(container, groupBy);
}

function setupKanbanEvents(container, groupBy) {
  // Toggle group by
  container.querySelector('#board-group-stage')?.addEventListener('click', () => {
    store.boardGroupBy = 'stage';
    renderKanbanBoard(container);
  });

  container.querySelector('#board-group-status')?.addEventListener('click', () => {
    store.boardGroupBy = 'status';
    renderKanbanBoard(container);
  });

  container.querySelector('#btn-board-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  let draggedReleaseId = null;
  let isDragging = false;

  // Drag and Drop on Cards
  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      isDragging = true;
      draggedReleaseId = parseInt(card.dataset.releaseId, 10);
      e.dataTransfer.setData('text/plain', String(draggedReleaseId));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
      document.body.classList.add('kanban-dragging-active');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.body.classList.remove('kanban-dragging-active');
      container.querySelectorAll('.kanban-column.drag-over').forEach(col => {
        col.classList.remove('drag-over');
      });
      setTimeout(() => {
        isDragging = false;
        draggedReleaseId = null;
      }, 120);
    });

    // Card click opens detail modal (guarded against drag)
    card.addEventListener('click', () => {
      if (isDragging || draggedReleaseId) return;
      const id = parseInt(card.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });

  // Drop Zones on Columns
  container.querySelectorAll('.kanban-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!col.classList.contains('drag-over')) {
        container.querySelectorAll('.kanban-column.drag-over').forEach(c => c.classList.remove('drag-over'));
        col.classList.add('drag-over');
      }
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetCol = col.dataset.colName;
      const rawId = draggedReleaseId || parseInt(e.dataTransfer.getData('text/plain'), 10);

      if (!rawId || !targetCol) return;

      const release = store.getReleaseById(rawId);
      if (!release) return;

      if (groupBy === 'stage') {
        if (release.stage !== targetCol) {
          store.updateRelease(rawId, { stage: targetCol });
        }
      } else {
        if (release.status !== targetCol) {
          store.updateRelease(rawId, { status: targetCol });
        }
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
