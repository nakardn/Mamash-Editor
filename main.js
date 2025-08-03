import { EditorView, Decoration, ViewPlugin, lineNumbers } from "@codemirror/view";
import { EditorState, Prec, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { Direction } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

// Bidi isolation plugin to handle mixed-direction text in HTML
const htmlIsolates = ViewPlugin.fromClass(class {
  constructor(view) {
    this.isolates = computeIsolates(view);
    this.tree = syntaxTree(view.state);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.state) !== this.tree) {
      this.isolates = computeIsolates(update.view);
      this.tree = syntaxTree(update.state);
    }
  }
}, {
  provide: plugin => {
    function access(view) {
      return view.plugin(plugin)?.isolates ?? Decoration.none;
    }
    return Prec.lowest([
      EditorView.decorations.of(access),
      EditorView.bidiIsolatedRanges.of(access)
    ]);
  }
});

function computeIsolates(view) {
  let set = new RangeSetBuilder();
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        if (node.name == "OpenTag" || node.name == "CloseTag" || node.name == "SelfClosingTag") {
          set.add(node.from, node.to, isolate);
        }
      }
    });
  }
  return set.finish();
}

const isolate = Decoration.mark({
  attributes: { style: "direction: ltr; unicode-bidi: isolate" },
  bidiIsolate: Direction.LTR
});

// A compartment to make the theme configurable
let themeCompartment = new Compartment();

const initialContent = `'זהו עורך קוד מימין לשמאל.' // This is a right-to-left code editor.
// يحتوي على شريط التمرير على الجانب الأيمن // It has the scrollbar on the right side.

function greet(name) {
  return "Hello, " + name;
}

console.log(greet("World"));
`;

// Create the CodeMirror editor instance
const editor = new EditorView({
  state: EditorState.create({
    doc: initialContent,
    extensions: [
      lineNumbers(), // Add line numbers
      javascript(),
      htmlIsolates,
      EditorView.theme({
        "&": {
          direction: "rtl",
        }
      }),
      // Initial theme is light (empty array)
      themeCompartment.of([]) 
    ]
  }),
  // Append the editor to the container div
  parent: document.querySelector("#editor-container")
});

// Function to toggle dark mode, exposed to the global scope
let isDark = false;
window.toggleDarkMode = function() {
  isDark = !isDark;
  editor.dispatch({
    // Reconfigure the theme compartment with oneDark or an empty array
    effects: themeCompartment.reconfigure(isDark ? oneDark : [])
  });
};