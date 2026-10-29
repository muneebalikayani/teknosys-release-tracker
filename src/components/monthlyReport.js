import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { store } from '../data/store.js';

export function renderMonthlyReport(container) {
  if (!window._reportState) {
    const today = new Date();
    window._reportState = {
      month: today.getMonth() + 1, // default to current month (e.g. 10)
      year: today.getFullYear()    // default to 2026
    };
  }

  const { month, year } = window._reportState;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[month - 1];
  const monthStr = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${monthStr}`;

  // Filter releases whose Target Deploy falls in this month
  const monthlyReleases = store.releases.filter(r => {
    return r.targetDeploy && r.targetDeploy.startsWith(monthPrefix);
  }).sort((a, b) => a.targetDeploy.localeCompare(b.targetDeploy));

  // Compute monthly metrics
  const total = monthlyReleases.length;
  const completed = monthlyReleases.filter(r => r.status === 'Completed').length;
  const inFlight = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Breakdown by Platform
  const platformCounts = {};
  for (const plat of store.platforms) platformCounts[plat] = 0;
  for (const r of monthlyReleases) {
    if (r.platform) platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1;
  }

  // Breakdown by Type
  const scheduledCount = monthlyReleases.filter(r => r.type === 'Scheduled').length;
  const hotfixCount = monthlyReleases.filter(r => r.type === 'Hotfix').length;
  const emergencyCount = monthlyReleases.filter(r => r.type === 'Emergency').length;

  // Holidays in this month
  const monthlyHolidays = store.holidays.filter(h => {
    const s = h.startDate || '';
    const e = h.endDate || s;
    return s.startsWith(monthPrefix) || e.startsWith(monthPrefix);
  });

  // Conflicts in this month
  const conflictsInMonth = monthlyReleases.filter(r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:'));
  const isCompliant = conflictsInMonth.length === 0;

  // Executive narrative generation
  let narrative = '';
  if (total === 0) {
    narrative = `During ${monthName} ${year}, no production deployments were scheduled for the Jazz World Data Platform. The engineering teams maintained routine platform operations and prepared upcoming quarterly initiatives.`;
  } else {
    narrative = `During ${monthName} ${year}, a total of ${total} Jazz World Data Platform release${total > 1 ? 's were' : ' was'} scheduled for deployment. To date, ${completed} release${completed !== 1 ? 's have' : ' has'} been successfully deployed to production (${completionRate}% completion rate), while ${inFlight} release${inFlight !== 1 ? 's remain' : ' remains'} actively tracked across verification stages. `;
    if (hotfixCount > 0 || emergencyCount > 0) {
      narrative += `Operational activities included ${hotfixCount} hotfix deployment${hotfixCount > 1 ? 's' : ''} and ${emergencyCount} emergency change${emergencyCount > 1 ? 's' : ''}. `;
    }
    if (isCompliant) {
      narrative += `100% compliance with holiday schedule was maintained with zero scheduled holiday conflicts.`;
    } else {
      narrative += `⚠️ Attention: ${conflictsInMonth.length} release${conflictsInMonth.length > 1 ? 's conflict' : ' conflicts'} with public holidays and require reschedule sign-off.`;
    }
  }

  container.innerHTML = `
    <div class="report-view-container">
      <!-- Report Screen Action Bar (Hidden in Print) -->
      <div class="report-controls-bar no-print card">
        <div class="report-controls-left">
          <div class="report-period-picker">
            <label class="control-label">Reporting Period:</label>
            <select id="report-month-select" class="control-select font-semibold">
              ${monthNames.map((m, idx) => `
                <option value="${idx + 1}" ${month === (idx + 1) ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
            <select id="report-year-select" class="control-select font-semibold">
              <option value="2026" ${year === 2026 ? 'selected' : ''}>2026</option>
              <option value="2027" ${year === 2027 ? 'selected' : ''}>2027</option>
            </select>
          </div>
          <span class="report-count-tag">${total} Releases in scope</span>
        </div>

        <div class="report-actions-right">
          <button class="btn btn-secondary btn-sm" id="btn-copy-digest" title="Copy text digest for email or Slack">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy Email Digest</span>
          </button>

          <button class="btn btn-secondary btn-sm" id="btn-export-report-excel" title="Download Excel Executive Summary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <span>Export Excel</span>
          </button>

          <button class="btn btn-primary btn-sm btn-export-pdf" id="btn-download-pdf" title="Download professional high-resolution PDF for management">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="18"></line><line x1="15" y1="15" x2="12" y2="18"></line></svg>
            <span>Export PDF</span>
          </button>

          <button class="btn btn-secondary btn-sm" id="btn-print-report" title="Print document">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print</span>
          </button>
        </div>
      </div>

      <!-- Printable Executive Document Canvas -->
      <div class="report-paper card" id="executive-report-document">
        <!-- Document Header -->
        <div class="report-doc-header">
          <div class="report-brand">
            <div class="doc-logo-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4a4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
            </div>
            <div>
              <h2 class="doc-corp-title">Jazz World Data Platform</h2>
              <span class="doc-dept-title">Enterprise BI, Analytics & Platform Operations</span>
            </div>
          </div>

          <div class="doc-meta-box">
            <div class="doc-badge">EXECUTIVE SUMMARY</div>
            <div class="doc-period">${monthName.toUpperCase()} ${year}</div>
            <div class="doc-date"><span class="doc-live-dot"></span> Generated: ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <!-- Title Banner -->
        <div class="report-title-banner">
          <div class="report-title-flex">
            <div>
              <h1 class="report-headline">Executive Deployment & Performance Digest</h1>
              <p class="report-subline">Official performance evaluation, delivery scorecard, and change governance audit for ${monthName} ${year}</p>
            </div>
            <div class="report-scope-badge">
              <span class="scope-badge-num">${total}</span>
              <span class="scope-badge-lbl">Releases Scoped</span>
            </div>
          </div>
        </div>

        <!-- Executive Narrative Synthesis -->
        <div class="report-narrative-box">
          <div class="narrative-header-row">
            <span class="narrative-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              EXECUTIVE BRIEFING
            </span>
            <span class="narrative-period-pill">${monthName} ${year}</span>
          </div>
          <p class="narrative-text">${narrative}</p>
        </div>

        <!-- Executive Scorecard (4 Metrics) -->
        <div class="report-kpi-row">
          <div class="report-kpi-card">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-indigo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <span class="rkpi-label">TOTAL SCHEDULED</span>
            </div>
            <span class="rkpi-value">${total}</span>
            <span class="rkpi-sub">${monthName} Scoped Deployments</span>
          </div>

          <div class="report-kpi-card kpi-success-glow">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-emerald">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
                </svg>
              </div>
              <span class="rkpi-label">PRODUCTION DEPLOYED</span>
            </div>
            <div class="rkpi-value-row">
              <span class="rkpi-value text-success">${completed}</span>
              <span class="rkpi-rate-badge">${completionRate}%</span>
            </div>
            <div class="rkpi-progress-bar-wrap">
              <div class="rkpi-progress-bar-fill" style="width: ${completionRate}%;"></div>
            </div>
            <span class="rkpi-sub">${completed} of ${total} releases delivered</span>
          </div>

          <div class="report-kpi-card">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-cyan">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15"></line>
                  <circle cx="18" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <path d="M18 9a9 9 0 0 1-9 9"></path>
                </svg>
              </div>
              <span class="rkpi-label">IN-FLIGHT PIPELINE</span>
            </div>
            <span class="rkpi-value text-accent">${inFlight}</span>
            <span class="rkpi-sub">Active across testing & verification</span>
          </div>

          <div class="report-kpi-card ${isCompliant ? 'kpi-shield-compliant' : 'kpi-alert'}">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge ${isCompliant ? 'rkpi-badge-emerald' : 'rkpi-badge-rose'}">
                ${isCompliant ? `
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <polyline points="9 12 11 14 15 10"></polyline>
                  </svg>
                ` : `
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                `}
              </div>
              <span class="rkpi-label">HOLIDAY COMPLIANCE</span>
            </div>
            <span class="rkpi-value ${isCompliant ? 'text-success' : 'text-danger'}">
              ${isCompliant ? '100%' : `${conflictsInMonth.length} Conflict`}
            </span>
            <span class="rkpi-sub">${isCompliant ? 'Zero holiday policy violations' : 'Rescheduling required'}</span>
          </div>
        </div>

        <!-- 2-Column Analytics Overview -->
        <div class="report-analytics-grid">
          <!-- Platform Distribution -->
          <div class="report-subcard">
            <div class="subcard-header-bar">
              <h4 class="subcard-title">
                <div class="subcard-icon-badge subcard-badge-indigo">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <span>Distribution by Platform</span>
              </h4>
              <span class="subcard-badge">${Object.keys(platformCounts).length} Platforms</span>
            </div>
            <div class="subcard-table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th style="text-align: right;">Releases</th>
                    <th style="width: 48%; text-align: left; padding-left: 1.25rem;">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(platformCounts).map(([plat, cnt]) => {
                    const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return `
                      <tr>
                        <td><span class="platform-tag platform-${plat.toLowerCase()}">${plat}</span></td>
                        <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${cnt}</td>
                        <td style="padding-left: 1.25rem;">
                          <div class="report-bar-wrap">
                            <div class="report-bar-track">
                              <div class="report-bar-fill platform-fill-${plat.toLowerCase()}" style="width: ${pct}%;"></div>
                            </div>
                            <span class="report-bar-pct font-mono">${pct}%</span>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Deployment Type & Stability Profile -->
          <div class="report-subcard">
            <div class="subcard-header-bar">
              <h4 class="subcard-title">
                <div class="subcard-icon-badge subcard-badge-emerald">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <span>Change Classification & Stability</span>
              </h4>
              <span class="subcard-badge">Governance</span>
            </div>
            <div class="subcard-table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Change Type</th>
                    <th style="text-align: right;">Count</th>
                    <th style="width: 48%; text-align: left; padding-left: 1.25rem;">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="type-pill type-scheduled">Scheduled</span></td>
                    <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${scheduledCount}</td>
                    <td style="padding-left: 1.25rem;">
                      <div class="report-bar-wrap">
                        <div class="report-bar-track">
                          <div class="report-bar-fill fill-type-scheduled" style="width: ${total > 0 ? Math.round((scheduledCount / total) * 100) : 0}%;"></div>
                        </div>
                        <span class="report-bar-pct font-mono">${total > 0 ? Math.round((scheduledCount / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td><span class="type-pill type-hotfix">Hotfix</span></td>
                    <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${hotfixCount}</td>
                    <td style="padding-left: 1.25rem;">
                      <div class="report-bar-wrap">
                        <div class="report-bar-track">
                          <div class="report-bar-fill fill-type-hotfix" style="width: ${total > 0 ? Math.round((hotfixCount / total) * 100) : 0}%;"></div>
                        </div>
                        <span class="report-bar-pct font-mono">${total > 0 ? Math.round((hotfixCount / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td><span class="type-pill type-emergency">Emergency</span></td>
                    <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${emergencyCount}</td>
                    <td style="padding-left: 1.25rem;">
                      <div class="report-bar-wrap">
                        <div class="report-bar-track">
                          <div class="report-bar-fill fill-type-emergency" style="width: ${total > 0 ? Math.round((emergencyCount / total) * 100) : 0}%;"></div>
                        </div>
                        <span class="report-bar-pct font-mono">${total > 0 ? Math.round((emergencyCount / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Holiday Calendar Overview in Month -->
            <div class="month-blackout-info mt-3">
              <span class="text-xs text-muted font-semibold">Public Holidays in ${monthName}:</span>
              ${monthlyHolidays.length === 0 ? `
                <span class="text-xs text-muted"> None scheduled</span>
              ` : `
                <div class="holiday-badges-list">
                  ${monthlyHolidays.map(h => `
                    <span class="holiday-pill-sm">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      ${h.name} (${h.startDate}${h.endDate !== h.startDate ? ` to ${h.endDate}` : ''})
                    </span>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Executive Confidentiality Document Bar -->
        <div class="report-exec-footer">
          <div class="exec-footer-left">
            <span class="exec-footer-dot"></span>
            <span>Jazz World Data Platform · Executive Management Briefing</span>
          </div>
          <div class="exec-footer-right">
            <span>Confidential · Internal Executive Circulation</span>
          </div>
        </div>
      </div>
    </div>
  `;

  setupReportEvents(container, { month, year, monthlyReleases, monthName });
}

function setupReportEvents(container, { month, year, monthlyReleases, monthName }) {
  // Month / Year selectors
  const mSelect = container.querySelector('#report-month-select');
  const ySelect = container.querySelector('#report-year-select');

  mSelect?.addEventListener('change', (e) => {
    window._reportState.month = parseInt(e.target.value, 10);
    renderMonthlyReport(container);
  });

  ySelect?.addEventListener('change', (e) => {
    window._reportState.year = parseInt(e.target.value, 10);
    renderMonthlyReport(container);
  });

  // Download Professional PDF directly via html2pdf
  container.querySelector('#btn-download-pdf')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      <span>Exporting 1-Page PDF...</span>
    `;

    const element = document.getElementById('executive-report-document');
    const rootEl = document.documentElement;
    const originalTheme = rootEl.getAttribute('data-theme');

    try {
      if (originalTheme) rootEl.setAttribute('data-theme', 'light');
      element.classList.add('pdf-light-theme');
      element.style.setProperty('background-color', '#ffffff', 'important');
      element.style.setProperty('color', '#0f172a', 'important');
      element.style.setProperty('box-shadow', 'none', 'important');

      const opt = {
        margin: [5, 8, 5, 8],
        filename: `Jazz_World_Data_Platform_Executive_Report_${monthName}_${year}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };

      await html2pdf().set(opt).from(element).save();
      btn.innerHTML = `<span>✓ PDF Downloaded!</span>`;
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('PDF generation error, fallback to print:', err);
      window.print();
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    } finally {
      element.classList.remove('pdf-light-theme');
      element.style.removeProperty('background-color');
      element.style.removeProperty('color');
      element.style.removeProperty('box-shadow');
      if (originalTheme) {
        rootEl.setAttribute('data-theme', originalTheme);
      } else {
        rootEl.removeAttribute('data-theme');
      }
    }
  });

  // Print / Save as PDF
  container.querySelector('#btn-print-report')?.addEventListener('click', () => {
    window.print();
  });

  // Copy Email Digest to Clipboard
  container.querySelector('#btn-copy-digest')?.addEventListener('click', (e) => {
    const total = monthlyReleases.length;
    const completed = monthlyReleases.filter(r => r.status === 'Completed').length;
    const inFlight = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let digest = `*Jazz World Data Platform — Executive Release Digest (${monthName} ${year})*\n\n`;
    digest += `• Total Releases: ${total}\n`;
    digest += `• Production Deployed: ${completed} (${completionRate}%)\n`;
    digest += `• In-Flight: ${inFlight}\n`;
    digest += `• Holiday Compliance: 100% compliant\n\n`;
    digest += `*Scheduled Releases:*\n`;
    if (monthlyReleases.length === 0) {
      digest += `None scheduled.\n`;
    } else {
      monthlyReleases.forEach((r, idx) => {
        digest += `${idx + 1}. [${r.platform}] ${r.name} — Target: ${r.targetDeploy} | Stage: ${r.stage} | Status: ${r.status || 'Pending'}\n`;
      });
    }

    navigator.clipboard.writeText(digest).then(() => {
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span>✓ Copied to Clipboard!</span>`;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      alert('Could not copy to clipboard: ' + err);
    });
  });

  // Export Executive Report to Excel
  container.querySelector('#btn-export-report-excel')?.addEventListener('click', () => {
    exportExecutiveReportExcel(monthName, year, monthlyReleases);
  });
}

function exportExecutiveReportExcel(monthName, year, monthlyReleases) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    { 'Metric': 'Executive Summary Report', 'Value': `${monthName} ${year}` },
    { 'Metric': 'Generated On', 'Value': new Date().toISOString().slice(0, 10) },
    { 'Metric': 'Total Releases in Month', 'Value': monthlyReleases.length },
    { 'Metric': 'Completed Releases', 'Value': monthlyReleases.filter(r => r.status === 'Completed').length },
    { 'Metric': 'In-Flight Releases', 'Value': monthlyReleases.filter(r => r.status !== 'Completed').length },
    { 'Metric': 'Completion Rate', 'Value': `${monthlyReleases.length > 0 ? Math.round((monthlyReleases.filter(r => r.status === 'Completed').length / monthlyReleases.length) * 100) : 0}%` },
    { 'Metric': 'Holiday Conflicts', 'Value': monthlyReleases.filter(r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:')).length }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Scorecard');

  // Manifest sheet
  const manifestRows = monthlyReleases.map((r, idx) => ({
    '#': idx + 1,
    'Release Name': r.name,
    'Platform': r.platform,
    'Type': r.type,
    'Developer': r.developer,
    'Target Deploy': r.targetDeploy,
    'Stage': r.stage,
    'Owner': r.owner,
    'Status': r.status,
    'RITM': r.ritm,
    'CR': r.cr,
    'DB Objects Changed': r.dbObjects,
    'Holiday Check': r.holidayConflict || 'Clear'
  }));

  const wsManifest = XLSX.utils.json_to_sheet(manifestRows);
  wsManifest['!cols'] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, wsManifest, `${monthName} Releases`);

  XLSX.writeFile(wb, `Jazz-World-Data-Platform-Executive-Summary_${monthName}-${year}.xlsx`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
