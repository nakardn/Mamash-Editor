/**
 * Shared tokenizer for Mamash language.
 * Centralizes tokenization so both highlighter and linter use identical logic.
**/

type Interval = {
  from: number;
  to: number;
};

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
 
export const hebrewIdStart = /[\u0590-\u05FF_]/;
export const hebrewIdPart = /[\u0590-\u05FF0-9_]/;
 
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
  let commentCount = 0;
  let commentStart = 0;
let commentStack : Interval[] = [];
  const len1 = s.length;
  while (i < len1) {
    const ch = s[i];


    if (ch === "/" && i + 1 < len1 && s[i + 1] === "*") {
      commentCount++;
      if (commentStart === 0 && commentCount === 1) {
        commentStart = i;
      }
      i++;
    } else if (ch === "*" && i + 1 < len1 && s[i + 1] === "/") {
      commentCount--;
      if (commentCount === 0) {
        commentStack.push({from: commentStart, to: i + 2});
        commentStart = 0;
      } else if (commentCount < 0) {
        commentStack.push({from: commentStart, to: i + 2});
        commentCount = 0; // reset to avoid further issues
        commentStart = 0;
      }
      i++;
    }
  i++;
  }

  if (commentStack.length > 0){
    // Create a sorted copy
    const sortedIntervals = [...commentStack].sort((a, b) => a.from - b.from);
    
    // Merge overlapping intervals
    const mergedIntervals: Interval[] = [sortedIntervals[0]];
    for (let i = 1; i < sortedIntervals.length; i++) {
      const lastMerged = mergedIntervals[mergedIntervals.length - 1];
      const current = sortedIntervals[i];
      if (current.from < lastMerged.to) {
        // Overlap detected, merge them by extending the 'to'
        lastMerged.to = Math.max(lastMerged.to, current.to);
      } else {
        // No overlap, just add the new interval
        mergedIntervals.push(current);
      }
    }
    commentStack = mergedIntervals;
  } 


  i = 0;
  while (commentStack.length != 0 && i < commentStack.length) {
    const currentInterval = commentStack[i];
    yield { type: "Comment", value: s.slice(currentInterval.from, currentInterval.to), from: currentInterval.from, to: currentInterval.to };
    i++;
  }

  i = 0;
  let intervalIndex = 0;
  const len = s.length;
  while (i < len) {
    const ch = s[i];

    const currentInterval = commentStack[intervalIndex];
    if (currentInterval && i >= currentInterval.from) {
      i = currentInterval.to;
      intervalIndex++;
      continue;
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
 
    // Identifier (Hebrew letters + digits/_)
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