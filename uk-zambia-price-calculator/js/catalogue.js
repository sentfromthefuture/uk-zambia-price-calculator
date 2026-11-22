/*
 * MODEL CATALOGUE — one row per model + storage:
 *   [name, storage, UK benchmark £ (null = no benchmark, enter price manually), sample size, optional generation override]
 * Sample size = number of eBay UK sales behind the figure; 0 = an eBay listing snapshot rather than completed sales.
 * Do not add prices you have not sourced: use null and the calculator asks for the price instead.
 * Generation (for the profit range) is read from the name ("iPhone 17 Pro" → 17); SE/X/XS/XR count as older.
 * For a name with no number (e.g. 'iPhone Air') add the 5th value, e.g. ['iPhone Air', '256GB', null, 0, 17].
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalcCatalogue = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    rows: [
    ['iPhone 18 Pro', '256GB', 996, 42],
    ['iPhone 18 Pro Max', '256GB', 1150, 29],
    ['iPhone 18 Pro Max', '512GB', 1330, 17],

    ['iPhone 17', '256GB', 598, 104],
    ['iPhone 17 Pro', '256GB', 752, 226],
    ['iPhone 17 Pro', '512GB', 823, 29],
    ['iPhone 17 Pro', '1TB', 910, 9],
    ['iPhone 17 Pro Max', '256GB', 822, 298],
    ['iPhone 17 Pro Max', '512GB', 876, 77],
    ['iPhone 17 Pro Max', '1TB', 964, 36],
    ['iPhone 17 Pro Max', '2TB', 1128, 18],
    ['iPhone 17e', '256GB', 493, 22],

    ['iPhone 16', '128GB', 385, 124],
    ['iPhone 16', '256GB', 433, 20],
    ['iPhone 16 Plus', '128GB', 435, 53],
    ['iPhone 16 Plus', '256GB', 513, 18],
    ['iPhone 16 Pro', '128GB', 495, 0],
    ['iPhone 16 Pro Max', '256GB', 565, 0],

    ['iPhone 15', '128GB', 360, 110],
    ['iPhone 15 Pro', '256GB', 396, 43],
    ['iPhone 15 Pro Max', '256GB', 450, 0],

    ['iPhone 14', '128GB', 260, 357],
    ['iPhone 14 Pro', '256GB', 345, 0],
    ['iPhone 14 Pro Max', '256GB', 430, 0],

    ['iPhone 13', '256GB', 165, 21],
    ['iPhone 13 Mini', '128GB', 141, 74],
    ['iPhone 13 Pro', '128GB', 200, 70],
    ['iPhone 13 Pro', '256GB', 223, 36],
    ['iPhone 13 Pro Max', '128GB', 232, 80],
    ['iPhone 13 Pro Max', '256GB', 261, 57],
    ['iPhone 13 Pro Max', '512GB', 286, 10],
    ['iPhone 13 Pro Max', '1TB', 310, 12],

    ['iPhone 12', '64GB', 96, 121],
    ['iPhone 12', '128GB', 109, 42],
    ['iPhone 12', '256GB', 126, 13],
    ['iPhone 12 Mini', '64GB', 90, 74],
    ['iPhone 12 Mini', '128GB', 95, 40],
    ['iPhone 12 Pro', '128GB', 136, 58],
    ['iPhone 12 Pro', '256GB', 151, 28],
    ['iPhone 12 Pro Max', '128GB', 172, 55],
    ['iPhone 12 Pro Max', '256GB', 208, 36],
    ['iPhone 12 Pro Max', '512GB', 215, 17],

    ['iPhone 11', '64GB', 79, 218],
    ['iPhone 11', '128GB', 89, 59],
    ['iPhone 11', '256GB', 105, 9],
    ['iPhone 11 Pro', '64GB', 89, 35],
    ['iPhone 11 Pro', '256GB', 124, 26],
    ['iPhone 11 Pro Max', '64GB', 105, 23],
    ['iPhone 11 Pro Max', '256GB', 157, 25],

    ['iPhone XS Max', '64GB', 79, 11],
    ['iPhone XS Max', '256GB', 91, 14],
    ['iPhone XS', '64GB', 61, 26],
    ['iPhone XS', '256GB', 71, 11],
    ['iPhone XR', '64GB', 60, 119],
    ['iPhone XR', '128GB', 70, 32],
    ['iPhone X', '64GB', 58, 53],
    ['iPhone X', '256GB', 74, 12],
    ['iPhone SE 2022', '64GB', 70, 48],
    ['iPhone SE 2022', '128GB', 85, 19],
    ['iPhone SE 2020', '64GB', 50, 64],
    ['iPhone SE 2020', '128GB', 51, 16],

    ['iPhone 8', '64GB', 45, 34],
    ['iPhone 8 Plus', '64GB', 49, 28],
    ['iPhone 8 Plus', '256GB', 73, 8],

    ['iPhone 7 Plus', '128GB', 48, 9],

    ['iPhone 5', '16GB', 54, 8]
    ],
    // Fallback choices so any phone can still be priced and gets the right profit range.
    extras: [
      { id: 'other-older', name: 'Other model — iPhone 15 or older (not listed)', generation: 15 },
      { id: 'other-newer', name: 'Other model — iPhone 16 or newer (not listed)', generation: 16 }
    ]
  };
});
