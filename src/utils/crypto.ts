/**
 * Compare two strings in constant time relative to the longer string's length.
 * Use this for token / secret comparisons to avoid timing side-channel attacks.
 *
 * Using === short-circuits on the first byte difference, leaking the
 * prefix-length-match through timing. An attacker controlling the input can
 * extract the correct token byte-by-byte via timing oracle in
 * O(256 × 32 × N samples) requests.
 *
 * NOTE: Once Web Crypto's timingSafeEqual ships universally
 * (https://github.com/whatwg/webcrypto/issues/270), prefer that. For now
 * we use a XOR-accumulator loop that always iterates over the full length.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#timing-attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= (ca ^ cb);
  }
  return mismatch === 0;
}
