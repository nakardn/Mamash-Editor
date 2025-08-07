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
  mamash(),
];

type Direction = "ltr" | "rtl";

const directionToggle = document.getElementById("directionToggle") as HTMLButtonElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
const insertHebrewBtn = document.getElementById("insertHebrew") as HTMLButtonElement;
const statusDirection = document.getElementById("statusDirection") as HTMLSpanElement;
const statusTheme = document.getElementById("statusTheme") as HTMLSpanElement;
const editorHost = document.getElementById("editor") as HTMLDivElement;
// Apply direction classes on the editor host element (.editor-host.dir-ltr | .editor-host.dir-rtl)

if (!editorHost) {
  throw new Error("Editor host element #editor not found");
}

// Theme state
let isDark = true;

// Direction state (only ltr/rtl)
let dirMode: Direction = "rtl";

// Compartments to reconfigure editor cleanly
const themeCompartment = new Compartment();
const dirCompartment = new Compartment();
const baseCompartment = new Compartment();
const editorDirCompartment = new Compartment();

// Direction attributes now handled via classes on the cm-editor element (.cm-editor.dir-rtl/.dir-ltr)
// Keep minimal attributes without extra dir/class to avoid conflicts.
function dirAttributesFor(_mode: Direction) {
  // No dir/class on content; CSS uses .cm-editor dir-* classes.
  return EditorView.contentAttributes.of({});
}
function editorDirAttributesFor(_mode: Direction) {
  // No dir/class on editor root via attributes; we'll toggle classes on the actual DOM node.
  return EditorView.editorAttributes.of({});
}

// Placeholder text
const initialPlaceholder = "Start typing MAMASH…";

// Initial extensions bound to compartments
const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      baseCompartment.of([...baseExtensions, placeholder(initialPlaceholder)]),
      dirCompartment.of(dirAttributesFor(dirMode)),
      editorDirCompartment.of(editorDirAttributesFor(dirMode)),
      themeCompartment.of(oneDark),
    ],
  }),
  parent: editorHost,
});

// Initialize UI state
setDirectionStatus(dirMode.toUpperCase());
setThemeStatus();
document.documentElement.dataset.theme = "dark";
// Initialize cm-editor direction class
updateCmEditorDirection(dirMode);

// UI handlers
directionToggle?.addEventListener("click", () => {
  dirMode = dirMode === "rtl" ? "ltr" : "rtl";
  setDirectionStatus(dirMode.toUpperCase());
  updateCmEditorDirection(dirMode);
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
    "Tip: Mixed English and עברית supported.",
  ].join("\n");
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: hebrewSample },
    selection: { anchor: hebrewSample.length },
  });
});

// Helpers
function reconfigureEditor() {
  const themeExt = isDark ? oneDark : EditorView.theme({}, { dark: false });
  const newBase = [...baseExtensions, placeholder(initialPlaceholder)];

  view.dispatch({
    effects: [
      themeCompartment.reconfigure(themeExt),
      // Keep compartments but they no longer set dir/class; retained for future flexibility.
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

function updateCmEditorDirection(mode: Direction) {
  // Ensure we target the current cm-editor element inside the host
  const cmEl = editorHost.querySelector(".cm-editor");
  if (!cmEl) return;
  cmEl.classList.toggle("dir-rtl", mode === "rtl");
  cmEl.classList.toggle("dir-ltr", mode === "ltr");
}