/* FARO Mail 0.4.3 — aperçu PDF intégré (PDF.js, vendored localement).
 * Ouvre une pièce jointe PDF dans un onglet du lecteur, comme un message,
 * sans dépendance réseau (aucun CDN) : conforme au fonctionnement hors ligne
 * de FARO Mail. */
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

  let pdfjsLibPromise = null;
  function loadLib() {
    if (!pdfjsLibPromise) {
      pdfjsLibPromise = import('../vendor/pdfjs/pdf.min.js').then(lib => {
        lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
        return lib;
      });
    }
    return pdfjsLibPromise;
  }

  let currentDoc = null;
  let currentTab = null;
  let scale = 1.25;
  let renderToken = 0;

  function els() {
    return {
      panel: document.getElementById('pdf-viewer-panel'),
      pages: document.getElementById('pdf-viewer-pages'),
      loading: document.getElementById('pdf-viewer-loading'),
      error: document.getElementById('pdf-viewer-error'),
      title: document.getElementById('pdf-viewer-title'),
      pageLabel: document.getElementById('pdf-viewer-page-label'),
      zoomLabel: document.getElementById('pdf-viewer-zoom-label'),
    };
  }

  async function renderAllPages() {
    const e = els();
    const token = ++renderToken;
    e.pages.innerHTML = '';
    e.error.classList.add('hidden');
    e.loading.classList.remove('hidden');
    try {
      const numPages = currentDoc.numPages;
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        if (token !== renderToken) return;
        const page = await currentDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const pageWrap = document.createElement('div');
        pageWrap.className = 'pdf-page';
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        pageWrap.appendChild(canvas);
        e.pages.appendChild(pageWrap);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (token !== renderToken) return;
      }
      if (token !== renderToken) return;
      e.pageLabel.textContent = tr('pdf.pageCount', { count: numPages });
      e.zoomLabel.textContent = Math.round(scale * 100) + '%';
    } catch (error) {
      if (token !== renderToken) return;
      e.error.textContent = tr('pdf.renderError', { error: error.message || String(error) });
      e.error.classList.remove('hidden');
    } finally {
      if (token === renderToken) e.loading.classList.add('hidden');
    }
  }

  async function open(tab) {
    const e = els();
    document.getElementById('reader-empty')?.classList.add('hidden');
    document.getElementById('reader-content')?.classList.add('hidden');
    e.panel.classList.remove('hidden');
    currentTab = tab;
    e.title.textContent = tab.attachment?.filename || tab.title || '';
    if (currentDoc) {
      const previous = currentDoc;
      currentDoc = null;
      try { await previous.destroy(); } catch {}
    }
    e.pages.innerHTML = '';
    e.error.classList.add('hidden');
    e.pageLabel.textContent = '';
    e.loading.classList.remove('hidden');
    const token = ++renderToken;
    try {
      const [lib, result] = await Promise.all([
        loadLib(),
        appApi().rpc('attachments.read', { messageId: tab.messageId, index: tab.attachment.index }),
      ]);
      if (token !== renderToken || currentTab !== tab) return;
      const bytes = base64ToBytes(result.data);
      const loadingTask = lib.getDocument({
        data: bytes,
        cMapUrl: 'vendor/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'vendor/pdfjs/standard_fonts/',
      });
      const doc = await loadingTask.promise;
      if (token !== renderToken || currentTab !== tab) { try { await doc.destroy(); } catch {} return; }
      currentDoc = doc;
      await renderAllPages();
    } catch (error) {
      if (token !== renderToken || currentTab !== tab) return;
      e.loading.classList.add('hidden');
      e.error.textContent = tr('pdf.loadError', { error: error.message || String(error) });
      e.error.classList.remove('hidden');
    }
  }

  function close() {
    const e = els();
    renderToken++;
    e.panel?.classList.add('hidden');
    if (e.pages) e.pages.innerHTML = '';
    currentTab = null;
    if (currentDoc) {
      const previous = currentDoc;
      currentDoc = null;
      previous.destroy().catch(() => {});
    }
  }

  function zoomBy(factor) {
    scale = Math.max(0.4, Math.min(4, scale * factor));
    if (currentDoc) renderAllPages();
  }

  function download() {
    if (currentTab?.attachment) appApi()?.saveAttachment?.(currentTab.messageId, currentTab.attachment);
  }

  function print() {
    // Comme pour l'impression d'un message (viewer.js), document.title sert
    // de nom de fichier suggéré par « Imprimer au format PDF ».
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

  window.PdfViewer = { open, close, zoomBy, download, print };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-pdf-zoom-out')?.addEventListener('click', () => zoomBy(1 / 1.2));
    document.getElementById('btn-pdf-zoom-in')?.addEventListener('click', () => zoomBy(1.2));
    document.getElementById('btn-pdf-download')?.addEventListener('click', download);
    document.getElementById('btn-pdf-print')?.addEventListener('click', print);
  });
})();
