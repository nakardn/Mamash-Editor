export type Severity = "error" | "warn" | "info";

export interface Position {
  from: number; // inclusive UTF-16 offset in the document
  to: number;   // exclusive UTF-16 offset in the document
}

export interface Diagnostic extends Position {
  message: string;
  severity: Severity;
  code?: string; // rule or diagnostic code, e.g., "syntax/unknown-char"
}

export interface LintResult {
  diagnostics: Diagnostic[];
}