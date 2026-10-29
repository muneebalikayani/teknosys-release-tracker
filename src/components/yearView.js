import { store } from '../data/store.js';

export function renderYearView(container) {
  if (!window._yearCalYear) {
    window._yearCalYear = 2026;
  }
  const year = window._yearCalYear;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const todayStr = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="year-view-container">
      <!-- Header -->
      <div class="year-header-bar">
        <div>
          <h1 class="page-title">Year-at-a-Glance Calendar (${year})</h1>
          <p class="page-subtitle">Annual distribution of deployments, milestones and telecom public holidays</p>
        </div>

        <div class="year-controls">
          <div class="btn-group">
            <button class="btn btn-secondary btn-icon" id="year-prev-btn" title="Previous Year">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span class="year-display font-mono font-bold">${year}</span>
            <button class="btn btn-secondary btn-icon" id="year-next-btn" title="Next Year">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          <button class="btn btn-primary" id="btn-year-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      <!-- Legend -->
      <div class="year-legend card">
        <div class="legend-item"><span class="year-dot dot-deploy"></span> Target Deploy</div>
        <div class="legend-item"><span class="year-dot dot-start"></span> Start Date</div>
        <div class="legend-item"><span class="year-dot dot-holiday"></span> Public Holiday</div>
        <div class="legend-item"><span class="year-dot dot-today"></span> Today</div>
      </div>

      <!-- 12 Months Grid -->
      <div class="year-months-grid">
        ${monthNames.map((monthName, mIdx) => {
          const mNum = mIdx + 1;
          const firstDay = new Date(year, mIdx, 1);
          const lastDay = new Date(year, mNum, 0);
          const totalDays = lastDay.getDate();
          const startDayOfWeek = firstDay.getDay();

          // Build month cells
          const cells = [];
          for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ empty: true });
          }
          for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            // Check holiday
            const holidays = store.holidays.filter(h => dateStr >= h.startDate && dateStr <= (h.endDate || h.startDate));

            // Check releases
            const starts = store.releases.filter(r => r.startDate === dateStr);
            const targets = store.releases.filter(r => r.targetDeploy === dateStr);

            cells.push({
              empty: false,
              day: d,
              dateStr,
              isToday: dateStr === todayStr,
              hasHoliday: holidays.length > 0,
              holidays,
              starts,
              targets
            });
          }

          return `
            <div class="mini-month-card card">
              <div class="mini-month-header">
                <h3 class="mini-month-title">${monthName}</h3>
                <span class="mini-month-stat">
                  ${store.releases.filter(r => r.targetDeploy && r.targetDeploy.startsWith(`${year}-${String(mNum).padStart(2, '0')}`)).length} deploys
                </span>
              </div>

              <div class="mini-weekdays-row">
                <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
              </div>

              <div class="mini-days-grid">
                ${cells.map(c => {
                  if (c.empty) {
                    return `<div class="mini-day-cell empty-cell"></div>`;
                  }

                  let cellClasses = ['mini-day-cell'];
                  if (c.isToday) cellClasses.push('cell-today');
                  if (c.hasHoliday) cellClasses.push('has-holiday');
                  if (c.targets.length > 0) cellClasses.push('has-deploy');
                  else if (c.starts.length > 0) cellClasses.push('has-start');

                  let tooltipParts = [`Date: ${c.dateStr}`];
                  if (c.holidays.length > 0) {
                    tooltipParts.push(`Holiday: ${c.holidays.map(h => h.name).join(', ')}`);
                  }
                  if (c.targets.length > 0) {
                    tooltipParts.push(`🚀 Target Deploy: ${c.targets.map(r => r.name).join(' | ')}`);
                  }
                  if (c.starts.length > 0) {
                    tooltipParts.push(`🚩 Start: ${c.starts.map(r => r.name).join(' | ')}`);
                  }

                  return `
                    <div class="${cellClasses.join(' ')}" data-date="${c.dateStr}" title="${escapeHtml(tooltipParts.join('\n'))}">
                      <span class="mini-day-num">${c.day}</span>
                      <div class="mini-indicators">
                        ${c.hasHoliday ? `<span class="indicator-holiday"></span>` : ''}
                        ${c.targets.length > 0 ? `<span class="indicator-deploy"></span>` : ''}
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
  `;

  setupYearEvents(container);
}

function setupYearEvents(container) {
  container.querySelector('#year-prev-btn')?.addEventListener('click', () => {
    window._yearCalYear -= 1;
    renderYearView(container);
  });

  container.querySelector('#year-next-btn')?.addEventListener('click', () => {
    window._yearCalYear += 1;
    renderYearView(container);
  });

  container.querySelector('#btn-year-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  // Clicking a day in year view
  container.querySelectorAll('.mini-day-cell:not(.empty-cell)').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      if (date) {
        window.dispatchEvent(new CustomEvent('open-release-modal', {
          detail: { mode: 'create', defaultDate: date }
        }));
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
