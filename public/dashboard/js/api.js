/**
 * Unified API Client for Alexa Dashboard
 */

export function getApiKey() {
  return window.__ALEXA_CONFIG__?.apiKey || '';
}

export async function fetchApi(endpoint, options = {}) {
  const apiKey = getApiKey();
  const headers = {
    'x-api-key': apiKey,
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  return await response.json();
}

/**
 * Minimalist Toast notification
 */
export function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--border-strong)';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
