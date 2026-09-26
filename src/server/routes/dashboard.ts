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
  <title>${config.BOT_NAME}</title>
  <meta name="description" content="Minimalist WhatsApp automation engine and autonomous AI assistant.">
  <style>
    :root {
      --bg-canvas: #000000;
      --bg-surface: #141416;
      --bg-surface-elevated: #1e1e22;
      --bg-surface-hover: #26262c;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text-primary: #f5f5f7;
      --text-secondary: #86868b;
      --text-tertiary: #545458;
      --accent-blue: #0071e3;
      --accent-blue-hover: #0077ed;
      --accent-green: #30d158;
      --accent-amber: #ff9f0a;
      --accent-red: #ff453a;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-pill: 9999px;
      --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 24px 16px 80px;
    }

    .container {
      max-width: 1080px;
      margin: 0 auto;
    }

    /* Minimalist Apple Top Bar */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      margin-bottom: 24px;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-logo {
      width: 28px;
      height: 28px;
      background: var(--text-primary);
      color: var(--bg-canvas);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
    }

    .brand-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-tertiary);
    }

    .status-indicator.CONNECTED .status-dot {
      background: var(--accent-green);
    }

    .status-indicator.PAIRING_READY .status-dot,
    .status-indicator.QR_READY .status-dot {
      background: var(--accent-amber);
    }

    .status-indicator.DISCONNECTED .status-dot {
      background: var(--accent-red);
    }

    /* Segmented Navigation Control (Quiet & Centered) */
    .nav-bar {
      display: flex;
      justify-content: center;
      margin-bottom: 28px;
    }

    .segmented-control {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #111113;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-pill);
      padding: 3px;
    }

    .seg-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 500;
      padding: 7px 18px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .seg-btn:hover {
      color: var(--text-primary);
    }

    .seg-btn.active {
      background: #242428;
      color: var(--text-primary);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      font-weight: 600;
    }

    /* Buttons (Tactile & Restrained) */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      user-select: none;
      font-family: var(--font-sans);
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-secondary {
      background: var(--bg-surface-elevated);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-surface-hover);
      border-color: var(--border-strong);
    }

    .btn-primary {
      background: var(--accent-blue);
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--accent-blue-hover);
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
      border-color: transparent;
      padding: 6px 10px;
    }

    .btn-ghost:hover:not(:disabled) {
      color: var(--accent-red);
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
      border-radius: var(--radius-sm);
    }

    /* Cards */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 16px;
    }

    .bento-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-7 { grid-column: span 7; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }

    @media (max-width: 860px) {
      .col-4, .col-6, .col-7, .col-8 { grid-column: span 12; }
      .bento-grid { gap: 12px; }
      .seg-btn { padding: 6px 12px; font-size: 12px; }
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: -0.01em;
      margin-bottom: 12px;
    }

    .card-display {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin-bottom: 2px;
      font-variant-numeric: tabular-nums;
    }

    .card-meta {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    /* Forms */
    .form-group {
      margin-bottom: 14px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-input, .form-textarea {
      width: 100%;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }

    .form-textarea {
      font-family: var(--font-mono);
      font-size: 12px;
      resize: vertical;
      line-height: 1.6;
    }

    .form-input:focus, .form-textarea:focus {
      border-color: var(--accent-blue);
    }

    /* Pacing Controls */
    .pacing-group {
      display: flex;
      gap: 6px;
      margin-bottom: 14px;
    }

    .pacing-btn {
      flex: 1;
      padding: 8px 6px;
      font-size: 12px;
      font-weight: 500;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }

    .pacing-btn.active {
      background: rgba(0, 113, 227, 0.14);
      border-color: var(--accent-blue);
      color: var(--text-primary);
      font-weight: 600;
    }

    /* Table */
    .apple-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    .apple-table th {
      padding: 10px 12px;
      color: var(--text-tertiary);
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-subtle);
    }

    .apple-table td {
      padding: 12px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    .apple-table tr:last-child td {
      border-bottom: none;
    }

    /* Pairing Code Display */
    .pairing-box {
      margin-top: 14px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: 16px;
      text-align: center;
      display: none;
    }

    .pairing-digits {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--accent-green);
      margin: 8px 0;
      font-variant-numeric: tabular-nums;
    }

    /* Tab Views */
    .tab-view {
      display: none;
    }

    .tab-view.active {
      display: block;
      animation: tab-fade 0.15s ease;
    }

    @keyframes tab-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Minimalist Toast */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .toast {
      padding: 10px 16px;
      background: #1c1c1e;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="brand-wrap">
        <div class="brand-logo">A</div>
        <span class="brand-title">${config.BOT_NAME}</span>
      </div>

      <div class="header-actions">
        <div id="status-wrap" class="status-indicator ${waClient.getStatus()}">
          <span class="status-dot"></span>
          <span id="status-label">${waClient.getStatus()}</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-logout" title="Putus koneksi WhatsApp">Disconnect</button>
      </div>
    </header>

    <!-- Segmented Navigation Bar -->
    <div class="nav-bar">
      <nav class="segmented-control" role="tablist">
        <button class="seg-btn active" data-tab="tab-overview" role="tab">Ringkasan</button>
        <button class="seg-btn" data-tab="tab-sessions" role="tab">Nomor & Sesi</button>
        <button class="seg-btn" data-tab="tab-broadcast" role="tab">Smart Broadcast</button>
        <button class="seg-btn" data-tab="tab-ai" role="tab">Asisten AI</button>
      </nav>
    </div>

    <!-- TAB 1: RINGKASAN (OVERVIEW) -->
    <div id="tab-overview" class="tab-view active">
      <div class="bento-grid">
        <!-- Active WhatsApp Identity -->
        <div class="bento-card col-6">
          <div>
            <div class="card-title">Koneksi WhatsApp</div>
            <div class="card-display" id="overview-phone">${waClient.user ? '+' + waClient.user.id : 'Unpaired'}</div>
            <div class="card-meta" id="overview-name">${waClient.user?.name || 'Belum ditautkan'} · Sesi: <code id="overview-session">${waClient.getActiveSessionName()}</code></div>
          </div>
          <div style="margin-top: 24px; display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="switchTab('tab-sessions')">Ganti Nomor</button>
            <div id="active-queue-banner" style="display: none; align-items: center; font-size: 12px; color: var(--accent-blue); font-family: var(--font-mono); margin-left: auto;">
              <span id="queue-count">0</span> pesan dalam antrean
            </div>
          </div>
        </div>

        <!-- AI Engine & Knowledge Context -->
        <div class="bento-card col-6">
          <div>
            <div class="card-title">Model Asisten AI</div>
            <div class="card-display" style="font-size: 22px;">${config.AI_PROVIDER.toUpperCase()}</div>
            <div class="card-meta" id="overview-model">${config.AI_MODEL || 'default-model'} · Knowledge base siap</div>
          </div>
          <div style="margin-top: 24px;">
            <button class="btn btn-secondary btn-sm" onclick="switchTab('tab-ai')">Buka Pengaturan AI</button>
          </div>
        </div>

        <!-- Quick Message Sender -->
        <div class="bento-card col-12">
          <div class="card-title">Uji Pengiriman Pesan</div>
          <div style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 10px; align-items: end;">
            <div>
              <label class="form-label" for="test-to">Nomor Tujuan</label>
              <input type="text" id="test-to" class="form-input" placeholder="628123456789" />
            </div>
            <div>
              <label class="form-label" for="test-msg">Isi Pesan</label>
              <input type="text" id="test-msg" class="form-input" placeholder="Halo! Pesan uji coba sistem." />
            </div>
            <div>
              <button class="btn btn-secondary" id="btn-quick-send" style="height: 38px;">Kirim Pesan</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: NOMOR & SESI (SESSIONS & PAIRING) -->
    <div id="tab-sessions" class="tab-view">
      <div class="bento-grid">
        <div class="bento-card col-7">
          <div class="card-title">Profil Nomor Tersimpan</div>
          <table class="apple-table">
            <thead>
              <tr>
                <th>Profil</th>
                <th>Nomor Telepon</th>
                <th style="text-align: right;">Aksi</th>
              </tr>
            </thead>
            <tbody id="sessions-table-body">
              <tr><td colspan="3" style="text-align: center; color: var(--text-tertiary);">Memuat sesi...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="bento-card col-5">
          <div class="card-title">Tautkan Nomor Baru</div>
          <div class="form-group">
            <label class="form-label" for="pairing-input">Nomor Telepon WhatsApp</label>
            <input type="text" id="pairing-input" class="form-input" placeholder="628123456789" />
          </div>
          <button class="btn btn-primary" id="btn-request-pairing" style="width: 100%;">Minta Kode Pairing</button>

          <div class="pairing-box" id="pairing-box">
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase;">Kode Pairing:</div>
            <div class="pairing-digits" id="pairing-code-text">---- ----</div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Buka WhatsApp &rarr; <b>Perangkat Tertaut</b> &rarr; <b>Tautkan dengan nomor telepon</b>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: SMART BROADCAST -->
    <div id="tab-broadcast" class="tab-view">
      <div class="bento-grid">
        <!-- Left: Input Form -->
        <div class="bento-card col-7">
          <div class="card-title">Kampanye Pesan Massal</div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <label class="form-label" for="bc-targets" style="margin-bottom: 0;">Nomor Penerima</label>
              <span id="bc-targets-count" style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">0 nomor</span>
            </div>
            <textarea id="bc-targets" class="form-textarea" rows="4" placeholder="081234567890&#10;089876543210&#10;6285166328091"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="bc-message">Template Pesan (Spintax <code>{A|B}</code> & Variabel <code>{{name}}</code>)</label>
            <textarea id="bc-message" class="form-textarea" rows="4" placeholder="{Halo|Hai|Selamat pagi} {{name}}, ada penawaran istimewa untukmu hari ini! Diskon 30% khusus hari ini."></textarea>
          </div>

          <div class="pacing-group">
            <div class="pacing-btn" data-min="8" data-max="15">Santai (8–15s)</div>
            <div class="pacing-btn active" data-min="4" data-max="8">Seimbang (4–8s)</div>
            <div class="pacing-btn" data-min="2" data-max="4">Cepat (2–4s)</div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-bc-preview" style="flex: 1;">Pratinjau</button>
            <button class="btn btn-primary" id="btn-bc-start" style="flex: 1;">Mulai Broadcast</button>
          </div>
        </div>

        <!-- Right: Dynamic Context (Progress if Running, else Preview) -->
        <div class="bento-card col-5">
          <!-- Active Progress Panel (Revealed ONLY when running/paused) -->
          <div id="bc-active-monitor" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div class="card-title" style="margin-bottom: 0;">Pengiriman Berjalan</div>
              <span id="bc-progress-text" style="font-family: var(--font-mono); font-size: 12px; color: var(--accent-blue); font-weight: 600;">0 / 0</span>
            </div>
            <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.06); border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 14px;">
              <div id="bc-bar" style="width: 0%; height: 100%; background: var(--accent-blue); transition: width 0.3s ease;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; margin-bottom: 14px;">
              <div style="background: var(--bg-surface-elevated); padding: 8px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Terkirim</div>
                <div id="bc-stat-sent" style="font-size: 16px; font-weight: 700; color: var(--accent-green); font-variant-numeric: tabular-nums;">0</div>
              </div>
              <div style="background: var(--bg-surface-elevated); padding: 8px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Gagal</div>
                <div id="bc-stat-failed" style="font-size: 16px; font-weight: 700; color: var(--accent-red); font-variant-numeric: tabular-nums;">0</div>
              </div>
              <div style="background: var(--bg-surface-elevated); padding: 8px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Sisa</div>
                <div id="bc-stat-remaining" style="font-size: 16px; font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums;">0</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 16px;">
              <button class="btn btn-secondary btn-sm" id="btn-bc-pause" style="flex: 1;">Jeda</button>
              <button class="btn btn-secondary btn-sm" id="btn-bc-resume" style="flex: 1;" disabled>Lanjut</button>
              <button class="btn btn-ghost btn-sm" id="btn-bc-cancel" style="flex: 1;">Batal</button>
            </div>
          </div>

          <!-- Spintax Preview Section -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="card-title" style="margin-bottom: 0;">Pratinjau Variasi</div>
              <span id="bc-variations-count" style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">0 variasi</span>
            </div>
            <div id="bc-preview-container" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              <p style="color: var(--text-tertiary);">Ketik template dan klik "Pratinjau" untuk melihat contoh kalimat acak yang akan diterima pelanggan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ASISTEN AI & BASIS PENGETAHUAN -->
    <div id="tab-ai" class="tab-view">
      <div class="bento-grid">
        <div class="bento-card col-6">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="card-title" style="margin-bottom: 0;">Basis Pengetahuan (knowledge/)</div>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-kb">Muat Ulang</button>
          </div>
          <div class="form-group">
            <textarea id="kb-preview-text" class="form-textarea" rows="10" readonly placeholder="Memuat dokumen knowledge base..."></textarea>
          </div>
          <div style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);" id="kb-char-count">-- karakter terindeks</div>
        </div>

        <div class="bento-card col-6">
          <div class="card-title">Uji Pertanyaan ke Asisten AI</div>
          <div class="form-group">
            <input type="text" id="ai-test-prompt" class="form-input" placeholder="Contoh: Berapa nomor rekening resmi toko?" />
          </div>
          <button class="btn btn-primary" id="btn-test-ai" style="width: 100%; margin-bottom: 12px;">Tanyakan</button>

          <div id="ai-response-box" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; min-height: 120px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap;">Ketik pertanyaan dan tanyakan langsung ke asisten bot untuk memverifikasi data jawaban.</div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script>
    const API_KEY = "${config.API_KEY}";

    // Quiet Toast: Only for meaningful notifications
    function showToast(message, isError = false) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--border-strong)';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    // Segmented Navigation Switching
    function switchTab(tabId) {
      document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.seg-btn').forEach(el => el.classList.remove('active'));

      const targetView = document.getElementById(tabId);
      const targetBtn = document.querySelector('[data-tab="' + tabId + '"]');

      if (targetView) targetView.classList.add('active');
      if (targetBtn) targetBtn.classList.add('active');

      if (tabId === 'tab-sessions') fetchSessions();
      if (tabId === 'tab-broadcast') fetchBroadcastStatus();
      if (tabId === 'tab-ai') fetchKnowledge();
    }

    document.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Pacing selector in broadcast
    let selectedMinDelay = 4;
    let selectedMaxDelay = 8;
    document.querySelectorAll('.pacing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pacing-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMinDelay = parseInt(btn.getAttribute('data-min'), 10);
        selectedMaxDelay = parseInt(btn.getAttribute('data-max'), 10);
      });
    });

    // Target counter in broadcast
    document.getElementById('bc-targets').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const count = val ? val.split(/[\\s,;\\n]+/).filter(x => x.length >= 8).length : 0;
      document.getElementById('bc-targets-count').textContent = count + ' nomor';
    });

    // 1. Fetch System Status
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (!data.success) return;

        const wrap = document.getElementById('status-wrap');
        const label = document.getElementById('status-label');
        wrap.className = 'status-indicator ' + data.status;
        label.textContent = data.status === 'CONNECTED' ? (data.user?.id ? '+' + data.user.id : 'Live') : data.status;

        const phone = data.user?.id ? '+' + data.user.id : 'Belum Ditautkan';
        const name = data.user?.name || (data.connected ? 'WhatsApp Connected' : 'Belum ditautkan');
        document.getElementById('overview-phone').textContent = phone;
        document.getElementById('overview-name').textContent = name;

        // "No news is good news": Only show queue counter if there are actually pending items
        const queueBanner = document.getElementById('active-queue-banner');
        if (data.queue && data.queue.size > 0) {
          queueBanner.style.display = 'inline-flex';
          document.getElementById('queue-count').textContent = data.queue.size;
        } else {
          queueBanner.style.display = 'none';
        }
      } catch (err) {}
    }

    // 2. Fetch Sessions List
    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions', {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('overview-session').textContent = data.activeSession;
        const tbody = document.getElementById('sessions-table-body');
        tbody.innerHTML = '';

        if (!data.sessions || data.sessions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-tertiary);">Tidak ada profil sesi</td></tr>';
          return;
        }

        data.sessions.forEach(s => {
          const tr = document.createElement('tr');
          const isAct = s.isActive;
          const phoneLabel = s.phoneNumber ? '+' + s.phoneNumber : '<span style="color: var(--text-tertiary); font-size: 11px;">Belum tertaut</span>';

          const actionHtml = isAct
            ? '<span style="font-size: 12px; color: var(--accent-green); font-weight: 500;">Aktif</span>'
            : '<button class="btn btn-secondary btn-sm" onclick="switchSession(\\'' + s.name + '\\')">Aktifkan</button>';

          tr.innerHTML = \`
            <td style="font-family: var(--font-mono); font-weight: 500;">\${s.name}</td>
            <td style="font-family: var(--font-mono); font-size: 12px;">\${phoneLabel}</td>
            <td style="text-align: right;">\${actionHtml}</td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {}
    }

    async function switchSession(sessionName) {
      try {
        const res = await fetch('/api/sessions/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ sessionName })
        });
        const data = await res.json();
        if (data.success) {
          fetchStatus();
          fetchSessions();
        } else {
          showToast(data.error || 'Gagal beralih sesi', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan', true);
      }
    }

    // 3. Logout / Disconnect
    document.getElementById('btn-logout').addEventListener('click', async () => {
      if (!confirm('Putuskan koneksi WhatsApp aktif?')) return;
      try {
        const res = await fetch('/api/session/logout', {
          method: 'POST',
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          fetchStatus();
          fetchSessions();
        }
      } catch (e) {
        showToast('Gagal memutuskan sesi', true);
      }
    });

    // 4. Request Pairing Code
    document.getElementById('btn-request-pairing').addEventListener('click', async () => {
      const phoneNumber = document.getElementById('pairing-input').value.trim();
      if (!phoneNumber) {
        showToast('Masukkan nomor telepon terlebih dahulu', true);
        return;
      }

      const btn = document.getElementById('btn-request-pairing');
      btn.disabled = true;
      btn.textContent = 'Meminta kode...';

      try {
        const res = await fetch('/api/pairing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ phoneNumber })
        });
        const data = await res.json();
        if (data.success && data.code) {
          document.getElementById('pairing-code-text').textContent = data.code;
          document.getElementById('pairing-box').style.display = 'block';
        } else {
          showToast(data.error || 'Gagal membuat kode pairing', true);
        }
      } catch (e) {
        showToast('Kesalahan jaringan saat meminta kode pairing', true);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Minta Kode Pairing';
      }
    });

    // 5. Quick Send Test Message
    document.getElementById('btn-quick-send').addEventListener('click', async () => {
      const to = document.getElementById('test-to').value.trim();
      const message = document.getElementById('test-msg').value.trim();
      if (!to || !message) {
        showToast('Nomor dan pesan wajib diisi', true);
        return;
      }

      try {
        const res = await fetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ to, message })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('test-msg').value = '';
          showToast('Pesan dikirim ke antrean');
        } else {
          showToast(data.error || 'Gagal mengirim pesan', true);
        }
      } catch (e) {
        showToast('Terjadi kesalahan pengiriman pesan', true);
      }
    });

    // 6. Broadcast Management (Quiet by Default)
    let bcTimer = null;

    async function fetchBroadcastStatus() {
      try {
        const res = await fetch('/api/broadcast/status', {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (!data.success) return;

        const job = data.currentJob;
        const monitorEl = document.getElementById('bc-active-monitor');
        const btnPause = document.getElementById('btn-bc-pause');
        const btnResume = document.getElementById('btn-bc-resume');

        // Quiet UI: If idle / no active job, hide the active progress panel
        if (!job || job.status === 'completed' || job.status === 'cancelled') {
          monitorEl.style.display = 'none';
          if (bcTimer) { clearInterval(bcTimer); bcTimer = null; }
          return;
        }

        // Only reveal monitor when a job is active
        monitorEl.style.display = 'block';

        const pct = job.progressPercent || 0;
        document.getElementById('bc-progress-text').textContent = (job.sentCount + job.failedCount) + ' / ' + job.totalTargets + ' (' + pct + '%)';
        document.getElementById('bc-bar').style.width = pct + '%';
        document.getElementById('bc-stat-sent').textContent = job.sentCount;
        document.getElementById('bc-stat-failed').textContent = job.failedCount;
        document.getElementById('bc-stat-remaining').textContent = Math.max(0, job.totalTargets - (job.sentCount + job.failedCount));

        btnPause.disabled = job.status !== 'running';
        btnResume.disabled = job.status !== 'paused';

        if (job.status === 'running' || job.status === 'paused') {
          if (!bcTimer) bcTimer = setInterval(fetchBroadcastStatus, 2500);
        }
      } catch (err) {}
    }

    // Preview Spintax
    document.getElementById('btn-bc-preview').addEventListener('click', async () => {
      const template = document.getElementById('bc-message').value.trim();
      if (!template) {
        showToast('Masukkan template pesan terlebih dahulu', true);
        return;
      }

      try {
        const res = await fetch('/api/broadcast/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ template, count: 3 })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('bc-variations-count').textContent = data.totalVariations + ' variasi';
          const container = document.getElementById('bc-preview-container');
          container.innerHTML = data.previews.map((p, idx) => 
            '<div style="background: var(--bg-surface-elevated); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">' +
              '<div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 2px;">Sampel #' + (idx + 1) + ':</div>' +
              '<div>' + p + '</div>' +
            '</div>'
          ).join('');
        }
      } catch (e) {
        showToast('Gagal memuat pratinjau variasi', true);
      }
    });

    // Start Broadcast
    document.getElementById('btn-bc-start').addEventListener('click', async () => {
      const raw = document.getElementById('bc-targets').value.trim();
      const message = document.getElementById('bc-message').value.trim();

      if (!raw || !message) {
        showToast('Nomor tujuan dan template wajib diisi', true);
        return;
      }

      const targets = raw.split(/[\\s,;\\n]+/).filter(t => t.trim().length >= 8);
      if (targets.length === 0) {
        showToast('Tidak ada nomor tujuan valid', true);
        return;
      }

      const btn = document.getElementById('btn-bc-start');
      btn.disabled = true;
      btn.textContent = 'Memulai...';

      try {
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({
            targets,
            message,
            minDelayMs: selectedMinDelay * 1000,
            maxDelayMs: selectedMaxDelay * 1000
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Broadcast dimulai untuk ' + data.totalTargets + ' nomor');
          fetchBroadcastStatus();
        } else {
          showToast(data.error || 'Gagal memulai broadcast', true);
        }
      } catch (e) {
        showToast('Kesalahan jaringan', true);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Mulai Broadcast';
      }
    });

    document.getElementById('btn-bc-pause').addEventListener('click', async () => {
      await fetch('/api/broadcast/pause', { method: 'POST', headers: { 'x-api-key': API_KEY } });
      fetchBroadcastStatus();
    });
    document.getElementById('btn-bc-resume').addEventListener('click', async () => {
      await fetch('/api/broadcast/resume', { method: 'POST', headers: { 'x-api-key': API_KEY } });
      fetchBroadcastStatus();
    });
    document.getElementById('btn-bc-cancel').addEventListener('click', async () => {
      if (!confirm('Batalkan broadcast ini?')) return;
      await fetch('/api/broadcast/cancel', { method: 'POST', headers: { 'x-api-key': API_KEY } });
      fetchBroadcastStatus();
    });

    // 7. Knowledge Base & AI Playground
    async function fetchKnowledge() {
      try {
        const res = await fetch('/api/knowledge', {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('kb-char-count').textContent = (data.stats?.length || 0) + ' karakter terindeks';
          document.getElementById('kb-preview-text').value = data.context || '(Belum ada dokumen terindeks)';
        }
      } catch (e) {}
    }

    document.getElementById('btn-refresh-kb').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/knowledge/reload', {
          method: 'POST',
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (data.success) {
          showToast('Knowledge base dimuat ulang');
          fetchKnowledge();
        }
      } catch (e) {
        showToast('Gagal memuat ulang knowledge base', true);
      }
    });

    document.getElementById('btn-test-ai').addEventListener('click', async () => {
      const prompt = document.getElementById('ai-test-prompt').value.trim();
      if (!prompt) return;

      const box = document.getElementById('ai-response-box');
      const btn = document.getElementById('btn-test-ai');
      btn.disabled = true;
      btn.textContent = 'Menghubungkan...';
      box.textContent = 'Menunggu jawaban...';

      try {
        const res = await fetch('/api/ai/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (data.success) {
          box.textContent = data.response;
        } else {
          box.textContent = 'Gagal: ' + (data.error || 'Terjadi kesalahan');
        }
      } catch (e) {
        box.textContent = 'Kesalahan jaringan.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Tanyakan';
      }
    });

    // Initial silent polling
    fetchStatus();
    setInterval(fetchStatus, 4000);
  </script>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
};
