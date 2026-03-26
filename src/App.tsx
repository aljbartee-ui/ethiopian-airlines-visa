import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Hero from '@/sections/Hero';
import ApplicationForm from '@/sections/ApplicationForm';
import AdminDashboard from '@/sections/AdminDashboard';
import './App.css';

function HomePage() {
  return (
    <main className="min-h-screen bg-[#1a1a1a]">
      <Hero />
      <ApplicationForm />
    </main>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </Router>
  );
}

export default App;
