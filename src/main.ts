import { EditorState, Extension, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import {
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { mamash } from "./lang/mamash";

// Minimal base extensions akin to basicSetup but slimmer and explicit
const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...searchKeymap, ...historyKeymap]),
  // Enable our custom MAMASH highlight-only extension
  mamash()
];

type DirectionMode = "ltr" | "rtl" | "auto";

const directionSelect = document.getElementById("directionSelect") as HTMLSelectElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
const insertHebrewBtn = document.getElementById("insertHebrew") as HTMLButtonElement;
const statusDirection = document.getElementById("statusDirection") as HTMLSpanElement;
const statusTheme = document.getElementById("statusTheme") as HTMLSpanElement;
const editorHost = document.getElementById("editor") as HTMLDivElement;

if (!editorHost) {
  throw new Error("Editor host element #editor not found");
}

// Theme state
let isDark = true;

// Direction state
let dirMode: DirectionMode = "rtl";

// Compartments to reconfigure editor cleanly
const themeCompartment = new Compartment();
const dirCompartment = new Compartment();
const baseCompartment = new Compartment();
// New: editor-level direction attributes (so gutters align with content)
const editorDirCompartment = new Compartment();

// Preferred way to set direction in CM6 is via EditorView.contentAttributes
// Also set editor-level attributes so gutter placement follows direction.
function dirAttributesFor(mode: DirectionMode) {
  return EditorView.contentAttributes.of((view) => {
    const effectiveDir = getEffectiveDirFromState(view.state, mode);
    return { dir: effectiveDir, class: `cm-dir-${effectiveDir}` };
  });
}
function editorDirAttributesFor(mode: DirectionMode) {
  return EditorView.editorAttributes.of((view) => {
    const effectiveDir = getEffectiveDirFromState(view.state, mode);
    // Place gutter on the right only when explicitly RTL; otherwise keep on the left.
    const gutterSide = effectiveDir === "rtl" ? "right" : "left";
    return {
      dir: effectiveDir,
      class: `cm-root-dir-${effectiveDir} cm-gutter-${gutterSide}`
    };
  });
}

// Compute effective direction based on mode and content
function getEffectiveDirFromState(state: EditorState, mode: DirectionMode): "ltr" | "rtl" {
  if (mode === "ltr" || mode === "rtl") return mode;
  // Auto mode: inspect first non-empty line for strong RTL characters (Hebrew/Arabic)
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i).text.trim();
    if (!line) continue;
    if (hasStrongRTL(line)) return "rtl";
    return "ltr";
  }
  return "ltr";
}

function hasStrongRTL(text: string): boolean {
  // Basic check for Hebrew (0590–05FF) and Arabic (0600–06FF)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/;
  return rtlRegex.test(text);
}

// Placeholder text includes Hebrew sample hint
const initialPlaceholder = "Start typing MAMASH… Statements end with '.' · Keywords: אם, אזי, אחרת, לכל, יהא, שוה, גדול, קטן.";

// Initial extensions bound to compartments
const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      baseCompartment.of([...baseExtensions, placeholder(initialPlaceholder)]),
      dirCompartment.of(dirAttributesFor(dirMode)),
      editorDirCompartment.of(editorDirAttributesFor(dirMode)),
      themeCompartment.of(oneDark),
      // Sync status in auto mode
      EditorView.updateListener.of((update) => {
        if (update.docChanged && dirMode === "auto") {
          const current = getEffectiveDirFromState(update.state, dirMode);
          setDirectionStatus(current.toUpperCase());
          // Recompute dir attributes for AUTO based on new content
          view.dispatch({
            effects: dirCompartment.reconfigure(dirAttributesFor(dirMode)),
          });
        }
      }),
    ],
  }),
  parent: editorHost,
});

// Initialize UI state
setDirectionStatus("RTL");
setThemeStatus();
document.documentElement.dataset.theme = "dark";

// UI handlers
directionSelect.addEventListener("change", () => {
  dirMode = directionSelect.value as DirectionMode;
  const effective = getEffectiveDirFromState(view.state, dirMode);
  setDirectionStatus(effective.toUpperCase());
  reconfigureEditor();
});

themeToggle.addEventListener("click", () => {
  isDark = !isDark;
  themeToggle.setAttribute("aria-pressed", String(isDark));
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  setThemeStatus();
  reconfigureEditor();
});

insertHebrewBtn.addEventListener("click", () => {
  const hebrewSample = [
    "יהא x שוה 5.",
    "יהא y שוה 3.",
    "אם x גדול y אזי יהא z שוה x + y. אחרת יהא z שוה x - y.",
    "לכל i (1 + 2 * 3).",
    "// ניתן לערבב אנגלית ועברית:",
    "Tip: Mixed English and עברית supported."
  ].join("\n");
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: hebrewSample },
    selection: { anchor: hebrewSample.length },
  });
  if (dirMode === "auto") {
    setDirectionStatus(getEffectiveDirFromState(view.state, dirMode).toUpperCase());
    reconfigureEditor();
  }
});

// Helpers
function reconfigureEditor() {
  const themeExt = isDark ? oneDark : EditorView.theme({}, { dark: false });

  // Always keep original baseExtensions including lineNumbers()
  const newBase = [...baseExtensions, placeholder(initialPlaceholder)];

  view.dispatch({
    effects: [
      themeCompartment.reconfigure(themeExt),
      dirCompartment.reconfigure(dirAttributesFor(dirMode)),
      editorDirCompartment.reconfigure(editorDirAttributesFor(dirMode)),
      baseCompartment.reconfigure(newBase),
    ],
  });
}

function setDirectionStatus(text: string) {
  statusDirection.textContent = `Direction: ${text}`;
}

function setThemeStatus() {
  statusTheme.textContent = `Theme: ${isDark ? "Dark" : "Light"}`;
}