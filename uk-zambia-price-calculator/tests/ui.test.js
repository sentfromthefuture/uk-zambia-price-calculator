'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const FILE = path.join(__dirname, '..', 'index.html');

async function load() {
  const calls = { scroll: 0, copied: [] };
  const dom = await JSDOM.fromFile(FILE, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(win) {
      win.Element.prototype.scrollIntoView = function () { calls.scroll++; };
      win.prompt = () => null;
      win.scrollTo = () => {};
      Object.defineProperty(win.navigator, 'clipboard', { value: { writeText: (t) => { calls.copied.push(t); return Promise.resolve(); } } });
    }
  });
  await new Promise((res) => dom.window.addEventListener('load', res));
  const w = dom.window, d = w.document;
  const $ = (id) => d.getElementById(id);
  return {
    w, d, $, calls,
    choose(id, v) { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); $(id).dispatchEvent(new w.Event('change', { bubbles: true })); },
    type(id, v) { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); },
    click(id) { $(id).click(); },
    close() { w.close(); }
  };
}

const XS_MAX = 'iphone-xs-max-64gb', I15 = 'iphone-15-128gb', I16PM = 'iphone-16-pro-max-256gb', I17PM = 'iphone-17-pro-max-256gb';

test('page loads without errors and the model list is fully populated', async () => {
  const p = await load();
  assert.equal(p.d.documentElement.getAttribute('data-ready'), 'true');
  assert.equal(p.$('fatal').hidden, true);
  const options = p.d.querySelectorAll('#model option');
  assert.ok(options.length >= 66 + 2 + 1, 'expected all catalogue models + 2 "other" + placeholder, got ' + options.length);
  [XS_MAX, I15, I16PM, I17PM, 'iphone-15-pro-256gb', 'iphone-14-pro-256gb'].forEach((id) =>
    assert.ok([...options].some((o) => o.value === id), 'missing option ' + id));
  p.close();
});

test('storage variants are clearly distinguished in the dropdown', async () => {
  const p = await load();
  const labels = [...p.d.querySelectorAll('#model option')].map((o) => o.textContent);
  assert.ok(labels.includes('iPhone 17 Pro Max — 256GB  ·  £822'));
  assert.ok(labels.includes('iPhone 17 Pro Max — 2TB  ·  £1128'));
  assert.equal(new Set(labels).size, labels.length, 'every option label must be unique');
  p.close();
});

test('every field has an info (i) button that opens an explanation with all four parts', async () => {
  const p = await load();
  const fields = [...p.d.querySelectorAll('.field')];
  assert.equal(fields.length, 10);
  for (const f of fields) {
    const btn = f.querySelector('.info'), panel = f.querySelector('.hint');
    assert.ok(btn && panel, 'missing hint on ' + f.dataset.field);
    assert.equal(panel.hidden, true);
    btn.click();
    assert.equal(panel.hidden, false);
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
    assert.deepEqual([...panel.querySelectorAll('dt')].map((x) => x.textContent), ['What it is', 'What to enter', 'Compulsory?', 'Affects']);
    btn.click();
    assert.equal(panel.hidden, true);
  }
  p.close();
});

test('key fields are marked required and optional ones are labelled optional', async () => {
  const p = await load();
  const badge = (key) => p.d.querySelector(`.field[data-field="${key}"] .badge`).textContent;
  ['model', 'price', 'rate', 'actual', 'profit'].forEach((k) => { assert.equal(badge(k), 'Required'); assert.ok(p.d.querySelector(`.field.key[data-field="${k}"]`)); });
  ['postage', 'positioning', 'dims', 'other', 'sell'].forEach((k) => assert.equal(badge(k), 'Optional'));
  p.close();
});

test('selecting models fills the benchmark and switches the profit range', async () => {
  const p = await load();
  p.choose('model', XS_MAX);
  assert.equal(p.$('price').value, '79');
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['500', '1000', '750']);

  p.choose('model', I15);
  assert.equal(p.$('price').value, '360');
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['500', '1000', '750']);

  p.choose('model', I16PM);
  assert.equal(p.$('price').value, '565');
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['2500', '5000', '3500']);

  p.choose('model', I17PM);
  assert.equal(p.$('price').value, '822');
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['2500', '5000', '3500']);

  p.choose('model', XS_MAX);                       // newer → older switches back
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['500', '1000', '750']);
  assert.equal(p.$('profitBand').textContent, 'iPhone 15 and older');
  p.close();
});

test('profit adjustment is kept within a category and the slider stays in sync', async () => {
  const p = await load();
  p.choose('model', I16PM);
  p.type('profit', '4200');
  assert.equal(p.$('profitRange').value, '4200');
  p.choose('model', I17PM);                         // same category → keep the user's choice
  assert.equal(p.$('profit').value, '4200');
  p.close();
});

test('Calculate with nothing entered shows errors, highlights fields, scrolls and focuses — never silent', async () => {
  const p = await load();
  p.click('calc');
  assert.equal(p.$('formBanner').hidden, false);
  assert.match(p.$('formBanner').textContent, /Fix/);
  assert.equal(p.$('err-model').hidden, false);
  assert.match(p.$('err-model').textContent, /Choose an iPhone model/);
  assert.equal(p.$('err-price').hidden, false);
  assert.equal(p.$('model').getAttribute('aria-invalid'), 'true');
  assert.ok(p.$('model').closest('.field').classList.contains('invalid'));
  assert.equal(p.$('r-recommended').textContent, '—');
  assert.ok(p.calls.scroll > 0, 'should scroll to the first problem');
  assert.equal(p.d.activeElement.id, 'model');
  p.close();
});

test('Calculate with a model but missing price/rate/weight highlights each one', async () => {
  const p = await load();
  p.choose('model', I15);
  p.type('price', ''); p.type('rate', ''); p.type('actual', '');
  p.click('calc');
  ['price', 'rate', 'actual'].forEach((id) => {
    assert.equal(p.$('err-' + id).hidden, false, id);
    assert.equal(p.$(id).getAttribute('aria-invalid'), 'true', id);
  });
  assert.equal(p.$('err-model').hidden, true);
  assert.equal(p.d.activeElement.id, 'price');
  assert.match(p.$('formBanner').textContent, /3 fields/);
  p.type('price', '300');                           // editing clears that field's error
  assert.equal(p.$('err-price').hidden, true);
  assert.equal(p.$('price').getAttribute('aria-invalid'), null);
  p.close();
});

test('invalid text and out-of-range profit are caught', async () => {
  const p = await load();
  p.choose('model', I15);
  p.type('price', 'abc'); p.type('profit', '3500');
  p.click('calc');
  assert.match(p.$('err-price').textContent, /must be a number/);
  assert.match(p.$('err-profit').textContent, /between K500 and K1,000/);
  p.close();
});

test('valid inputs calculate immediately and show a full breakdown', async () => {
  const p = await load();
  p.choose('model', I16PM);
  p.click('calc');
  assert.equal(p.$('formBanner').hidden, true);
  assert.equal(p.$('r-recommended').textContent, 'K20,350');
  assert.equal(p.$('r-uk').textContent, '£610.20');
  assert.match(p.$('r-uk-sub').textContent, /£565.00 benchmark \+ 8% uplift/);
  assert.equal(p.$('r-post').textContent, '£0.00');
  assert.equal(p.$('r-conv').textContent, 'K16,444.89');
  assert.equal(p.$('r-ship').textContent, 'K380.00');
  assert.equal(p.$('r-other').textContent, 'K0.00');
  assert.equal(p.$('r-landed').textContent, 'K16,824.89');
  assert.equal(p.$('r-target').textContent, 'K3,500');
  assert.equal(p.$('r-rec').textContent, 'K20,350');
  assert.equal(p.$('r-profit').textContent, 'K3,525.11');
  assert.equal(p.$('resBanner').hidden, false);
  assert.match(p.$('resBanner').textContent, /Calculated/);
  assert.ok(p.calls.scroll > 0, 'should scroll results into view');
  assert.equal(p.$('copyPrice').disabled, false);
  p.close();
});

test('a manually entered UK price is used as typed — no benchmark uplift', async () => {
  const p = await load();
  p.choose('model', I15);
  p.type('price', '400'); p.type('postage', '12.50');
  assert.equal(p.$('positioning').disabled, true);
  assert.equal(p.$('restoreBench').hidden, false);
  p.click('calc');
  assert.equal(p.$('r-uk').textContent, '£400.00');
  assert.match(p.$('r-uk-sub').textContent, /Price you entered/);
  assert.equal(p.$('r-post').textContent, '£12.50');
  assert.equal(p.$('r-conv').textContent, 'K11,116.88');   // 412.50 × 26.95
  p.click('restoreBench');
  assert.equal(p.$('price').value, '360');
  assert.equal(p.$('positioning').disabled, false);
  p.close();
});

test('volumetric weight is used when it is higher than actual weight', async () => {
  const p = await load();
  p.choose('model', I15);
  p.type('length', '40'); p.type('width', '30'); p.type('height', '20');
  assert.match(p.$('volPreview').textContent, /4\.00 kg — higher than actual/);
  p.click('calc');
  assert.equal(p.$('r-ship').textContent, 'K1,210.00');
  assert.match(p.$('r-ship-sub').textContent, /Billed as 4 kg · actual 1 kg, volumetric 4\.00 kg/);
  p.close();
});

test('partial parcel dimensions are rejected', async () => {
  const p = await load();
  p.choose('model', I15); p.type('length', '20');
  p.click('calc');
  assert.equal(p.$('err-dims').hidden, false);
  assert.match(p.$('err-dims').textContent, /all three/);
  assert.equal(p.$('width').getAttribute('aria-invalid'), 'true');
  p.close();
});

test('changing an input after calculating marks the result as out of date', async () => {
  const p = await load();
  p.choose('model', I15);
  p.click('calc');
  assert.equal(p.$('results').classList.contains('stale'), false);
  p.type('rate', '28');
  assert.equal(p.$('results').classList.contains('stale'), true);
  assert.match(p.$('resBanner').textContent, /press Calculate price/);
  p.click('calc');
  assert.equal(p.$('results').classList.contains('stale'), false);
  p.close();
});

test('own selling price shows the profit at that price', async () => {
  const p = await load();
  p.choose('model', I15);
  p.type('sell', '9000');
  p.click('calc');
  assert.equal(p.$('r-own-row').hidden, false);
  assert.match(p.$('r-own-label').textContent, /K9,000/);
  p.close();
});

test('copy price copies the recommended price', async () => {
  const p = await load();
  p.choose('model', I16PM);
  p.click('calc');
  p.click('copyPrice');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(p.calls.copied, ['K20,350']);
  p.click('copyAll');
  await new Promise((r) => setTimeout(r, 20));
  assert.match(p.calls.copied[1], /Recommended price: K20,350/);
  p.close();
});

test('reset restores defaults, clears errors and results', async () => {
  const p = await load();
  p.choose('model', I16PM);
  p.type('rate', '30'); p.type('postage', '9'); p.type('length', '10');
  p.click('calc');
  p.click('reset');
  assert.equal(p.$('model').value, '');
  assert.equal(p.$('price').value, '');
  assert.equal(p.$('rate').value, '26.95');
  assert.equal(p.$('postage').value, '0');
  assert.equal(p.$('actual').value, '1');
  assert.equal(p.$('length').value, '');
  assert.equal(p.$('positioning').value, '1.08');
  assert.deepEqual([p.$('profitRange').min, p.$('profitRange').max, p.$('profit').value], ['500', '1000', '750']);
  assert.equal(p.$('r-recommended').textContent, '—');
  assert.equal(p.$('copyPrice').disabled, true);
  assert.equal(p.$('formBanner').hidden, true);
  p.click('calc');                                  // still works after a reset
  assert.equal(p.$('err-model').hidden, false);
  p.close();
});
