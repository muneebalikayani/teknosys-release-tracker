import { store } from './data/store.js';
import { renderDashboard } from './components/dashboard.js';
import { renderReleaseList } from './components/releaseList.js';
import { renderKanbanBoard } from './components/kanbanBoard.js';
import { renderCalendarView } from './components/calendarView.js';
import { renderHolidayView } from './components/holidayView.js';
import { openReleaseModal } from './components/releaseModal.js';
import { openReleaseDetailModal } from './components/releaseDetailModal.js';
import { openHolidayModal } from './components/holidayModal.js';
import { openSupabaseModal } from './components/supabaseModal.js';
import { openImportModal } from './components/importModal.js';
import { renderMonthlyReport } from './components/monthlyReport.js';
import { initChatbot, removeChatbot } from './components/chatbot.js';

const viewContainer = document.getElementById('view-container');
const navTabs = document.getElementById('main-nav-tabs');

function updateTopBarBadges() {
  const total = store.releases.length;

  const releaseBadge = document.getElementById('nav-release-count-badge');
  if (releaseBadge) {
    releaseBadge.textContent = total;
  }
  const holidayBadge = document.getElementById('nav-holiday-count-badge');
  if (holidayBadge) {
    holidayBadge.textContent = store.holidays.length;
  }

  // Update Cloud Database Status Pill
  const dbBtn = document.getElementById('nav-db-btn');
  const dbStatus = document.getElementById('nav-db-status');
  if (dbBtn && dbStatus) {
    if (store.isSyncing) {
      dbBtn.className = 'live-pill db-pill';
      dbStatus.textContent = 'Syncing...';
      dbBtn.title = 'Syncing with live cloud database...';
    } else if (store.isCloudConnected || store.isSupabaseConnected) {
      dbBtn.className = 'live-pill db-pill';
      dbStatus.textContent = 'Live Cloud DB';
      dbBtn.title = 'Connected to Cloud Storage (Live sync active for all team members)';
    } else {
      dbBtn.className = 'live-pill db-pill disconnected';
      dbStatus.textContent = 'Connect DB';
      dbBtn.title = 'Click to view Database Settings';
    }
  }
}

function renderActiveView() {
  updateTopBarBadges();

  // Update nav tabs active state
  navTabs.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === store.currentView);
  });

  switch (store.currentView) {
    case 'dashboard':
      renderDashboard(viewContainer);
      break;
    case 'releases':
      renderReleaseList(viewContainer);
      break;
    case 'board':
      renderKanbanBoard(viewContainer);
      break;
    case 'calendar':
    case 'year':
      if (store.currentView === 'year') {
        if (!window._calState) window._calState = {};
        window._calState.viewMode = 'year';
      }
      renderCalendarView(viewContainer);
      break;
    case 'holidays':
      renderHolidayView(viewContainer);
      break;
    case 'report':
      renderMonthlyReport(viewContainer);
      break;
    default:
      renderDashboard(viewContainer);
  }
}

// Sidebar Collapse & Expand Management (Desktop)
const sidebarCollapseBtn = document.getElementById('btn-sidebar-collapse');
const collapseChevronIcon = document.getElementById('collapse-chevron-icon');

function setSidebarCollapsed(collapsed) {
  if (collapsed) {
    sidebarEl?.classList.add('sidebar-collapsed');
    if (sidebarCollapseBtn) {
      sidebarCollapseBtn.title = 'Expand sidebar (Ctrl+B / [)';
      sidebarCollapseBtn.setAttribute('aria-expanded', 'false');
    }
    if (collapseChevronIcon) {
      collapseChevronIcon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
    }
    localStorage.setItem('release-tracker-sidebar-collapsed', 'true');
  } else {
    sidebarEl?.classList.remove('sidebar-collapsed');
    if (sidebarCollapseBtn) {
      sidebarCollapseBtn.title = 'Collapse sidebar (Ctrl+B / [)';
      sidebarCollapseBtn.setAttribute('aria-expanded', 'true');
    }
    if (collapseChevronIcon) {
      collapseChevronIcon.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>';
    }
    localStorage.setItem('release-tracker-sidebar-collapsed', 'false');
  }
}

function toggleSidebarCollapse() {
  const isCollapsed = sidebarEl?.classList.contains('sidebar-collapsed');
  setSidebarCollapsed(!isCollapsed);
}

sidebarCollapseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSidebarCollapse();
});

// Restore saved sidebar collapsed state on startup (desktop only)
if (window.innerWidth > 1024) {
  const savedCollapsed = localStorage.getItem('release-tracker-sidebar-collapsed');
  if (savedCollapsed === 'true') {
    setSidebarCollapsed(true);
  }
}

// Mobile Sidebar Drawer Management
const sidebarEl = document.getElementById('app-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
const sidebarCloseBtn = document.getElementById('btn-sidebar-close');

function openMobileSidebar() {
  sidebarEl?.classList.add('sidebar-open');
  sidebarBackdrop?.classList.add('active');
  document.body.classList.add('sidebar-locked');
}

function closeMobileSidebar() {
  sidebarEl?.classList.remove('sidebar-open');
  sidebarBackdrop?.classList.remove('active');
  document.body.classList.remove('sidebar-locked');
}

sidebarToggleBtn?.addEventListener('click', openMobileSidebar);
sidebarCloseBtn?.addEventListener('click', closeMobileSidebar);
sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

// Nav tab click listeners
navTabs?.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-tab-btn');
  if (btn) {
    const targetView = btn.dataset.view;
    if (targetView && targetView !== store.currentView) {
      store.currentView = targetView;
      renderActiveView();
      if (window.innerWidth <= 1024) {
        closeMobileSidebar();
      }
    }
  }
});

// Primary CTA: New Release (Mobile header)
document.getElementById('btn-mobile-new-release')?.addEventListener('click', () => {
  openReleaseModal({ mode: 'create' });
});

// Mobile brand link jumps to dashboard
document.getElementById('brand-logo-mobile')?.addEventListener('click', (e) => {
  e.preventDefault();
  store.currentView = 'dashboard';
  renderActiveView();
  closeMobileSidebar();
});

// Supabase DB modal trigger
document.getElementById('nav-db-btn')?.addEventListener('click', () => {
  openSupabaseModal();
});

// Manual Sync from Cloud button
document.getElementById('btn-sync-cloud')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.style.transform = 'rotate(180deg)';
  btn.style.transition = 'transform 0.4s ease';
  try {
    await store.syncNow();
  } finally {
    setTimeout(() => {
      btn.style.transform = 'none';
    }, 450);
  }
});

// Theme Management (Dark Soft UI / White Light / Mintlify Dark)
const themeToggleBtn = document.getElementById('btn-theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');
const themeToggleIcon = document.getElementById('theme-toggle-icon');

const THEME_CONFIG = {
  neumorphic: {
    label: 'Dark Soft UI',
    title: 'Theme: Dark Neumorphic (Soft UI) · Click for White Light',
    iconHtml: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
  },
  light: {
    label: 'White Light',
    title: 'Theme: White Light · Click for Mintlify Dark',
    iconHtml: '<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>'
  },
  mintlify: {
    label: 'Mintlify Dark',
    title: 'Theme: Mintlify Dark · Click for Dark Soft UI',
    iconHtml: '<rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M9 3v18"></path>'
  }
};
const THEME_ORDER = ['neumorphic', 'light', 'mintlify'];

function applyTheme(theme) {
  const resolvedTheme = THEME_CONFIG[theme] ? theme : 'neumorphic';
  const cfg = THEME_CONFIG[resolvedTheme];
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  localStorage.setItem('release-tracker-theme', resolvedTheme);
  if (themeToggleLabel) {
    themeToggleLabel.textContent = cfg.label;
  }
  if (themeToggleIcon) {
    themeToggleIcon.innerHTML = cfg.iconHtml;
  }
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('data-current-theme', resolvedTheme);
    themeToggleBtn.title = cfg.title;
  }
}

const savedTheme = localStorage.getItem('release-tracker-theme') || 'neumorphic';
applyTheme(savedTheme);

themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'neumorphic';
  const idx = THEME_ORDER.indexOf(current);
  const nextTheme = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  applyTheme(nextTheme);
});

// Brand logo link jumps to dashboard
document.getElementById('brand-logo-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  store.currentView = 'dashboard';
  renderActiveView();
});

// Custom Event Listeners
window.addEventListener('switch-view', (e) => {
  const targetView = e.detail && e.detail.view;
  if (targetView) {
    store.currentView = targetView;
    renderActiveView();
  }
});

window.addEventListener('open-release-modal', (e) => {
  openReleaseModal(e.detail || {});
});

window.addEventListener('open-release-detail', (e) => {
  const id = e.detail && e.detail.id;
  if (id) {
    openReleaseDetailModal(id);
  }
});

window.addEventListener('open-holiday-modal', (e) => {
  openHolidayModal(e.detail || {});
});

window.addEventListener('open-import-modal', () => {
  openImportModal();
});

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  // If user is typing in an input or textarea, don't trigger global hotkeys
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.classList.remove('show');
        m.style.display = 'none';
        m.remove();
      });
    }
    return;
  }

  if (e.key === 'Escape') {
    closeMobileSidebar();
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.classList.remove('show');
      m.style.display = 'none';
      m.remove();
    });
  }

  // '[' or Ctrl+B / Cmd+B to toggle sidebar collapse
  if (e.key === '[' || ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B'))) {
    e.preventDefault();
    toggleSidebarCollapse();
  }

  // 'n' for new release
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openReleaseModal({ mode: 'create' });
  }

  // '/' to search releases
  if (e.key === '/') {
    e.preventDefault();
    if (store.currentView !== 'releases') {
      store.currentView = 'releases';
      renderActiveView();
    }
    setTimeout(() => {
      document.getElementById('filter-search')?.focus();
    }, 100);
  }
});

// Subscribe to store updates
store.subscribe(() => {
  renderActiveView();
});

// Initial boot
renderActiveView();

// Chatbot is hidden for now per user request. Easily re-enabled anytime.
removeChatbot();
window.initChatbot = initChatbot;
window.removeChatbot = removeChatbot;

console.log('Teknosys Release Tracker booted successfully with 37 releases & 21 holidays.');
