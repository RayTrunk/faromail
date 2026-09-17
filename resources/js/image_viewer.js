/* FARO Mail 0.4.3 — aperçu image intégré (pièces jointes JPEG/PNG/GIF/WebP/
 * BMP/SVG...). Rendu natif via <img> : aucune bibliothèque tierce nécessaire,
 * le décodage SVG en <img> n'exécute jamais de script embarqué. */
'use strict';
(function () {
  function appApi() {
    try { if (typeof App !== 'undefined') return App; } catch {}
    return window.App || null;
  }
  function tr(key, params) {
    return typeof window.t === 'function' ? window.t(key, params) : key;
  }
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  let currentTab = null;
  let currentObjectUrl = '';
  let scale = 1;
  let rotation = 0;
  let loadToken = 0;

  function els() {
    return {
      panel: document.getElementById('image-viewer-panel'),
      img: document.getElementById('image-viewer-img'),
      loading: document.getElementById('image-viewer-loading'),
      error: document.getElementById('image-viewer-error'),
      title: document.getElementById('image-viewer-title'),
      zoomLabel: document.getElementById('image-viewer-zoom-label'),
    };
  }

  function applyTransform() {
    const e = els();
    if (!e.img) return;
    e.img.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    if (e.zoomLabel) e.zoomLabel.textContent = Math.round(scale * 100) + '%';
  }

  function releaseObjectUrl() {
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = ''; }
  }

  async function open(tab) {
    const e = els();
    document.getElementById('reader-empty')?.classList.add('hidden');
    document.getElementById('reader-content')?.classList.add('hidden');
    e.panel.classList.remove('hidden');
    currentTab = tab;
    scale = 1;
    rotation = 0;
    e.title.textContent = tab.attachment?.filename || tab.title || '';
    e.error.classList.add('hidden');
    e.img.classList.add('hidden');
    e.loading.classList.remove('hidden');
    releaseObjectUrl();
    const token = ++loadToken;
    try {
      const result = await appApi().rpc('attachments.read', { messageId: tab.messageId, index: tab.attachment.index });
      if (token !== loadToken || currentTab !== tab) return;
      const blob = new Blob([base64ToBytes(result.data)], { type: result.contentType || 'application/octet-stream' });
      currentObjectUrl = URL.createObjectURL(blob);
      e.img.onload = () => {
        if (token !== loadToken || currentTab !== tab) return;
        e.loading.classList.add('hidden');
        e.img.classList.remove('hidden');
        applyTransform();
      };
      e.img.onerror = () => {
        if (token !== loadToken || currentTab !== tab) return;
        e.loading.classList.add('hidden');
        e.error.textContent = tr('image.unsupported');
        e.error.classList.remove('hidden');
      };
      e.img.src = currentObjectUrl;
    } catch (error) {
      if (token !== loadToken || currentTab !== tab) return;
      e.loading.classList.add('hidden');
      e.error.textContent = tr('image.loadError', { error: error.message || String(error) });
      e.error.classList.remove('hidden');
    }
  }

  function close() {
    loadToken++;
    const e = els();
    e.panel?.classList.add('hidden');
    if (e.img) { e.img.removeAttribute('src'); e.img.classList.add('hidden'); }
    releaseObjectUrl();
    currentTab = null;
  }

  function zoomBy(factor) {
    scale = Math.max(0.1, Math.min(8, scale * factor));
    applyTransform();
  }

  function zoomReset() {
    scale = 1;
    rotation = 0;
    applyTransform();
  }

  function rotateBy(deg) {
    rotation = (rotation + deg + 360) % 360;
    applyTransform();
  }

  function download() {
    if (currentTab?.attachment) appApi()?.saveAttachment?.(currentTab.messageId, currentTab.attachment);
  }

  function print() {
    // Comme pour le message et le PDF : document.title nomme le fichier
    // suggéré par « Imprimer au format PDF ».
    const previousTitle = document.title;
    document.title = currentTab?.attachment?.filename || previousTitle;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 2000);
  }

  window.ImageViewer = { open, close, zoomBy, zoomReset, rotateBy, download, print };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-image-zoom-out')?.addEventListener('click', () => zoomBy(1 / 1.2));
    document.getElementById('btn-image-zoom-in')?.addEventListener('click', () => zoomBy(1.2));
    document.getElementById('btn-image-zoom-reset')?.addEventListener('click', zoomReset);
    document.getElementById('btn-image-rotate')?.addEventListener('click', () => rotateBy(90));
    document.getElementById('btn-image-download')?.addEventListener('click', download);
    document.getElementById('btn-image-print')?.addEventListener('click', print);
  });
})();
