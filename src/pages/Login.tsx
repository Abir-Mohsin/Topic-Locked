import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setResetSuccess('');
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSuccess('A password reset link has been sent to your email. Please check your inbox.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError(err.message || 'Failed to send password reset email');
      }
    } finally {
      setResetLoading(false);
    }
  };

  if (isResetMode) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <button 
          type="button"
          onClick={() => { setIsResetMode(false); setError(''); setResetSuccess(''); }}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to sign in</span>
        </button>

        <h2 className="text-2xl font-bold mb-2 text-slate-800 tracking-tight">Forgot password?</h2>
        <p className="text-sm text-slate-500 mb-6">Enter your registered email address and we'll send you a link to reset your password.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm border border-rose-100 font-medium shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3 text-sm border border-emerald-100 font-medium shadow-sm">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{resetSuccess}</span>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input 
              type="email" 
              required
              placeholder="student@example.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={resetLoading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm uppercase tracking-widest transition-all disabled:opacity-70 mt-4 shadow-sm shadow-teal-200"
          >
            {resetLoading ? 'Sending Link...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    );
  }

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
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <button 
              type="button" 
              onClick={() => { setIsResetMode(true); setError(''); setResetSuccess(''); }}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Forgot password?
            </button>
          </div>
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
