/**
 * FARO Mail — Envoi SMTP (nodemailer)
 * Le message est envoyé avec le serveur du compte sélectionné. Une copie MIME
 * identique est renvoyée au moteur afin qu'il puisse l'ajouter dans le dossier
 * « Envoyés » du même compte via IMAP.
 */
'use strict';
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const certTrust = require('./cert_trust');

function transporter(account) {
  const tlsOptions = certTrust.buildTlsOptions(account.smtp?.trustedCertFingerprint);
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port || 465,
    secure: account.smtp.secure !== false,
    auth: {
      user: account.smtp.user || account.pop3?.user || account.imap?.user,
      pass: account.smtp.pass || account.pop3?.pass || account.imap?.pass,
    },
    ...(tlsOptions ? { tls: tlsOptions } : {}),
  });
}

function normalizeAttachments(attachments) {
  return (attachments || []).map(attachment => attachment.path
    ? { filename: attachment.filename, path: attachment.path }
    : {
        filename: attachment.filename,
        content: Buffer.from(attachment.content || '', 'base64'),
      });
}

/** Identité d'envoi : le compte lui-même par défaut, ou l'un de ses alias
 * (« envoyer en tant que ») si mail.fromIdentity correspond à un alias connu. */
function resolveFromIdentity(account, mail) {
  const aliasId = String(mail?.fromIdentity || '').trim();
  if (aliasId) {
    const alias = (account.aliases || []).find(item => item.id === aliasId);
    if (alias?.email) return { name: alias.name || '', address: alias.email, replyTo: alias.replyTo || '' };
  }
  return { name: account.displayName || '', address: account.email, replyTo: '' };
}

function createMessage(account, mail) {
  const identity = resolveFromIdentity(account, mail);
  const domain = String(identity.address || account.email || '').split('@')[1] || 'faromail.local';
  const messageId = mail.messageId || `<${crypto.randomUUID()}@${domain}>`;
  const receiptAddress = String(identity.address || account.smtp?.user || account.pop3?.user || account.imap?.user || '').trim();
  const headers = {};

  // MDN : le destinataire reste libre d'accepter ou de refuser l'envoi
  // de l'accusé de lecture. Le second en-tête améliore la compatibilité
  // avec certains clients historiques.
  if (mail.readReceipt && receiptAddress) {
    headers['Disposition-Notification-To'] = receiptAddress;
    headers['X-Confirm-Reading-To'] = receiptAddress;
  }

  return {
    from: { name: identity.name, address: identity.address },
    replyTo: identity.replyTo || undefined,
    to: mail.to,
    cc: mail.cc || undefined,
    bcc: mail.bcc || undefined,
    subject: mail.subject,
    text: mail.text || undefined,
    html: mail.html || undefined,
    inReplyTo: mail.inReplyTo || undefined,
    references: mail.references || undefined,
    attachments: normalizeAttachments(mail.attachments),
    headers: Object.keys(headers).length ? headers : undefined,
    dsn: mail.deliveryReceipt && receiptAddress ? {
      id: crypto.randomUUID(),
      return: 'headers',
      notify: ['success', 'failure', 'delay'],
      recipient: receiptAddress,
    } : undefined,
    messageId,
    date: new Date(),
  };
}

async function send(account, mail) {
  const message = createMessage(account, mail);
  const transport = transporter(account);
  const info = await transport.sendMail(message);

  // La copie du dossier Envoyés ne doit pas exposer l'en-tête Bcc à d'autres
  // destinataires. Elle reste néanmoins une copie complète du contenu envoyé.
  const sentCopy = { ...message, bcc: undefined, dsn: undefined };
  const raw = await new MailComposer(sentCopy).compile().build();

  return {
    messageId: info.messageId || message.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    raw,
  };
}

async function verify(account) {
  return transporter(account).verify();
}

module.exports = { send, verify };
