import { fetchApi, showToast } from '../api.js';
import { fetchOverviewStatus } from './overview.js';

export function initSessions() {
  const btnPairing = document.getElementById('btn-request-pairing');
  if (btnPairing) {
    btnPairing.addEventListener('click', async () => {
      const phoneNumber = document.getElementById('pairing-input')?.value.trim();
      if (!phoneNumber) {
        showToast('Masukkan nomor telepon terlebih dahulu', true);
        return;
      }

      btnPairing.disabled = true;
      btnPairing.textContent = 'Meminta kode...';

      try {
        const data = await fetchApi('/api/pairing', {
          method: 'POST',
          body: { phoneNumber },
        });

        if (data.success && data.code) {
          const codeEl = document.getElementById('pairing-code-text');
          const boxEl = document.getElementById('pairing-box');
          if (codeEl) codeEl.textContent = data.code;
          if (boxEl) boxEl.style.display = 'block';
        } else {
          showToast(data.error || 'Gagal membuat kode pairing', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat meminta kode pairing', true);
      } finally {
        btnPairing.disabled = false;
        btnPairing.textContent = 'Minta Kode Pairing';
      }
    });
  }
}

export async function fetchSessions() {
  try {
    const data = await fetchApi('/api/sessions');
    if (!data.success) return;

    if (window.__ALEXA_CONFIG__) {
      window.__ALEXA_CONFIG__.activeSession = data.activeSession;
    }

    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data.sessions || data.sessions.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align: center; color: var(--text-tertiary);">Tidak ada profil sesi</td></tr>';
      return;
    }

    data.sessions.forEach((s) => {
      const tr = document.createElement('tr');
      const isAct = s.isActive;
      const phoneLabel = s.phoneNumber
        ? '+' + s.phoneNumber
        : '<span style="color: var(--text-tertiary); font-size: 11px;">Belum tertaut</span>';

      const actionHtml = isAct
        ? '<span style="font-size: 12px; color: var(--accent-green); font-weight: 500;">Aktif</span>'
        : `<button class="btn btn-secondary btn-sm" data-action="switch" data-session="${s.name}">Aktifkan</button>`;

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 500;">${s.name}</td>
        <td style="font-family: var(--font-mono); font-size: 12px;">${phoneLabel}</td>
        <td style="text-align: right;">${actionHtml}</td>
      `;

      tbody.appendChild(tr);
    });

    // Attach switch event listeners
    tbody.querySelectorAll('[data-action="switch"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sessionName = btn.getAttribute('data-session');
        if (sessionName) switchSession(sessionName);
      });
    });
  } catch (err) {}
}

export async function switchSession(sessionName) {
  try {
    const data = await fetchApi('/api/sessions/switch', {
      method: 'POST',
      body: { sessionName },
    });

    if (data.success) {
      fetchOverviewStatus();
      fetchSessions();
    } else {
      showToast(data.error || 'Gagal beralih sesi', true);
    }
  } catch (err) {
    showToast('Kesalahan jaringan', true);
  }
}
