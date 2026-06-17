import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 tracking-tight">Welcome back</h2>
      
      {error && (
        <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm border border-rose-100 font-medium shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
          <input 
            type="email" 
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm font-medium"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
          <input 
            type="password" 
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm font-medium"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm uppercase tracking-widest transition-all disabled:opacity-70 mt-4 shadow-sm shadow-teal-200"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      
      <p className="mt-8 text-center text-sm font-medium text-slate-500">
        Don't have an account? <Link to="/register" className="text-teal-600 hover:text-teal-700 font-bold">Register here</Link>
      </p>
    </div>
  );
}
