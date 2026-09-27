import { initOverview, fetchOverviewStatus } from './modules/overview.js';
import { initSessions, fetchSessions } from './modules/sessions.js';
import { initBroadcast, fetchBroadcastStatus } from './modules/broadcast.js';
import { initAi, fetchKnowledge } from './modules/ai.js';
import { initSettings, fetchSettings } from './modules/settings.js';

let overviewTimer = null;
let currentActiveTab = 'tab-overview';

export function switchTab(tabId) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.seg-btn').forEach((el) => el.classList.remove('active'));

  const targetView = document.getElementById(tabId);
  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  currentActiveTab = tabId;

  // Immediate data fetch on tab switch
  if (tabId === 'tab-overview') fetchOverviewStatus();
  if (tabId === 'tab-sessions') fetchSessions();
  if (tabId === 'tab-broadcast') fetchBroadcastStatus();
  if (tabId === 'tab-ai') fetchKnowledge();
  if (tabId === 'tab-settings') fetchSettings();
}

// Expose switchTab globally for inline onclick triggers
window.switchTab = switchTab;

/**
 * Starts gentle background status polling (guarded by Visibility API)
 */
export function startOverviewPolling() {
  stopOverviewPolling();
  overviewTimer = setInterval(() => {
    // Apple HIG "No news is good news": Suspend network requests when tab is hidden
    if (!document.hidden) {
      fetchOverviewStatus();
    }
  }, 4000);
}

/**
 * Suspends background polling completely to preserve CPU and battery
 */
export function stopOverviewPolling() {
  if (overviewTimer) {
    clearInterval(overviewTimer);
    overviewTimer = null;
  }
}

/**
 * Instant catch-up refresh when the user returns to the tab
 */
function handleVisibilityChange() {
  if (document.hidden) {
    stopOverviewPolling();
  } else {
    // Instant catch-up: refresh status and active tab data immediately
    fetchOverviewStatus();
    if (currentActiveTab === 'tab-sessions') fetchSessions();
    if (currentActiveTab === 'tab-broadcast') fetchBroadcastStatus();
    if (currentActiveTab === 'tab-ai') fetchKnowledge();
    if (currentActiveTab === 'tab-settings') fetchSettings();

    startOverviewPolling();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Setup Segmented Navigation clicks
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  // Initialize individual feature modules
  initOverview();
  initSessions();
  initBroadcast();
  initAi();
  initSettings();

  // Register Visibility API Guard (Battery & Network Saver)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial silent polling for system status
  startOverviewPolling();
});

