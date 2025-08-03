        const textArea = document.getElementById('textArea');
        const lineNumbers = document.getElementById('lineNumbers');
        const cursorPosition = document.getElementById('cursorPosition');
        const selectionInfo = document.getElementById('selectionInfo');
        const wordCount = document.getElementById('wordCount');
        const charCount = document.getElementById('charCount');
        const lineCount = document.getElementById('lineCount');
        const minimapContent = document.getElementById('minimapContent');
        let autoSaveTimer;
        let isModified = false;

        // <!-- HISTORY MANAGER -->: Undo/Redo stack implementation
        const history = {
            stack: [],
            redoStack: [],
            limit: 100,
            debounceTimer: null,

            // Reset the history to its initial state
            reset() {
                if (this.stack.length > 0) {
                    // Keep only the very first state by removing all subsequent states
                    this.stack.splice(1);
                }
                this.redoStack = [];
            },

            // Save a state to the history
            pushState(state) {
                // When a new action is performed, clear the redo stack
                this.redoStack = [];
                
                // Add new state
                this.stack.push(state);

                // Enforce the history limit
                if (this.stack.length > this.limit) {
                    this.stack.shift(); // Remove the oldest state
                }
            },

            // Undo the last action
            undo() {
                if (this.stack.length > 1) { // Keep the initial state
                    const lastState = this.stack.pop();
                    this.redoStack.push(lastState); // Move it to the redo stack
                    return this.stack[this.stack.length - 1];
                }
                return null; // Nothing to undo
            },

            // Redo the last undone action
            redo() {
                if (this.redoStack.length > 0) {
                    const stateToRedo = this.redoStack.pop();
                    this.stack.push(stateToRedo); // Move it back to the main stack
                    return stateToRedo;
                }
                return null; // Nothing to redo
            },
            
            // Get the current state of the editor
            getCurrentState() {
                return {
                    content: textArea.value,
                    cursorStart: textArea.selectionStart,
                    cursorEnd: textArea.selectionEnd
                };
            },
            
            // Apply a saved state to the editor
            applyState(state) {
                textArea.value = state.content;
                textArea.setSelectionRange(state.cursorStart, state.cursorEnd);
                
                // Update UI after applying state
                updateAllUI();
                markModified();
            },
            
            // Add current state to history (used by actions)
            record() {
                this.pushState(this.getCurrentState());
            },

            // Record user input with a debounce to prevent saving every keystroke
            recordDebounced() {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.record();
                }, 500); // Save state 500ms after user stops typing
            }
        };
        
        // Initialize editor
        function initializeEditor() {
            updateAllUI();
            
            // Auto-save every 30 seconds
            setInterval(autoSave, 30000);
            
            // <!-- HISTORY MANAGER -->: Save the initial state of the document
            history.record();
        }

        function updateAllUI() {
            updateLineNumbers();
            updateStats();
            updateMinimap();
            updateCursorPosition();
        }
        
        // Update line numbers
        function updateLineNumbers() {
            const lines = textArea.value.split('\n');
            const lineNumbersArray = [];
            
            for (let i = 1; i <= lines.length; i++) {
                lineNumbersArray.push(i);
            }
            
            lineNumbers.textContent = lineNumbersArray.join('\n');
        }
        
        // Update statistics
        function updateStats() {
            const content = textArea.value;
            const lines = content.split('\n');
            const words = content.trim() ? content.trim().split(/\s+/).length : 0;
            
            charCount.textContent = `Characters: ${content.length}`;
            wordCount.textContent = `Words: ${words}`;
            lineCount.textContent = `Lines: ${lines.length}`;
        }
        
        // Update cursor position
        function updateCursorPosition() {
            const cursorPos = textArea.selectionStart;
            const textBeforeCursor = textArea.value.substring(0, cursorPos);
            const lines = textBeforeCursor.split('\n');
            const currentLine = lines.length;
            const currentCol = lines[lines.length - 1].length + 1;
            
            cursorPosition.textContent = `Ln ${currentLine}, Col ${currentCol}`;
            
            // Update selection info
            const selectionLength = textArea.selectionEnd - textArea.selectionStart;
            if (selectionLength > 0) {
                selectionInfo.textContent = `(${selectionLength} selected)`;
            } else {
                selectionInfo.textContent = '';
            }
        }
        
        // Update minimap
        function updateMinimap() {
            const content = textArea.value;
            const lines = content.split('\n');
            const preview = lines.slice(0, 200).join('\n'); // Show first 200 lines
            minimapContent.textContent = preview;
        }
        
        // Sync scroll between textarea and line numbers
        function syncScroll() {
            lineNumbers.scrollTop = textArea.scrollTop;
        }
        
        // Save document
        async function saveDocument() {
            const content = textArea.value;
            autoSaveIndicator.className = 'auto-save-indicator saving';
            autoSaveIndicator.textContent = '💾 Saving...';
            
            try {
                const response = await fetch(`/api/save/${docId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: content })
                });
                
                if (response.ok) {
                    autoSaveIndicator.className = 'auto-save-indicator saved';
                    autoSaveIndicator.textContent = '✓ Saved';
                    isModified = false;
                } else {
                    throw new Error('Save failed');
                }
            } catch (error) {
                autoSaveIndicator.className = 'auto-save-indicator error';
                autoSaveIndicator.textContent = '❌ Error';
                console.error('Save error:', error);
            }
        }
        
        // Cancel all changes made in the current session and save the reverted state
        async function cancelChanges() {
            if (history.stack.length <= 1) {
                alert('No changes have been made in this session to cancel.');
                return;
            }

            if (confirm('Are you sure you want to discard all changes from this session? This will revert the document to how it was when you opened it and save this state.')) {
                const initialState = history.stack[0];
                
                if (initialState) {
                    // 1. Revert the textarea content to the initial state.
                    textArea.value = initialState.content;
                    textArea.setSelectionRange(initialState.cursorStart, initialState.cursorEnd);
                    updateAllUI();

                    // 2. Immediately save this reverted state to the server.
                    //    The saveDocument function will handle UI indicators and set isModified to false.
                    await saveDocument();
                    
                    // 3. After the save is confirmed, reset the local history.
                    //    This prevents "undoing the cancel".
                    history.reset();

                    // 4. Record the newly saved state as the new baseline for future undos.
                    history.record();
                }
            }
        }
        
        // Auto-save
        function autoSave() {
            if (isModified) {
                saveDocument();
            }
        }
        
        // Mark as modified
        function markModified() {
            if (!isModified) {
                isModified = true;
                autoSaveIndicator.className = 'auto-save-indicator saving';
                autoSaveIndicator.textContent = '● Modified';
            }
        }
        
        // Toggle search and replace
        function toggleSearch() {
            const searchReplace = document.getElementById('searchReplace');
            searchReplace.classList.toggle('active');
            if (searchReplace.classList.contains('active')) {
                document.getElementById('searchInput').focus();
            }
        }
        
        // Perform search
        function performSearch() {
            const searchTerm = document.getElementById('searchInput').value;
            if (searchTerm) {
                const content = textArea.value;
                const regex = new RegExp(searchTerm, 'gi');
                const matches = content.match(regex);
                if (matches) {
                    console.log(`Found ${matches.length} matches`);
                }
            }
        }
        
        // Replace all occurrences
        function replaceAll() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();
            
            const searchTerm = document.getElementById('searchInput').value;
            const replaceTerm = document.getElementById('replaceInput').value;
            
            if (searchTerm) {
                const content = textArea.value;
                const regex = new RegExp(searchTerm, 'g');
                const newContent = content.replace(regex, replaceTerm);
                
                if (newContent !== content) {
                    textArea.value = newContent;
                    updateAllUI();
                    markModified();
                }
            }
        }
        
        // Format document
        function formatDocument() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();

            const content = textArea.value;
            let formatted = content;
            
            const lines = content.split('\n');
            const formattedLines = lines.map(line => line.trim());
            formatted = formattedLines.join('\n');
            
            formatted = formatted.replace(/\n\n\n+/g, '\n\n');
            
            if (formatted !== content) {
                textArea.value = formatted;
                updateAllUI();
                markModified();
            }
        }
        
        // Function to toggle RTL mode
        function toggleRTL() {
            const editorWrapper = document.querySelector('.editor-wrapper');
            editorWrapper.classList.toggle('rtl-mode');
            textArea.classList.toggle('rtl-mode');
            lineNumbers.classList.toggle('rtl-mode');
        }
        
        // Change syntax highlighting mode
        function changeSyntaxMode() {
            const mode = document.getElementById('syntaxMode').value;
            console.log('Syntax mode changed to:', mode);
        }
        
        // Delete document
        async function deleteDocument() {
            if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                try {
                    const response = await fetch(`/delete/${docId}`, {
                        method: 'POST'
                    });
                    
                    if (response.ok) {
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
        
        // Toggle shortcuts modal
        function toggleShortcuts() {
            const modal = document.getElementById('shortcutsModal');
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        }
        
        // Close modal when clicking outside
        function closeModal(event) {
            if (event.target.id === 'shortcutsModal') {
                event.target.style.display = 'none';
            }
        }
        
        // Duplicate current line
        function duplicateLine() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();
            
            const cursorPos = textArea.selectionStart;
            const lines = textArea.value.split('\n');
            const textBeforeCursor = textArea.value.substring(0, cursorPos);
            const currentLineNumber = textBeforeCursor.split('\n').length - 1;
            const currentLine = lines[currentLineNumber];
            
            lines.splice(currentLineNumber + 1, 0, currentLine);
            textArea.value = lines.join('\n');
            
            const newCursorPos = cursorPos + currentLine.length + 1;
            textArea.setSelectionRange(newCursorPos, newCursorPos);
            
            updateAllUI();
            markModified();
        }
        
        // Move line up
        function moveLineUp() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();

            const cursorPos = textArea.selectionStart;
            const lines = textArea.value.split('\n');
            const textBeforeCursor = textArea.value.substring(0, cursorPos);
            const currentLineNumber = textBeforeCursor.split('\n').length - 1;
            
            if (currentLineNumber > 0) {
                const currentLine = lines[currentLineNumber];
                const previousLine = lines[currentLineNumber - 1];
                
                lines[currentLineNumber - 1] = currentLine;
                lines[currentLineNumber] = previousLine;
                
                textArea.value = lines.join('\n');
                
                const newCursorPos = cursorPos - previousLine.length - 1;
                textArea.setSelectionRange(newCursorPos, newCursorPos);
                
                updateAllUI();
                markModified();
            }
        }
        
        // Move line down
        function moveLineDown() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();
            
            const cursorPos = textArea.selectionStart;
            const lines = textArea.value.split('\n');
            const textBeforeCursor = textArea.value.substring(0, cursorPos);
            const currentLineNumber = textBeforeCursor.split('\n').length - 1;
            
            if (currentLineNumber < lines.length - 1) {
                const currentLine = lines[currentLineNumber];
                const nextLine = lines[currentLineNumber + 1];
                
                lines[currentLineNumber] = nextLine;
                lines[currentLineNumber + 1] = currentLine;
                
                textArea.value = lines.join('\n');
                
                const newCursorPos = cursorPos + nextLine.length + 1;
                textArea.setSelectionRange(newCursorPos, newCursorPos);
                
                updateAllUI();
                markModified();
            }
        }
        
        // Toggle comment (basic implementation)
        function toggleComment() {
            // <!-- HISTORY MANAGER -->: Record state before action
            history.record();
            
            const cursorPos = textArea.selectionStart;
            const lines = textArea.value.split('\n');
            const textBeforeCursor = textArea.value.substring(0, cursorPos);
            const currentLineNumber = textBeforeCursor.split('\n').length - 1;
            const currentLine = lines[currentLineNumber];
            
            if (currentLine.trim().startsWith('//')) {
                lines[currentLineNumber] = currentLine.replace('//', '');
            } else {
                lines[currentLineNumber] = '//' + currentLine;
            }
            
            textArea.value = lines.join('\n');
            updateAllUI();
            markModified();
        }
        
        // Event listeners
        textArea.addEventListener('input', function() {
            updateAllUI();
            markModified();
            // <!-- HISTORY MANAGER -->: Record user typing with a debounce
            history.recordDebounced();
        });
        
        textArea.addEventListener('scroll', syncScroll);
        textArea.addEventListener('keyup', updateCursorPosition);
        textArea.addEventListener('click', updateCursorPosition);
        
        // Keyboard shortcuts
        textArea.addEventListener('keydown', function(e) {
            // Tab handling
            if (e.key === 'Tab') {
                e.preventDefault();
                // <!-- HISTORY MANAGER -->: Record state before action
                history.record();
                
                const start = this.selectionStart;
                const end = this.selectionEnd;
                
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 1;
                
                updateAllUI();
                markModified();
                return;
            }
            
            // Keyboard shortcuts with Ctrl
            if (e.ctrlKey || e.metaKey) { // Also check for Cmd on Mac
                switch(e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        saveDocument();
                        break;
                    case 'f':
                        e.preventDefault();
                        toggleSearch();
                        break;
                    case 'd':
                        e.preventDefault();
                        duplicateLine();
                        break;
                    case '/':
                        e.preventDefault();
                        toggleComment();
                        break;
                    // <!-- HISTORY MANAGER -->: Custom Undo
                    case 'z':
                        e.preventDefault();
                        const undoState = history.undo();
                        if (undoState) history.applyState(undoState);
                        break;
                    // <!-- HISTORY MANAGER -->: Custom Redo
                    case 'y':
                        e.preventDefault();
                        const redoState = history.redo();
                        if (redoState) history.applyState(redoState);
                        break;
                }
            }
            
            // Alt shortcuts
            if (e.altKey) {
                switch(e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        moveLineUp();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        moveLineDown();
                        break;
                }
            }
            
            // Shift + Alt shortcuts
            if (e.shiftKey && e.altKey) {
                switch(e.key.toLowerCase()) {
                    case 'f':
                        e.preventDefault();
                        formatDocument();
                        break;
                }
            }
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Close modals
                document.getElementById('shortcutsModal').style.display = 'none';
                document.getElementById('searchReplace').classList.remove('active');
            }
        });
        
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initializeEditor);
        
        // Warn about unsaved changes before leaving
        window.addEventListener('beforeunload', function(e) {
            if (isModified) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        function print(string) {
            fetch(`/print`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: string })
                });
        }