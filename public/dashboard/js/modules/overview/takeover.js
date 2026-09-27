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

export function formatPhoneNumberDisplay(raw) {
  if (!raw) return '';
  let clean = String(raw).replace(/@s\.whatsapp\.net|@lid|@g\.us/g, '').replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  if (clean.startsWith('628')) {
    const prefix = clean.slice(0, 5);
    const p1 = `+${prefix.slice(0, 2)} ${prefix.slice(2)}`;
    const rest = clean.slice(5);
    if (rest.length <= 4) return `${p1}-${rest}`;
    if (rest.length <= 7) return `${p1}-${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `${p1}-${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (clean.startsWith('62') && clean.length >= 9) {
    const area = clean.slice(0, 4);
    const rest = clean.slice(4);
    return `+${area.slice(0, 2)} ${area.slice(2)}-${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return clean ? `+${clean}` : String(raw);
}

export function getInitials(name, fallback = '👤') {
  if (!name) return fallback;
  const cleaned = name.trim();
  if (/^[\d+\s\-()]+$/.test(cleaned)) {
    return '👤';
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export async function fetchTakeoverStatus(isSilent = false) {
  const container = document.getElementById('takeover-list-container');
  const countBadge = document.getElementById('takeover-count-badge');
  const btnUnmuteAll = document.getElementById('btn-unmute-all');
  if (!container) return;

  try {
    const data = await fetchApi('/api/takeover/muted');
    if (!data.success) return;

    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      if (countBadge) countBadge.style.display = 'none';
      if (btnUnmuteAll) btnUnmuteAll.style.display = 'none';

      container.innerHTML = `
        <div class="takeover-empty-calm">
          <div class="takeover-empty-icon">✓</div>
          <div class="takeover-empty-text">
            <span style="font-weight: 500; color: var(--text-primary);">Otonomi AI Berjalan Penuh</span>
            <span style="color: var(--text-tertiary); font-size: 12px;">Tidak ada nomor pelanggan yang sedang dijeda untuk eskalasi manual.</span>
          </div>
        </div>
      `;
      return;
    }

    if (countBadge) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = `${sessions.length} Dijeda`;
    }

    if (btnUnmuteAll) {
      btnUnmuteAll.style.display = 'inline-flex';
    }

    container.innerHTML = `
      <div class="takeover-list">
        ${sessions
          .map((s) => {
            const formattedPhone = s.formattedPhone || formatPhoneNumberDisplay(s.phone || s.id);
            const rawId = s.id ? s.id.replace(/\D/g, '') : '';
            const displayName =
              s.senderName && s.senderName !== s.phone && s.senderName !== rawId
                ? s.senderName
                : formattedPhone;
            const avatarText = getInitials(s.senderName);

            return `
              <div class="takeover-card-item">
                <div class="takeover-identity">
                  <div class="takeover-avatar" title="${escapeHtml(displayName)}">${escapeHtml(avatarText)}</div>
                  <div class="takeover-info">
                    <div class="takeover-header-line">
                      <span class="takeover-name">${escapeHtml(displayName)}</span>
                      <span class="takeover-phone">${escapeHtml(formattedPhone)}</span>
                    </div>
                    <div class="takeover-meta-row">
                      <span class="takeover-reason-tag">${escapeHtml(s.reasonLabel)}</span>
                      <span class="takeover-countdown">⏳ Sisa ${s.remainingMinutes} mnt lagi</span>
                    </div>
                  </div>
                </div>
                <div>
                  <button class="btn-unmute-action" data-target="${escapeHtml(s.id)}" title="Lanjutkan kembali mode AI otonom">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Lanjutkan AI
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    // Attach click listeners to individual unmute buttons
    container.querySelectorAll('.btn-unmute-action').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;

        btn.disabled = true;
        btn.textContent = 'Memproses...';

        try {
          const res = await fetchApi('/api/takeover/unmute', {
            method: 'POST',
            body: { targetId },
          });

          if (res.success) {
            showToast(`Percakapan +${targetId} dilanjutkan ke mode AI`);
            fetchTakeoverStatus();
          } else {
            showToast(res.message || 'Gagal mengaktifkan AI', true);
            btn.disabled = false;
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Lanjutkan AI`;
          }
        } catch {
          showToast('Terjadi kesalahan saat memproses unmute', true);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    if (!isSilent) {
      console.warn('Failed to fetch takeover status:', err);
    }
  }
}

export function initTakeoverActions() {
  const btnRefreshTakeover = document.getElementById('btn-refresh-takeover');
  if (btnRefreshTakeover) {
    btnRefreshTakeover.addEventListener('click', () => fetchTakeoverStatus());
  }

  const btnUnmuteAll = document.getElementById('btn-unmute-all');
  if (btnUnmuteAll) {
    btnUnmuteAll.addEventListener('click', async () => {
      if (!confirm('Lanjutkan kembali seluruh sesi percakapan ke mode AI otonom?')) return;
      try {
        const data = await fetchApi('/api/takeover/unmute-all', { method: 'POST' });
        if (data.success) {
          showToast(data.message || 'Semua sesi percakapan dikembalikan ke AI');
          fetchTakeoverStatus();
        } else {
          showToast(data.error || 'Gagal mereset sesi takeover', true);
        }
      } catch {
        showToast('Terjadi kesalahan mereset sesi takeover', true);
      }
    });
  }
}
