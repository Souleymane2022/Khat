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
  const { FIGURES, HOUSES, VERDICT_LEVELS, QUALITY_PHRASES, SPECIAL_READINGS, FIGURE_GUIDANCE, SPEED_TEXT } = data;

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
  function verdict(takht, questionHouse, questionTypeId) {
    const houseFig = takht.houses[questionHouse - 1];
    const jq = effectiveJudgeQuality(takht);
    const w1 = takht.witnesses[0];
    const w2 = takht.witnesses[1];

    /* عناصر الحكم بأوزانها — تُعرض للمستخدم حتى يتعلم من أين جاءت النسبة */
    const factors = [
      { label: 'الميزان (القاضي)',        fig: takht.judge,      weight: 3,   quality: jq },
      { label: 'بيت السؤال',              fig: houseFig,         weight: 2,   quality: houseFig.quality },
      { label: 'الشاهد الأيمن (أول الأمر)', fig: w1,              weight: 1.5, quality: w1.quality },
      { label: 'الشاهد الأيسر (آخر الأمر)', fig: w2,              weight: 1.5, quality: w2.quality },
      { label: 'العاقبة',                 fig: takht.reconciler, weight: 1,   quality: takht.reconciler.quality },
      { label: 'الأم الأولى (حال السائل)', fig: takht.mothers[0], weight: 0.5, quality: takht.mothers[0].quality },
    ].map((f) => ({ ...f, contribution: f.weight * f.quality }));

    const raw = factors.reduce((s, f) => s + f.contribution, 0);
    const MAX = factors.reduce((s, f) => s + f.weight * 2, 0); // = 19
    let score = Math.round((raw / MAX) * 100);
    score = Math.max(-100, Math.min(100, score));

    /* قوة الدليل: اتفاق الشواهد أو تعارضها */
    const signs = factors.filter((f) => f.contribution !== 0).map((f) => Math.sign(f.contribution));
    const pos = signs.filter((s) => s > 0).length;
    const neg = signs.filter((s) => s < 0).length;
    let evidence;
    if (signs.length === 0) evidence = { key: 'neutral', text: 'الشواهد كلها ممتزجة ساكنة — لا يقطع الخط هنا بشيء' };
    else if (pos === 0 || neg === 0) evidence = { key: 'strong', text: 'دليل متفق قوي — الشواهد كلها في اتجاه واحد' };
    else if (Math.abs(pos - neg) >= 2) evidence = { key: 'leaning', text: 'دليل راجح — أكثر الشواهد في اتجاه الحكم مع معارضة يسيرة' };
    else evidence = { key: 'mixed', text: 'دليل مضطرب — الشواهد متعارضة، فخذ الحكم على التقريب لا القطع' };

    const level = VERDICT_LEVELS.find((l) => score >= l.min) || VERDICT_LEVELS[VERDICT_LEVELS.length - 1];

    /* الحكم الخاص: دلالة شكل الميزان في باب هذا السؤال تحديداً */
    const special =
      (questionTypeId && SPECIAL_READINGS[takht.judge.id] &&
        SPECIAL_READINGS[takht.judge.id][questionTypeId]) || null;

    const houseInfo = HOUSES[questionHouse - 1];
    const details = {
      special,
      beginning: `أول الأمر وباطنه (الشاهد الأيمن): «${w1.name}» — ${QUALITY_PHRASES[String(w1.quality)]}.`,
      ending: `آخر الأمر وظاهره (الشاهد الأيسر): «${w2.name}» — ${QUALITY_PHRASES[String(w2.quality)]}.`,
      judge: `الميزان (القاضي): «${takht.judge.name}» — ${takht.judge.asJudge}`,
      outcome: `العاقبة: «${takht.reconciler.name}» — ${QUALITY_PHRASES[String(takht.reconciler.quality)]}.`,
      questionHouse: `${houseInfo.name} (موضع سؤالك: ${houseInfo.topic}): وقع فيه «${houseFig.name}» وهو ${QUALITY_PHRASES[String(houseFig.quality)]}.`,
      advice: takht.judge.advice,
    };

    /* نسبة صلاح الأمر: من صفر إلى مئة */
    const favorability = Math.round((score + 100) / 2);

    /* الدلائل الدقيقة: الجهة والمكان من شكل بيت السؤال (موضع المطلوب)،
       والزمن واليوم من الميزان (زمن الحكم) */
    const hg = FIGURE_GUIDANCE[houseFig.id];
    const jg = FIGURE_GUIDANCE[takht.judge.id];
    const guidance = {
      direction: 'جهة المطلوب: ' + hg.direction + ' — من طبع «' + houseFig.name + '» (' + houseFig.element + ').',
      place: 'مظنّة المكان: ' + hg.place + '.',
      timing: 'زمن الوقوع: ' + SPEED_TEXT[jg.speed].label + ' — ' + SPEED_TEXT[jg.speed].detail + '.',
      day: 'اليوم الأوفق للسعي: ' + jg.day + ' (يوم ' + takht.judge.planet + '، كوكب الميزان).',
    };

    return { score, favorability, level, details, houseFig, factors, evidence, guidance };
  }

  return { figureFromRows, addFigures, buildTakht, verdict, effectiveJudgeQuality };
});
