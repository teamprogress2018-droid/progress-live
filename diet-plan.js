// ════════════════════════════════════════
// JADŁOSPIS Z KSIĄŻEK — kalkulator TDEE → przykładowy dzień z gramaturą i zamiennikami
// Każda liczba ma źródło w bazie wiedzy (knowledge/books/*.json). Wartości produktów
// pochodzą z USDA FoodData Central (SR Legacy, domena publiczna; knowledge/food/),
// dwa produkty z jadłospisów Bean — same jadłospisy i przepisy nie są kopiowane.
// Podział energii między posiłki i zestawy posiłków to ustawienia aplikacji.
// ════════════════════════════════════════
(function(root){
'use strict';

const REF={
  sn:'Sports Nutrition 6. wyd. (2017)',
  bean:'Bean, Complete Guide to Sports Nutrition (2009)',
  bk:'Brukner i Khan, Clinical Sports Medicine 4. wyd.',
  ads:'Dietetyka sportowa (ADS)',
  usda:'USDA FoodData Central, SR Legacy (2018), domena publiczna',
  app:'ustawienie aplikacji'
};
function src(ref,pages,status){return{ref,pages:pages||'',status:status||'zrodlo'};}

/** Produkty: wartości na 100 g (albo na sztukę: g = waga sztuki) z USDA FoodData Central, SR Legacy
 *  (domena publiczna, knowledge/food/usda-produkty.json, fdc = numer produktu). Musli i wafle ryżowe
 *  zostają z jadłospisów Bean (status wniosek). Mięso, ryby, kasze i makaron są w wadze przed obróbką;
 *  cooked.ratio = waga po obróbce / przed (z energii surowego i gotowego produktu USDA, status wniosek).
 *  sub = podgrupa zamienników, min/max = najmniejsza i największa sensowna porcja (ustawienie aplikacji). */
const DIET_FOODS=[
  {id:'kurczak',name:'Pierś z kurczaka (surowa)',group:'bialko',sub:'mieso',unit:'g',kcal:120,p:22.5,c:0,f:2.62,src:'usda',fdc:171077,cooked:{label:'po upieczeniu',ratio:0.73,fdc:171477},min:100,max:300},
  {id:'indyk',name:'Pierś z indyka (surowa)',group:'bialko',sub:'mieso',unit:'g',kcal:114,p:23.34,c:0,f:2.33,src:'usda',fdc:174515,cooked:{label:'po upieczeniu',ratio:0.84,fdc:174516},min:100,max:300},
  {id:'wolowina',name:'Wołowina mielona chuda 5% (surowa)',group:'bialko',sub:'mieso',unit:'g',kcal:137,p:21.41,c:0,f:5,src:'usda',fdc:171790,cooked:{label:'po usmażeniu',ratio:0.84,fdc:171792},min:100,max:250},
  {id:'schab',name:'Schab bez tłuszczu (surowy)',group:'bialko',sub:'mieso',unit:'g',kcal:123,p:23.75,c:0,f:3.09,src:'usda',fdc:168263,cooked:{label:'po usmażeniu',ratio:0.76,fdc:168285},min:100,max:250},
  {id:'losos',name:'Łosoś (surowy)',group:'bialko',sub:'ryby',unit:'g',kcal:208,p:20.42,c:0,f:13.42,src:'usda',fdc:175167,cooked:{label:'po upieczeniu',ratio:1.01,fdc:175168},min:100,max:250},
  {id:'ryba',name:'Dorsz (surowy)',group:'bialko',sub:'ryby',unit:'g',kcal:82,p:17.81,c:0,f:0.67,src:'usda',fdc:171955,cooked:{label:'po upieczeniu',ratio:0.78,fdc:171956},min:100,max:300},
  {id:'makrela',name:'Makrela (surowa)',group:'bialko',sub:'ryby',unit:'g',kcal:205,p:18.6,c:0,f:13.89,src:'usda',fdc:175119,cooked:{label:'po upieczeniu',ratio:0.78,fdc:175120},min:80,max:200},
  {id:'pstrag',name:'Pstrąg (surowy)',group:'bialko',sub:'ryby',unit:'g',kcal:141,p:19.94,c:0,f:6.18,src:'usda',fdc:173717,min:100,max:250},
  {id:'tunczyk',name:'Tuńczyk w wodzie (odsączony)',group:'bialko',sub:'ryby',unit:'g',kcal:86,p:19.44,c:0,f:0.96,src:'usda',fdc:173709,min:60,max:200},
  {id:'jajko',name:'Jajko',group:'bialko',sub:'nabial',unit:'szt',kcal:71.5,p:6.28,c:0.36,f:4.75,g:50,src:'usda',fdc:171287,min:2,max:4},
  {id:'cottage',name:'Serek wiejski',group:'bialko',sub:'nabial',unit:'g',kcal:98,p:11.12,c:3.38,f:4.3,src:'usda',fdc:172179,min:100,max:300},
  {id:'jogurt',name:'Jogurt naturalny 1,5%',group:'nabial',sub:'nabial',unit:'g',kcal:63,p:5.25,c:7.04,f:1.55,src:'usda',fdc:170886,min:150,max:400},
  {id:'jogurt-grecki',name:'Jogurt grecki 2%',group:'nabial',sub:'nabial',unit:'g',kcal:73,p:9.95,c:3.94,f:1.92,src:'usda',fdc:170903,min:150,max:300},
  {id:'kefir',name:'Kefir 1%',group:'nabial',sub:'nabial',unit:'ml',kcal:43,p:3.79,c:4.77,f:1.02,src:'usda',fdc:170904,min:200,max:500},
  {id:'mleko',name:'Mleko odtłuszczone',group:'nabial',sub:'nabial',unit:'ml',kcal:34,p:3.37,c:4.96,f:0.08,src:'usda',fdc:171269,min:200,max:400},
  {id:'mleko-2',name:'Mleko 2%',group:'nabial',sub:'nabial',unit:'ml',kcal:50,p:3.3,c:4.8,f:1.98,src:'usda',fdc:171267,min:200,max:400},
  {id:'mozzarella',name:'Mozzarella light',group:'bialko',sub:'ser',unit:'g',kcal:254,p:24.26,c:2.77,f:15.92,src:'usda',fdc:170847,min:50,max:125},
  {id:'gouda',name:'Ser żółty (gouda)',group:'bialko',sub:'ser',unit:'g',kcal:356,p:24.94,c:2.22,f:27.44,src:'usda',fdc:171241,min:20,max:60},
  {id:'feta',name:'Ser feta',group:'bialko',sub:'ser',unit:'g',kcal:265,p:14.21,c:3.88,f:21.49,src:'usda',fdc:173420,min:30,max:80},
  {id:'fasola',name:'Fasola czerwona (ugotowana)',group:'bialko',sub:'roslinne',unit:'g',kcal:127,p:8.67,c:22.8,f:0.5,src:'usda',fdc:175194,min:100,max:300},
  {id:'soczewica',name:'Soczewica (ugotowana)',group:'bialko',sub:'roslinne',unit:'g',kcal:116,p:9.02,c:20.13,f:0.38,src:'usda',fdc:172421,min:100,max:300},
  {id:'ciecierzyca',name:'Ciecierzyca (ugotowana)',group:'bialko',sub:'roslinne',unit:'g',kcal:164,p:8.86,c:27.42,f:2.59,src:'usda',fdc:173757,min:100,max:300},
  {id:'tofu',name:'Tofu twarde',group:'bialko',sub:'roslinne',unit:'g',kcal:144,p:17.27,c:2.78,f:8.72,src:'usda',fdc:172475,min:100,max:250},
  {id:'owsiane',name:'Płatki owsiane',group:'wegle',sub:'zboza',unit:'g',kcal:379,p:13.15,c:67.7,f:6.52,src:'usda',fdc:173904,min:30,max:150},
  {id:'musli',name:'Musli',group:'wegle',sub:'zboza',unit:'g',kcal:367,p:10,c:66.7,f:8.3,src:'bean',page:'202',min:30,max:120},
  {id:'chleb',name:'Chleb pełnoziarnisty',group:'wegle',sub:'zboza',unit:'g',kcal:252,p:12.45,c:42.71,f:3.5,src:'usda',fdc:172688,min:35,max:200},
  {id:'chleb-zytni',name:'Chleb żytni',group:'wegle',sub:'zboza',unit:'g',kcal:259,p:8.5,c:48.3,f:3.3,src:'usda',fdc:172684,min:35,max:200},
  {id:'wafle',name:'Wafle ryżowe',group:'wegle',sub:'zboza',unit:'szt',kcal:32,p:0.5,c:7.3,f:0.25,src:'bean',page:'204',min:2,max:8},
  {id:'makaron',name:'Makaron (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:371,p:13.04,c:74.67,f:1.51,src:'usda',fdc:169736,cooked:{label:'po ugotowaniu',ratio:2.35,fdc:169737},min:50,max:180},
  {id:'makaron-razowy',name:'Makaron razowy (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:352,p:13.87,c:73.37,f:2.93,src:'usda',fdc:169738,cooked:{label:'po ugotowaniu',ratio:2.36,fdc:168910},min:50,max:180},
  {id:'ryz',name:'Ryż brązowy (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:367,p:7.54,c:76.25,f:3.2,src:'usda',fdc:169703,cooked:{label:'po ugotowaniu',ratio:2.98,fdc:169704},min:50,max:180},
  {id:'ryz-bialy',name:'Ryż biały (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:365,p:7.13,c:79.95,f:0.66,src:'usda',fdc:169756,cooked:{label:'po ugotowaniu',ratio:2.81,fdc:168935},min:50,max:180},
  {id:'kasza-gryczana',name:'Kasza gryczana (sucha)',group:'wegle',sub:'skrobia',unit:'g',kcal:346,p:11.73,c:74.95,f:2.71,src:'usda',fdc:170685,cooked:{label:'po ugotowaniu',ratio:3.76,fdc:170686},min:50,max:180},
  {id:'kasza-jaglana',name:'Kasza jaglana (sucha)',group:'wegle',sub:'skrobia',unit:'g',kcal:378,p:11.02,c:72.85,f:4.22,src:'usda',fdc:169702,cooked:{label:'po ugotowaniu',ratio:3.18,fdc:168871},min:50,max:180},
  {id:'kasza-jeczmienna',name:'Kasza jęczmienna pęczak (sucha)',group:'wegle',sub:'skrobia',unit:'g',kcal:352,p:9.91,c:77.72,f:1.16,src:'usda',fdc:170284,cooked:{label:'po ugotowaniu',ratio:2.86,fdc:170285},min:50,max:180},
  {id:'komosa',name:'Komosa ryżowa (sucha)',group:'wegle',sub:'skrobia',unit:'g',kcal:368,p:14.12,c:64.16,f:6.07,src:'usda',fdc:168874,cooked:{label:'po ugotowaniu',ratio:3.07,fdc:168917},min:50,max:150},
  {id:'kuskus',name:'Kuskus (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:376,p:12.76,c:77.43,f:0.64,src:'usda',fdc:169699,cooked:{label:'po ugotowaniu',ratio:3.36,fdc:169700},min:50,max:150},
  {id:'bulgur',name:'Bulgur (suchy)',group:'wegle',sub:'skrobia',unit:'g',kcal:342,p:12.29,c:75.87,f:1.33,src:'usda',fdc:170688,cooked:{label:'po ugotowaniu',ratio:4.12,fdc:170287},min:50,max:150},
  {id:'ziemniaki',name:'Ziemniaki (surowe)',group:'wegle',sub:'skrobia',unit:'g',kcal:77,p:2.05,c:17.49,f:0.09,src:'usda',fdc:170026,cooked:{label:'po ugotowaniu',ratio:0.9,fdc:170440},min:150,max:600},
  {id:'bataty',name:'Bataty (surowe)',group:'wegle',sub:'skrobia',unit:'g',kcal:86,p:1.57,c:20.12,f:0.05,src:'usda',fdc:168482,cooked:{label:'po upieczeniu',ratio:0.96,fdc:168483},min:150,max:600},
  {id:'maslo-orz',name:'Masło orzechowe',group:'tluszcz',sub:'orzechy',unit:'g',kcal:598,p:22.21,c:22.31,f:51.36,src:'usda',fdc:172470,min:10,max:40},
  {id:'orzechy-wloskie',name:'Orzechy włoskie',group:'tluszcz',sub:'orzechy',unit:'g',kcal:654,p:15.23,c:13.71,f:65.21,src:'usda',fdc:170187,min:10,max:40},
  {id:'migdaly',name:'Migdały',group:'tluszcz',sub:'orzechy',unit:'g',kcal:579,p:21.15,c:21.55,f:49.93,src:'usda',fdc:170567,min:10,max:40},
  {id:'orzechy-laskowe',name:'Orzechy laskowe',group:'tluszcz',sub:'orzechy',unit:'g',kcal:628,p:14.95,c:16.7,f:60.75,src:'usda',fdc:170581,min:10,max:40},
  {id:'nerkowce',name:'Orzechy nerkowca',group:'tluszcz',sub:'orzechy',unit:'g',kcal:553,p:18.22,c:30.19,f:43.85,src:'usda',fdc:170162,min:10,max:40},
  {id:'siemie',name:'Siemię lniane',group:'tluszcz',sub:'nasiona',unit:'g',kcal:534,p:18.29,c:28.88,f:42.16,src:'usda',fdc:169414,min:10,max:30},
  {id:'chia',name:'Nasiona chia',group:'tluszcz',sub:'nasiona',unit:'g',kcal:486,p:16.54,c:42.12,f:30.74,src:'usda',fdc:170554,min:10,max:30},
  {id:'pestki-dyni',name:'Pestki dyni',group:'tluszcz',sub:'nasiona',unit:'g',kcal:559,p:30.23,c:10.71,f:49.05,src:'usda',fdc:170556,min:10,max:40},
  {id:'oliwa',name:'Oliwa z oliwek',group:'tluszcz',sub:'oleje',unit:'g',kcal:884,p:0,c:0,f:100,src:'usda',fdc:171413,min:5,max:30},
  {id:'olej-rzepakowy',name:'Olej rzepakowy',group:'tluszcz',sub:'oleje',unit:'g',kcal:884,p:0,c:0,f:100,src:'usda',fdc:172336,min:5,max:30},
  {id:'maslo',name:'Masło',group:'tluszcz',sub:'oleje',unit:'g',kcal:717,p:0.85,c:0.06,f:81.11,src:'usda',fdc:173430,min:5,max:20},
  {id:'awokado',name:'Awokado',group:'tluszcz',sub:'pasty',unit:'g',kcal:160,p:2,c:8.53,f:14.66,src:'usda',fdc:171705,min:40,max:150},
  {id:'hummus',name:'Hummus',group:'tluszcz',sub:'pasty',unit:'g',kcal:237,p:7.78,c:15,f:17.82,src:'usda',fdc:174289,min:30,max:100},
  {id:'banan',name:'Banan',group:'owoce',sub:'owoce',unit:'szt',kcal:105,p:1.29,c:26.95,f:0.39,g:118,src:'usda',fdc:173944,min:1,max:2},
  {id:'jablko',name:'Jabłko',group:'owoce',sub:'owoce',unit:'szt',kcal:94.6,p:0.47,c:25.13,f:0.31,g:182,src:'usda',fdc:171688,min:1,max:2},
  {id:'pomarancza',name:'Pomarańcza',group:'owoce',sub:'owoce',unit:'szt',kcal:61.6,p:1.23,c:15.39,f:0.16,g:131,src:'usda',fdc:169097,min:1,max:2},
  {id:'gruszka',name:'Gruszka',group:'owoce',sub:'owoce',unit:'szt',kcal:101.5,p:0.64,c:27.11,f:0.25,g:178,src:'usda',fdc:169118,min:1,max:2},
  {id:'kiwi',name:'Kiwi',group:'owoce',sub:'owoce',unit:'szt',kcal:42.1,p:0.79,c:10.12,f:0.36,g:69,src:'usda',fdc:168153,min:1,max:3},
  {id:'sliwka',name:'Śliwka',group:'owoce',sub:'owoce',unit:'szt',kcal:30.4,p:0.46,c:7.54,f:0.18,g:66,src:'usda',fdc:169949,min:2,max:4},
  {id:'jagody',name:'Borówki',group:'owoce',sub:'owoce',unit:'g',kcal:57,p:0.74,c:14.49,f:0.33,src:'usda',fdc:171711,min:80,max:250},
  {id:'truskawki',name:'Truskawki',group:'owoce',sub:'owoce',unit:'g',kcal:32,p:0.67,c:7.68,f:0.3,src:'usda',fdc:167762,min:80,max:250},
  {id:'maliny',name:'Maliny',group:'owoce',sub:'owoce',unit:'g',kcal:52,p:1.2,c:11.94,f:0.65,src:'usda',fdc:167755,min:80,max:250},
  {id:'winogrona',name:'Winogrona',group:'owoce',sub:'owoce',unit:'g',kcal:69,p:0.72,c:18.1,f:0.16,src:'usda',fdc:174683,min:80,max:250},
  {id:'rodzynki',name:'Rodzynki',group:'owoce',sub:'owoce',unit:'g',kcal:299,p:3.3,c:79.32,f:0.25,src:'usda',fdc:168165,min:20,max:50},
  {id:'brokul',name:'Brokuł',group:'warzywa',sub:'warzywa',unit:'g',kcal:34,p:2.82,c:6.64,f:0.37,src:'usda',fdc:170379},
  {id:'marchew',name:'Marchew',group:'warzywa',sub:'warzywa',unit:'g',kcal:41,p:0.93,c:9.58,f:0.24,src:'usda',fdc:170393},
  {id:'szpinak',name:'Szpinak',group:'warzywa',sub:'warzywa',unit:'g',kcal:23,p:2.86,c:3.63,f:0.39,src:'usda',fdc:168462},
  {id:'papryka',name:'Papryka czerwona',group:'warzywa',sub:'warzywa',unit:'g',kcal:26,p:0.99,c:6.03,f:0.3,src:'usda',fdc:170108},
  {id:'salata',name:'Sałata',group:'warzywa',sub:'warzywa',unit:'g',kcal:15,p:1.36,c:2.87,f:0.15,src:'usda',fdc:169249},
  {id:'kalafior',name:'Kalafior',group:'warzywa',sub:'warzywa',unit:'g',kcal:25,p:1.92,c:4.97,f:0.28,src:'usda',fdc:169986},
  {id:'pomidor',name:'Pomidor',group:'warzywa',sub:'warzywa',unit:'g',kcal:18,p:0.88,c:3.89,f:0.2,src:'usda',fdc:170457},
  {id:'ogorek',name:'Ogórek',group:'warzywa',sub:'warzywa',unit:'g',kcal:15,p:0.65,c:3.63,f:0.11,src:'usda',fdc:168409},
  {id:'kapusta',name:'Kapusta biała',group:'warzywa',sub:'warzywa',unit:'g',kcal:25,p:1.28,c:5.8,f:0.1,src:'usda',fdc:169975},
  {id:'cukinia',name:'Cukinia',group:'warzywa',sub:'warzywa',unit:'g',kcal:17,p:1.21,c:3.11,f:0.32,src:'usda',fdc:169291},
  {id:'cebula',name:'Cebula',group:'warzywa',sub:'warzywa',unit:'g',kcal:40,p:1.1,c:9.34,f:0.1,src:'usda',fdc:170000},
  {id:'buraki',name:'Buraki',group:'warzywa',sub:'warzywa',unit:'g',kcal:43,p:1.61,c:9.56,f:0.17,src:'usda',fdc:169145},
  {id:'pieczarki',name:'Pieczarki',group:'warzywa',sub:'warzywa',unit:'g',kcal:22,p:3.09,c:3.26,f:0.34,src:'usda',fdc:169251},
  {id:'fasolka',name:'Fasolka szparagowa',group:'warzywa',sub:'warzywa',unit:'g',kcal:31,p:1.83,c:6.97,f:0.22,src:'usda',fdc:169961},
  {id:'groszek',name:'Groszek zielony',group:'warzywa',sub:'warzywa',unit:'g',kcal:77,p:5.22,c:13.62,f:0.4,src:'usda',fdc:170016}
];
/** Alergeny i wykluczenia (ustawienie aplikacji: oznaczenia typowego składu, zawsze sprawdź etykietę). */
const DIET_EXCLUSIONS=[
  {id:'gluten',label:'Gluten',foods:['owsiane','musli','chleb','chleb-zytni','makaron','makaron-razowy','kasza-jeczmienna','kuskus','bulgur']},
  {id:'mleko',label:'Mleko i nabiał',foods:['cottage','jogurt','jogurt-grecki','kefir','mleko','mleko-2','mozzarella','gouda','feta','maslo']},
  {id:'jaja',label:'Jaja',foods:['jajko']},
  {id:'ryby',label:'Ryby',foods:['losos','ryba','makrela','pstrag','tunczyk']},
  {id:'orzeszki',label:'Orzeszki ziemne',foods:['maslo-orz']},
  {id:'orzechy',label:'Orzechy',foods:['orzechy-wloskie','migdaly','orzechy-laskowe','nerkowce']},
  {id:'soja',label:'Soja',foods:['tofu']},
  {id:'sezam',label:'Sezam',foods:['hummus']},
  {id:'mieso',label:'Mięso',foods:['kurczak','indyk','wolowina','schab']}
];
/** Sposoby żywienia = zestawy wykluczeń. */
const DIET_STYLES={
  wszystko:{label:'Bez ograniczeń',ex:[]},
  wege:{label:'Wegetariańska',ex:['mieso','ryby']},
  weganska:{label:'Wegańska',ex:['mieso','ryby','mleko','jaja']}
};
const FOOD=Object.create(null);
DIET_FOODS.forEach(f=>{FOOD[f.id]=f;f.sub=f.sub||f.group;f.min=f.min||0;f.tags=[];});
DIET_EXCLUSIONS.forEach(e=>e.foods.forEach(id=>FOOD[id].tags.push(e.id)));

/** Zestawy posiłków (ustawienie aplikacji): białko + węglowodany + tłuszcz + stałe dodatki.
 *  min = szacowany czas przygotowania w minutach (ustawienie aplikacji, nie z książek). */
const MEAL_TEMPLATES={
  sniadanie:[
    {min:5,p:'cottage',c:'chleb',f:'maslo-orz',x:[['papryka',100]]},
    {min:10,p:'jajko',c:'chleb',f:null,x:[['szpinak',80]]},
    {min:10,p:'cottage',c:'owsiane',f:'maslo-orz',x:[['jagody',100],['mleko',200]]},
    {min:3,p:'jogurt',c:'musli',f:'maslo-orz',x:[['banan',1]]},
    {min:10,p:'jajko',c:'chleb-zytni',f:null,x:[['pomidor',100],['ogorek',100]]},
    {min:5,p:'jogurt-grecki',c:'owsiane',f:'orzechy-wloskie',x:[['maliny',100]]}
  ],
  przekaska:[
    {min:3,p:'cottage',c:'wafle',f:null,x:[['jablko',1]]},
    {min:3,p:'jogurt',c:'musli',f:null,x:[['banan',1]]},
    {min:5,p:'tunczyk',c:'chleb',f:'oliwa',x:[['marchew',100]]},
    {min:3,p:'cottage',c:'chleb',f:null,x:[['pomarancza',1]]},
    {min:3,p:'jogurt-grecki',c:'owsiane',f:null,x:[['truskawki',100]]},
    {min:5,p:'mozzarella',c:'chleb-zytni',f:null,x:[['pomidor',100]]}
  ],
  obiad:[
    {min:30,p:'kurczak',c:'ryz',f:'oliwa',x:[['brokul',150]]},
    {min:40,p:'losos',c:'ziemniaki',f:'oliwa',x:[['szpinak',100],['salata',100]]},
    {min:25,p:'indyk',c:'makaron',f:'oliwa',x:[['papryka',100],['marchew',100]]},
    {min:35,p:'ryba',c:'bataty',f:'oliwa',x:[['kalafior',150]]},
    {min:30,p:'fasola',c:'ryz',f:'oliwa',x:[['papryka',150]]},
    {min:15,p:'tunczyk',c:'makaron',f:'oliwa',x:[['papryka',100],['szpinak',80]]},
    {min:30,p:'schab',c:'kasza-gryczana',f:'olej-rzepakowy',x:[['kapusta',150]]},
    {min:25,p:'wolowina',c:'makaron-razowy',f:'oliwa',x:[['pomidor',150],['cebula',50]]},
    {min:30,p:'ryba',c:'ziemniaki',f:'olej-rzepakowy',x:[['marchew',100],['groszek',80]]},
    {min:30,p:'soczewica',c:'ryz-bialy',f:'oliwa',x:[['pomidor',150],['cebula',50]]}
  ],
  kolacja:[
    {min:10,p:'tunczyk',c:'chleb',f:'oliwa',x:[['salata',100],['papryka',100]]},
    {min:25,p:'jajko',c:'ziemniaki',f:'oliwa',x:[['szpinak',100]]},
    {min:10,p:'indyk',c:'chleb',f:'oliwa',x:[['marchew',100]]},
    {min:5,p:'losos',c:'chleb',f:null,x:[['salata',100],['papryka',100]]},
    {min:20,p:'tofu',c:'ryz',f:'oliwa',x:[['papryka',100],['brokul',100]]},
    {min:10,p:'jajko',c:'chleb-zytni',f:'awokado',x:[['pomidor',100]]},
    {min:20,p:'kurczak',c:'kasza-jaglana',f:'oliwa',x:[['cukinia',150]]}
  ]
};
/** Podział energii (ustawienie aplikacji, nie z książek). Białko dzielone po równo. */
const MEAL_LAYOUTS={
  3:[{name:'Śniadanie',slot:'sniadanie',share:0.30},{name:'Obiad',slot:'obiad',share:0.40},{name:'Kolacja',slot:'kolacja',share:0.30}],
  4:[{name:'Śniadanie',slot:'sniadanie',share:0.30},{name:'Obiad',slot:'obiad',share:0.35},{name:'Przekąska',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.25}],
  5:[{name:'Śniadanie',slot:'sniadanie',share:0.25},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.30},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20}],
  6:[{name:'Śniadanie',slot:'sniadanie',share:0.20},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.25},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20},{name:'Przekąska wieczorna',slot:'przekaska',share:0.10}]
};

/** Białko g/kg wg celu (środek zgodnych zakresów książek). */
const PROTEIN_BY_GOAL={
  redukcja:{v:1.8,lo:1.6,hi:2.0,range:'1,6–2,0',why:'SN: ok. 1,5 i więcej przy dużym deficycie; Bean 1,6; ADS 1,6–2,4',sources:[src('sn','230','wniosek'),src('bean','120'),src('ads','104')]},
  masa:{v:1.8,lo:1.7,hi:2.0,range:'1,7–2,0',why:'budowa mięśni',sources:[src('sn','230')]},
  sila:{v:1.7,lo:1.6,hi:1.7,range:'1,6–1,7',why:'trening siłowy',sources:[src('sn','52'),src('bean','199')]},
  kondycja:{v:1.3,lo:1.2,hi:1.4,range:'1,2–1,4',why:'trening wytrzymałościowy',sources:[src('sn','52'),src('bean','199')]},
  inne:{v:1.6,lo:1.4,hi:2.0,range:'1,4–2,0',why:'osoby trenujące',sources:[src('sn','230','wniosek')]}
};
/** Węglowodany g/kg wg aktywności (Box 2.1). Klucz = współczynnik PAL kalkulatora. */
function carbRangeForActivity(pal){
  if(pal>=2)return{min:6,max:10,label:'1–3 h treningu dziennie'};
  if(pal>=1.7)return{min:5,max:7,label:'ok. 1 h treningu dziennie'};
  return{min:3,max:5,label:'lekki trening lub redukcja'};
}
const FAT_PCT=25; // SN s. 230: 25–30% energii, nigdy poniżej 20%

function goalKey(goal,delta){
  const g=String(goal||'').toLowerCase();
  if(PROTEIN_BY_GOAL[g])return g;
  if(g==='ksztaltowanie')return'masa';
  if(+delta<0)return'redukcja';
  if(+delta>0)return'masa';
  return'inne';
}

/**
 * Cele dnia wg książek: białko g/kg, tłuszcz 25% energii, reszta węglowodany.
 * o: {weight, age, kcal, rmr, pal, goal, goalDelta}
 */
function dietBookTargets(o){
  o=o||{};
  const weight=+o.weight||0,kcal=Math.round(+o.kcal||0),rmr=Math.round(+o.rmr||0),age=+o.age||0;
  const blocks=[];
  if(age&&age<18)blocks.push({text:'Klient poniżej 18 lat: inne potrzeby wzrostu, automat nie układa diety.',sources:[src('bk','903-904'),src('sn','258','wniosek')]});
  if(rmr&&kcal<rmr)blocks.push({text:'Cel kaloryczny poniżej spoczynkowej przemiany materii ('+rmr+' kcal). Nie schodź poniżej RMR.',sources:[src('bean','121')]});
  if(kcal&&kcal<=1000)blocks.push({text:'Dieta 1000 kcal lub mniej jest niebezpieczna.',sources:[src('bean','121')]});
  const gk=goalKey(o.goal,o.goalDelta);
  const prot=PROTEIN_BY_GOAL[gk];
  // Makro wybrane w kalkulatorze (suwaki) albo wg książek: białko g/kg, tłuszcz 25%, reszta węglowodany.
  const sel=o.selected&&+o.selected.p>0?o.selected:null;
  const proteinG=sel?Math.round(+sel.p):Math.round(prot.v*weight);
  const fatG=sel?Math.round(+sel.f):Math.round(kcal*FAT_PCT/100/9);
  const carbG=sel?Math.round(+sel.c):Math.max(0,Math.round((kcal-proteinG*4-fatG*9)/4));
  const fatPct=kcal?Math.round(fatG*9/kcal*100):FAT_PCT;
  const protPerKg=weight?Math.round(proteinG/weight*10)/10:prot.v;
  const cr=carbRangeForActivity(+o.pal||0);
  const carbPerKg=weight?Math.round(carbG/weight*10)/10:0;
  const notes=[];
  const pl=v=>String(v).replace('.',',');
  if(sel&&weight&&(protPerKg<prot.lo-0.05||protPerKg>prot.hi+0.05))notes.push({text:'Wybrany podział daje '+pl(protPerKg)+' g białka na kg, a książki dla tego celu podają '+prot.range+' g/kg. Kliknij „📚 Wg książek”, żeby to wyrównać.',sources:prot.sources});
  if(sel&&kcal&&(fatPct<20||fatPct>35))notes.push({text:'Tłuszcz to '+fatPct+'% energii, poza zakresem 20–35%.',sources:[src('sn','62-65, 230')]});
  if(sel&&weight&&carbPerKg>cr.max)notes.push({text:'Węglowodanów jest '+pl(carbPerKg)+' g/kg, więcej niż '+cr.min+'–'+cr.max+' g/kg przy tej aktywności.',sources:[src('sn','22')]});
  if(weight&&carbPerKg<cr.min)notes.push({text:'Węglowodanów zostaje '+carbPerKg+' g/kg, mniej niż '+cr.min+'–'+cr.max+' g/kg zalecane przy aktywności „'+cr.label+'”. Rozważ mniejszy deficyt.',sources:[src('sn','22')]});
  if(gk==='redukcja'&&weight&&carbPerKg<4)notes.push({text:'Poniżej 4 g/kg węglowodanów trening zwykle słabnie.',sources:[src('bean','120')]});
  return{
    goal:gk,kcal,rmr,weight,blocked:blocks.length>0,blocks,notes,
    selected:!!sel,
    protein:{g:proteinG,perKg:protPerKg,lo:prot.lo,hi:prot.hi,range:prot.range,why:prot.why,sources:prot.sources},
    fat:{g:fatG,pct:fatPct,range:'20–35%',sources:[src('sn','62-65, 230')]},
    carbs:{g:carbG,perKg:carbPerKg,range:cr.min+'–'+cr.max+' g/kg',label:cr.label,sources:[src('sn','22')]},
    perMealProtein:{g:Math.round(0.25*weight),sources:[src('sn','49, 53')]}
  };
}

/**
 * Cel na dzień bez treningu: wydatek liczony z PAL 1,5 zamiast PAL dni treningowych
 * (SN s. 203: w dni wolne PAL bywa dużo niższy; ADS s. 481–482: w dni treningowe można jeść więcej),
 * ta sama zmiana kalorii pod cel. Białko w gramach bez zmian, tłuszcz ten sam % energii,
 * mniej węglowodanów (SN s. 22: lekki dzień 3–5 g/kg). Przy PAL ≤ 1,5 dni się nie różnią.
 * o: {rmr, pal, goalDelta}
 */
const REST_PAL=1.5;
function dietRestTargets(train,o){
  o=o||{};
  const pal=+o.pal||0,rmr=+o.rmr||train.rmr||0;
  if(!rmr||pal<=REST_PAL||train.blocked)return Object.assign({},train,{dayType:'wolny',same:true});
  const kcal=Math.round(rmr*REST_PAL+(+o.goalDelta||0));
  const fatG=Math.round(kcal*train.fat.pct/100/9);
  const carbG=Math.max(0,Math.round((kcal-train.protein.g*4-fatG*9)/4));
  const w=train.weight||0;
  const carbPerKg=w?Math.round(carbG/w*10)/10:0;
  const why=[src('sn','203','wniosek'),src('ads','481-482','wniosek')];
  const notes=[];
  const blocks=[];
  if(kcal<rmr)blocks.push({text:'Cel dnia wolnego ('+kcal+' kcal) wychodzi poniżej spoczynkowej przemiany materii ('+rmr+' kcal). Zostaw dzień wolny na tym samym poziomie co treningowy albo zmniejsz deficyt.',sources:[src('bean','121')]});
  if(w&&carbPerKg<3)notes.push({text:'W dzień wolny zostaje '+String(carbPerKg).replace('.',',')+' g/kg węglowodanów, mniej niż 3 g/kg z dolnej granicy dla lekkiego dnia.',sources:[src('sn','22')]});
  return Object.assign({},train,{
    dayType:'wolny',same:false,kcal,blocked:train.blocked||blocks.length>0,blocks:train.blocks.concat(blocks),notes,
    fat:Object.assign({},train.fat,{g:fatG}),
    carbs:Object.assign({},train.carbs,{g:carbG,perKg:carbPerKg,range:'3–5 g/kg',label:'dzień bez treningu',sources:[src('sn','22')]}),
    restWhy:{text:'Dzień wolny: wydatek z PAL '+String(REST_PAL).replace('.',',')+' zamiast '+String(pal).replace('.',',')+' (ta sama zmiana pod cel), białko bez zmian, mniej węglowodanów.',sources:why}
  });
}

// ════════ Korekta z postępów: propozycje dla trenera, nic nie zmienia się samo ════════
// Okno i minimum danych to ustawienia aplikacji (książki nie podają, po ilu tygodniach oceniać).
const REVIEW_DAYS=42,REVIEW_MIN_DAYS=21,REVIEW_MIN_POINTS=4;
const DAY_MS=86400000;
function ymdMs(d){const t=Date.parse(String(d).slice(0,10)+'T12:00:00Z');return isFinite(t)?t:NaN;}
/** Trend masy: nachylenie prostej (kg na tydzień) z pomiarów w oknie, a nie pojedyncze ważenie. */
function weightTrend(points,todayMs){
  const end=todayMs||Date.now();
  const pts=(points||[]).map(p=>({t:ymdMs(p.d),v:+p.v})).filter(p=>isFinite(p.t)&&isFinite(p.v)&&p.v>20&&p.t<=end+DAY_MS&&p.t>=end-REVIEW_DAYS*DAY_MS)
    .sort((a,b)=>a.t-b.t);
  // jeden pomiar na dzień (ostatni)
  const byDay=new Map();pts.forEach(p=>byDay.set(Math.round(p.t/DAY_MS),p));
  const u=[...byDay.values()];
  if(u.length<2)return{n:u.length,days:0};
  const days=Math.round((u[u.length-1].t-u[0].t)/DAY_MS);
  const xs=u.map(p=>(p.t-u[0].t)/DAY_MS),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=u.reduce((a,p)=>a+p.v,0)/u.length;
  let num=0,den=0;xs.forEach((x,i)=>{num+=(x-mx)*(u[i].v-my);den+=(x-mx)*(x-mx);});
  const perDay=den?num/den:0;
  const last=my+perDay*(xs[xs.length-1]-mx);
  return{n:u.length,days,kgPerWeek:Math.round(perDay*7*100)/100,kgPerMonth:Math.round(perDay*30.4*100)/100,pctPerWeek:Math.round(perDay*7/last*100*100)/100,current:Math.round(last*10)/10};
}
function pomiarow(n){const d=n%10,dd=n%100;return n===1?'pomiar':d>=2&&d<=4&&(dd<12||dd>14)?'pomiary':'pomiarów';}
function avg(list){const v=list.filter(x=>isFinite(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
/**
 * Przegląd postępów i najwyżej 3 propozycje korekty dla trenera.
 * o: {weights:[{d,v}], checkins:[{date, answers:{nutrition, energy, sleep, workouts}}], gender:'M'|'K',
 *     delta (obecna zmiana kcal pod cel), rmr, tdee, plannedWorkouts (na tydzień), today}
 */
function dietProgressReview(o){
  o=o||{};
  const todayMs=o.today?ymdMs(o.today):Date.now();
  const tr=weightTrend(o.weights,todayMs);
  const delta=Math.round(+o.delta||0);
  const mode=delta<0?'redukcja':delta>0?'masa':'utrzymanie';
  const male=o.gender!=='K';
  const pl=v=>String(v).replace('.',',');
  const sinceMs=todayMs-REVIEW_DAYS*DAY_MS;
  const cis=(o.checkins||[]).filter(c=>c&&c.answers&&ymdMs(c.date)>=sinceMs);
  const nut=avg(cis.map(c=>+c.answers.nutrition));
  const energy=avg(cis.map(c=>+c.answers.energy));
  const sleep=avg(cis.map(c=>+c.answers.sleep));
  const wk=avg(cis.map(c=>+c.answers.workouts));
  const planned=+o.plannedWorkouts||0;
  const adherence={checkins:cis.length,nutrition:nut==null?null:Math.round(nut*10)/10,energy:energy==null?null:Math.round(energy*10)/10,sleep:sleep==null?null:Math.round(sleep*10)/10,workouts:wk==null?null:Math.round(wk*10)/10,planned};
  const appSrc=[src('app','','poza_zrodlem')];
  const out={mode,trend:tr,adherence,suggestions:[],enough:false,
    rule:{text:'Ocena z trendu z ostatnich '+REVIEW_DAYS/7+' tygodni (nachylenie prostej przez pomiary), najwcześniej po '+REVIEW_MIN_DAYS/7+' tygodniach i '+REVIEW_MIN_POINTS+' pomiarach.',sources:appSrc}};
  if(tr.n<REVIEW_MIN_POINTS||tr.days<REVIEW_MIN_DAYS){
    out.message='Za mało danych: '+tr.n+' '+pomiarow(tr.n)+' masy z '+(tr.days||0)+' dni. Potrzeba co najmniej '+REVIEW_MIN_POINTS+' pomiarów z '+REVIEW_MIN_DAYS/7+' tygodni, zanim aplikacja coś zaproponuje.';
    return out;
  }
  out.enough=true;
  const S=out.suggestions;
  const lowAdh=(nut!=null&&nut<=3)||(planned&&wk!=null&&wk<planned*0.75);
  if(lowAdh)S.push({kind:'realizacja',title:'Najpierw realizacja planu',
    text:'Odżywianie w check-inach średnio '+(nut!=null?pl(adherence.nutrition)+'/5':'—')+(planned&&wk!=null?', treningi '+pl(adherence.workouts)+' z '+planned+' w tygodniu':'')+'. Zanim zmienisz kalorie, zapytaj klienta, co pomogłoby mu w przyszłym tygodniu (nie „dlaczego?”), i dopasuj posiłki do pór dnia, w których ma problem. Najważniejsza jest realizacja zaleceń.',
    sources:[src('ads','583, 587-588')]});
  const deficitRange=male?[300,500]:[200,300];
  if(mode==='redukcja'){
    const rate=-tr.pctPerWeek;
    out.target={text:'0,5–0,7% masy na tydzień, najwyżej 1%',sources:[src('ads','423, 489, 507, 514'),src('sn','229-230')]};
    if(rate<0.5){
      const next=Math.max(-deficitRange[1],delta-100);
      const room=next<delta&&(!o.tdee||!o.rmr||o.tdee+next>=o.rmr);
      S.push(room
        ?{kind:'kcal',title:'Większy deficyt: '+next+' kcal',text:'Masa spada o '+pl(Math.max(0,rate))+'% tygodniowo, wolniej niż 0,5%. Propozycja: deficyt z '+(-delta)+' na '+(-next)+' kcal (zakres dla '+(male?'mężczyzn':'kobiet')+' '+deficitRange[0]+'–'+deficitRange[1]+' kcal). Krok 100 kcal to ustawienie aplikacji.',delta:next,sources:[src('sn','229-230'),src('ads','423')]}
        :{kind:'kcal',title:'Deficyt już na granicy',text:'Masa spada wolniej niż 0,5% tygodniowo, a deficyt jest już na górnej granicy zakresu ('+deficitRange[1]+' kcal) albo przy spoczynkowej przemianie materii. Nie zwiększaj go dalej: sprawdź realizację planu i aktywność poza treningiem albo skieruj klienta do dietetyka.',sources:[src('sn','229-230'),src('bean','121')]});
    }else if(rate>1){
      const next=Math.min(-deficitRange[0],delta+100);
      S.push({kind:'kcal',title:'Wolniejsza redukcja: '+next+' kcal',text:'Masa spada o '+pl(rate)+'% tygodniowo, szybciej niż 1%. Przy tak szybkiej redukcji większa część to mięśnie. Propozycja: deficyt z '+(-delta)+' na '+(-next)+' kcal.',delta:next>delta?next:null,sources:[src('ads','422-423, 514')]});
    }else S.push({kind:'ok',title:'Tempo w normie',text:'Masa spada o '+pl(rate)+'% tygodniowo, w zakresie 0,5–1%. Nie zmieniaj kalorii.',sources:[src('ads','423, 489'),src('sn','229-230')]});
    if(energy!=null&&energy<=2)S.push({kind:'energia',title:'Niska energia przy deficycie',text:'Energia w check-inach średnio '+pl(adherence.energy)+'/5'+(sleep!=null?', sen '+pl(adherence.sleep)+'/5':'')+'. Większy deficyt obniża zdolność do treningu, więc nie pogłębiaj go teraz.',sources:[src('sn','229-230')]});
  }else if(mode==='masa'){
    const lo=male?0.5:0.25,hi=male?1:0.75;
    out.target={text:(male?'mężczyźni':'kobiety')+' '+pl(lo)+'–'+pl(hi)+' kg na miesiąc',sources:[src('bean','139-141')]};
    const m=tr.kgPerMonth;
    if(m<lo)S.push({kind:'kcal',title:'Większa nadwyżka: +'+(delta+200)+' kcal',text:'Masa rośnie o '+pl(m)+' kg na miesiąc, wolniej niż '+pl(lo)+' kg. Propozycja: nadwyżka z '+delta+' na '+(delta+200)+' kcal (zwiększaj krokami po 200 kcal).',delta:delta+200,sources:[src('bean','139-141')]});
    else if(m>hi){const next=Math.max(0,delta-200);S.push({kind:'kcal',title:next>0?'Mniejsza nadwyżka: +'+next+' kcal':'Bez nadwyżki (utrzymanie)',text:'Masa rośnie o '+pl(m)+' kg na miesiąc, szybciej niż '+pl(hi)+' kg, więc przybywa też tłuszczu. Propozycja: nadwyżka z '+delta+' na '+next+' kcal (ten sam krok 200 kcal).',delta:next,sources:[src('bean','139-141','wniosek')]});}
    else S.push({kind:'ok',title:'Tempo w normie',text:'Masa rośnie o '+pl(m)+' kg na miesiąc, w zakresie '+pl(lo)+'–'+pl(hi)+' kg. Nie zmieniaj kalorii.',sources:[src('bean','139-141')]});
  }else{
    S.push({kind:'info',title:'Utrzymanie masy',text:'Zmiana masy: '+(tr.kgPerMonth>0?'+':'')+pl(tr.kgPerMonth)+' kg na miesiąc. Książki nie podają progu, od którego korygować kalorie przy utrzymaniu, więc aplikacja nic nie proponuje.',sources:appSrc});
  }
  out.suggestions=S.slice(0,3);
  return out;
}

// Małe ilości (oliwa, masło orzechowe) co 1 g, reszta co 5 g.
function round5(x){return x<30?Math.max(0,Math.round(x)):Math.round(x/5)*5;}
function itemMacros(food,amount){
  const k=food.unit==='szt'?amount:amount/100;
  return{kcal:food.kcal*k,p:food.p*k,c:food.c*k,f:food.f*k};
}
function addM(a,b){return{kcal:a.kcal+b.kcal,p:a.p+b.p,c:a.c+b.c,f:a.f+b.f};}
const ZERO={kcal:0,p:0,c:0,f:0};
function sumItems(items,skip){return items.reduce((s,it,i)=>i===skip?s:addM(s,itemMacros(FOOD[it.id],it.amount)),ZERO);}
function unitOf(f){return f.unit==='szt'?1:100;}
/** Porcja w granicach [min, max]; tłuszcz może zniknąć, gdy wychodzi go mniej niż pół porcji.
 *  Białko w przekąsce też (light), bo lepiej przekąska bez serka niż symboliczne 50 g;
 *  w głównym posiłku białko zostaje co najmniej w najmniejszej sensownej porcji. */
function clampAmount(food,x,role,light){
  if(role==='f'&&x<Math.max(3,food.min/2))return 0;
  if(role==='p'&&light&&x<food.min*0.75)return 0;
  const lo=food.min||0,hi=food.max||9999;
  const v=food.unit==='szt'?Math.round(x):round5(x);
  return Math.max(lo,Math.min(hi,v));
}

/** Gramatura jednego posiłku: dopasowanie węglowodanów, białka i tłuszczu w kilku przebiegach,
 *  z najmniejszą sensowną porcją każdego produktu. Gdy limit porcji obcina składnik,
 *  dochodzi drugi produkt z pasującej podgrupy (owoc do węglowodanów, nabiał do białka). */
function solveMeal(tpl,target,allow,light){
  allow=allow||(()=>true);
  const items=[];
  items.push({id:tpl.c,amount:0,role:'c'});
  items.push({id:tpl.p,amount:0,role:'p'});
  if(tpl.f)items.push({id:tpl.f,amount:0,role:'f'});
  (tpl.x||[]).forEach(([id,amt])=>items.push({id,amount:amt,role:'x'}));
  const fit=i=>{
    const it=items[i],f=FOOD[it.id],key=it.role;
    if(!f[key])return;
    it.amount=clampAmount(f,(target[key]-sumItems(items,i)[key])/f[key]*unitOf(f),key,light);
  };
  for(let pass=0;pass<6;pass++){
    items.forEach((it,i)=>{if(it.role!=='x')fit(i);});
    if(pass===1){
      [['c',['banan','jablko','rodzynki']],['p',['jogurt','cottage','jajko']]].forEach(([key,fill])=>{
        const miss=target[key]-sumItems(items)[key];
        if(miss<=Math.max(8,target[key]*0.1))return;
        const id=fill.find(x=>allow(FOOD[x])&&!items.some(it=>it.id===x));
        if(id)items.push({id,amount:0,role:key});
      });
    }
  }
  return items.filter(it=>it.amount>0);
}

/** Zamienniki: produkty z tej samej podgrupy (mięso i ryby, nabiał, zboża, skrobia, owoce, tłuszcze),
 *  w ilości dającej tyle samo głównego składnika; bez porcji mniejszych niż sensowne minimum. */
// Zamienniki białka: najpierw ta sama podgrupa, potem inne źródła białka (mięso, ryby, nabiał, rośliny)
// w ilości dającej tyle samo gramów białka; kalorie i pozostałe makro mogą się różnić i są pokazane.
// Produkty, które klient lubi, idą na początek.
function swapsFor(item,allow,like,light){
  allow=allow||(()=>true);
  like=like||new Set();
  const food=FOOD[item.id];
  const key=item.role;
  if(key!=='p'&&key!=='c'&&key!=='f')return[];
  const amountMain=itemMacros(food,item.amount)[key];
  if(amountMain<=0)return[];
  const fit=list=>list.map(f=>({id:f.id,raw:amountMain/f[key]*unitOf(f)}))
    .filter(s=>{const f=FOOD[s.id];return s.raw>=f.min*0.75&&s.raw<=(f.max||9999);})
    .sort((a,b)=>like.has(b.id)-like.has(a.id))
    .map(s=>{const amount=clampAmount(FOOD[s.id],s.raw);return{id:s.id,amount,m:itemMacros(FOOD[s.id],amount),liked:like.has(s.id)};});
  const ok=f=>f.id!==food.id&&f[key]>0&&allow(f);
  // Zamiennik daje tyle samo głównego składnika (±15% albo ±3 g); inaczej go nie proponujemy.
  const near=x=>Math.abs(x.m[key]-amountMain)<=Math.max(3,amountMain*0.15);
  const same=fit(DIET_FOODS.filter(f=>ok(f)&&f.sub===food.sub)).filter(near).slice(0,3);
  if(key!=='p')return same;
  // W śniadaniu i przekąsce bez dań obiadowych (surowe mięso czy ryba zamiast serka to nie zamiennik).
  const other=fit(DIET_FOODS.filter(f=>ok(f)&&f.sub!==food.sub&&ROLE_GROUPS.p.includes(f.group)&&f.p*4/f.kcal>=0.25&&!(light&&MAIN_DISH.has(f.id)))).filter(near).map(x=>Object.assign(x,{other:true}));
  return same.concat(other).slice(0,Math.max(4,same.length));
}

/** Preferencje kreatora: {style, ex: [id wykluczeń], skip: [id produktów], maxMin: minuty na posiłek (0 = bez limitu)}. */
function dietPrefsNorm(p){
  p=p||{};
  const style=DIET_STYLES[p.style]?p.style:'wszystko';
  const ex=[...new Set([].concat(DIET_STYLES[style].ex,(p.ex||[]).filter(id=>DIET_EXCLUSIONS.some(e=>e.id===id))))];
  const skip=(p.skip||[]).filter(id=>FOOD[id]);
  const like=(p.like||[]).filter(id=>FOOD[id]&&!skip.includes(id));
  return{style,ex,skip,like,maxMin:Math.max(0,+p.maxMin||0)};
}
function dietAllow(prefs){
  const ex=new Set(prefs.ex),skip=new Set(prefs.skip);
  return f=>!!f&&!skip.has(f.id)&&!f.tags.some(t=>ex.has(t));
}
// Zastępstwo dla produktu, którego klient nie je: najpierw ta sama podgrupa, potem produkt
// z tym samym głównym składnikiem (białko: mięso, ryby, nabiał, rośliny; węglowodany: zboża i skrobia).
const ROLE_GROUPS={p:['bialko','nabial'],c:['wegle'],f:['tluszcz']};
// Produkty obiadowe (do gotowania na ciepło): w śniadaniu i przekąsce zamiennik z nich tylko w ostateczności.
const MAIN_DISH=new Set(['kurczak','indyk','wolowina','schab','losos','ryba','makrela','pstrag','fasola','soczewica','ciecierzyca','makaron','makaron-razowy','ryz','ryz-bialy','kasza-gryczana','kasza-jaglana','kasza-jeczmienna','komosa','kuskus','bulgur','ziemniaki','bataty']);
// Produkty już użyte tego dnia idą na koniec kolejki, żeby zamiennik nie powtarzał się w każdym posiłku.
function replacementFor(id,role,allow,used,today,light,like){
  today=today||new Set();like=like||new Set();
  const f=FOOD[id];
  const ok=g=>g.id!==id&&allow(g)&&g[role]>0&&!used.includes(g.id);
  const ratio=g=>g[role]*(role==='f'?9:4)/g.kcal;
  const pool=DIET_FOODS.filter(g=>ok(g)&&(g.sub===f.sub||ROLE_GROUPS[role].includes(g.group)));
  const other=g=>g.sub===f.sub?0:1;
  const heavy=g=>light&&MAIN_DISH.has(g.id)?1:0;
  return pool.sort((a,b)=>(heavy(a)-heavy(b))||(like.has(b.id)-like.has(a.id))||(today.has(a.id)-today.has(b.id))||(other(a)-other(b))||(ratio(b)-ratio(a)))[0]||null;
}
/** Zestaw dopasowany do wykluczeń; null, gdy nie ma czym zastąpić białka albo węglowodanów. */
function adaptTemplate(tpl,allow,today,light,like){
  const out={min:tpl.min,p:tpl.p,c:tpl.c,f:tpl.f,x:(tpl.x||[]).filter(([id])=>allow(FOOD[id])),changes:[]};
  for(const role of['p','c','f']){
    const id=out[role];
    if(!id||allow(FOOD[id]))continue;
    const r=replacementFor(id,role,allow,[out.p,out.c,out.f].concat(out.x.map(x=>x[0])),today,light,like);
    if(!r&&role!=='f')return null;
    out.changes.push({from:id,to:r?r.id:null});
    out[role]=r?r.id:null;
  }
  return out;
}
/** Zestawy dla jednego rodzaju posiłku: najpierw pełne zgodne z preferencjami, potem przerobione;
 *  limit czasu odpuszczany dopiero, gdy nic się w nim nie mieści (z ostrzeżeniem). */
// Upodobania: zestawy z produktami, które klient lubi, idą na początek i liczą się podwójnie w rotacji.
function likedCount(t,like){return[t.p,t.c,t.f].concat(t.x.map(x=>x[0])).filter(id=>id&&like.has(id)).length;}
function slotTemplates(slot,prefs,allow,today){
  const light=slot==='sniadanie'||slot==='przekaska';
  const like=new Set(prefs.like||[]);
  const all=MEAL_TEMPLATES[slot].map(t=>adaptTemplate(t,allow,today,light,like)).filter(Boolean);
  const inTime=prefs.maxMin?all.filter(t=>t.min<=prefs.maxMin):all;
  const pick=list=>{
    const clean=list.filter(t=>!t.changes.length);
    const base=clean.length>=2?clean:list;
    if(!like.size)return base;
    const liked=base.filter(t=>likedCount(t,like)>0).sort((a,b)=>likedCount(b,like)-likedCount(a,like));
    if(!liked.length)return base;
    // Lubiane zestawy co drugi raz w rotacji (przy długiej liście samo „na początek” prawie nic nie zmienia).
    const others=base.filter(t=>!liked.includes(t));
    if(!others.length)return liked;
    return others.flatMap((t,k)=>[liked[k%liked.length],t]);
  };
  if(inTime.length)return{list:pick(inTime),overTime:false};
  return{list:pick(all),overTime:!!all.length};
}

/**
 * Przykładowy dzień: o = {targets (z dietBookTargets), meals: 3–6, variant: liczba, prefs (kreator)}
 */
function dietBuildDay(o){
  const t=o.targets;
  const layout=MEAL_LAYOUTS[o.meals]||MEAL_LAYOUTS[5];
  const variant=Math.max(0,+o.variant||0);
  const n=layout.length;
  const slotCount={};
  const prefs=dietPrefsNorm(o.prefs);
  const allow=dietAllow(prefs);
  const warnings=[];
  const today=new Set();
  // Cel posiłku liczony z tego, co zostało na resztę dnia: nadwyżka z najmniejszych porcji
  // w jednym posiłku zmniejsza kolejne, więc suma dnia trzyma się celu.
  let done=ZERO,shareLeft=1;
  const meals=layout.map((m,mi)=>{
    const st=slotTemplates(m.slot,prefs,allow,today);
    const list=st.list;
    const seen=slotCount[m.slot]=(slotCount[m.slot]||0)+1;
    if(!list.length){warnings.push(m.name+': przy tych wykluczeniach nie ma z czego ułożyć posiłku.');return{name:m.name,share:m.share,items:[],total:ZERO,minutes:0};}
    if(st.overTime&&seen===1)warnings.push(m.name+': żaden zestaw nie mieści się w '+prefs.maxMin+' min, wybrany najszybszy możliwy.');
    // Zamiana całego posiłku: mealShift['dzień:posiłek'] przesuwa zestaw na kolejny z tej samej grupy,
    // cel posiłku zostaje ten sam, więc kalorie i makro dnia się nie zmieniają.
    const shift=Math.max(0,+(o.mealShift||{})[(+o.dayIndex||0)+':'+mi]||0);
    const fixed=o.fixVariant&&o.fixVariant[m.slot]!=null?Math.max(0,+o.fixVariant[m.slot]):variant;
    const tpl=list[(fixed+seen-1+shift)%list.length];
    const k=m.share/shareLeft;
    const target={p:Math.max(0,(t.protein.g-done.p)/(n-mi)),c:Math.max(0,(t.carbs.g-done.c-Math.max(0,done.p-t.protein.g*mi/n))*k),f:Math.max(0,(t.fat.g-done.f)*k)};
    shareLeft-=m.share;
    const items=solveMeal(tpl,target,allow,m.slot==='przekaska').map(it=>Object.assign(it,{swaps:swapsFor(it,allow,new Set(prefs.like),m.slot==='sniadanie'||m.slot==='przekaska')}));
    const tot=sumItems(items);
    done=addM(done,tot);
    items.forEach(it=>{if(it.role!=='x')today.add(it.id);});
    return{name:m.name,share:m.share,items,total:tot,minutes:tpl.min,changes:tpl.changes,options:list.length,swapped:shift>0};
  });
  const total=meals.reduce((s,m)=>addM(s,m.total),ZERO);
  const reps={};
  meals.forEach(m=>(m.changes||[]).forEach(ch=>{if(ch.to)reps[ch.to]=(reps[ch.to]||0)+1;}));
  Object.keys(reps).filter(id=>reps[id]>=3).forEach(id=>warnings.push('Mało produktów przy tych wykluczeniach: '+FOOD[id].name.toLowerCase()+' zastępuje inne produkty w '+reps[id]+' posiłkach. Urozmaicić ręcznie albo poczekać na większą bazę produktów.'));
  if(Math.abs(total.f-t.fat.g)>Math.max(10,t.fat.g*0.15))warnings.push('Tłuszcz wychodzi '+Math.round(total.f)+' g zamiast '+t.fat.g+' g (produkty dostępne przy tych wykluczeniach). Sprawdź jadłospis przed wysłaniem.');
  // Pieczywo, makaron i kasze też mają białko (dane USDA), więc przy dużej ilości węglowodanów suma
  // białka może wyjść ponad górną granicę z książek mimo najmniejszych porcji produktów białkowych.
  const kg=t.protein.perKg?t.protein.g/t.protein.perKg:0;
  if(kg&&t.protein.hi&&total.p>t.protein.hi*kg*1.05)warnings.push('Białko wychodzi '+Math.round(total.p)+' g ('+(Math.round(total.p/kg*10)/10).toString().replace('.',',')+' g/kg), ponad zakres z książek ('+t.protein.range+' g/kg). Dużo białka dają tu pieczywo, makaron i kasze. Można zmniejszyć porcje produktów białkowych w przekąskach albo zostawić, jeśli klient dobrze to toleruje.');
  if(total.p<t.protein.g*0.9)warnings.push('Przy tych wykluczeniach brakuje ok. '+Math.round(t.protein.g-total.p)+' g białka (limity porcji). Trener powinien dobrać produkty ręcznie.');
  return{meals,total,diffKcal:Math.round(total.kcal-t.kcal),warnings,prefs};
}

const WEEK_DAYS=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
/** Kilka dni (o.days: 2–7, domyślnie tydzień) z tymi samymi celami, każdy dzień z innym zestawem posiłków, plus lista zakupów. */
function dietBuildWeek(o){
  const base=Math.max(0,+o.variant||0);
  const count=Math.min(7,Math.max(2,+o.days||7));
  const names=count===7?WEEK_DAYS:Array.from({length:count},(_,i)=>'Dzień '+(i+1));
  // Dni treningowe: o.trainDays = numery dni tygodnia (1 = pon … 0 = nd), o.rest = cel dnia wolnego.
  // Krótszy widok (3 dni) dostaje jeden typ dnia: o.dayType.
  const split=!!(o.rest&&!o.rest.same);
  const prep=Math.min(3,Math.max(0,Math.round(+o.prep||0)));
  const isTrain=d=>count===7&&Array.isArray(o.trainDays)?o.trainDays.includes((d+1)%7):o.dayType!=='wolny';
  const days=names.map((name,d)=>{
    const train=isTrain(d);
    const t=split&&!train?o.rest:o.targets;
    // Gotowanie na zapas: ten sam obiad przez o.prep kolejnych dni (blok), gotowany raz.
    const fixVariant=prep>1?{obiad:base+Math.floor(d/prep)*prep}:null;
    return Object.assign({name,dayType:split?(train?'trening':'wolny'):null,kcalTarget:t.kcal,prepBlock:prep>1?Math.floor(d/prep):null},dietBuildDay({targets:t,meals:o.meals,variant:base+d,prefs:o.prefs,mealShift:o.mealShift,dayIndex:d,fixVariant}));
  });
  const people=Math.min(8,Math.max(1,Math.round(+o.people||1)));
  const shop={};
  days.forEach(day=>day.meals.forEach(m=>m.items.forEach(it=>{shop[it.id]=(shop[it.id]||0)+it.amount;})));
  // Porcje rodzinne: suma × liczba osób, pozostałe osoby jedzą porcje jak klient (ustawienie aplikacji).
  const shopping=Object.keys(shop).map(id=>({id,amount:FOOD[id].unit==='szt'?Math.ceil(shop[id]*people):Math.round(shop[id]*people)}))
    .sort((a,b)=>DIET_FOODS.indexOf(FOOD[a.id])-DIET_FOODS.indexOf(FOOD[b.id]));
  const cooking=[];
  if(prep>1)days.forEach((day,d)=>{
    const m=day.meals.find(x=>x.name==='Obiad');
    if(!m)return;
    let b=cooking[day.prepBlock];
    if(!b)b=cooking[day.prepBlock]={days:[],items:{}};
    b.days.push(day.name);
    m.items.forEach(it=>{b.items[it.id]=(b.items[it.id]||0)+it.amount*people;});
  });
  const cook=cooking.filter(Boolean).map(b=>({days:b.days,items:Object.keys(b.items).map(id=>({id,amount:FOOD[id].unit==='szt'?Math.ceil(b.items[id]):Math.round(b.items[id])}))}));
  return{days,shopping,people,prep:prep>1?prep:0,cooking:cook,warnings:[...new Set([].concat(...days.map(d=>d.warnings)))],prefs:days[0].prefs};
}

function fmtAmount(food,amount){return food.unit==='szt'?amount+' szt.':amount+' '+food.unit;}
/** Waga po obróbce (mięso, ryby, kasze, makaron, ziemniaki): orientacyjnie, z energii produktu surowego i gotowego. */
function cookedNote(food,amount){return food.cooked&&amount?food.cooked.label+' ok. '+round5(amount*food.cooked.ratio)+' g':'';}
/** Produkty w kreatorze pogrupowane, żeby długą listę dało się przejrzeć. */
const FOOD_SECTIONS=[['Mięso i ryby',['mieso','ryby']],['Nabiał, jaja i sery',['nabial','ser']],['Strączki i tofu',['roslinne']],['Pieczywo i płatki',['zboza']],['Kasze, ryż, makaron, ziemniaki',['skrobia']],['Tłuszcze, orzechy, nasiona',['orzechy','nasiona','oleje','pasty']],['Owoce',['owoce']],['Warzywa',['warzywa']]];
function foodChips(list,chipFn){
  return FOOD_SECTIONS.map(([label,subs])=>{const fs=list.filter(f=>subs.includes(f.sub));return fs.length?'<div style="width:100%;font-size:10.5px;color:var(--muted2);margin-top:4px;">'+label+'</div>'+fs.map(chipFn).join(''):'';}).join('');
}
function srcLabel(s){return(REF[s.ref]||s.ref)+(s.pages?', s. '+s.pages:'')+(s.status&&s.status!=='zrodlo'?' ('+s.status.replace('_',' ')+')':'');}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);}
function srcTag(sources){return'<span class="diet-src" title="'+esc(sources.map(srcLabel).join('; '))+'">📚 '+esc(sources.map(s=>(s.ref==='sn'?'SN':s.ref==='bean'?'Bean':s.ref==='bk'?'Brukner':s.ref==='usda'?'USDA':s.ref.toUpperCase())+(s.pages?' s. '+s.pages:'')).join(', '))+'</span>';}

/** Tekst jadłospisu do wiadomości dla klienta. */
function mealsText(day,lines){
  const r=v=>Math.round(v);
  day.meals.forEach(m=>{
    lines.push(m.name+' (~'+r(m.total.kcal)+' kcal, B '+r(m.total.p)+' g)');
    m.items.forEach(it=>{
      const f=FOOD[it.id];
      const sw=it.swaps.length?' (albo: '+it.swaps.map(s=>FOOD[s.id].name.toLowerCase()+' '+fmtAmount(FOOD[s.id],s.amount)+(it.role==='p'?' = B '+Math.round(s.m.p)+' g':'')).join(', ')+')':'';
      const ck=cookedNote(f,it.amount);
      lines.push('• '+f.name+' '+fmtAmount(f,it.amount)+(ck?' ('+ck+')':'')+sw);
    });
    lines.push('');
  });
}
function fmtShop(food,amount){
  if(food.unit==='szt')return amount+' szt.';
  return amount>=1000?(Math.round(amount/100)/10).toString().replace('.',',')+(food.unit==='ml'?' l':' kg'):amount+' '+food.unit;
}
/** Tekst dla klienta: jeden dzień albo tydzień (obiekt z dietBuildWeek) z listą zakupów. */
function dietPlanText(t,plan){
  const week=plan&&plan.days;
  const span=week?(plan.days.length===7?' na tydzień':' na '+plan.days.length+' dni'):'';
  const daily=week&&plan.days.some(d=>d.dayType==='wolny')?'kalorie różne w dni treningowe i wolne':t.kcal+' kcal dziennie';
  const lines=['🍽 Przykładowy jadłospis'+span+' ('+daily+')','Białko '+t.protein.g+' g · Tłuszcz '+t.fat.g+' g · Węglowodany '+t.carbs.g+' g',''];
  if(week){
    plan.days.forEach(day=>{lines.push('📅 '+day.name.toUpperCase()+(day.dayType?(day.dayType==='trening'?' (dzień treningowy, ':' (dzień bez treningu, ')+day.kcalTarget+' kcal)':''),'');mealsText(day,lines);});
    if(plan.cooking&&plan.cooking.length){
      lines.push('🍳 Gotowanie obiadów na zapas:');
      plan.cooking.forEach(b=>lines.push('• '+b.days[0]+(b.days.length>1?' (na: '+b.days.join(', ')+')':'')+': '+b.items.map(it=>FOOD[it.id].name.toLowerCase()+' '+fmtShop(FOOD[it.id],it.amount)).join(', ')));
      lines.push('');
    }
    lines.push('🛒 Lista zakupów'+span+(plan.people>1?' dla '+plan.people+' osób':'')+':');
    plan.shopping.forEach(s=>{const f=FOOD[s.id];lines.push('• '+f.name+' '+fmtShop(f,s.amount));});
    lines.push('');
  }else mealsText(plan,lines);
  const pr=plan&&plan.prefs;
  if(pr&&(pr.ex.length||pr.skip.length))lines.push('Bez: '+pr.ex.map(id=>DIET_EXCLUSIONS.find(e=>e.id===id).label.toLowerCase()).concat(pr.skip.map(id=>FOOD[id].name.toLowerCase())).join(', ')+'. Sprawdzaj skład na etykiecie.');
  lines.push('Produkty suche (ryż, makaron, płatki) waży się przed gotowaniem.');
  lines.push('To przykładowy plan z zasad z książek o żywieniu w sporcie. Nie zastępuje porady dietetyka ani lekarza.');
  return lines.join('\n');
}

/** Dni treningowe i wolne: w tygodniu wybór dni, w krótszym widoku typ dnia. */
const WEEK_SHORT=[[1,'Pon'],[2,'Wt'],[3,'Śr'],[4,'Czw'],[5,'Pt'],[6,'Sob'],[0,'Nd']];
function dietTrainingHTML(opts,nDays){
  const rest=opts.rest,train=opts.train;
  if(!rest||!train)return'';
  const chip=(on,click,label)=>'<button type="button" class="btn btn-sm'+(on?' btn-primary':'')+'" style="font-size:11.5px;padding:4px 10px;min-height:0;" aria-pressed="'+(on?'true':'false')+'" onclick="'+click+'">'+esc(label)+'</button>';
  const pl=v=>String(v).replace('.',',');
  let body;
  if(rest.same)body='<div style="font-size:11.5px;color:var(--muted);">Przy aktywności PAL '+pl(REST_PAL)+' lub niższej dzień wolny ma ten sam cel co treningowy. '+srcTag([src('sn','203')])+'</div>';
  else{
    const days=opts.trainDays||[];
    body='<div style="font-size:11.5px;margin-bottom:4px;">🏋 Dzień treningowy <strong>'+train.kcal+' kcal</strong> (W '+train.carbs.g+' g) · dzień wolny <strong>'+rest.kcal+' kcal</strong> (W '+rest.carbs.g+' g, '+pl(rest.carbs.perKg)+' g/kg). '+esc(rest.restWhy.text)+' '+srcTag(rest.restWhy.sources.concat([src('sn','22')]))+'</div>'+
      (nDays===7
        ?'<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;"><span style="font-size:11.5px;color:var(--muted);flex-basis:100%;">Dni treningowe'+(opts.trainDaysFromClient?' (z harmonogramu klienta)':'')+'</span>'+WEEK_SHORT.map(([id,l])=>chip(days.includes(id),'dietToggleTrainDay('+id+')',l)).join('')+'</div>'
        :'<div style="display:flex;gap:4px;flex-wrap:wrap;">'+chip(opts.dayType!=='wolny','dietSetDayType(\'trening\')','Dzień treningowy')+chip(opts.dayType==='wolny','dietSetDayType(\'wolny\')','Dzień wolny')+'</div>');
  }
  return'<div class="diet-training" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0;"><div style="font-size:12px;font-weight:700;margin-bottom:4px;">Trening a jedzenie</div>'+body+'</div>';
}

/** Zakupy i gotowanie dla widoku kilku dni: liczba osób i obiad gotowany na 2–3 dni. */
function dietPrepHTML(plan){
  const chip=(on,click,label)=>'<button type="button" class="btn btn-sm'+(on?' btn-primary':'')+'" style="font-size:11.5px;padding:4px 10px;min-height:0;" aria-pressed="'+(on?'true':'false')+'" onclick="'+click+'">'+esc(label)+'</button>';
  const row=(title,body)=>'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;"><span style="font-size:11.5px;color:var(--muted);flex-basis:100%;">'+title+'</span>'+body+'</div>';
  return'<div class="diet-prep" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0;"><div style="font-size:12px;font-weight:700;margin-bottom:4px;">Zakupy i gotowanie</div>'+
    row('Obiad',[[0,'Codziennie inny'],[2,'Gotuję na 2 dni'],[3,'Gotuję na 3 dni']].map(([v,l])=>chip((plan.prep||0)===v,'dietSetPrep('+v+')',l)).join(''))+
    row('Lista zakupów dla',[1,2,3,4].map(n=>chip((plan.people||1)===n,'dietSetPeople('+n+')',n===1?'1 osoby':n+' osób')).join(''))+
    '</div>';
}

/** Kreator: sposób żywienia, alergie i wykluczenia, produkty, których klient nie je, czas przygotowania. */
function dietWizardHTML(p,skipOpen){
  p=dietPrefsNorm(p);
  const chip=(on,click,label)=>'<button type="button" class="btn btn-sm'+(on?' btn-primary':'')+'" style="font-size:11.5px;padding:4px 10px;min-height:0;" aria-pressed="'+(on?'true':'false')+'" onclick="'+click+'">'+esc(label)+'</button>';
  const row=(title,body)=>'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;"><span style="font-size:11.5px;color:var(--muted);flex-basis:100%;">'+title+'</span>'+body+'</div>';
  const styleEx=DIET_STYLES[p.style].ex;
  return'<div class="diet-wizard" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0;">'+
    '<div style="font-size:12px;font-weight:700;margin-bottom:4px;">Kreator jadłospisu</div>'+
    row('Sposób żywienia',Object.keys(DIET_STYLES).map(k=>chip(p.style===k,'dietSetStyle(\''+k+'\')',DIET_STYLES[k].label)).join(''))+
    row('Bez (alergie)',DIET_EXCLUSIONS.filter(e=>!styleEx.includes(e.id)).map(e=>chip(p.ex.includes(e.id),'dietToggleEx(\''+e.id+'\')',e.label)).join(''))+
    row('Czas na posiłek',[[0,'Bez limitu'],[15,'do 15 min'],[30,'do 30 min']].map(([v,l])=>chip(p.maxMin===v,'dietSetMaxMin('+v+')',l)).join(''))+
    '<details class="diet-like"'+(skipOpen==='like'?' open':'')+' style="margin-top:4px;"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);">❤ Produkty, które klient lubi'+(p.like.length?' ('+p.like.length+')':'')+'</summary><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">'+
      foodChips(DIET_FOODS.filter(f=>!p.skip.includes(f.id)),f=>chip(p.like.includes(f.id),'dietToggleLike(\''+f.id+'\')',f.name))+'</div><div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">Generator częściej wybiera posiłki z tymi produktami i stawia je pierwsze wśród zamienników.</div></details>'+
    '<details class="diet-skip"'+(skipOpen===true||skipOpen==='skip'?' open':'')+' style="margin-top:4px;"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);">✕ Produkty, których klient nie lubi lub nie je'+(p.skip.length?' ('+p.skip.length+')':'')+'</summary><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">'+
      foodChips(DIET_FOODS,f=>chip(p.skip.includes(f.id),'dietToggleSkip(\''+f.id+'\')',f.name))+'</div></details>'+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">Oznaczenia alergenów i czasy przygotowania to ustawienia aplikacji. Przy alergii zawsze sprawdzaj etykietę; przy chorobach skieruj klienta do dietetyka lub lekarza.</div>'+
    '</div>';
}

/** Sekcja „Postępy klienta” na karcie: trend, realizacja i najwyżej 3 propozycje do zatwierdzenia. */
function dietReviewHTML(rv){
  if(!rv)return'';
  const pl=v=>String(v).replace('.',',');
  const tr=rv.trend;
  const head='<div style="font-size:12px;font-weight:700;margin-bottom:4px;">📈 Postępy klienta i propozycje korekty</div>';
  const facts=rv.enough?'<div style="font-size:11.5px;margin-bottom:6px;">Trend masy: <strong>'+(tr.kgPerWeek>0?'+':'')+pl(tr.kgPerWeek)+' kg/tydz.</strong> ('+(tr.pctPerWeek>0?'+':'')+pl(tr.pctPerWeek)+'%), '+tr.n+' '+pomiarow(tr.n)+' z '+tr.days+' dni'+
    (rv.adherence.checkins?' · check-iny: '+rv.adherence.checkins+(rv.adherence.nutrition!=null?', odżywianie '+pl(rv.adherence.nutrition)+'/5':''):' · brak check-inów')+
    (rv.target?'<br>Cel tempa: '+esc(rv.target.text)+' '+srcTag(rv.target.sources):'')+'</div>':'';
  const msg=rv.message?'<div style="font-size:11.5px;color:var(--muted);">'+esc(rv.message)+'</div>':'';
  const items=rv.suggestions.map((sg,i)=>'<div class="calc-tip diet-suggestion" style="border-left:3px solid '+(sg.kind==='ok'||sg.kind==='info'?'var(--success)':'var(--warning)')+';"><strong>'+(i+1)+'. '+esc(sg.title)+'</strong><br>'+esc(sg.text)+' '+srcTag(sg.sources)+
    (sg.delta!=null&&sg.delta!==undefined?' <button type="button" class="btn btn-sm" style="font-size:10.5px;padding:2px 8px;min-height:0;" onclick="dietApplySuggestion('+sg.delta+')">Ustaw w kalkulatorze</button>':'')+'</div>').join('');
  return'<div class="diet-review" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0;">'+head+facts+msg+items+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">'+esc(rv.rule.text)+' To propozycje dla trenera: nic nie zmienia się samo, a decyzja należy do Ciebie.</div></div>';
}

// ════════ Zatwierdzanie przez trenera przed wysłaniem ════════
const ALLERGENS=['gluten','mleko','jaja','ryby','orzeszki','orzechy','soja','sezam'];
/**
 * Lista kontrolna przed wysłaniem: co jest niepewne i kiedy nie wysyłać.
 * ctx: {clientName, age, injuries}
 */
function dietApprovalChecks(t,plan,ctx){
  ctx=ctx||{};
  const out=[];
  const days=plan&&plan.days?plan.days:plan?[plan]:[];
  const warns=plan&&plan.warnings||[];
  warns.forEach(w=>out.push({level:'uwaga',text:w}));
  days.filter(d=>Math.abs(d.diffKcal)>Math.max(60,(d.kcalTarget||t.kcal)*0.05)).forEach(d=>out.push({level:'uwaga',text:(d.name||'Jadłospis')+': '+(d.diffKcal>0?'+':'')+d.diffKcal+' kcal od celu.'}));
  (t.notes||[]).forEach(n=>out.push({level:'uwaga',text:n.text,sources:n.sources}));
  const pr=plan&&plan.prefs;
  const al=pr?pr.ex.filter(id=>ALLERGENS.includes(id)):[];
  if(al.length)out.push({level:'uwaga',text:'Wykluczenia: '+al.map(id=>DIET_EXCLUSIONS.find(e=>e.id===id).label.toLowerCase()).join(', ')+'. Oznaczenia produktów to typowy skład; przy alergii z objawami klient powinien skonsultować dietę z lekarzem lub dietetykiem.'});
  if(ctx.injuries)out.push({level:'info',text:'Klient ma wpisane: „'+String(ctx.injuries).slice(0,120)+'”. Jadłospis tego nie uwzględnia.'});
  out.push({level:'info',text:'Wartości produktów z bazy USDA FoodData Central (produkty amerykańskie; musli i wafle z jadłospisów Bean). Polskie produkty mogą się trochę różnić, przy produktach z etykietą liczy się etykieta.',sources:[src('usda'),src('bean','202-204','wniosek')]});
  out.push({level:'stop',text:'Nie wysyłaj automatu, jeśli klient jest w ciąży, ma cukrzycę, inną chorobę wymagającą diety, zaburzenia odżywiania albo brak miesiączki. Skieruj go do lekarza lub dietetyka.',sources:[src('sn','377, 414, 443'),src('bk','917-919')]});
  return out;
}
function dietApprovalHTML(checks,saved){
  const icon={stop:'⛔',uwaga:'⚠',info:'ℹ'};
  const col={stop:'var(--danger)',uwaga:'var(--warning)',info:'var(--info)'};
  const st=saved&&saved.status?'<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;">Ostatni plan klienta: <strong>'+(saved.status==='zatwierdzony'?'zatwierdzony i wysłany':'szkic')+'</strong> '+esc(String(saved.status==='zatwierdzony'?saved.approvedAt:saved.updatedAt||'').slice(0,10))+(saved.kcal?' · '+saved.kcal+' kcal':'')+'</div>':'';
  return'<div class="diet-approval" style="border:2px solid var(--accent);border-radius:10px;padding:10px;margin:8px 0;">'+
    '<div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">Zatwierdź jadłospis przed wysłaniem</div>'+st+
    checks.map(c=>'<div class="calc-tip" style="border-left:3px solid '+col[c.level]+';">'+icon[c.level]+' '+esc(c.text)+(c.sources?' '+srcTag(c.sources):'')+'</div>').join('')+
    '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;margin:8px 0;cursor:pointer;"><input type="checkbox" id="diet-approve-check" onchange="var b=document.getElementById(\'diet-approve-btn\');if(b){b.disabled=!this.checked;b.style.opacity=this.checked?1:.45;}"> <span>Sprawdziłem jadłospis i punkty powyżej. Klient nie ma przeciwwskazań z czerwonego punktu.</span></label>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+
    '<button type="button" class="btn btn-sm btn-primary" id="diet-approve-btn" disabled style="opacity:.45;" onclick="dietApproveAndSend()">✅ Zatwierdź i wyślij</button>'+
    '<button type="button" class="btn btn-sm" onclick="dietSaveDraft()">💾 Zapisz jako szkic</button>'+
    '<button type="button" class="btn btn-sm" onclick="dietCloseApproval()">Anuluj</button></div></div>';
}

function dietRenderCard(t,day,opts){
  opts=opts||{};
  const r=v=>Math.round(v);
  const head='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:10px;">PRZYKŁADOWY JADŁOSPIS Z KSIĄŻEK</div>';
  if(t.blocked){
    return'<div class="calc-result-card diet-card" id="diet-card">'+head+t.blocks.map(b=>'<div class="calc-tip" style="border-left:3px solid var(--danger);">⚠ '+esc(b.text)+' '+srcTag(b.sources)+'</div>').join('')+'</div>';
  }
  const swapBtn=(di,mi,m)=>m.options>1?' <button type="button" class="btn btn-sm diet-swap-meal" style="font-size:10.5px;padding:2px 8px;min-height:0;" title="Inny posiłek o tym samym celu kalorii i makro" onclick="dietSwapMeal('+di+','+mi+')">🔄 Inny posiłek</button>':'';
  const mealsHTML=(d,di)=>d.meals.map((m,mi)=>'<div class="calc-meal-card">'+
    '<div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;">'+esc(m.name)+(m.minutes?' <span style="font-weight:400;color:var(--muted);">⏱ ~'+m.minutes+' min</span>':'')+(m.swapped?' <span style="font-weight:400;color:var(--muted);">(zamieniony)</span>':'')+swapBtn(di||0,mi,m)+'</div>'+
    '<div style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+r(m.total.kcal)+' kcal · B '+r(m.total.p)+' · T '+r(m.total.f)+' · W '+r(m.total.c)+'</div></div>'+
    m.items.map(it=>{const f=FOOD[it.id];const im=itemMacros(f,it.amount);const ck=cookedNote(f,it.amount);return'<div style="font-size:12px;padding:2px 0;">'+esc(f.name)+' <strong>'+esc(fmtAmount(f,it.amount))+'</strong>'+(ck?' <span style="font-size:10.5px;color:var(--muted);">('+esc(ck)+')</span>':'')+(it.role!=='x'?' <span style="font-size:10.5px;color:var(--muted);font-family:\'DM Mono\',monospace;">B '+Math.round(im.p)+' g · '+Math.round(im.kcal)+' kcal</span>':'')+
      (it.swaps.length?'<div style="font-size:10.5px;color:var(--muted);">zamiennik'+(it.role==='p'?' (to samo białko)':'')+': '+it.swaps.map(s=>(s.liked?'❤ ':'')+esc(FOOD[s.id].name.toLowerCase())+' '+esc(fmtAmount(FOOD[s.id],s.amount))+' <span style="font-family:\'DM Mono\',monospace;">(B '+Math.round(s.m.p)+' g · '+Math.round(s.m.kcal)+' kcal)</span>').join(' · ')+'</div>':'')+'</div>';}).join('')+
    ((m.changes||[]).length?'<div style="font-size:10.5px;color:var(--muted);margin-top:3px;">zmienione przez wykluczenia: '+m.changes.map(ch=>esc(FOOD[ch.from].name.toLowerCase())+' → '+(ch.to?esc(FOOD[ch.to].name.toLowerCase()):'bez zamiennika')).join(' · ')+'</div>':'')+
    '</div>').join('');
  const info=[
    '<strong>Białko</strong> '+t.protein.g+' g ('+String(t.protein.perKg).replace('.',',')+' g/kg, zakres '+t.protein.range+' g/kg) '+srcTag(t.protein.sources),
    '<strong>Tłuszcz</strong> '+t.fat.g+' g ('+t.fat.pct+'% energii, nie mniej niż 20%) '+srcTag(t.fat.sources),
    '<strong>Węglowodany</strong> '+t.carbs.g+' g ('+String(t.carbs.perKg).replace('.',',')+' g/kg; przy aktywności „'+esc(t.carbs.label)+'” '+t.carbs.range+') '+srcTag(t.carbs.sources),
    '<strong>Białko w posiłku</strong> ok. '+t.perMealProtein.g+' g (0,25 g/kg), rozłożone po równo '+srcTag(t.perMealProtein.sources)
  ].map(x=>'<div class="calc-tip">'+x+'</div>').join('');
  const notes=t.notes.map(nt=>'<div class="calc-tip" style="border-left:3px solid var(--warning);">⚠ '+esc(nt.text)+' '+srcTag(nt.sources)+'</div>').join('');
  // day: jeden dzień albo tydzień ({days, shopping}).
  const week=!!(day&&day.days);
  const days=week?day.days:[day];
  const off=days.filter(d=>Math.abs(d.diffKcal)>Math.max(60,t.kcal*0.05));
  const warns=((week?day.warnings:day.warnings)||[]).map(w=>'<div class="calc-tip" style="border-left:3px solid var(--warning);">⚠ '+esc(w)+'</div>').join('');
  const diff=off.length?'<div class="calc-tip" style="border-left:3px solid var(--warning);">'+(week?'Dni: '+off.map(d=>esc(d.name)).join(', ')+' różnią się od celu o więcej niż 5%':'Jadłospis różni się od celu o '+day.diffKcal+' kcal')+' (limity porcji). Zmień liczbę posiłków albo wariant.</div>':'';
  const r0=v=>Math.round(v);
  const dayHead=d=>'<span style="font-weight:700;">'+esc(d.name)+'</span>'+(d.dayType?' <span style="font-size:11px;'+(d.dayType==='trening'?'color:var(--accent);':'color:var(--muted);')+'">'+(d.dayType==='trening'?'🏋 trening':'wolne')+'</span>':'')+' <span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+r0(d.total.kcal)+' kcal · B '+r0(d.total.p)+' · T '+r0(d.total.f)+' · W '+r0(d.total.c)+'</span>';
  const meals=week
    ?day.days.map((d,i)=>'<details class="diet-day"'+(i===(+opts.openDay||0)?' open':'')+' style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-size:13px;">'+dayHead(d)+'</summary>'+mealsHTML(d,i)+'</details>').join('')+
      '<details class="diet-shop" style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-size:13px;font-weight:700;">🛒 Lista zakupów '+(day.days.length===7?'na tydzień':'na '+day.days.length+' dni')+(day.people>1?' dla '+day.people+' osób':'')+'</summary><div style="columns:2;column-gap:18px;font-size:12px;margin-top:6px;">'+
      day.shopping.map(s=>{const f=FOOD[s.id];return'<div>'+esc(f.name)+' <strong>'+esc(fmtShop(f,s.amount))+'</strong></div>';}).join('')+'</div>'+
      (day.people>1?'<div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">Pozostałe osoby liczone z porcjami jak klient (ustawienie aplikacji), nie według ich własnych potrzeb.</div>':'')+'</details>'+
      ((day.cooking||[]).length?'<details class="diet-cook" open style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-size:13px;font-weight:700;">🍳 Gotowanie obiadów na zapas</summary>'+
        day.cooking.map(b=>'<div style="font-size:12px;margin-top:6px;"><strong>'+esc(b.days[0])+'</strong>'+(b.days.length>1?' <span style="color:var(--muted);">na: '+esc(b.days.join(', '))+'</span>':'')+'<br>'+b.items.map(it=>esc(FOOD[it.id].name)+' '+esc(fmtShop(FOOD[it.id],it.amount))).join(' · ')+'</div>').join('')+
        '<div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">Ilości to suma porcji z tych dni (produkty suche przed gotowaniem). Gotowanie na 2–3 dni to ustawienie aplikacji; jak długo przechowywać jedzenie, książki nie podają.</div></details>':'')
    :mealsHTML(day,0);
  const mealsN=opts.meals||5;
  const nDays=week?day.days.length:1;
  const ctrl=dietWizardHTML(day&&day.prefs,opts.skipOpen)+dietTrainingHTML(opts,nDays)+(week?dietPrepHTML(day):'')+'<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px;">'+
    '<button class="btn btn-sm'+(nDays===1?' btn-primary':'')+'" onclick="dietSetView(\'dzien\')">1 dzień</button>'+
    '<button class="btn btn-sm'+(nDays===3?' btn-primary':'')+'" onclick="dietSetView(\'3dni\')">3 dni</button>'+
    '<button class="btn btn-sm'+(nDays===7?' btn-primary':'')+'" onclick="dietSetView(\'tydzien\')">📅 Cały tydzień</button>'+
    [3,4,5,6].map(k=>'<button class="btn btn-sm'+(k===mealsN?' btn-primary':'')+'" onclick="dietSetMeals('+k+')">'+k+' posiłki</button>').join('')+
    '<button class="btn btn-sm" onclick="dietNextVariant()">🔄 Inny wariant</button>'+
    (t.selected?'<button class="btn btn-sm" onclick="dietUseBookMacros()">📚 Ustaw makro z książek</button>':'')+
    '<button class="btn btn-sm" onclick="dietSendToClient()">📤 Wyślij '+(nDays===7?'tydzień':'jadłospis')+'</button></div>';
  return'<div class="calc-result-card diet-card" id="diet-card">'+head+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;">'+(t.selected?'Jadłospis liczony z makro wybranego w kalkulatorze. Zakresy obok to zalecenia książek.':'Makro wg książek: białko g/kg wg celu, tłuszcz 25% energii, reszta węglowodany (te same liczby co w podziale makro).')+' Liczba posiłków: 3 posiłki + 2–3 przekąski '+srcTag([src('sn','230')])+'.</div>'+
    info+notes+dietReviewHTML(opts.review)+diff+warns+ctrl+(opts.approval?dietApprovalHTML(opts.approval.checks,opts.approval.saved):'')+meals+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:8px;line-height:1.5;">Wartości produktów z bazy USDA FoodData Central (SR Legacy, domena publiczna; musli i wafle ryżowe z jadłospisów Bean). Mięso, ryby, kasze, ryż i makaron waż przed obróbką; waga po obróbce jest orientacyjna. Zestawy posiłków i podział energii między posiłki to ustawienia aplikacji. Ciąża, cukrzyca, zaburzenia odżywiania lub brak miesiączki: nie używaj automatu, skieruj do lekarza lub dietetyka '+srcTag([src('sn','377, 414, 443'),src('bk','917-919')])+'. To przykładowy plan, nie zastępuje dietetyka.</div>'+
    '</div>';
}

const api={dietApprovalChecks,dietProgressReview,weightTrend,dietRestTargets,REST_PAL,DIET_FOODS,DIET_EXCLUSIONS,DIET_STYLES,dietPrefsNorm,MEAL_TEMPLATES,MEAL_LAYOUTS,PROTEIN_BY_GOAL,REF,WEEK_DAYS,dietBookTargets,dietBuildDay,dietBuildWeek,dietPlanText,dietRenderCard,carbRangeForActivity};
root.DietPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
