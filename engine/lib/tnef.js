/**
 * FARO Mail — Décodage TNEF (winmail.dat) pour les messages envoyés par
 * Outlook en « format riche » Outlook. Ces messages arrivent avec un corps
 * quasi vide et une pièce jointe winmail.dat opaque qui contient en réalité
 * le corps mis en forme et, souvent, les véritables pièces jointes.
 *
 * `omnimail` est un paquet ESM uniquement : l'import dynamique est mis en
 * cache après le premier appel pour éviter de répéter la résolution du
 * module à chaque message.
 */
'use strict';

const TNEF_SIGNATURE = Buffer.from([0x78, 0x9f, 0x3e, 0x22]);

let omnimailPromise = null;
function loadOmnimail() {
  if (!omnimailPromise) omnimailPromise = import('omnimail');
  return omnimailPromise;
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return Buffer.from(value || '');
}

function looksLikeTnef(attachment) {
  const filename = String(attachment?.filename || '').trim().toLowerCase();
  const contentType = String(attachment?.contentType || '').trim().toLowerCase();
  if (filename === 'winmail.dat') return true;
  if (contentType === 'application/ms-tnef' || contentType === 'application/vnd.ms-tnef') return true;
  const content = attachment?.content;
  if ((Buffer.isBuffer(content) || content instanceof Uint8Array) && content.length >= 4) {
    return toBuffer(content).subarray(0, 4).equals(TNEF_SIGNATURE);
  }
  return false;
}

/**
 * Remplace toute pièce jointe winmail.dat détectée par les pièces jointes
 * réelles qu'elle contient, et complète le corps du message si celui-ci
 * était vide. Les pièces jointes non-TNEF ne sont jamais modifiées. En cas
 * d'échec du décodage, le winmail.dat original est conservé tel quel.
 */
async function expandTnefAttachments(parsed) {
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  if (!attachments.length) return parsed;
  if (!attachments.some(looksLikeTnef)) return parsed;

  let parseTnef;
  try {
    ({ parseTnef } = await loadOmnimail());
  } catch {
    return parsed;
  }

  const expanded = [];
  const hasBody = Boolean(String(parsed.text || '').trim() || String(parsed.html || '').trim());
  let bodyApplied = hasBody;

  for (const attachment of attachments) {
    if (!looksLikeTnef(attachment)) {
      expanded.push(attachment);
      continue;
    }
    try {
      const tnef = parseTnef(toBuffer(attachment.content));
      for (const inner of tnef.attachments || []) {
        if (!inner || inner.isInline) continue;
        expanded.push({
          filename: inner.filename || 'piece-jointe',
          contentType: inner.mimeType || 'application/octet-stream',
          size: Number(inner.size) || toBuffer(inner.content).length,
          content: toBuffer(inner.content),
        });
      }
      if (!bodyApplied) {
        if (tnef.body?.html) { parsed.html = String(tnef.body.html); bodyApplied = true; }
        else if (tnef.body?.text) { parsed.text = String(tnef.body.text); bodyApplied = true; }
      }
    } catch {
      // TNEF corrompu ou non pris en charge : le winmail.dat brut reste
      // disponible comme pièce jointe plutôt que de faire échouer la lecture.
      expanded.push(attachment);
    }
  }

  parsed.attachments = expanded;
  return parsed;
}

module.exports = { expandTnefAttachments, looksLikeTnef };
