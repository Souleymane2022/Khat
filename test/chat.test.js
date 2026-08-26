/* اختبارات دقة محادثة الخط — تشغيل: node test/chat.test.js */
const { QUESTION_TYPES, FIGURE_GUIDANCE, FIGURE_PERSON, SPEED_TEXT } = require('../js/data.js');
const RAMAL = require('../js/ramal.js');
const CHAT = require('../js/chat.js');

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  passed++;
}

/* 1) دقة فهم الأسئلة: عينة واسعة بالفصحى واللهجات — مطلوب فهمها كلها */
const CASES = [
  /* الحكم */
  ['هل يتم زواجي؟', 'verdict'],
  ['هل أسافر هذه السنة', 'verdict'],
  ['أمري يصلح ولا لا', 'verdict'],
  ['هل ينجح مشروعي', 'verdict'],
  ['زين ولا شين', 'verdict'],
  ['هل الأمر في صالحي', 'verdict'],
  ['حظي كيف', 'verdict'],
  /* الزمن */
  ['متى يقع الأمر؟', 'timing'],
  ['امتى يرجع', 'timing'],
  ['كم يوم يحتاج', 'timing'],
  ['هل يتأخر الأمر', 'timing'],
  ['بعد كم شهر', 'timing'],
  ['ما هو التوقيت المناسب', 'timing'],
  /* المكان */
  ['أين أجد الضائع؟', 'location'],
  ['وين ألقاه', 'location'],
  ['فين المكان', 'location'],
  ['في أي جهة أبحث', 'location'],
  ['ناحية وين أدور', 'location'],
  /* الشخص */
  ['من هو الشخص؟', 'person'],
  ['ما صفته', 'person'],
  ['كيف شكله', 'person'],
  ['وصفه لي', 'person'],
  ['ما طبعه', 'person'],
  /* النسبة */
  ['كم النسبة؟', 'probability'],
  ['ما احتمال النجاح', 'probability'],
  ['كم بالمئة', 'probability'],
  ['هل هو مضمون', 'probability'],
  ['ما الفرصة', 'probability'],
  /* السبب */
  ['لماذا حكمت بهذا؟', 'why'],
  ['ليش قلت كذا', 'why'],
  ['ما السبب', 'why'],
  ['من أين عرفت', 'why'],
  ['على أي أساس', 'why'],
  /* النصيحة */
  ['ماذا أفعل؟', 'advice'],
  ['شنو اسوي', 'advice'],
  ['تنصحني بماذا', 'advice'],
  ['كيف أتصرف', 'advice'],
  ['ما هو الحل', 'advice'],
  /* تحية */
  ['السلام عليكم', 'greeting'],
  ['مرحبا', 'greeting'],
];
CASES.forEach(([q, expected]) => {
  const got = CHAT.detectIntent(q);
  assert(got === expected, `intent «${q}» → expected ${expected}, got ${got}`);
});
console.log('intent accuracy: ' + CASES.length + '/' + CASES.length);

/* 2) الأجوبة مشتقة من التخت الصحيح — نفحصها على خطة معلومة */
const t = RAMAL.buildTakht([1,1,1,1, 2,2,2,2, 1,2,2,2, 2,2,2,1]);
const qt = QUESTION_TYPES.find((x) => x.id === 'lost');
const v = RAMAL.verdict(t, qt.house, qt.id);
const ctx = { takht: t, verdict: v, questionType: qt };

const AR = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n) => String(n).replace(/[0-9]/g, (d) => AR[+d]);

{
  const a = CHAT.answer('location', ctx);
  const hg = FIGURE_GUIDANCE[v.houseFig.id];
  assert(a.includes(hg.direction), 'location answer names the correct direction');
  assert(a.includes(hg.place.slice(0, 12)), 'location answer names the correct place');
}
{
  const a = CHAT.answer('timing', ctx);
  const jg = FIGURE_GUIDANCE[t.judge.id];
  assert(a.includes(jg.day), 'timing answer names the judge planetary day');
  assert(a.includes(SPEED_TEXT[jg.speed].label), 'timing answer names the correct speed');
}
{
  const a = CHAT.answer('probability', ctx);
  assert(a.includes(arNum(v.favorability)), 'probability answer states the exact favorability');
  assert(a.includes(arNum(100 - v.favorability)), 'probability answer states the complement');
}
{
  const a = CHAT.answer('person', ctx);
  assert(a.includes(FIGURE_PERSON[v.houseFig.id].slice(0, 15)), 'person answer from house figure');
}
{
  const a = CHAT.answer('why', ctx);
  assert(a.includes(t.judge.name), 'why answer names the ruling figure');
}
{
  const a = CHAT.answer('verdict', ctx);
  assert(a.length > 30, 'verdict answer is substantive');
}
{
  const a = CHAT.answer('unknown', ctx);
  assert(a.includes('هل يتم'), 'unknown intent lists example questions');
}

/* 3) الأجوبة حتمية: نفس السؤال على نفس الخطة = نفس الجواب دائماً */
for (const intent of ['verdict', 'timing', 'location', 'person', 'probability', 'why', 'advice']) {
  assert(CHAT.answer(intent, ctx) === CHAT.answer(intent, ctx), 'deterministic answer for ' + intent);
}

/* 4) كل نية لها جواب غير فارغ على 500 خطة عشوائية — لا انهيار أبداً */
const intents = ['greeting', 'verdict', 'timing', 'location', 'person', 'probability', 'why', 'advice', 'unknown'];
for (let i = 0; i < 500; i++) {
  const lines = Array.from({ length: 16 }, () => (Math.random() < 0.5 ? 1 : 2));
  const tk = RAMAL.buildTakht(lines);
  const qtype = QUESTION_TYPES[i % QUESTION_TYPES.length];
  const vd = RAMAL.verdict(tk, qtype.house, qtype.id);
  const c = { takht: tk, verdict: vd, questionType: qtype };
  intents.forEach((intent) => {
    const a = CHAT.answer(intent, c);
    assert(typeof a === 'string' && a.length > 20, `answer for ${intent} on random ${i}`);
  });
  assert(CHAT.khatName(tk).startsWith('خطّ '), 'khat name valid');
}

console.log('OK — ' + passed + ' assertions passed');
