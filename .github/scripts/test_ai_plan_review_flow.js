#!/usr/bin/env node
'use strict';
/* Contract test: AI may propose, but trainer review remains the save gate. */
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ai=fs.readFileSync(path.join(root,'03-ai-plangen-bizstats-aicoach.js'),'utf8');
const builder=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const academy=fs.readFileSync(path.join(root,'11-progress-academy.js'),'utf8');
let failed=0;
function ok(name,condition){if(condition)console.log('OK  ',name);else{failed++;console.error('FAIL',name);}}

ok('validator loads before AI generator',html.indexOf('12-plan-validator.js')>-1&&html.indexOf('12-plan-validator.js')<html.indexOf('03-ai-plangen-bizstats-aicoach.js'));
ok('proposal starts pending trainer approval',/approval=\{state:'pending_trainer_approval'/.test(ai));
ok('generation captures decision context',/generationContext=\{/.test(ai)&&/goal,level,method/.test(ai)&&/daysPerWeek:/.test(ai)&&/durationMinutes:/.test(ai)&&/weeks:/.test(ai)&&/equipment:/.test(ai)&&/physiquePriorities:/.test(ai)&&/hasMetrics,hasLiveContext/.test(ai)&&/hasLimitations:/.test(ai));
ok('trainer sees the captured context before acceptance',/function aplGenerationContextHTML/.test(ai)&&/Dane użyte do wygenerowania/.test(ai)&&/Priorytety sylwetkowe/.test(ai)&&/Sygnały z Progress Live/.test(ai)&&/Sprawdź go przed akceptacją/.test(ai));
ok('AI proposal has explicit accept action',/onclick="aplAcceptPlan\(\)"/.test(ai)&&/Propozycja AI — oczekuje na Twoją akceptację/.test(ai));
ok('acceptance revalidates plan',/source:'ai-approval'/.test(ai)&&/plValidatePlan\(aplLastPlan/.test(ai));
ok('validation errors block acceptance',/Popraw błędy Plan Health przed akceptacją/.test(ai));
ok('errors visibly block acceptance before click',/const acceptanceBlocked=pendingApproval&&\(validationErrors\.length>0\|\|reviewAcknowledgementRequired\)/.test(ai)&&/Akceptacja zablokowana/.test(ai)&&/aria-disabled="true"/.test(ai));
ok('edits revalidate and restore review state',/function aplMarkPlanEdited/.test(ai)&&/source:'ai-edit'/.test(ai)&&/changedAfterApprovalAt/.test(ai));
ok('acceptance stores a versioned audit trace',/function aplApprovalReview/.test(ai)&&/validatorVersion:report&&report\.version/.test(ai)&&/policyVersion:report&&report\.policyVersion/.test(ai)&&/reviewHistory/.test(ai)&&/Ślad akceptacji/.test(ai));
ok('trainer can inspect repeated acceptance history',/function aplApprovalHistoryHTML/.test(ai)&&/Historia akceptacji/.test(ai)&&/items\.slice\(\)\.reverse\(\)/.test(ai));
ok('high-risk review needs an explicit trainer acknowledgement',/const reviewAcknowledgementRequired=pendingApproval&&requiresTrainerReview&&!reviewAcknowledged/.test(ai)&&/aplSetReviewAcknowledgement\(this\.checked\)/.test(ai)&&/Wymagane potwierdzenie trenera/.test(ai)&&/trainerReviewAcknowledgedAt/.test(ai));
ok('AI exercises link to the verified exercise library',/function aplLinkPlanExercisesToLibrary/.test(ai)&&/aplLinkPlanExercisesToLibrary\(plan\)/.test(ai)&&/Karta w bibliotece/.test(ai)&&/Poza biblioteką/.test(ai)&&/function aplOpenExerciseInLibrary/.test(ai));
const validator=fs.readFileSync(path.join(root,'12-plan-validator.js'),'utf8');
ok('validator warns when the proposal needs equipment outside the declared setup',/function addEquipmentCompatibilityIssues/.test(validator)&&/EQUIPMENT_NOT_SELECTED/.test(validator)&&/Sprzęt propozycji/.test(validator));
ok('validator detects a plan whose session count differs from its declaration',/function addScheduleConsistencyIssue/.test(validator)&&/SCHEDULE_FREQUENCY_MISMATCH/.test(validator)&&/Częstotliwość planu/.test(validator));
ok('validator asks for an explicit deload decision in longer hypertrophy blocks',/function addDeloadPresenceIssue/.test(validator)&&/HYPERTROPHY_DELOAD_MISSING/.test(validator)&&/Deload w bloku/.test(validator));
ok('incomplete source data requires conscious generation confirmation',/function aplGenerationReadiness/.test(ai)&&/Kontekst do generowania jest niepełny/.test(ai)&&/inputReadiness:\{\.\.\.readiness,proceededWithGaps:!readiness\.complete\}/.test(ai)&&/Gotowość danych/.test(ai));
ok('PDF distinguishes a proposal from an approved plan',/pdfIsApproved=approval\.state==='approved'/.test(ai)&&/PROPOZYCJA AI — WYMAGA AKCEPTACJI/.test(ai)&&/ZATWIERDZONY PLAN/.test(ai)&&/Nie traktuj tego PDF jako finalnego planu/.test(ai));
ok('pending proposal cannot be saved',/approval\.state==='pending_trainer_approval'/.test(ai)&&/Najpierw sprawdź propozycję/.test(ai));
ok('accepted plan preserves approval and source context',/approval:aplLastPlan\.approval/.test(ai)&&/generationContext:aplLastPlan\.generationContext/.test(ai));
ok('builder also validates before save',/source:'builder-save'/.test(builder)&&/candidate\.validation=window\.plValidatePlan/.test(builder));
ok('academy is read-only validation surface',/wyłącznie odczyt planu/.test(academy)&&/source:'academy-preview'/.test(academy));

if(failed){console.error(`\n${failed} plan-review contract test(s) failed`);process.exit(1);}
console.log('\nAI plan-review contract tests passed');
