import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(user, { displayName: name });
      
      await setDoc(doc(db, "users", user.uid), {
        name,
        batch,
        email,
        role: "student",
        createdAt: new Date().toISOString()
      });

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Failed to create account');
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 tracking-tight">Create an account</h2>
      
      {error && (
        <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm border border-rose-100 font-medium shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
          <input 
            type="text" 
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm font-medium"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Batch / Class</label>
          <input 
            type="text" 
            placeholder="e.g. Batch 2024"
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm font-medium"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          />
        </div>
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
            minLength={6}
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
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      
      <p className="mt-8 text-center text-sm font-medium text-slate-500">
        Already have an account? <Link to="/login" className="text-teal-600 hover:text-teal-700 font-bold">Sign in</Link>
      </p>
    </div>
  );
}
