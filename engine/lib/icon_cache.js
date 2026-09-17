/**
 * FARO Mail — cache local des icônes d'expéditeurs.
 * Ne charge jamais les images du message. On tente uniquement le favicon du domaine,
 * avec délai court et cache local. Si ça échoue, l'interface garde les initiales.
 */
'use strict';
const { Buffer } = require('buffer');
const dns = require('dns');
const net = require('net');

const MAX_ICON_BYTES = 160 * 1024;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// L'expéditeur d'un message contrôle entièrement le nom de domaine utilisé
// ici (en-tête From). Sans ce filtre, un simple courrier reçu suffirait à
// faire sonder par le moteur des adresses internes (réseau local, service de
// métadonnées cloud, etc.) via une requête HTTP sortante automatique.
function isDisallowedAddress(address, family) {
  if (family === 6 || address.includes(':')) {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('ff')) return true; // multicast
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isDisallowedAddress(mapped[1], 4);
    return false;
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true; // IETF protocol assignments / TEST-NET
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

async function isPublicHostname(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '');
  if (!host) return false;
  const literalFamily = net.isIP(host);
  if (literalFamily) return !isDisallowedAddress(host, literalFamily);
  try {
    const results = await dns.promises.lookup(host, { all: true, verbatim: true });
    if (!results.length) return false;
    return results.every(entry => !isDisallowedAddress(entry.address, entry.family));
  } catch {
    return false;
  }
}

function domainFromEmail(email) {
  const match = String(email || '').trim().toLowerCase().match(/@([^>\s]+)$/);
  return match ? match[1].replace(/^www\./, '') : '';
}

function providerKey(domain) {
  const source = String(domain || '').toLowerCase();
  if (/gmail|googlemail/.test(source)) return 'gmail';
  if (/outlook|hotmail|live\.com|office365|microsoft/.test(source)) return 'outlook';
  if (/yahoo/.test(source)) return 'yahoo';
  if (/icloud|me\.com|mac\.com/.test(source)) return 'icloud';
  if (/proton/.test(source)) return 'proton';
  if (/laposte\.net/.test(source)) return 'laposte';
  if (/free\.fr/.test(source)) return 'free';
  if (/orange|wanadoo/.test(source)) return 'orange';
  if (/sfr\.fr/.test(source)) return 'sfr';
  if (/ovh|ovhcloud/.test(source)) return 'ovh';
  return '';
}

async function fetchWithTimeout(url, timeout = 2500) {
  if (typeof fetch !== 'function') return null;
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { return null; }
  if (!(await isPublicHostname(hostname))) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'FARO Mail/0.2.23 icon-cache' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!/^image\//.test(contentType) && !contentType.includes('x-icon')) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > MAX_ICON_BYTES) return null;
    const mime = contentType.split(';')[0] || 'image/png';
    return `data:${mime};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSenderIcon({ email, db }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const domain = domainFromEmail(cleanEmail);
  if (!domain) return { email: cleanEmail, domain: '', iconData: '', providerKey: '', source: 'initials' };
  const provider = providerKey(domain);
  const cacheKey = `domain:${domain}`;
  const cached = db.getSenderIconCache(cacheKey);
  const now = Date.now();
  if (cached && cached.checked_at && now - Number(cached.checked_at) < CACHE_TTL_MS) {
    return { email: cleanEmail, domain, providerKey: provider, iconData: cached.icon_data || '', source: cached.source || 'cache' };
  }

  // Fournisseurs connus : on évite le réseau, l'interface sait afficher l'icône.
  if (provider) {
    db.setSenderIconCache(cacheKey, { iconData: '', source: `provider:${provider}`, status: 'provider' });
    return { email: cleanEmail, domain, providerKey: provider, iconData: '', source: `provider:${provider}` };
  }

  const candidates = [
    `https://${domain}/favicon.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://www.${domain}/favicon.ico`,
  ];
  let iconData = '';
  for (const url of candidates) {
    iconData = await fetchWithTimeout(url);
    if (iconData) break;
  }
  db.setSenderIconCache(cacheKey, {
    iconData,
    source: iconData ? 'favicon' : 'initials',
    status: iconData ? 'ok' : 'missing',
  });
  return { email: cleanEmail, domain, providerKey: provider, iconData, source: iconData ? 'favicon' : 'initials' };
}

module.exports = { resolveSenderIcon, domainFromEmail, providerKey };
