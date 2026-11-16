// Wywiad przed planem: dobór metody, objętość przy słabej regeneracji, frekwencja, ograniczenia, pytania, prompt.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..','..');
const ctx={console};ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(path.join(root,'plan-interview.js'),'utf8'),ctx);
const P=ctx.PLIV;
const base=o=>Object.assign(P.emptyInterview(),{goal:'redukcja',exp:'0-3m',days:'3',minutes:'45',equipment:['machines'],medical:'none',pain:'none'},o||{});

let r=P.recommend(base());
assert.strictEqual(r.method,'FBW','3 dni, początkujący → FBW');
assert.ok(/FBW 3×\/tydzień, ponieważ klient ma 3 dostępne dni i jest początkujący/.test(r.reasons[0]),r.reasons[0]);
assert.strictEqual(P.recommend(base({days:'2',exp:'1-3y'})).method,'FBW','2 dni → FBW');
assert.strictEqual(P.recommend(base({days:'4',exp:'1-3y'})).method,'Upper/Lower','4 dni → Upper/Lower');
assert.strictEqual(P.recommend(base({days:'6',exp:'1-3y'})).method,'PPL','6 dni, średni → PPL');
assert.notStrictEqual(P.recommend(base({days:'6',exp:'0-3m'})).method,'PPL','początkujący nigdy PPL');
assert.notStrictEqual(P.recommend(base({days:'5',exp:'1-3y'})).method,'PPL','5 dni średni → bez PPL');
assert.strictEqual(P.recommend(base({days:'5',exp:'3y+',technique:'5'})).method,'PPL','5 dni zaawansowany → PPL');
assert.notStrictEqual(P.recommend(base({days:'6',exp:'3y+',sleepH:'5',stress:'5'})).method,'PPL','podwyższone ryzyko → bez PPL');

// Regeneracja: mniejsza objętość, zachowawcze RIR, ryzyko w profilu.
const good=P.recommend(base({sleepH:'8',stress:'2'})),bad=P.recommend(base({sleepH:'6',stress:'4'}));
assert.ok(bad.setsHi<good.setsHi&&bad.setsLo<good.setsLo,'słaby sen i stres obniżają objętość');
assert.ok(parseFloat(bad.rir)>=3,'zachowawcze RIR: '+bad.rir);
assert.ok(bad.reasons.some(x=>/niska–umiarkowana.*słaby sen i wysoki stres/.test(x)),bad.reasons.join('|'));
assert.strictEqual(bad.risk.level,'podwyższone');

// Frekwencja: mniej dni i krótsze sesje.
const att=P.recommend(base({days:'4',minutes:'60',exp:'1-3y'}),{attendance:{planned:10,done:4,rate:.4}});
assert.strictEqual(att.days,3);assert.strictEqual(att.minutes,45);assert.strictEqual(att.method,'FBW');
assert.ok(att.reasons.some(x=>/odbyło się 4 z 10/.test(x)));
const sessions=[{clientId:'c',date:'2026-11-01',source:'planned'},{clientId:'c',date:'2026-11-03',source:'planned',status:'done'},{clientId:'c',date:'2026-11-05',source:'planned'},{clientId:'x',date:'2026-11-05',source:'planned'}];
const a=P.attendance('c',sessions,new Date('2026-11-10T12:00:00'));
assert.ok(a&&a.planned===3&&a.done===1,JSON.stringify(a));

// Ból i zalecenia: bezpieczniejszy wariant, komunikat medyczny, oznaczenie do weryfikacji tylko przy istotnych objawach.
const knee=P.recommend(base({pain:'yes',painText:'kolano',painMoves:'głęboki przysiad'}));
assert.ok(knee.reasons.some(x=>/maszyny.*kontrolowany zakres ruchu.*głęboki przysiad/.test(x)));
assert.ok(knee.warnings.some(x=>/nie zastępuje konsultacji medycznej/.test(x)));
assert.strictEqual(knee.needsTrainerReview,false,'zwykły dyskomfort nie blokuje');
const op=P.recommend(base({pain:'yes',painText:'operacja łąkotki, ból promieniuje'}));
assert.strictEqual(op.needsTrainerReview,true,'istotne objawy → uwaga trenera');
assert.strictEqual(P.recommend(base({medical:'yes',medicalText:'bez dźwigania nad głową'})).needsTrainerReview,true);

// Walidacja kroków: tylko pola potrzebne do bezpiecznej propozycji.
assert.deepStrictEqual([...P.stepErrors(P.emptyInterview(),1)],['Główny cel']);
assert.ok(P.stepErrors(base({minutes:''}),2).includes('Ile minut ma na jedną sesję?'));
assert.strictEqual(P.stepErrors(base(),4).length,0,'krok regeneracji opcjonalny');
assert.ok(P.stepErrors(base({pain:'yes',painText:''}),3).some(x=>/co boli/.test(x)));
assert.strictEqual(P.stepErrors(base({pain:'skip',medical:'skip'}),3).length,0,'można pominąć');
assert.ok(P.missingData(base({pain:'skip'})).includes('historia urazów i bólu'));

// Profil do planu.
const prof=P.profile(base({sleepH:'6',stress:'4',pain:'yes',painText:'ból kolana przy głębokim zgięciu'}));
const row=k=>prof.find(x=>x.k===k).v;
assert.strictEqual(row('avail'),'3 × 45 min');assert.strictEqual(row('equip'),'Maszyny');
assert.ok(/kolana/.test(row('limits')));assert.ok(/sen 6 h.*stres 4\/5/.test(row('recovery')));assert.ok(/^podwyższone/.test(row('risk')));

// Pytania zapasowe — maks. 3 i tylko istotne braki.
assert.ok(P.fallbackQuestions(P.emptyInterview()).length<=3);
assert.strictEqual(P.fallbackQuestions(base({sleepH:'7',stress:'2'})).length,0,'komplet danych → brak pytań');

// Prefill z profilu klienta + zapisany wywiad ma pierwszeństwo.
const pre=P.prefill({goal:'masa',level:'sredni',trainingFreq:4,injuries:'bark',weight:82,height:180,availableEquipment:['Sztanga i wolne ciężary']},{days:'3',dislikes:'burpees'});
assert.strictEqual(pre.goal,'masa');assert.strictEqual(pre.exp,'1-3y');assert.strictEqual(pre.days,'3','zapis trenera wygrywa');
assert.strictEqual(pre.pain,'yes');assert.strictEqual(pre.painText,'bark');assert.deepStrictEqual([...pre.equipment],['gym']);

// Prompt: wywiad, nielubiane, decyzje algorytmu, alternatywy i brak wiedzy w książkach.
const nb=P.notesBlock(base({dislikes:'burpees',sleepH:'6',stress:'4'}));
assert.ok(/NIE LUBI.*burpees/.test(nb));assert.ok(/Metoda: FBW, 3 dni, sesja 45 min/.test(nb));
assert.ok(/"alt"/.test(nb));assert.ok(/Brak wystarczającej wiedzy w bibliotece — decyzja wymaga oceny trenera/.test(nb));
assert.ok(/nie z szablonu/.test(nb));

// Wiedza z książek — maks. 3 krótkie wskazówki, bez żywienia.
const hints=P.bookHints({bookRules:[1,2,3,4,5].map(i=>({topic:'t'+i,cite:'Książka '+i+', s. '+i,text:'Zdanie pierwsze numer '+i+'. Drugie zdanie.'})).concat([{topic:'żywienie',cite:'X',text:'Y'}])});
assert.strictEqual(hints.length,3);assert.ok(hints.every(h=>!/Drugie/.test(h.tip)));
assert.strictEqual(P.bookHints({bookRules:[]}).length,0);
console.log('All plan interview tests passed.');
