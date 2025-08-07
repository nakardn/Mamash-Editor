import { Diagnostic, LintResult } from "./types";
import { Tok, tokenize } from "../lang/tokenizer";

export function lintText(text: string): LintResult {
  const diagnostics: Diagnostic[] = [];
  const parenStack: number[] = [];

  let lastNonWsTok: Tok | null = null;
  let lastTok: Tok | null = null;
  let stmtHasContent = false;

  // Helper to emit diag
  const push = (from: number, to: number, message: string, code: string) => {
    diagnostics.push({ from, to, message, severity: "error", code });
  };

  // Treat comments like whitespace for linting purposes
  const isIgnorable = (t: Tok | null | undefined) => !!t && (t.type === "WS" || t.type === "Comment");

  // Simple helpers
  const isOperandLike = (t: Tok | null) =>
    !!t && (t.type === "Ident" || t.type === "Number" || t.type === "ParenClose");
  const isOperator = (t: Tok | null) => !!t && t.type === "Op";

  const tokens: Tok[] = [];
  for (const tok of tokenize(text)) tokens.push(tok);

  const prevNonIgnorable = (arr: Tok[], i: number): Tok | null => {
    for (let k = i; k >= 0; k--) {
      const t = arr[k];
      if (!isIgnorable(t)) return t;
    }
    return null;
  };
  const nextNonIgnorable = (arr: Tok[], i: number): Tok | null => {
    for (let k = i; k < arr.length; k++) {
      const t = arr[k];
      if (!isIgnorable(t)) return t;
    }
    return null;
  };

  // Pass 1: low-level token checks
  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];

    // Unknown character
    if (tok.type === "Unknown") {
      push(tok.from, tok.to, "Unknown character", "syntax/unknown-char");
    }

    // Paren balance
    if (tok.type === "ParenOpen") {
      parenStack.push(tok.from);
    } else if (tok.type === "ParenClose") {
      if (parenStack.length === 0) {
        push(tok.from, tok.to, "Unmatched closing parenthesis", "syntax/unmatched-close-paren");
      } else {
        parenStack.pop();
      }
    }

    // Period checks: redundant consecutive periods
    if (tok.type === "Period") {
      if (lastNonWsTok && lastNonWsTok.type === "Period") {
        push(tok.from, tok.to, "Redundant period", "syntax/redundant-period");
      }
      // statement boundary
      stmtHasContent = false;
    } else {
      // Not a period, counts as content for current statement
      if (!isIgnorable(tok)) stmtHasContent = true;
    }

    // Operator validation (whitespace/comments/newlines are ignored)
    if (tok.type === "Op") {
      const op = tok.value;
      const prev = prevNonIgnorable(tokens, idx - 1);
      const next = nextNonIgnorable(tokens, idx + 1);

      const prevIsOperand = isOperandLike(prev);
      const nextIsOperand = isOperandLike(next);

      if (op === "-") {
        // Unary minus allowed when previous is not operand-like (start or after '(' or another operator)
        if (!prevIsOperand) {
          if (!nextIsOperand) {
            push(tok.from, tok.to, "Unary minus must be followed by an operand", "syntax/op-missing-operand");
          }
        } else {
          // Binary minus requires operand on both sides
          if (!nextIsOperand) {
            push(tok.from, tok.to, "Operator not followed by an operand", "syntax/op-missing-operand");
          }
        }
      } else {
        // Other operators are binary: require operand on both sides
        if (!prevIsOperand || !nextIsOperand) {
          push(tok.from, tok.to, "Operator not followed by an operand", "syntax/op-missing-operand");
        }
      }
    }

    // Update last non-WS token (keep behavior for period redundancy detection)
    if (tok.type !== "WS") lastNonWsTok = tok;
    lastTok = tok;
  }

  // End-of-file checks for pass 1
  while (parenStack.length > 0) {
    const pos = parenStack.pop()!;
    push(pos, pos + 1, "Unmatched opening parenthesis", "syntax/unmatched-open-paren");
  }

  // Missing trailing period for the last statement (if it had content and didn't end with a period)
  if (stmtHasContent && lastNonWsTok && lastNonWsTok.type !== "Period") {
    const end = lastNonWsTok.to;
    push(Math.max(0, end - 1), end, "Missing period at end of statement", "syntax/missing-period");
  }

  // Pass 2: statement-level validation for the basic var setting form:
  // "יהא <Ident> שוה <Number> ."
  // Segment by Period and validate, ignoring WS and Comment tokens for structure.
  const statements: { startIdx: number; endIdx: number }[] = [];
  let start = 0;
  for (let i = 0; i <= tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.type === "Period") {
      statements.push({ startIdx: start, endIdx: i - 1 });
      start = i + 1;
    }
  }

  // Helper to find first/last non-ignorable within [a,b]
  const firstNonIgn = (a: number, b: number): number => {
    for (let i = a; i <= b; i++) if (tokens[i] && !isIgnorable(tokens[i])) return i;
    return -1;
  };
  const lastNonIgn = (a: number, b: number): number => {
    for (let i = b; i >= a; i--) if (tokens[i] && !isIgnorable(tokens[i])) return i;
    return -1;
  };

  for (const seg of statements) {
    if (seg.startIdx > seg.endIdx) continue; // empty segment

    const s = firstNonIgn(seg.startIdx, seg.endIdx);
    const e = lastNonIgn(seg.startIdx, seg.endIdx);
    if (s === -1 || e === -1) continue; // only whitespace/comments

    // Gather significant tokens of this statement (skip WS/Comment)
    const stmt: Tok[] = [];
    for (let i = s; i <= e; i++) if (!isIgnorable(tokens[i])) stmt.push(tokens[i]);

    // Detect merged statements without a period: if more than one "יהא" appears
    const indicesOfYeye = stmt
      .map((t, i) => (t.type === "Keyword" && t.value === "יהא" ? i : -1))
      .filter(i => i >= 0);
    if (indicesOfYeye.length > 1) {
      // Place the error at the boundary before the second "יהא"
      const secondIdx = indicesOfYeye[1];
      const prevTok = stmt[secondIdx - 1] ?? stmt[0];
      const from = prevTok.to;
      const to = Math.min(from + 1, prevTok.to);
      push(from, to, "Missing period between statements", "syntax/missing-period-between-statements");
      continue;
    }

    // Try to parse var-assign: יהא <Ident> שוה <Number>
    let i = 0;

    // 1) Expect "יהא"
    const t0 = stmt[i];
    if (!(t0 && t0.type === "Keyword" && t0.value === "יהא")) {
      const from = stmt[0].from;
      const to = stmt[stmt.length - 1].to;
      push(from, to, "Invalid statement", "syntax/invalid-statement");
      continue;
    }
    i++;

    // 2) Expect Ident
    const t1 = stmt[i];
    if (!(t1 && t1.type === "Ident")) {
      const errTok = t1 ?? t0;
      push(errTok.from, errTok.to, "Expected identifier after 'יהא'", "syntax/var-assign-expected-ident");
      continue;
    }
    i++;

    // 3) Expect Keyword "שוה"
    const t2 = stmt[i];
    if (!(t2 && t2.type === "Keyword" && t2.value === "שוה")) {
      const errTok = t2 ?? stmt[i - 1];
      push(errTok.from, errTok.to, "Expected keyword 'שוה' after identifier", "syntax/var-assign-expected-shaveh");
      continue;
    }
    i++;

    // 4) Expect Number
    const t3 = stmt[i];
    if (!(t3 && t3.type === "Number")) {
      const errTok = t3 ?? stmt[i - 1];
      push(errTok.from, errTok.to, "Expected number after 'שוה'", "syntax/var-assign-expected-number");
      continue;
    }
    i++;

    // 5) No extra tokens allowed in this minimal phase
    if (i < stmt.length) {
      const extraFrom = stmt[i].from;
      const extraTo = stmt[stmt.length - 1].to;
      push(extraFrom, extraTo, "Unexpected extra tokens after assignment", "syntax/statement-extra-tokens");
      continue;
    }
  }

  return { diagnostics };
}