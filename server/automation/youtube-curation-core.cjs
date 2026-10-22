'use strict';

function normalized(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function safeTerms(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [values]).map(value => String(value || '').trim())
    .filter(value => value && value.length <= 140)
    .filter(value => {
      const key = normalized(value);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 6);
}

function titleMatch(title, terms) {
  const haystack = normalized(title);
  const wanted = safeTerms(terms).map(normalized).filter(Boolean);
  if (!haystack || !wanted.length) return 0;
  let best = 0;
  for (const term of wanted) {
    if (haystack.includes(term)) { best = Math.max(best, 1); continue; }
    const tokens = term.split(' ').filter(token => token.length >= 3);
    if (tokens.length) best = Math.max(best, tokens.filter(token => haystack.includes(token)).length / tokens.length);
  }
  return best;
}

function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function candidateScore(video, terms) {
  const match = titleMatch(video?.snippet?.title, terms);
  const views = asNumber(video?.statistics?.viewCount);
  const likes = asNumber(video?.statistics?.likeCount);
  const likeRate = views ? likes / views : 0;
  // Dopasowanie ruchu ma zawsze większą wagę niż sama popularność.
  return Math.round(match * 700 + Math.min(180, Math.log10(Math.max(1, views)) * 25) + Math.min(80, likeRate * 4000));
}

function candidatesFromYoutube(items, terms, limit = 5) {
  return (Array.isArray(items) ? items : []).map(video => {
    const id = String(video?.id || '').trim();
    const title = String(video?.snippet?.title || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !title || video?.status?.embeddable === false) return null;
    const views = asNumber(video?.statistics?.viewCount);
    const likes = asNumber(video?.statistics?.likeCount);
    const match = titleMatch(title, terms);
    // Nie podpowiadamy luźno powiązanych filmów, nawet jeśli mają miliony wyświetleń.
    if (match < 0.34) return null;
    return {
      videoId: id,
      url: 'https://www.youtube.com/watch?v=' + id,
      title: title.slice(0, 220),
      channel: String(video?.snippet?.channelTitle || '').trim().slice(0, 160),
      thumbnail: String(video?.snippet?.thumbnails?.medium?.url || video?.snippet?.thumbnails?.default?.url || '').trim(),
      views,
      likes,
      score: candidateScore(video, terms),
      publishedAt: String(video?.snippet?.publishedAt || '')
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.views - a.views).slice(0, limit);
}

module.exports = {normalized, safeTerms, titleMatch, candidateScore, candidatesFromYoutube};
