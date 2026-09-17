/**
 * FARO Mail — Confiance TLS par épinglage de certificat.
 * La validation de la chaîne de certification reste active par défaut pour
 * tous les comptes (voir CHANGELOG 0.3.6 : aucun rejectUnauthorized:false
 * global). Un compte peut néanmoins épingler explicitement un certificat
 * précis (auto-signé ou émis par une autorité privée) après confirmation de
 * l'utilisateur : dans ce cas seul CE certificat exact est accepté pour ce
 * compte, toute substitution ultérieure (MITM) est toujours rejetée.
 */
'use strict';
const tls = require('tls');

const CERT_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'HOSTNAME_MISMATCH',
]);

function isCertTrustError(error) {
  if (!error) return false;
  if (CERT_ERROR_CODES.has(error.code)) return true;
  const message = String(error.message || '').toLowerCase();
  return /self.signed|self signed|certificate has expired|unable to verify the first certificate|unable to get local issuer certificate|certificate.*not (yet valid|trusted)|altnames/.test(message);
}

function classifyConnectionError(error) {
  if (!error) return 'UNKNOWN';
  if (isCertTrustError(error)) return 'CERT_UNTRUSTED';
  const code = error.code || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_NOT_FOUND';
  if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'TIMEOUT';
  if (code === 'ECONNRESET' || code === 'EPIPE') return 'CONNECTION_RESET';
  if (code === 'EAUTH' || Number(error.responseCode) === 535) return 'AUTH_FAILED';
  const message = String(error.message || '').toLowerCase();
  if (/authenticationfailed|invalid credentials|login failed|auth.*fail/.test(message)) return 'AUTH_FAILED';
  return 'UNKNOWN';
}

/** Ouvre une connexion TLS brute (sans validation) pour lire le certificat présenté. */
function probeCertificate(host, port, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = tls.connect({
      host: String(host || ''),
      port: Number(port) || 443,
      servername: String(host || ''),
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate(true);
      if (!cert || !cert.subject) {
        finish(new Error('Aucun certificat reçu du serveur'));
        return;
      }
      finish(null, {
        fingerprint256: cert.fingerprint256 || '',
        subject: cert.subject?.CN || cert.subject?.O || String(host || ''),
        issuer: cert.issuer?.CN || cert.issuer?.O || '',
        validFrom: cert.valid_from || '',
        validTo: cert.valid_to || '',
        selfSigned: Boolean(cert.subject?.CN) && cert.subject?.CN === cert.issuer?.CN,
      });
    });
    socket.once('error', error => finish(error));
    socket.once('timeout', () => finish(new Error('Délai dépassé lors de la vérification du certificat')));
  });
}

/**
 * Options tls.connect() à fusionner dans la config du client de protocole.
 * Retourne undefined si aucun certificat n'est épinglé : la validation par
 * défaut de Node (chaîne de confiance système) s'applique alors normalement.
 */
function buildTlsOptions(pinnedFingerprint256) {
  const pinned = String(pinnedFingerprint256 || '').trim();
  if (!pinned) return undefined;
  return {
    rejectUnauthorized: false,
    checkServerIdentity: (_hostname, cert) => {
      const fingerprint = cert?.fingerprint256 || '';
      if (fingerprint && fingerprint === pinned) return undefined;
      return new Error(
        'Le certificat présenté par le serveur ne correspond plus à celui approuvé pour ce compte. '
        + 'Connexion refusée par sécurité (possible changement de certificat ou interception).'
      );
    },
  };
}

module.exports = { isCertTrustError, classifyConnectionError, probeCertificate, buildTlsOptions };
