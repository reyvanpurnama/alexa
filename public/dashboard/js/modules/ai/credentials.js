import { fetchApi, showToast } from '../../api.js';

export async function fetchAvailableModels(provider, apiKey, baseUrl, targetModel, showNotification = false) {
  const modelSelect = document.getElementById('select-ai-model');
  const customInput = document.getElementById('input-custom-model');
  const toggleBtn = document.getElementById('btn-toggle-custom-model');
  const statusChip = document.getElementById('ai-model-status-chip');
  const syncBtn = document.getElementById('btn-sync-models');

  if (!modelSelect) return;

  if (statusChip) {
    statusChip.textContent = 'Memuat model...';
    statusChip.style.color = 'var(--text-tertiary)';
    statusChip.style.background = 'rgba(255, 255, 255, 0.05)';
  }
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      Tarik...
    `;
  }

  try {
    const res = await fetchApi('/api/settings/ai/models', {
      method: 'POST',
      body: { provider, apiKey, baseUrl },
    });

    const models = res.models || [];
    const source = res.source || 'preset';

    modelSelect.innerHTML = '';
    let matched = false;

    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label || m.id;
      if (m.id === targetModel) {
        opt.selected = true;
        matched = true;
      }
      modelSelect.appendChild(opt);
    });

    // Custom option at the end
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '(+) Ketik Model Kustom...';
    modelSelect.appendChild(customOpt);

    if (statusChip) {
      if (source === 'api') {
        statusChip.textContent = `✓ ${models.length} Model Akun`;
        statusChip.style.color = '#30d158';
        statusChip.style.background = 'rgba(48, 209, 88, 0.12)';
      } else {
        statusChip.textContent = 'Preset Rekomendasi';
        statusChip.style.color = 'var(--text-tertiary)';
        statusChip.style.background = 'rgba(255, 255, 255, 0.05)';
      }
    }

    if (!matched && targetModel) {
      customOpt.selected = true;
      if (customInput) {
        customInput.style.display = 'block';
        customInput.value = targetModel;
      }
      if (toggleBtn) toggleBtn.textContent = 'Pilih dari Preset';
    } else {
      if (customInput) customInput.style.display = 'none';
      if (toggleBtn) toggleBtn.textContent = 'Ketik Manual';
      if (!targetModel && modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0;
      }
    }

    if (showNotification) {
      if (source === 'api') {
        showToast(`Berhasil menarik ${models.length} model dari akun Anda!`);
      } else if (res.warning) {
        showToast(res.warning);
      } else {
        showToast('Model rekomendasi berhasil dimuat.');
      }
    }
  } catch (err) {
    if (statusChip) {
      statusChip.textContent = 'Gagal memuat';
      statusChip.style.color = '#ff453a';
    }
    if (showNotification) {
      showToast('Gagal menarik daftar model dari server', true);
    }
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Tarik Model
      `;
    }
  }
}

export async function fetchAICredentials() {
  try {
    const data = await fetchApi('/api/settings/ai');
    if (!data.success || !data.ai) return;

    const { provider, model, baseUrl, hasKey, maskedKey } = data.ai;

    const providerSelect = document.getElementById('select-ai-provider');
    const baseUrlGroup = document.getElementById('group-ai-base-url');
    const baseUrlInput = document.getElementById('input-ai-base-url');
    const maskedDisplay = document.getElementById('ai-key-masked-display');
    const keyBadge = document.getElementById('ai-key-status-badge');

    if (providerSelect) providerSelect.value = provider;

    if (baseUrlGroup) {
      baseUrlGroup.style.display = provider === 'custom' || provider === 'ollama' ? 'block' : 'none';
    }
    if (baseUrlInput) baseUrlInput.value = baseUrl || '';

    if (maskedDisplay) {
      maskedDisplay.textContent = hasKey ? maskedKey : '(Belum ada kunci)';
    }

    if (keyBadge) {
      if (hasKey) {
        keyBadge.className = 'ai-stat-chip';
        keyBadge.style.color = '#30d158';
        keyBadge.textContent = '● Kunci Aktif';
      } else {
        keyBadge.className = 'ai-stat-chip';
        keyBadge.style.color = '#ff9f0a';
        keyBadge.textContent = '○ Belum Ada Kunci';
      }
    }

    // Automatically load the real available models for this provider & active key
    await fetchAvailableModels(provider, '', baseUrl, model);
  } catch (err) {
    console.error('Gagal memuat kredensial AI:', err);
  }
}

export function initAICredentials() {
  const providerSelect = document.getElementById('select-ai-provider');
  const modelSelect = document.getElementById('select-ai-model');
  const customInput = document.getElementById('input-custom-model');
  const toggleBtn = document.getElementById('btn-toggle-custom-model');
  const baseUrlGroup = document.getElementById('group-ai-base-url');
  const baseUrlInput = document.getElementById('input-ai-base-url');
  const apiKeyInput = document.getElementById('input-ai-api-key');
  const btnToggleMask = document.getElementById('btn-toggle-ai-key-mask');
  const btnSyncModels = document.getElementById('btn-sync-models');
  const btnTest = document.getElementById('btn-test-ai-credentials');
  const btnSave = document.getElementById('btn-save-ai-credentials');
  const testStatus = document.getElementById('ai-test-connection-status');

  // Provider change listener -> auto-fetch models for newly chosen provider
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const selected = providerSelect.value;
      if (baseUrlGroup) {
        baseUrlGroup.style.display = selected === 'custom' || selected === 'ollama' ? 'block' : 'none';
      }
      const apiKey = apiKeyInput?.value?.trim();
      const baseUrl = baseUrlInput?.value?.trim();
      fetchAvailableModels(selected, apiKey, baseUrl, '');
    });
  }

  // Model select change listener
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === '__custom__') {
        if (customInput) {
          customInput.style.display = 'block';
          customInput.focus();
        }
        if (toggleBtn) toggleBtn.textContent = 'Pilih dari Preset';
      } else {
        if (customInput) customInput.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'Ketik Manual';
      }
    });
  }

  // Manual model input toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (customInput && customInput.style.display === 'none') {
        customInput.style.display = 'block';
        if (modelSelect) modelSelect.value = '__custom__';
        toggleBtn.textContent = 'Pilih dari Preset';
        customInput.focus();
      } else if (customInput) {
        customInput.style.display = 'none';
        toggleBtn.textContent = 'Ketik Manual';
        if (modelSelect && modelSelect.options.length > 0) {
          modelSelect.selectedIndex = 0;
        }
      }
    });
  }

  // Eye toggle for masking/revealing API key
  if (btnToggleMask && apiKeyInput) {
    btnToggleMask.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        btnToggleMask.textContent = '🔒';
      } else {
        apiKeyInput.type = 'password';
        btnToggleMask.textContent = '👁️';
      }
    });
  }

  // Sync / Fetch Models Button
  if (btnSyncModels) {
    btnSyncModels.addEventListener('click', () => {
      const provider = providerSelect?.value;
      const apiKey = apiKeyInput?.value?.trim();
      const baseUrl = baseUrlInput?.value?.trim();
      fetchAvailableModels(provider, apiKey, baseUrl, modelSelect?.value, true);
    });
  }

  // Auto-fetch models when user pastes / enters an API key (800ms debounce)
  let keyDebounceTimer = null;
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
      clearTimeout(keyDebounceTimer);
      const keyVal = apiKeyInput.value.trim();
      if (keyVal.length >= 10) {
        keyDebounceTimer = setTimeout(() => {
          const provider = providerSelect?.value;
          const baseUrl = baseUrlInput?.value?.trim();
          fetchAvailableModels(provider, keyVal, baseUrl, modelSelect?.value);
        }, 800);
      }
    });
  }

  // Pre-flight Test Connection
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      const provider = providerSelect?.value;
      const model =
        modelSelect?.value === '__custom__' ? customInput?.value?.trim() : modelSelect?.value;
      const apiKey = apiKeyInput?.value?.trim();
      const baseUrl = baseUrlInput?.value?.trim();

      btnTest.disabled = true;
      btnTest.textContent = 'Menguji...';
      if (testStatus) {
        testStatus.style.display = 'inline-block';
        testStatus.style.color = 'var(--text-secondary)';
        testStatus.textContent = 'Mengirim ping ke provider...';
      }

      try {
        const res = await fetchApi('/api/settings/ai/test', {
          method: 'POST',
          body: { provider, model, apiKey, baseUrl },
        });

        if (res.success) {
          if (testStatus) {
            testStatus.style.color = '#30d158';
            testStatus.textContent = `✓ Terhubung (${res.latencyMs}ms)`;
          }
          showToast(`Koneksi AI berhasil diverifikasi (${res.latencyMs}ms)!`);
        } else {
          if (testStatus) {
            testStatus.style.color = '#ff453a';
            testStatus.textContent = '❌ Gagal terhubung';
          }
          showToast(res.error || 'Uji koneksi gagal', true);
        }
      } catch (err) {
        if (testStatus) {
          testStatus.style.color = '#ff453a';
          testStatus.textContent = '❌ Kendala jaringan';
        }
        showToast('Terjadi kesalahan saat menguji koneksi', true);
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = 'Uji Koneksi ⚡';
      }
    });
  }

  // Save & Apply
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const provider = providerSelect?.value;
      const model =
        modelSelect?.value === '__custom__' ? customInput?.value?.trim() : modelSelect?.value;
      const apiKey = apiKeyInput?.value?.trim();
      const baseUrl = baseUrlInput?.value?.trim();

      btnSave.disabled = true;
      btnSave.textContent = 'Menerapkan...';

      try {
        const res = await fetchApi('/api/settings/ai', {
          method: 'PUT',
          body: { provider, model, apiKey, baseUrl },
        });

        if (res.success) {
          showToast(res.message || 'Konfigurasi AI berhasil diterapkan!');
          if (apiKeyInput) apiKeyInput.value = '';
          await fetchAICredentials();
        } else {
          showToast(res.error || 'Gagal menyimpan konfigurasi AI', true);
        }
      } catch {
        showToast('Terjadi kesalahan saat menyimpan pengaturan', true);
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Simpan & Terapkan';
      }
    });
  }

  fetchAICredentials();
}
