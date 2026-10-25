'use strict';
/**
 * Parametr ?v=N przy pliku w index.html wymusza pobranie nowej wersji (cache przeglądarki i PWA).
 * Testy sprawdzają, że wersja jest co najmniej taka, jak przy zmianie, którą chronią,
 * zamiast przypinać dokładną liczbę, która psuła testy przy każdym kolejnym podbiciu.
 */
function cacheVersion(html, file) {
  const esc = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:src|href)="(?:\\./)?' + esc + '\\?v=(\\d+)').exec(String(html || ''));
  return m ? Number(m[1]) : null;
}
function cacheAtLeast(html, file, min) {
  const v = cacheVersion(html, file);
  return v !== null && v >= min;
}
module.exports = { cacheVersion, cacheAtLeast };
