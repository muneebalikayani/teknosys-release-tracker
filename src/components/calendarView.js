import { store } from '../data/store.js';

export function renderCalendarView(container) {
  // Use store dashboard filter or local calendar state
  if (!window._calState) {
    const today = new Date();
    window._calState = {
      month: today.getMonth() + 1, // 1-12
      year: today.getFullYear(),    // 2026
      selectedDayDate: null
    };
  }

  const { month, year, selectedDayDate } = window._calState;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calendar dates math
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday

  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  const calendarCells = [];

  // Previous month filler days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonthDate = new Date(year, month - 2, dayNum);
    const dateStr = formatDateStr(prevMonthDate);
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const currDate = new Date(year, month - 1, d);
    const dateStr = formatDateStr(currDate);
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true
    });
  }

  // Next month filler days
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthDate = new Date(year, month, d);
    const dateStr = formatDateStr(nextMonthDate);
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // If a day is selected for mobile inspection, get its details
  const inspectedDay = selectedDayDate ? {
    date: selectedDayDate,
    holidays: store.holidays.filter(h => selectedDayDate >= h.startDate && selectedDayDate <= (h.endDate || h.startDate)),
    starts: store.releases.filter(r => r.startDate === selectedDayDate),
    targets: store.releases.filter(r => r.targetDeploy === selectedDayDate)
  } : null;

  container.innerHTML = `
    <div class="calendar-view-container">
      <!-- Calendar Header & Navigation -->
      <div class="calendar-header-bar">
        <div>
          <h1 class="page-title">Monthly Release Calendar</h1>
          <p class="page-subtitle">Schedule showing start milestones, target deployments & public holidays</p>
        </div>

        <div class="calendar-nav-controls">
          <div class="btn-group">
            <button class="btn btn-secondary btn-icon" id="cal-prev-month" title="Previous Month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="btn btn-secondary" id="cal-today-btn">Today</button>
            <button class="btn btn-secondary btn-icon" id="cal-next-month" title="Next Month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          <div class="date-pickers-group">
            <select id="cal-month-select" class="control-select font-semibold">
              ${monthNames.map((m, idx) => `
                <option value="${idx + 1}" ${month === (idx + 1) ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
            <select id="cal-year-select" class="control-select font-semibold">
              <option value="2026" ${year === 2026 ? 'selected' : ''}>2026</option>
              <option value="2027" ${year === 2027 ? 'selected' : ''}>2027</option>
            </select>
          </div>

          <button class="btn btn-primary" id="btn-cal-new-release">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>New Release</span>
          </button>
        </div>
      </div>

      <!-- Calendar Legend -->
      <div class="calendar-legend card">
        <div class="legend-item"><span class="legend-chip chip-start"></span> Start Date</div>
        <div class="legend-item"><span class="legend-chip chip-target"></span> Target Deploy</div>
        <div class="legend-item"><span class="legend-chip chip-blackout"></span> Public Holiday</div>
        <div class="legend-item"><span class="legend-dot status-completed"></span> Completed</div>
        <div class="legend-item"><span class="legend-dot status-on-track"></span> On Track</div>
      </div>

      <!-- Calendar Grid Card -->
      <div class="calendar-grid-card card">
        <!-- Weekday Labels -->
        <div class="calendar-weekdays-row">
          <div class="weekday-cell weekend"><span class="day-full">SUN</span><span class="day-short">S</span></div>
          <div class="weekday-cell"><span class="day-full">MON</span><span class="day-short">M</span></div>
          <div class="weekday-cell"><span class="day-full">TUE</span><span class="day-short">T</span></div>
          <div class="weekday-cell"><span class="day-full">WED</span><span class="day-short">W</span></div>
          <div class="weekday-cell"><span class="day-full">THU</span><span class="day-short">T</span></div>
          <div class="weekday-cell"><span class="day-full">FRI</span><span class="day-short">F</span></div>
          <div class="weekday-cell weekend"><span class="day-full">SAT</span><span class="day-short">S</span></div>
        </div>

        <!-- Days Grid -->
        <div class="calendar-days-grid">
          ${calendarCells.map(cell => {
            const isToday = cell.dateStr === todayStr;
            const isSelected = selectedDayDate === cell.dateStr;
            
            const holidaysOnDay = store.holidays.filter(h => {
              const start = h.startDate;
              const end = h.endDate || h.startDate;
              return cell.dateStr >= start && cell.dateStr <= end;
            });

            const startingReleases = store.releases.filter(r => r.startDate === cell.dateStr);
            const targetReleases = store.releases.filter(r => r.targetDeploy === cell.dateStr);

            return `
              <div class="calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'cell-today' : ''} ${holidaysOnDay.length > 0 ? 'cell-blackout' : ''} ${isSelected ? 'cell-selected' : ''}" data-date="${cell.dateStr}">
                <div class="cell-top">
                  <span class="day-number ${isToday ? 'today-pill' : ''}">${cell.dayNum}</span>
                  ${holidaysOnDay.length > 0 ? `
                    <span class="holiday-icon-badge" title="Holiday: ${escapeHtml(holidaysOnDay.map(h => h.name).join(', '))}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    </span>
                  ` : ''}
                </div>

                <!-- Mobile Event Dots Indicator -->
                <div class="cell-dots-mobile">
                  ${holidaysOnDay.length > 0 ? `<span class="mobile-dot dot-holiday"></span>` : ''}
                  ${targetReleases.length > 0 ? `<span class="mobile-dot dot-deploy"></span>` : ''}
                  ${startingReleases.length > 0 ? `<span class="mobile-dot dot-start"></span>` : ''}
                </div>

                <!-- Desktop Holiday Banner -->
                ${holidaysOnDay.map(h => `
                  <div class="day-holiday-banner desktop-only" title="${escapeHtml(h.name)} - ${escapeHtml(h.notes || '')}">
                    <span>${escapeHtml(h.name)}</span>
                  </div>
                `).join('')}

                <!-- Desktop Event Chips Container -->
                <div class="day-events-container desktop-only">
                  <!-- Starting Releases -->
                  ${startingReleases.map(rel => {
                    const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
                    return `
                      <div class="cal-event-chip event-start status-${statusSlug}" data-release-id="${rel.id}" title="${escapeHtml(rel.name)} (Start Date)">
                        <span class="chip-dot"></span>
                        <span class="chip-text"><strong>Start:</strong> ${escapeHtml(rel.name)}</span>
                      </div>
                    `;
                  }).join('')}

                  <!-- Target Deploy Releases -->
                  ${targetReleases.map(rel => {
                    const statusSlug = (rel.status || '').toLowerCase().replace(/\s+/g, '-');
                    const hasConflict = rel.holidayConflict && rel.holidayConflict.startsWith('Conflict:');
                    return `
                      <div class="cal-event-chip event-target status-${statusSlug} ${hasConflict ? 'conflict-glow' : ''}" data-release-id="${rel.id}" title="${escapeHtml(rel.name)} (Target Deploy) ${hasConflict ? '⚠️ ' + escapeHtml(rel.holidayConflict) : ''}">
                        <span class="chip-dot"></span>
                        <span class="chip-text">
                          ${hasConflict ? '⚠️ ' : ''}<strong>Deploy:</strong> ${escapeHtml(rel.name)}
                        </span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Mobile/Tablet Selected Day Inspector Sheet -->
      ${inspectedDay ? `
        <div class="day-inspector-sheet card">
          <div class="inspector-header">
            <div>
              <span class="card-eyebrow">DAY SCHEDULE</span>
              <h3 class="inspector-date">${formatFullDate(inspectedDay.date)}</h3>
            </div>
            <div class="inspector-actions">
              <button class="btn btn-sm btn-primary" id="btn-add-rel-on-day" data-date="${inspectedDay.date}">
                + Add Release
              </button>
              <button class="btn-icon-subtle" id="btn-close-inspector">&times;</button>
            </div>
          </div>

          <div class="inspector-content">
            ${inspectedDay.holidays.length > 0 ? `
              <div class="inspector-holiday-alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-warning"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                <div>
                  <strong>Public Holiday: ${escapeHtml(inspectedDay.holidays.map(h => h.name).join(', '))}</strong>
                  <p class="text-xs text-muted">Deployments prohibited on this date.</p>
                </div>
              </div>
            ` : ''}

            ${inspectedDay.starts.length === 0 && inspectedDay.targets.length === 0 && inspectedDay.holidays.length === 0 ? `
              <p class="text-muted text-sm py-2">No release milestones scheduled on this date.</p>
            ` : ''}

            ${inspectedDay.targets.map(rel => `
              <div class="inspector-rel-item" data-release-id="${rel.id}">
                <div class="item-left">
                  <span class="badge-role deploy-role">TARGET DEPLOY</span>
                  <strong>${escapeHtml(rel.name)}</strong>
                  <span class="text-xs text-muted">${rel.platform} · ${rel.stage} · Dev: ${rel.developer || 'Unassigned'}</span>
                </div>
                <button class="btn btn-sm btn-secondary open-detail-btn" data-release-id="${rel.id}">View</button>
              </div>
            `).join('')}

            ${inspectedDay.starts.map(rel => `
              <div class="inspector-rel-item" data-release-id="${rel.id}">
                <div class="item-left">
                  <span class="badge-role start-role">START DATE</span>
                  <strong>${escapeHtml(rel.name)}</strong>
                  <span class="text-xs text-muted">${rel.platform} · ${rel.stage} · Dev: ${rel.developer || 'Unassigned'}</span>
                </div>
                <button class="btn btn-sm btn-secondary open-detail-btn" data-release-id="${rel.id}">View</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  setupCalendarEvents(container);
}

function setupCalendarEvents(container) {
  const mSelect = container.querySelector('#cal-month-select');
  const ySelect = container.querySelector('#cal-year-select');

  mSelect?.addEventListener('change', (e) => {
    window._calState.month = parseInt(e.target.value, 10);
    renderCalendarView(container);
  });

  ySelect?.addEventListener('change', (e) => {
    window._calState.year = parseInt(e.target.value, 10);
    renderCalendarView(container);
  });

  container.querySelector('#cal-prev-month')?.addEventListener('click', () => {
    if (window._calState.month === 1) {
      window._calState.month = 12;
      window._calState.year -= 1;
    } else {
      window._calState.month -= 1;
    }
    renderCalendarView(container);
  });

  container.querySelector('#cal-next-month')?.addEventListener('click', () => {
    if (window._calState.month === 12) {
      window._calState.month = 1;
      window._calState.year += 1;
    } else {
      window._calState.month += 1;
    }
    renderCalendarView(container);
  });

  container.querySelector('#cal-today-btn')?.addEventListener('click', () => {
    const today = new Date();
    window._calState.month = today.getMonth() + 1;
    window._calState.year = today.getFullYear();
    renderCalendarView(container);
  });

  container.querySelector('#btn-cal-new-release')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
  });

  // Event chip click opens detail
  container.querySelectorAll('.cal-event-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(chip.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });

  // Day cell click:
  // On mobile (< 768px), it selects the day and shows inspector sheet.
  // On desktop (>= 768px), it opens new release modal prefilled with that date.
  container.querySelectorAll('.calendar-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      if (!date) return;

      if (window.innerWidth <= 768) {
        window._calState.selectedDayDate = date;
        renderCalendarView(container);
      } else {
        window.dispatchEvent(new CustomEvent('open-release-modal', {
          detail: { mode: 'create', defaultDate: date }
        }));
      }
    });
  });

  // Inspector handlers
  container.querySelector('#btn-close-inspector')?.addEventListener('click', () => {
    window._calState.selectedDayDate = null;
    renderCalendarView(container);
  });

  container.querySelector('#btn-add-rel-on-day')?.addEventListener('click', (e) => {
    const date = e.currentTarget.dataset.date;
    window.dispatchEvent(new CustomEvent('open-release-modal', {
      detail: { mode: 'create', defaultDate: date }
    }));
  });

  container.querySelectorAll('.open-detail-btn, .inspector-rel-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = parseInt(el.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
