# UK → Zambia iPhone Price Estimator

A mobile-friendly calculator for UK-to-Zambia iPhone preorder listings.

## Pricing logic
1. Select a model/storage benchmark seeded from UK eBay market research.
2. The default market-positioning factor is 8% above the benchmark, with options for 0%, 5%, or 12%.
3. Add UK seller postage in GBP.
4. Convert the UK purchase amount using your editable GBP/ZMW rate.
5. Add Eastwing UK-within-Lusaka courier shipping and other ZMW expenses.
6. Add a target gross profit between K500 and K1,000.
7. Round the recommended listing price up to the next K50.

Formula:

`Recommended price = roundUp50(((UK benchmark × positioning factor + UK postage) × GBP/ZMW) + courier shipping + other costs + target profit)`

## Market benchmark notes
The seeded catalogue combines:
- Typical completed-sale benchmarks for working, unlocked iPhones aggregated from 5,323 eBay UK sales over the previous 60 days (PathAu).
- Selected live eBay UK listing snapshots for models/storage combinations not present in that completed-sale dataset.

These are starting estimates, not guarantees of a seller's asking price or the exact price you will pay. Condition, battery health, parts history, storage, seller postage, boxed status and seller reputation can materially change the price. If the exact eBay listing is available, enter its price manually. Some model/storage combinations are not covered; enter the current price yourself.

## Shipping
The embedded Eastwing table uses the UK-within-Lusaka tariff image supplied by the user, dated 03/03/2025. Confirm current rates before quoting. Volumetric weight = `Length × Width × Height ÷ 6000` (dimensions in mm). Chargeable weight is the higher of actual and volumetric weight.

## Important
Gross profit is calculated before any expenses not entered in the form. The GBP/ZMW rate should reflect the actual rate/payment conversion cost you incur, not necessarily the mid-market rate. Include customs, payment fees, local delivery and any other costs in **Other expenses**.
