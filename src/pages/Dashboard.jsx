import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import localforage from 'localforage';

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      const keys = await localforage.keys();
      const docs = [];
      for (const key of keys) {
        if (key.startsWith('document_')) {
          const doc = await localforage.getItem(key);
          docs.push(doc);
        }
      }
      setDocuments(docs);
    };
    fetchDocuments();
  }, []);

  const createNewDocument = async () => {
    const newId = `document_${Date.now()}`;
    const newDocument = {
      id: newId,
      title: 'Untitled Document',
      content: ''
    };
    await localforage.setItem(newId, newDocument);
    setDocuments([...documents, newDocument]);
  };

  const backupDocuments = async () => {
    const docs = {};
    const keys = await localforage.keys();
    for (const key of keys) {
      if (key.startsWith('document_')) {
        docs[key] = await localforage.getItem(key);
      }
    }
    const json = JSON.stringify(docs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `editor-backup-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteDocument = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await localforage.removeItem(id);
      setDocuments(documents.filter(doc => doc.id !== id));
    }
  };

  const restoreDocuments = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const json = e.target.result;
      const docs = JSON.parse(json);
      for (const key in docs) {
        await localforage.setItem(key, docs[key]);
      }
      const keys = await localforage.keys();
      const newDocs = [];
      for (const key of keys) {
        if (key.startsWith('document_')) {
          const doc = await localforage.getItem(key);
          newDocs.push(doc);
        }
      }
      setDocuments(newDocs);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={createNewDocument}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            New Document
          </button>
          <button
            onClick={backupDocuments}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Backup Documents
          </button>
          <label className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded cursor-pointer">
            Restore Documents
            <input type="file" className="hidden" onChange={restoreDocuments} />
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div key={doc.id} className="bg-gray-800 p-4 rounded-lg shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between">
            <Link to={`/editor/${doc.id}`}>
              <div>
                <h2 className="text-xl font-bold mb-2">{doc.title}</h2>
                <p className="text-gray-400">Last modified: {new Date(parseInt(doc.id.split('_')[1])).toLocaleDateString()}</p>
              </div>
            </Link>
            <button
              onClick={() => deleteDocument(doc.id)}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;