import { fetchApi, showToast } from '../api.js';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatChatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 15) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;

  return (
    date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
}

function formatPhoneNumberDisplay(raw) {
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

function getInitials(name, fallback = '👤') {
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

  // Takeover & Escalation Action Buttons
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

  // Chat activity action buttons
  const btnRefreshChats = document.getElementById('btn-refresh-chats');
  if (btnRefreshChats) {
    btnRefreshChats.addEventListener('click', () => fetchRecentChats());
  }

  const btnClearChats = document.getElementById('btn-clear-chats');
  if (btnClearChats) {
    btnClearChats.addEventListener('click', async () => {
      if (!confirm('Hapus seluruh log riwayat percakapan di dashboard?')) return;
      try {
        const data = await fetchApi('/api/chats/clear', { method: 'DELETE' });
        if (data.success) {
          showToast('Riwayat percakapan dibersihkan');
          fetchRecentChats();
        } else {
          showToast(data.message || 'Gagal membersihkan riwayat', true);
        }
      } catch {
        showToast('Terjadi kesalahan saat membersihkan riwayat', true);
      }
    });
  }

  fetchOverviewStatus();
  fetchTakeoverStatus();
  fetchRecentChats();

  // Low-frequency quiet polling (Apple HIG Battery Saver Guard)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const overviewTab = document.getElementById('tab-overview');
      if (overviewTab && overviewTab.classList.contains('active')) {
        fetchTakeoverStatus(true);
        fetchRecentChats(true);
      }
    }
  }, 5000);
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

    // Dynamic AI Model & Provider update in Overview
    const providerEl = document.getElementById('overview-provider');
    const modelEl = document.getElementById('overview-model');
    if (providerEl || modelEl) {
      try {
        const aiData = await fetchApi('/api/settings/ai');
        if (aiData && aiData.success && aiData.ai) {
          if (providerEl) providerEl.textContent = (aiData.ai.provider || 'AI ENGINE').toUpperCase();
          if (modelEl) modelEl.textContent = `${aiData.ai.model || 'default'} · Knowledge base siap`;
        }
      } catch {}
    }
  } catch (err) {}
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

export async function fetchRecentChats(isSilent = false) {
  const container = document.getElementById('chat-activity-stream');
  const statsBadge = document.getElementById('chat-stats-badge');
  if (!container) return;

  try {
    const data = await fetchApi('/api/chats/recent?limit=25');
    if (!data.success) return;

    if (statsBadge) {
      if (data.stats && data.stats.totalCount > 0) {
        statsBadge.style.display = 'inline-block';
        const latencyTxt = data.stats.avgLatencyMs
          ? ` · rata-rata ${(data.stats.avgLatencyMs / 1000).toFixed(1)}s`
          : '';
        statsBadge.textContent = `${data.stats.todayCount} chat hari ini${latencyTxt}`;
      } else {
        statsBadge.style.display = 'none';
      }
    }

    const chats = data.chats || [];
    if (chats.length === 0) {
      container.innerHTML = `
        <div class="chat-empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Belum ada riwayat percakapan yang tercatat</span>
        </div>
      `;
      return;
    }

    container.innerHTML = chats
      .map((chat) => {
        let pillClass = 'replied';
        let pillLabel = 'AI Dijawab';

        if (chat.status === 'error') {
          pillClass = 'error';
          pillLabel = 'Kendala';
        } else if (chat.status === 'muted') {
          pillClass = 'muted';
          pillLabel = 'Admin Snooze';
        } else if (chat.status === 'command') {
          pillClass = 'command';
          pillLabel = 'Perintah';
        }

        const senderFormatted = formatPhoneNumberDisplay(chat.senderNumber) || 'Pengguna';
        const nameFormatted =
          chat.senderName && chat.senderName !== chat.senderNumber
            ? `${escapeHtml(chat.senderName)}`
            : senderFormatted;

        let botReplyHtml = '';
        if (chat.aiResponse) {
          botReplyHtml = `
            <div class="chat-bot-bubble">
              <div class="chat-text-content">${escapeHtml(chat.aiResponse)}</div>
              ${
                chat.latencyMs
                  ? `<div class="chat-latency-tag">⚡ Respon dalam ${(chat.latencyMs / 1000).toFixed(2)} detik</div>`
                  : ''
              }
            </div>
          `;
        } else if (chat.status === 'error') {
          botReplyHtml = `
            <div class="chat-bot-bubble" style="border-color: rgba(255, 69, 58, 0.25); background: rgba(255, 69, 58, 0.05); color: #ff6961;">
              Asisten AI mengalami kendala saat merespons pesan ini.
            </div>
          `;
        } else if (chat.status === 'muted') {
          botReplyHtml = `
            <div class="chat-bot-bubble" style="border-color: rgba(255, 159, 10, 0.25); background: rgba(255, 159, 10, 0.05); color: #ffb340;">
              AI dijeda (takeover staf/admin aktif). Pesan diarahkan ke pengelola.
            </div>
          `;
        }

        return `
          <div class="chat-log-card">
            <div class="chat-log-header">
              <div class="chat-log-sender">
                <span class="chat-log-sender-name">${nameFormatted}</span>
                <span class="chat-log-sender-phone">${senderFormatted}</span>
              </div>
              <div class="chat-log-meta">
                <span class="chat-pill ${pillClass}">${pillLabel}</span>
                <span class="chat-time">${formatChatTime(chat.createdAt)}</span>
              </div>
            </div>
            <div class="chat-bubbles-container">
              <div class="chat-user-bubble">
                <span style="opacity: 0.6; font-size: 11px;">Pesan:</span>
                <div>${escapeHtml(chat.userMessage)}</div>
              </div>
              ${botReplyHtml}
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    if (!isSilent) {
      console.warn('Failed to load recent chats:', err);
    }
  }
}
