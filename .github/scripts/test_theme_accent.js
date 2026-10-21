'use strict';
// Progress Live 2.0 — motyw jasny domyślnie, akcent z ustawień, statusy niezależne od akcentu.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const start=core.indexOf('// ── Motyw Progress Live 2.0');
const end=core.indexOf("window.applyBrandTheme=applyBrandTheme;");
assert.ok(start>0&&end>start,'sekcja motywu w 01-core.js');

function makeCtx(){
  const props={},attrs={},store={};
  const meta={content:'',setAttribute(k,v){this[k]=v;}};
  const documentElement={style:{setProperty(k,v){props[k]=v;}},setAttribute(k,v){attrs[k]=v;}};
  const ctx={window:null,document:{documentElement,querySelector:()=>meta},
    localStorage:{setItem(k,v){store[k]=v;},getItem(k){return store[k]||null;}},Math,JSON,parseInt,String};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(core.slice(start,end),ctx);
  return {ctx,props,attrs,store,meta};
}

const {ctx,props,attrs,store,meta}=makeCtx();

// HEX i RGB (wcześniej niebieski kanał był liczony z błędnego wycinka)
assert.equal(ctx.normalizeHexColor('#ABC'),'#aabbcc');
assert.equal(ctx.normalizeHexColor('2563EB'),'#2563eb');
assert.equal(ctx.normalizeHexColor('red'),null);
assert.equal(ctx.normalizeHexColor('#12345'),null);
assert.equal(ctx.hexToRgbStr('#2563eb'),'37,99,235');
assert.equal(ctx.hexToRgbStr('#e60000'),'230,0,0');

// Presety: czerwony domyślny + 6 kolorów, każdy z kontrastem ≥ 4.5:1 na białym i z tekstem na przycisku
const labels=ctx.ACCENT_PRESETS.map(p=>p.label);
assert.equal(labels.join(','),'Czerwony,Pomarańczowy,Niebieski,Zielony,Fioletowy,Różowy');
assert.equal(ctx.ACCENT_PRESETS[0].hex,ctx.STUDIO_THEME.accent);
for(const p of ctx.ACCENT_PRESETS){
  const info=ctx.accentContrastInfo(p.hex,'light');
  assert.ok(info.ok,p.label+' kontrast '+info.onBg.toFixed(2)+'/'+info.onText.toFixed(2));
}
// Jasny własny kolor: tekst na przycisku grafitowy, ostrzeżenie o kontraście
assert.equal(ctx.accentOnColor('#ffd700'),'#111827');
assert.equal(ctx.accentOnColor('#e60000'),'#ffffff');
assert.equal(ctx.accentContrastInfo('#ffd700','light').ok,false);

// Motyw: domyślnie jasny; stare theme:'dark' (zapisywane domyślnie) nie wymusza ciemnego
assert.equal(ctx.resolveThemeMode({}),'light');
assert.equal(ctx.resolveThemeMode({theme:'dark'}),'light');
assert.equal(ctx.resolveThemeMode({themeMode:'dark'}),'dark');
assert.equal(ctx.resolveThemeMode({theme:'dark-v2'}),'dark');
assert.equal(ctx.resolveThemeMode({themeMode:'light',theme:'dark-v2'}),'light');

ctx.applyBrandTheme({brand:{accentColor:'#2563EB'}});
assert.equal(attrs['data-theme'],'light');
assert.equal(props['--accent'],'#2563eb');
assert.equal(props['--accent-red'],'#2563eb');
assert.equal(props['--accent-rgb'],'37,99,235');
assert.equal(props['--on-accent'],'#ffffff');
assert.ok(/^#[0-9a-f]{6}$/.test(props['--accent2'])&&props['--accent2']!=='#2563eb');
assert.equal(JSON.parse(store.pl_theme_v2).mode,'light');
assert.equal(meta.content,'#ffffff');
ctx.applyBrandTheme({brand:{accentColor:'nie-kolor',themeMode:'dark'}});
assert.equal(attrs['data-theme'],'dark');
assert.equal(props['--accent'],'#e60000');

// CSS: statusy nie odwołują się do akcentu, ostrzeżenia Academy używają --danger
const css=fs.readFileSync(path.join(root,'theme.css'),'utf8');
for(const t of ['--danger','--warning','--success','--info']){
  const decl=[...css.matchAll(new RegExp(t+':\\s*([^;]+);','g'))].map(m=>m[1]);
  assert.ok(decl.length>=2,t+' w obu motywach');
  assert.ok(decl.every(v=>!/accent/.test(v)),t+' niezależny od akcentu');
}
assert.match(css,/\.academy-safety\s*\{\s*border-left-color:\s*var\(--danger\)/);

// index.html: jasny motyw od startu i theme.css po styles.css
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/<html lang="pl" data-theme="light">/);
assert.ok(html.indexOf('theme.css?v=')>html.indexOf('styles.css?v='));
assert.ok(html.includes("localStorage.getItem('pl_theme_v2')"));

// Wybór akcentu zachowuje natywną obsługę radiogroup: strzałki zmieniają kolor i fokus.
const portal=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
assert.ok(portal.includes('function moveAccentPreset(event,current)'));
assert.ok(portal.includes("['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Home','End']"));
assert.ok(portal.includes('tabindex="${p.hex===accentNow?\'0\':\'-1\'}"'));

console.log('OK motyw: jasny domyślnie, presety akcentu z kontrastem, własny HEX, statusy niezależne');
