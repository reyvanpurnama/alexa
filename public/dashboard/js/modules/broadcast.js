import { fetchApi, showToast } from '../api.js';

let bcTimer = null;
let queueTimer = null;
let selectedMinDelay = 4;
let selectedMaxDelay = 8;

export function initBroadcast() {
  // Pacing Selector
  document.querySelectorAll('.pacing-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pacing-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMinDelay = parseInt(btn.getAttribute('data-min'), 10);
      selectedMaxDelay = parseInt(btn.getAttribute('data-max'), 10);
    });
  });

  // Target Counter
  const targetsInput = document.getElementById('bc-targets');
  const countEl = document.getElementById('bc-targets-count');
  if (targetsInput && countEl) {
    targetsInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const count = val ? val.split(/[\s,;\n]+/).filter((x) => x.length >= 8).length : 0;
      countEl.textContent = count + ' nomor';
    });
  }

  // Preview Spintax
  const btnPreview = document.getElementById('btn-bc-preview');
  if (btnPreview) {
    btnPreview.addEventListener('click', async () => {
      const template = document.getElementById('bc-message')?.value.trim();
      if (!template) {
        showToast('Masukkan template pesan terlebih dahulu', true);
        return;
      }

      try {
        const data = await fetchApi('/api/broadcast/preview', {
          method: 'POST',
          body: { template, count: 3 },
        });

        if (data.success) {
          const varCount = document.getElementById('bc-variations-count');
          const container = document.getElementById('bc-preview-container');
          if (varCount) varCount.textContent = data.totalVariations + ' variasi';
          if (container) {
            container.innerHTML = data.previews
              .map(
                (p, idx) => `
                <div style="background: var(--bg-surface-elevated); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 2px;">Sampel #${idx + 1}:</div>
                  <div>${p}</div>
                </div>
              `
              )
              .join('');
          }
        } else {
          showToast(data.error || 'Gagal membuat pratinjau', true);
        }
      } catch (err) {
        showToast('Gagal memuat pratinjau variasi', true);
      }
    });
  }

  // Start Broadcast
  const btnStart = document.getElementById('btn-bc-start');
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      const raw = document.getElementById('bc-targets')?.value.trim();
      const message = document.getElementById('bc-message')?.value.trim();

      if (!raw || !message) {
        showToast('Nomor tujuan dan template wajib diisi', true);
        return;
      }

      const targets = raw.split(/[\s,;\n]+/).filter((t) => t.trim().length >= 8);
      if (targets.length === 0) {
        showToast('Tidak ada nomor tujuan valid', true);
        return;
      }

      btnStart.disabled = true;
      btnStart.textContent = 'Memulai...';

      try {
        const data = await fetchApi('/api/broadcast', {
          method: 'POST',
          body: {
            targets,
            message,
            minDelayMs: selectedMinDelay * 1000,
            maxDelayMs: selectedMaxDelay * 1000,
          },
        });

        if (data.success) {
          showToast('Broadcast dimulai untuk ' + data.totalTargets + ' nomor');
          fetchBroadcastStatus();
          fetchQueueAndMessages();
        } else {
          showToast(data.error || 'Gagal memulai broadcast', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan', true);
      } finally {
        btnStart.disabled = false;
        btnStart.textContent = 'Mulai Broadcast';
      }
    });
  }

  // Pause / Resume / Cancel Controls for Broadcast
  document.getElementById('btn-bc-pause')?.addEventListener('click', async () => {
    await fetchApi('/api/broadcast/pause', { method: 'POST' });
    fetchBroadcastStatus();
  });

  document.getElementById('btn-bc-resume')?.addEventListener('click', async () => {
    await fetchApi('/api/broadcast/resume', { method: 'POST' });
    fetchBroadcastStatus();
  });

  document.getElementById('btn-bc-cancel')?.addEventListener('click', async () => {
    if (!confirm('Batalkan broadcast ini?')) return;
    await fetchApi('/api/broadcast/cancel', { method: 'POST' });
    fetchBroadcastStatus();
  });

  // Outbound Queue Management Buttons (Inside Apple Sheet Modal)
  document.getElementById('btn-queue-pause')?.addEventListener('click', async () => {
    const res = await fetchApi('/api/queue/pause', { method: 'POST' });
    if (res.success) {
      showToast('Antrean pengiriman dijeda.');
      fetchQueueAndMessages();
    }
  });

  document.getElementById('btn-queue-resume')?.addEventListener('click', async () => {
    const res = await fetchApi('/api/queue/resume', { method: 'POST' });
    if (res.success) {
      showToast('Antrean pengiriman dilanjutkan.');
      fetchQueueAndMessages();
    }
  });

  document.getElementById('btn-queue-clear')?.addEventListener('click', async () => {
    if (!confirm('Kosongkan semua pesan yang belum terkirim di antrean?')) return;
    const res = await fetchApi('/api/queue/clear', { method: 'POST' });
    if (res.success) {
      showToast('Seluruh antrean pesan berhasil dibersihkan.');
      fetchQueueAndMessages();
    }
  });

  // Progressive Disclosure: Apple Sheet Modal Trigger & Close
  const sheetModal = document.getElementById('delivery-sheet-modal');
  const btnOpenSheet = document.getElementById('btn-open-delivery-sheet');
  const btnCloseSheet = document.getElementById('btn-close-delivery-sheet');

  if (btnOpenSheet && sheetModal) {
    btnOpenSheet.addEventListener('click', () => {
      sheetModal.style.display = 'flex';
      fetchQueueAndMessages();
    });
  }

  if (btnCloseSheet && sheetModal) {
    btnCloseSheet.addEventListener('click', () => {
      sheetModal.style.display = 'none';
    });
  }

  if (sheetModal) {
    sheetModal.addEventListener('click', (e) => {
      if (e.target === sheetModal) {
        sheetModal.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheetModal.style.display === 'flex') {
        sheetModal.style.display = 'none';
      }
    });
  }

  // Initial load & Polling (Gentle 5s interval, guarded by Visibility API)
  fetchQueueAndMessages();
  if (!queueTimer) {
    queueTimer = setInterval(() => {
      // "No news is good news": Do not poll when user minimizes or switches tab
      if (!document.hidden) {
        fetchQueueAndMessages();
      }
    }, 5000);
  }
}

export async function fetchBroadcastStatus() {
  if (document.hidden) return;

  try {
    const data = await fetchApi('/api/broadcast/status');
    if (!data.success) return;

    const job = data.currentJob;
    const monitorEl = document.getElementById('bc-active-monitor');
    const btnPause = document.getElementById('btn-bc-pause');
    const btnResume = document.getElementById('btn-bc-resume');

    // Quiet UI: Hide monitor panel when idle/completed
    if (!job || job.status === 'completed' || job.status === 'cancelled') {
      if (monitorEl) monitorEl.style.display = 'none';
      if (bcTimer) {
        clearInterval(bcTimer);
        bcTimer = null;
      }
      return;
    }

    if (monitorEl) monitorEl.style.display = 'block';

    const pct = job.progressPercent || 0;
    const progText = document.getElementById('bc-progress-text');
    const bar = document.getElementById('bc-bar');
    const sentEl = document.getElementById('bc-stat-sent');
    const failedEl = document.getElementById('bc-stat-failed');
    const remEl = document.getElementById('bc-stat-remaining');

    if (progText) {
      progText.textContent = `${job.sentCount + job.failedCount} / ${job.totalTargets} (${pct}%)`;
    }
    if (bar) bar.style.width = pct + '%';
    if (sentEl) sentEl.textContent = job.sentCount;
    if (failedEl) failedEl.textContent = job.failedCount;
    if (remEl) {
      remEl.textContent = Math.max(0, job.totalTargets - (job.sentCount + job.failedCount));
    }

    if (btnPause) btnPause.disabled = job.status !== 'running';
    if (btnResume) btnResume.disabled = job.status !== 'paused';

    if (job.status === 'running' || job.status === 'paused') {
      if (!bcTimer) bcTimer = setInterval(fetchBroadcastStatus, 2500);
    }
  } catch (err) {}
}

export async function fetchQueueAndMessages() {
  if (document.hidden) return;

  try {
    const [queueRes, messagesRes] = await Promise.all([
      fetchApi('/api/queue/status'),
      fetchApi('/api/messages/recent?limit=25'),
    ]);

    // Update Quiet Status Bar Elements
    const dotEl = document.getElementById('queue-dot');
    const statusTextEl = document.getElementById('queue-status-text');
    const countChipEl = document.getElementById('queue-count-chip');
    const btnPause = document.getElementById('btn-queue-pause');
    const btnResume = document.getElementById('btn-queue-resume');

    if (queueRes.success) {
      const q = queueRes.queue;
      const pendingCount = q.pending || 0;

      if (q.isPaused) {
        if (dotEl) {
          dotEl.className = 'status-indicator-dot paused';
        }
        if (statusTextEl) {
          statusTextEl.textContent = q.pausedByConnection
            ? 'Menunggu Sambungan WhatsApp...'
            : 'Antrean Pengiriman Dijeda';
        }
        if (countChipEl) {
          countChipEl.textContent = `${pendingCount} pesan tertahan`;
        }
        if (btnPause) btnPause.style.display = 'none';
        if (btnResume) btnResume.style.display = 'inline-flex';
      } else {
        if (dotEl) {
          dotEl.className = 'status-indicator-dot online';
        }
        if (statusTextEl) {
          statusTextEl.textContent =
            pendingCount > 0 ? 'Sedang Mengirim Pesan Aman...' : 'Sistem Pengiriman Aman Siap';
        }
        if (countChipEl) {
          countChipEl.textContent =
            pendingCount > 0 ? `${pendingCount} pesan mengantre` : 'Antrean bersih';
        }
        if (btnPause) btnPause.style.display = 'inline-flex';
        if (btnResume) btnResume.style.display = 'none';
      }
    }

    // Render Recent Messages in the Apple Sheet Table
    if (messagesRes.success && messagesRes.messages) {
      renderRecentMessages(messagesRes.messages);
    }
  } catch (err) {
    // Quiet UI: Fail silently for background polls
  }
}

function renderRecentMessages(messages) {
  const tbody = document.getElementById('recent-messages-list');
  if (!tbody) return;

  if (!messages || messages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-tertiary); padding: 28px;">
          Belum ada riwayat pesan yang dikirim sejak server berjalan.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = messages
    .map((msg) => {
      const timeStr = formatTime(msg.queuedAt || msg.sentAt);
      const targetStr = formatPhoneDisplay(msg.to);
      const noteOrId = msg.referenceId
        ? `<span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(msg.referenceId)}</span>`
        : `<span style="color: var(--text-tertiary); font-family: var(--font-mono); font-size: 11px;">${escapeHtml(msg.id.substring(0, 16))}...</span>`;

      const typeBadge = `<span style="text-transform: uppercase; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-tertiary);">${msg.type}</span>`;

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 10px 12px; color: var(--text-tertiary); font-family: var(--font-mono); font-size: 11px;">${timeStr}</td>
          <td style="padding: 10px 12px; font-weight: 500; font-family: var(--font-mono);">${targetStr}</td>
          <td style="padding: 10px 12px;">${noteOrId}</td>
          <td style="padding: 10px 12px;">${typeBadge}</td>
          <td style="padding: 10px 12px; text-align: right;">${renderStatusPill(msg.status)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderStatusPill(status) {
  switch (status) {
    case 'queued':
      return `<span class="status-pill queued">⏳ Mengantre</span>`;
    case 'sent':
      return `<span class="status-pill sent">✓ Terkirim ke WhatsApp</span>`;
    case 'delivered':
      return `<span class="status-pill delivered">✓✓ Masuk ke HP Pelanggan</span>`;
    case 'read':
      return `<span class="status-pill read">✓✓ Dibaca Pelanggan</span>`;
    case 'failed':
      return `<span class="status-pill failed">✕ Gagal Kirim</span>`;
    default:
      return `<span class="status-pill">${status}</span>`;
  }
}

function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('id-ID', { hour12: false });
}

function formatPhoneDisplay(jid) {
  if (!jid) return '-';
  const clean = jid.split('@')[0];
  return '+' + clean;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
