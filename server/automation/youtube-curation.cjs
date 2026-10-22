'use strict';

const crypto = require('node:crypto');
const {getFirestore} = require('firebase-admin/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {safeTerms, candidatesFromYoutube} = require('./youtube-curation-core.cjs');

const youtubeDataApiKey = defineSecret('YOUTUBE_DATA_API_KEY');
const ALLOWED_ORIGINS = ['https://teamprogress2018-droid.github.io', 'http://localhost:8080'];
const MAX_DAILY_SEARCHES = 80; // search.list costs 100 YouTube quota units.
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function curationDocId(trainerId, exerciseName) {
  return 'yt_' + crypto.createHash('sha256').update(trainerId + '\u0000' + exerciseName.toLowerCase()).digest('hex').slice(0, 32);
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

async function requireTrainer(db, uid) {
  const account = await db.collection('clientAccounts').doc(uid).get();
  if (account.exists) throw new HttpsError('permission-denied', 'Ta funkcja jest dostępna tylko dla trenera.');
}

async function consumeQuota(db, trainerId) {
  const reference = db.collection('youtubeCurationQuota').doc(trainerId + '_' + todayKey());
  await db.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    const used = Number(current.exists ? current.data().searches || 0 : 0);
    if (used >= MAX_DAILY_SEARCHES) throw new HttpsError('resource-exhausted', 'Dzisiejszy limit wyszukiwań został wykorzystany. Spróbuj jutro.');
    transaction.set(reference, {trainerId, day: todayKey(), searches: used + 1, updatedAt: new Date().toISOString()}, {merge: true});
  });
}

async function youtubeJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new HttpsError('internal', 'YouTube chwilowo nie zwrócił wyników.');
  return response.json();
}

async function findYoutubeCandidates({apiKey, exerciseName, terms}) {
  const query = safeTerms(terms).join(' ') || exerciseName;
  const search = await youtubeJson('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '20', q: query, relevanceLanguage: 'en', key: apiKey
  }));
  const ids = (search.items || []).map(item => item?.id?.videoId).filter(Boolean).slice(0, 20);
  if (!ids.length) return [];
  const videos = await youtubeJson('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({
    part: 'snippet,statistics,status', id: ids.join(','), key: apiKey
  }));
  return candidatesFromYoutube(videos.items, [exerciseName, ...safeTerms(terms)], 5);
}

const youtubeCurationSuggest = onCall({
  region: 'europe-west1', timeoutSeconds: 45, memory: '256MiB', maxInstances: 2,
  cors: ALLOWED_ORIGINS, secrets: [youtubeDataApiKey]
}, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Zaloguj się, aby wyszukać filmy.');
  const trainerId = request.auth.uid;
  const exerciseName = String(request.data?.exerciseName || '').trim();
  const terms = safeTerms(request.data?.terms || []);
  if (!exerciseName || exerciseName.length > 180) throw new HttpsError('invalid-argument', 'Wybierz prawidłowe ćwiczenie.');
  if (!terms.length) terms.push(exerciseName);
  const db = getFirestore();
  await requireTrainer(db, trainerId);
  const reference = db.collection('youtubeCuration').doc(curationDocId(trainerId, exerciseName));
  const cached = await reference.get();
  const updatedAt = Date.parse(cached.exists ? cached.data().updatedAt || '' : '');
  if (cached.exists && Array.isArray(cached.data().candidates) && Date.now() - updatedAt < CACHE_AGE_MS) {
    return {exerciseName, candidates: cached.data().candidates, cached: true};
  }
  await consumeQuota(db, trainerId);
  const apiKey = youtubeDataApiKey.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'Brakuje bezpiecznej konfiguracji YouTube API.');
  const candidates = await findYoutubeCandidates({apiKey, exerciseName, terms});
  const now = new Date().toISOString();
  await reference.set({trainerId, exerciseName, terms, candidates, status: 'review', updatedAt: now, createdAt: cached.exists ? cached.data().createdAt || now : now}, {merge: true});
  return {exerciseName, candidates, cached: false};
});

module.exports = {youtubeCurationSuggest, curationDocId, findYoutubeCandidates};
