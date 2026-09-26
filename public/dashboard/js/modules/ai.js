import { fetchApi, showToast } from '../api.js';

export function initAi() {
  const btnRefresh = document.getElementById('btn-refresh-kb');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      try {
        const data = await fetchApi('/api/knowledge/reload', { method: 'POST' });
        if (data.success) {
          showToast('Knowledge base dimuat ulang');
          fetchKnowledge();
        }
      } catch (err) {
        showToast('Gagal memuat ulang knowledge base', true);
      }
    });
  }

  const btnTest = document.getElementById('btn-test-ai');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      const prompt = document.getElementById('ai-test-prompt')?.value.trim();
      if (!prompt) return;

      const box = document.getElementById('ai-response-box');
      btnTest.disabled = true;
      btnTest.textContent = 'Menghubungkan...';
      if (box) box.textContent = 'Menunggu jawaban...';

      try {
        const data = await fetchApi('/api/ai/query', {
          method: 'POST',
          body: { prompt },
        });

        if (data.success && box) {
          box.textContent = data.response;
        } else if (box) {
          box.textContent = 'Gagal: ' + (data.error || 'Terjadi kesalahan');
        }
      } catch (err) {
        if (box) box.textContent = 'Kesalahan jaringan.';
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = 'Tanyakan';
      }
    });
  }
}

export async function fetchKnowledge() {
  try {
    const data = await fetchApi('/api/knowledge');
    if (!data.success) return;

    const charCountEl = document.getElementById('kb-char-count');
    const previewEl = document.getElementById('kb-preview-text');

    if (charCountEl) {
      charCountEl.textContent = (data.stats?.length || 0) + ' karakter terindeks';
    }
    if (previewEl) {
      previewEl.value = data.context || '(Belum ada dokumen terindeks)';
    }
  } catch (err) {}
}
