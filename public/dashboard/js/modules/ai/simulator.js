import { fetchApi, showToast } from '../../api.js';

export function initSimulator() {
  // Quick Chips in Simulator
  const chips = document.querySelectorAll('.ai-chip');
  const promptInput = document.getElementById('ai-test-prompt');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-prompt');
      if (text && promptInput) {
        promptInput.value = text;
        promptInput.focus();
      }
    });
  });

  // Test AI Query Simulator
  const btnTestQuery = document.getElementById('btn-test-ai');
  if (btnTestQuery) {
    btnTestQuery.addEventListener('click', async () => {
      const prompt = promptInput?.value.trim();
      if (!prompt) {
        showToast('Masukkan pertanyaan terlebih dahulu.', true);
        promptInput?.focus();
        return;
      }

      const box = document.getElementById('ai-response-box');
      const latencyTag = document.getElementById('ai-latency-tag');

      btnTestQuery.disabled = true;
      btnTestQuery.textContent = 'Memproses Jawaban...';
      if (box) {
        box.textContent = 'Menghubungkan ke model AI & memverifikasi basis data...';
        box.style.color = 'var(--text-tertiary)';
      }
      if (latencyTag) latencyTag.style.display = 'none';

      const startTime = performance.now();
      try {
        const data = await fetchApi('/api/ai/query', {
          method: 'POST',
          body: { prompt },
        });

        const elapsed = (performance.now() - startTime).toFixed(0);

        if (data.success) {
          if (box) {
            box.textContent = data.response;
            box.style.color = 'var(--text-primary)';
          }

          if (latencyTag) {
            latencyTag.style.display = 'inline-flex';
            latencyTag.textContent = `⚡ ${data.latencyMs ?? elapsed}ms`;
          }
        } else {
          if (box) {
            box.textContent = `[Error] ${data.error || 'Gagal memperoleh respons AI'}`;
            box.style.color = 'var(--accent-red)';
          }
        }
      } catch (err) {
        if (box) {
          box.textContent = 'Terjadi kesalahan jaringan saat memproses kueri.';
          box.style.color = 'var(--accent-red)';
        }
      } finally {
        btnTestQuery.disabled = false;
        btnTestQuery.textContent = 'Tanyakan ke Asisten';
      }
    });
  }
}
