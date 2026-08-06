import React, { useState } from 'react';
import { KeyRound, User, Lock, AlertCircle } from 'lucide-react';
import { PanitiaMember } from '../types';

interface LoginModalProps {
  panitiaMembers: PanitiaMember[];
  onLoginSuccess: (user: PanitiaMember) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ panitiaMembers, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedUsername = username.trim().toLowerCase();
    const foundUser = panitiaMembers.find(
      (m) => m.username.toLowerCase() === trimmedUsername && m.status === 'active'
    );

    if (!foundUser) {
      setErrorMsg('Username tidak ditemukan atau status akun tidak aktif.');
      return;
    }

    // Verify password (default '123' if not set)
    const expectedPass = foundUser.password || '123';
    if (password !== expectedPass) {
      setErrorMsg('Password salah! Silakan periksa kembali password Anda.');
      return;
    }

    onLoginSuccess(foundUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Banner Header */}
        <div className="bg-slate-900 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="inline-flex p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-600/30 text-white font-black italic text-2xl mb-3">
            KD
          </div>
          
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            Masuk Sistem Turnamen
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Selamat Datang & Selamat Beraktifitas
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-red-600" /> Username Panitia / Admin
            </label>
            <input
              type="text"
              placeholder="Masukkan username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-red-600" /> Kata Sandi / Password
            </label>
            <input
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" /> Masuk ke Aplikasi
            </button>
          </div>

          {/* Footer Credits */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-xs font-semibold text-slate-400 tracking-wide">
              Create By Pudelinkz
            </span>
          </div>

        </form>

      </div>
    </div>
  );
};
