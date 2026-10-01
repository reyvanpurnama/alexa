import { fetchApi, showToast } from '../../api.js';
import { formatPhoneNumberDisplay } from './takeover.js';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatChatTime(isoString) {
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

        if (chat.source === 'intent') {
          pillClass = 'intent';
          pillLabel = '⚡ Slim Intent';
        } else if (chat.status === 'error') {
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

export function initChatActions() {
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
}
