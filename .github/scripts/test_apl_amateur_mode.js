const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('14-amateur-plan-wizard.js','utf8');
const ctx={window:{},document:{getElementById:()=>null,querySelectorAll:()=>[]},console};vm.createContext(ctx);vm.runInContext(src,ctx);
let failures=0;function ok(name,condition){if(condition)console.log('OK ',name);else{console.error('FAIL',name);failures++;}}
const clear=ctx.aplAmateurAssessment({parq:'no',pain:'no',consent:true,sleep:3,stress:3});
ok('clear intake is eligible',clear.status==='clear'&&clear.blockers.length===0);
const review=ctx.aplAmateurAssessment({parq:'yes',pain:'yes',consent:true});
ok('health or pain blocks automatic plan',review.status==='review'&&review.blockers.includes('health-declaration')&&review.blockers.includes('pain-or-injury'));
const noConsent=ctx.aplAmateurAssessment({parq:'no',pain:'no',consent:false});
ok('missing consent blocks automatic plan',noConsent.blockers.includes('consent-missing'));
const cautious=ctx.aplAmateurPrescription({parq:'no',pain:'no',consent:true,sleep:2,stress:5,days:6,duration:120});
ok('low recovery uses cautious prescription',cautious.conservative&&cautious.targetRir==='4');
ok('amateur limits frequency and duration',cautious.days==='3'&&cautious.duration==='60');
const standard=ctx.aplAmateurPrescription({parq:'no',pain:'no',consent:true,days:2,duration:45});
ok('starter prescription is FBW and double progression',standard.method==='FBW'&&standard.progression==='double'&&standard.weeks==='4'&&standard.level==='poczatkujacy');
ok('trainer review helpers exported',typeof ctx.window.aplAmateurReviewHtml==='function'&&typeof ctx.window.aplAmateurConfirmReview==='function');
if(failures)process.exit(1);console.log('\nAll amateur mode tests passed');
