import { fetchApi, showToast } from '../api.js';

export function initOverview() {
  const btnSend = document.getElementById('btn-quick-send');
  if (btnSend) {
    btnSend.addEventListener('click', async () => {
      const to = document.getElementById('test-to')?.value.trim();
      const message = document.getElementById('test-msg')?.value.trim();

      if (!to || !message) {
        showToast('Nomor dan pesan wajib diisi', true);
        return;
      }

      try {
        const data = await fetchApi('/api/send-message', {
          method: 'POST',
          body: { to, message },
        });

        if (data.success) {
          const inputMsg = document.getElementById('test-msg');
          if (inputMsg) inputMsg.value = '';
          showToast('Pesan dikirim ke antrean');
        } else {
          showToast(data.error || 'Gagal mengirim pesan', true);
        }
      } catch (err) {
        showToast('Terjadi kesalahan pengiriman pesan', true);
      }
    });
  }

  // Logout / Disconnect action in header
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!confirm('Putuskan koneksi WhatsApp aktif?')) return;
      try {
        const data = await fetchApi('/api/session/logout', { method: 'POST' });
        if (data.success) {
          fetchOverviewStatus();
        }
      } catch (e) {
        showToast('Gagal memutuskan sesi', true);
      }
    });
  }

  fetchOverviewStatus();
}

export async function fetchOverviewStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (!data.success) return;

    // Header indicator
    const wrap = document.getElementById('status-wrap');
    const label = document.getElementById('status-label');
    if (wrap && label) {
      wrap.className = 'status-indicator ' + data.status;
      label.textContent =
        data.status === 'CONNECTED' ? (data.user?.id ? '+' + data.user.id : 'Live') : data.status;
    }

    // Overview cards
    const phoneEl = document.getElementById('overview-phone');
    const nameEl = document.getElementById('overview-name');
    if (phoneEl) {
      phoneEl.textContent = data.user?.id ? '+' + data.user.id : 'Belum Ditautkan';
    }
    if (nameEl) {
      nameEl.textContent =
        (data.user?.name || (data.connected ? 'WhatsApp Connected' : 'Belum ditautkan')) +
        ' · Sesi: ' +
        (window.__ALEXA_CONFIG__?.activeSession || 'default');
    }

    // "No news is good news": Only show queue banner if items exist
    const queueBanner = document.getElementById('active-queue-banner');
    const queueCount = document.getElementById('queue-count');
    if (queueBanner && queueCount) {
      if (data.queue && data.queue.size > 0) {
        queueBanner.style.display = 'inline-flex';
        queueCount.textContent = data.queue.size;
      } else {
        queueBanner.style.display = 'none';
      }
    }
  } catch (err) {}
}
