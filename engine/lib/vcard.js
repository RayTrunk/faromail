/**
 * FARO Mail — Lecteur vCard minimal (RFC 6350 / vCard 3.0 & 4.0), suffisant
 * pour un abonnement en lecture seule : dépliage des lignes, propriétés
 * usuelles (FN, N, EMAIL, TEL, ORG, TITLE, ADR, BDAY, NOTE, UID).
 */
'use strict';

function unfoldLines(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function decodeValue(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = (parts.shift() || '').toUpperCase();
  const params = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).toUpperCase();
  }
  return { name, params, value };
}

function labelFromParams(params) {
  const type = String(params.TYPE || '').split(',')[0].toLowerCase();
  return type && type !== 'internet' && type !== 'pref' ? type : '';
}

/**
 * Retourne un tableau de fiches { importKey, displayName, firstName,
 * lastName, company, jobTitle, emails: [{email,label}], phone, mobile,
 * postalAddress, birthday, notes }.
 */
function parseVcard(text) {
  const lines = unfoldLines(text);
  const cards = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^BEGIN:VCARD$/i.test(line)) { current = { emails: [], tel: [] }; continue; }
    if (/^END:VCARD$/i.test(line)) { if (current) cards.push(current); current = null; continue; }
    if (!current) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;
    const value = decodeValue(parsed.value);

    switch (parsed.name) {
      case 'UID':
        current.uid = value.trim();
        break;
      case 'FN':
        current.fn = value.trim();
        break;
      case 'N': {
        const [last = '', first = ''] = value.split(';');
        current.lastName = decodeValue(last).trim();
        current.firstName = decodeValue(first).trim();
        break;
      }
      case 'EMAIL':
        if (value.trim()) current.emails.push({ email: value.trim(), label: labelFromParams(parsed.params) });
        break;
      case 'TEL': {
        const type = String(parsed.params.TYPE || '').toLowerCase();
        current.tel.push({ value: value.trim(), mobile: /cell|mobile/.test(type) });
        break;
      }
      case 'ORG':
        current.org = value.split(';')[0].trim();
        break;
      case 'TITLE':
        current.title = value.trim();
        break;
      case 'ADR': {
        const fields = value.split(';').map(decodeValue).map(part => part.trim()).filter(Boolean);
        current.adr = fields.join(', ');
        break;
      }
      case 'BDAY':
        current.bday = value.trim().replace(/^(\d{4})-?(\d{2})-?(\d{2}).*$/, '$1-$2-$3');
        break;
      case 'NOTE':
        current.note = value.trim();
        break;
      default:
        break;
    }
  }

  return cards.map(card => {
    const displayName = card.fn || [card.firstName, card.lastName].filter(Boolean).join(' ').trim()
      || card.emails[0]?.email || '';
    const importKey = card.uid || (card.emails[0]?.email ? `email:${card.emails[0].email.toLowerCase()}` : '');
    const mobile = card.tel.find(item => item.mobile)?.value || '';
    const phone = card.tel.find(item => !item.mobile)?.value || card.tel[0]?.value || '';
    return {
      importKey,
      displayName,
      firstName: card.firstName || '',
      lastName: card.lastName || '',
      company: card.org || '',
      jobTitle: card.title || '',
      emails: card.emails,
      phone,
      mobile,
      postalAddress: card.adr || '',
      birthday: card.bday || '',
      notes: card.note || '',
    };
  }).filter(card => card.importKey && card.displayName);
}

function escapeVcardValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Sérialise une fiche (forme renvoyée par db.decorateContact) en vCard 3.0. */
function buildVcard(contact = {}) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const fn = contact.displayName
    || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
    || contact.primaryEmail || contact.emails?.[0]?.email || '';
  lines.push(`FN:${escapeVcardValue(fn)}`);
  lines.push(`N:${escapeVcardValue(contact.lastName)};${escapeVcardValue(contact.firstName)};;;`);
  if (contact.company) lines.push(`ORG:${escapeVcardValue(contact.company)}`);
  if (contact.jobTitle) lines.push(`TITLE:${escapeVcardValue(contact.jobTitle)}`);
  for (const entry of contact.emails || []) {
    if (!entry?.email) continue;
    const type = entry.label ? `;TYPE=${escapeVcardValue(entry.label).toUpperCase()}` : '';
    lines.push(`EMAIL${type}:${escapeVcardValue(entry.email)}`);
  }
  if (contact.phone) lines.push(`TEL;TYPE=WORK:${escapeVcardValue(contact.phone)}`);
  if (contact.mobile) lines.push(`TEL;TYPE=CELL:${escapeVcardValue(contact.mobile)}`);
  if (contact.postalAddress) lines.push(`ADR:;;${escapeVcardValue(contact.postalAddress)};;;;`);
  if (contact.birthday) lines.push(`BDAY:${escapeVcardValue(contact.birthday)}`);
  if (contact.notes) lines.push(`NOTE:${escapeVcardValue(contact.notes)}`);
  if (contact.id != null) lines.push(`UID:faromail-contact-${contact.id}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function buildVcardCollection(contacts = []) {
  return contacts.map(buildVcard).join('\r\n') + (contacts.length ? '\r\n' : '');
}

module.exports = { parseVcard, buildVcard, buildVcardCollection };
