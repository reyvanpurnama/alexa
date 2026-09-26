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
  <title>${config.BOT_NAME} — Control Center</title>
  <meta name="description" content="Production-grade WhatsApp business automation engine and autonomous AI assistant.">
  <style>
    :root {
      --bg-canvas: #000000;
      --bg-surface: #161618;
      --bg-surface-elevated: #202024;
      --bg-surface-hover: #26262a;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text-primary: #f5f5f7;
      --text-secondary: #86868b;
      --text-tertiary: #6e6e73;
      --accent-blue: #0071e3;
      --accent-blue-hover: #0077ed;
      --accent-green: #30d158;
      --accent-amber: #ff9f0a;
      --accent-red: #ff453a;
      --accent-purple: #bf5af2;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --radius-pill: 9999px;
      --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
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
      max-width: 1140px;
      margin: 0 auto;
    }

    /* Top App Bar */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      padding: 14px 20px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      background: var(--text-primary);
      color: var(--bg-canvas);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
    }

    .brand-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .brand-tag {
      font-size: 11px;
      color: var(--text-tertiary);
      font-family: var(--font-mono);
      margin-left: 6px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 500;
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.04);
      font-family: var(--font-mono);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-tertiary);
    }

    .status-badge.CONNECTED .status-dot {
      background: var(--accent-green);
      box-shadow: 0 0 8px rgba(48, 209, 88, 0.6);
    }

    .status-badge.PAIRING_READY .status-dot,
    .status-badge.QR_READY .status-dot {
      background: var(--accent-amber);
      animation: pulse-dot 1.5s infinite;
    }

    .status-badge.DISCONNECTED .status-dot {
      background: var(--accent-red);
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    /* Segmented Navigation Control */
    .nav-bar {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }

    .segmented-control {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #141416;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-pill);
      padding: 4px;
    }

    .seg-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 500;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }

    .seg-btn:hover {
      color: var(--text-primary);
    }

    .seg-btn.active {
      background: #252529;
      color: var(--text-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      font-weight: 600;
    }

    /* Buttons */
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
      opacity: 0.4;
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

    .btn-danger {
      background: rgba(255, 69, 58, 0.12);
      color: var(--accent-red);
      border-color: rgba(255, 69, 58, 0.25);
    }

    .btn-danger:hover:not(:disabled) {
      background: rgba(255, 69, 58, 0.22);
    }

    .btn-sm {
      padding: 6px 11px;
      font-size: 12px;
      border-radius: var(--radius-sm);
    }

    /* Bento Cards */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 16px;
      margin-bottom: 20px;
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
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }

    @media (max-width: 900px) {
      .col-4, .col-6, .col-8 { grid-column: span 12; }
      .bento-grid { gap: 12px; }
      .seg-btn { padding: 6px 12px; font-size: 12px; }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: -0.01em;
    }

    .card-kpi {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin-bottom: 4px;
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

    /* Tables */
    .table-container {
      width: 100%;
      overflow-x: auto;
    }

    .apple-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    .apple-table th {
      padding: 10px 14px;
      color: var(--text-tertiary);
      font-weight: 500;
      font-size: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .apple-table td {
      padding: 14px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    .apple-table tr:last-child td {
      border-bottom: none;
    }

    .apple-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Pairing Code Display */
    .pairing-box {
      margin-top: 16px;
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
      margin: 10px 0;
      font-variant-numeric: tabular-nums;
    }

    /* Safe Pacing Buttons */
    .pacing-group {
      display: flex;
      gap: 6px;
      margin-bottom: 14px;
    }

    .pacing-btn {
      flex: 1;
      padding: 8px;
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
      background: rgba(0, 113, 227, 0.15);
      border-color: var(--accent-blue);
      color: var(--text-primary);
      font-weight: 600;
    }

    /* Tab Views */
    .tab-view {
      display: none;
      animation: tab-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .tab-view.active {
      display: block;
    }

    @keyframes tab-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Toast */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast {
      padding: 12px 18px;
      background: #1c1c1e;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      animation: toast-in 0.2s ease-out;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
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
          <span class="brand-title">${config.BOT_NAME}</span>
          <span class="brand-tag">v1.0.0</span>
        </div>
      </div>

      <div class="header-actions">
        <div id="status-pill" class="status-badge ${waClient.getStatus()}">
          <span class="status-dot"></span>
          <span id="status-text">${waClient.getStatus()}</span>
        </div>
        <a href="/docs" class="btn btn-secondary btn-sm" target="_blank">Swagger Docs</a>
        <button class="btn btn-danger btn-sm" id="btn-logout">Disconnect</button>
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
        <div class="bento-card col-4">
          <div>
            <div class="card-header">
              <span class="card-title">Nomor Aktif</span>
              <span style="font-size: 11px; color: var(--accent-green); font-family: var(--font-mono);">WhatsApp Live</span>
            </div>
            <div class="card-kpi" id="overview-phone">${waClient.user ? '+' + waClient.user.id : 'Unpaired'}</div>
            <div class="card-meta" id="overview-name">${waClient.user?.name || 'Belum ditautkan'}</div>
          </div>
          <div style="margin-top: 20px;">
            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="switchTab('tab-sessions')">Kelola Profil Nomor</button>
          </div>
        </div>

        <div class="bento-card col-4">
          <div>
            <div class="card-header">
              <span class="card-title">Profil Sesi</span>
              <span style="font-size: 11px; color: var(--accent-blue); font-family: var(--font-mono);">Hot-Swap Ready</span>
            </div>
            <div class="card-kpi" id="overview-session" style="font-family: var(--font-mono); font-size: 20px;">${waClient.getActiveSessionName()}</div>
            <div class="card-meta">Folder sessions/ aktif</div>
          </div>
          <div style="margin-top: 20px;">
            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="switchTab('tab-sessions')">Tautkan Nomor Baru</button>
          </div>
        </div>

        <div class="bento-card col-4">
          <div>
            <div class="card-header">
              <span class="card-title">Mesin AI</span>
              <span style="font-size: 11px; color: var(--accent-purple); font-family: var(--font-mono);">RAG Active</span>
            </div>
            <div class="card-kpi" style="font-size: 20px;">${config.AI_PROVIDER.toUpperCase()}</div>
            <div class="card-meta" id="overview-model">${config.AI_MODEL || 'default-model'}</div>
          </div>
          <div style="margin-top: 20px;">
            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="switchTab('tab-ai')">Buka Pengaturan AI</button>
          </div>
        </div>

        <!-- Quick Message Tester -->
        <div class="bento-card col-6">
          <div class="card-header">
            <span class="card-title">Uji Coba Pengiriman Pesan</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="test-to">Nomor Tujuan</label>
            <input type="text" id="test-to" class="form-input" placeholder="628123456789" />
          </div>
          <div class="form-group">
            <label class="form-label" for="test-msg">Isi Pesan</label>
            <input type="text" id="test-msg" class="form-input" placeholder="Halo! Pesan uji coba sistem Alexa." />
          </div>
          <button class="btn btn-secondary" id="btn-quick-send" style="width: 100%;">Kirim Pesan</button>
        </div>

        <!-- System Telemetry -->
        <div class="bento-card col-6">
          <div class="card-header">
            <span class="card-title">Telemetri Sistem</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
              <span style="font-size: 13px; color: var(--text-secondary);">Antrean Pesan</span>
              <span id="telemetry-queue" style="font-family: var(--font-mono); font-size: 13px;">0 tertunda</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
              <span style="font-size: 13px; color: var(--text-secondary);">Protokol Baileys</span>
              <span style="font-family: var(--font-mono); font-size: 13px;">v7 Multi-Device</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="font-size: 13px; color: var(--text-secondary);">Proteksi Anti-Ban</span>
              <span style="font-size: 13px; color: var(--accent-green); font-weight: 500;">Aktif (Jitter & Rest)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: NOMOR & SESI (SESSIONS & PAIRING) -->
    <div id="tab-sessions" class="tab-view">
      <div class="bento-grid">
        <div class="bento-card col-7">
          <div class="card-header">
            <span class="card-title">Daftar Sesi Tersimpan (Hot-Swap)</span>
          </div>
          <div class="table-container">
            <table class="apple-table">
              <thead>
                <tr>
                  <th>Nama Profil</th>
                  <th>Nomor</th>
                  <th>Status</th>
                  <th style="text-align: right;">Aksi</th>
                </tr>
              </thead>
              <tbody id="sessions-table-body">
                <tr><td colspan="4" style="text-align: center; color: var(--text-tertiary);">Memuat sesi...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="bento-card col-5">
          <div class="card-header">
            <span class="card-title">Tautkan Nomor Baru</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="pairing-input">Nomor WhatsApp (Contoh: 628123456789)</label>
            <input type="text" id="pairing-input" class="form-input" placeholder="628123456789" />
          </div>
          <button class="btn btn-primary" id="btn-request-pairing" style="width: 100%;">Minta Kode Pairing</button>

          <div class="pairing-box" id="pairing-box">
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase;">Kode Pairing:</div>
            <div class="pairing-digits" id="pairing-code-text">---- ----</div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Buka WhatsApp &rarr; <b>Perangkat Tertaut</b> &rarr; <b>Tautkan dengan nomor telepon</b> &rarr; masukkan kode di atas.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: SMART BROADCAST -->
    <div id="tab-broadcast" class="tab-view">
      <div class="bento-grid">
        <div class="bento-card col-7">
          <div class="card-header">
            <span class="card-title">Kampanye Pesan Massal</span>
            <div id="bc-badge" class="status-badge" style="display: none;">
              <span class="status-dot"></span>
              <span id="bc-badge-text">IDLE</span>
            </div>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <label class="form-label" for="bc-targets" style="margin-bottom: 0;">Daftar Nomor Penerima</label>
              <span id="bc-targets-count" style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">0 nomor</span>
            </div>
            <textarea id="bc-targets" class="form-textarea" rows="4" placeholder="081234567890&#10;089876543210&#10;6285166328091"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="bc-message">Template Pesan (Sintaks Spintax <code>{A|B}</code> & Variabel <code>{{name}}</code>)</label>
            <textarea id="bc-message" class="form-textarea" rows="4" placeholder="{Halo|Hai|Selamat pagi} {kak|bunda|mas}, ada promo istimewa khusus untukmu hari ini! Diskon hingga 50% untuk pesanan pertamamu."></textarea>
          </div>

          <label class="form-label">Ritme Pengiriman Anti-Ban</label>
          <div class="pacing-group">
            <div class="pacing-btn" data-min="8" data-max="15">🐢 Santai (8–15 dtk)</div>
            <div class="pacing-btn active" data-min="4" data-max="8">🐇 Seimbang (4–8 dtk)</div>
            <div class="pacing-btn" data-min="2" data-max="4">⚡ Agresif (2–4 dtk)</div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-bc-preview" style="flex: 1;">Pratinjau Variasi</button>
            <button class="btn btn-primary" id="btn-bc-start" style="flex: 1;">Mulai Broadcast</button>
          </div>
        </div>

        <div class="bento-card col-5">
          <div class="card-header">
            <span class="card-title">Pemantauan & Pratinjau</span>
          </div>

          <!-- Progress Widget -->
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
              <span style="color: var(--text-secondary);">Progres Pengiriman</span>
              <span id="bc-stat-progress" style="font-family: var(--font-mono); color: var(--accent-blue); font-weight: 600;">0 / 0 (0%)</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 12px;">
              <div id="bc-bar" style="width: 0%; height: 100%; background: var(--accent-blue); transition: width 0.3s ease;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; margin-bottom: 12px;">
              <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Terkirim</div>
                <div id="bc-stat-sent" style="font-size: 16px; font-weight: 700; color: var(--accent-green); font-variant-numeric: tabular-nums;">0</div>
              </div>
              <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Gagal</div>
                <div id="bc-stat-failed" style="font-size: 16px; font-weight: 700; color: var(--accent-red); font-variant-numeric: tabular-nums;">0</div>
              </div>
              <div style="background: rgba(255,255,255,0.02); padding: 6px; border-radius: var(--radius-sm);">
                <div style="font-size: 10px; color: var(--text-tertiary);">Sisa</div>
                <div id="bc-stat-remaining" style="font-size: 16px; font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums;">0</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" id="btn-bc-pause" style="flex: 1;" disabled>Jeda</button>
              <button class="btn btn-secondary btn-sm" id="btn-bc-resume" style="flex: 1;" disabled>Lanjut</button>
              <button class="btn btn-danger btn-sm" id="btn-bc-cancel" style="flex: 1;" disabled>Batal</button>
            </div>
          </div>

          <!-- Spintax Preview Box -->
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Sampel Variasi</span>
              <span id="bc-variations-count" style="font-size: 11px; color: var(--accent-purple); font-family: var(--font-mono);">0 variasi</span>
            </div>
            <div id="bc-preview-container" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary);">
              <p style="color: var(--text-tertiary); font-style: italic;">Klik "Pratinjau Variasi" untuk menguji template Spintax.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ASISTEN AI & BASIS PENGETAHUAN -->
    <div id="tab-ai" class="tab-view">
      <div class="bento-grid">
        <div class="bento-card col-6">
          <div class="card-header">
            <span class="card-title">Basis Pengetahuan Bisnis (Knowledge Base)</span>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-kb">Muat Ulang</button>
          </div>
          <div style="display: flex; gap: 12px; margin-bottom: 14px;">
            <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); flex: 1;">
              <div style="font-size: 11px; color: var(--text-tertiary);">Kapasitas Konteks</div>
              <div id="kb-char-count" style="font-size: 18px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums;">-- chars</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); flex: 1;">
              <div style="font-size: 11px; color: var(--text-tertiary);">Status Grounding</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--accent-green);">Aktif</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Pratinjau Dokumen Terindeks (knowledge/business.md & faq.json)</label>
            <textarea id="kb-preview-text" class="form-textarea" rows="8" readonly placeholder="Memuat dokumen knowledge base..."></textarea>
          </div>
        </div>

        <div class="bento-card col-6">
          <div class="card-header">
            <span class="card-title">Pengujian Jawaban AI Langsung</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="ai-test-prompt">Pertanyaan Percobaan</label>
            <input type="text" id="ai-test-prompt" class="form-input" placeholder="Contoh: Berapa nomor rekening resmi toko?" />
          </div>
          <button class="btn btn-primary" id="btn-test-ai" style="width: 100%; margin-bottom: 14px;">Uji Respon AI</button>

          <div class="form-group">
            <label class="form-label">Jawaban Model AI (Tergrounding Data Bisnis)</label>
            <div id="ai-response-box" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; min-height: 120px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap;">Ketik pertanyaan di atas dan klik "Uji Respon AI" untuk melihat bagaimana bot menjawab pertanyaan pelanggan secara cerdas dan akurat.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script>
    const API_KEY = "${config.API_KEY}";

    // Toast notification
    function showToast(message, isError = false) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--border-strong)';
      toast.textContent = (isError ? '⚠️ ' : '✓ ') + message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
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
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
      });
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

        const pill = document.getElementById('status-pill');
        const statusText = document.getElementById('status-text');
        pill.className = 'status-badge ' + data.status;
        statusText.textContent = data.status;

        const phone = data.user?.id ? '+' + data.user.id : 'Unpaired';
        const name = data.user?.name || (data.connected ? 'WhatsApp Connected' : 'Belum ditautkan');
        document.getElementById('overview-phone').textContent = phone;
        document.getElementById('overview-name').textContent = name;

        if (data.queue) {
          document.getElementById('telemetry-queue').textContent = data.queue.size + ' tertunda';
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
          tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-tertiary);">Tidak ada profil sesi</td></tr>';
          return;
        }

        data.sessions.forEach(s => {
          const tr = document.createElement('tr');
          const isAct = s.isActive;
          const statusHtml = isAct
            ? '<span style="color: var(--accent-green); font-weight: 600; font-size: 11px;">● AKTIF</span>'
            : (s.isRegistered ? '<span style="color: var(--text-tertiary); font-size: 11px;">Tersimpan</span>' : '<span style="color: var(--accent-amber); font-size: 11px;">Belum Tertaut</span>');

          const actionHtml = isAct
            ? '<span style="font-size: 12px; color: var(--text-tertiary);">Sedang Aktif</span>'
            : '<button class="btn btn-secondary btn-sm" onclick="switchSession(\\'' + s.name + '\\')">Aktifkan</button>';

          tr.innerHTML = \`
            <td style="font-family: var(--font-mono); font-weight: 500;">\${s.name}</td>
            <td style="font-family: var(--font-mono); font-size: 12px;">\${s.phoneNumber ? '+' + s.phoneNumber : '-'}</td>
            <td>\${statusHtml}</td>
            <td style="text-align: right;">\${actionHtml}</td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {}
    }

    // Switch Session
    async function switchSession(sessionName) {
      try {
        const res = await fetch('/api/sessions/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ sessionName })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Beralih ke sesi: ' + sessionName);
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
      if (!confirm('Putuskan koneksi sesi aktif saat ini?')) return;
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
          showToast('Kode pairing berhasil dibuat!');
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
        showToast('Nomor tujuan dan isi pesan wajib diisi', true);
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
          showToast('Pesan berhasil masuk ke antrean pengiriman!');
          document.getElementById('test-msg').value = '';
        } else {
          showToast(data.error || 'Gagal mengirim pesan', true);
        }
      } catch (e) {
        showToast('Terjadi kesalahan pengiriman pesan', true);
      }
    });

    // 6. Broadcast Management
    let bcTimer = null;

    async function fetchBroadcastStatus() {
      try {
        const res = await fetch('/api/broadcast/status', {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        if (!data.success) return;

        const job = data.currentJob;
        const badge = document.getElementById('bc-badge');
        const badgeText = document.getElementById('bc-badge-text');
        const btnPause = document.getElementById('btn-bc-pause');
        const btnResume = document.getElementById('btn-bc-resume');
        const btnCancel = document.getElementById('btn-bc-cancel');

        if (!job) {
          badge.style.display = 'none';
          btnPause.disabled = true;
          btnResume.disabled = true;
          btnCancel.disabled = true;
          return;
        }

        badge.style.display = 'inline-flex';
        badge.className = 'status-badge ' + (job.status === 'running' ? 'CONNECTED' : job.status === 'paused' ? 'PAIRING_READY' : 'DISCONNECTED');
        badgeText.textContent = job.status.toUpperCase();

        const pct = job.progressPercent || 0;
        document.getElementById('bc-stat-progress').textContent = (job.sentCount + job.failedCount) + ' / ' + job.totalTargets + ' (' + pct + '%)';
        document.getElementById('bc-bar').style.width = pct + '%';
        document.getElementById('bc-stat-sent').textContent = job.sentCount;
        document.getElementById('bc-stat-failed').textContent = job.failedCount;
        document.getElementById('bc-stat-remaining').textContent = Math.max(0, job.totalTargets - (job.sentCount + job.failedCount));

        btnPause.disabled = job.status !== 'running';
        btnResume.disabled = job.status !== 'paused';
        btnCancel.disabled = job.status !== 'running' && job.status !== 'paused';

        if (job.status === 'running' || job.status === 'paused') {
          if (!bcTimer) bcTimer = setInterval(fetchBroadcastStatus, 2500);
        } else {
          if (bcTimer) { clearInterval(bcTimer); bcTimer = null; }
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
            '<div style="background: rgba(255,255,255,0.03); border-left: 2px solid var(--accent-blue); padding: 8px 10px; border-radius: 4px;">' +
              '<div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 2px;">Sampel #' + (idx + 1) + ':</div>' +
              '<div>' + p + '</div>' +
            '</div>'
          ).join('');
          showToast('Pratinjau variasi dibuat!');
        } else {
          showToast(data.error || 'Gagal membuat pratinjau', true);
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
        showToast('Nomor tujuan dan template pesan wajib diisi', true);
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
          showToast('Broadcast dimulai untuk ' + data.totalTargets + ' nomor!');
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
      if (!confirm('Batalkan pengiriman kampanye broadcast ini?')) return;
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
          document.getElementById('kb-char-count').textContent = (data.stats?.length || 0) + ' karakter';
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
          showToast('Knowledge base berhasil dimuat ulang!');
          fetchKnowledge();
        }
      } catch (e) {
        showToast('Gagal memuat ulang knowledge base', true);
      }
    });

    document.getElementById('btn-test-ai').addEventListener('click', async () => {
      const prompt = document.getElementById('ai-test-prompt').value.trim();
      if (!prompt) {
        showToast('Masukkan pertanyaan percobaan terlebih dahulu', true);
        return;
      }

      const box = document.getElementById('ai-response-box');
      const btn = document.getElementById('btn-test-ai');
      btn.disabled = true;
      btn.textContent = 'Menghasilkan jawaban...';
      box.textContent = 'Menghubungkan ke ' + "${config.AI_PROVIDER.toUpperCase()}" + '...';

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
          box.textContent = 'Terjadi kesalahan: ' + (data.error || 'Gagal menghasilkan jawaban.');
        }
      } catch (e) {
        box.textContent = 'Kesalahan jaringan saat menghubungi AI.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Uji Respon AI';
      }
    });

    // Initial polling
    fetchStatus();
    setInterval(fetchStatus, 4000);
  </script>
</body>
</html>`;

    return reply.type('text/html').send(html);
  });
};
