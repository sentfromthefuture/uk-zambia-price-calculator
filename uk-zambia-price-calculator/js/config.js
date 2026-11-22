/*
 * CONFIG — everything you may want to change lives here (rates, tariff, profit ranges).
 * After editing, bump the ?v= number on the <script> tags in index.html so phones reload it.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalcConfig = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    defaultExchangeRate: 26.95,   // K per £1 — always editable in the form
    defaultWeightKg: 1,
    roundingStepZmw: 50,          // recommended price is rounded UP to the next K50
    volumetricDivisor: 6000,      // volumetric kg = length(cm) × width(cm) × height(cm) ÷ 6000

    shipping: {
      carrier: 'Eastwing',
      route: 'UK → Lusaka',
      tariffDate: '03/03/2025',
      confirmedCurrent: false,    // set true once you have confirmed the rates are still current
      weightStepKg: 0.5,          // parcels are billed in 0.5 kg steps (rounded up)
      // [billed weight up to (kg), price (K)] — update these rows when Eastwing changes its rates
      tariff: [
        [0.5, 270], [1, 380], [1.5, 490], [2, 625], [2.5, 765],
        [3, 905], [3.5, 1060], [4, 1210], [4.5, 1360], [5, 1510],
        [5.5, 1660], [6, 1815], [6.5, 1960], [7, 2115], [7.5, 2265],
        [8, 2415], [8.5, 2565], [9, 2715], [9.5, 2810], [10, 3025]
      ],
      // Above the last tariff row, each extra 0.5 kg is charged at this amount (K).
      extraPerStepAboveMax: 150
    },

    profit: {
      newerFromGeneration: 16,    // iPhone 16 and newer use the "newer" range
      older: { label: 'iPhone 15 and older', min: 500,  max: 1000, default: 750,  step: 50 },
      newer: { label: 'iPhone 16 and newer', min: 2500, max: 5000, default: 3500, step: 50 }
    },

    positioning: {                // uplift on the BENCHMARK price only (never on a price you type)
      default: 1.08,
      options: [
        { factor: 1,    label: 'Typical sold price (no uplift)' },
        { factor: 1.05, label: '5% above typical' },
        { factor: 1.08, label: '8% above typical' },
        { factor: 1.12, label: '12% above typical' }
      ]
    }
  };
});
