/**
 * SourceText: utilities for robust range handling and line/column mapping.
 * Offsets are UTF-16 code unit indexes (CodeMirror uses the same).
 */
export class SourceText {
  readonly text: string;
  private _lineStarts: number[] | null = null;

  constructor(text: string) {
    this.text = text;
  }

  length(): number {
    return this.text.length;
  }

  clamp(pos: number): number {
    if (pos < 0) return 0;
    if (pos > this.text.length) return this.text.length;
    return pos;
  }

  slice(from: number, to: number): string {
    return this.text.slice(this.clamp(from), this.clamp(to));
  }

  ensureNonEmptyRange(from: number, to: number): { from: number; to: number } {
    let f = this.clamp(Math.min(from, to));
    let t = this.clamp(Math.max(from, to));
    if (t === f && t < this.text.length) t = f + 1;
    return { from: f, to: t };
  }

  private computeLineStarts(): number[] {
    const starts = [0];
    for (let i = 0; i < this.text.length; i++) {
      if (this.text.charCodeAt(i) === 10) { // \n
        starts.push(i + 1);
      }
    }
    return starts;
  }

  private get lineStarts(): number[] {
    if (!this._lineStarts) this._lineStarts = this.computeLineStarts();
    return this._lineStarts;
  }

  lineCount(): number {
    return this.lineStarts.length;
  }

  // Convert offset to { line, column } 0-based
  positionAt(offset: number): { line: number; column: number } {
    const pos = this.clamp(offset);
    const starts = this.lineStarts;
    // binary search
    let low = 0, high = starts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = starts[mid];
      if (start === pos) return { line: mid, column: 0 };
      if (start < pos) low = mid + 1;
      else high = mid - 1;
    }
    const line = Math.max(0, low - 1);
    const column = pos - starts[line];
    return { line, column };
  }

  // Convert { line, column } 0-based to offset
  offsetAt(line: number, column: number): number {
    const starts = this.lineStarts;
    const ln = Math.max(0, Math.min(line, starts.length - 1));
    return this.clamp(starts[ln] + Math.max(0, column));
  }
}