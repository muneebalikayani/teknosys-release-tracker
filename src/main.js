import { store } from './data/store.js';
import { renderDashboard } from './components/dashboard.js';
import { renderReleaseList } from './components/releaseList.js';
import { renderKanbanBoard } from './components/kanbanBoard.js';
import { renderCalendarView } from './components/calendarView.js';
import { renderTimelineView } from './components/timelineView.js';
import { renderYearView } from './components/yearView.js';
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
const releaseCountEl = document.getElementById('nav-release-count');
const holidayCountEl = document.getElementById('nav-holiday-count');

function updateTopBarBadges() {
  if (releaseCountEl) {
    const total = store.releases.length;
    const conflicts = store.getConflictingReleases().length;
    releaseCountEl.textContent = `${total} Releases${conflicts > 0 ? ` (${conflicts} ⚠️)` : ''}`;
  }
  if (holidayCountEl) {
    holidayCountEl.textContent = `${store.holidays.length} Holidays`;
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
      renderCalendarView(viewContainer);
      break;
    case 'timeline':
      renderTimelineView(viewContainer);
      break;
    case 'year':
      renderYearView(viewContainer);
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

// Nav tab click listeners
navTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-tab-btn');
  if (btn) {
    const targetView = btn.dataset.view;
    if (targetView && targetView !== store.currentView) {
      store.currentView = targetView;
      renderActiveView();
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
});

// Mobile quick new release
document.getElementById('btn-mobile-new-release')?.addEventListener('click', () => {
  openReleaseModal({ mode: 'create' });
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
      document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    }
    return;
  }

  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
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
