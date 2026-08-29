// Shared combinatorial generators - used by handEvaluator.js (table
// generation over 13 ranks, runtime 5-of-7 card selection) and
// equityEngine.js (exact-enumeration runouts). Generators so callers don't
// materialize every combination array at once.

// All k-index-combinations of n items, in lexicographic order.
export function* combinations(n, k) {
  if (k > n || k < 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.slice();
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

export function* combinationsOf(arr, k) {
  for (const idx of combinations(arr.length, k)) yield idx.map(i => arr[i]);
}

// C(n, k), for deciding whether a combination count is cheap enough to
// enumerate exactly before actually generating them.
export function combinationsCount(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}
