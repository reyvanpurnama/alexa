import { fetchApi, showToast } from '../api.js';

let bcTimer = null;
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

  // Pause / Resume / Cancel Controls
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
}

export async function fetchBroadcastStatus() {
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
