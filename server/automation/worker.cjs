'use strict';

// Stage 1 bridge: finish persisted browser intents; never discover new triggers here.
// Effects stay in Firestore. External email/SMS require a separate delivery outbox.
const CONTROL_PATH = 'serverAutomation/private/trainers';
const MAX_ATTEMPTS = 5;
const DAY = 86400000;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const data = snap => snap.exists ? snap.data() : {};
const validId = value => typeof value === 'string' && value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= 1300 && !value.includes('/') &&
  !['.', '..', '__proto__', 'constructor', 'prototype'].includes(value);
const attempts = value => Number.isInteger(value) && value >= 0 ? value : 0;

function controlValid(control, stateDocId) {
  return control.enabled === true && control.schemaVersion === 1 &&
    control.stateDocId === stateDocId && Number.isFinite(Date.parse(control.enabledAt)) &&
    typeof control.timeZone === 'string';
}

function jobValid(job, trainerId, jobId) {
  if (!job || job.id !== jobId || job.owner !== trainerId ||
      !validId(job.afId) || !validId(job.clientId) || !validId(job.mark) ||
      !validId(job.afDocId || job.afId) || !validId(job.clientDocId || job.clientId) ||
      !Number.isInteger(job.si) || job.si < 0 || job.si > 100 ||
      !job.step || typeof job.step.text !== 'string' || job.step.text.length > 20000 ||
      !Number.isFinite(Date.parse(job.createdAt))) return false;
  return jobId === 'af_' + encodeURIComponent(JSON.stringify([
    trainerId, job.afId, job.clientId, job.oneShot ? String(job.si) : job.mark
  ]));
}

function clientInScope(flow, client, clientId) {
  if (flow.scope === 'select') return Array.isArray(flow.clientIds) && flow.clientIds.includes(clientId);
  if (flow.scope === 'new') {
    const since = String(flow.createdAt || '').split('T')[0];
    const joined = client.joinDate || String(client.createdAt || '').split('T')[0];
    return !!(since && joined && joined >= since);
  }
  return !flow.scope || flow.scope === 'all';
}

function sameStep(a, b) {
  return !!a && a.type === b.type && String(a.text || '') === b.text &&
    Number(a.day || 1) === Number(b.day || 1);
}

function completedPatch(job, nowMs) {
  const marks = {[job.mark]: true};
  if (job.oneShot) marks[job.si] = true;
  return {
    afReceipts: {[job.id]: job.createdAt}, pending: {[job.id]: null},
    executed: {[job.afId]: {[job.clientId]: marks}},
    // Retain the browser's UTC cooldown convention until trigger migration.
    lastFired: {[job.afId]: {[job.clientId]: {[job.si]: new Date(nowMs).toISOString().slice(0, 10)}}}
  };
}

async function processPendingJob(db, {trainerId, stateDocId, jobId, runId, nowMs = Date.now()}) {
  if (![trainerId, stateDocId, jobId].every(validId) || !Number.isFinite(nowMs) || !runId) return {status: 'invalid'};
  const controlRef = db.doc(CONTROL_PATH + '/' + trainerId);
  const stateRef = db.doc('automationState/' + stateDocId);
  const ledgerRef = db.doc(controlRef.path + '/jobs/' + jobId);
  try {
    return await db.runTransaction(async tx => {
      const control = data(await tx.get(controlRef));
      if (!controlValid(control, stateDocId)) return {status: 'disabled'};
      // Reject an invalid timezone before any write rather than silently using UTC.
      try { new Intl.DateTimeFormat('pl', {timeZone: control.timeZone}).format(nowMs); }
      catch (_) { return {status: 'invalid'}; }
      const state = data(await tx.get(stateRef));
      if (state.trainerId !== trainerId) return {status: 'foreign'};
      const ledger = data(await tx.get(ledgerRef));
      const job = own(state.pending, jobId) && state.pending[jobId];
      if (own(state.afReceipts, jobId) && state.afReceipts[jobId]) {
        // A browser or another invocation won. Never overwrite a task's later edits.
        if (ledger.status !== 'done') tx.set(ledgerRef, {status: 'done', confirmedAt: nowMs}, {merge: true});
        return {status: 'already-done'};
      }
      if (!job) return {status: 'missing'};
      if (!jobValid(job, trainerId, jobId)) return {status: 'invalid'};
      const generation = typeof job.retryRequestId === 'string' ? job.retryRequestId.slice(0, 150) : '';
      const requestedRetry = generation && generation !== ledger.retryRequestId;
      const publicStatus = status => ({status, afId: job.afId, clientId: job.clientId, checkedAt: nowMs});
      const note = status => {
        if (ledger.status !== status) tx.set(ledgerRef, {status, checkedAt: nowMs}, {merge: true});
        if (!state.serverStatus || !state.serverStatus[jobId] || state.serverStatus[jobId].status !== status)
          tx.set(stateRef, {serverStatus: {[jobId]: publicStatus(status)}}, {merge: true});
        return {status};
      };
      const created = Date.parse(job.createdAt);
      if (created < Date.parse(control.enabledAt)) return note('before-enable');
      if (created > nowMs + 60000) return note('invalid');
      const count = Math.max(requestedRetry ? 0 : attempts(ledger.attempts), attempts(job.attempts));
      if (count >= MAX_ATTEMPTS) return note('exhausted');
      if (Math.max(requestedRetry ? 0 : Number(ledger.nextRetry) || 0, Number(job.nextRetry) || 0) > nowMs) return {status: 'backoff'};
      const flow = data(await tx.get(db.doc('autoflows/' + (job.afDocId || job.afId))));
      const client = data(await tx.get(db.doc('clients/' + (job.clientDocId || job.clientId))));
      if (flow.trainerId !== trainerId || client.trainerId !== trainerId) return note('foreign');
      if (((job.afDocId || job.afId) !== job.afId && flow.id !== job.afId) ||
          ((job.clientDocId || job.clientId) !== job.clientId && client.id !== job.clientId)) return note('invalid');
      if (flow.status !== 'active' || client.status === 'archived' || !clientInScope(flow, client, job.clientId)) return note('blocked');
      if (!sameStep((flow.steps || [])[job.si], job.step)) return note('step-changed');
      if (nowMs - created > (flow.trigger === 'session_today' ? 30 * 60000 : DAY)) return note('expired');
      if (!['message', 'task'].includes(job.step.type)) return note('browser-required');
      const text = job.step.text.replace(/\{imie\}/g, String(client.name || '').split(' ')[0]);
      const date = new Date(created);
      let collection, record;
      if (job.step.type === 'message') {
        collection = 'messages';
        record = {id: jobId + '_msg', trainerId, clientId: job.clientId, text, out: true,
          kind: 'system', createdAt: job.createdAt,
          time: date.toLocaleTimeString('pl', {timeZone: control.timeZone, hour: '2-digit', minute: '2-digit'})};
      } else {
        collection = 'tasks';
        record = {id: jobId + '_task', trainerId, clientId: job.clientId, title: text,
          status: 'open', priority: 'medium', cat: 'trening', due: job.createdAt.slice(0, 10), createdAt: job.createdAt};
      }
      const effectRef = db.doc(collection + '/' + record.id);
      const existingEffect = await tx.get(effectRef);
      if (existingEffect.exists) return note('collision');
      // All reads precede writes. The shared receipt is the lock for browser + server.
      tx.set(effectRef, record);
      tx.set(stateRef, {...completedPatch(job, nowMs), serverStatus: {[jobId]: {...publicStatus('done'), attempts: count + 1, nextRetry: 0, error: ''}}}, {merge: true});
      tx.set(ledgerRef, {status: 'done', attempts: count + 1, nextRetry: 0, error: '',
        completedAt: nowMs, lastRunId: String(runId), retryRequestId: generation}, {merge: true});
      return {status: 'done'};
    });
  } catch (_) {
    // No client text/names or provider error payloads are written to server logs.
    // Re-read receipt: the original commit may have succeeded despite a lost reply.
    try {
      return await db.runTransaction(async tx => {
        const control = data(await tx.get(controlRef));
        const state = data(await tx.get(stateRef));
        const ledger = data(await tx.get(ledgerRef));
        if (!controlValid(control, stateDocId) || state.trainerId !== trainerId) return {status: 'disabled'};
        if (own(state.afReceipts, jobId) && state.afReceipts[jobId]) {
          tx.set(ledgerRef, {status: 'done', confirmedAt: nowMs}, {merge: true});
          return {status: 'already-done'};
        }
        const job = own(state.pending, jobId) && state.pending[jobId];
        if (!jobValid(job, trainerId, jobId)) return {status: 'invalid'};
        if (ledger.lastRunId === String(runId)) return {status: ledger.status || 'error'};
        const generation = typeof job.retryRequestId === 'string' ? job.retryRequestId.slice(0, 150) : '';
        const requestedRetry = generation && generation !== ledger.retryRequestId;
        const count = Math.min(MAX_ATTEMPTS, Math.max(requestedRetry ? 0 : attempts(ledger.attempts), attempts(job.attempts)) + 1);
        const status = count >= MAX_ATTEMPTS ? 'exhausted' : 'error';
        const nextRetry = nowMs + Math.min(3600000, 60000 * 2 ** (count - 1));
        tx.set(ledgerRef, {status: count >= MAX_ATTEMPTS ? 'exhausted' : 'error',
          attempts: count, nextRetry, retryRequestId: generation,
          lastRunId: String(runId), error: 'firestore-write-unconfirmed'}, {merge: true});
        tx.set(stateRef, {serverStatus: {[jobId]: {status, attempts: count, nextRetry,
          checkedAt: nowMs, afId: job.afId, clientId: job.clientId, error: 'firestore-write-unconfirmed'}}}, {merge: true});
        return {status};
      });
    } catch (_) { return {status: 'error'}; }
  }
}

async function drainPending(db, {runId, nowMs = Date.now(), maxJobs = 100} = {}) {
  if (!runId) throw new Error('run-id-required');
  // Only an administrator can create these nested controls under current rules.
  const cursorRef = db.doc('serverAutomation/private/runtime/pendingCursor');
  let cursor = data(await cursorRef.get());
  const firstPage = () => db.collection(CONTROL_PATH).where('enabled', '==', true).orderBy('__name__').limit(100);
  let query = firstPage();
  if (validId(cursor.trainerId)) {
    const bound = db.doc(CONTROL_PATH + '/' + cursor.trainerId);
    query = cursor.afterTrainer ? query.startAfter(bound) : query.startAt(bound);
  }
  let controls = await query.get();
  if (!controls.docs.length && cursor.trainerId) {
    cursor = {};
    controls = await firstPage().get();
  }
  const counts = {};
  let handled = 0;
  let checkpoint = cursor;
  for (const item of controls.docs) {
    checkpoint = {trainerId: item.id, jobId: '', afterTrainer: true};
    const control = item.data();
    if (!validId(control.stateDocId) || !controlValid(control, control.stateDocId)) continue;
    const state = data(await db.doc('automationState/' + control.stateDocId).get());
    if (state.trainerId !== item.id) continue;
    const keys = Object.keys(state.pending || {}).sort().filter(id =>
      item.id !== cursor.trainerId || cursor.afterTrainer || !cursor.jobId || id > cursor.jobId);
    for (const jobId of keys) {
      if (!state.pending[jobId] || (state.afReceipts || {})[jobId]) continue;
      const result = await processPendingJob(db, {trainerId: item.id, stateDocId: control.stateDocId, jobId, runId, nowMs});
      counts[result.status] = (counts[result.status] || 0) + 1;
      handled++;
      checkpoint = {trainerId: item.id, jobId, afterTrainer: false};
      if (handled >= Math.min(100, Math.max(1, maxJobs))) {
        await cursorRef.set(checkpoint, {merge: true});
        return counts;
      }
    }
    checkpoint = {trainerId: item.id, jobId: '', afterTrainer: true};
  }
  if (checkpoint.trainerId) await cursorRef.set(checkpoint, {merge: true});
  return counts;
}

module.exports = {processPendingJob, drainPending};
