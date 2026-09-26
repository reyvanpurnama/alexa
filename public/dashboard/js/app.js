import { initOverview, fetchOverviewStatus } from './modules/overview.js';
import { initSessions, fetchSessions } from './modules/sessions.js';
import { initBroadcast, fetchBroadcastStatus } from './modules/broadcast.js';
import { initAi, fetchKnowledge } from './modules/ai.js';
import { initSettings, fetchSettings } from './modules/settings.js';

export function switchTab(tabId) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.seg-btn').forEach((el) => el.classList.remove('active'));

  const targetView = document.getElementById(tabId);
  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'tab-sessions') fetchSessions();
  if (tabId === 'tab-broadcast') fetchBroadcastStatus();
  if (tabId === 'tab-ai') fetchKnowledge();
  if (tabId === 'tab-settings') fetchSettings();
}

// Expose switchTab globally for inline onclick triggers
window.switchTab = switchTab;

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

  // Initial silent polling for system status
  setInterval(fetchOverviewStatus, 4000);
});
