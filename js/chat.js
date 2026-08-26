/* =====================================================================
   محادثة الخط: يسأل السائل بلغته العادية ويجيبه خطُّه بكلام بسيط
   كل جواب مشتق من التخت المحسوب نفسه — لا تخمين ولا عشوائية
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== 'undefined') {
    const data = require('./data.js');
    module.exports = factory(data);
  } else {
    root.RAMAL_CHAT = factory(root.RAMAL_DATA);
  }
})(typeof self !== 'undefined' ? self : this, function (data) {
  const { SPEED_TEXT, FIGURE_GUIDANCE, FIGURE_PERSON, QUESTION_TYPES } = data;

  /* تطبيع النص العربي: إزالة التشكيل وتوحيد الألف والياء والتاء */
  function normalize(text) {
    return String(text || '')
      .replace(/[ً-ْٰ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* النوايا مرتبة بالأولوية: الأخص أولاً — كلماتها مطبَّعة */
  const INTENTS = [
    {
      id: 'greeting',
      words: ['سلام عليكم', 'السلام', 'مرحبا', 'اهلا', 'هلا', 'صباح الخير', 'مساء الخير', 'تحيه'],
    },
    {
      id: 'person',
      words: ['من هو', 'من هي', 'صفته', 'صفتها', 'صفه الشخص', 'شكله', 'ملامح', 'لونه', 'طبعه',
              'الشخص الذي', 'مين هو', 'منو', 'ياتو شخص', 'وصفه', 'كيف شكله'],
    },
    {
      id: 'timing',
      words: ['متي', 'امتي', 'كم يوم', 'كم اسبوع', 'كم شهر', 'الوقت', 'الزمن', 'قريب ولا',
              'يتاخر', 'التوقيت', 'وقتها', 'بعد كم', 'مده', 'يطول'],
    },
    {
      id: 'location',
      words: ['اين', 'وين', 'فين', 'مكان', 'جهه', 'اتجاه', 'القاه', 'اجده', 'الاقيه',
              'ابحث', 'ادور', 'ناحيه', 'يمين ولا شمال', 'المكان'],
    },
    {
      id: 'probability',
      words: ['نسبه', 'احتمال', 'بالمئه', 'بالميه', 'كم في المئه', 'فرصه', 'كم النسبه', 'مضمون'],
    },
    {
      id: 'why',
      words: ['لماذا', 'ليه', 'ليش', 'السبب', 'كيف حكمت', 'من اين عرفت', 'كيف عرفت', 'علي اي اساس', 'شنو السبب'],
    },
    {
      id: 'advice',
      words: ['ماذا افعل', 'شنو اسوي', 'اعمل ايه', 'نصيحه', 'تنصحني', 'الحل', 'كيف اتصرف',
              'ماذا علي', 'وش اسوي', 'اسوي شنو', 'كيف اوصل', 'الطريقه'],
    },
    {
      id: 'verdict',
      words: ['هل', 'يتم', 'ينجح', 'يصلح', 'صالح', 'يكمل', 'خير ولا', 'زين ولا', 'موافق',
              'اتزوج', 'اسافر', 'اربح', 'يرجع', 'يشفي', 'حظي', 'نصيبي', 'في صالحي', 'ولا لا'],
    },
  ];

  function detectIntent(text) {
    const n = ' ' + normalize(text) + ' ';
    if (!n.trim()) return 'empty';
    /* الأخص يغلب الأعم: نأخذ أطول عبارة مطابقة، وعند التساوي الأسبق في الترتيب */
    let best = null;
    let bestLen = 0;
    for (const intent of INTENTS) {
      for (const w of intent.words) {
        if (w.length > bestLen && n.includes(w)) {
          best = intent.id;
          bestLen = w.length;
        }
      }
    }
    return best || 'unknown';
  }

  /* اسم الخطة: باسم الشكل الحاكم فيها */
  function khatName(takht) {
    return 'خطّ ' + takht.judge.name.replace(/^ال/, 'ال');
  }

  /* كلام بسيط عن مستوي الحكم — بلا مصطلحات */
  function plainVerdictPhrase(verdict) {
    switch (verdict.level.key) {
      case 'good':        return 'نعم، الغالب أن أمرك يتم على خير';
      case 'mostly-good': return 'أمرك أقرب إلى الخير، لكن مع شيء من التعب أو الانتظار';
      case 'mixed':       return 'أمرك بين بين — لا خير خالص ولا شر ظاهر، والأحوط أن تتريث';
      case 'mostly-bad':  return 'الوقت لا يساعد على هذا الأمر الآن، والأفضل تأجيله';
      default:            return 'العلامات لا تبشر بهذا الأمر الآن، وفي تركه راحة لك';
    }
  }

  /* درجة الثقة بكلام بسيط وصادق */
  function confidencePhrase(verdict) {
    switch (verdict.evidence.key) {
      case 'strong':  return 'وعلامات خطك كلها متفقة على هذا، فالقول فيه قوي.';
      case 'leaning': return 'وأكثر علامات خطك على هذا مع قليل يخالف، فالقول فيه راجح لا مقطوع.';
      case 'mixed':   return 'لكن علامات خطك متعارضة، فخذ كلامي على التقريب لا اليقين.';
      default:        return 'وعلامات خطك ساكنة لا تقطع بشيء، فالله أعلم بالغيب.';
    }
  }

  function answer(intentId, ctx) {
    const { takht, verdict, questionType } = ctx;
    const judge = takht.judge;
    const houseFig = verdict.houseFig;
    const jg = FIGURE_GUIDANCE[judge.id];
    const hg = FIGURE_GUIDANCE[houseFig.id];
    const speed = SPEED_TEXT[jg.speed];
    const name = khatName(takht);

    switch (intentId) {
      case 'greeting':
        return 'وعليك السلام ورحمة الله. أنا ' + name + ' — خُطّ لأجل سؤالك عن ' +
          questionType.label + '. اسألني: هل يتم أمري؟ متى؟ أين؟ ماذا أفعل؟';

      case 'verdict': {
        let out = plainVerdictPhrase(verdict) + '. ';
        if (verdict.details.special) out += verdict.details.special + ' ';
        out += confidencePhrase(verdict);
        return out;
      }

      case 'timing': {
        let out = 'وقته ' + speed.label + ': ' +
          (jg.speed === 'fast' ? 'الأمر عاجل يقع في أيام قليلة إن شاء الله'
            : jg.speed === 'medium' ? 'الأمر يأخذ أسابيع — لا عجلة فيه ولا إبطاء'
            : 'الأمر بطيء يحتاج شهوراً وطول نفس، فلا تستعجل') + '. ';
        out += 'وأوفق أيامك للسعي فيه يوم ' + jg.day + '. ';
        if (verdict.evidence.key === 'mixed') out += 'وقد يتقدم الوقت أو يتأخر لأن العلامات متعارضة.';
        return out;
      }

      case 'location': {
        return 'اطلب حاجتك ناحية ' + hg.direction + '. ' +
          'ومظنّتها: ' + hg.place + '. ' +
          'ابدأ من أقرب موضع بهذه الصفة في بيتك أو حولك، ثم وسّع الدائرة.';
      }

      case 'person': {
        return 'الذي يدور عليه أمرك: ' + FIGURE_PERSON[houseFig.id] + ' ' +
          'وإن أعياك، فانظر أيضاً في هذا: ' + FIGURE_PERSON[judge.id];
      }

      case 'probability': {
        return 'حظ التمام في خطك ' + toArabicDigits(verdict.favorability) + ' من مئة، ' +
          'وحظ التعثر ' + toArabicDigits(100 - verdict.favorability) + ' من مئة. ' +
          confidencePhrase(verdict) + ' وتذكر: هذه موازين الخط لا وعدٌ مقطوع، والأخذ بالأسباب يرفع حظك.';
      }

      case 'why': {
        const pos = verdict.factors.filter((f) => f.contribution > 0);
        const neg = verdict.factors.filter((f) => f.contribution < 0);
        let out = 'حكمت بهذا لأن أقوى علامة في خطك خرجت «' + judge.name + '» وهي ' +
          judge.qualityText + ' — ' + judge.meaning.split('.')[0] + '. ';
        if (pos.length && neg.length) {
          out += 'ومعها ' + toArabicDigits(pos.length) + ' من العلامات تؤيد الخير و' +
            toArabicDigits(neg.length) + ' تخالف، فوزنت بعضها ببعض. ';
        } else if (pos.length) {
          out += 'وكل العلامات الأخرى جاءت مؤيدة لها. ';
        } else if (neg.length) {
          out += 'وجاءت العلامات الأخرى على مثل حكمها. ';
        }
        out += 'وإن أحببت التفصيل كله فافتح «التفاصيل» أسفل الحكم.';
        return out;
      }

      case 'advice': {
        let out = judge.advice + ' ';
        if (verdict.favorability >= 60) {
          out += 'وخذ بالأسباب: اسعَ في حاجتك يوم ' + jg.day + ' واستعن بأهل الخبرة، فالعلامات معك.';
        } else if (verdict.favorability >= 40) {
          out += 'واستخر الله واستشر من تثق به قبل أن تمضي، فالأمر يحتمل الوجهين.';
        } else {
          out += 'ولا تعاند الوقت: أخّر الأمر أو غيّر طريقك إليه، وعاود الخط بعد حين إن شئت.';
        }
        return out;
      }

      case 'empty':
        return 'اكتب سؤالك أولاً، أو اختر من الأسئلة الجاهزة.';

      default:
        return 'لم أفهم سؤالك جيداً. اسألني مثلاً: هل يتم أمري؟ متى يقع؟ أين أجد المطلوب؟ ' +
          'من هو الشخص؟ كم النسبة؟ لماذا حكمت بهذا؟ ماذا أفعل؟';
    }
  }

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function toArabicDigits(n) {
    return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
  }

  /* الأسئلة الجاهزة (تظهر أزراراً فوق حقل الكتابة) */
  const SUGGESTED = [
    { text: 'هل يتم أمري؟',      intent: 'verdict' },
    { text: 'متى يقع؟',          intent: 'timing' },
    { text: 'أين أجد المطلوب؟',  intent: 'location' },
    { text: 'من هو الشخص؟',      intent: 'person' },
    { text: 'كم النسبة؟',        intent: 'probability' },
    { text: 'لماذا هذا الحكم؟',  intent: 'why' },
    { text: 'ماذا أفعل؟',        intent: 'advice' },
  ];

  return { normalize, detectIntent, answer, khatName, SUGGESTED };
});
