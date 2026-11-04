#!/usr/bin/env node
// Baza produktów z USDA FoodData Central (SR Legacy, domena publiczna).
// Workflow pobiera oficjalne CSV z fdc.nal.usda.gov i rozpakowuje do katalogu podanego jako argument.
//   node build_food_db.js <katalog_csv>
// 1) zapisuje knowledge/food/usda-kandydaci.tsv: produkty pasujące do słów z SZUKAJ (do wyboru id),
// 2) jeśli jest knowledge/food/usda-wybor.json ({naszeId: fdc_id}), zapisuje knowledge/food/usda-produkty.json
//    z wartościami na 100 g (kcal, białko, tłuszcz, węglowodany, błonnik) i porcjami z food_portion.csv.
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('Podaj katalog z CSV'); process.exit(1); }
const root = path.join(__dirname, '..', '..');
const out = path.join(root, 'knowledge', 'food');
fs.mkdirSync(out, { recursive: true });

function parseCSV(file, onRow) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  let row = [], field = '', q = false, header = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (!header) header = row; else if (row.length > 1) onRow(Object.fromEntries(header.map((h, k) => [h, row[k]])));
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (header) onRow(Object.fromEntries(header.map((h, k) => [h, row[k]]))); }
}

const NUTR = { 1008: 'kcal', 1003: 'p', 1004: 'f', 1005: 'c', 1079: 'fiber' };
const foods = {};
parseCSV('food.csv', r => { foods[r.fdc_id] = { id: r.fdc_id, desc: r.description, cat: r.food_category_id }; });
parseCSV('food_nutrient.csv', r => { const k = NUTR[r.nutrient_id]; if (k && foods[r.fdc_id]) foods[r.fdc_id][k] = +r.amount; });
const portions = {};
if (fs.existsSync(path.join(dir, 'food_portion.csv'))) {
  parseCSV('food_portion.csv', r => {
    if (!foods[r.fdc_id]) return;
    (portions[r.fdc_id] = portions[r.fdc_id] || []).push({ amount: +r.amount || 1, unit: r.modifier || r.portion_description || '', g: +r.gram_weight });
  });
}
console.log('Produktów w bazie:', Object.keys(foods).length);

const SZUKAJ = /^(Chicken, broiler|Turkey|Beef|Pork|Fish|Salmon|Cod|Tuna|Mackerel|Herring|Shrimp|Egg, whole|Cheese|Yogurt|Milk|Kefir|Tofu|Beans|Lentils|Chickpeas|Peas|Soybeans|Rice|Buckwheat|Millet|Barley|Oats|Cereals, oats|Bread|Pasta|Noodles|Potatoes|Sweet potato|Quinoa|Couscous|Bulgur|Nuts|Peanut|Seeds|Oil|Butter|Avocados|Olives|Apples|Bananas|Oranges|Strawberries|Blueberries|Raspberries|Pears|Plums|Grapes|Kiwifruit|Raisins|Broccoli|Carrots|Spinach|Peppers, sweet|Tomatoes|Cucumber|Lettuce|Cauliflower|Cabbage|Zucchini|Squash, summer|Onions|Beets|Mushrooms|Hummus|Honey|Jams|Cocoa)/i;
const lines = ['fdc_id\topis\tkcal\tB\tT\tW\tbłonnik'];
Object.values(foods).filter(f => SZUKAJ.test(f.desc)).sort((a, b) => a.desc.localeCompare(b.desc))
  .forEach(f => lines.push([f.id, f.desc, f.kcal, f.p, f.f, f.c, f.fiber].join('\t')));
fs.writeFileSync(path.join(out, 'usda-kandydaci.tsv'), lines.join('\n') + '\n');
console.log('Kandydaci:', lines.length - 1);

const wyborFile = path.join(out, 'usda-wybor.json');
if (fs.existsSync(wyborFile)) {
  const wybor = JSON.parse(fs.readFileSync(wyborFile, 'utf8'));
  const res = {}, braki = [];
  Object.entries(wybor).forEach(([id, fdc]) => {
    const f = foods[String(fdc)];
    if (!f || f.kcal == null || f.p == null) { braki.push(id + ' (' + fdc + ')'); return; }
    res[id] = { fdc_id: +fdc, opis: f.desc, kcal: f.kcal, p: f.p, f: f.f ?? 0, c: f.c ?? 0, fiber: f.fiber ?? null, porcje: (portions[fdc] || []).slice(0, 6) };
  });
  fs.writeFileSync(path.join(out, 'usda-produkty.json'), JSON.stringify({
    zrodlo: 'USDA FoodData Central, SR Legacy (April 2018), domena publiczna',
    url: 'https://fdc.nal.usda.gov/',
    jednostka: 'na 100 g części jadalnej',
    produkty: res
  }, null, 1) + '\n');
  console.log('Zapisane produkty:', Object.keys(res).length, braki.length ? 'BRAK: ' + braki.join(', ') : '');
}
