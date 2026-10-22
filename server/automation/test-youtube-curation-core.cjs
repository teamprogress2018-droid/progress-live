'use strict';
const assert = require('node:assert/strict');
const {safeTerms, titleMatch, candidatesFromYoutube} = require('./youtube-curation-core.cjs');

assert.deepEqual(safeTerms([' Deska ', 'deska', 'plank', '']), ['Deska', 'plank']);
assert.equal(titleMatch('How to do a forearm plank correctly', ['Deska', 'forearm plank']) > 0.9, true);
const candidates = candidatesFromYoutube([
  {id: 'aaaaaaaaaaa', snippet: {title: 'Forearm plank exercise tutorial', channelTitle: 'Coach', thumbnails: {medium: {url: 'https://i.ytimg.com/x'}}}, statistics: {viewCount: '1000000', likeCount: '30000'}, status: {embeddable: true}},
  {id: 'bbbbbbbbbbb', snippet: {title: 'A popular unrelated recipe', channelTitle: 'Chef'}, statistics: {viewCount: '9000000', likeCount: '900000'}, status: {embeddable: true}},
  {id: 'ccccccccccc', snippet: {title: 'Forearm plank exercise', channelTitle: 'Coach'}, statistics: {viewCount: '9999999'}, status: {embeddable: false}}
], ['Deska', 'forearm plank']);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].videoId, 'aaaaaaaaaaa');
assert.equal(candidates[0].url, 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
console.log('YouTube curation core tests passed');
