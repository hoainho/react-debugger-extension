/**
 * Compare two strings in constant time to avoid timing side-channel attacks.
 * Use this for token / secret comparisons instead of ===.
 *
 * Using === short-circuits on the first byte difference, leaking the
 * prefix-length-match through timing. An attacker controlling the input can
 * extract the correct token byte-by-byte via timing oracle in
 * O(256 × 32 × N samples) requests.
 *
 * This implementation returns false immediately on length mismatch (safe
 * because token lengths are fixed and public), then uses a XOR-accumulator
 * loop with no branching to compare all bytes in constant time.
 *
 * NOTE: Once Web Crypto's timingSafeEqual ships universally
 * (https://github.com/whatwg/webcrypto/issues/270), prefer that.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#timing-attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
