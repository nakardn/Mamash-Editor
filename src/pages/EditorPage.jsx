import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import localforage from 'localforage';

const EditorPage = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [versions, setVersions] = useState([]);
  const editorRef = useRef(null);

  useEffect(() => {
    const fetchDocument = async () => {
      const doc = await localforage.getItem(id);
      if (doc) {
        setDocument(doc);
        setContent(doc.content);
        setVersions(doc.versions || []);
      } else {
        // Handle case where document might not exist (e.g., direct URL access)
        // Redirect to dashboard or create a new document
        // For now, let's just set a default empty document
        const newDocument = {
          id: id,
          title: 'Untitled Document',
          content: '',
          versions: []
        };
        await localforage.setItem(id, newDocument);
        setDocument(newDocument);
        setContent('');
        setVersions([]);
      }
    };
    fetchDocument();
  }, [id]);

  const handleEditorChange = (value) => {
    setContent(value);
    if (document) {
      const updatedDocument = { ...document, content: value };
      setDocument(updatedDocument);
      localforage.setItem(id, updatedDocument);

      // Save version every 5 seconds of inactivity or on significant change
      // This is a simplified approach. A more robust solution would use debouncing.
      if (editorRef.current) {
        clearTimeout(editorRef.current.saveTimer);
        editorRef.current.saveTimer = setTimeout(() => {
          saveVersion(updatedDocument);
        }, 5000);
      }
    }
  };

  const saveVersion = async (docToSave) => {
    const newVersion = {
      timestamp: Date.now(),
      content: docToSave.content,
    };
    const updatedVersions = [...(docToSave.versions || []), newVersion];
    // Keep only the last 10 versions to prevent excessive storage
    const limitedVersions = updatedVersions.slice(-10);
    const finalDocument = { ...docToSave, versions: limitedVersions };
    await localforage.setItem(id, finalDocument);
    setVersions(limitedVersions);
    setDocument(finalDocument);
  };

  const revertToVersion = async (versionContent) => {
    setContent(versionContent);
    if (document) {
      const updatedDocument = { ...document, content: versionContent };
      setDocument(updatedDocument);
      await localforage.setItem(id, updatedDocument);
      // No need to save a new version when reverting, as it's a historical state
    }
  };

  if (!document) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <input
          type="text"
          value={document.title}
          onChange={async (e) => {
            const updatedDocument = { ...document, title: e.target.value };
            setDocument(updatedDocument);
            await localforage.setItem(id, updatedDocument);
          }}
          className="bg-gray-800 text-white text-2xl font-bold focus:outline-none w-full"
        />
      </div>
      <div className="flex flex-grow">
        <div className="w-3/4">
          <Editor
            height="100%"
            theme="vs-dark"
            value={content}
            onChange={handleEditorChange}
            onMount={(editor) => (editorRef.current = editor)}
          />
        </div>
        <div className="w-1/4 bg-gray-800 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Versions</h2>
          {versions.length === 0 ? (
            <p className="text-gray-400">No versions saved yet.</p>
          ) : (
            <ul>
              {versions.map((version, index) => (
                <li key={index} className="mb-2 flex justify-between items-center">
                  <span className="text-gray-300 text-sm">
                    {new Date(version.timestamp).toLocaleString()}
                  </span>
                  <button
                    onClick={() => revertToVersion(version.content)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded"
                  >
                    Revert
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
