/**
 * FARO Mail — Moteur de correspondance des règles de messagerie.
 * Module volontairement pur (aucune dépendance à db/imap/pop3) : il reçoit
 * une liste de règles déjà chargées et un contexte de message, et renvoie
 * les règles correspondantes ainsi que l'action combinée à appliquer.
 * L'application effective (écriture locale + éventuelle action serveur IMAP)
 * reste à la charge de l'appelant, qui seul connaît le compte/la connexion.
 */
'use strict';

const FIELD_EXTRACTORS = {
  from: ctx => `${ctx.fromName || ''} ${ctx.fromAddr || ''}`.trim().toLowerCase(),
  to: ctx => String(ctx.toAddr || '').trim().toLowerCase(),
  subject: ctx => String(ctx.subject || '').trim().toLowerCase(),
  body: ctx => String(ctx.bodyText || '').trim().toLowerCase(),
};

function matchesCondition(condition, ctx) {
  const extractor = FIELD_EXTRACTORS[condition?.field] || FIELD_EXTRACTORS.subject;
  const haystack = extractor(ctx);
  const needle = String(condition?.value || '').trim().toLowerCase();
  if (!needle) return false;
  switch (condition?.op) {
    case 'equals': return haystack === needle;
    case 'startsWith': return haystack.startsWith(needle);
    case 'notContains': return !haystack.includes(needle);
    case 'contains':
    default: return haystack.includes(needle);
  }
}

function ruleMatches(rule, ctx) {
  const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
  if (!conditions.length) return false;
  return rule.matchAll
    ? conditions.every(condition => matchesCondition(condition, ctx))
    : conditions.some(condition => matchesCondition(condition, ctx));
}

/** Renvoie les règles activées qui correspondent au message, dans l'ordre de
 * priorité, en s'arrêtant à la première règle marquée stopProcessing. */
function evaluate(rules, ctx) {
  const matched = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule.enabled) continue;
    if (ruleMatches(rule, ctx)) {
      matched.push(rule);
      if (rule.stopProcessing) break;
    }
  }
  return matched;
}

/** Fusionne les actions de plusieurs règles correspondantes. En cas de
 * conflit sur une action à valeur unique (déplacement, indésirable), la
 * dernière règle appliquée (ordre de priorité) l'emporte. */
function mergeActions(matchedRules) {
  const outcome = { markRead: null, flag: null, isSpam: null, labelIds: [], moveTo: null };
  const labelIds = new Set();
  for (const rule of matchedRules) {
    const actions = rule.actions || {};
    if (actions.markRead === true) outcome.markRead = true;
    if (actions.flag === true) outcome.flag = true;
    if (actions.isSpam === true) outcome.isSpam = true;
    else if (actions.isSpam === false) outcome.isSpam = false;
    if (actions.labelId) labelIds.add(Number(actions.labelId));
    if (actions.moveTo) outcome.moveTo = actions.moveTo;
  }
  outcome.labelIds = [...labelIds];
  return outcome;
}

function hasOutcome(outcome) {
  return Boolean(outcome && (
    outcome.markRead !== null || outcome.flag !== null || outcome.isSpam !== null
    || outcome.labelIds.length || outcome.moveTo
  ));
}

module.exports = { matchesCondition, ruleMatches, evaluate, mergeActions, hasOutcome };
