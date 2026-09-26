import { fetchApi, showToast } from '../api.js';

let currentFaqs = [];
let isEditingDoc = false;

export function initAi() {
  // Sub-segmented Tab Switcher (Doc vs FAQ)
  const subSegButtons = document.querySelectorAll('.sub-seg-btn');
  subSegButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-subtab');
      if (!targetId) return;

      subSegButtons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.sub-tab-view').forEach((v) => v.classList.remove('active'));

      btn.classList.add('active');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // Track document editing to prevent accidental overwrite during poll
  const docTextarea = document.getElementById('kb-business-doc');
  if (docTextarea) {
    docTextarea.addEventListener('focus', () => {
      isEditingDoc = true;
    });
    docTextarea.addEventListener('blur', () => {
      isEditingDoc = false;
    });
  }

  // Save Business Document
  const btnSaveDoc = document.getElementById('btn-save-kb-doc');
  if (btnSaveDoc) {
    btnSaveDoc.addEventListener('click', async () => {
      const content = document.getElementById('kb-business-doc')?.value ?? '';
      btnSaveDoc.disabled = true;
      btnSaveDoc.textContent = 'Menyimpan...';

      try {
        const data = await fetchApi('/api/knowledge/business', {
          method: 'PUT',
          body: { content },
        });

        if (data.success) {
          showToast(data.message || 'Dokumen profil berhasil disimpan.');
          updateKnowledgeStats(data.stats);
        } else {
          showToast(data.error || 'Gagal menyimpan dokumen.', true);
        }
      } catch (err) {
        showToast('Kesalahan jaringan saat menyimpan dokumen.', true);
      } finally {
        btnSaveDoc.disabled = false;
        btnSaveDoc.textContent = 'Simpan & Terapkan';
      }
    });
  }

  // Reload Knowledge Base from Disk
  const btnRefresh = document.getElementById('btn-refresh-kb');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      btnRefresh.textContent = 'Memuat...';

      try {
        const data = await fetchApi('/api/knowledge/reload', { method: 'POST' });
        if (data.success) {
          showToast('Basis pengetahuan berhasil dimuat ulang.');
          await fetchKnowledge(true);
        } else {
          showToast('Gagal memuat ulang knowledge base.', true);
        }
      } catch (err) {
        showToast('Gagal memuat ulang basis data.', true);
      } finally {
        btnRefresh.disabled = false;
        btnRefresh.textContent = 'Muat Ulang';
      }
    });
  }

  // Add FAQ Item
  const btnAddFaq = document.getElementById('btn-add-faq');
  if (btnAddFaq) {
    btnAddFaq.addEventListener('click', async () => {
      const topicInput = document.getElementById('new-faq-topic');
      const qInput = document.getElementById('new-faq-q');
      const aInput = document.getElementById('new-faq-a');

      const topic = topicInput?.value.trim() || undefined;
      const question = qInput?.value.trim() || '';
      const answer = aInput?.value.trim() || '';

      if (question.length < 3) {
        showToast('Pertanyaan minimal 3 karakter', true);
        qInput?.focus();
        return;
      }
      if (!answer) {
        showToast('Jawaban tidak boleh kosong', true);
        aInput?.focus();
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
          showToast(data.message || 'FAQ berhasil ditambahkan.');
          if (topicInput) topicInput.value = '';
          if (qInput) qInput.value = '';
          if (aInput) aInput.value = '';

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

  // Quick Chips for Prompt
  const promptInput = document.getElementById('ai-test-prompt');
  document.querySelectorAll('.ai-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-prompt');
      if (text && promptInput) {
        promptInput.value = text;
        promptInput.focus();
      }
    });
  });

  // Test AI Query
  const btnTest = document.getElementById('btn-test-ai');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      const prompt = promptInput?.value.trim();
      if (!prompt) {
        showToast('Masukkan pertanyaan terlebih dahulu.', true);
        promptInput?.focus();
        return;
      }

      const box = document.getElementById('ai-response-box');
      const latencyTag = document.getElementById('ai-latency-tag');

      btnTest.disabled = true;
      btnTest.textContent = 'Memproses Jawaban...';
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

        const elapsedMs = Math.round(performance.now() - startTime);

        if (data.success && box) {
          box.textContent = data.response;
          box.style.color = 'var(--text-primary)';

          if (latencyTag) {
            const displayMs = data.latencyMs ?? elapsedMs;
            latencyTag.textContent = `⚡ ${displayMs}ms • Grounded AI`;
            latencyTag.style.display = 'inline-block';
          }
        } else if (box) {
          box.textContent = 'Gagal: ' + (data.error || 'Terjadi kesalahan sistem');
          box.style.color = 'var(--accent-red)';
        }
      } catch (err) {
        if (box) {
          box.textContent = 'Kesalahan jaringan saat memverifikasi jawaban AI.';
          box.style.color = 'var(--accent-red)';
        }
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = 'Tanyakan ke Asisten';
      }
    });
  }

  // Enter key trigger for prompt input
  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnTest?.click();
      }
    });
  }
}

function updateKnowledgeStats(stats) {
  if (!stats) return;
  const charCountEl = document.getElementById('kb-char-count');
  const faqCountBadge = document.getElementById('faq-count-badge');

  if (charCountEl) {
    const formatted = Number(stats.length || 0).toLocaleString('id-ID');
    charCountEl.textContent = `${formatted} karakter terindeks`;
  }
  if (faqCountBadge) {
    faqCountBadge.textContent = String(stats.faqCount ?? currentFaqs.length);
  }
}

function renderFaqList(faqs) {
  const container = document.getElementById('faq-items-list');
  if (!container) return;

  if (!faqs || faqs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 24px; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
        Belum ada tanya-jawab terdaftar. Buat FAQ pertama Anda menggunakan formulir di atas.
      </div>
    `;
    return;
  }

  container.innerHTML = faqs
    .map(
      (item, idx) => `
      <div class="faq-card" data-index="${idx}">
        <div class="faq-header">
          <div class="faq-q">
            <span class="faq-q-badge">TANYA</span>
            <span>${escapeHtml(item.question)}</span>
            ${item.topic ? `<span class="faq-topic-tag">${escapeHtml(item.topic)}</span>` : ''}
          </div>
          <button class="btn btn-ghost btn-sm btn-delete-faq" data-index="${idx}" title="Hapus FAQ ini" style="color: var(--accent-red); padding: 4px 8px; font-size: 11px;">
            Hapus
          </button>
        </div>
        <div class="faq-a">${escapeHtml(item.answer)}</div>
      </div>
    `
    )
    .join('');

  // Attach delete handlers
  container.querySelectorAll('.btn-delete-faq').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const idx = e.currentTarget.getAttribute('data-index');
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchKnowledge(forceDocUpdate = false) {
  try {
    const data = await fetchApi('/api/knowledge');
    if (!data.success) return;

    // Update document editor textarea only if not actively focused by user or if forced
    const docEl = document.getElementById('kb-business-doc');
    if (docEl && (!isEditingDoc || forceDocUpdate)) {
      docEl.value = data.businessDoc || '';
    }

    // Update structured FAQs
    currentFaqs = data.faqs || [];
    renderFaqList(currentFaqs);

    // Update badge & stats
    updateKnowledgeStats({
      ...data.stats,
      faqCount: currentFaqs.length,
    });
  } catch (err) {
    console.error('Failed to fetch knowledge base:', err);
  }
}
