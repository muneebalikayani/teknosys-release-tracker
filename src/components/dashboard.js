import { store } from '../data/store.js';

export function renderDashboard(container) {
  const isFiltered = store.dashboardFilter.month !== 'ALL';
  const selectedMonth = store.dashboardFilter.month;
  const selectedYear = store.dashboardFilter.year;

  const metrics = isFiltered 
    ? store.getMetrics(selectedMonth, selectedYear)
    : store.getMetrics();

  const analytics = isFiltered
    ? store.getAdvancedAnalytics(selectedMonth, selectedYear)
    : store.getAdvancedAnalytics();

  const conflictingReleases = store.getConflictingReleases();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthLabel = isFiltered 
    ? `${monthNames[selectedMonth - 1]} ${selectedYear}`
    : 'All Time Overview';

  const completionPct = Math.round(metrics.completionRate * 100);

  // Upcoming active non-completed releases sorted by target deploy (excluding On Hold and Pending items)
  const upcomingReleases = store.releases
    .filter(r => {
      if (!r.targetDeploy) return false;
      const status = (r.status || '').trim().toLowerCase();
      const stage = (r.stage || '').trim().toLowerCase();
      // Exclude completed, on hold, and pending items (including empty/unset status which defaults to Pending)
      if (!status || status === 'pending' || status === 'completed' || status === 'on hold') {
        return false;
      }
      if (stage === 'completed' || stage === 'on hold' || stage === 'pending') {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.targetDeploy.localeCompare(b.targetDeploy))
    .slice(0, 5);

  // Maximum monthly releases for scaling the bar chart
  const maxMonthTotal = Math.max(1, ...analytics.monthlyTrend.map(m => m.total));

  // Determine Stability rating badge
  const stabilityBadge = analytics.plannedStabilityPct >= 80
    ? { text: 'Optimal Control', class: 'stability-optimal', icon: '🟢' }
    : analytics.plannedStabilityPct >= 65
      ? { text: 'Moderate Hotfixes', class: 'stability-moderate', icon: '🟡' }
      : { text: 'Elevated Emergency Risk', class: 'stability-risk', icon: '🔴' };

  container.innerHTML = `
    <div class="dashboard-container">
      <!-- Dashboard Controls & Breadcrumb -->
      <div class="dashboard-header-bar">
        <div class="header-titles">
          <div class="header-badge">
            <span class="live-dot pulse"></span> LIVE TELECOM DW TRACKER
          </div>
          <h1 class="page-title">Executive Release Dashboard</h1>
          <p class="page-subtitle">Real-time status, platform distributions, velocity analytics & holiday conflict monitoring</p>
        </div>

        <div class="dashboard-filter-controls">
          <div class="segmented-control">
            <button class="seg-btn ${!isFiltered ? 'active' : ''}" id="dash-view-all">All Time</button>
            <button class="seg-btn ${isFiltered ? 'active' : ''}" id="dash-view-month">Monthly Filter</button>
          </div>

          ${isFiltered ? `
            <div class="date-pickers-group">
              <select id="dash-month-select" class="control-select">
                ${monthNames.map((m, idx) => `
                  <option value="${idx + 1}" ${selectedMonth === (idx + 1) ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
              <select id="dash-year-select" class="control-select">
                <option value="2026" ${selectedYear === 2026 ? 'selected' : ''}>2026</option>
                <option value="2027" ${selectedYear === 2027 ? 'selected' : ''}>2027</option>
              </select>
            </div>
          ` : ''}

          <button class="btn btn-secondary" id="dash-copy-summary-btn" title="Copy Executive Analytics Briefing to Clipboard">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span class="btn-text">Copy Briefing</span>
          </button>

          <button class="btn btn-secondary" id="dash-generate-report-btn" title="Generate Executive Summary Report">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Monthly Report
          </button>

          <button class="btn btn-primary" id="dash-new-release-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Release
          </button>
        </div>
      </div>

      <!-- Notice Banner if Holiday Conflicts exist -->
      ${conflictingReleases.length > 0 ? `
        <div class="alert-banner warning-banner" id="conflict-alert-banner">
          <div class="banner-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div class="banner-content">
            <div class="banner-title">Holiday Conflicts Detected (${conflictingReleases.length} Release${conflictingReleases.length > 1 ? 's' : ''})</div>
            <div class="banner-text">Target deployment dates overlap with active telecom public holidays. Fix red flags before CAB approval.</div>
          </div>
          <button class="btn btn-sm btn-outline-warning" id="view-conflicts-btn">View Conflicting Releases</button>
        </div>
      ` : ''}

      <!-- Top Primary KPI Cards (3 Cards) -->
      <div class="metrics-grid">
        <div class="metric-card card-glow-indigo">
          <div class="metric-icon indigo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div class="metric-body">
            <div class="metric-label">TOTAL RELEASES</div>
            <div class="metric-value">${metrics.total}</div>
            <div class="metric-footer">
              <span class="metric-tag">${monthLabel}</span>
            </div>
          </div>
        </div>

        <div class="metric-card card-glow-amber">
          <div class="metric-icon amber-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="metric-body">
            <div class="metric-label">OPEN / IN-FLIGHT</div>
            <div class="metric-value">${metrics.open}</div>
            <div class="metric-footer">
              <span class="sub-stat">${metrics.total > 0 ? Math.round((metrics.open / metrics.total) * 100) : 0}% of scope</span>
            </div>
          </div>
        </div>

        <div class="metric-card card-glow-emerald">
          <div class="metric-icon emerald-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="metric-body">
            <div class="metric-label">COMPLETED</div>
            <div class="metric-value">${metrics.completed}</div>
            <div class="metric-footer">
              <span class="sub-stat success-text">${completionPct}% success rate</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Completion Velocity Progress Bar -->
      <div class="card completion-card">
        <div class="completion-header">
          <div class="completion-title-group">
            <span class="card-eyebrow">PROGRESS MILESTONE</span>
            <h3 class="card-title">Release Completion Velocity</h3>
          </div>
          <div class="completion-stats">
            <span class="pct-big">${completionPct}%</span>
            <span class="fraction-text">${metrics.completed} of ${metrics.total} deployed</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${completionPct}%"></div>
        </div>
        <div class="progress-ticks">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <!-- =========================================================
           ADVANCED ANALYTICS SECTION
           ========================================================= -->
      <div class="analytics-section-header">
        <div class="section-title-wrap">
          <span class="analytics-badge">ENGINEERING METRICS</span>
          <h2 class="section-heading">Delivery Throughput & Stability Analytics</h2>
          <p class="section-subtext">Comprehensive cycle times, operational change health, contributor capacity & holiday calendar</p>
        </div>
      </div>

      <!-- Analytics Row 1: Monthly Throughput Chart + Operational Stability Gauge -->
      <div class="analytics-grid-two-col">
        <!-- Monthly Deployment Velocity Chart -->
        <div class="card analytics-chart-card">
          <div class="card-header chart-card-header">
            <div>
              <span class="card-eyebrow">ANNUAL CADENCE</span>
              <h3 class="card-title">Monthly Deployment Throughput (2026)</h3>
              <p class="card-subtitle">Release volume scheduled and completed per month. Click any bar to inspect.</p>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot dot-completed"></span> Completed</span>
              <span class="legend-item"><span class="legend-dot dot-open"></span> In-Flight / Open</span>
            </div>
          </div>

          <div class="chart-wrapper">
            <div class="bar-chart-container">
              ${analytics.monthlyTrend.map(m => {
                const totalH = maxMonthTotal > 0 ? (m.total / maxMonthTotal) * 100 : 0;
                const completedH = m.total > 0 ? (m.completed / m.total) * totalH : 0;
                const openH = totalH - completedH;
                const isSelected = isFiltered && selectedMonth === m.month;

                return `
                  <div class="chart-col ${isSelected ? 'active-col' : ''} ${m.total > 0 ? 'has-data' : 'empty-col'}" 
                       data-month="${m.month}" 
                       title="${m.name} 2026: ${m.total} total (${m.completed} completed, ${m.open} open)">
                    <div class="col-count-bubble">${m.total > 0 ? m.total : ''}</div>
                    <div class="col-bar-track">
                      <div class="col-bar-stack">
                        ${openH > 0 ? `<div class="bar-segment seg-open" style="height: ${openH}%"></div>` : ''}
                        ${completedH > 0 ? `<div class="bar-segment seg-completed" style="height: ${completedH}%"></div>` : ''}
                      </div>
                    </div>
                    <div class="col-label">${m.name}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="chart-footer-stats">
            <div class="footer-stat-pill">
              <span class="fstat-label">Busiest Month</span>
              <span class="fstat-val">October (18 releases)</span>
            </div>
            <div class="footer-stat-pill">
              <span class="fstat-label">Active Capacity</span>
              <span class="fstat-val">${analytics.monthlyTrend.reduce((acc, m) => acc + m.open, 0)} pipeline items</span>
            </div>
            <div class="footer-stat-pill">
              <span class="fstat-label">Avg Throughput</span>
              <span class="fstat-val">${(store.releases.length / 12).toFixed(1)} / month</span>
            </div>
          </div>
        </div>

        <!-- Operational Stability & Change Risk Card -->
        <div class="card analytics-stability-card">
          <div class="card-header">
            <div>
              <span class="card-eyebrow">CHANGE GOVERNANCE</span>
              <h3 class="card-title">Operational Stability Index</h3>
              <p class="card-subtitle">Scheduled standard vs reactive emergency changes</p>
            </div>
            <span class="stability-tag ${stabilityBadge.class}">
              ${stabilityBadge.icon} ${stabilityBadge.text}
            </span>
          </div>

          <div class="stability-content">
            <!-- Circular Gauge Visualization -->
            <div class="gauge-container">
              <div class="gauge-ring-wrap">
                <svg viewBox="0 0 100 100" class="gauge-svg">
                  <!-- Background Track -->
                  <circle cx="50" cy="50" r="40" class="gauge-track" />
                  <!-- Progress Ring -->
                  <circle cx="50" cy="50" r="40" class="gauge-progress" 
                          style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 - (251.2 * (analytics.plannedStabilityPct / 100))};" />
                </svg>
                <div class="gauge-center-label">
                  <span class="gauge-pct">${analytics.plannedStabilityPct}%</span>
                  <span class="gauge-caption">Planned</span>
                </div>
              </div>

              <div class="gauge-indicators">
                <div class="indicator-row">
                  <div class="indicator-key">
                    <span class="key-square key-scheduled"></span>
                    <span>Scheduled Standard</span>
                  </div>
                  <strong class="indicator-value">${analytics.scheduledCount} (${analytics.plannedStabilityPct}%)</strong>
                </div>

                <div class="indicator-row">
                  <div class="indicator-key">
                    <span class="key-square key-hotfix"></span>
                    <span>Hotfixes & Patches</span>
                  </div>
                  <strong class="indicator-value text-amber">${analytics.hotfixCount}</strong>
                </div>

                <div class="indicator-row">
                  <div class="indicator-key">
                    <span class="key-square key-emergency"></span>
                    <span>Emergency Outages</span>
                  </div>
                  <strong class="indicator-value text-danger">${analytics.emergencyCount}</strong>
                </div>
              </div>
            </div>

            <!-- Audit Readiness & Governance Bar -->
            <div class="audit-compliance-box">
              <div class="compliance-header">
                <span class="compliance-label">CAB Audit Compliance (RITM / CR Linked)</span>
                <span class="compliance-pct">${analytics.auditCompliancePct}% (${analytics.auditCompliantCount}/${metrics.total})</span>
              </div>
              <div class="compliance-bar-bg">
                <div class="compliance-bar-fill" style="width: ${analytics.auditCompliancePct}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- =========================================================
           4-Column Breakdown Grid (Platform, Type, Status, Stage)
           ========================================================= -->
      <div class="breakdown-grid">
        <!-- By Platform -->
        <div class="card breakdown-card">
          <div class="card-header">
            <h3 class="card-title">By Platform</h3>
            <span class="badge-count">${Object.values(metrics.byPlatform).reduce((a, b) => a + b, 0)} total</span>
          </div>
          <div class="breakdown-list">
            ${Object.entries(metrics.byPlatform).map(([plat, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return `
                <div class="breakdown-item interactive-item" data-filter-type="platform" data-filter-val="${plat}">
                  <div class="breakdown-item-header">
                    <span class="platform-tag platform-${plat.toLowerCase()}">${plat}</span>
                    <span class="breakdown-numbers"><strong>${count}</strong> <small>(${pct}%)</small></span>
                  </div>
                  <div class="mini-bar-bg">
                    <div class="mini-bar-fill bar-${plat.toLowerCase()}" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- By Deployment Type -->
        <div class="card breakdown-card">
          <div class="card-header">
            <h3 class="card-title">By Deployment Type</h3>
            <span class="badge-count">${Object.values(metrics.byType).reduce((a, b) => a + b, 0)} total</span>
          </div>
          <div class="breakdown-list">
            ${Object.entries(metrics.byType)
              .filter(([type]) => type !== 'Urgent')
              .map(([type, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return `
                <div class="breakdown-item interactive-item" data-filter-type="type" data-filter-val="${type}">
                  <div class="breakdown-item-header">
                    <span class="type-pill type-${type.toLowerCase()}">${type}</span>
                    <span class="breakdown-numbers"><strong>${count}</strong> <small>(${pct}%)</small></span>
                  </div>
                  <div class="mini-bar-bg">
                    <div class="mini-bar-fill bar-type-${type.toLowerCase()}" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- By Status -->
        <div class="card breakdown-card">
          <div class="card-header">
            <h3 class="card-title">By Status</h3>
            <span class="badge-count">${metrics.total} tracked</span>
          </div>
          <div class="breakdown-list">
            ${Object.entries(metrics.byStatus).map(([status, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              const slug = status.toLowerCase().replace(/\s+/g, '-');
              return `
                <div class="breakdown-item interactive-item" data-filter-type="status" data-filter-val="${status}">
                  <div class="breakdown-item-header">
                    <span class="status-pill status-${slug}">${status}</span>
                    <span class="breakdown-numbers"><strong>${count}</strong> <small>(${pct}%)</small></span>
                  </div>
                  <div class="mini-bar-bg">
                    <div class="mini-bar-fill bar-status-${slug}" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- By Stage -->
        <div class="card breakdown-card">
          <div class="card-header">
            <h3 class="card-title">By Lifecycle Stage</h3>
            <span class="badge-count">${metrics.total} total</span>
          </div>
          <div class="breakdown-list">
            ${Object.entries(metrics.byStage).map(([stage, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              const slug = stage.toLowerCase().replace(/[^a-z0-9]/g, '-');
              return `
                <div class="breakdown-item interactive-item" data-filter-type="stage" data-filter-val="${stage}">
                  <div class="breakdown-item-header">
                    <span class="stage-tag stage-${slug}">${stage}</span>
                    <span class="breakdown-numbers"><strong>${count}</strong> <small>(${pct}%)</small></span>
                  </div>
                  <div class="mini-bar-bg">
                    <div class="mini-bar-fill bar-stage-${slug}" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Analytics Row 2: Turnaround Lead Time + Schema & DB Footprint -->
      <div class="analytics-grid-two-col">
        <!-- Delivery Lead Time by Platform -->
        <div class="card analytics-lead-time-card">
          <div class="card-header">
            <div>
              <span class="card-eyebrow">VELOCITY BENCHMARK</span>
              <h3 class="card-title">Turnaround Lead Time by Platform</h3>
              <p class="card-subtitle">Average duration (days) from inception to target deploy</p>
            </div>
            <div class="badge-count">${analytics.avgLeadTime}d overall avg</div>
          </div>

          <div class="platform-lead-list">
            ${Object.entries(analytics.platformLeadTimes).map(([platform, data]) => {
              // Max scale around 25 days
              const maxScale = 25;
              const barWidth = Math.min(100, Math.round((data.avg / maxScale) * 100));
              return `
                <div class="platform-lead-item interactive-item" data-filter-type="platform" data-filter-val="${platform}">
                  <div class="plat-lead-header">
                    <span class="platform-tag platform-${platform.toLowerCase()}">${platform}</span>
                    <span class="plat-lead-days">
                      <strong>${data.avg > 0 ? `${data.avg} days` : 'N/A'}</strong>
                      <small class="text-muted">(${data.count} releases)</small>
                    </span>
                  </div>
                  <div class="plat-lead-bar-bg">
                    <div class="plat-lead-bar-fill bar-${platform.toLowerCase()}" style="width: ${barWidth}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Database Objects & Schema Footprint Card -->
        <div class="card schema-footprint-card">
          <div class="card-header">
            <div>
              <span class="card-eyebrow">ARCHITECTURE FOOTPRINT</span>
              <h3 class="card-title">Telecom DW Database Schema Impact</h3>
              <p class="card-subtitle">Scope of database objects, tables, views and stored procedures modified</p>
            </div>
            <span class="badge-count">${analytics.dbChangesCount} DB Changes</span>
          </div>

          <div class="schema-stats-row">
            <div class="schema-stat-box">
              <span class="schema-stat-num">${analytics.dbChangesPct}%</span>
              <span class="schema-stat-sub">DB Impact Ratio</span>
            </div>
            <div class="schema-stat-box">
              <span class="schema-stat-num">${analytics.dbChangesCount}</span>
              <span class="schema-stat-sub">DDL / DML Releases</span>
            </div>
            <div class="schema-stat-box">
              <span class="schema-stat-num">${metrics.total - analytics.dbChangesCount}</span>
              <span class="schema-stat-sub">App / API Only</span>
            </div>
          </div>

          <div class="schema-notice-box">
            <div class="schema-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            </div>
            <div class="schema-notice-text">
              <strong>Database Change Governance</strong>
              <p>All releases affecting Core DW tables or partitioning require DBA schema review and rollback scripts attached before CAB approval.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Action Feeds & Overview Panels -->
      <div class="dashboard-bottom-grid">
        <!-- Upcoming Releases Feed -->
        <div class="card feed-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Upcoming Target Deployments</h3>
              <p class="card-subtitle">Active releases scheduled for production deployment</p>
            </div>
            <button class="btn btn-sm btn-ghost" id="view-all-releases-link">View All →</button>
          </div>
          <div class="feed-content">
            ${upcomingReleases.length === 0 ? `
              <div class="empty-feed">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                <p>No active upcoming releases scheduled</p>
              </div>
            ` : `
              <div class="upcoming-list">
                ${upcomingReleases.map(rel => `
                  <div class="upcoming-item" data-release-id="${rel.id}">
                    <div class="upcoming-date-box">
                      <span class="date-month">${formatMonth(rel.targetDeploy)}</span>
                      <span class="date-day">${formatDay(rel.targetDeploy)}</span>
                    </div>
                    <div class="upcoming-info">
                      <div class="upcoming-title-row">
                        <span class="upcoming-name">${rel.name}</span>
                        <span class="platform-tag platform-${(rel.platform || '').toLowerCase()}">${rel.platform}</span>
                      </div>
                      <div class="upcoming-meta">
                        <span>Dev: <strong>${rel.developer || 'Unassigned'}</strong></span>
                        <span>Stage: <strong>${rel.stage}</strong></span>
                        <span class="status-pill status-${(rel.status || '').toLowerCase().replace(/\s+/g, '-')}">${rel.status || 'Pending'}</span>
                      </div>
                    </div>
                    <button class="btn btn-sm btn-icon open-rel-detail" data-release-id="${rel.id}" title="View Details">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Telecom DW Release Guidelines & Quick Stats -->
        <div class="card guidelines-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Release Process Guidelines</h3>
              <p class="card-subtitle">Telecom DW Deployment standard operating procedure</p>
            </div>
          </div>
          <div class="guidelines-list">
            <div class="guideline-item">
              <div class="guideline-num">1</div>
              <div class="guideline-text">
                <strong>Target Deploy Validation</strong>
                <p>Target deploy dates are checked automatically against Pakistani public holiday dates.</p>
              </div>
            </div>
            <div class="guideline-item">
              <div class="guideline-num">2</div>
              <div class="guideline-text">
                <strong>Lifecycle Progression</strong>
                <p>Development ➜ UAT ➜ CAB ➜ Production ➜ Completed.</p>
              </div>
            </div>
            <div class="guideline-item">
              <div class="guideline-num">3</div>
              <div class="guideline-text">
                <strong>Audit & DB Objects</strong>
                <p>Document changed tables, views, and stored procedures in the release record for CAB sign-off.</p>
              </div>
            </div>
            <div class="guideline-item">
              <div class="guideline-num">4</div>
              <div class="guideline-text">
                <strong>Sync with Excel</strong>
                <p>Export directly to <code>.xlsx</code> or import modified spreadsheets at any time using the Topbar controls.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  setupDashboardEvents(container, analytics, metrics, monthLabel);
}

function setupDashboardEvents(container, analytics, metrics, monthLabel) {
  // New release button
  const newBtn = container.querySelector('#dash-new-release-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
    });
  }

  // Monthly Report button
  const reportBtn = container.querySelector('#dash-generate-report-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      if (store.dashboardFilter.month !== 'ALL') {
        window._reportState = {
          month: store.dashboardFilter.month,
          year: store.dashboardFilter.year
        };
      }
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'report' } }));
    });
  }

  // Copy Analytics Briefing Button
  const copyBtn = container.querySelector('#dash-copy-summary-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = [
        `📊 JAZZ WORLD DATA PLATFORM - EXECUTIVE RELEASE BRIEFING (${monthLabel})`,
        `=============================================================`,
        `• Total Releases: ${metrics.total}`,
        `• Completed: ${metrics.completed} (${Math.round(metrics.completionRate * 100)}% Success Rate)`,
        `• In-Flight / Open: ${metrics.open}`,
        `• Average Lead Time: ${analytics.avgLeadTime} days (Scheduled: ${analytics.avgScheduledLeadTime}d, Hotfix: ${analytics.avgHotfixLeadTime}d)`,
        `• Change Stability Index: ${analytics.plannedStabilityPct}% Scheduled vs ${analytics.reactivePct}% Reactive/Hotfixes`,
        `• CAB Audit Compliance: ${analytics.auditCompliancePct}% (${analytics.auditCompliantCount} of ${metrics.total} with RITM/CR)`,
        `• Schema Impact: ${analytics.dbChangesCount} releases modifying database objects (${analytics.dbChangesPct}%)`,
        `• Next Holiday: ${analytics.nextHoliday ? `${analytics.nextHoliday.name} (${analytics.daysToNextHoliday} days)` : 'None defined'}`,
        `=============================================================`,
        `Generated from Jazz World Data Platform Release Tracker`
      ].join('\n');

      navigator.clipboard.writeText(text).then(() => {
        const btnText = copyBtn.querySelector('.btn-text');
        if (btnText) {
          const original = btnText.textContent;
          btnText.textContent = 'Copied!';
          setTimeout(() => { btnText.textContent = original; }, 2000);
        }
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    });
  }

  // Toggle view: All time vs Monthly
  const viewAllBtn = container.querySelector('#dash-view-all');
  const viewMonthBtn = container.querySelector('#dash-view-month');
  if (viewAllBtn && viewMonthBtn) {
    viewAllBtn.addEventListener('click', () => {
      store.dashboardFilter.month = 'ALL';
      renderDashboard(container);
    });
    viewMonthBtn.addEventListener('click', () => {
      store.dashboardFilter.month = 10; // Default to October
      store.dashboardFilter.year = 2026;
      renderDashboard(container);
    });
  }

  // Month / Year selects
  const mSelect = container.querySelector('#dash-month-select');
  const ySelect = container.querySelector('#dash-year-select');
  if (mSelect) {
    mSelect.addEventListener('change', (e) => {
      store.dashboardFilter.month = parseInt(e.target.value, 10);
      renderDashboard(container);
    });
  }
  if (ySelect) {
    ySelect.addEventListener('change', (e) => {
      store.dashboardFilter.year = parseInt(e.target.value, 10);
      renderDashboard(container);
    });
  }

  // Monthly Bar Chart Column Clicks: set filter directly!
  container.querySelectorAll('.chart-col').forEach(col => {
    col.addEventListener('click', () => {
      const monthNum = parseInt(col.dataset.month, 10);
      if (monthNum) {
        store.dashboardFilter.month = monthNum;
        store.dashboardFilter.year = 2026;
        renderDashboard(container);
      }
    });
  });



  // View Conflicts button
  const viewConflictsBtn = container.querySelector('#view-conflicts-btn');
  if (viewConflictsBtn) {
    viewConflictsBtn.addEventListener('click', () => {
      store.filters.hasConflict = true;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
    });
  }

  // View all releases link
  const viewAllLink = container.querySelector('#view-all-releases-link');
  if (viewAllLink) {
    viewAllLink.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
    });
  }

  // Interactive breakdown items (click to filter release list)
  container.querySelectorAll('.interactive-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.filterType;
      const val = item.dataset.filterVal;
      if (type && val) {
        store.filters[type] = val;
        window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      }
    });
  });

  // Upcoming items click
  container.querySelectorAll('.upcoming-item, .open-rel-detail').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = parseInt(el.dataset.releaseId, 10);
      if (id) {
        window.dispatchEvent(new CustomEvent('open-release-detail', { detail: { id } }));
      }
    });
  });
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleString('en-US', { month: 'short' });
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate();
}
