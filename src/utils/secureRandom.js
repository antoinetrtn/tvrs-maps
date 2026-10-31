/** Unbiased integer in [min, maxExclusive) from crypto.getRandomValues (rejection sampling). */
export function secureRandomInt(min, maxExclusive) {
  const range = maxExclusive - min;
  const maxUnbiased = Math.floor(0x100000000 / range) * range;
  const arr = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(arr);
  } while (arr[0] >= maxUnbiased);
  return min + (arr[0] % range);
}
