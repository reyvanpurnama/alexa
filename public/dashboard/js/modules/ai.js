import { fetchApi } from '../api.js';
import { initAICredentials, fetchAICredentials } from './ai/credentials.js';
import { initKnowledgeDoc, isUserEditingDoc, updateKnowledgeStats } from './ai/knowledgeDoc.js';
import { initFaqBuilder, setCurrentFaqs } from './ai/faqBuilder.js';
import { initSimulator } from './ai/simulator.js';
import { initIntentCatalog, fetchIntents } from './ai/intentCatalog.js';

export { fetchAICredentials, fetchIntents };

export async function fetchKnowledge(forceDocUpdate = false) {
  try {
    const data = await fetchApi('/api/knowledge');
    if (!data.success) return;

    // Update document editor textarea only if not actively focused by user or if forced
    const docEl = document.getElementById('kb-business-doc');
    if (docEl && (!isUserEditingDoc() || forceDocUpdate)) {
      docEl.value = data.businessDoc || '';
    }

    // Update structured FAQs
    const faqs = data.faqs || [];
    setCurrentFaqs(faqs);

    // Update badge & stats
    updateKnowledgeStats({
      ...data.stats,
      faqCount: faqs.length,
    });

    // Refresh intent router catalog in parallel
    fetchIntents();
  } catch (err) {
    console.error('Failed to fetch knowledge base:', err);
  }
}

export function initAi() {
  // 1. Initialize AI Model & Credentials Control Card
  initAICredentials();

  // 2. Initialize Knowledge Hub Markdown Document Editor
  initKnowledgeDoc(async () => {
    await fetchKnowledge(true);
  });

  // 3. Initialize Structured FAQ Builder
  initFaqBuilder();

  // 4. Initialize Live Inspector Simulator
  initSimulator();

  // 5. Initialize Intent Router Catalog
  initIntentCatalog();

  // 6. Sub-segmented Tab Switcher (Dokumen Profil vs Kartu FAQ vs Intent Router)
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

      if (targetId === 'view-kb-intents') {
        fetchIntents();
      }
    });
  });

  // Initial load of knowledge base
  fetchKnowledge();
}
