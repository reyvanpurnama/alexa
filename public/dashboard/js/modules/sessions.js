import { fetchApi, showToast } from '../api.js';
import { fetchOverviewStatus } from './overview.js';

let pairingCheckInterval = null;

export function initSessions() {
  const btnPairing = document.getElementById('btn-request-pairing');
  if (btnPairing) {
    btnPairing.addEventListener('click', async () => {
      const phoneNumber = document.getElementById('pairing-input')?.value.trim();
      const sessionName = document.getElementById('pairing-session-name')?.value.trim();

      if (!phoneNumber) {
        showToast('Masukkan nomor telepon WhatsApp terlebih dahulu', true);
        document.getElementById('pairing-input')?.focus();
        return;
      }

      btnPairing.disabled = true;
      btnPairing.textContent = 'Meminta kode...';

      try {
        const payload = { phoneNumber };
        if (sessionName) payload.sessionName = sessionName;

        const data = await fetchApi('/api/pairing', {
          method: 'POST',
          body: payload,
        });

        if (data.success && data.code) {
          const codeEl = document.getElementById('pairing-code-text');
          const boxEl = document.getElementById('pairing-box');
          const hintEl = document.getElementById('pairing-status-hint');

          if (codeEl) codeEl.textContent = data.code;
          if (boxEl) boxEl.style.display = 'block';
          if (hintEl) {
            hintEl.textContent = '⏳ Menunggu Anda memasukkan kode di HP...';
            hintEl.style.color = 'var(--accent-amber)';
          }

          showToast(`Kode pairing ${data.code} berhasil dibuat untuk +${data.phoneNumber}`);
          fetchSessions();
          startPairingWatcher(data.sessionName || sessionName);
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

  // Copy pairing code button
  const btnCopy = document.getElementById('btn-copy-pairing');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const code = document.getElementById('pairing-code-text')?.textContent.trim();
      if (code && code !== '---- ----') {
        navigator.clipboard.writeText(code).then(() => {
          showToast('Kode pairing berhasil disalin ke clipboard');
        }).catch(() => {
          showToast('Gagal menyalin kode', true);
        });
      }
    });
  }

  // Global active session disconnect button
  const btnLogout = document.getElementById('btn-session-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const confirmed = window.confirm('Putuskan koneksi dan hapus autentikasi nomor dari sesi aktif saat ini?');
      if (!confirmed) return;

      btnLogout.disabled = true;
      btnLogout.textContent = 'Memutuskan...';

      try {
        const data = await fetchApi('/api/session/logout', { method: 'POST' });
        if (data.success) {
          showToast('Sesi aktif berhasil diputuskan');
          fetchOverviewStatus();
          fetchSessions();
        } else {
          showToast(data.error || 'Gagal memutuskan sesi', true);
        }
      } catch (err) {
        showToast('Gagal memproses logout sesi', true);
      } finally {
        btnLogout.disabled = false;
        btnLogout.textContent = 'Putuskan Sesi Aktif';
      }
    });
  }
}

function startPairingWatcher(targetSession) {
  if (pairingCheckInterval) clearInterval(pairingCheckInterval);

  pairingCheckInterval = setInterval(async () => {
    try {
      const statusData = await fetchApi('/api/status');
      if (statusData.connected) {
        clearInterval(pairingCheckInterval);
        pairingCheckInterval = null;

        const hintEl = document.getElementById('pairing-status-hint');
        if (hintEl) {
          hintEl.textContent = `✅ Berhasil tertaut sebagai +${statusData.user?.id || ''}!`;
          hintEl.style.color = 'var(--accent-green)';
        }

        showToast(`🎉 WhatsApp berhasil tertaut ke profil ${targetSession || 'aktif'}!`);
        fetchOverviewStatus();
        fetchSessions();

        setTimeout(() => {
          const boxEl = document.getElementById('pairing-box');
          if (boxEl) boxEl.style.display = 'none';
        }, 4000);
      }
    } catch {}
  }, 2500);
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
        '<tr><td colspan="4" style="text-align: center; color: var(--text-tertiary); padding: 18px;">Tidak ada profil sesi</td></tr>';
      return;
    }

    const isConnected = Boolean(data.isConnected);

    data.sessions.forEach((s) => {
      const tr = document.createElement('tr');
      const isAct = s.isActive;

      // Column 1: Profile Name + Active indicator
      const nameHtml = `
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); font-size: 13px;">${s.name}</span>
          ${isAct ? '<span style="font-size: 10px; font-weight: 600; color: var(--accent-blue); background: rgba(0,113,227,0.12); padding: 2px 7px; border-radius: var(--radius-pill);">Aktif</span>' : ''}
        </div>
      `;

      // Column 2: Phone number & push name
      let phoneHtml = '';
      if (s.phoneNumber) {
        phoneHtml = `
          <div style="font-family: var(--font-mono); font-size: 12px; color: var(--text-primary);">+${s.phoneNumber}</div>
          ${s.pushName ? `<div style="font-size: 11px; color: var(--text-tertiary); margin-top: 1px;">${s.pushName}</div>` : ''}
        `;
      } else {
        phoneHtml = '<span style="color: var(--text-tertiary); font-size: 12px;">Belum tertaut</span>';
      }

      // Column 3: True Apple HIG Status Badge
      let statusHtml = '';
      if (isAct && isConnected) {
        statusHtml = '<span class="badge badge-connected"><span class="badge-dot"></span>Terhubung</span>';
      } else if (isAct && !isConnected) {
        statusHtml = '<span class="badge badge-waiting"><span class="badge-dot"></span>Menunggu Pairing</span>';
      } else if (!isAct && s.registered) {
        statusHtml = '<span class="badge badge-saved"><span class="badge-dot"></span>Tersimpan</span>';
      } else {
        statusHtml = '<span class="badge badge-empty">Kosong</span>';
      }

      // Column 4: Contextual Actions
      let actionHtml = '';
      if (isAct && isConnected) {
        actionHtml = `<button class="btn btn-ghost btn-sm" data-action="logout" style="color: var(--accent-red); font-size: 11px;">Putuskan</button>`;
      } else if (isAct && !isConnected) {
        actionHtml = `<button class="btn btn-primary btn-sm" data-action="pair-focus" data-session="${s.name}">Tautkan</button>`;
      } else if (!isAct && s.registered) {
        actionHtml = `
          <div style="display: inline-flex; gap: 4px; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" data-action="switch" data-session="${s.name}">Gunakan</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-session="${s.name}" style="color: var(--accent-red); font-size: 11px;">Hapus</button>
          </div>
        `;
      } else {
        actionHtml = `
          <div style="display: inline-flex; gap: 4px; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" data-action="pair-focus" data-session="${s.name}">Tautkan</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-session="${s.name}" style="color: var(--accent-red); font-size: 11px;">Hapus</button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td>${nameHtml}</td>
        <td>${phoneHtml}</td>
        <td>${statusHtml}</td>
        <td style="text-align: right;">${actionHtml}</td>
      `;

      tbody.appendChild(tr);
    });

    // Attach Action Listeners
    tbody.querySelectorAll('[data-action="switch"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sessionName = btn.getAttribute('data-session');
        if (sessionName) switchSession(sessionName);
      });
    });

    tbody.querySelectorAll('[data-action="pair-focus"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sessionName = btn.getAttribute('data-session');
        const sessionInput = document.getElementById('pairing-session-name');
        const phoneInput = document.getElementById('pairing-input');
        const titleEl = document.getElementById('pairing-card-title');

        if (sessionInput && sessionName) sessionInput.value = sessionName;
        if (titleEl && sessionName) titleEl.textContent = `Tautkan ke: ${sessionName}`;
        if (phoneInput) {
          phoneInput.focus();
          phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    tbody.querySelectorAll('[data-action="logout"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmed = window.confirm('Putuskan koneksi WhatsApp dari sesi aktif?');
        if (!confirmed) return;
        try {
          const res = await fetchApi('/api/session/logout', { method: 'POST' });
          if (res.success) {
            showToast('Sesi WhatsApp berhasil diputuskan');
            fetchOverviewStatus();
            fetchSessions();
          }
        } catch {}
      });
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sessionName = btn.getAttribute('data-session');
        if (!sessionName) return;

        const confirmed = window.confirm(`Hapus permanen profil sesi "${sessionName}" dari disk?`);
        if (!confirmed) return;

        try {
          const res = await fetchApi(`/api/sessions/${sessionName}`, { method: 'DELETE' });
          if (res.success) {
            showToast(`Profil sesi "${sessionName}" berhasil dihapus`);
            fetchSessions();
          } else {
            showToast(res.error || 'Gagal menghapus profil', true);
          }
        } catch (err) {
          showToast('Kesalahan jaringan saat menghapus profil', true);
        }
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
      showToast(`Beralih ke profil sesi "${sessionName}"`);
      fetchOverviewStatus();
      fetchSessions();
    } else {
      showToast(data.error || 'Gagal beralih sesi', true);
    }
  } catch (err) {
    showToast('Kesalahan jaringan', true);
  }
}
