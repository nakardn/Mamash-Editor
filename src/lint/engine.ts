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

  // Simple helpers
  const isOperandLike = (t: Tok | null) => !!t && (t.type === "Ident" || t.type === "Number" || t.type === "ParenClose");
  const isOperator = (t: Tok | null) => !!t && t.type === "Op";

  const tokens: Tok[] = [];
  for (const tok of tokenize(text)) tokens.push(tok);

  const prevNonWs = (arr: Tok[], i: number): Tok | null => {
    for (let k = i; k >= 0; k--) {
      const t = arr[k];
      if (t.type !== "WS") return t;
    }
    return null;
  };
  const nextNonWs = (arr: Tok[], i: number): Tok | null => {
    for (let k = i; k < arr.length; k++) {
      const t = arr[k];
      if (t.type !== "WS") return t;
    }
    return null;
  };

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
      if (tok.type !== "WS") stmtHasContent = true;
    }

    // Operator validation (whitespace/newlines are ignored)
    if (tok.type === "Op") {
      const op = tok.value;
      const prev = prevNonWs(tokens, idx - 1);
      const next = nextNonWs(tokens, idx + 1);

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

    // Update last non-WS token
    if (tok.type !== "WS") lastNonWsTok = tok;
    lastTok = tok;
  }

  // End-of-file checks
  // Unmatched opening parens
  while (parenStack.length > 0) {
    const pos = parenStack.pop()!;
    push(pos, pos + 1, "Unmatched opening parenthesis", "syntax/unmatched-open-paren");
  }

  // Missing trailing period for the last statement (if it had content and didn't end with a period)
  if (stmtHasContent && lastNonWsTok && lastNonWsTok.type !== "Period") {
    const end = lastNonWsTok.to;
    push(Math.max(0, end - 1), end, "Missing period at end of statement", "syntax/missing-period");
  }

  return { diagnostics };
}