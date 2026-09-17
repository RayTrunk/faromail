/* FARO Mail — internationalisation légère */
'use strict';
(function () {
  const DEFAULT_LOCALE = 'de';
  const FALLBACK_MESSAGES = {
    'status.connected': 'Engine verbunden',
    'status.disconnected': 'Engine getrennt — wird gestartet…',
    'status.ready': 'Bereit',
    'error': 'Fehler',
    'group.today': 'Heute',
    'group.yesterday': 'Gestern',
    'group.thisWeek': 'Diese Woche',
    'group.thisMonth': 'Diesen Monat',
    'group.older': 'Älter',
    'group.week': 'Diese Woche',
    'group.month': 'Diesen Monat',
    'mail.noSubject': '(kein Betreff)',
    'mail.unknownSender': 'Unbekannter Absender',
    'mail.unknownRecipient': 'Unbekannter Empfänger',
    'remote.blocked': 'Externe Bilder und Inhalte wurden zum Schutz Ihrer Privatsphäre blockiert.',
    'remote.inspect': 'Details anzeigen',
    'remote.none': 'Für diese Nachricht wurden keine externen Inhalte erkannt.',
    'selection.select': 'Auswählen',
    'startup.engineInit': 'Engine wird initialisiert…',
    'startup.engineStarting': 'Mail-Engine wird gestartet…',
    'startup.loadingConfig': 'Konfiguration wird geladen…',
    'startup.error': 'Startfehler: {message}',
  };
  const ALIASES = {
    'group.week': 'group.thisWeek',
    'group.month': 'group.thisMonth',
  };

  const I18N = {
    locale: '',
    messages: {},
    loading: null,

    async load(locale = DEFAULT_LOCALE) {
      const normalized = String(locale || DEFAULT_LOCALE).toLowerCase();
      const requested = ['en', 'de', 'fr'].includes(normalized.slice(0, 2)) ? normalized.slice(0, 2) : DEFAULT_LOCALE;
      let messages = {};
      try {
        const response = await fetch(`locales/${requested}.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        messages = await response.json();
      } catch (error) {
        if (requested !== DEFAULT_LOCALE) {
          try {
            const fallback = await fetch(`locales/${DEFAULT_LOCALE}.json`, { cache: 'no-store' });
            if (fallback.ok) messages = await fallback.json();
          } catch {}
        }
        if (!Object.keys(messages).length) console.warn('[FARO Mail] Traductions indisponibles :', error);
      }
      this.locale = requested;
      // Le moteur de correction orthographique de WebView2/Chromium se fie
      // notamment à cet attribut pour choisir le bon dictionnaire.
      try { document.documentElement.lang = requested; } catch {}
      this.messages = { ...FALLBACK_MESSAGES, ...(messages || {}) };
      // Compatibilité avec des clés utilisées par certaines anciennes vues.
      for (const [alias, target] of Object.entries(ALIASES)) {
        if (!this.messages[alias] && this.messages[target]) this.messages[alias] = this.messages[target];
      }
      this.apply(document);
      return this.messages;
    },

    translate(key, variables = {}) {
      const target = ALIASES[key] || key;
      const raw = this.messages?.[key] ?? this.messages?.[target] ?? FALLBACK_MESSAGES[key] ?? FALLBACK_MESSAGES[target] ?? key;
      return String(raw).replace(/\{([\w.-]+)\}/g, (match, name) => {
        return Object.prototype.hasOwnProperty.call(variables || {}, name) ? String(variables[name]) : match;
      });
    },

    apply(root = document) {
      const scope = root || document;
      scope.querySelectorAll?.('[data-i18n]').forEach(element => {
        element.textContent = this.translate(element.dataset.i18n);
      });
      scope.querySelectorAll?.('[data-i18n-title]').forEach(element => {
        const label = this.translate(element.dataset.i18nTitle);
        element.setAttribute('title', label);
        element.setAttribute('aria-label', label);
      });
      scope.querySelectorAll?.('[data-i18n-ph]').forEach(element => {
        element.setAttribute('placeholder', this.translate(element.dataset.i18nPh));
      });
      scope.querySelectorAll?.('[data-i18n-aria-label]').forEach(element => {
        element.setAttribute('aria-label', this.translate(element.dataset.i18nAriaLabel));
      });
    },
  };

  window.I18N = I18N;
  window.t = (key, variables) => I18N.translate(key, variables);

  window.addEventListener('DOMContentLoaded', () => {
    const browserLocale = (navigator.language || DEFAULT_LOCALE).slice(0, 2);
    I18N.loading = I18N.load(browserLocale).catch(error => console.warn('[FARO Mail] Chargement langue :', error));
  });
})();
