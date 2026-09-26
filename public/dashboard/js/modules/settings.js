import { fetchApi, showToast } from '../api.js';

export function initSettings() {
  // Add Owner Number
  const btnAddOwner = document.getElementById('btn-add-owner');
  if (btnAddOwner) {
    btnAddOwner.addEventListener('click', async () => {
      const input = document.getElementById('new-owner-input');
      const phoneNumber = input?.value.trim();

      if (!phoneNumber || phoneNumber.length < 8) {
        showToast('Masukkan nomor telepon pengelola yang valid (minimal 8 digit)', true);
        input?.focus();
        return;
      }

      btnAddOwner.disabled = true;
      btnAddOwner.textContent = 'Menyimpan...';

      try {
        const data = await fetchApi('/api/settings/owners', {
          method: 'POST',
          body: { phoneNumber },
        });

        if (data.success) {
          showToast(`Nomor pengelola +${phoneNumber.replace(/\D/g, '')} berhasil ditambahkan`);
          if (input) input.value = '';
          fetchSettings();
        } else {
          showToast(data.error || 'Gagal menambahkan pengelola', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menambahkan pengelola', true);
      } finally {
        btnAddOwner.disabled = false;
        btnAddOwner.textContent = '+ Tambah';
      }
    });
  }

  // Toggle AI Auto-Reply Switch
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

    // 4. Render Owner Numbers List
    const ownersListEl = document.getElementById('owners-list');
    const countBadge = document.getElementById('owners-count-badge');
    const owners = s.ownerNumbers || [];

    if (countBadge) countBadge.textContent = `${owners.length} Pengelola`;

    if (!ownersListEl) return;
    ownersListEl.innerHTML = '';

    if (owners.length === 0) {
      ownersListEl.innerHTML =
        '<div style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 12px;">Belum ada nomor pengelola terdaftar.</div>';
      return;
    }

    owners.forEach((num, idx) => {
      const isPrimary = idx === 0;
      const roleLabel = isPrimary ? '👑 Pemilik Utama' : '🛡️ Admin Pengelola';
      const item = document.createElement('div');
      item.className = 'owner-item';

      item.innerHTML = `
        <div class="owner-info">
          <div class="owner-avatar">${isPrimary ? '👑' : '🛡️'}</div>
          <div>
            <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--text-primary);">+${num}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 1px;">${roleLabel}</div>
          </div>
        </div>
        <div>
          ${
            owners.length > 1
              ? `<button class="btn btn-ghost btn-sm" data-action="delete-owner" data-phone="${num}" style="color: var(--accent-red); font-size: 11px;">Hapus</button>`
              : '<span style="font-size: 11px; color: var(--text-tertiary);">Wajib Minimal 1</span>'
          }
        </div>
      `;

      ownersListEl.appendChild(item);
    });

    // Attach Delete Owner Listeners
    ownersListEl.querySelectorAll('[data-action="delete-owner"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const phone = btn.getAttribute('data-phone');
        if (!phone) return;

        const confirmed = window.confirm(`Cabut hak pengelola dari nomor +${phone}?`);
        if (!confirmed) return;

        try {
          const result = await fetchApi(`/api/settings/owners/${phone}`, { method: 'DELETE' });
          if (result.success) {
            showToast(`Nomor +${phone} dihapus dari daftar pengelola`);
            fetchSettings();
          } else {
            showToast(result.error || 'Gagal menghapus nomor pengelola', true);
          }
        } catch (err) {
          showToast('Kesalahan jaringan saat menghapus pengelola', true);
        }
      });
    });
  } catch (err) {}
}
