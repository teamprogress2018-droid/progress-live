/* Mapa mięśni (sylwetka przód / tył) dla ćwiczeń bez filmu techniki.
   Dane z pola `muscle` w DEF_EX: pierwszy wymieniony mięsień = główny, reszta = pomocnicze,
   „(główna)/(główny)” wskazuje główny wprost. Bez bibliotek — vanilla JS, ładowany jak inne pliki. */
(function(root){
  'use strict';

  const MUSCLE_IDS=['chest','delt_front','delt_side','delt_rear','biceps','triceps','forearms','abs','obliques',
    'quads','adductors','calves','traps','lats','upper_back','lower_back','glutes','hamstrings'];
  const MUSCLE_LABELS={
    chest:'klatka piersiowa',delt_front:'przedni akton barku',delt_side:'boczny akton barku',delt_rear:'tylny akton barku',
    biceps:'biceps',triceps:'triceps',forearms:'przedramiona',abs:'mięśnie brzucha',obliques:'mięśnie skośne brzucha',
    quads:'czworogłowe uda',adductors:'przywodziciele',calves:'łydki',traps:'czworoboczny (kaptur)',
    lats:'najszerszy grzbietu',upper_back:'środek pleców',lower_back:'prostowniki grzbietu',glutes:'pośladki',
    hamstrings:'dwugłowe uda (tył uda)'
  };

  /** Małe litery, bez polskich znaków (ł → l). */
  function mmNorm(t){
    return String(t||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'');
  }
  // Reguły po rdzeniach słów, od najbardziej szczegółowych; pierwsza pasująca wygrywa dla danej frazy.
  const MUSCLE_RULES=[
    [/tyln\w*\s+(bark|akton)|(bark|akton)\w*\s+tyln/,['delt_rear']],
    [/przedni\w*\s+(bark|akton)|(bark|akton)\w*\s+przedni/,['delt_front']],
    [/(boczn|srodkow)\w*\s+(bark|akton)|(bark|akton)\w*\s+(boczn|srodkow)/,['delt_side']],
    [/biceps|ramienn|dwuglow\w*\s+ramien/,['biceps']],
    [/triceps|trojglow/,['triceps']],
    [/przedrami|chwyt/,['forearms']],
    [/skosn/,['obliques']],
    [/brzuch(?!at)|\bcore\b|gleboki|glebokie/,['abs']],
    [/czworoglow|przod\w*\s+ud/,['quads']],
    [/przywodzic/,['adductors']],
    [/lydk|brzuchat|plaszczk/,['calves']],
    [/czworoboczn|kaptur|trapez/,['traps']],
    [/najszersz|\blats?\b/,['lats']],
    [/rownoleg|romboid|rombow|srod\w*\s+plec|plec\w*\s+srod/,['upper_back']],
    [/prostowni|ledzw|doln\w*\s+odcin/,['lower_back']],
    [/posladk/,['glutes']],
    [/dwuglow\w*\s+ud|tyl\w*\s+ud|kulszowo/,['hamstrings']],
    [/piers|klatk/,['chest']],
    // Ogólne słowa — na końcu.
    [/\bbark|akton/,['delt_front','delt_side']],
    [/plec|grzbiet/,['lats','upper_back']],
    [/\bud(a|o|ach|zie)?\b/,['quads','hamstrings']]
  ];

  /** Dzieli tekst po przecinkach, średnikach, „/”, „+”, „ i ”, „ oraz ” — ale nie wewnątrz nawiasów. */
  function mmSplit(t){
    const out=[];let cur='',depth=0;
    for(let k=0;k<t.length;k++){
      const c=t[k];
      if(c==='(')depth++;else if(c===')')depth=Math.max(0,depth-1);
      if(!depth&&/[,;\/+]/.test(c)){out.push(cur);cur='';continue;}
      if(!depth&&t.slice(k,k+3)===' i '){out.push(cur);cur='';k+=2;continue;}
      if(!depth&&t.slice(k,k+6)===' oraz '){out.push(cur);cur='';k+=5;continue;}
      cur+=c;
    }
    out.push(cur);
    return out.map(x=>x.trim()).filter(Boolean);
  }

  /** Pole `muscle` → {primary:[id], secondary:[id], unknown:[fraza]}. Nieznane słowa są pomijane bez błędu. */
  function parseMuscles(str){
    const found=[],unknown=[];let marked=false;
    mmSplit(mmNorm(str)).forEach(seg=>{
      const rule=MUSCLE_RULES.find(r=>r[0].test(seg));
      if(!rule){const u=seg.replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim();if(u)unknown.push(u);return;}
      const main=/\(glown/.test(seg);
      if(main)marked=true;
      found.push({ids:rule[1],main});
    });
    const primary=[],secondary=[];
    found.forEach((f,k)=>{if(marked?f.main:k===0)f.ids.forEach(id=>{if(!primary.includes(id))primary.push(id);});});
    found.forEach(f=>f.ids.forEach(id=>{if(!primary.includes(id)&&!secondary.includes(id))secondary.push(id);}));
    return {primary,secondary,unknown};
  }

  const mmEsc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mmList=ids=>ids.map(id=>MUSCLE_LABELS[id]||id).join(', ');

  // Kształty (lewa połowa sylwetki 110×250; prawa to lustro względem x=55). [id, typ, atrybuty, pojedynczy]
  const FRONT=[
    ['traps','path','d="M47 33 L55 36 L42 41 Z"'],
    ['delt_side','ellipse','cx="27" cy="47" rx="4" ry="7"'],
    ['delt_front','ellipse','cx="34" cy="45" rx="5" ry="6"'],
    ['chest','path','d="M54 44 L39 43 Q35 52 39 60 Q47 64 54 60 Z"'],
    ['biceps','ellipse','cx="26" cy="66" rx="4" ry="10"'],
    ['forearms','ellipse','cx="21" cy="95" rx="3.6" ry="12"'],
    ['abs','rect','x="48" y="63" width="14" height="40" rx="4"',true],
    ['obliques','path','d="M39 64 L46 67 L46 99 L41 101 Q37 84 39 64 Z"'],
    ['quads','ellipse','cx="45" cy="146" rx="7" ry="22"'],
    ['adductors','path','d="M51 124 L54.5 124 L54.5 162 L50.5 156 Z"'],
    ['calves','ellipse','cx="44" cy="196" rx="4.5" ry="14"']
  ];
  const BACK=[
    ['traps','path','d="M55 29 L68 40 L55 66 L42 40 Z"',true],
    ['delt_side','ellipse','cx="27" cy="47" rx="4" ry="7"'],
    ['delt_rear','ellipse','cx="34" cy="46" rx="5" ry="6"'],
    ['upper_back','path','d="M43 44 L52 49 L52 64 L42 59 Z"'],
    ['lats','path','d="M36 56 L45 62 L51 71 L50 93 L40 87 Q35 72 36 56 Z"'],
    ['lower_back','rect','x="48" y="88" width="14" height="22" rx="4"',true],
    ['triceps','ellipse','cx="26" cy="66" rx="4" ry="10"'],
    ['forearms','ellipse','cx="21" cy="95" rx="3.6" ry="12"'],
    ['glutes','ellipse','cx="46" cy="124" rx="8" ry="9"'],
    ['hamstrings','ellipse','cx="45" cy="154" rx="7" ry="18"'],
    ['calves','ellipse','cx="44" cy="194" rx="5" ry="13"']
  ];
  // Sylwetka (tło): głowa, szyja, tułów, ręce, nogi.
  const BODY='<circle cx="55" cy="17" r="11"/><rect x="50" y="27" width="10" height="9" rx="3"/>'+
    '<path d="M33 37 Q55 31 77 37 L80 70 Q78 100 72 118 L38 118 Q32 100 30 70 Z"/>'+
    '<path d="M33 39 Q23 43 21 60 L17 100 L15 128 L22 130 L28 102 L34 70 Z"/><path d="M77 39 Q87 43 89 60 L93 100 L95 128 L88 130 L82 102 L76 70 Z"/>'+
    '<path d="M38 116 L54 118 L52 170 L50 230 L41 232 L39 172 Z"/><path d="M72 116 L56 118 L58 170 L60 230 L69 232 L71 172 Z"/>';

  function mmShapes(list,primary,secondary,still){
    return list.map(([id,tag,attrs,single])=>{
      const cls=primary.includes(id)?'mm-m mm-p':secondary.includes(id)?'mm-m mm-s':'mm-m';
      const role=primary.includes(id)?'główny':secondary.includes(id)?'pomocniczy':'';
      const title=`<title>${mmEsc(MUSCLE_LABELS[id])}${role?' — '+role:''}</title>`;
      const one=still?`<${tag} class="${cls}" ${attrs}/>`:`<${tag} class="${cls}" data-act="mm-tap" data-m="${id}" data-role="${role}" ${attrs}>${title}</${tag}>`;
      if(single)return one;
      return one+`<g transform="matrix(-1 0 0 1 110 0)">${one}</g>`;
    }).join('');
  }

  /** Rysunek SVG + lista partii (główne / pomocnicze).
      opts: {compact} mała wersja, {legend:false} bez listy, {bare} sam SVG bez dotyku (np. miniatura w przycisku). */
  function muscleMapHTML(primary,secondary,opts){
    primary=(primary||[]).filter(id=>MUSCLE_LABELS[id]);
    secondary=(secondary||[]).filter(id=>MUSCLE_LABELS[id]&&!primary.includes(id));
    if(!primary.length&&!secondary.length)return '';
    const o=opts||{};
    const aria=`Główne: ${mmList(primary)||'brak'}.${secondary.length?' Pomocnicze: '+mmList(secondary)+'.':''}`;
    const svg=`<svg class="mm-svg" viewBox="0 0 230 236" role="img" aria-label="${mmEsc(aria)}" focusable="false">
      <g class="mm-fig"><g class="mm-body">${BODY}</g>${mmShapes(FRONT,primary,secondary,o.bare)}</g>
      <g class="mm-fig" transform="translate(120 0)"><g class="mm-body">${BODY}</g>${mmShapes(BACK,primary,secondary,o.bare)}</g>
    </svg>`;
    const caps='<div class="mm-caps" aria-hidden="true"><span>Przód</span><span>Tył</span></div>';
    if(o.bare)return svg.replace('class="mm-svg"','class="mm-svg mm-bare" aria-hidden="true"');
    const legend=o.legend===false?'':`<ul class="mm-legend">
      ${primary.length?`<li><span class="mm-dot mm-dot-p" aria-hidden="true"></span><b>główne:</b> ${mmEsc(mmList(primary))}</li>`:''}
      ${secondary.length?`<li><span class="mm-dot mm-dot-s" aria-hidden="true"></span><b>pomocnicze:</b> ${mmEsc(mmList(secondary))}</li>`:''}
    </ul>`;
    const pick='<p class="mm-pick" aria-live="polite">Dotknij mięśnia, żeby zobaczyć nazwę.</p>';
    return `<figure class="mm${o.compact?' mm-compact':''}" data-muscle-map><div class="mm-draw">${svg}${caps}</div>${pick}${legend}</figure>`;
  }

  /** Ćwiczenie z biblioteki (obiekt albo nazwa) → dane mapy. */
  function muscleMapData(exOrName){
    let ex=exOrName;
    if(typeof exOrName==='string'||(ex&&!ex.muscle&&ex.name)){
      const name=typeof exOrName==='string'?exOrName:ex.name;
      const lib=typeof root.libExerciseByName==='function'?root.libExerciseByName(name):null;
      ex=lib&&lib.muscle?lib:(ex&&typeof ex==='object'?ex:null);
    }
    if(!ex||!ex.muscle)return null;
    const p=parseMuscles(ex.muscle);
    if(!p.primary.length&&!p.secondary.length)return null;
    const tip=String(ex.tip||'').trim();
    return {primary:p.primary,secondary:p.secondary,tip:/^dodane podczas importu materia/i.test(tip)?'':tip,name:ex.name||''};
  }

  /** Mapa + „Jak wykonać” (pole tip) dla ćwiczenia; pusty tekst, gdy brak rozpoznanych mięśni. */
  function muscleMapExHTML(exOrName,opts){
    const d=muscleMapData(exOrName);
    if(!d)return '';
    const o=opts||{};
    const map=muscleMapHTML(d.primary,d.secondary,o);
    const tip=o.tip!==false&&d.tip?`<div class="mm-how"><h4 class="mm-how-h">Jak wykonać</h4><p>${mmEsc(d.tip)}</p></div>`:'';
    return map+tip;
  }

  // Dotknięcie mięśnia: nazwa pod rysunkiem (dostępne też z listy partii).
  if(typeof root.uiAction==='function')root.uiAction('mm-tap',(d,el)=>{
    const fig=el.closest&&el.closest('[data-muscle-map]');if(!fig)return;
    fig.querySelectorAll('.mm-m.mm-on').forEach(x=>x.classList.remove('mm-on'));
    fig.querySelectorAll(`.mm-m[data-m="${d.m}"]`).forEach(x=>x.classList.add('mm-on'));
    const pick=fig.querySelector('.mm-pick');
    if(pick)pick.textContent=(MUSCLE_LABELS[d.m]||d.m)+(d.role?' — '+d.role:'');
  });

  const api={MUSCLE_IDS,MUSCLE_LABELS,MUSCLE_RULES,parseMuscles,muscleMapHTML,muscleMapData,muscleMapExHTML,mmNorm};
  Object.assign(root,api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
