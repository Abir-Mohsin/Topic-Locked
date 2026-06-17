import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { LogOut, BookOpen } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

function ProtectedRoute({ children, reqAdmin = false }: { children: React.ReactNode, reqAdmin?: boolean }) {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (reqAdmin && !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout, studentName } = useAuth();
  const [appName, setAppName] = useState('As-Sunnah Dawah & Research Institute');
  const [appSubtitle, setAppSubtitle] = useState('Topic Selection & Locking System');

  useEffect(() => {
    const qSettings = doc(db, "settings", "general");
    const unsubscribe = onSnapshot(qSettings, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.appName) setAppName(data.appName);
        if (data.appSubtitle !== undefined) setAppSubtitle(data.appSubtitle);
      }
    }, (error) => {
      console.warn("Header settings load error:", error);
    });
    return () => unsubscribe();
  }, []);

  const firstLetter = appName ? appName.trim().charAt(0).toUpperCase() : 'A';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col gap-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 flex-1">
        <header className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-700 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0">{firstLetter}</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-teal-900 line-clamp-1">{appName}</h1>
              <p className="text-sm text-slate-500 font-medium">{appSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="text-right mr-2 hidden sm:block">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isAdmin ? "Administrator" : "Student"}</p>
                  <p className="text-sm font-semibold">{studentName || user.email}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(studentName || user.email || 'User')}&background=0D9488&color=fff`} alt="User" />
                </div>
                <button 
                  onClick={logout}
                  className="ml-2 p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-xl hover:bg-rose-50"
                  title="Log out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 w-full flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading application...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Layout><Login /></Layout>} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Layout><Register /></Layout>} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            {isAdmin ? <AdminDashboard /> : <StudentDashboard />}
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
