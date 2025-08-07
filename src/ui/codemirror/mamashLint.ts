import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, hoverTooltip } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { lintText } from "../../lint/engine";

const errorMark = Decoration.mark({ class: "cm-mamash-error-underline" });

// Normalize diagnostics and sort to satisfy RangeSetBuilder ordering
function normalizeAndSortDiagnostics(docsLength: number, diags: { from: number; to: number; message: string; code?: string }[]) {
  const normalized = diags.map(d => {
    let from = Math.max(0, Math.min(docsLength, d.from));
    let to = Math.max(0, Math.min(docsLength, d.to));
    if (to < from) [from, to] = [to, from];
    if (to === from && to < docsLength) to = from + 1;
    return { ...d, from, to };
  });
  normalized.sort((a, b) => (a.from - b.from) || (a.to - b.to));
  return normalized;
}

export const mamashLintPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildNow(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildNow(update.view);
      }
    }

    private buildNow(view: EditorView): DecorationSet {
      const doc = view.state.doc.toString();
      const { diagnostics } = lintText(doc);
      const sorted = normalizeAndSortDiagnostics(doc.length, diagnostics);

      const builder = new RangeSetBuilder<Decoration>();
      for (const d of sorted) {
        builder.add(d.from, d.to, errorMark);
      }
      return builder.finish();
    }
  },
  {
    decorations: v => v.decorations ?? Decoration.none
  }
);

export const mamashLintStyles = EditorView.baseTheme({
  ".cm-mamash-error-underline": {
    textDecoration: "underline wavy #ff4d4f 2px"
  }
});

// Tooltip on hover to show diagnostic message
export const mamashLintTooltip = hoverTooltip((view, pos) => {
  const doc = view.state.doc.toString();
  const { diagnostics } = lintText(doc);
  const sorted = normalizeAndSortDiagnostics(doc.length, diagnostics);
  const hit = sorted.find(d => d.from <= pos && pos <= d.to);
  if (!hit) return null;
  return {
    pos: hit.from,
    end: hit.to,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-mamash-lint-tooltip";
      dom.textContent = hit.message + (hit.code ? ` (${hit.code})` : "");
      return { dom };
    }
  };
});