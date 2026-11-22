/* UI only. All maths lives in calc.js; all editable numbers live in config.js. */
(function () {
  'use strict';

  var CONFIG = window.CalcConfig, CAT = window.CalcCatalogue, Calc = window.PriceCalc;
  var $ = function (id) { return document.getElementById(id); };
  var fmtK = Calc.formatZmw, fmtGbp = Calc.formatGbp;

  var state = { item: null, source: 'none', category: 'older', result: null };
  var items, byId = {};

  /* ---------- never fail silently ---------- */
  function showFatal(msg) {
    var f = $('fatal');
    if (!f) return;
    f.textContent = 'Something went wrong: ' + msg + '. Reload the page; if it happens again, screenshot this message.';
    f.hidden = false;
    scrollToEl(f, 'start');
  }
  window.addEventListener('error', function (e) { showFatal(e.message || 'unexpected error'); });
  try { init(); } catch (err) { showFatal(err && err.message ? err.message : String(err)); }

  /* ---------- helpers ---------- */
  function scrollToEl(el, block) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: block || 'center' }); }
    catch (e) { el.scrollIntoView(); }
  }
  function pct(factor) { return Math.round((factor - 1) * 1000) / 10; }
  function bandText(b) { return fmtK(b.min) + '–' + fmtK(b.max); }

  /* ---------- info (ⓘ) hints ---------- */
  function hints() {
    var o = CONFIG.profit.older, n = CONFIG.profit.newer, s = CONFIG.shipping;
    var dims = {
      what: 'The outer size of the parcel, in centimetres.',
      enter: 'Length, width and height — all three, or leave all three blank.',
      required: 'Optional.',
      affects: 'Volumetric weight = L × W × H ÷ ' + CONFIG.volumetricDivisor + '. Eastwing charges the higher of actual and volumetric weight, so a big box can cost more than its weight suggests.'
    };
    return {
      model: { what: 'The exact iPhone model and storage you are buying.', enter: 'Pick it from the list. If it is not listed, choose “Other model” and enter the UK price yourself.', required: 'Yes.', affects: 'Fills in the UK benchmark price and sets your profit range: ' + bandText(o) + ' for ' + o.label + ', ' + bandText(n) + ' for ' + n.label + '.' },
      price: { what: 'What you pay the UK eBay seller for the phone, in pounds, before postage.', enter: 'The actual item price from the listing. Choosing a model fills in a benchmark — type over it with the real price.', required: 'Yes.', affects: 'Starting point of the landed cost. The benchmark uplift is added only to the auto-filled benchmark, never to a price you type.' },
      postage: { what: 'The UK seller’s delivery charge to your UK shipping address, in pounds.', enter: 'The postage on the listing, or 0 if it is free or you collect.', required: 'Optional (counts as £0 if blank).', affects: 'Added to the UK price before converting to kwacha.' },
      positioning: { what: 'A mark-up on the benchmark, because current listings usually sit above typical sold prices.', enter: 'Choose a percentage (default 8%).', required: 'Optional.', affects: 'Applies only while the UK price is the auto-filled benchmark. It is ignored once you type your own price.' },
      rate: { what: 'How many kwacha you pay for £1.', enter: 'Your real GBP → ZMW rate including any fees or spread, e.g. ' + CONFIG.defaultExchangeRate + '.', required: 'Yes.', affects: 'Multiplies (UK price + postage) to give the product cost in kwacha. A small change moves the final price noticeably.' },
      actual: { what: 'The physical weight of the parcel (phone, box and packing) in kilograms.', enter: 'e.g. 1 or 0.8.', required: 'Yes.', affects: s.carrier + ' bills the higher of actual and volumetric weight, rounded up to the next ' + s.weightStepKg + ' kg, using the ' + s.route + ' tariff.' },
      dims: dims,
      other: { what: 'Any other cost in kwacha: customs, payment fees, local delivery, packaging.', enter: 'The total in kwacha, or 0 if none.', required: 'Optional (counts as K0 if blank).', affects: 'Added to the landed cost, so it raises the recommended price kwacha for kwacha.' },
      profit: { what: 'The profit you want to make on this phone, in kwacha.', enter: 'A value inside the range for the model: ' + bandText(o) + ' (' + o.label + ') or ' + bandText(n) + ' (' + n.label + '). Use the slider or type it.', required: 'Yes — the range switches automatically when you change model.', affects: 'Added to the landed cost, then rounded up to the next K' + CONFIG.roundingStepZmw + ' to give the recommended price.' },
      sell: { what: 'A price you want to test instead of the recommended one.', enter: 'A price in kwacha, or leave blank.', required: 'Optional.', affects: 'Does not change the recommended price. It adds a line showing the profit you would make at your price.' }
    };
  }

  function initHints() {
    var H = hints();
    Array.prototype.forEach.call(document.querySelectorAll('.field'), function (field) {
      var key = field.getAttribute('data-field'), h = H[key], row = field.querySelector('.label-row');
      if (!h || !row) return;
      var lab = row.querySelector('label, .label-text');
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'info'; btn.textContent = 'i';
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'hint-' + key);
      btn.setAttribute('aria-label', 'About ' + (lab ? lab.textContent : key));
      row.appendChild(btn);

      var panel = document.createElement('div');
      panel.className = 'hint'; panel.id = 'hint-' + key; panel.hidden = true;
      var dl = document.createElement('dl');
      [['What it is', h.what], ['What to enter', h.enter], ['Compulsory?', h.required], ['Affects', h.affects]].forEach(function (p) {
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = p[0]; dd.textContent = p[1]; dl.appendChild(dt); dl.appendChild(dd);
      });
      panel.appendChild(dl);
      row.parentNode.insertBefore(panel, row.nextSibling);

      btn.addEventListener('click', function () {
        var open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }
  function closeHints() {
    Array.prototype.forEach.call(document.querySelectorAll('.hint'), function (p) { p.hidden = true; });
    Array.prototype.forEach.call(document.querySelectorAll('.info'), function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  /* ---------- model list ---------- */
  function populateModels() {
    var select = $('model');
    select.innerHTML = '';
    var ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Choose a model…'; select.appendChild(ph);
    var groups = {};
    items.forEach(function (it) {
      var g = Calc.groupLabel(it);
      if (!groups[g]) { groups[g] = document.createElement('optgroup'); groups[g].label = g; select.appendChild(groups[g]); }
      var o = document.createElement('option'); o.value = it.id; o.textContent = Calc.optionLabel(it);
      groups[g].appendChild(o);
    });
    var pos = $('positioning');
    pos.innerHTML = '';
    CONFIG.positioning.options.forEach(function (p) {
      var o = document.createElement('option'); o.value = String(p.factor); o.textContent = p.label; pos.appendChild(o);
    });
  }

  function modelInfoText(it) {
    if (!it) return 'Benchmarks are typical eBay UK prices for working, unlocked phones — always check the real listing.';
    if (it.isOther) return 'Not in the list: enter the actual UK eBay price below. Profit range is set for ' + CONFIG.profit[it.category].label + '.';
    if (!it.benchmarkGbp) return 'No reliable benchmark for this model and storage — enter the actual UK eBay price below.';
    return 'Benchmark £' + it.benchmarkGbp + ' — ' + (it.sampleSize > 0
      ? 'typical sold price from ' + it.sampleSize + ' eBay UK sales.'
      : 'based on an eBay UK listing snapshot, not completed sales.') + ' Replace it with the real listing price.';
  }

  /* ---------- profit range ---------- */
  function setProfitValue(v) { $('profit').value = String(v); $('profitRange').value = String(v); }
  function setBand(category, reset) {
    var b = CONFIG.profit[category], range = $('profitRange');
    state.category = category;
    range.min = b.min; range.max = b.max; range.step = b.step;
    var cur = Calc.parseNumber($('profit').value);
    if (reset || cur === null || isNaN(cur) || cur < b.min || cur > b.max) setProfitValue(b.default);
    $('profitMin').textContent = fmtK(b.min); $('profitMax').textContent = fmtK(b.max);
    $('profitBand').textContent = b.label;
  }

  /* ---------- price source UI ---------- */
  function updatePriceUi() {
    var it = state.item, tag = $('priceTag');
    $('restoreBench').hidden = !(state.source === 'manual' && it && it.benchmarkGbp);
    $('positioning').disabled = state.source === 'manual';
    $('upliftNote').textContent = state.source === 'manual' ? 'Not applied: you typed your own price.' : 'Added to the benchmark price only.';
    if (state.source === 'benchmark') tag.textContent = 'Benchmark filled in — type over it to use the actual eBay price.';
    else if (state.source === 'manual') tag.textContent = 'Using the price you entered (no uplift).';
    else tag.textContent = it && it.isOther ? 'Enter the actual UK eBay price.' : 'Choose a model for a benchmark, or enter the actual UK eBay price.';
  }
  function updateVolPreview() {
    var l = Calc.parseNumber($('length').value), w = Calc.parseNumber($('width').value), h = Calc.parseNumber($('height').value);
    var a = Calc.parseNumber($('actual').value), el = $('volPreview');
    if (l > 0 && w > 0 && h > 0) {
      var v = Calc.volumetricKg(l, w, h, CONFIG.volumetricDivisor);
      el.textContent = 'Volumetric weight: ' + v.toFixed(2) + ' kg' + (a > 0 ? (v > a ? ' — higher than actual, so this is used for shipping.' : ' — lower than actual, so actual weight is used.') : '.');
    } else el.textContent = 'Optional. Enter all three to check volumetric weight (L × W × H ÷ ' + CONFIG.volumetricDivisor + ').';
  }

  /* ---------- errors ---------- */
  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('.field.invalid'), clearFieldError);
    $('formBanner').hidden = true; $('formBanner').textContent = '';
  }
  function clearFieldError(field) {
    field.classList.remove('invalid');
    Array.prototype.forEach.call(field.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
    var m = field.querySelector('.error-msg'); if (m) { m.hidden = true; m.textContent = ''; }
  }
  function showErrors(errors) {
    var byField = [];
    errors.forEach(function (e) {
      var input = $(e.field), field = input.closest('.field');
      input.setAttribute('aria-invalid', 'true');
      field.classList.add('invalid');
      var m = field.querySelector('.error-msg');
      m.textContent = (m.hidden || !m.textContent) ? e.message : m.textContent + ' ' + e.message;
      m.hidden = false;
      if (byField.indexOf(field) === -1) byField.push(field);
    });
    var banner = $('formBanner');
    banner.textContent = errors.length === 1 ? 'Fix 1 thing before calculating: ' + errors[0].message
      : 'Fix ' + byField.length + ' fields before calculating — they are highlighted in red.';
    banner.hidden = false;
    var first = $(errors[0].field);
    scrollToEl(first.closest('.field'), 'center');
    try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
  }

  /* ---------- results ---------- */
  function setText(id, t) { $(id).textContent = t; }
  function resBanner(kind, text) { var b = $('resBanner'); b.className = 'banner ' + kind; b.textContent = text; b.hidden = false; }

  function clearResults() {
    state.result = null;
    $('results').classList.remove('stale');
    $('resBanner').hidden = true;
    setText('r-recommended', '—'); setText('r-basis', 'Fill in the form and press Calculate price.');
    ['r-uk', 'r-post', 'r-conv', 'r-ship', 'r-other', 'r-landed', 'r-target', 'r-rec', 'r-profit'].forEach(function (id) { setText(id, '—'); });
    ['r-uk-sub', 'r-conv-sub', 'r-ship-sub', 'r-rec-sub', 'r-profit-sub'].forEach(function (id) { setText(id, ''); });
    $('r-own-row').hidden = true;
    $('copyPrice').disabled = true; $('copyAll').disabled = true;
  }
  function markStale() {
    if (!state.result) return;
    $('results').classList.add('stale');
    resBanner('warn', 'You changed an input — press Calculate price to refresh these numbers.');
  }

  function render(r) {
    var step = CONFIG.roundingStepZmw;
    setText('r-recommended', fmtK(r.recommendedZmw, 0));
    setText('r-basis', 'Landed cost ' + fmtK(r.landedZmw, 2) + ' + ' + fmtK(r.targetProfitZmw, 0) + ' target profit, rounded up to the next K' + step);
    setText('r-uk', fmtGbp(r.ukPriceGbp));
    setText('r-uk-sub', r.positioningFactor > 1 ? fmtGbp(r.enteredPriceGbp) + ' benchmark + ' + pct(r.positioningFactor) + '% uplift'
      : (r.priceSource === 'manual' ? 'Price you entered' : 'Benchmark, no uplift'));
    setText('r-post', fmtGbp(r.ukPostageGbp));
    setText('r-conv', fmtK(r.productZmw, 2));
    setText('r-conv-sub', fmtGbp(r.ukTotalGbp) + ' × ' + r.rate);
    setText('r-ship', fmtK(r.shippingZmw, 2));
    setText('r-ship-sub', 'Billed as ' + r.billedKg + ' kg · actual ' + r.actualKg + ' kg' + (r.hasDims ? ', volumetric ' + r.volumetricKg.toFixed(2) + ' kg' : ''));
    setText('r-other', fmtK(r.otherZmw, 2));
    setText('r-landed', fmtK(r.landedZmw, 2));
    setText('r-target', fmtK(r.targetProfitZmw, 0));
    setText('r-rec', fmtK(r.recommendedZmw, 0));
    setText('r-rec-sub', 'Rounded up from ' + fmtK(r.landedZmw + r.targetProfitZmw, 2));
    setText('r-profit', fmtK(r.expectedProfitZmw, 2));
    setText('r-profit-sub', 'Recommended price − landed cost (includes ' + fmtK(r.roundingZmw, 2) + ' rounding)');
    var own = $('r-own-row');
    if (r.sellPriceZmw !== null) {
      own.hidden = false;
      setText('r-own-label', 'Profit if you sell at ' + fmtK(r.sellPriceZmw, 0));
      setText('r-own', fmtK(r.profitAtSellPriceZmw, 2));
      $('r-own').className = r.profitAtSellPriceZmw >= 0 ? 'green' : 'red';
    } else own.hidden = true;
    $('copyPrice').disabled = false; $('copyAll').disabled = false;
    $('results').classList.remove('stale');
    resBanner('success', 'Calculated: sell at ' + fmtK(r.recommendedZmw, 0) + ' for an expected profit of ' + fmtK(r.expectedProfitZmw, 2) + '.');
  }

  function breakdownText(r) {
    var name = r.model ? (r.model.isOther ? 'Other iPhone' : r.model.name + ' · ' + r.model.storage) : 'iPhone';
    return [
      name,
      'UK price: ' + fmtGbp(r.ukPriceGbp) + (r.positioningFactor > 1 ? ' (' + fmtGbp(r.enteredPriceGbp) + ' + ' + pct(r.positioningFactor) + '% uplift)' : ''),
      'UK postage: ' + fmtGbp(r.ukPostageGbp),
      'Conversion: ' + fmtGbp(r.ukTotalGbp) + ' × ' + r.rate + ' = ' + fmtK(r.productZmw, 2),
      'Eastwing shipping: ' + fmtK(r.shippingZmw, 2) + ' (' + r.billedKg + ' kg billed)',
      'Other expenses: ' + fmtK(r.otherZmw, 2),
      'Landed cost: ' + fmtK(r.landedZmw, 2),
      'Target profit: ' + fmtK(r.targetProfitZmw, 0),
      'Recommended price: ' + fmtK(r.recommendedZmw, 0),
      'Expected profit: ' + fmtK(r.expectedProfitZmw, 2)
    ].join('\n');
  }

  /* ---------- copy ---------- */
  function copyText(text) {
    var done = function () { return true; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }
  function wireCopy(btnId, getText) {
    var btn = $(btnId), label = btn.textContent;
    btn.addEventListener('click', function () {
      if (!state.result) return;
      var text = getText(state.result);
      copyText(text).then(function (ok) {
        if (!ok) { window.prompt('Copy this:', text); return; }
        btn.textContent = 'Copied ✓';
        setTimeout(function () { btn.textContent = label; }, 1800);
      });
    });
  }

  /* ---------- actions ---------- */
  function readForm() {
    return {
      model: state.item, priceSource: state.source,
      price: $('price').value, postage: $('postage').value, positioning: $('positioning').value, rate: $('rate').value,
      actual: $('actual').value, length: $('length').value, width: $('width').value, height: $('height').value,
      other: $('other').value, profit: $('profit').value, sell: $('sell').value
    };
  }

  function runCalculation() {
    try {
      clearErrors();
      var out = Calc.evaluate(readForm(), CONFIG);
      if (!out.ok) { showErrors(out.errors); return; }
      state.result = out.result;
      render(out.result);
      scrollToEl($('results'), 'start');
      try { $('results').focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
    } catch (err) { showFatal(err && err.message ? err.message : String(err)); }
  }

  function onModelChange() {
    var it = byId[$('model').value] || null;
    state.item = it;
    var cat = it ? it.category : 'older';
    setBand(cat, cat !== state.category || !it);
    if (it && it.benchmarkGbp) { $('price').value = String(it.benchmarkGbp); state.source = 'benchmark'; }
    else { $('price').value = ''; state.source = 'none'; }
    $('modelInfo').textContent = modelInfoText(it);
    updatePriceUi();
    clearFieldError($('model').closest('.field')); clearFieldError($('price').closest('.field')); clearFieldError($('profit').closest('.field'));
    markStale();
  }

  function applyDefaults() {
    $('model').value = ''; state.item = null; state.source = 'none';
    $('price').value = ''; $('postage').value = '0';
    $('positioning').value = String(CONFIG.positioning.default);
    $('rate').value = String(CONFIG.defaultExchangeRate);
    $('actual').value = String(CONFIG.defaultWeightKg);
    ['length', 'width', 'height', 'sell'].forEach(function (id) { $(id).value = ''; });
    $('other').value = '0';
    setBand('older', true);
    $('modelInfo').textContent = modelInfoText(null);
    updatePriceUi(); updateVolPreview();
  }

  function resetAll() {
    clearErrors(); closeHints(); applyDefaults(); clearResults();
    window.scrollTo(0, 0);
  }

  /* ---------- start-up ---------- */
  function init() {
    items = Calc.buildCatalogue(CAT.rows, CAT.extras, CONFIG);
    items.forEach(function (it) { byId[it.id] = it; });
    populateModels();
    initHints();
    applyDefaults();
    clearResults();

    var s = CONFIG.shipping;
    var note = s.carrier + ' ' + s.route + ' tariff dated ' + s.tariffDate + (s.confirmedCurrent ? '.' : ' — confirm current rates before quoting a customer.') +
      ' Weight is billed in ' + s.weightStepKg + ' kg steps, using the higher of actual and volumetric weight.';
    setText('tariffNote', note); setText('tariffNote2', note + ' Rates can be changed in js/config.js.');

    $('model').addEventListener('change', onModelChange);
    $('price').addEventListener('input', function () { state.source = 'manual'; updatePriceUi(); });
    $('restoreBench').addEventListener('click', function () {
      if (state.item && state.item.benchmarkGbp) { $('price').value = String(state.item.benchmarkGbp); state.source = 'benchmark'; updatePriceUi(); markStale(); }
    });
    $('profit').addEventListener('input', function () {
      var v = Calc.parseNumber($('profit').value), b = CONFIG.profit[state.category];
      if (v !== null && !isNaN(v) && v >= b.min && v <= b.max) $('profitRange').value = String(v);
    });
    $('profitRange').addEventListener('input', function () { $('profit').value = $('profitRange').value; clearFieldError($('profit').closest('.field')); });
    ['length', 'width', 'height', 'actual'].forEach(function (id) { $(id).addEventListener('input', updateVolPreview); });

    // Any edit clears that field's error and marks existing results as out of date.
    $('calcForm').addEventListener('input', function (e) {
      var field = e.target.closest && e.target.closest('.field');
      if (field) clearFieldError(field);
      markStale();
    });
    $('calcForm').addEventListener('submit', function (e) { e.preventDefault(); runCalculation(); });
    $('reset').addEventListener('click', resetAll);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeHints(); });

    wireCopy('copyPrice', function (r) { return fmtK(r.recommendedZmw, 0); });
    wireCopy('copyAll', breakdownText);
    document.documentElement.setAttribute('data-ready', 'true');
  }
})();
