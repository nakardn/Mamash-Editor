import { LanguageSupport } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { mamashLintPlugin, mamashLintStyles, mamashLintTooltip } from "../ui/codemirror/mamashLint";

/**
 * MAMASH: a minimal Hebrew-like language demo for CodeMirror 6.
 * - Statements end with a period '.'
 * - Hebrew keywords: אם, אזי, אחרת, לכל, יהא, שוה, גדול, קטן
 * - Identifiers (Hebrew or Latin), numbers, + - * /
 *
 * This is NOT a full Lezer parser. We implement a lightweight token scan
 * and wrap it into a pseudo tree that LRLanguage accepts for highlighting use-cases.
 * For production-grade parsing, create a proper Lezer grammar.
 */

import { tokenize, Tok } from "./tokenizer";

// Flat node representation for ranges
interface RangeNode {
  type: string;
  from: number;
  to: number;
}

function lexToRanges(text: string): RangeNode[] {
  const nodes: RangeNode[] = [];
  for (const tok of tokenize(text)) {
    switch (tok.type) {
      case "WS":
        // ignore whitespace
        break;
      case "Comment":
        nodes.push({ type: "Comment", from: tok.from, to: tok.to });
        break;
      case "Keyword":
        nodes.push({ type: "Keyword", from: tok.from, to: tok.to });
        break;
      case "Ident":
        nodes.push({ type: "Identifier", from: tok.from, to: tok.to });
        break;
      case "Number":
        nodes.push({ type: "Number", from: tok.from, to: tok.to });
        break;
      case "Op":
        nodes.push({ type: "Operator", from: tok.from, to: tok.to });
        break;
      case "ParenOpen":
        nodes.push({ type: "ParenOpen", from: tok.from, to: tok.to });
        break;
      case "ParenClose":
        nodes.push({ type: "ParenClose", from: tok.from, to: tok.to });
        break;
      case "Period":
        nodes.push({ type: "Period", from: tok.from, to: tok.to });
        break;
      case "Unknown":
        nodes.push({ type: "Unknown", from: tok.from, to: tok.to });
        break;
    }
  }
  return nodes;
}

// Minimal "tree" left here in case of future parser work (unused by view-based highlighter).
class MamashFlatTree {
  constructor(
    readonly textLength: number,
    readonly ranges: RangeNode[]
  ) {}
  iterate(spec: { enter?: (type: any, from: number, to: number) => void }) {
    spec.enter?.("Program", 0, this.textLength);
    for (const n of this.ranges) {
      spec.enter?.(n.type, n.from, n.to);
    }
  }
  cursor() { return {} as any; }
}

// ViewPlugin-based token highlighter (no parser required)
// Use a ViewPlugin to safely store decorations, avoiding direct StateField access in updates
const mamashHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const doc = view.state.doc.toString();
      const ranges = lexToRanges(doc);
      const decos: any[] = [];
      for (const r of ranges) {
        let cls: string | null = null;
        switch (r.type) {
          case "Keyword": cls = "cm-mamash-keyword"; break;
          case "Identifier": cls = "cm-mamash-ident"; break;
          case "Number": cls = "cm-mamash-number"; break;
          case "Operator": cls = "cm-mamash-operator"; break;
          case "ParenOpen":
          case "ParenClose": cls = "cm-mamash-paren"; break;
          case "Period": cls = "cm-mamash-punct"; break;
          case "Unknown": cls = "cm-mamash-invalid"; break;
        }
        if (cls) decos.push(Decoration.mark({ class: cls }).range(r.from, r.to));
      }
      return Decoration.set(decos, true);
    }
  },
  {
    decorations: v => v.decorations
  }
);

const mamashTheme = EditorView.theme({
  /* Cohesive, app-themed Mamash syntax colors using existing CSS variables */
  ".cm-mamash-keyword": {
    color: "var(--brand)",
    fontWeight: "600",
    textDecoration: "none"
  },
  ".cm-mamash-ident": {
    color: "color-mix(in oklab, var(--text), var(--muted) 35%)"
  },
  ".cm-mamash-number": {
    color: "var(--accent)",
    fontWeight: "500"
  },
  ".cm-mamash-operator": {
    /* Make operators subtler; '=' and ':' often serve as separators/assignments */
    color: "color-mix(in oklab, var(--muted), var(--text) 10%)",
    fontWeight: "400"
  },
  ".cm-mamash-paren": {
    color: "color-mix(in oklab, var(--muted), var(--text) 10%)"
  },
  ".cm-mamash-punct": {
    /* Periods end statements; keep gentle accent */
    color: "color-mix(in oklab, var(--accent), var(--text) 40%)"
  },
  ".cm-mamash-invalid": {
    color: "var(--text)",
    backgroundColor: "color-mix(in oklab, #ff5555, var(--surface) 35%)",
    borderRadius: "4px"
  }
});

// Provide language-like editor behavior (direction, word chars, brackets, comments)
// via languageData facet at the document root.
const mamashLanguageData = EditorState.languageData.of((_state, _pos, _side) => {
  return [{
    direction: "rtl" as const,
    wordChars: /[\u0590-\u05FF\w]/,
    closeBrackets: { brackets: ["(", ")"] as const },
    commentTokens: { line: "//" }
  }];
});

export function mamash(): LanguageSupport {
  // eslint-disable-next-line no-console
  console.debug("[mamash] highlight + lint extension applied");
  const base: any = [];
  return new LanguageSupport(base, [
    mamashHighlighter,
    mamashTheme,
    mamashLanguageData,
    mamashLintPlugin,
    mamashLintStyles,
    mamashLintTooltip
  ]);
}