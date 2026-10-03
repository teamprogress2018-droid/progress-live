'use strict';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {logger} = require('firebase-functions');
const {drainPending} = require('./worker.cjs');
initializeApp();

exports.continuePendingAutoflow = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Europe/Warsaw', region: 'europe-west1',
  timeoutSeconds: 120, memory: '256MiB', maxInstances: 1, concurrency: 1,
  retryCount: 0
}, async event => {
  const counts = await drainPending(getFirestore(), {runId: String(event.scheduleTime), maxJobs: 100});
  logger.info('autoflow-pending-summary', counts);
});
