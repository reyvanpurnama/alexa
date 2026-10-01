import { fetchApi, showToast } from '../api.js';
import { initRoles, fetchRoles } from './settings/roles.js';

export function initSettings() {
  // 1. Initialize RBAC Roles & Owners Manager
  initRoles();

  // 2. Toggle AI Auto-Reply Switch
  const toggleAutoReply = document.getElementById('toggle-ai-autoreply');
  if (toggleAutoReply) {
    toggleAutoReply.addEventListener('change', async () => {
      const isChecked = toggleAutoReply.checked;
      try {
        const data = await fetchApi('/api/settings', {
          method: 'PUT',
          body: { aiAutoReply: isChecked },
        });

        if (data.success) {
          showToast(isChecked ? 'Balasan otomatis AI diaktifkan' : 'Balasan otomatis AI dinonaktifkan');
        } else {
          toggleAutoReply.checked = !isChecked; // Revert
          showToast(data.error || 'Gagal memperbarui saklar AI', true);
        }
      } catch (err) {
        toggleAutoReply.checked = !isChecked;
        showToast('Kesalahan jaringan', true);
      }
    });
  }

  // Save Bot Identity
  const btnSaveIdentity = document.getElementById('btn-save-identity');
  if (btnSaveIdentity) {
    btnSaveIdentity.addEventListener('click', async () => {
      const botName = document.getElementById('setting-bot-name')?.value.trim();
      const prefix = document.getElementById('setting-prefix')?.value.trim();
      const footerText = document.getElementById('setting-footer')?.value.trim();

      if (!botName) {
        showToast('Nama bot tidak boleh kosong', true);
        return;
      }

      btnSaveIdentity.disabled = true;
      btnSaveIdentity.textContent = 'Menyimpan...';

      try {
        const data = await fetchApi('/api/settings', {
          method: 'PUT',
          body: { botName, prefix: prefix || '/', footerText: footerText || '' },
        });

        if (data.success) {
          showToast('Identitas bot berhasil diperbarui');
          const headerName = document.getElementById('header-bot-name');
          if (headerName) headerName.textContent = botName;
        } else {
          showToast(data.error || 'Gagal menyimpan identitas', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menyimpan identitas', true);
      } finally {
        btnSaveIdentity.disabled = false;
        btnSaveIdentity.textContent = 'Simpan Identitas';
      }
    });
  }

  // Delay Slider Input Listener
  const delayRange = document.getElementById('setting-delay-range');
  const delayDisplay = document.getElementById('delay-display-val');
  if (delayRange && delayDisplay) {
    delayRange.addEventListener('input', () => {
      const seconds = (Number(delayRange.value) / 1000).toFixed(1);
      delayDisplay.textContent = `${seconds} detik`;
    });
  }

  // Save Speed / Delay Parameter
  const btnSaveSpeed = document.getElementById('btn-save-speed');
  if (btnSaveSpeed) {
    btnSaveSpeed.addEventListener('click', async () => {
      const messageDelayMs = Number(delayRange?.value) || 2500;

      btnSaveSpeed.disabled = true;
      btnSaveSpeed.textContent = 'Menyimpan...';

      try {
        const data = await fetchApi('/api/settings', {
          method: 'PUT',
          body: { messageDelayMs },
        });

        if (data.success) {
          showToast(`Parameter jeda diperbarui menjadi ${(messageDelayMs / 1000).toFixed(1)} detik`);
        } else {
          showToast(data.error || 'Gagal menyimpan jeda pesan', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan', true);
      } finally {
        btnSaveSpeed.disabled = false;
        btnSaveSpeed.textContent = 'Simpan Parameter Kecepatan';
      }
    });
  }
}

export async function fetchSettings() {
  try {
    const res = await fetchApi('/api/settings');
    if (!res.success || !res.settings) return;

    const s = res.settings;

    // 1. Populate Bot Identity Inputs
    const botNameInput = document.getElementById('setting-bot-name');
    const prefixInput = document.getElementById('setting-prefix');
    const footerInput = document.getElementById('setting-footer');

    if (botNameInput) botNameInput.value = s.botName || '';
    if (prefixInput) prefixInput.value = s.prefix || '/';
    if (footerInput) footerInput.value = s.footerText || '';

    // 2. Populate AI Toggle
    const toggleAutoReply = document.getElementById('toggle-ai-autoreply');
    if (toggleAutoReply) toggleAutoReply.checked = Boolean(s.aiAutoReply);

    // 3. Populate Delay Range
    const delayRange = document.getElementById('setting-delay-range');
    const delayDisplay = document.getElementById('delay-display-val');
    if (delayRange && s.messageDelayMs) {
      delayRange.value = s.messageDelayMs;
      if (delayDisplay) delayDisplay.textContent = `${(s.messageDelayMs / 1000).toFixed(1)} detik`;
    }

    // 4. Render Dynamic RBAC Roles & Owners List
    fetchRoles();
  } catch (err) {}
}
