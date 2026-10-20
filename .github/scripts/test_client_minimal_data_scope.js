const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');

let failures=0;
function ok(description,condition){
  if(condition)console.log(`✓ ${description}`);
  else{console.error(`✗ ${description}`);failures+=1;}
}

ok('the client reads public visibility settings before optional content',app.includes('const publicSettings=clientPublicSettings(publicData,account.trainerName);'));
ok('resources and on-demand libraries are fetched only when visible',app.includes("['resources','odWorkouts','odPrograms'].includes(name)")&&app.includes('visible.resources!==false')&&app.includes('visible.ondemand!==false'));
ok('forum data is not fetched when the forum is hidden',app.includes("visible.forum===false?Promise.resolve({groups:[],posts:[],comments:[]}):queryClientForum"));
ok('core exercise data remains available for the assigned workout',app.includes('![') && app.includes('USER_RESOURCES:sharedData.resources||[]'));

if(failures)process.exit(1);
