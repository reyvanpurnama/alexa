import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';
import { waClient } from '../../core/whatsapp.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard', async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.BOT_NAME} — Control Center & Automation Gateway</title>
  <meta name="description" content="Production-grade WhatsApp business automation engine and autonomous AI assistant.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-canvas: #090a0f;
      --bg-surface: rgba(18, 20, 29, 0.75);
      --bg-surface-elevated: rgba(26, 29, 43, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-tertiary: #64748b;
      --accent-blue: #0a84ff;
      --accent-blue-glow: rgba(10, 132, 255, 0.25);
      --accent-green: #30d158;
      --accent-green-glow: rgba(48, 209, 88, 0.25);
      --accent-amber: #ff9f0a;
      --accent-amber-glow: rgba(255, 159, 10, 0.25);
      --accent-red: #ff453a;
      --accent-purple: #bf5af2;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --radius-pill: 9999px;
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-canvas);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(10, 132, 255, 0.07) 0%, transparent 45%),
        radial-gradient(circle at 85% 85%, rgba(191, 90, 242, 0.05) 0%, transparent 45%);
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 24px 16px 64px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header Nav */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px 24px;
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      margin-bottom: 28px;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      color: #fff;
      box-shadow: 0 4px 16px var(--accent-blue-glow);
    }

    h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary);
    }

    .brand-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-tertiary);
    }

    .status-badge.CONNECTED .status-dot {
      background: var(--accent-green);
      box-shadow: 0 0 10px var(--accent-green);
      animation: pulse-dot 2s infinite ease-in-out;
    }

    .status-badge.DISCONNECTED .status-dot {
      background: var(--accent-red);
    }

    .status-badge.PAIRING_READY .status-dot,
    .status-badge.QR_READY .status-dot {
      background: var(--accent-amber);
      animation: pulse-dot 1.5s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
      user-select: none;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-secondary {
      background: var(--bg-surface-elevated);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--border-strong);
    }

    .btn-primary {
      background: var(--accent-blue);
      color: #fff;
      box-shadow: 0 4px 14px var(--accent-blue-glow);
    }

    .btn-primary:hover {
      background: #0077ed;
      box-shadow: 0 6px 20px var(--accent-blue-glow);
    }

    .btn-danger {
      background: rgba(255, 69, 58, 0.15);
      color: var(--accent-red);
      border-color: rgba(255, 69, 58, 0.3);
    }

    .btn-danger:hover {
      background: rgba(255, 69, 58, 0.25);
    }

    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .bento-card {
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .bento-card:hover {
      border-color: var(--border-strong);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-kpi {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .card-sub {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }

    @media (max-width: 900px) {
      .col-4, .col-6, .col-8 { grid-column: span 12; }
    }

    /* Table / List */
    .table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 28px;
    }

    .section-title {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }

    .section-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 20px;
    }

    .sessions-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .sessions-table th {
      padding: 12px 16px;
      font-size: 12px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-subtle);
    }

    .sessions-table td {
      padding: 16px;
      font-size: 14px;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }

    .sessions-table tr:last-child td {
      border-bottom: none;
    }

    .active-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      background: rgba(48, 209, 88, 0.15);
      color: var(--accent-green);
      border: 1px solid rgba(48, 209, 88, 0.3);
      margin-left: 8px;
    }

    /* Forms */
    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 10px 14px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px var(--accent-blue-glow);
    }

    /* Pairing Platter */
    .pairing-display {
      background: rgba(10, 132, 255, 0.08);
      border: 1px dashed rgba(10, 132, 255, 0.3);
      border-radius: var(--radius-lg);
      padding: 24px;
      text-align: center;
      margin-top: 16px;
      display: none;
    }

    .pairing-code {
      font-family: var(--font-mono);
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: #fff;
      text-shadow: 0 2px 10px var(--accent-blue-glow);
      margin: 12px 0;
    }

    /* Toast */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .toast {
      padding: 12px 20px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      animation: toast-in 0.2s ease-out;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="brand-wrap">
        <div class="brand-logo">A</div>
        <div>
          <h1>${config.BOT_NAME} Control Center</h1>
          <p class="brand-subtitle">WhatsApp Automation Engine & AI Assistant</p>
        </div>
      </div>
      <div class="header-actions">
        <div id="status-pill" class="status-badge ${waClient.getStatus()}">
          <span class="status-dot"></span>
          <span id="status-text">${waClient.getStatus()}</span>
        </div>
        <a href="/docs" class="btn btn-secondary" target="_blank" id="btn-api-docs">API Docs</a>
      </div>
    </header>

    <!-- Top Bento Grid -->
    <div class="bento-grid">
      <!-- Card 1: Active Connection -->
      <div class="bento-card col-4">
        <div>
          <div class="card-header">
            <span class="card-title">Nomor Aktif</span>
            <span style="font-size: 11px; color: var(--accent-green);">● WhatsApp Live</span>
          </div>
          <div class="card-kpi" id="active-phone">${waClient.user ? '+' + waClient.user.id : 'Unpaired'}</div>
          <p class="card-sub" id="active-name">${waClient.user?.name || 'Belum ditautkan'}</p>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 8px;">
          <button class="btn btn-danger btn-sm" id="btn-logout" style="width: 100%;">Disconnect Sesi</button>
        </div>
      </div>

      <!-- Card 2: Active Profile & Hot-Swap -->
      <div class="bento-card col-4">
        <div>
          <div class="card-header">
            <span class="card-title">Profil Sesi Aktif</span>
            <span style="font-size: 11px; color: var(--accent-blue);">Hot-Swap Ready</span>
          </div>
          <div class="card-kpi" id="active-session-name" style="font-family: var(--font-mono); font-size: 22px;">${waClient.getActiveSessionName()}</div>
          <p class="card-sub">Tersimpan aman di direktori <code>sessions/</code></p>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn btn-secondary" id="btn-open-pair" style="width: 100%;">Tautkan Nomor Baru</button>
        </div>
      </div>

      <!-- Card 3: AI & Knowledge Engine -->
      <div class="bento-card col-4">
        <div>
          <div class="card-header">
            <span class="card-title">AI & Knowledge Base</span>
            <span style="font-size: 11px; color: var(--accent-purple);">Grounding Active</span>
          </div>
          <div class="card-kpi" style="font-size: 20px;">${config.AI_PROVIDER.toUpperCase()}</div>
          <p class="card-sub" id="ai-model-name">${config.AI_MODEL || 'default-model'}</p>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn btn-secondary" id="btn-reload-kb" style="width: 100%;">Refresh Knowledge Base</button>
        </div>
      </div>
    </div>

    <!-- Section: Session Profiles Management -->
    <div class="table-card">
      <div class="card-header">
        <div>
          <h2 class="section-title">Manajemen Profil Nomor (Hot-Swap)</h2>
          <p class="section-desc">Ganti nomor WhatsApp aktif secara instan tanpa menghapus kredensial sesi nomor sebelumnya.</p>
        </div>
      </div>
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Nama Profil</th>
            <th>Nomor Terdaftar</th>
            <th>Nama Akun</th>
            <th>Status</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody id="sessions-list">
          <tr><td colspan="5" style="text-align: center; color: var(--text-tertiary);">Memuat daftar sesi...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Section: New Session & Pairing Drawer -->
    <div class="bento-grid">
      <div class="bento-card col-6">
        <h2 class="section-title">Tautkan Nomor WhatsApp Baru</h2>
        <p class="section-desc">Generate 8-digit Pairing Code untuk menautkan nomor baru tanpa scan QR.</p>
        <div class="form-group">
          <label class="form-label" for="pairing-number">Nomor WhatsApp (Contoh: 628123456789)</label>
          <input type="text" id="pairing-number" class="form-input" placeholder="628123456789" />
        </div>
        <button class="btn btn-primary" id="btn-generate-pairing" style="width: 100%;">Minta Kode Pairing</button>

        <div class="pairing-display" id="pairing-display">
          <p style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase;">Kode Pairing Anda:</p>
          <div class="pairing-code" id="code-output">---- ----</div>
          <p style="font-size: 13px; color: var(--text-secondary);">
            Buka WhatsApp di HP &rarr; <b>Perangkat Tertaut</b> &rarr; <b>Tautkan dengan nomor telepon</b> &rarr; masukkan kode di atas.
          </p>
        </div>
      </div>

      <!-- Quick Message Tester -->
      <div class="bento-card col-6">
        <h2 class="section-title">Uji Coba Kirim Pesan (Tester)</h2>
        <p class="section-desc">Kirim pesan WhatsApp langsung melalui REST API antrean anti-ban.</p>
        <div class="form-group">
          <label class="form-label" for="test-recipient">Nomor Tujuan</label>
          <input type="text" id="test-recipient" class="form-input" placeholder="628123456789" />
        </div>
        <div class="form-group">
          <label class="form-label" for="test-message">Isi Pesan</label>
          <textarea id="test-message" class="form-textarea" rows="3" placeholder="Halo! Ini adalah pesan uji coba dari Alexa Gateway."></textarea>
        </div>
        <button class="btn btn-secondary" id="btn-send-test" style="width: 100%;">Kirim Pesan Uji Coba</button>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script>
    const API_KEY = "${config.API_KEY}";

    function showToast(message, isError = false) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--accent-green)';
      toast.innerHTML = (isError ? '⚠️ ' : '✓ ') + message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.success) {
          const pill = document.getElementById('status-pill');
          pill.className = 'status-badge ' + data.status;
          document.getElementById('status-text').textContent = data.status;

          if (data.user) {
            document.getElementById('active-phone').textContent = '+' + data.user.id;
            document.getElementById('active-name').textContent = data.user.name || 'Terhubung';
          } else {
            document.getElementById('active-phone').textContent = 'Unpaired';
            document.getElementById('active-name').textContent = 'Belum ditautkan';
          }
        }
      } catch (e) {
        console.error('Error fetching status:', e);
      }
    }

    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions', {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('active-session-name').textContent = data.activeSession;
          const tbody = document.getElementById('sessions-list');
          tbody.innerHTML = '';

          if (data.sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada sesi tersimpan</td></tr>';
            return;
          }

          data.sessions.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>
                <span style="font-family: var(--font-mono); font-weight:600;">\${s.name}</span>
                \${s.isActive ? '<span class="active-tag">AKTIF</span>' : ''}
              </td>
              <td>\${s.phoneNumber ? '+' + s.phoneNumber : '<span style="color:var(--text-tertiary);">-</span>'}</td>
              <td>\${s.pushName || '<span style="color:var(--text-tertiary);">-</span>'}</td>
              <td>
                <span style="color: \${s.registered ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-size:12px; font-weight:600;">
                  \${s.registered ? '● Paired' : '○ Standby'}
                </span>
              </td>
              <td style="text-align: right;">
                \${!s.isActive ? \`<button class="btn btn-secondary btn-sm" onclick="switchSession('\${s.name}')" style="padding:4px 10px; font-size:12px;">Switch</button>\` : '<span style="font-size:12px; color:var(--text-tertiary);">Sedang digunakan</span>'}
              </td>
            \`;
            tbody.appendChild(tr);
          });
        }
      } catch (e) {
        console.error('Error fetching sessions:', e);
      }
    }

    window.switchSession = async function(sessionName) {
      try {
        const res = await fetch('/api/sessions/switch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: JSON.stringify({ sessionName })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Beralih ke profil: ' + sessionName);
          setTimeout(() => {
            fetchStatus();
            fetchSessions();
          }, 1500);
        } else {
          showToast(data.error || 'Gagal beralih sesi', true);
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan', true);
      }
    };

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
      if (!confirm('Yakin ingin memutuskan koneksi sesi aktif?')) return;
      try {
        const res = await fetch('/api/session/logout', {
          method: 'POST',
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          showToast('Sesi berhasil diputuskan');
          fetchStatus();
          fetchSessions();
        } else {
          showToast('Gagal memutuskan sesi', true);
        }
      } catch (err) {
        showToast('Kesalahan saat memutus sesi', true);
      }
    });

    // Generate Pairing Code
    document.getElementById('btn-generate-pairing').addEventListener('click', async () => {
      const phoneInput = document.getElementById('pairing-number');
      const phoneNumber = phoneInput.value.trim();
      if (!phoneNumber) {
        showToast('Masukkan nomor telepon terlebih dahulu', true);
        return;
      }

      const btn = document.getElementById('btn-generate-pairing');
      btn.textContent = 'Meminta kode...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/pairing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success && data.code) {
          document.getElementById('code-output').textContent = data.code;
          document.getElementById('pairing-display').style.display = 'block';
          showToast('Kode pairing berhasil dibuat!');
        } else {
          showToast(data.error || 'Gagal membuat kode pairing', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat meminta kode pairing', true);
      } finally {
        btn.textContent = 'Minta Kode Pairing';
        btn.disabled = false;
      }
    });

    // Refresh KB
    document.getElementById('btn-reload-kb').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/knowledge/reload', {
          method: 'POST',
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          showToast('Knowledge base reloaded! (' + data.stats.length + ' chars)');
        }
      } catch (e) {
        showToast('Gagal me-reload knowledge base', true);
      }
    });

    // Send Test Message
    document.getElementById('btn-send-test').addEventListener('click', async () => {
      const to = document.getElementById('test-recipient').value.trim();
      const message = document.getElementById('test-message').value.trim();

      if (!to || !message) {
        showToast('Nomor tujuan dan isi pesan wajib diisi', true);
        return;
      }

      try {
        const res = await fetch('/api/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: JSON.stringify({ to, message })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Pesan berhasil masuk antrean pengiriman!');
          document.getElementById('test-message').value = '';
        } else {
          showToast(data.error || 'Gagal mengirim pesan', true);
        }
      } catch (e) {
        showToast('Terjadi kesalahan pengiriman pesan', true);
      }
    });

    // Initial load & Polling
    fetchStatus();
    fetchSessions();
    setInterval(fetchStatus, 4000);
  </script>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
};
