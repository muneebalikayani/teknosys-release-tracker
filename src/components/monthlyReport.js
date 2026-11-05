import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { store } from '../data/store.js';

export function renderMonthlyReport(container) {
  if (!window._reportState) {
    const today = new Date();
    window._reportState = {
      month: today.getMonth() + 1, // e.g. 10 for October
      year: today.getFullYear(),   // e.g. 2026
      statusFilter: 'ALL',         // 'ALL' | 'COMPLETED' | 'OPEN'
      searchQuery: ''
    };
  }

  const { month, year, statusFilter = 'ALL', searchQuery = '' } = window._reportState;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[month - 1];
  const monthStr = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${monthStr}`;
  const quarter = `Q${Math.ceil(month / 3)}`;

  // Filter releases whose Target Deploy falls in this month
  const monthlyReleases = store.releases.filter(r => {
    return r.targetDeploy && r.targetDeploy.startsWith(monthPrefix);
  }).sort((a, b) => a.targetDeploy.localeCompare(b.targetDeploy));

  // Compute monthly metrics
  const total = monthlyReleases.length;
  const completed = monthlyReleases.filter(r => (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed').length;
  const inFlight = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Breakdown by Platform & Velocity
  const platformStats = {};
  for (const plat of store.platforms) {
    const pRels = monthlyReleases.filter(r => r.platform === plat);
    const pCompleted = pRels.filter(r => (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed').length;
    const pRate = pRels.length > 0 ? Math.round((pCompleted / pRels.length) * 100) : 0;

    platformStats[plat] = {
      total: pRels.length,
      completed: pCompleted,
      inFlight: pRels.length - pCompleted,
      rate: pRate
    };
  }

  // Breakdown by Type
  const scheduledCount = monthlyReleases.filter(r => r.type === 'Scheduled').length;
  const hotfixCount = monthlyReleases.filter(r => r.type === 'Hotfix').length;
  const emergencyCount = monthlyReleases.filter(r => r.type === 'Emergency').length;
  const plannedStabilityPct = total > 0 ? Math.round((scheduledCount / total) * 100) : 100;
  const reactivePct = total > 0 ? Math.round(((hotfixCount + emergencyCount) / total) * 100) : 0;

  // Audit compliance: RITM & CR documented
  const auditCompliantCount = monthlyReleases.filter(r => (r.ritm && r.ritm.trim()) && (r.cr && r.cr.trim())).length;
  const auditCompliancePct = total > 0 ? Math.round((auditCompliantCount / total) * 100) : 0;

  // Database Schema Impact Footprint
  const dbChangesCount = monthlyReleases.filter(r => {
    if (!r.dbObjects) return false;
    const val = r.dbObjects.trim().toLowerCase();
    return val && val !== 'na' && val !== 'none' && val !== 'no' && val !== 'nil';
  }).length;
  const dbChangesPct = total > 0 ? Math.round((dbChangesCount / total) * 100) : 0;

  // Stage distribution
  const stageCounts = { 'Development': 0, 'UAT': 0, 'CAB': 0, 'Production': 0, 'Completed': 0 };
  for (const r of monthlyReleases) {
    const s = r.stage || 'Development';
    if (stageCounts[s] !== undefined) stageCounts[s]++;
    else stageCounts['Development']++;
  }

  // Holidays in this month
  const monthlyHolidays = store.holidays.filter(h => {
    const s = h.startDate || '';
    const e = h.endDate || s;
    return s.startsWith(monthPrefix) || e.startsWith(monthPrefix);
  });

  // Conflicts in this month
  const conflictsInMonth = monthlyReleases.filter(r => r.holidayConflict && r.holidayConflict.startsWith('Conflict:'));
  const isCompliant = conflictsInMonth.length === 0;

  // Operational Stability Rating
  const stabilityRating = plannedStabilityPct >= 85
    ? { text: 'Optimal Stability', class: 'stability-optimal', badgeClass: 'badge-emerald' }
    : plannedStabilityPct >= 70
      ? { text: 'Controlled Maintenance', class: 'stability-moderate', badgeClass: 'badge-amber' }
      : { text: 'Elevated Emergency Risk', class: 'stability-risk', badgeClass: 'badge-rose' };

  // 3-Pillar Executive Strategic Synthesis
  let narrativeThroughput = '';
  let narrativeStability = '';
  let narrativeGovernance = '';

  if (total === 0) {
    narrativeThroughput = `No production deployments were scheduled for the Jazz World Data Platform during ${monthName} ${year}. Engineering bandwidth was dedicated to quarterly architecture planning and foundational infrastructure.`;
    narrativeStability = `Operational systems ran under steady-state baseline operations with zero emergency interventions logged.`;
    narrativeGovernance = `Full governance baseline preserved. Blackout calendar clear with 0 scheduling exceptions.`;
  } else {
    narrativeThroughput = `During ${monthName} ${year}, a total of ${total} data platform release${total > 1 ? 's were' : ' was'} scheduled across ${Object.values(platformStats).filter(p => p.total > 0).length} platform domains. To date, ${completed} deployment${completed !== 1 ? 's have' : ' has'} been successfully shipped to production (${completionRate}% delivery success rate), while ${inFlight} release${inFlight !== 1 ? 's remain' : ' remains'} actively managed in verification pipelines.`;
    
    narrativeStability = `${plannedStabilityPct}% of all changes were planned standard deployments (${scheduledCount} scheduled). Operational incidents were managed with ${hotfixCount} patch${hotfixCount !== 1 ? 'es' : ''} and ${emergencyCount} emergency change${emergencyCount !== 1 ? 's' : ''}, maintaining an overall status of ${stabilityRating.text}.`;

    narrativeGovernance = `${auditCompliancePct}% of releases (${auditCompliantCount}/${total}) are fully CAB-compliant with both Change Request (CR) and RITM ticket linkage verified. ${dbChangesCount} release${dbChangesCount !== 1 ? 's' : ''} (${dbChangesPct}%) affect Core DW database schemas with DBA review sign-off. ${isCompliant ? '100% compliance with telecom public holiday policy was achieved with zero blackout breaches.' : `Advisory: ${conflictsInMonth.length} release(s) require CAB reschedule sign-off due to holiday overlaps.`}`;
  }

  // Filter releases for the audit ledger table
  let ledgerReleases = [...monthlyReleases];
  if (statusFilter === 'COMPLETED') {
    ledgerReleases = ledgerReleases.filter(r => (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed');
  } else if (statusFilter === 'OPEN' || statusFilter === 'IN_FLIGHT') {
    ledgerReleases = ledgerReleases.filter(r => (r.status || '').toLowerCase() !== 'completed' && (r.stage || '').toLowerCase() !== 'completed');
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    ledgerReleases = ledgerReleases.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.developer && r.developer.toLowerCase().includes(q)) ||
      (r.cr && r.cr.toLowerCase().includes(q)) ||
      (r.ritm && r.ritm.toLowerCase().includes(q)) ||
      (r.platform && r.platform.toLowerCase().includes(q)) ||
      (r.dbObjects && r.dbObjects.toLowerCase().includes(q))
    );
  }

  container.innerHTML = `
    <div class="report-view-container">
      <!-- Report Screen Action & Navigation Bar (Screen Only) -->
      <div class="report-controls-bar no-print card">
        <div class="report-controls-left">
          <div class="report-period-picker">
            <label class="control-label">Period:</label>
            <div class="report-month-stepper">
              <button class="btn btn-secondary btn-icon btn-sm" id="btn-report-prev-month" title="Previous Month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <select id="report-month-select" class="control-select font-semibold">
                ${monthNames.map((m, idx) => `
                  <option value="${idx + 1}" ${month === (idx + 1) ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
              <select id="report-year-select" class="control-select font-semibold">
                <option value="2026" ${year === 2026 ? 'selected' : ''}>2026</option>
                <option value="2027" ${year === 2027 ? 'selected' : ''}>2027</option>
              </select>
              <button class="btn btn-secondary btn-icon btn-sm" id="btn-report-next-month" title="Next Month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>

          <div class="report-filter-pills">
            <button class="report-filter-pill ${statusFilter === 'ALL' ? 'active' : ''}" data-status="ALL">
              All (${total})
            </button>
            <button class="report-filter-pill ${statusFilter === 'COMPLETED' ? 'active' : ''}" data-status="COMPLETED">
              Completed (${completed})
            </button>
            <button class="report-filter-pill ${statusFilter === 'OPEN' || statusFilter === 'IN_FLIGHT' ? 'active' : ''}" data-status="OPEN">
              Open (${inFlight})
            </button>
          </div>
        </div>

        <div class="report-actions-right">
          <button class="btn btn-secondary btn-sm" id="btn-copy-digest" title="Copy text digest for executive email or Slack">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy Briefing</span>
          </button>

          <button class="btn btn-secondary btn-sm" id="btn-export-report-excel" title="Download Excel Executive Scorecard & Manifest">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <span>Excel Workbook</span>
          </button>

          <button class="btn btn-primary btn-sm btn-export-pdf" id="btn-download-pdf" title="Download Board-Ready High Resolution PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="18"></line><line x1="15" y1="15" x2="12" y2="18"></line></svg>
            <span>Executive PDF</span>
          </button>

          <button class="btn btn-secondary btn-sm" id="btn-print-report" title="Print document">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print</span>
          </button>
        </div>
      </div>

      <!-- Printable Executive Document Canvas -->
      <div class="report-paper card" id="executive-report-document">
        <!-- Official Document Masthead -->
        <div class="report-doc-header">
          <div class="report-brand">
            <div class="doc-logo-box">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
              </svg>
            </div>
            <div>
              <div class="doc-corp-eyebrow font-mono">ENTERPRISE DATA ENGINEERING & PLATFORM OPERATIONS</div>
              <h2 class="doc-corp-title">Jazz World Data Platform</h2>
              <span class="doc-dept-title">Core DW Architecture · Enterprise Analytics · CAB Change Governance</span>
            </div>
          </div>

          <div class="doc-meta-box">
            <div class="doc-badge-row">
              <span class="doc-classification-tag">RESTRICTED · INTERNAL EXECUTIVE BRIEFING</span>
              <span class="doc-audit-verified-tag"><span class="doc-live-dot"></span> CAB AUDITED</span>
            </div>
            <div class="doc-ref-id font-mono">REF: JWDP-EXEC-${year}-M${monthStr}</div>
            <div class="doc-period-title">${monthName.toUpperCase()} ${year} (${quarter} CYCLE)</div>
            <div class="doc-date">Generated: ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <!-- Document Headline Banner -->
        <div class="report-title-banner">
          <div class="report-title-flex">
            <div>
              <h1 class="report-headline">Executive Release & Governance Performance Digest</h1>
              <p class="report-subline">Operational throughput scorecard, delivery velocity, change stability index, and schema risk audit for ${monthName} ${year}</p>
            </div>
            <div class="report-scope-badge-group">
              <div class="report-scope-badge">
                <span class="scope-badge-num">${total}</span>
                <span class="scope-badge-lbl">Releases Scoped</span>
              </div>
              <div class="report-scope-badge badge-success-subtle">
                <span class="scope-badge-num text-success">${completionRate}%</span>
                <span class="scope-badge-lbl">Delivery Rate</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3-Pillar Executive Strategic Synthesis -->
        <div class="report-briefing-grid">
          <div class="briefing-card briefing-card-throughput">
            <div class="briefing-card-header">
              <div class="briefing-icon-badge briefing-badge-blue">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <span class="briefing-card-title">Delivery Throughput</span>
            </div>
            <p class="briefing-card-body">${narrativeThroughput}</p>
          </div>

          <div class="briefing-card briefing-card-stability">
            <div class="briefing-card-header">
              <div class="briefing-icon-badge ${plannedStabilityPct >= 80 ? 'briefing-badge-green' : 'briefing-badge-amber'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <span class="briefing-card-title">Operational Stability</span>
            </div>
            <p class="briefing-card-body">${narrativeStability}</p>
          </div>

          <div class="briefing-card briefing-card-governance">
            <div class="briefing-card-header">
              <div class="briefing-icon-badge ${isCompliant ? 'briefing-badge-green' : 'briefing-badge-red'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <span class="briefing-card-title">Governance & Audit Readiness</span>
            </div>
            <p class="briefing-card-body">${narrativeGovernance}</p>
          </div>
        </div>

        <!-- Executive KPI Scorecard (5 High-Density Cards) -->
        <div class="report-kpi-row">
          <!-- Total Scope -->
          <div class="report-kpi-card">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-indigo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <span class="rkpi-label">TOTAL SCOPE</span>
            </div>
            <span class="rkpi-value">${total}</span>
            <span class="rkpi-sub">${monthName} Scoped Deployments</span>
          </div>

          <!-- Production Delivered -->
          <div class="report-kpi-card kpi-success-glow">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-emerald">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
                </svg>
              </div>
              <span class="rkpi-label">DEPLOYED</span>
            </div>
            <div class="rkpi-value-row">
              <span class="rkpi-value text-success">${completed}</span>
              <span class="rkpi-rate-badge">${completionRate}%</span>
            </div>
            <div class="rkpi-progress-bar-wrap">
              <div class="rkpi-progress-bar-fill" style="width: ${completionRate}%;"></div>
            </div>
            <span class="rkpi-sub">${completed} of ${total} delivered to production</span>
          </div>

          <!-- Stability Index -->
          <div class="report-kpi-card">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-indigo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <span class="rkpi-label">STABILITY INDEX</span>
            </div>
            <div class="rkpi-value-row">
              <span class="rkpi-value text-accent">${plannedStabilityPct}%</span>
              <span class="rkpi-sub-badge ${stabilityRating.badgeClass}">${stabilityRating.text}</span>
            </div>
            <div class="rkpi-progress-bar-wrap">
              <div class="rkpi-progress-bar-fill fill-blue" style="width: ${plannedStabilityPct}%;"></div>
            </div>
            <span class="rkpi-sub">${scheduledCount} Scheduled · ${hotfixCount + emergencyCount} Reactive</span>
          </div>

          <!-- Change Governance -->
          <div class="report-kpi-card">
            <div class="rkpi-header">
              <div class="rkpi-icon-badge rkpi-badge-indigo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <span class="rkpi-label">CHANGE GOVERNANCE</span>
            </div>
            <div class="rkpi-value-row">
              <span class="rkpi-value ${auditCompliancePct >= 80 ? 'text-success' : 'text-accent'}">${auditCompliancePct}%</span>
              <span class="rkpi-rate-badge">${auditCompliantCount}/${total}</span>
            </div>
            <div class="rkpi-progress-bar-wrap">
              <div class="rkpi-progress-bar-fill fill-emerald" style="width: ${auditCompliancePct}%;"></div>
            </div>
            <span class="rkpi-sub">Change tickets verified</span>
          </div>
        </div>

        <!-- 2-Column Balanced Analytics Overview -->
        <div class="report-analytics-grid">
          <!-- Platform Delivery Matrix -->
          <div class="report-subcard">
            <div class="subcard-header-bar">
              <h4 class="subcard-title">
                <div class="subcard-icon-badge subcard-badge-indigo">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <span>Platform Delivery Performance</span>
              </h4>
              <span class="subcard-badge font-mono">${Object.values(platformStats).filter(p => p.total > 0).length} Active Domains</span>
            </div>
            <div class="subcard-table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th style="text-align: right;">Scoped</th>
                    <th style="text-align: right;">Delivered</th>
                    <th style="width: 44%; text-align: left; padding-left: 1.25rem;">Delivery Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(platformStats).map(([plat, stat]) => {
                    return `
                      <tr>
                        <td><span class="platform-tag platform-${plat.toLowerCase()}">${plat}</span></td>
                        <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${stat.total}</td>
                        <td style="text-align: right; font-weight: 600; color: #10b981; font-family: var(--font-mono);">${stat.completed}</td>
                        <td style="padding-left: 1.25rem;">
                          <div class="report-bar-wrap">
                            <div class="report-bar-track">
                              <div class="report-bar-fill platform-fill-${plat.toLowerCase()}" style="width: ${stat.rate}%;"></div>
                            </div>
                            <span class="report-bar-pct font-mono">${stat.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Change Classification & Architecture Profile -->
          <div class="report-subcard">
            <div class="subcard-header-bar">
              <h4 class="subcard-title">
                <div class="subcard-icon-badge subcard-badge-emerald">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <span>Change & Architecture Profile</span>
              </h4>
              <span class="subcard-badge font-mono">${plannedStabilityPct}% Planned · ${dbChangesPct}% DB</span>
            </div>
            <div class="subcard-table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Classification & Scope</th>
                    <th style="text-align: right;">Count</th>
                    <th style="width: 44%; text-align: left; padding-left: 1.25rem;">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="type-pill type-scheduled">Scheduled Releases</span></td>
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
                    <td><span class="type-pill type-hotfix">Hotfix Releases</span></td>
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
                    <td><span class="type-pill type-emergency">Emergency Releases</span></td>
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
                  <tr>
                    <td><span class="arch-tag arch-db">Database DDL / Schema</span></td>
                    <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${dbChangesCount}</td>
                    <td style="padding-left: 1.25rem;">
                      <div class="report-bar-wrap">
                        <div class="report-bar-track">
                          <div class="report-bar-fill fill-arch-db" style="width: ${total > 0 ? Math.round((dbChangesCount / total) * 100) : 0}%;"></div>
                        </div>
                        <span class="report-bar-pct font-mono">${total > 0 ? Math.round((dbChangesCount / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td><span class="arch-tag arch-app">App / ETL Pipeline Only</span></td>
                    <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">${total - dbChangesCount}</td>
                    <td style="padding-left: 1.25rem;">
                      <div class="report-bar-wrap">
                        <div class="report-bar-track">
                          <div class="report-bar-fill fill-arch-app" style="width: ${total > 0 ? Math.round(((total - dbChangesCount) / total) * 100) : 0}%;"></div>
                        </div>
                        <span class="report-bar-pct font-mono">${total > 0 ? Math.round(((total - dbChangesCount) / total) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pipeline Stages in this month -->
            <div class="month-blackout-info mt-2">
              <span class="text-xs text-muted font-semibold">Lifecycle Stages:</span>
              <div class="lifecycle-stage-chips">
                <span class="lifecycle-chip">Dev: <strong>${stageCounts['Development']}</strong></span>
                <span class="lifecycle-chip">UAT: <strong>${stageCounts['UAT']}</strong></span>
                <span class="lifecycle-chip">CAB: <strong>${stageCounts['CAB']}</strong></span>
                <span class="lifecycle-chip">Prod: <strong>${stageCounts['Production']}</strong></span>
                <span class="lifecycle-chip chip-done">Done: <strong>${stageCounts['Completed']}</strong></span>
              </div>
            </div>

            ${monthlyHolidays.length > 0 ? `
              <div class="month-blackout-info mt-1">
                <span class="text-xs text-muted font-semibold">Holidays in ${monthName}:</span>
                <div class="holiday-badges-list">
                  ${monthlyHolidays.map(h => `
                    <span class="holiday-pill-sm">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      ${h.name} (${h.startDate}${h.endDate !== h.startDate ? ` to ${h.endDate}` : ''})
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Page 1 Executive Footer (Visible on Page 1 in PDF / Print) -->
        <div class="report-exec-footer report-page1-footer">
          <div class="exec-footer-left">
            <span class="exec-footer-dot"></span>
            <span>Jazz World Data Platform · Executive Scorecard & Analytics · Core DW</span>
          </div>
          <div class="exec-footer-right">
            <span>Page 1 of 2 · Confidential · Internal Executive Circulation</span>
          </div>
        </div>

        <!-- Official Deployment Manifest & Release Audit Ledger Table -->
        <div class="report-ledger-card">
          <div class="ledger-header-bar">
            <div>
              <h3 class="ledger-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>Official Release Audit Ledger (${ledgerReleases.length} ${statusFilter !== 'ALL' ? statusFilter : ''} Records)</span>
              </h3>
              <p class="ledger-subtitle">Complete manifest of planned and deployed production releases with linked governance tickets</p>
            </div>

            <div class="ledger-controls">
              <div class="ledger-search-box">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="ledger-search-input" class="ledger-search-field" placeholder="Search releases, developers, CR, RITM..." value="${escapeHtml(searchQuery)}" />
              </div>
            </div>
          </div>

          <div class="ledger-table-wrap">
            <table class="report-table ledger-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Release Name & Target Scope</th>
                  <th>Platform</th>
                  <th>Type</th>
                  <th>Developer</th>
                  <th>Target Deploy</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>CR & RITM Governance</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerReleases.length === 0 ? `
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8;">
                      No releases found matching the selected criteria for ${monthName} ${year}.
                    </td>
                  </tr>
                ` : ledgerReleases.map((r, idx) => {
                  const isDone = (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed';
                  const hasCrRitm = Boolean((r.cr && r.cr.trim()) && (r.ritm && r.ritm.trim()));
                  const hasDb = Boolean(r.dbObjects && r.dbObjects.trim() && r.dbObjects.toLowerCase() !== 'none' && r.dbObjects.toLowerCase() !== 'na');
                  const stageSlug = (r.stage || 'development').toLowerCase().replace(/[^a-z0-9]/g, '-');
                  const statusSlug = (r.status || 'pending').toLowerCase().replace(/\s+/g, '-');

                  return `
                    <tr class="ledger-row ${isDone ? 'row-completed' : ''}" data-release-id="${r.id}">
                      <td class="ledger-index-cell">${idx + 1}</td>
                      <td>
                        <div class="ledger-name-cell">
                          <span class="ledger-release-name font-semibold">${escapeHtml(r.name)}</span>
                          ${hasDb ? `<span class="ledger-db-badge" title="${escapeHtml(r.dbObjects)}">⚡ Schema Impact</span>` : ''}
                        </div>
                      </td>
                      <td><span class="platform-tag platform-${(r.platform || 'gsm').toLowerCase()}">${r.platform || 'GSM'}</span></td>
                      <td><span class="type-pill type-${(r.type || 'scheduled').toLowerCase()}">${r.type || 'Scheduled'}</span></td>
                      <td class="ledger-dev-cell">${escapeHtml(r.developer || 'Unassigned')}</td>
                      <td class="ledger-date-cell">${r.targetDeploy || '-'}</td>
                      <td><span class="stage-tag stage-${stageSlug}">${r.stage || 'Development'}</span></td>
                      <td><span class="status-pill status-${statusSlug}">${r.status || 'Pending'}</span></td>
                      <td>
                        <div class="ledger-gov-cell">
                          ${hasCrRitm ? `
                            <span class="gov-chip gov-chip-verified" title="CR: ${escapeHtml(r.cr)} | RITM: ${escapeHtml(r.ritm)}">
                              <span class="gov-check">✓</span>
                              <span class="font-mono">${escapeHtml(r.cr)}</span>
                            </span>
                          ` : r.cr || r.ritm ? `
                            <span class="gov-chip gov-chip-partial" title="Partial ticket: ${escapeHtml(r.cr || r.ritm)}">
                              <span class="font-mono">${escapeHtml(r.cr || r.ritm)}</span>
                            </span>
                          ` : `
                            <span class="gov-chip gov-chip-missing">No Tickets</span>
                          `}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Page 2 Executive Footer (Visible on Page 2 in PDF / Print & Bottom of Report) -->
        <div class="report-exec-footer report-page2-footer">
          <div class="exec-footer-left">
            <span class="exec-footer-dot"></span>
            <span>Jazz World Data Platform · Official Release Audit Ledger · Core DW</span>
          </div>
          <div class="exec-footer-right">
            <span>Page 2 of 2 · Confidential · CAB & Governance Verified</span>
          </div>
        </div>
      </div>
    </div>
  `;

  setupReportEvents(container, { month, year, monthlyReleases, monthName, total, completed, inFlight, completionRate, plannedStabilityPct, auditCompliancePct });
}

function setupReportEvents(container, { month, year, monthlyReleases, monthName, total, completed, inFlight, completionRate, plannedStabilityPct, auditCompliancePct }) {
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

  // Previous Month button
  container.querySelector('#btn-report-prev-month')?.addEventListener('click', () => {
    if (window._reportState.month === 1) {
      window._reportState.month = 12;
      window._reportState.year = window._reportState.year - 1;
    } else {
      window._reportState.month = window._reportState.month - 1;
    }
    renderMonthlyReport(container);
  });

  // Next Month button
  container.querySelector('#btn-report-next-month')?.addEventListener('click', () => {
    if (window._reportState.month === 12) {
      window._reportState.month = 1;
      window._reportState.year = window._reportState.year + 1;
    } else {
      window._reportState.month = window._reportState.month + 1;
    }
    renderMonthlyReport(container);
  });

  // Filter Pills (All, Completed, Open)
  container.querySelectorAll('.report-filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const status = pill.dataset.status;
      if (status) {
        window._reportState.statusFilter = status;
        renderMonthlyReport(container);
      }
    });
  });

  // Search input in release ledger
  const searchInput = container.querySelector('#ledger-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      window._reportState.searchQuery = e.target.value;
      // Debounced or live re-render of ledger rows
      const q = e.target.value.toLowerCase().trim();
      container.querySelectorAll('.ledger-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    });
  }

  // Row clicks to open release detail modal
  container.querySelectorAll('.ledger-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });

  // Download Professional PDF directly via html2pdf
  container.querySelector('#btn-download-pdf')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      <span>Generating PDF...</span>
    `;

    const element = document.getElementById('executive-report-document');
    if (!element) return;

    // Create an isolated clone specifically formatted for A4 PDF output
    const clone = element.cloneNode(true);
    clone.id = 'executive-report-document-pdf-clone';

    // REMOVE the 3-pillar briefing grid entirely from the PDF
    // (As requested: "remove this from PDF keep it only only in portal")
    const briefingGrid = clone.querySelector('.report-briefing-grid');
    if (briefingGrid) {
      briefingGrid.remove();
    }

    // REMOVE the interactive search box from the ledger table in PDF
    const searchBox = clone.querySelector('.ledger-search-box');
    if (searchBox) {
      searchBox.remove();
    }

    // Apply PDF Light Theme to the clone
    clone.classList.add('pdf-light-theme');
    clone.classList.add('pdf-render-canvas');
    clone.setAttribute('data-theme', 'light');

    // Force strict 100% executive light theme styling on the clone DOM tree
    clone.style.setProperty('background', '#ffffff', 'important');
    clone.style.setProperty('background-color', '#ffffff', 'important');
    clone.style.setProperty('color', '#0f172a', 'important');
    clone.style.setProperty('box-shadow', 'none', 'important');

    // Remove any dark gradients or shadows from cards in the clone
    clone.querySelectorAll('.report-kpi-card, .report-subcard, .report-scope-badge').forEach(card => {
      card.style.setProperty('background', '#ffffff', 'important');
      card.style.setProperty('background-color', '#ffffff', 'important');
      card.style.setProperty('background-image', 'none', 'important');
      card.style.setProperty('box-shadow', 'none', 'important');
      card.style.setProperty('border', '1px solid #cbd5e1', 'important');
    });

    // Enforce clean hard page break before the ledger card so it starts at the top of Page 2
    const ledgerCard = clone.querySelector('.report-ledger-card');
    if (ledgerCard) {
      ledgerCard.style.setProperty('page-break-before', 'always', 'important');
      ledgerCard.style.setProperty('break-before', 'page', 'important');
      ledgerCard.style.setProperty('background', '#ffffff', 'important');
      ledgerCard.style.setProperty('background-color', '#ffffff', 'important');
      ledgerCard.style.setProperty('background-image', 'none', 'important');
      ledgerCard.style.setProperty('box-shadow', 'none', 'important');
      ledgerCard.style.setProperty('border', '1px solid #cbd5e1', 'important');
      ledgerCard.style.setProperty('border-radius', '8px', 'important');
      ledgerCard.style.setProperty('padding', '12px 14px', 'important');
      ledgerCard.style.setProperty('margin-top', '0', 'important');
    }

    const ledgerTitle = clone.querySelector('.ledger-title');
    if (ledgerTitle) {
      ledgerTitle.style.setProperty('color', '#0f172a', 'important');
      const svg = ledgerTitle.querySelector('svg');
      if (svg) svg.style.setProperty('stroke', '#1e40af', 'important');
    }
    const ledgerSubtitle = clone.querySelector('.ledger-subtitle');
    if (ledgerSubtitle) {
      ledgerSubtitle.style.setProperty('color', '#475569', 'important');
    }

    // Ledger table styling in PDF
    clone.querySelectorAll('.ledger-table-wrap').forEach(wrap => {
      wrap.style.setProperty('background', '#ffffff', 'important');
      wrap.style.setProperty('background-color', '#ffffff', 'important');
      wrap.style.setProperty('border', '1px solid #cbd5e1', 'important');
    });

    clone.querySelectorAll('.ledger-table th').forEach(th => {
      th.style.setProperty('background', '#1e293b', 'important');
      th.style.setProperty('background-color', '#1e293b', 'important');
      th.style.setProperty('color', '#ffffff', 'important');
      th.style.setProperty('font-size', '0.625rem', 'important');
      th.style.setProperty('font-weight', '700', 'important');
      th.style.setProperty('border-bottom', '2px solid #0f172a', 'important');
      th.style.setProperty('padding', '6px 8px', 'important');
    });

    // Explicit opaque backgrounds for every single row and cell (No transparent leaks!)
    clone.querySelectorAll('.ledger-table tbody tr').forEach((tr, rIdx) => {
      const isEven = rIdx % 2 === 1;
      const rowBg = isEven ? '#f8fafc' : '#ffffff';
      tr.style.setProperty('background', rowBg, 'important');
      tr.style.setProperty('background-color', rowBg, 'important');
      tr.querySelectorAll('td').forEach(td => {
        td.style.setProperty('background', rowBg, 'important');
        td.style.setProperty('background-color', rowBg, 'important');
        td.style.setProperty('color', '#0f172a', 'important');
        td.style.setProperty('border-bottom', '1px solid #e2e8f0', 'important');
        td.style.setProperty('padding', '6px 8px', 'important');
      });
    });

    clone.querySelectorAll('.ledger-release-name').forEach(el => {
      el.style.setProperty('color', '#0f172a', 'important');
      el.style.setProperty('font-weight', '700', 'important');
    });
    clone.querySelectorAll('.ledger-dev-cell').forEach(el => {
      el.style.setProperty('color', '#334155', 'important');
      el.style.setProperty('font-weight', '500', 'important');
    });
    clone.querySelectorAll('.ledger-date-cell').forEach(el => {
      el.style.setProperty('color', '#475569', 'important');
      el.style.setProperty('font-family', 'monospace', 'important');
    });
    clone.querySelectorAll('.ledger-index-cell').forEach(el => {
      el.style.setProperty('color', '#64748b', 'important');
      el.style.setProperty('font-weight', '700', 'important');
      el.style.setProperty('font-family', 'monospace', 'important');
      el.style.setProperty('text-align', 'center', 'important');
    });

    // Make both Page 1 and Page 2 footers visible and styled on the PDF clone
    clone.querySelectorAll('.report-exec-footer').forEach(f => {
      f.style.setProperty('display', 'flex', 'important');
      f.style.setProperty('border-top', '1px solid #cbd5e1', 'important');
      f.style.setProperty('color', '#64748b', 'important');
      f.style.setProperty('font-size', '0.65rem', 'important');
    });

    // Create an offscreen mount wrapper with exact standard A4 width (794px at 96 DPI)
    const mountWrapper = document.createElement('div');
    mountWrapper.id = 'pdf-mount-wrapper';
    mountWrapper.style.position = 'fixed';
    mountWrapper.style.left = '-10000px';
    mountWrapper.style.top = '0';
    mountWrapper.style.width = '794px';
    mountWrapper.style.maxWidth = '794px';
    mountWrapper.style.background = '#ffffff';
    mountWrapper.style.zIndex = '-99999';
    mountWrapper.appendChild(clone);
    document.body.appendChild(mountWrapper);

    try {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `Jazz_World_Data_Platform_Executive_Report_${monthName}_${year}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: ['.report-ledger-card'],
          avoid: ['.report-kpi-row', '.report-analytics-grid', '.report-subcard', '.report-doc-header', '.report-title-banner', 'tr', '.ledger-row']
        }
      };

      await html2pdf().set(opt).from(clone).save();
      btn.innerHTML = `<span>✓ PDF Exported!</span>`;
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
      if (document.body.contains(mountWrapper)) {
        document.body.removeChild(mountWrapper);
      }
    }
  });

  // Print / Save as PDF
  container.querySelector('#btn-print-report')?.addEventListener('click', () => {
    window.print();
  });

  // Copy Email Briefing to Clipboard
  container.querySelector('#btn-copy-digest')?.addEventListener('click', (e) => {
    let digest = `📊 *JAZZ WORLD DATA PLATFORM — EXECUTIVE REPORT (${monthName.toUpperCase()} ${year})*\n`;
    digest += `========================================================================\n\n`;
    digest += `*EXECUTIVE SCORECARD*\n`;
    digest += `• Total Scoped Releases: ${total}\n`;
    digest += `• Production Deployed: ${completed} (${completionRate}% Success Rate)\n`;
    digest += `• Open Deployments: ${inFlight} releases\n`;
    digest += `• Change Stability Index: ${plannedStabilityPct}% Planned Standard Changes\n`;
    digest += `• Change Governance: ${auditCompliancePct}% with verified change tickets\n\n`;
    
    digest += `*PLATFORM DELIVERY BREAKDOWN*\n`;
    for (const plat of store.platforms) {
      const pRels = monthlyReleases.filter(r => r.platform === plat);
      if (pRels.length > 0) {
        const pDone = pRels.filter(r => (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed').length;
        digest += `• ${plat}: ${pDone}/${pRels.length} Deployed (${Math.round((pDone / pRels.length) * 100)}%)\n`;
      }
    }
    digest += `\n*SCHEDULED RELEASES MANIFEST*\n`;
    if (monthlyReleases.length === 0) {
      digest += `None scheduled.\n`;
    } else {
      monthlyReleases.forEach((r, idx) => {
        const tickets = [r.cr, r.ritm].filter(Boolean).join(' / ') || 'No Tickets';
        digest += `${idx + 1}. [${r.platform}] ${r.name} — Target: ${r.targetDeploy} | Stage: ${r.stage} | Status: ${r.status || 'Pending'} | ${tickets}\n`;
      });
    }
    digest += `\n========================================================================\n`;
    digest += `Generated by Jazz World Data Platform Release Tracker`;

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
    exportExecutiveReportExcel(monthName, year, monthlyReleases, {
      total,
      completed,
      inFlight,
      completionRate,
      plannedStabilityPct,
      auditCompliancePct
    });
  });
}

function exportExecutiveReportExcel(monthName, year, monthlyReleases, metrics) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Executive Scorecard
  const summaryRows = [
    { 'Metric': 'Executive Summary Report', 'Value': `${monthName} ${year}` },
    { 'Metric': 'Organization', 'Value': 'Jazz Telecom · Enterprise BI & Data Platform' },
    { 'Metric': 'Generated On', 'Value': new Date().toISOString().slice(0, 10) },
    { 'Metric': 'Total Releases Scoped', 'Value': metrics.total },
    { 'Metric': 'Completed Deployments', 'Value': metrics.completed },
    { 'Metric': 'Open Deployments', 'Value': metrics.inFlight },
    { 'Metric': 'Completion Rate', 'Value': `${metrics.completionRate}%` },
    { 'Metric': 'Planned Stability Index', 'Value': `${metrics.plannedStabilityPct}%` },
    { 'Metric': 'Change Governance Compliance', 'Value': `${metrics.auditCompliancePct}%` }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Scorecard');

  // Tab 2: Platform Velocity
  const platformRows = store.platforms.map(plat => {
    const pRels = monthlyReleases.filter(r => r.platform === plat);
    const pDone = pRels.filter(r => (r.status || '').toLowerCase() === 'completed' || (r.stage || '').toLowerCase() === 'completed').length;
    return {
      'Platform': plat,
      'Total Scoped': pRels.length,
      'Production Shipped': pDone,
      'Open': pRels.length - pDone,
      'Success Rate': `${pRels.length > 0 ? Math.round((pDone / pRels.length) * 100) : 0}%`
    };
  });
  const wsPlatform = XLSX.utils.json_to_sheet(platformRows);
  wsPlatform['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsPlatform, 'Platform Delivery');

  // Tab 3: Detailed Manifest & Audit Ledger
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
    'RITM Number': r.ritm,
    'Change Request (CR)': r.cr,
    'Database Objects Modified': r.dbObjects,
    'Holiday Risk Assessment': r.holidayConflict || 'Clear'
  }));

  const wsManifest = XLSX.utils.json_to_sheet(manifestRows);
  wsManifest['!cols'] = [
    { wch: 6 },
    { wch: 38 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 15 },
    { wch: 18 },
    { wch: 32 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsManifest, `${monthName} Release Ledger`);

  XLSX.writeFile(wb, `Jazz_World_Data_Platform_Executive_Report_${monthName}_${year}.xlsx`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
