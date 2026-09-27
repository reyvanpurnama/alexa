import { fetchApi, showToast } from '../../api.js';

let isEditingDoc = false;

export function isUserEditingDoc() {
  return isEditingDoc;
}

export function updateKnowledgeStats(stats) {
  if (!stats) return;

  const charEl = document.getElementById('kb-char-count');
  if (charEl && stats.businessDocChars !== undefined) {
    charEl.textContent = `${stats.businessDocChars.toLocaleString('id-ID')} karakter terindeks`;
  }

  const badgeFaq = document.getElementById('faq-count-badge');
  if (badgeFaq && stats.faqCount !== undefined) {
    badgeFaq.textContent = stats.faqCount;
  }
}

export function initKnowledgeDoc(onReloadSuccess) {
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
          if (onReloadSuccess) {
            await onReloadSuccess();
          }
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
}
