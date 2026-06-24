import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Scanner from './pages/Scanner';
import LiveScanner from './pages/LiveScanner';
import PostDetail from './pages/PostDetail';
import Dashboard from './pages/Dashboard';
import Trends from './pages/Trends';
import Stats from './pages/Stats';
import Registry from './pages/Registry';
import CommandCenter from './pages/CommandCenter';
import AutonomousScanner from './pages/AutonomousScanner';
import { AnalystDock } from './components/AnalystDock';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const loadPostsFromDb = useAppStore((s) => s.loadPostsFromDb);

  useEffect(() => {
    loadPostsFromDb();
  }, []);

  return (
    <BrowserRouter>
      <AnalystDock />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/commandcenter" element={<CommandCenter />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/livescanner" element={<LiveScanner />} />
        <Route path="/autoscanner" element={<AutonomousScanner />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/registry" element={<Registry />} />
      </Routes>
    </BrowserRouter>
  );
}
