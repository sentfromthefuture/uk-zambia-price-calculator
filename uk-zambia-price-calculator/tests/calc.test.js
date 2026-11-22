'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/calc.js');
const CONFIG = require('../js/config.js');
const CAT = require('../js/catalogue.js');

const items = Calc.buildCatalogue(CAT.rows, CAT.extras, CONFIG);
const find = (label) => {
  const it = items.find((i) => i.name + ' ' + i.storage === label);
  assert.ok(it, 'model missing from catalogue: ' + label);
  return it;
};
const base = (over) => Object.assign({
  model: find('iPhone 16 Pro Max 256GB'), priceSource: 'manual', price: '500', postage: '0', positioning: '1.08',
  rate: '26.95', actual: '1', length: '', width: '', height: '', other: '0', profit: '3500', sell: ''
}, over);

/* ---------- parsing & rounding ---------- */
test('parseNumber handles blanks, symbols, thousands and decimal commas', () => {
  assert.equal(Calc.parseNumber(''), null);
  assert.equal(Calc.parseNumber('   '), null);
  assert.equal(Calc.parseNumber('26.95'), 26.95);
  assert.equal(Calc.parseNumber('1,200'), 1200);
  assert.equal(Calc.parseNumber('K1,200.50'), 1200.5);
  assert.equal(Calc.parseNumber('£450'), 450);
  assert.equal(Calc.parseNumber('26,95'), 26.95);
  assert.ok(Number.isNaN(Calc.parseNumber('abc')));
  assert.ok(Number.isNaN(Calc.parseNumber('12.3.4')));
  assert.ok(Number.isNaN(Calc.parseNumber('1e3')));
});

test('roundUpToStep always rounds UP to the next K50 and is float-safe', () => {
  assert.equal(Calc.roundUpToStep(21094.39, 50), 21100);
  assert.equal(Calc.roundUpToStep(7000, 50), 7000);
  assert.equal(Calc.roundUpToStep(7000.01, 50), 7050);
  assert.equal(Calc.roundUpToStep(6999.99, 50), 7000);
  assert.equal(Calc.roundUpToStep(0.1 + 0.2 + 6999.7, 50), 7000);   // float noise must not add a step
});

/* ---------- shipping ---------- */
test('billableKg rounds up to 0.5 kg steps', () => {
  assert.equal(Calc.billableKg(0.1, 0.5), 0.5);
  assert.equal(Calc.billableKg(0.5, 0.5), 0.5);
  assert.equal(Calc.billableKg(0.51, 0.5), 1);
  assert.equal(Calc.billableKg(1, 0.5), 1);
  assert.equal(Calc.billableKg(1.01, 0.5), 1.5);
});

test('shippingCost follows the Eastwing tariff table', () => {
  const s = CONFIG.shipping;
  assert.equal(Calc.shippingCost(0, s), 0);
  assert.equal(Calc.shippingCost(0.1, s), 270);
  assert.equal(Calc.shippingCost(0.5, s), 270);
  assert.equal(Calc.shippingCost(0.51, s), 380);
  assert.equal(Calc.shippingCost(1, s), 380);
  assert.equal(Calc.shippingCost(1.01, s), 490);
  assert.equal(Calc.shippingCost(4, s), 1210);
  assert.equal(Calc.shippingCost(10, s), 3025);
});

test('shippingCost above the tariff adds the configured per-0.5kg amount', () => {
  const s = CONFIG.shipping;
  assert.equal(Calc.shippingCost(10.01, s), 3025 + 150);
  assert.equal(Calc.shippingCost(10.5, s), 3025 + 150);
  assert.equal(Calc.shippingCost(11, s), 3025 + 300);
});

test('shipping rates are read from config, not hardcoded', () => {
  const custom = Object.assign({}, CONFIG.shipping, { tariff: [[1, 100], [2, 200]], extraPerStepAboveMax: 10 });
  assert.equal(Calc.shippingCost(0.7, custom), 100);
  assert.equal(Calc.shippingCost(1.2, custom), 200);
  assert.equal(Calc.shippingCost(2.5, custom), 210);
});

test('tariff table is sane: weights and prices strictly increase', () => {
  const t = CONFIG.shipping.tariff;
  for (let i = 1; i < t.length; i++) {
    assert.ok(t[i][0] > t[i - 1][0], 'weights must increase at row ' + i);
    assert.ok(t[i][1] > t[i - 1][1], 'prices must increase at row ' + i);
  }
  assert.equal(t[0][0], CONFIG.shipping.weightStepKg);
});

test('volumetric weight = L × W × H (cm) ÷ 6000', () => {
  assert.equal(Calc.volumetricKg(40, 30, 20, 6000), 4);
  assert.equal(Calc.volumetricKg(20, 12, 8, 6000), 0.32);
  assert.equal(Calc.volumetricKg(30, 20, 10, 6000), 1);
});

test('chargeable weight is the HIGHER of actual and volumetric', () => {
  const big = Calc.evaluate(base({ actual: '1', length: '40', width: '30', height: '20' }), CONFIG).result;
  assert.equal(big.volumetricKg, 4);
  assert.equal(big.chargeableKg, 4);
  assert.equal(big.shippingZmw, 1210);
  const small = Calc.evaluate(base({ actual: '1', length: '20', width: '12', height: '8' }), CONFIG).result;
  assert.equal(small.volumetricKg, 0.32);
  assert.equal(small.chargeableKg, 1);
  assert.equal(small.shippingZmw, 380);
});

/* ---------- catalogue & profit categories ---------- */
test('catalogue contains the required models and the two restored ones', () => {
  ['iPhone XS Max 64GB', 'iPhone XS Max 256GB', 'iPhone 15 128GB', 'iPhone 15 Pro 256GB', 'iPhone 14 Pro 256GB',
    'iPhone 16 Pro Max 256GB', 'iPhone 17 Pro Max 256GB', 'iPhone 17 Pro Max 2TB'].forEach(find);
  assert.ok(items.length >= 66);
});

test('catalogue ids are unique and prices are positive or null (none invented)', () => {
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  items.forEach((i) => assert.ok(i.benchmarkGbp === null || i.benchmarkGbp > 0, i.id));
  CAT.rows.forEach((r) => assert.equal(items.find((i) => i.name + ' ' + i.storage === r[0] + ' ' + r[1]).benchmarkGbp, r[2] > 0 ? r[2] : null));
});

test('profit category: iPhone 15 and older vs iPhone 16 and newer', () => {
  const cat = (l) => find(l).category;
  assert.equal(cat('iPhone XS Max 64GB'), 'older');
  assert.equal(cat('iPhone XR 64GB'), 'older');
  assert.equal(cat('iPhone X 64GB'), 'older');
  assert.equal(cat('iPhone SE 2022 64GB'), 'older');      // 2022 must not be read as generation 2022
  assert.equal(cat('iPhone SE 2020 64GB'), 'older');
  assert.equal(cat('iPhone 8 64GB'), 'older');
  assert.equal(cat('iPhone 15 128GB'), 'older');
  assert.equal(cat('iPhone 15 Pro 256GB'), 'older');
  assert.equal(cat('iPhone 15 Pro Max 256GB'), 'older');
  assert.equal(cat('iPhone 16 128GB'), 'newer');
  assert.equal(cat('iPhone 16 Pro Max 256GB'), 'newer');
  assert.equal(cat('iPhone 17 Pro Max 256GB'), 'newer');
  assert.equal(cat('iPhone 17e 256GB'), 'newer');
  assert.equal(cat('iPhone 18 Pro 256GB'), 'newer');
  assert.equal(items.find((i) => i.id === 'other-older').category, 'older');
  assert.equal(items.find((i) => i.id === 'other-newer').category, 'newer');
});

test('profit bands and defaults match the business rules', () => {
  const o = Calc.profitBand(find('iPhone 15 128GB'), CONFIG), n = Calc.profitBand(find('iPhone 16 128GB'), CONFIG);
  assert.deepEqual([o.min, o.max, o.default], [500, 1000, 750]);
  assert.deepEqual([n.min, n.max, n.default], [2500, 5000, 3500]);
});

test('generation override works for names without a number', () => {
  const [air] = Calc.buildCatalogue([['iPhone Air', '256GB', null, 0, 17]], [], CONFIG);
  assert.equal(air.category, 'newer');
  assert.equal(air.benchmarkGbp, null);
});

/* ---------- pricing formula ---------- */
test('iPhone 16 Pro Max (benchmark + 8% uplift, postage, other expenses) — worked example', () => {
  const r = Calc.evaluate(base({ priceSource: 'benchmark', price: '565', postage: '10', other: '500' }), CONFIG).result;
  assert.equal(r.ukPriceGbp, 610.2);            // 565 × 1.08
  assert.equal(r.ukTotalGbp, 620.2);
  assert.equal(r.productZmw, 16714.39);         // 620.20 × 26.95
  assert.equal(r.shippingZmw, 380);
  assert.equal(r.landedZmw, 17594.39);
  assert.equal(r.recommendedZmw, 21100);        // 17,594.39 + 3,500 → next K50
  assert.equal(r.expectedProfitZmw, 3505.61);   // rounded price − landed
  assert.equal(r.roundingZmw, 5.61);
});

test('iPhone XS Max older-model example with default K750 profit', () => {
  const r = Calc.evaluate(base({ model: find('iPhone XS Max 64GB'), priceSource: 'benchmark', price: '79', profit: '750' }), CONFIG).result;
  assert.equal(r.ukPriceGbp, 85.32);
  assert.equal(r.productZmw, 2299.37);
  assert.equal(r.landedZmw, 2679.37);
  assert.equal(r.recommendedZmw, 3450);
  assert.equal(r.expectedProfitZmw, 770.63);
});

test('a typed (actual) UK price never gets the benchmark uplift', () => {
  const m = find('iPhone 15 128GB');
  const manual = Calc.evaluate(base({ model: m, priceSource: 'manual', price: '360', postage: '5', profit: '750' }), CONFIG).result;
  assert.equal(manual.positioningFactor, 1);
  assert.equal(manual.ukPriceGbp, 360);
  assert.equal(manual.productZmw, 9836.75);      // (360 + 5) × 26.95
  assert.equal(manual.landedZmw, 10216.75);
  assert.equal(manual.recommendedZmw, 11000);
  assert.equal(manual.expectedProfitZmw, 783.25);
  const bench = Calc.evaluate(base({ model: m, priceSource: 'benchmark', price: '360', postage: '5', profit: '750' }), CONFIG).result;
  assert.equal(bench.positioningFactor, 1.08);
  assert.ok(bench.recommendedZmw > manual.recommendedZmw);
});

test('displayed expected profit always equals recommended price minus landed cost', () => {
  for (const price of ['101.01', '233.33', '417', '999.99']) {
    for (const rate of ['25.5', '26.95', '27.333']) {
      const r = Calc.evaluate(base({ price, rate, profit: '3500' }), CONFIG).result;
      assert.equal(r.expectedProfitZmw, Calc.round2(r.recommendedZmw - r.landedZmw));
      assert.equal(r.recommendedZmw % 50, 0);
      assert.ok(r.recommendedZmw >= r.landedZmw + 3500 - 1e-9);
      assert.ok(r.recommendedZmw - (r.landedZmw + 3500) < 50);
    }
  }
});

test('exchange rate is editable and drives the conversion', () => {
  const a = Calc.evaluate(base({ price: '100', rate: '20' }), CONFIG).result;
  const b = Calc.evaluate(base({ price: '100', rate: '30' }), CONFIG).result;
  assert.equal(a.productZmw, 2000);
  assert.equal(b.productZmw, 3000);
});

test('own selling price shows profit at that price without changing the recommendation', () => {
  const r = Calc.evaluate(base({ price: '100', rate: '20', sell: '5000' }), CONFIG).result;
  assert.equal(r.landedZmw, 2380);
  assert.equal(r.profitAtSellPriceZmw, 2620);
  assert.equal(r.recommendedZmw, 5900);
});

/* ---------- validation ---------- */
test('missing required inputs are all reported, in on-screen order', () => {
  const out = Calc.evaluate(base({ model: null, price: '', rate: '', actual: '', profit: '' }), CONFIG);
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors.map((e) => e.field), ['model', 'price', 'rate', 'actual', 'profit']);
  out.errors.forEach((e) => assert.ok(e.message.length > 10));
});

test('invalid values are rejected with a helpful message', () => {
  const bad = (over, field) => {
    const out = Calc.evaluate(base(over), CONFIG);
    assert.equal(out.ok, false);
    assert.ok(out.errors.some((e) => e.field === field), 'expected error on ' + field);
  };
  bad({ price: 'abc' }, 'price');
  bad({ price: '0' }, 'price');
  bad({ price: '-5' }, 'price');
  bad({ rate: '0' }, 'rate');
  bad({ actual: '-1' }, 'actual');
  bad({ postage: '-2' }, 'postage');
  bad({ other: '-100' }, 'other');
  bad({ sell: '-1' }, 'sell');
});

test('parcel dimensions must be all three or none', () => {
  const out = Calc.evaluate(base({ length: '20', width: '', height: '' }), CONFIG);
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors.map((e) => e.field), ['width', 'height']);
  assert.equal(Calc.evaluate(base({ length: '', width: '', height: '' }), CONFIG).ok, true);
});

test('target profit must sit inside the band for the model', () => {
  assert.equal(Calc.evaluate(base({ model: find('iPhone 15 128GB'), profit: '3500' }), CONFIG).ok, false);
  assert.equal(Calc.evaluate(base({ model: find('iPhone 15 128GB'), profit: '1000' }), CONFIG).ok, true);
  assert.equal(Calc.evaluate(base({ model: find('iPhone 15 128GB'), profit: '450' }), CONFIG).ok, false);
  assert.equal(Calc.evaluate(base({ model: find('iPhone 17 Pro Max 256GB'), profit: '750' }), CONFIG).ok, false);
  assert.equal(Calc.evaluate(base({ model: find('iPhone 17 Pro Max 256GB'), profit: '5000' }), CONFIG).ok, true);
});

test('formatting helpers', () => {
  assert.equal(Calc.formatZmw(21100), 'K21,100');
  assert.equal(Calc.formatZmw(3505.61, 2), 'K3,505.61');
  assert.equal(Calc.formatZmw(-120.5, 2), '-K120.50');
  assert.equal(Calc.formatGbp(610.2), '£610.20');
});
