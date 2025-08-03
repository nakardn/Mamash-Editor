// editor.js

// Keep track of the initial theme and the currently active theme.
const initialTheme = 'monokai';
let currentTheme = initialTheme;

// This is now a CodeMirror instance, not a standard textarea
const editor = CodeMirror.fromTextArea(document.getElementById('textArea'), {
    mode: 'javascript',
    lineNumbers: true,
    theme: initialTheme, // Use the variable for the initial theme
    smartIndent: true,
    indentWithTabs: false,
    indentUnit: 2,
    extraKeys: {
        "Ctrl-/": "toggleComment",
        "Cmd-/": "toggleComment"
    },
    placeholder: document.getElementById('textArea').getAttribute('placeholder')
});

// DOM Elements for UI
const cursorPosition = document.getElementById('cursorPosition');
const selectionInfo = document.getElementById('selectionInfo');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const lineCount = document.getElementById('lineCount');
const autoSaveIndicator = document.getElementById('autoSaveIndicator');

let isModified = false;
let initialContent = '';

/**
 * Reads the active CodeMirror theme's colors and applies them
 * to the parent containers for a seamless look.
 */
function syncThemeStyles() {
    const editorContainer = document.querySelector('.editor-container');
    const codeMirrorElement = editor.getWrapperElement();

    setTimeout(() => {
        if (editorContainer && codeMirrorElement) {
            const computedStyle = window.getComputedStyle(codeMirrorElement);
            const bgColor = computedStyle.getPropertyValue('background-color');
            const textColor = computedStyle.getPropertyValue('color');

            editorContainer.style.backgroundColor = bgColor;
            editorContainer.style.color = textColor;
        }
    }, 100);
}

// Initialize editor
function initializeEditor() {
    initialContent = editor.getValue();
    updateAllUI();
    setInterval(autoSave, 30000);

    // Set the theme selector to match the initial theme
    document.getElementById('themeSelector').value = initialTheme;

    editor.on('change', () => {
        markModified();
        updateStats();
    });

    editor.on('cursorActivity', () => {
        updateCursorPosition();
    });

    syncThemeStyles();
}

/**
 * Changes the editor's theme using CodeMirror's built-in method
 */
function changeTheme() {
    const newTheme = document.getElementById('themeSelector').value;
    
    // Simply use CodeMirror's setOption method - it handles everything
    editor.setOption('theme', newTheme);
    
    // Update our tracker variable
    currentTheme = newTheme;
    
    // Re-sync the container styles to match the new theme
    syncThemeStyles();
}

// --- All other functions remain the same ---

function updateAllUI() {
    updateStats();
    updateCursorPosition();
}

function updateStats() {
    const content = editor.getValue();
    const lines = editor.lineCount();
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    charCount.textContent = `Characters: ${content.length}`;
    wordCount.textContent = `Words: ${words}`;
    lineCount.textContent = `Lines: ${lines}`;
}

function updateCursorPosition() {
    const cursor = editor.getCursor();
    const currentLine = cursor.line + 1;
    const currentCol = cursor.ch + 1;
    cursorPosition.textContent = `Ln ${currentLine}, Col ${currentCol}`;
    const selection = editor.getSelection();
    selectionInfo.textContent = selection.length > 0 ? `(${selection.length} selected)` : '';
}

async function saveDocument() {
    const content = editor.getValue();
    autoSaveIndicator.className = 'auto-save-indicator saving';
    autoSaveIndicator.textContent = '💾 Saving...';
    try {
        const response = await fetch(`/api/save/${docId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content })
        });
        if (response.ok) {
            autoSaveIndicator.className = 'auto-save-indicator saved';
            autoSaveIndicator.textContent = '✓ Saved';
            isModified = false;
            editor.markClean();
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        autoSaveIndicator.className = 'auto-save-indicator error';
        autoSaveIndicator.textContent = '❌ Error';
        console.error('Save error:', error);
    }
}

async function cancelChanges() {
    if (editor.isClean()) {
        alert('No changes have been made in this session to cancel.');
        return;
    }
    if (confirm('Are you sure you want to discard all changes from this session? This will revert the document to how it was when you opened it and save this state.')) {
        editor.setValue(initialContent);
        await saveDocument();
        editor.clearHistory();
        initialContent = editor.getValue();
    }
}

function autoSave() {
    if (!editor.isClean()) {
        saveDocument();
    }
}

function markModified() {
    if (!isModified) {
        isModified = true;
        autoSaveIndicator.className = 'auto-save-indicator saving';
        autoSaveIndicator.textContent = '● Modified';
    }
}

function toggleSearch() {
    const searchReplace = document.getElementById('searchReplace');
    searchReplace.classList.toggle('active');
    if (searchReplace.classList.contains('active')) {
        document.getElementById('searchInput').focus();
    }
}

function performSearch() {
    // This is a placeholder for a real search addon
}

function replaceAll() {
    const searchTerm = document.getElementById('searchInput').value;
    const replaceTerm = document.getElementById('replaceInput').value;
    if (searchTerm) {
        const content = editor.getValue();
        const newContent = content.replace(new RegExp(searchTerm, 'g'), replaceTerm);
        if (newContent !== content) {
            editor.setValue(newContent);
        }
    }
}

function formatDocument() {
    const content = editor.getValue();
    let formatted = content.split('\n').map(line => line.trim()).join('\n');
    formatted = formatted.replace(/\n\n\n+/g, '\n\n');
    if (formatted !== content) {
        editor.setValue(formatted);
    }
}

function toggleRTL() {
    const editorWrapper = editor.getWrapperElement();
    editorWrapper.classList.toggle('rtl-mode');
    editor.refresh();
}

async function deleteDocument() {
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        try {
            const response = await fetch(`/delete/${docId}`, { method: 'POST' });
            if (response.ok) {
                isModified = false;
                window.location.href = '/';
            } else {
                alert('Failed to delete document');
            }
        } catch (error) {
            alert('Error deleting document');
            console.error('Delete error:', error);
        }
    }
}

function toggleShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

function closeModal(event) {
    if (event.target.id === 'shortcutsModal') {
        event.target.style.display = 'none';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', initializeEditor);
window.addEventListener('beforeunload', function(e) {
    if (!editor.isClean()) {
        e.preventDefault();
        e.returnValue = '';
    }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.getElementById('shortcutsModal').style.display = 'none';
        document.getElementById('searchReplace').classList.remove('active');
    }
});