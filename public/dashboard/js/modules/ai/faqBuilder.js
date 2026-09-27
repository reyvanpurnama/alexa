import { fetchApi, showToast } from '../../api.js';
import { updateKnowledgeStats } from './knowledgeDoc.js';

let currentFaqs = [];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getCurrentFaqs() {
  return currentFaqs;
}

export function setCurrentFaqs(faqs) {
  currentFaqs = faqs;
  renderFaqList(currentFaqs);
}

export function renderFaqList(faqs) {
  const container = document.getElementById('faq-items-list');
  if (!container) return;

  if (!faqs || faqs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 24px;">
        Belum ada kartu tanya-jawab (FAQ). Gunakan formulir di atas untuk menambahkan.
      </div>
    `;
    return;
  }

  container.innerHTML = faqs
    .map(
      (item, idx) => `
      <div class="faq-card-item">
        <div class="faq-card-content">
          <div class="faq-card-topic">${escapeHtml(item.topic || 'Umum')}</div>
          <div class="faq-card-q">Q: ${escapeHtml(item.question)}</div>
          <div class="faq-card-a">A: ${escapeHtml(item.answer)}</div>
        </div>
        <div class="faq-card-actions">
          <button class="btn btn-ghost btn-sm btn-delete-faq" data-index="${idx}" style="color: var(--accent-red); font-size: 11px;">
            Hapus
          </button>
        </div>
      </div>
    `
    )
    .join('');

  // Attach delete handlers
  container.querySelectorAll('.btn-delete-faq').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = btn.getAttribute('data-index');
      if (idx === null || idx === undefined) return;

      const target = faqs[idx];
      const promptText = target ? `Hapus FAQ: "${target.question}"?` : 'Hapus FAQ ini?';
      if (!confirm(promptText)) return;

      try {
        const data = await fetchApi(`/api/knowledge/faq/${idx}`, { method: 'DELETE' });
        if (data.success) {
          showToast('FAQ berhasil dihapus.');
          currentFaqs = data.faqs || [];
          renderFaqList(currentFaqs);
          updateKnowledgeStats(data.stats);
        } else {
          showToast(data.error || 'Gagal menghapus FAQ.', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menghapus FAQ.', true);
      }
    });
  });
}

export function initFaqBuilder() {
  const btnAddFaq = document.getElementById('btn-add-faq');
  if (btnAddFaq) {
    btnAddFaq.addEventListener('click', async () => {
      const topic = document.getElementById('new-faq-topic')?.value.trim();
      const question = document.getElementById('new-faq-q')?.value.trim();
      const answer = document.getElementById('new-faq-a')?.value.trim();

      if (!topic || !question || !answer) {
        showToast('Topik, pertanyaan, dan jawaban wajib diisi.', true);
        return;
      }

      btnAddFaq.disabled = true;
      btnAddFaq.textContent = 'Menambahkan...';

      try {
        const data = await fetchApi('/api/knowledge/faq', {
          method: 'POST',
          body: { topic, question, answer },
        });

        if (data.success) {
          showToast('FAQ berhasil ditambahkan.');
          const inputTopic = document.getElementById('new-faq-topic');
          const inputQ = document.getElementById('new-faq-q');
          const inputA = document.getElementById('new-faq-a');
          if (inputTopic) inputTopic.value = '';
          if (inputQ) inputQ.value = '';
          if (inputA) inputA.value = '';

          currentFaqs = data.faqs || [];
          renderFaqList(currentFaqs);
          updateKnowledgeStats(data.stats);
        } else {
          showToast(data.error || 'Gagal menambahkan FAQ.', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menambahkan FAQ.', true);
      } finally {
        btnAddFaq.disabled = false;
        btnAddFaq.textContent = '+ Tambahkan FAQ';
      }
    });
  }
}
