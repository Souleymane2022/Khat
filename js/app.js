/* =====================================================================
   واجهة تطبيق الخط — علم الرمل
   ===================================================================== */
(function () {
  'use strict';

  const { FIGURES, FIGURE_LIST, HOUSES, QUESTION_TYPES, QUALITY_PHRASES } = RAMAL_DATA;

  /* ---------------- أدوات عامة ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const arNum = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

  function randomParity() {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] % 2) === 1 ? 1 : 2;
  }

  function figureDotsEl(fig, big) {
    const wrap = document.createElement('div');
    wrap.className = 'figure-dots' + (big ? ' big' : '');
    fig.rows.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'dotrow';
      for (let i = 0; i < r; i++) {
        const d = document.createElement('span');
        d.className = 'dot';
        row.appendChild(d);
      }
      wrap.appendChild(row);
    });
    return wrap;
  }

  function qualityBadge(fig) {
    const b = document.createElement('span');
    b.className = 'badge b' + fig.quality;
    b.textContent = fig.qualityText;
    return b;
  }

  /* ---------------- حالة التطبيق ---------------- */
  const state = {
    stage: 'question',            // question | draw | result
    selectedType: QUESTION_TYPES[0],
    lines: [],                    // [{parity, count}]
    takht: null,
    verdict: null,
  };

  /* ---------------- التنقل ---------------- */
  const screens = {
    question: $('#screen-question'),
    draw: $('#screen-draw'),
    result: $('#screen-result'),
    learn: $('#screen-learn'),
    about: $('#screen-about'),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('visible'));
    screens[name].classList.add('visible');
    window.scrollTo({ top: 0 });
  }

  document.querySelectorAll('nav.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'cast') show(state.stage);
      else show(tab);
    });
  });

  /* ---------------- شاشة السؤال ---------------- */
  const qtypesEl = $('#qtypes');
  QUESTION_TYPES.forEach((qt, i) => {
    const b = document.createElement('button');
    b.className = 'qtype' + (i === 0 ? ' selected' : '');
    b.innerHTML = `<span class="qicon">${qt.icon}</span>${qt.label}`;
    b.addEventListener('click', () => {
      qtypesEl.querySelectorAll('.qtype').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      state.selectedType = qt;
    });
    qtypesEl.appendChild(b);
  });

  $('#btn-start').addEventListener('click', () => {
    state.stage = 'draw';
    show('draw');
    initSand();
  });

  /* ---------------- الرمل: الخط باللمس ---------------- */
  const canvas = $('#sand');
  const ctx = canvas.getContext('2d');
  const hint = $('#sandhint');
  let sandReady = false;
  let stroke = null; // {lastX, lastY, dashes}

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSand();
  }

  function paintSand() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8d5ae');
    g.addColorStop(1, '#d3ba86');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    /* حبيبات الرمل */
    for (let i = 0; i < w * h / 28; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const shade = Math.random();
      ctx.fillStyle = shade < 0.5 ? 'rgba(120,90,40,0.13)' : 'rgba(255,245,220,0.18)';
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }

  function stampDash(x, y) {
    /* أثر الإصبع في الرمل: حفرة صغيرة بظل */
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 6, 3.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,246,225,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 5.2, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(92,68,30,0.75)';
    ctx.fill();
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function initSand() {
    if (!sandReady) {
      sizeCanvas();
      window.addEventListener('resize', sizeCanvas);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      sandReady = true;
    } else {
      paintSand();
    }
    renderRecord();
  }

  function onDown(e) {
    if (state.lines.length >= 16) return;
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    stroke = { lastX: p.x, lastY: p.y, dashes: 1 };
    stampDash(p.x, p.y);
    hint.style.display = 'none';
    e.preventDefault();
  }

  function onMove(e) {
    if (!stroke) return;
    const p = pointerPos(e);
    const dx = p.x - stroke.lastX, dy = p.y - stroke.lastY;
    if (Math.hypot(dx, dy) >= 15) {
      stampDash(p.x, p.y);
      stroke.dashes++;
      stroke.lastX = p.x;
      stroke.lastY = p.y;
    }
    e.preventDefault();
  }

  function onUp() {
    if (!stroke) return;
    const n = stroke.dashes;
    stroke = null;
    if (n < 3) { wipeSand(); return; } /* لمسة قصيرة لا تُحسب سطراً */
    addLine({ parity: n % 2 === 1 ? 1 : 2, count: n });
    setTimeout(wipeSand, 420);
  }

  function wipeSand() {
    paintSand();
    if (state.lines.length === 0) hint.style.display = 'flex';
  }

  function addLine(line) {
    if (state.lines.length >= 16) return;
    state.lines.push(line);
    renderRecord();
  }

  /* سجل الأمهات الأربع */
  const recordEl = $('#mothers-record');
  const MOTHER_NAMES = ['الأم الأولى', 'الأم الثانية', 'الأم الثالثة', 'الأم الرابعة'];

  function renderRecord() {
    $('#line-count').textContent = arNum(state.lines.length);
    recordEl.innerHTML = '';
    for (let m = 0; m < 4; m++) {
      const slot = document.createElement('div');
      slot.className = 'mother-slot';
      const label = document.createElement('div');
      label.className = 'mlabel';
      label.textContent = MOTHER_NAMES[m];
      slot.appendChild(label);

      const rows = [];
      let complete = true;
      for (let r = 0; r < 4; r++) {
        const idx = m * 4 + r;
        const row = document.createElement('div');
        row.className = 'dotrow';
        if (idx < state.lines.length) {
          const parity = state.lines[idx].parity;
          rows.push(parity);
          for (let i = 0; i < parity; i++) {
            const d = document.createElement('span');
            d.className = 'dot';
            row.appendChild(d);
          }
          row.title = arNum(state.lines[idx].count) + ' نقطة';
        } else {
          complete = false;
          row.classList.add('pending');
          const d = document.createElement('span');
          d.className = 'dot';
          row.appendChild(d);
        }
        slot.appendChild(row);
      }
      if (complete) {
        slot.classList.add('done');
        const fig = RAMAL.figureFromRows(rows);
        const nm = document.createElement('div');
        nm.className = 'mname';
        nm.textContent = fig.name;
        slot.appendChild(nm);
      }
      recordEl.appendChild(slot);
    }
    const done = state.lines.length === 16;
    $('#btn-cast').disabled = !done;
    hint.style.display = state.lines.length === 0 ? 'flex' : 'none';
    if (state.lines.length > 0 && !done) {
      hint.style.display = 'none';
    }
  }

  $('#btn-undo').addEventListener('click', () => {
    state.lines.pop();
    renderRecord();
  });

  $('#btn-auto').addEventListener('click', () => {
    while (state.lines.length < 16) {
      const parity = randomParity();
      /* عدد نقاط عشوائي موافق للفردية والزوجية، للعرض فقط */
      const base = 5 + (crypto.getRandomValues(new Uint8Array(1))[0] % 6) * 2;
      state.lines.push({ parity, count: parity === 1 ? base : base + 1 });
    }
    renderRecord();
  });

  $('#btn-reset-draw').addEventListener('click', () => {
    state.lines = [];
    wipeSand();
    renderRecord();
  });

  $('#btn-cast').addEventListener('click', () => {
    const parities = state.lines.map((l) => l.parity);
    state.takht = RAMAL.buildTakht(parities);
    state.verdict = RAMAL.verdict(state.takht, state.selectedType.house);
    state.stage = 'result';
    renderResult();
    show('result');
  });

  /* ---------------- شاشة النتيجة ---------------- */
  function renderResult() {
    const v = state.verdict;
    const q = $('#question').value.trim();

    const vc = $('#verdict-card');
    vc.innerHTML = '';
    if (q) {
      const qp = document.createElement('p');
      qp.className = 'muted';
      qp.textContent = '« ' + q + ' »';
      vc.appendChild(qp);
    }
    const icon = document.createElement('div');
    icon.className = 'verdict-icon';
    icon.textContent = v.level.icon;
    const title = document.createElement('div');
    title.className = 'verdict-title';
    title.textContent = v.level.title;
    const text = document.createElement('p');
    text.textContent = v.level.text;

    const gauge = document.createElement('div');
    gauge.className = 'gauge';
    gauge.style.direction = 'ltr';
    const needle = document.createElement('div');
    needle.className = 'needle';
    const pct = (v.score + 100) / 2; /* 0..100 */
    needle.style.left = 'calc(' + pct + '% - 2px)';
    gauge.appendChild(needle);
    const labels = document.createElement('div');
    labels.className = 'gauge-labels';
    labels.innerHTML = '<span>غير صالح</span><span>ممتزج</span><span>في صالحك</span>';

    vc.appendChild(icon);
    vc.appendChild(title);
    vc.appendChild(gauge);
    vc.appendChild(labels);
    vc.appendChild(text);

    /* التفاصيل */
    const dl = $('#detail-list');
    dl.innerHTML = '';
    const items = [
      ['بيت السؤال', v.details.questionHouse],
      ['أول الأمر', v.details.beginning],
      ['آخر الأمر', v.details.ending],
      ['حكم الميزان', v.details.judge],
      ['العاقبة', v.details.outcome],
    ];
    items.forEach(([label, txt]) => {
      const li = document.createElement('li');
      const sp = document.createElement('span');
      sp.className = 'dlabel';
      sp.textContent = label + ': ';
      li.appendChild(sp);
      li.appendChild(document.createTextNode(txt));
      dl.appendChild(li);
    });
    $('#advice-box').textContent = '☞ ' + v.details.advice;

    renderTakht();
  }

  /* ---------------- تخت الرمل ---------------- */
  function renderTakht() {
    const takhtEl = $('#takht');
    takhtEl.innerHTML = '';
    const spans = { 13: 'span2', 14: 'span2', 15: 'span2', 16: 'span2' };
    /* الصف الأول: البيوت ١-٨؛ الثاني: ٩-١٢؛ الثالث: الشاهدان؛ الرابع: الميزان والعاقبة */
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    order.forEach((n) => {
      const fig = state.takht.houses[n - 1];
      const house = HOUSES[n - 1];
      const cell = document.createElement('button');
      cell.className = 'thouse';
      if (n >= 9 && n <= 12) cell.classList.add('span2');
      if (spans[n]) cell.classList.add(spans[n]);
      if (fig.quality > 0) cell.classList.add('q-good');
      else if (fig.quality < 0) cell.classList.add('q-bad');
      else cell.classList.add('q-mixed');
      if (n === state.selectedType.house) cell.classList.add('highlight');

      const num = document.createElement('div');
      num.className = 'hnum';
      num.textContent = arNum(n);
      const dots = figureDotsEl(fig);
      const name = document.createElement('div');
      name.className = 'hname';
      name.textContent = house.name;
      cell.appendChild(num);
      cell.appendChild(dots);
      cell.appendChild(name);
      cell.addEventListener('click', () => openHouseModal(n));
      takhtEl.appendChild(cell);
    });
  }

  /* ---------------- نافذة تفاصيل البيت ---------------- */
  const modalBack = $('#modal-back');
  const modalContent = $('#modal-content');

  function openHouseModal(n) {
    const fig = state.takht.houses[n - 1];
    const house = HOUSES[n - 1];
    modalContent.innerHTML = '';

    const h = document.createElement('h2');
    h.textContent = house.name + ' — ' + arNum(n);
    const topic = document.createElement('p');
    topic.className = 'muted';
    topic.textContent = house.topic;

    const figWrap = document.createElement('div');
    figWrap.style.cssText = 'display:flex;gap:14px;align-items:center;margin:12px 0;';
    figWrap.appendChild(figureDotsEl(fig, true));
    const meta = document.createElement('div');
    const fname = document.createElement('h3');
    fname.textContent = '«' + fig.name + '»';
    fname.appendChild(qualityBadge(fig));
    const fmeta = document.createElement('div');
    fmeta.className = 'fmeta muted';
    fmeta.textContent = 'الكوكب: ' + fig.planet + ' · البرج: ' + fig.burj + ' · الطبع: ' + fig.element;
    meta.appendChild(fname);
    meta.appendChild(fmeta);
    figWrap.appendChild(meta);

    const meaning = document.createElement('p');
    meaning.textContent = fig.meaning;

    const inHouse = document.createElement('div');
    inHouse.className = 'advice-box';
    inHouse.textContent =
      'وقوع «' + fig.name + '» في ' + house.name + ': هذا الشكل ' +
      QUALITY_PHRASES[String(fig.quality)] + ' فيما يخص ' + house.topic + '.';

    modalContent.appendChild(h);
    modalContent.appendChild(topic);
    modalContent.appendChild(figWrap);
    modalContent.appendChild(meaning);
    modalContent.appendChild(inHouse);
    modalBack.classList.add('open');
  }

  $('#modal-close').addEventListener('click', () => modalBack.classList.remove('open'));
  modalBack.addEventListener('click', (e) => {
    if (e.target === modalBack) modalBack.classList.remove('open');
  });

  /* ---------------- خط جديد ---------------- */
  $('#btn-new').addEventListener('click', () => {
    state.lines = [];
    state.takht = null;
    state.verdict = null;
    state.stage = 'question';
    renderRecord();
    show('question');
  });

  /* ---------------- موسوعة الأشكال ---------------- */
  const figGrid = $('#fig-grid');
  FIGURE_LIST.forEach((id) => {
    const fig = FIGURES[id];
    const card = document.createElement('div');
    card.className = 'fig-card';
    const dots = figureDotsEl(fig, true);
    const body = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = '«' + fig.name + '»';
    h.appendChild(qualityBadge(fig));
    const meta = document.createElement('div');
    meta.className = 'fmeta';
    meta.textContent = fig.latin + ' · الكوكب: ' + fig.planet + ' · البرج: ' + fig.burj + ' · الطبع: ' + fig.element;
    const p = document.createElement('p');
    p.textContent = fig.meaning;
    const adv = document.createElement('p');
    adv.className = 'muted';
    adv.textContent = '☞ ' + fig.advice;
    body.appendChild(h);
    body.appendChild(meta);
    body.appendChild(p);
    body.appendChild(adv);
    card.appendChild(dots);
    card.appendChild(body);
    figGrid.appendChild(card);
  });

  /* ---------------- تسجيل عامل الخدمة (يعمل دون اتصال) ---------------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  renderRecord();
})();
