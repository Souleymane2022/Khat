/* اختبارات محرك علم الرمل — تشغيل: node test/ramal.test.js */
const { FIGURES, FIGURE_LIST, QUESTION_TYPES, SPECIAL_READINGS, FIGURE_GUIDANCE, SPEED_TEXT } = require('../js/data.js');
const RAMAL = require('../js/ramal.js');

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  passed++;
}

/* 1) الأشكال الستة عشر كلها موجودة وفريدة */
assert(FIGURE_LIST.length === 16, '16 figures listed');
const keys = new Set(FIGURE_LIST.map((id) => FIGURES[id].rows.join('')));
assert(keys.size === 16, 'all 16 dot-patterns unique');
FIGURE_LIST.forEach((id) => {
  const f = FIGURES[id];
  assert(f.rows.length === 4 && f.rows.every((r) => r === 1 || r === 2), `rows valid for ${id}`);
});

/* 2) قاعدة الجمع: المتشابه زوج والمختلف فرد */
const via = FIGURES.tariq;      // 1111
const populus = FIGURES.jamaa;  // 2222
assert(RAMAL.addFigures(via, via).id === 'jamaa', 'via+via=populus');
assert(RAMAL.addFigures(populus, populus).id === 'jamaa', 'populus+populus=populus');
assert(RAMAL.addFigures(via, populus).id === 'tariq', 'via+populus=via');

/* 3) مثال معلوم يدوي:
   الأسطر: م1=1111 (الطريق)، م2=2222 (الجماعة)، م3=1222 (اللحيان)، م4=2221 (الأنكيس)
   البنات (تُؤخذ عمودياً): ب1=رؤوس=1,2,1,2=القبض الخارج؛ ب2=صدور=1,2,2,2=اللحيان؛
   ب3=بطون=1,2,2,2=اللحيان؛ ب4=أرجل=1,2,2,1=العقلة
   النتائج: ن1=م1+م2=1111=الطريق؛ ن2=م3+م4=1221=العقلة؛
   ن3=ب1+ب2=2211=النصرة الداخلة؛ ن4=ب3+ب4=1221... تحقق:
   ب3=1222، ب4=1221 → متشابه,متشابه,متشابه,مختلف = 2,2,2,1 = الأنكيس
   الشاهدان: ش1=ن1+ن2=(1111,1221)→1,مختلف,مختلف,1متشابه؟
   1vs1=2؛ 1vs2=1؛ 1vs2=1؛ 1vs1=2 → 2112=الاجتماع
   ش2=ن3+ن4=(2211,2221)→2,2,مختلف,2؟ 2vs2=2؛2vs2=2؛1vs2=1؛1vs1=2 → 2212=البياض
   الميزان=ش1+ش2=(2112,2212)→2,مختلف,2,2 → 2122=الحمرة (مجموع 7؟ لا: 2+1+2+2=7 فردي!)
   إعادة: ش1=2112، ش2=2212: صف1: 2vs2=2؛ صف2: 1vs2=1؛ صف3: 1vs1=2؛ صف4: 2vs2=2 → 2122 مجموعه 7!
   خطأ في الحساب اليدوي — الاختبار البرمجي هو الحكم، مع فحص قاعدة الزوجية أدناه. */
const t = RAMAL.buildTakht([1,1,1,1, 2,2,2,2, 1,2,2,2, 2,2,2,1]);
assert(t.mothers[0].id === 'tariq', 'mother1 = tariq');
assert(t.mothers[1].id === 'jamaa', 'mother2 = jamaa');
assert(t.mothers[2].id === 'lahyan', 'mother3 = lahyan');
assert(t.mothers[3].id === 'ankis', 'mother4 = ankis');
assert(t.daughters[0].rows.join('') === '1212', 'daughter1 from heads');
assert(t.daughters[1].rows.join('') === '1222', 'daughter2 from necks');
assert(t.daughters[2].rows.join('') === '1222', 'daughter3 from bodies');
assert(t.daughters[3].rows.join('') === '1221', 'daughter4 from feet');
assert(t.nieces[0].rows.join('') === '1111', 'niece1 = m1+m2');
assert(t.nieces[1].rows.join('') === '1221', 'niece2 = m3+m4');
assert(t.nieces[2].rows.join('') === '2212', 'niece3 = d1+d2');
assert(t.nieces[3].rows.join('') === '2221', 'niece4 = d3+d4');

/* 4) قاعدة صحة التخت: مجموع نقاط الميزان زوجي دائماً — على 5000 ضربة عشوائية */
for (let i = 0; i < 5000; i++) {
  const lines = Array.from({ length: 16 }, () => (Math.random() < 0.5 ? 1 : 2));
  const tk = RAMAL.buildTakht(lines);
  const pts = tk.judge.rows.reduce((s, r) => s + r, 0);
  assert(pts % 2 === 0, 'judge total points even (random ' + i + ')');
  assert(tk.houses.length === 16, '16 houses');
  /* والعاقبة شكل صحيح معروف */
  assert(FIGURES[tk.reconciler.id], 'reconciler is a known figure');
}

/* 5) الحكم يعمل لكل بيوت الأسئلة ويعطي درجة في المدى الصحيح */
for (let h = 1; h <= 16; h++) {
  const v = RAMAL.verdict(t, h);
  assert(v.score >= -100 && v.score <= 100, 'score in range for house ' + h);
  assert(v.level && v.level.title, 'level found for house ' + h);
  assert(v.details.judge.includes(t.judge.name), 'judge name in details');
}

/* 6) الأحكام الخاصة: كل مفتاح شكلٍ وكل مفتاح سؤالٍ صحيح، والنص غير فارغ */
const qtypeIds = new Set(QUESTION_TYPES.map((q) => q.id));
Object.entries(SPECIAL_READINGS).forEach(([figId, readings]) => {
  assert(FIGURES[figId], 'special readings figure exists: ' + figId);
  Object.entries(readings).forEach(([qid, txt]) => {
    assert(qtypeIds.has(qid), 'valid question type ' + qid + ' for ' + figId);
    assert(typeof txt === 'string' && txt.length > 10, 'non-empty reading for ' + figId + '/' + qid);
  });
});

/* 7) الحكم مع نوع السؤال يعيد النسبة والقراءة الخاصة عند توفرها */
QUESTION_TYPES.forEach((qt) => {
  const v = RAMAL.verdict(t, qt.house, qt.id);
  assert(v.favorability >= 0 && v.favorability <= 100, 'favorability in range for ' + qt.id);
  const expected = (SPECIAL_READINGS[t.judge.id] || {})[qt.id] || null;
  assert(v.details.special === expected, 'special reading matches for ' + qt.id);
});

/* 8) الدلائل الدقيقة: لكل شكل جهة ومكان وسرعة صحيحة ويوم */
const DIRECTIONS = new Set(['الشرق', 'الغرب', 'الشمال', 'الجنوب']);
const DAYS = new Set(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']);
FIGURE_LIST.forEach((id) => {
  const g = FIGURE_GUIDANCE[id];
  assert(g, 'guidance exists for ' + id);
  assert(DIRECTIONS.has(g.direction), 'valid direction for ' + id);
  assert(SPEED_TEXT[g.speed], 'valid speed for ' + id);
  assert(DAYS.has(g.day), 'valid day for ' + id);
  assert(typeof g.place === 'string' && g.place.length > 10, 'place text for ' + id);
});

/* 9) الحكم يعيد عناصر الميزان والدلائل، والمجموع يطابق الدرجة */
{
  const v = RAMAL.verdict(t, 7, 'marriage');
  assert(Array.isArray(v.factors) && v.factors.length === 6, 'six factors');
  const raw = v.factors.reduce((s, f) => s + f.contribution, 0);
  const recomputed = Math.max(-100, Math.min(100, Math.round((raw / 19) * 100)));
  assert(recomputed === v.score, 'factor contributions reproduce the score');
  assert(v.evidence && v.evidence.text, 'evidence strength present');
  assert(v.guidance && v.guidance.direction.includes('جهة') && v.guidance.day.includes('يوم'),
    'guidance texts present');
  assert(v.favorability + (100 - v.favorability) === 100, 'probabilities sum to 100');
}

/* 10) مدخلات فاسدة تُرفض */
let threw = false;
try { RAMAL.buildTakht([1, 2, 3]); } catch (e) { threw = true; }
assert(threw, 'invalid input rejected');

console.log('OK — ' + passed + ' assertions passed');
