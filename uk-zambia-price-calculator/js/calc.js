/*
 * Pure pricing logic — no DOM access. Runs in the browser (window.PriceCalc) and in Node (tests).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PriceCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- numbers ---------- */

  // Returns null for blank, NaN for unreadable, otherwise a number.
  // Accepts "1,200.50", "K1,200", "£450", "26,95" (decimal comma), spaces.
  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    var s = String(value).replace(/\s/g, '').replace(/^[£kK]/, '');
    if (s === '') return null;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');   // 1,200.50
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');            // 26,95
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function round2(x) { return Math.round(x * 100) / 100; }
  function round3(x) { return Math.round(x * 1000) / 1000; }

  // Round UP to the next multiple of `step`, working in ngwee so float noise can't push it a step too high.
  function roundUpToStep(amount, step) {
    var cents = Math.round(amount * 100), stepCents = Math.round(step * 100);
    return (Math.ceil(cents / stepCents) * stepCents) / 100;
  }

  function formatNumber(n, decimals) {
    var d = decimals === undefined ? 0 : decimals;
    return Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function formatZmw(n, decimals) { return (n < 0 ? '-' : '') + 'K' + formatNumber(Math.abs(n), decimals); }
  function formatGbp(n) { return '£' + formatNumber(n, 2); }

  /* ---------- catalogue ---------- */

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  // "iPhone 17 Pro Max" → 17.  SE / X / XS / XR → 0 (older).  "iPhone SE 2022" is NOT read as 2022.
  function generationOf(name) {
    var m = /^iPhone (\d+)/.exec(name);
    return m ? Number(m[1]) : 0;
  }
  function categoryOf(generation, config) {
    return generation >= config.profit.newerFromGeneration ? 'newer' : 'older';
  }
  function profitBand(item, config) {
    return config.profit[item && item.category === 'newer' ? 'newer' : 'older'];
  }

  function buildCatalogue(rows, extras, config) {
    var items = rows.map(function (r) {
      var gen = r[4] !== undefined ? r[4] : generationOf(r[0]);
      return {
        id: slug(r[0] + ' ' + r[1]), name: r[0], storage: r[1],
        benchmarkGbp: r[2] > 0 ? r[2] : null, sampleSize: r[3] || 0,
        generation: gen, category: categoryOf(gen, config), isOther: false
      };
    });
    (extras || []).forEach(function (x) {
      items.push({
        id: x.id, name: x.name, storage: '', benchmarkGbp: null, sampleSize: 0,
        generation: x.generation, category: categoryOf(x.generation, config), isOther: true
      });
    });
    return items;
  }

  function optionLabel(item) {
    if (item.isOther) return item.name;
    return item.name + ' — ' + item.storage + (item.benchmarkGbp ? '  ·  £' + item.benchmarkGbp : '  ·  no benchmark');
  }
  function groupLabel(item) {
    if (item.isOther) return 'Not listed';
    return item.generation >= 11 ? 'iPhone ' + item.generation + ' series' : 'iPhone SE, X, 8 and older';
  }

  /* ---------- shipping ---------- */

  function volumetricKg(lengthCm, widthCm, heightCm, divisor) {
    return round3((lengthCm * widthCm * heightCm) / divisor);
  }

  // Weight is billed in 0.5 kg steps, rounded up (0.51 kg → 1 kg).
  function billableKg(kg, stepKg) {
    var grams = Math.round(kg * 1000), step = Math.round(stepKg * 1000);
    return (Math.ceil(grams / step) * step) / 1000;
  }

  function shippingCost(kg, shipping) {
    if (!(kg > 0)) return 0;
    var billed = billableKg(kg, shipping.weightStepKg);
    var t = shipping.tariff, last = t[t.length - 1];
    if (billed <= last[0]) {
      for (var i = 0; i < t.length; i++) if (billed <= t[i][0]) return t[i][1];
    }
    var extraSteps = Math.round((billed - last[0]) / shipping.weightStepKg);
    return last[1] + extraSteps * shipping.extraPerStepAboveMax;
  }

  /* ---------- validate + calculate ---------- */

  // form: { model (catalogue item|null), priceSource ('benchmark'|'manual'|'none'), price, postage, positioning,
  //         rate, actual, length, width, height, other, profit, sell }  — values may be strings or numbers.
  // Returns { ok:false, errors:[{field,message}] } (in on-screen order) or { ok:true, result:{...} }.
  function evaluate(form, config) {
    var errors = [];
    function fail(field, message) { errors.push({ field: field, message: message }); }
    function read(field, label, o) {
      var v = parseNumber(form[field]);
      if (v === null) { if (o.required) fail(field, label + ' is required.'); return null; }
      if (isNaN(v)) { fail(field, label + ' must be a number, for example ' + o.example + '.'); return null; }
      if (o.positive ? v <= 0 : v < 0) { fail(field, label + (o.positive ? ' must be greater than 0.' : ' cannot be negative.')); return null; }
      return v;
    }

    var model = form.model || null;
    if (!model) fail('model', 'Choose an iPhone model and storage (or “Other model” if it is not listed).');
    var price = read('price', 'UK purchase price', { required: true, positive: true, example: '450' });
    var postage = read('postage', 'UK postage', { example: '12.50' });
    var rate = read('rate', 'Exchange rate', { required: true, positive: true, example: '26.95' });
    var actual = read('actual', 'Actual weight', { required: true, positive: true, example: '1' });

    var dimNames = [['length', 'Length'], ['width', 'Width'], ['height', 'Height']];
    var dims = dimNames.map(function (d) { return read(d[0], d[1], { positive: true, example: '20' }); });
    var blanks = dimNames.filter(function (d) { return parseNumber(form[d[0]]) === null; });
    if (blanks.length > 0 && blanks.length < 3) {
      blanks.forEach(function (d) { fail(d[0], d[1] + ' is missing — enter all three parcel sizes (cm), or clear all three.'); });
    }

    var other = read('other', 'Other expenses', { example: '500' });
    var profit = read('profit', 'Target profit', { required: true, positive: true, example: '750' });
    if (model && profit !== null) {
      var band = profitBand(model, config);
      if (profit < band.min || profit > band.max) {
        fail('profit', 'Target profit for ' + band.label + ' must be between ' + formatZmw(band.min) + ' and ' + formatZmw(band.max) + '.');
      }
    }
    var sell = read('sell', 'Your selling price', { positive: true, example: '9500' });

    if (errors.length) return { ok: false, errors: errors };

    var factor = form.priceSource === 'benchmark' ? parseNumber(form.positioning) : 1;
    if (!(factor > 0)) factor = 1;
    var hasDims = dims.every(function (v) { return v !== null; });

    var ukPriceGbp = round2(price * factor);
    var ukPostageGbp = round2(postage || 0);
    var ukTotalGbp = round2(ukPriceGbp + ukPostageGbp);
    var productZmw = round2(ukTotalGbp * rate);
    var volumetric = hasDims ? volumetricKg(dims[0], dims[1], dims[2], config.volumetricDivisor) : 0;
    var chargeableKg = Math.max(actual, volumetric);
    var billedKg = billableKg(chargeableKg, config.shipping.weightStepKg);
    var shippingZmw = shippingCost(chargeableKg, config.shipping);
    var otherZmw = round2(other || 0);
    var landedZmw = round2(productZmw + shippingZmw + otherZmw);
    var recommendedZmw = roundUpToStep(landedZmw + profit, config.roundingStepZmw);

    return {
      ok: true,
      result: {
        model: model, priceSource: form.priceSource,
        enteredPriceGbp: price, positioningFactor: factor,
        ukPriceGbp: ukPriceGbp, ukPostageGbp: ukPostageGbp, ukTotalGbp: ukTotalGbp,
        rate: rate, productZmw: productZmw,
        actualKg: actual, hasDims: hasDims, volumetricKg: volumetric, chargeableKg: chargeableKg,
        billedKg: billedKg, shippingZmw: shippingZmw,
        otherZmw: otherZmw, landedZmw: landedZmw,
        targetProfitZmw: profit, recommendedZmw: recommendedZmw,
        roundingZmw: round2(recommendedZmw - (landedZmw + profit)),
        expectedProfitZmw: round2(recommendedZmw - landedZmw),   // actual rounded price minus landed cost
        sellPriceZmw: sell,
        profitAtSellPriceZmw: sell === null ? null : round2(sell - landedZmw)
      }
    };
  }

  return {
    parseNumber: parseNumber, roundUpToStep: roundUpToStep, round2: round2,
    formatNumber: formatNumber, formatZmw: formatZmw, formatGbp: formatGbp,
    generationOf: generationOf, categoryOf: categoryOf, profitBand: profitBand,
    buildCatalogue: buildCatalogue, optionLabel: optionLabel, groupLabel: groupLabel,
    volumetricKg: volumetricKg, billableKg: billableKg, shippingCost: shippingCost,
    evaluate: evaluate
  };
});
