/**
 * Shared tokenizer for Mamash language.
 * Centralizes tokenization so both highlighter and linter use identical logic.
 */
 
export type Tok =
  | { type: "Keyword"; value: string; from: number; to: number }
  | { type: "Ident"; value: string; from: number; to: number }
  | { type: "Number"; value: string; from: number; to: number }
  | { type: "Op"; value: string; from: number; to: number }
  | { type: "Period"; from: number; to: number }
  | { type: "ParenOpen"; from: number; to: number }
  | { type: "ParenClose"; from: number; to: number }
  | { type: "WS"; value: string; from: number; to: number }
  | { type: "Comment"; value: string; from: number; to: number }
  | { type: "Unknown"; value: string; from: number; to: number };
 
export const hebrewIdStart = /[\u0590-\u05FFA-Za-z_]/;
export const hebrewIdPart = /[\u0590-\u05FFA-Za-z0-9_]/;
 
export const KEYWORDS = new Set([
  "אם", // if
  "אזי", // then
  "אחרת", // else
  "לכל", // for each
  "יהא", // let/assign
  "שוה", // equals
  "גדול", // greater
  "קטן", // less
]);
 
export function* tokenize(s: string): Generator<Tok> {
  let i = 0;
  const len = s.length;
  while (i < len) {
    const ch = s[i];

    // Block comment /* ... */
    if (ch === "/" && i + 1 < len && s[i + 1] === "*") {
      let j = i + 2;
      while (j + 1 < len && !(s[j] === "*" && s[j + 1] === "/")) j++;
      if (j + 1 < len) {
        // Found closing */
        j += 2;
        yield { type: "Comment", value: s.slice(i, j), from: i, to: j };
        i = j;
        continue;
      } else {
        // Unterminated comment consumes to end; still treated as Comment so linter ignores it
        const to = len;
        yield { type: "Comment", value: s.slice(i, to), from: i, to };
        i = to;
        continue;
      }
    }
 
    // Whitespace
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < len && /\s/.test(s[j])) j++;
      yield { type: "WS", value: s.slice(i, j), from: i, to: j };
      i = j;
      continue;
    }
 
    // Period
    if (ch === ".") {
      yield { type: "Period", from: i, to: i + 1 };
      i++;
      continue;
    }
 
    // Parentheses
    if (ch === "(") {
      yield { type: "ParenOpen", from: i, to: i + 1 };
      i++;
      continue;
    }
    if (ch === ")") {
      yield { type: "ParenClose", from: i, to: i + 1 };
      i++;
      continue;
    }
 
    // Operators
    if ("+-*/=:".includes(ch)) {
      yield { type: "Op", value: ch, from: i, to: i + 1 };
      i++;
      continue;
    }
 
    // Number
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9]/.test(s[j])) j++;
      yield { type: "Number", value: s.slice(i, j), from: i, to: j };
      i = j;
      continue;
    }
 
    // Identifier (Hebrew or Latin letters + digits/_)
    if (hebrewIdStart.test(ch)) {
      let j = i + 1;
      while (j < len && hebrewIdPart.test(s[j])) j++;
      const word = s.slice(i, j);
      if (KEYWORDS.has(word)) {
        yield { type: "Keyword", value: word, from: i, to: j };
      } else {
        yield { type: "Ident", value: word, from: i, to: j };
      }
      i = j;
      continue;
    }
 
    // Unknown char
    yield { type: "Unknown", value: ch, from: i, to: i + 1 };
    i++;
  }
}