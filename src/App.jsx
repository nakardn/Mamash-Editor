import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import localforage from 'localforage';
import Dashboard from './pages/Dashboard';
import EditorPage from './pages/EditorPage';

const App = () => {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    localforage.getItem('theme').then(savedTheme => {
      if (savedTheme) {
        setTheme(savedTheme);
      }
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localforage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:id" element={<EditorPage />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
