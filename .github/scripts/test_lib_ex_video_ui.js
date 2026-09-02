// UI: biblioteka ćwiczeń odtwarza MP4 techniki w szczegółach, karty zostają ze zdjęciem.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIB_VIDEO_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-lib-video'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Wyciskanie sztangi leżąc';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');

  const card = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Wyciskanie sztangi leżąc');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_bench_card.png') });
  ok('bench card rendered', card.found, JSON.stringify(card));
  ok('bench card uses still photo', /free-exercise-db|githubusercontent/i.test(card.img) && !/\.mp4/i.test(card.img), card.img);
  ok('bench card has no video tag', !card.hasVideo);

  await page.evaluate(() => {
    if (typeof setExView === 'function') setExView('grid');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Przysiad hack maszyna';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Przysiad hack maszyna');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    return !!(img && img.complete && img.naturalWidth > 0);
  });
  const hack = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Przysiad hack maszyna');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      complete: img ? img.complete : false,
      w: img ? img.naturalWidth : 0,
      h: img ? img.naturalHeight : 0,
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_hack_squat_card.png') });
  ok('hack squat card rendered', hack.found, JSON.stringify(hack));
  ok('hack squat card uses local gif', /przysiad-hack-maszyna\.gif/.test(hack.img) && !/\.mp4/i.test(hack.img) && !/Hack_Squat\/0\.jpg/.test(hack.img), hack.img);
  ok('hack squat gif loaded', hack.complete && hack.w > 0 && hack.h > 0, JSON.stringify(hack));
  ok('hack squat card has no video tag', !hack.hasVideo);

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Przysiad hack maszyna');
  });
  await page.waitForSelector('#exd-body .ex-guide');
  await page.waitForSelector('#exd-body img.cw-technique-gif-img, #exd-body .cw-technique-gif img');
  const hackDetail = await page.evaluate(() => {
    const img = document.querySelector('#exd-body img.cw-technique-gif-img') || document.querySelector('#exd-body .cw-technique-gif img');
    const video = document.querySelector('#exd-body video');
    const guide = document.querySelector('#exd-body .ex-guide');
    const phases = [...document.querySelectorAll('#exd-body .ex-phase img')].map((el) => el.getAttribute('src') || '');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: img ? img.getAttribute('src') : '',
      hasVideo: !!video,
      hasGuide: !!guide,
      phases,
      anatomy: !!(guide && guide.querySelector('.ex-anatomy img')),
      stretch: !!(guide && guide.querySelector('.ex-stretch-lens img')),
      heat: !!(guide && guide.querySelector('.ex-phase-heat')),
      copy: guide ? (guide.innerText || '') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_hack_squat_detail.png') });
  ok('hack squat detail title', hackDetail.title === 'Przysiad hack maszyna', hackDetail.title);
  ok('hack squat detail shows gif', /przysiad-hack-maszyna\.gif/.test(hackDetail.src), hackDetail.src);
  ok('hack squat detail has no mp4 video', !hackDetail.hasVideo);
  ok('hack squat guide rendered', hackDetail.hasGuide && hackDetail.phases.length === 3, JSON.stringify(hackDetail.phases));
  ok('hack squat phases from gif stills', hackDetail.phases.some((s) => /phase-start/.test(s)) && hackDetail.phases.some((s) => /phase-bottom/.test(s)));
  ok('hack squat anatomy + stretch', hackDetail.anatomy && hackDetail.stretch && hackDetail.heat);
  ok('hack squat stretch copy', /Pełne rozciągnięcie/i.test(hackDetail.copy) && /czworogł/i.test(hackDetail.copy));

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Wyciskanie sztangi leżąc');
  });
  await page.waitForSelector('#exd-body video');
  const detail = await page.evaluate(() => {
    const video = document.querySelector('#exd-body video');
    const title = (document.getElementById('exd-title') || {}).textContent || '';
    return {
      title,
      src: video ? video.getAttribute('src') : '',
      autoplay: video ? video.hasAttribute('autoplay') : false,
      loop: video ? video.hasAttribute('loop') : false
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_bench_detail.png') });
  ok('detail title is bench', detail.title === 'Wyciskanie sztangi leżąc', detail.title);
  ok('detail plays mp4', /progress-live-video-assets/.test(detail.src) && /\.mp4/i.test(detail.src), detail.src.slice(0, 160));
  ok('detail video loops muted autoplay', detail.autoplay && detail.loop);

  async function detailMedia(name) {
    await page.evaluate((n) => {
      if (typeof openExDetail === 'function') openExDetail(n);
    }, name);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const video = document.querySelector('#exd-body video');
      const img = document.querySelector('#exd-body img.cw-technique-gif-img') || document.querySelector('#exd-body .cw-technique-gif img');
      return {
        title: (document.getElementById('exd-title') || {}).textContent || '',
        src: video ? video.getAttribute('src') : '',
        img: img ? img.getAttribute('src') : '',
        hasVideo: !!video
      };
    });
  }

  const incline = await detailMedia('Wyciskanie hantli skos+');
  await page.screenshot({ path: path.join(shotDir, 'lib_incline_db_detail.png') });
  ok('incline detail title', incline.title === 'Wyciskanie hantli skos+', incline.title);
  ok('incline plays dodatniej clip', /dodatniej|sko%C5%9Bnej%20dodatniej/i.test(incline.src) && /\.mp4/i.test(incline.src), incline.src.slice(0, 180));
  ok('incline not fake OHP incline file', !/%20\(incline\)%20\(Incline/i.test(incline.src));

  const lowHigh = await detailMedia('Krzyżowanie wyciągów dół–góra');
  await page.screenshot({ path: path.join(shotDir, 'lib_crossover_low_high_detail.png') });
  ok('low-high detail title', /dół–góra|dol–gora/i.test(lowHigh.title), lowHigh.title);
  ok('low-high plays standing crossover', /stoj%C4%85c|Cable%20Crossover/i.test(lowHigh.src) && /\.mp4/i.test(lowHigh.src), lowHigh.src.slice(0, 180));

  const flies = await detailMedia('Rozpiętki na wyciągu');
  await page.screenshot({ path: path.join(shotDir, 'lib_cable_fly_detail.png') });
  ok('cable fly plays krzeselko overview', /krzese%C5%82ko|Cable%20Crossover/i.test(flies.src) && /\.mp4/i.test(flies.src), flies.src.slice(0, 180));

  const knees = await detailMedia('Pompki na kolanach');
  await page.screenshot({ path: path.join(shotDir, 'lib_knee_pushup_detail.png') });
  ok('knee push-up plays wide-grip-named clip', /Wide-Grip%20Push-Up/i.test(knees.src) && /\.mp4/i.test(knees.src), knees.src.slice(0, 180));

  const decline = await detailMedia('Wyciskanie sztangi skos−');
  ok('decline barbell has no lying mp4', !decline.hasVideo, JSON.stringify(decline).slice(0, 200));

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Ściąganie do twarzy (face pull)');
  });
  await page.waitForTimeout(300);
  const face = await page.evaluate(() => {
    const video = document.querySelector('#exd-body video');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: video ? video.getAttribute('src') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_facepull_detail.png') });
  ok('face pull detail video', /Face%20Pull|Face Pull/i.test(decodeURIComponent(face.src || '')) && /\.mp4/i.test(face.src), face.src.slice(0, 160));

  const bbrow = await detailMedia('Wiosłowanie sztangą');
  await page.screenshot({ path: path.join(shotDir, 'lib_barbell_row_detail.png') });
  ok('barbell row detail title', bbrow.title === 'Wiosłowanie sztangą', bbrow.title);
  ok(
    'barbell row plays verified clip',
    bbrow.hasVideo && /podci%C4%85ganie%20na%20dr%C4%85%C5%BCku%20nachwytem%20\(podci%C4%85ganie/i.test(bbrow.src),
    (bbrow.src || '').slice(0, 180)
  );

  const shrugs = await detailMedia('Unoszenie barków hantlami');
  await page.screenshot({ path: path.join(shotDir, 'lib_db_shrug_detail.png') });
  ok('db shrug detail title', shrugs.title === 'Unoszenie barków hantlami', shrugs.title);
  ok(
    'db shrug plays bent-over-row-named clip',
    shrugs.hasVideo && /Dumbbell%20Bent-Over%20Row/i.test(shrugs.src),
    (shrugs.src || '').slice(0, 180)
  );

  const pendlay = await detailMedia('Wiosłowanie Pendlay');
  ok('pendlay has no lying mp4', !pendlay.hasVideo, JSON.stringify(pendlay).slice(0, 200));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Butterfly (peck deck)';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');
  const pecCard = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Butterfly (peck deck)');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_pec_deck_card.png') });
  ok('pec deck card rendered', pecCard.found, JSON.stringify(pecCard));
  ok('pec deck card uses local gif', /butterfly-peck-deck\.gif/.test(pecCard.img) && !/\.mp4/i.test(pecCard.img), pecCard.img);
  ok('pec deck card has no video tag', !pecCard.hasVideo);

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Butterfly (peck deck)');
  });
  await page.waitForSelector('#exd-body .ex-guide[data-guide="pec-deck"]');
  const pecDetail = await page.evaluate(() => {
    const img = document.querySelector('#exd-body img.cw-technique-gif-img') || document.querySelector('#exd-body .cw-technique-gif img');
    const video = document.querySelector('#exd-body video');
    const cap = document.querySelector('#exd-body .cw-technique-cap');
    const guide = document.querySelector('#exd-body .ex-guide[data-guide="pec-deck"]');
    const phases = [...document.querySelectorAll('#exd-body .ex-guide[data-guide="pec-deck"] .ex-phase img')].map((el) => el.getAttribute('src') || '');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: img ? img.getAttribute('src') : '',
      hasVideo: !!video,
      cap: cap ? (cap.textContent || '') : '',
      hasGuide: !!guide,
      phases,
      copy: guide ? (guide.innerText || '') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_pec_deck_detail.png') });
  ok('pec deck detail title', pecDetail.title === 'Butterfly (peck deck)', pecDetail.title);
  ok('pec deck detail shows matching gif', /butterfly-peck-deck\.gif/.test(pecDetail.src), pecDetail.src);
  ok('pec deck detail has no mp4 video', !pecDetail.hasVideo);
  ok('pec deck caption is exercise name', /Butterfly \(peck deck\)/i.test(pecDetail.cap), pecDetail.cap);
  ok('pec deck guide phases', pecDetail.hasGuide && pecDetail.phases.some((s) => /phase-open/.test(s)) && pecDetail.phases.some((s) => /phase-close/.test(s)));
  ok('pec deck guide copy', /Łokcie na poziomie barków/i.test(pecDetail.copy) && /motyl/i.test(pecDetail.copy));

  async function libCard(name) {
    await page.evaluate((n) => {
      if (typeof goTo === 'function') goTo('library');
      if (typeof setExView === 'function') setExView('grid');
      const inp = document.getElementById('ex-search');
      if (inp) inp.value = n;
      if (typeof renderLib === 'function') renderLib();
    }, name);
    await page.waitForSelector('.ex-card');
    await page.waitForFunction((n) => {
      const cards = [...document.querySelectorAll('.ex-card')];
      const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === n);
      const img = hit && hit.querySelector('.ex-card-thumb img');
      return !!(img && img.complete && img.naturalWidth > 0);
    }, name);
    return page.evaluate((n) => {
      const cards = [...document.querySelectorAll('.ex-card')];
      const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === n);
      const img = hit && hit.querySelector('.ex-card-thumb img');
      const ph = hit && hit.querySelector('.ex-card-thumb-ph');
      return {
        found: !!hit,
        img: img ? img.getAttribute('src') : '',
        placeholder: !!ph,
        w: img ? img.naturalWidth : 0
      };
    }, name);
  }

  const rings = await libCard('Dipy na kółkach');
  await page.screenshot({ path: path.join(shotDir, 'lib_ring_dips_card.png') });
  ok('ring dips card rendered', rings.found, JSON.stringify(rings));
  ok('ring dips card has photo not placeholder', /Ring_Dips/.test(rings.img) && !rings.placeholder && rings.w > 0, JSON.stringify(rings));

  const hindu = await libCard('Pompki hindu');
  await page.screenshot({ path: path.join(shotDir, 'lib_hindu_pushup_card.png') });
  ok('hindu push-up card has photo', hindu.found && /free-exercise-db|githubusercontent/.test(hindu.img) && !hindu.placeholder && hindu.w > 0, JSON.stringify(hindu));

  const trxRow = await libCard('Wiosłowanie TRX');
  await page.screenshot({ path: path.join(shotDir, 'lib_trx_row_card.png') });
  ok('trx row card has photo', trxRow.found && /Inverted_Row_with_Straps/.test(trxRow.img) && !trxRow.placeholder && trxRow.w > 0, JSON.stringify(trxRow));

  const superman = await libCard('Superman');
  await page.screenshot({ path: path.join(shotDir, 'lib_superman_card.png') });
  ok('superman card has photo', superman.found && /Superman/.test(superman.img) && !superman.placeholder && superman.w > 0, JSON.stringify(superman));

  const rack = await libCard('Ciąg z racka');
  await page.screenshot({ path: path.join(shotDir, 'lib_rack_pull_card.png') });
  ok('rack pull card has photo', rack.found && /Rack_Pulls/.test(rack.img) && !rack.placeholder && rack.w > 0, JSON.stringify(rack));

  const yates = await libCard('Wiosłowanie Yatesa');
  await page.screenshot({ path: path.join(shotDir, 'lib_yates_row_card.png') });
  ok('yates row card has photo', yates.found && /Reverse_Grip_Bent-Over/.test(yates.img) && !yates.placeholder && yates.w > 0, JSON.stringify(yates));

  const airbike = await libCard('Airbike');
  await page.screenshot({ path: path.join(shotDir, 'lib_airbike_card.png') });
  ok('airbike card has photo', airbike.found && /Recumbent_Bike/.test(airbike.img) && !airbike.placeholder && airbike.w > 0, JSON.stringify(airbike));

  const clean = await libCard('Zarzut siłowy');
  await page.screenshot({ path: path.join(shotDir, 'lib_power_clean_card.png') });
  ok('power clean card has photo', clean.found && /Power_Clean/.test(clean.img) && !clean.placeholder && clean.w > 0, JSON.stringify(clean));

  const foam = await libCard('Foam roller łydki');
  await page.screenshot({ path: path.join(shotDir, 'lib_foam_calf_card.png') });
  ok('foam calf card has photo', foam.found && /Calves-SMR/.test(foam.img) && !foam.placeholder && foam.w > 0, JSON.stringify(foam));

  const seatedCurl = await libCard('Uginanie nóg siedząc');
  await page.screenshot({ path: path.join(shotDir, 'lib_seated_leg_curl_card.png') });
  ok('seated leg curl card has photo', seatedCurl.found && /Seated_Leg_Curl/.test(seatedCurl.img) && !seatedCurl.placeholder && seatedCurl.w > 0, JSON.stringify(seatedCurl));

  const seatedPress = await detailMedia('Wyciskanie hantli siedząc');
  await page.screenshot({ path: path.join(shotDir, 'lib_shoulder_seated_press_detail.png') });
  ok('seated db press detail title', seatedPress.title === 'Wyciskanie hantli siedząc', seatedPress.title);
  ok(
    'seated db press plays seated press clip',
    seatedPress.hasVideo && /Seated%20Dumbbell%20Shoulder%20Press/i.test(seatedPress.src),
    (seatedPress.src || '').slice(0, 180)
  );

  const laterals = await detailMedia('Unoszenie bokiem');
  await page.screenshot({ path: path.join(shotDir, 'lib_shoulder_lateral_detail.png') });
  ok('db lateral detail title', laterals.title === 'Unoszenie bokiem', laterals.title);
  ok(
    'db lateral plays standing lateral clip',
    laterals.hasVideo && /Dumbbell%20Lateral%20Raise/i.test(laterals.src),
    (laterals.src || '').slice(0, 180)
  );

  const cableLat = await detailMedia('Unoszenie bokiem na wyciągu jednorącz');
  await page.screenshot({ path: path.join(shotDir, 'lib_shoulder_cable_lateral_detail.png') });
  ok('cable lateral detail title', cableLat.title === 'Unoszenie bokiem na wyciągu jednorącz', cableLat.title);
  ok(
    'cable lateral plays low-pulley clip',
    cableLat.hasVideo && /Cable%20lateral%20raise%20\(low%20pulley\)/i.test(cableLat.src),
    (cableLat.src || '').slice(0, 180)
  );

  const ohp = await detailMedia('Wyciskanie żołnierskie OHP');
  ok('barbell ohp has no lying mp4', !ohp.hasVideo, JSON.stringify(ohp).slice(0, 200));
  const frontRaise = await detailMedia('Unoszenie przodem');
  ok('front raise has no lying mp4', !frontRaise.hasVideo, JSON.stringify(frontRaise).slice(0, 200));
  const arnold = await detailMedia('Wyciskanie Arnolda');
  ok('arnold has no lying mp4', !arnold.hasVideo, JSON.stringify(arnold).slice(0, 200));

  const squat = await detailMedia('Przysiad ze sztangą');
  await page.screenshot({ path: path.join(shotDir, 'lib_quad_back_squat_detail.png') });
  ok('barbell squat detail title', squat.title === 'Przysiad ze sztangą', squat.title);
  ok(
    'barbell squat plays classic clip',
    squat.hasVideo && /przysiad%20klasyczny|na%20karku/i.test(squat.src),
    (squat.src || '').slice(0, 180)
  );

  const bss = await detailMedia('Przysiad bułgarski');
  await page.screenshot({ path: path.join(shotDir, 'lib_quad_bulgarian_detail.png') });
  ok('bulgarian detail title', bss.title === 'Przysiad bułgarski', bss.title);
  ok(
    'bulgarian plays rear-foot-on-bench clip',
    bss.hasVideo && /bu%C5%82garski%20przysiad%20split|tylna%20nog%C4%85%20uniesion%C4%85/i.test(bss.src),
    (bss.src || '').slice(0, 180)
  );

  const press = await detailMedia('Wyciskanie nogami');
  await page.screenshot({ path: path.join(shotDir, 'lib_quad_leg_press_detail.png') });
  ok('leg press detail title', press.title === 'Wyciskanie nogami', press.title);
  ok(
    'leg press plays foot-alignment clip',
    press.hasVideo && /footknee|ustawienie%20st%C3%B3p/i.test(press.src),
    (press.src || '').slice(0, 180)
  );

  const dbLunge = await detailMedia('Wykrok z hantlami');
  await page.screenshot({ path: path.join(shotDir, 'lib_quad_db_lunge_detail.png') });
  ok('db lunge detail title', dbLunge.title === 'Wykrok z hantlami', dbLunge.title);
  ok(
    'db lunge plays stationary lunge clip',
    dbLunge.hasVideo && /Dumbbell%20Lunge/i.test(dbLunge.src) && !/Walking/i.test(dbLunge.src),
    (dbLunge.src || '').slice(0, 180)
  );

  const goblet = await detailMedia('Przysiad Goblet');
  ok('goblet has no lying mp4', !goblet.hasVideo, JSON.stringify(goblet).slice(0, 200));
  const frontSq = await detailMedia('Przysiad przedni');
  ok('front squat has no lying mp4', !frontSq.hasVideo, JSON.stringify(frontSq).slice(0, 200));
  const walkLunge = await detailMedia('Wykrok chodzony');
  ok('walking lunge has no lying mp4', !walkLunge.hasVideo, JSON.stringify(walkLunge).slice(0, 200));
  const smithSq = await detailMedia('Przysiad w bramie Smith');
  ok('smith squat has no lying mp4', !smithSq.hasVideo, JSON.stringify(smithSq).slice(0, 200));

  const lyingCurl = await detailMedia('Uginanie nóg leżąc');
  await page.screenshot({ path: path.join(shotDir, 'lib_ham_lying_curl_detail.png') });
  ok('lying curl detail title', lyingCurl.title === 'Uginanie nóg leżąc', lyingCurl.title);
  ok(
    'lying curl plays outer-hamstrings clip',
    lyingCurl.hasVideo && /Outer%20Hamstrings|cz%C4%99%C5%9B%C4%87%20zewn%C4%99trzna/i.test(lyingCurl.src),
    (lyingCurl.src || '').slice(0, 180)
  );

  const machineCurl = await detailMedia('Uginanie nóg maszyna');
  await page.screenshot({ path: path.join(shotDir, 'lib_ham_machine_curl_detail.png') });
  ok('machine curl detail title', machineCurl.title === 'Uginanie nóg maszyna', machineCurl.title);
  ok(
    'machine curl plays wide-stance clip',
    machineCurl.hasVideo && /wide%20stance|g%C5%82owa%20g%C5%82%C4%99boka/i.test(machineCurl.src),
    (machineCurl.src || '').slice(0, 180)
  );

  const rdl = await detailMedia('Martwy ciąg RDL');
  ok('rdl has no lying mp4', !rdl.hasVideo, JSON.stringify(rdl).slice(0, 200));
  const nordic = await detailMedia('Uginanie nordyckie');
  ok('nordic has no lying mp4', !nordic.hasVideo, JSON.stringify(nordic).slice(0, 200));
  const seatedHam = await detailMedia('Uginanie nóg siedząc');
  ok('seated curl has no lying mp4', !seatedHam.hasVideo, JSON.stringify(seatedHam).slice(0, 200));

  const gluteKick = await detailMedia('Kickback pośladki');
  await page.screenshot({ path: path.join(shotDir, 'lib_glute_cable_kickback_detail.png') });
  ok('glute kickback detail title', gluteKick.title === 'Kickback pośladki', gluteKick.title);
  ok(
    'glute kickback plays cable clip',
    gluteKick.hasVideo && /Cable%20Glute%20Kickback/i.test(gluteKick.src) && /na%20wyci/i.test(gluteKick.src),
    (gluteKick.src || '').slice(0, 180)
  );

  const hipThrust = await detailMedia('Wypychanie bioder (hip thrust)');
  await page.screenshot({ path: path.join(shotDir, 'lib_glute_hip_thrust_detail.png') });
  ok('hip thrust detail title', hipThrust.title === 'Wypychanie bioder (hip thrust)', hipThrust.title);
  ok(
    'hip thrust plays db hip thrust clip',
    hipThrust.hasVideo && /Dumbbell%20hip%20thrust/i.test(hipThrust.src),
    (hipThrust.src || '').slice(0, 180)
  );

  const abduction = await detailMedia('Abdukcja biodra maszyna');
  await page.screenshot({ path: path.join(shotDir, 'lib_glute_abduction_detail.png') });
  ok('abduction detail title', abduction.title === 'Abdukcja biodra maszyna', abduction.title);
  ok(
    'abduction plays seated machine clip',
    abduction.hasVideo && /Seated%20Hip%20Abduction/i.test(abduction.src),
    (abduction.src || '').slice(0, 180)
  );

  const bridge = await detailMedia('Mostek biodrowy');
  ok('glute bridge has no plank mp4', !bridge.hasVideo, JSON.stringify(bridge).slice(0, 200));
  const machineKick = await detailMedia('Kickback na maszynie');
  ok('machine kickback has no cable mp4', !machineKick.hasVideo, JSON.stringify(machineKick).slice(0, 200));
  const adduction = await detailMedia('Przywodzenie biodra maszyna');
  ok('adduction has no extension mp4', !adduction.hasVideo, JSON.stringify(adduction).slice(0, 200));
  const sideLie = await detailMedia('Odwodzenie biodra leżąc');
  ok('side-lying abduction has no rdl mp4', !sideLie.hasVideo, JSON.stringify(sideLie).slice(0, 200));
  const donkey = await detailMedia('Donkey kick');
  ok('donkey kick has no crunch mp4', !donkey.hasVideo, JSON.stringify(donkey).slice(0, 200));

  const gluteCard = await libCard('Kickback pośladki');
  await page.screenshot({ path: path.join(shotDir, 'lib_glute_kickback_card.png') });
  ok(
    'glute kickback card uses still photo',
    gluteCard.found && /free-exercise-db|githubusercontent/.test(gluteCard.img) && !/\.mp4/i.test(gluteCard.img) && gluteCard.w > 0,
    JSON.stringify(gluteCard)
  );

  const barPush = await detailMedia('Prostowanie tricepsa wyciąg');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_bar_pushdown_detail.png') });
  ok('bar pushdown detail title', barPush.title === 'Prostowanie tricepsa wyciąg', barPush.title);
  ok(
    'bar pushdown plays straight-bar (2) clip',
    barPush.hasVideo && /\(Cable%20Triceps%20Pushdown\)%20\(2\)\.mp4/i.test(barPush.src),
    (barPush.src || '').slice(0, 180)
  );

  const ropePush = await detailMedia('Prostowanie linką');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_rope_pushdown_detail.png') });
  ok('rope pushdown detail title', ropePush.title === 'Prostowanie linką', ropePush.title);
  ok(
    'rope pushdown plays rope-attachment clip',
    ropePush.hasVideo && /with%20Rope%20Attachment/i.test(ropePush.src),
    (ropePush.src || '').slice(0, 180)
  );

  const dbOh = await detailMedia('Prostowanie za głowę hantlem');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_db_oh_detail.png') });
  ok('standing db oh detail title', dbOh.title === 'Prostowanie za głowę hantlem', dbOh.title);
  ok(
    'standing db oh plays two-db clip',
    dbOh.hasVideo && /Dumbbell%20Overhead%20Triceps%20Extension/i.test(dbOh.src) && !/Seated/i.test(dbOh.src),
    (dbOh.src || '').slice(0, 180)
  );

  const skull = await detailMedia('Prostowanie za głowę (skull crusher)');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_skull_detail.png') });
  ok('skull crusher detail title', skull.title === 'Prostowanie za głowę (skull crusher)', skull.title);
  ok(
    'skull crusher plays verified lying-bar clip',
    skull.hasVideo && /Seated%20Dumbbell%20Overhead%20Tricep%20Extension/i.test(skull.src),
    (skull.src || '').slice(0, 180)
  );

  const benchDip = await detailMedia('Dipy na ławce');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_bench_dip_detail.png') });
  ok('bench dip detail title', benchDip.title === 'Dipy na ławce', benchDip.title);
  ok(
    'bench dip plays honest bench dips clip',
    benchDip.hasVideo && /Bench%20Dips/i.test(benchDip.src) && !/Bench%20Dip\)\.mp4/i.test(benchDip.src),
    (benchDip.src || '').slice(0, 180)
  );

  const oneArm = await detailMedia('Prostowanie jednorącz wyciąg');
  ok('one-arm pushdown has no lateral-raise mp4', !oneArm.hasVideo, JSON.stringify(oneArm).slice(0, 200));
  const cableKb = await detailMedia('Kickback na wyciągu');
  ok('cable tricep kickback has no mix mp4', !cableKb.hasVideo, JSON.stringify(cableKb).slice(0, 200));
  const dbKb = await detailMedia('Kickback triceps');
  ok('db kickback has no cable mp4', !dbKb.hasVideo, JSON.stringify(dbKb).slice(0, 200));
  const french = await detailMedia('Wyciskanie francuskie');
  ok('french press has no mp4', !french.hasVideo, JSON.stringify(french).slice(0, 200));

  const hammer = await detailMedia('Uginanie młotkowe');
  await page.screenshot({ path: path.join(shotDir, 'lib_bi_hammer_detail.png') });
  ok('hammer detail title', hammer.title === 'Uginanie młotkowe', hammer.title);
  ok(
    'hammer plays db-curl-named clip',
    hammer.hasVideo && /Dumbbell%20Bicep%20Curl/i.test(hammer.src) && /z%20hantlami|hantlami/i.test(hammer.src),
    (hammer.src || '').slice(0, 180)
  );

  const dbCurl = await detailMedia('Uginanie hantlami naprzemiennie');
  await page.screenshot({ path: path.join(shotDir, 'lib_bi_db_curl_detail.png') });
  ok('db curl detail title', dbCurl.title === 'Uginanie hantlami naprzemiennie', dbCurl.title);
  ok(
    'db curl plays hammer-named clip',
    dbCurl.hasVideo && /Dumbbell%20Hammer%20Curl/i.test(dbCurl.src),
    (dbCurl.src || '').slice(0, 180)
  );

  const conc = await detailMedia('Uginanie koncentryczne');
  await page.screenshot({ path: path.join(shotDir, 'lib_bi_concentration_detail.png') });
  ok('concentration detail title', conc.title === 'Uginanie koncentryczne', conc.title);
  ok(
    'concentration plays knee-braced clip',
    conc.hasVideo && /kolano/i.test(conc.src),
    (conc.src || '').slice(0, 180)
  );

  const rev = await detailMedia('Uginanie reverse');
  await page.screenshot({ path: path.join(shotDir, 'lib_bi_reverse_detail.png') });
  ok('reverse curl detail title', rev.title === 'Uginanie reverse', rev.title);
  ok(
    'reverse curl plays nachwytem clip',
    rev.hasVideo && /Barbell%20Reverse%20Curl/i.test(rev.src),
    (rev.src || '').slice(0, 180)
  );

  const rollout = await detailMedia('Rollout z kółkiem');
  await page.screenshot({ path: path.join(shotDir, 'lib_core_rollout_detail.png') });
  ok('rollout detail title', rollout.title === 'Rollout z kółkiem', rollout.title);
  ok(
    'rollout plays kneeling ab-wheel clip',
    rollout.hasVideo && /Kneeling%20Ab%20Wheel%20Rollout/i.test(rollout.src) && /z%20kolan|kolan/i.test(rollout.src),
    (rollout.src || '').slice(0, 180)
  );
  const plank = await detailMedia('Deska');
  ok('plank has no lying mp4', !plank.hasVideo, JSON.stringify(plank).slice(0, 200));
  const bicycle = await detailMedia('Brzuszki rowerowe');
  ok('bicycle crunch has no mix mp4', !bicycle.hasVideo, JSON.stringify(bicycle).slice(0, 200));
  const russian = await detailMedia('Skręty rosyjskie');
  ok('russian twist has no mix mp4', !russian.hasVideo, JSON.stringify(russian).slice(0, 200));
  const scissors = await detailMedia('Nożyce');
  ok('scissors have no mix mp4', !scissors.hasVideo, JSON.stringify(scissors).slice(0, 200));
  const legRaise = await detailMedia('Unoszenie nóg leżąc');
  ok('lying leg raise has no mix mp4', !legRaise.hasVideo, JSON.stringify(legRaise).slice(0, 200));

  const bbCurl = await detailMedia('Uginanie biceps sztangą');
  ok('barbell curl has no lying mp4', !bbCurl.hasVideo, JSON.stringify(bbCurl).slice(0, 200));
  const preacher = await detailMedia('Uginanie na modlitewniku');
  ok('preacher has no lying mp4', !preacher.hasVideo, JSON.stringify(preacher).slice(0, 200));
  const inclineCurl = await detailMedia('Uginanie na skosie');
  ok('incline curl has no lying mp4', !inclineCurl.hasVideo, JSON.stringify(inclineCurl).slice(0, 200));
  const cableCurl = await detailMedia('Uginanie na wyciągu');
  ok('cable curl has no mix mp4', !cableCurl.hasVideo, JSON.stringify(cableCurl).slice(0, 200));

  const hammerCard = await libCard('Uginanie młotkowe');
  await page.screenshot({ path: path.join(shotDir, 'lib_bi_hammer_card.png') });
  ok(
    'hammer card uses still photo',
    hammerCard.found && /free-exercise-db|githubusercontent/.test(hammerCard.img) && !/\.mp4/i.test(hammerCard.img) && hammerCard.w > 0,
    JSON.stringify(hammerCard)
  );

  const triCard = await libCard('Prostowanie tricepsa wyciąg');
  await page.screenshot({ path: path.join(shotDir, 'lib_tri_pushdown_card.png') });
  ok(
    'bar pushdown card uses still photo',
    triCard.found && /free-exercise-db|githubusercontent/.test(triCard.img) && !/\.mp4/i.test(triCard.img) && triCard.w > 0,
    JSON.stringify(triCard)
  );

  const shoulderCard = await libCard('Unoszenie bokiem');
  await page.screenshot({ path: path.join(shotDir, 'lib_shoulder_lateral_card.png') });
  ok(
    'db lateral card uses still photo',
    shoulderCard.found && /free-exercise-db|githubusercontent/.test(shoulderCard.img) && !/\.mp4/i.test(shoulderCard.img) && shoulderCard.w > 0,
    JSON.stringify(shoulderCard)
  );

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-row [data-f="name"]');
  await page.fill('.ex-row [data-f="name"]', 'Pompki');
  await page.waitForTimeout(400);
  const builder = await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    const thumb = row && row.querySelector('.builder-ex-thumb');
    const video = thumb && thumb.querySelector('video');
    return {
      hidden: !!(thumb && thumb.hidden),
      src: video ? video.getAttribute('src') : '',
      hasVideo: !!video
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_pompki_video.png') });
  ok('builder pompki shows technique video', builder.hasVideo && !builder.hidden && /Push-up/i.test(decodeURIComponent(builder.src || '')), JSON.stringify(builder).slice(0, 220));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll lib-ex-video UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
