/**
 * Model matching for model-skill-gate rules.
 *
 * Semantics (settled decision D2):
 * - Case-insensitive.
 * - A pattern is matched against two candidate strings: the bare model id and
 *   `${provider}/${id}` (same surface as pi's enabledModels scoping).
 * - Patterns containing glob chars (`*`, `?`, `[...]`) are compiled to an
 *   anchored regex; patterns without glob chars are exact matches.
 */

export interface ModelRef {
  provider: string;
  id: string;
}

const GLOB_CHARS = /[*?[\]]/;

/** True when the pattern has any glob syntax. */
export function hasGlob(pattern: string): boolean {
  return GLOB_CHARS.test(pattern);
}

/** Compile a glob subset (`*`, `?`, `[...]`) to an anchored regex source. */
export function globToRegExpSource(pattern: string): string {
  const ESCAPABLE = /[.+^${}()|[\]\\]/;
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === "*") {
      out += ".*";
      i += 1;
    } else if (ch === "?") {
      out += ".";
      i += 1;
    } else if (ch === "[") {
      // Copy a balanced bracket expression verbatim (glob character classes).
      let j = i + 1;
      if (pattern[j] === "!" || pattern[j] === "^") j += 1;
      if (pattern[j] === "]") j += 1; // literal ] as first member
      while (j < pattern.length && pattern[j] !== "]") j += 1;
      if (j < pattern.length) {
        out += pattern.slice(i, j + 1);
        i = j + 1;
      } else {
        out += "\\[";
        i += 1;
      }
    } else {
      out += ESCAPABLE.test(ch) ? "\\" + ch : ch;
      i += 1;
    }
  }
  return out;
}

/** Match one pattern against one candidate string (both pre-lowercased). */
export function matchPattern(pattern: string, candidate: string): boolean {
  if (!hasGlob(pattern)) return candidate === pattern;
  const re = new RegExp("^" + globToRegExpSource(pattern) + "$");
  return re.test(candidate);
}

/**
 * True when the model matches at least one of the rule patterns.
 * Matches bare model id OR `${provider}/${id}`, case-insensitive.
 */
export function modelMatches(model: ModelRef, patterns: readonly string[]): boolean {
  const id = model.id.toLowerCase();
  const qualified = `${model.provider}/${model.id}`.toLowerCase();
  const candidates = [id, qualified];
  for (const raw of patterns) {
    const pattern = raw.toLowerCase();
    for (const candidate of candidates) {
      if (matchPattern(pattern, candidate)) return true;
    }
  }
  return false;
}
