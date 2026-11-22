# UK → Zambia iPhone Price Estimator

Mobile-first calculator for the landed cost and recommended Zambian selling price of iPhones bought from UK eBay sellers and shipped to Lusaka with Eastwing.

Live: https://sentfromthefuture.github.io/uk-zambia-price-calculator/

## How the price is worked out
1. **UK price** — pick a model to auto-fill a UK eBay benchmark, or type the actual eBay price over it.
2. Add **UK seller postage** (£).
3. Convert to kwacha with your **editable exchange rate**: `(UK price + postage) × rate`.
4. Add **Eastwing shipping** (higher of actual and volumetric weight) and **other expenses**.
5. `Landed cost = converted cost + shipping + other expenses`
6. `Recommended price = landed cost + target profit`, **rounded up to the next K50**.
7. `Expected profit = recommended price − landed cost` (so it includes the rounding).

The **benchmark uplift** (default 8%) applies *only* to the auto-filled benchmark. A price you type is used exactly as entered.

## Profit rules (preserved)
| Model | Target profit | Default |
|---|---|---|
| iPhone 15 and older (incl. SE, X, XS, XR) | K500–K1,000 | K750 |
| iPhone 16 and newer | K2,500–K5,000 | K3,500 |

The range switches automatically when the model changes; adjust within the range with the slider or by typing.

## Shipping
Volumetric weight = `Length × Width × Height ÷ 6000`, **with dimensions in centimetres**. The chargeable weight is the higher of actual and volumetric, billed in 0.5 kg steps (rounded up).

The Eastwing UK → Lusaka tariff is dated **03/03/2025** — confirm current rates before quoting.

## Updating rates, prices and models (no other code changes needed)
| What | File |
|---|---|
| Eastwing tariff, rate above 10 kg, default exchange rate, profit ranges, rounding step, uplift options | `js/config.js` |
| Models, storage and UK benchmark prices (`null` = no benchmark) | `js/catalogue.js` |

After editing, increase the `?v=` number on the `<script>` tags in `index.html` so phones load the new files instead of a cached copy.

## Project layout
- `index.html` — page structure
- `css/style.css` — styling
- `js/config.js` — editable settings
- `js/catalogue.js` — model + benchmark data
- `js/calc.js` — pure pricing/shipping/validation logic (no DOM)
- `js/app.js` — UI wiring (events, errors, results, hints, copy)
- `tests/` — automated tests

## Tests
```
npm install
npm test
```
- `tests/calc.test.js` — pricing, rounding, shipping tariff, volumetric weight, profit categories, validation.
- `tests/ui.test.js` — drives the real page (jsdom): model switching, Calculate with missing/valid input, reset, hints, copy.

## Notes on the benchmarks
Benchmarks are typical eBay UK prices for working, unlocked phones (completed sales over the prior 60 days where available, otherwise listing snapshots). They are starting points, not guaranteed prices — condition, battery health, parts history, boxed status and seller reputation all change the real price. Models/storage without a sourced benchmark are not given an invented price: choose them (or "Other model") and enter the price yourself.
