import { keccak256, toHex, type Hex } from 'viem'

/**
 * Hash a trace via canonical-JSON keccak256.
 *
 * Canonicalization: top-level keys sorted alphabetically. Nested objects are
 * not recursively sorted because `JSON.stringify(obj, sortedKeys)` only applies
 * the replacer to the top level. If your trace has stable nested key ordering
 * (e.g. always built from the same schema), this is sufficient and matches the
 * Stoa reference implementation.
 *
 * For stricter canonicalization (recursive sort, NFC normalization), wrap your
 * own canonicalizer and pass the resulting string to keccak256(toHex(...)).
 */
export function hashTrace(trace: Record<string, unknown>): Hex {
  const encoded = JSON.stringify(trace, Object.keys(trace).sort())
  return keccak256(toHex(encoded))
}
