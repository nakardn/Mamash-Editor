import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine, lineNumbers, placeholder } from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { defaultKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

// Minimal base extensions akin to basicSetup but slimmer and explicit
const baseExtensions = [
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  highlightActiveLine(),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
  ]),
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
let isDark = false;

// Direction state
let dirMode: DirectionMode = "ltr";

// EditorView theme toggles
const lightTheme = EditorView.theme({}, { dark: false }); // default light
const darkTheme = oneDark;

// Direction attribute facet
const dirFacet = EditorView.editorAttributes.of((view) => {
  // Apply dir on the root editor DOM
  const effectiveDir = getEffectiveDir(view);
  return { class: `cm-dir-${effectiveDir}`, "aria-bidi": "plaintext", dir: effectiveDir };
});

// Compute effective direction based on mode and content
function getEffectiveDir(view: EditorView): "ltr" | "rtl" {
  if (dirMode === "ltr" || dirMode === "rtl") return dirMode;
  // Auto mode: inspect first non-empty line for strong RTL characters (Hebrew/Arabic ranges)
  const doc = view.state.doc;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i).text.trim();
    if (!line) continue;
    if (hasStrongRTL(line)) return "rtl";
    return "ltr";
  }
  // empty doc defaults to LTR
  return "ltr";
}

function hasStrongRTL(text: string): boolean {
  // Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic Extended-A/B, Hebrew marks
  // Basic check for Hebrew (0590–05FF) and Arabic (0600–06FF) is enough for this app
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/;
  return rtlRegex.test(text);
}

// Placeholder text includes Hebrew sample hint
const initialPlaceholder = "Start typing… You can toggle RTL for Hebrew (עברית).";

// Build initial state
let state = EditorState.create({
  doc: "",
  extensions: [
    baseExtensions,
    placeholder(initialPlaceholder),
    dirFacet,
    EditorView.updateListener.of((update) => {
      if (update.docChanged && dirMode === "auto") {
        // Update status on content changes in auto mode
        const current = getEffectiveDir(view);
        setDirectionStatus(current);
        // Update dir attribute live
        view.dispatch({
          effects: EditorView.reconfigure.of([
            ...coreExtensions(),
          ]),
        });
      }
    }),
    ...coreExtensions(),
  ],
});

// Core extensions recomputed when theme/dir change
function coreExtensions() {
  return [
    dirFacet,
    isDark ? darkTheme : lightTheme,
    EditorView.domEventHandlers({
      // Ensure editor inherits document font features (handled via CSS)
    }),
  ];
}

// Create the editor view
const view = new EditorView({
  state,
  parent: editorHost,
});

// Status initialization
setDirectionStatus("ltr");
setThemeStatus();

// UI handlers
directionSelect.addEventListener("change", () => {
  dirMode = directionSelect.value as DirectionMode;
  const effective = getEffectiveDir(view);
  setDirectionStatus(effective);
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
    "זהו טקסט לדוגמה בעברית.",
    "ניתן לערוך, למחוק ולהוסיף שורות חדשות.",
    "Tip: You can mix English and עברית in the same document.",
  ].join("\n");
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: hebrewSample },
    selection: { anchor: hebrewSample.length },
  });
  if (dirMode === "auto") {
    setDirectionStatus(getEffectiveDir(view));
    reconfigureEditor();
  }
});

// Helpers
function reconfigureEditor() {
  view.dispatch({
    effects: EditorView.reconfigure.of([
      ...baseExtensions,
      placeholder(initialPlaceholder),
      ...coreExtensions(),
    ]),
  });
}

function setDirectionStatus(current: "ltr" | "rtl") {
  statusDirection.textContent = `Direction: ${current.toUpperCase()}`;
}

function setThemeStatus() {
  statusTheme.textContent = `Theme: ${isDark ? "Dark" : "Light"}`;
}