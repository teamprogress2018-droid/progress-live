const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const portal=read('04-client-portal.js');
const app=read('10-client-app.js');
const css=read('theme.css');
const index=read('index.html');
let failures=0;
const ok=(description,condition)=>{
  if(condition)console.log(`✓ ${description}`);
  else{console.error(`✗ ${description}`);failures++;}
};
ok('today screen keeps one explicit primary workout action',portal.includes('cap-client-main-action'));
ok('swipe reveals a plan shortcut instead of executing it',portal.includes('data-cap-swipe-plan')&&portal.includes("if(delta<-56)card.classList.add('is-swipe-revealed')")&&portal.includes('planShortcut')&&portal.includes('Pokaż plan'));
ok('both client render paths bind the safe swipe shortcut',portal.includes("capBindTodaySwipe(content)")&&app.includes("capBindTodaySwipe(content)"));
ok('the swipe action has a touch-only visible reveal and reduced-motion support',css.includes('.cap-client-next.is-swipe-revealed .cap-client-swipe-action')&&css.includes('@media (prefers-reduced-motion: reduce)'));
ok('the coach can apply a reversible minimal client navigation preset',portal.includes('function applyClientMinimalPreset()')&&portal.includes("const allowed=new Set(['home','plan','messages','progress','profile'])")&&portal.includes('Ustaw prosty widok klienta'));
ok('client sign-in has an explicit mobile-app entry label',app.includes("Aplikacja klienta — zaloguj się i od razu zobacz swój trening")&&index.includes("const idleLabel=btn.textContent||'Zaloguj się';"));
ok('the invite explains how to keep the client app on an iPhone home screen',portal.includes('Udostępnij → Do ekranu początkowego'));
ok('more navigation restores focus and closes with Escape',app.includes("function closeCliveMoreNav(returnFocus)")&&app.includes("event.key==='Escape'")&&app.includes("if(first)first.focus()"));
if(failures)process.exit(1);
