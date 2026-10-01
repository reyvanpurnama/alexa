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

export async function fetchIntents() {
  const container = document.getElementById('intent-cards-container');
  const countBadge = document.getElementById('intent-count-badge');
  const toggleEl = document.getElementById('toggle-intent-router');

  try {
    const data = await fetchApi('/api/ai/intents');
    if (!data.success) return;

    if (countBadge) {
      countBadge.textContent = String(data.total || 0);
    }

    if (toggleEl && data.enabled !== undefined) {
      toggleEl.checked = Boolean(data.enabled);
    }

    if (!container) return;

    const intents = data.intents || [];
    if (intents.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 24px;">
          Belum ada intent terdaftar. Intent kustom dapat didaftarkan via kode melalui <code>intentRouter.registerIntent()</code>.
        </div>
      `;
      return;
    }

    container.innerHTML = intents
      .map((intent) => {
        // Roles pills
        const rolesBadges = (intent.roles || [])
          .map((r) => {
            const rUpper = r.toUpperCase();
            let pillClass = 'role-public';
            if (rUpper === 'OWNER') pillClass = 'role-owner';
            else if (rUpper === 'ADMIN') pillClass = 'role-admin';
            else if (rUpper === 'STAFF' || rUpper === 'EXECUTIVE') pillClass = 'role-staff';
            else if (rUpper === 'VIP' || rUpper === 'MEMBER') pillClass = 'role-vip';
            else if (rUpper === '*') pillClass = 'role-public';

            return `<span class="role-pill ${pillClass}">${rUpper === '*' ? 'SEMUA PERAN (*)' : rUpper}</span>`;
          })
          .join(' ');

        // Patterns chips
        const patternChips = (intent.patterns || [])
          .slice(0, 4)
          .map((p) => `<span class="pattern-chip">/${escapeHtml(p)}/</span>`)
          .join(' ');

        // Params tags
        const paramKeys = Object.keys(intent.parameters || {});
        const paramsSummary =
          paramKeys.length > 0
            ? `<span style="font-family: var(--font-mono); color: var(--text-tertiary);">params: ${paramKeys.join(', ')}</span>`
            : '';

        return `
          <div class="intent-card">
            <div class="intent-card-top">
              <div class="intent-card-title">
                <span class="intent-name-badge">⚡ ${escapeHtml(intent.name)}</span>
                <span class="tier-badge tier-intent-1">0 Tokens (<1ms)</span>
              </div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${rolesBadges}
              </div>
            </div>
            <div class="intent-desc">${escapeHtml(intent.description)}</div>
            <div class="intent-details-row">
              <span style="font-weight: 500; color: var(--text-secondary);">Pemicu Cepat (Tier 1):</span>
              ${patternChips || '<span style="color: var(--text-tertiary); font-style: italic;">Natural Language only</span>'}
              ${paramsSummary}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to fetch intents:', err);
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--accent-red); font-size: 12px; padding: 20px;">
          Gagal memuat katalog intent. Periksa koneksi backend.
        </div>
      `;
    }
  }
}

export function initIntentCatalog() {
  const toggleEl = document.getElementById('toggle-intent-router');
  if (toggleEl) {
    toggleEl.addEventListener('change', async () => {
      const isChecked = toggleEl.checked;
      try {
        const res = await fetchApi('/api/ai/intents/toggle', {
          method: 'PUT',
          body: { enabled: isChecked },
        });

        if (res.success) {
          showToast(
            isChecked
              ? 'Slim Intent Router diaktifkan (kueri hemat token aktif)'
              : 'Slim Intent Router dinonaktifkan (fallback ke general AI)'
          );
        } else {
          toggleEl.checked = !isChecked;
          showToast(res.error || 'Gagal mengubah status router', true);
        }
      } catch (err) {
        toggleEl.checked = !isChecked;
        showToast('Kesalahan jaringan saat mengubah status router', true);
      }
    });
  }

  // Fetch initial intents
  fetchIntents();
}
