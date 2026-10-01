import { fetchApi, showToast } from '../../api.js';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchRoles() {
  const listEl = document.getElementById('owners-list');
  const countBadge = document.getElementById('owners-count-badge');
  if (!listEl) return;

  try {
    const data = await fetchApi('/api/settings/roles');
    if (!data.success) return;

    const userRoles = data.userRoles || {};
    const ownerNumbers = data.ownerNumbers || [];

    // Aggregate unique phone numbers from both ownerNumbers and userRoles
    const allPhones = Array.from(new Set([...ownerNumbers, ...Object.keys(userRoles)]));

    if (countBadge) {
      countBadge.textContent = `${allPhones.length} Pengguna Berperan`;
    }

    if (allPhones.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 14px;">
          Belum ada pengguna atau pengelola terdaftar.
        </div>
      `;
      return;
    }

    listEl.innerHTML = allPhones
      .map((phone) => {
        const record = userRoles[phone];
        const isOwner = ownerNumbers.includes(phone);
        const role = record?.role ? record.role.toUpperCase() : isOwner ? 'OWNER' : 'PUBLIC';
        const name = record?.name ? escapeHtml(record.name) : isOwner ? 'Pemilik Sistem' : 'Pengguna Terdaftar';

        let pillClass = 'role-public';
        let avatarIcon = '👤';

        if (role === 'OWNER') {
          pillClass = 'role-owner';
          avatarIcon = '👑';
        } else if (role === 'ADMIN') {
          pillClass = 'role-admin';
          avatarIcon = '🛡️';
        } else if (role === 'STAFF' || role === 'EXECUTIVE') {
          pillClass = 'role-staff';
          avatarIcon = '💼';
        } else if (role === 'VIP' || role === 'MEMBER' || role === 'SUPPLIER') {
          pillClass = 'role-vip';
          avatarIcon = '⭐';
        }

        return `
          <div class="owner-card-item">
            <div class="owner-identity">
              <div class="owner-symbol-avatar">${avatarIcon}</div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${name}</span>
                  <span class="role-pill ${pillClass}">${role}</span>
                </div>
                <div class="owner-phone-text" style="font-size: 11.5px; color: var(--text-tertiary);">+${phone}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <select class="form-input rbac-role-select" data-phone="${phone}" style="width: auto; font-size: 11px; padding: 3px 8px; border-radius: 6px;">
                <option value="OWNER" ${role === 'OWNER' ? 'selected' : ''}>OWNER</option>
                <option value="ADMIN" ${role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                <option value="STAFF" ${role === 'STAFF' ? 'selected' : ''}>STAFF</option>
                <option value="VIP" ${role === 'VIP' ? 'selected' : ''}>VIP</option>
                <option value="PUBLIC" ${role === 'PUBLIC' ? 'selected' : ''}>PUBLIC</option>
              </select>
              ${
                ownerNumbers.length === 1 && isOwner && allPhones.length === 1
                  ? '<span style="font-size: 11px; color: var(--text-tertiary); padding: 0 4px;">Wajib 1</span>'
                  : `<button class="btn btn-ghost btn-sm" data-action="delete-role-user" data-phone="${phone}" style="color: var(--accent-red); font-size: 11px; padding: 4px 8px;">Hapus</button>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    // Attach inline role change listeners
    listEl.querySelectorAll('.rbac-role-select').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const phone = select.getAttribute('data-phone');
        const newRole = select.value;
        if (!phone) return;

        try {
          const res = await fetchApi('/api/settings/roles', {
            method: 'POST',
            body: { phone, role: newRole },
          });

          if (res.success) {
            showToast(`Peran +${phone} berhasil diubah menjadi ${newRole}`);
            fetchRoles();
          } else {
            showToast(res.error || 'Gagal mengubah peran', true);
            fetchRoles(); // revert
          }
        } catch (err) {
          showToast('Kesalahan jaringan saat mengubah peran', true);
          fetchRoles();
        }
      });
    });

    // Attach delete user listener
    listEl.querySelectorAll('[data-action="delete-role-user"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const phone = btn.getAttribute('data-phone');
        if (!phone) return;

        const confirmed = window.confirm(`Hapus peran dan hak akses untuk nomor +${phone}?`);
        if (!confirmed) return;

        try {
          // Delete from both roles and owners endpoint to ensure clean removal
          await fetchApi(`/api/settings/roles/${phone}`, { method: 'DELETE' });
          await fetchApi(`/api/settings/owners/${phone}`, { method: 'DELETE' }).catch(() => {});

          showToast(`Hak akses nomor +${phone} berhasil dihapus`);
          fetchRoles();
        } catch (err) {
          showToast('Kesalahan jaringan saat menghapus peran', true);
        }
      });
    });
  } catch (err) {
    console.error('Failed to fetch roles:', err);
  }
}

export function initRoles() {
  const btnAdd = document.getElementById('btn-add-owner');
  const inputPhone = document.getElementById('new-owner-input');
  const inputName = document.getElementById('new-role-name-input');
  const selectRole = document.getElementById('new-role-select');

  if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
      const phone = inputPhone?.value.trim().replace(/\D/g, '');
      const name = inputName?.value.trim();
      const role = selectRole?.value || 'OWNER';

      if (!phone || phone.length < 8) {
        showToast('Masukkan nomor WhatsApp yang valid (minimal 8 digit)', true);
        inputPhone?.focus();
        return;
      }

      btnAdd.disabled = true;
      btnAdd.textContent = 'Menyimpan...';

      try {
        const res = await fetchApi('/api/settings/roles', {
          method: 'POST',
          body: { phone, role, name },
        });

        if (res.success) {
          showToast(`Peran ${role} berhasil ditetapkan ke +${phone}`);
          if (inputPhone) inputPhone.value = '';
          if (inputName) inputName.value = '';
          fetchRoles();
        } else {
          showToast(res.error || 'Gagal menetapkan peran', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menetapkan peran', true);
      } finally {
        btnAdd.disabled = false;
        btnAdd.textContent = '+ Tetapkan';
      }
    });
  }

  fetchRoles();
}
