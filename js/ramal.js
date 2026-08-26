/* =====================================================================
   محرك حساب علم الرمل — توليد تخت الرمل بالقواعد التقليدية
   المدخل: ستة عشر سطراً من الخط، كل سطر إما فرد (1) أو زوج (2)
   المخرج: الأمهات ← البنات ← النتائج ← الشاهدان ← الميزان ← العاقبة
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== 'undefined') {
    const data = require('./data.js');
    module.exports = factory(data);
  } else {
    root.RAMAL = factory(root.RAMAL_DATA);
  }
})(typeof self !== 'undefined' ? self : this, function (data) {
  const { FIGURES, HOUSES, VERDICT_LEVELS, QUALITY_PHRASES } = data;

  /* البحث عن الشكل من صفوفه */
  const BY_KEY = {};
  Object.values(FIGURES).forEach((f) => { BY_KEY[f.rows.join('')] = f; });

  function figureFromRows(rows) {
    const f = BY_KEY[rows.join('')];
    if (!f) throw new Error('شكل غير معروف: ' + rows.join(''));
    return f;
  }

  /* جمع شكلين: فرد+فرد=زوج، زوج+زوج=زوج... القاعدة: المتشابه زوج والمختلف فرد */
  function addFigures(a, b) {
    return figureFromRows(a.rows.map((r, i) => (r === b.rows[i] ? 2 : 1)));
  }

  /*
   * بناء التخت من ١٦ سطراً (قيم 1=فرد أو 2=زوج)
   * الأسطر الأربعة الأولى = الأم الأولى (رأسها أول سطر) وهكذا.
   */
  function buildTakht(lines) {
    if (!Array.isArray(lines) || lines.length !== 16 || lines.some((v) => v !== 1 && v !== 2)) {
      throw new Error('يلزم ستة عشر سطراً، كل سطر فرد (1) أو زوج (2)');
    }

    const mothers = [];
    for (let i = 0; i < 4; i++) {
      mothers.push(figureFromRows(lines.slice(i * 4, i * 4 + 4)));
    }

    /* البنات: رؤوس الأمهات تكوّن البنت الأولى، صدورها الثانية... */
    const daughters = [];
    for (let r = 0; r < 4; r++) {
      daughters.push(figureFromRows(mothers.map((m) => m.rows[r])));
    }

    /* النتائج (بنات البنات) */
    const nieces = [
      addFigures(mothers[0], mothers[1]),
      addFigures(mothers[2], mothers[3]),
      addFigures(daughters[0], daughters[1]),
      addFigures(daughters[2], daughters[3]),
    ];

    /* الشاهدان */
    const witnesses = [
      addFigures(nieces[0], nieces[1]),  // الشاهد الأيمن
      addFigures(nieces[2], nieces[3]),  // الشاهد الأيسر
    ];

    /* الميزان (القاضي) — مجموع نقاطه زوجي دائماً وإلا فالحساب فاسد */
    const judge = addFigures(witnesses[0], witnesses[1]);
    const judgePoints = judge.rows.reduce((s, r) => s + r, 0);
    if (judgePoints % 2 !== 0) throw new Error('خلل في الحساب: الميزان لا يكون فرداً أبداً');

    /* العاقبة: الميزان مع الأم الأولى */
    const reconciler = addFigures(judge, mothers[0]);

    const houses = [...mothers, ...daughters, ...nieces, ...witnesses, judge, reconciler];
    return { mothers, daughters, nieces, witnesses, judge, reconciler, houses };
  }

  /* جودة الميزان: الجماعة والاجتماع يتبعان ما جاورهما (الشاهدين) */
  function effectiveJudgeQuality(takht) {
    const j = takht.judge;
    if (j.quality === 0) {
      return (takht.witnesses[0].quality + takht.witnesses[1].quality) / 2;
    }
    return j.quality;
  }

  /*
   * الحكم النهائي: يجمع الميزان (الوزن الأكبر) والشاهدين والعاقبة
   * وشكل بيت السؤال والأم الأولى (حال السائل).
   */
  function verdict(takht, questionHouse) {
    const houseFig = takht.houses[questionHouse - 1];
    const jq = effectiveJudgeQuality(takht);
    const w1 = takht.witnesses[0];
    const w2 = takht.witnesses[1];

    const raw =
      3 * jq +
      1.5 * (w1.quality + w2.quality) +
      1 * takht.reconciler.quality +
      2 * houseFig.quality +
      0.5 * takht.mothers[0].quality;

    const MAX = 3 * 2 + 1.5 * 4 + 1 * 2 + 2 * 2 + 0.5 * 2; // = 19
    let score = Math.round((raw / MAX) * 100);
    score = Math.max(-100, Math.min(100, score));

    const level = VERDICT_LEVELS.find((l) => score >= l.min) || VERDICT_LEVELS[VERDICT_LEVELS.length - 1];

    const houseInfo = HOUSES[questionHouse - 1];
    const details = {
      beginning: `أول الأمر وباطنه (الشاهد الأيمن): «${w1.name}» — ${QUALITY_PHRASES[String(w1.quality)]}.`,
      ending: `آخر الأمر وظاهره (الشاهد الأيسر): «${w2.name}» — ${QUALITY_PHRASES[String(w2.quality)]}.`,
      judge: `الميزان (القاضي): «${takht.judge.name}» — ${takht.judge.asJudge}`,
      outcome: `العاقبة: «${takht.reconciler.name}» — ${QUALITY_PHRASES[String(takht.reconciler.quality)]}.`,
      questionHouse: `${houseInfo.name} (موضع سؤالك: ${houseInfo.topic}): وقع فيه «${houseFig.name}» وهو ${QUALITY_PHRASES[String(houseFig.quality)]}.`,
      advice: takht.judge.advice,
    };

    return { score, level, details, houseFig };
  }

  return { figureFromRows, addFigures, buildTakht, verdict, effectiveJudgeQuality };
});
