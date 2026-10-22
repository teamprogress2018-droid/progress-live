const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const worker=read('service-worker.js');
const index=read('index.html');
const manifest=JSON.parse(read('manifest.json'));

let failures=0;
function ok(description,condition){
  if(condition)console.log(`✓ ${description}`);
  else{console.error(`✗ ${description}`);failures+=1;}
}

ok('the application registers its offline shell only in a secure context',index.includes("'serviceWorker'in navigator")&&index.includes('window.isSecureContext')&&index.includes("register('./service-worker.js')"));
ok('the shell contains the app entry point and visual assets',worker.includes("'./index.html'")&&worker.includes("'./theme.css'")&&worker.includes("'./apple-touch-icon.png'"));
ok('the first install caches the local scripts and styles currently used by the app',worker.includes('async function cacheAppShell()')&&worker.includes('html.matchAll')&&worker.includes('new URL(ref,self.registration.scope)'));
ok('navigation has a cached fallback when the connection drops',worker.includes("request.mode==='navigate'")&&worker.includes("catch(()=>caches.match('./index.html'))"));
ok('the installable app describes the client experience with a light surface',manifest.description==='Plan, trening i postępy klienta'&&manifest.background_color==='#ffffff'&&manifest.theme_color==='#ffffff');

if(failures)process.exit(1);
