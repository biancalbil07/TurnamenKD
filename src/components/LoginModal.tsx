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
              placeholder="Masukkan username (contoh: admin / panitia)"
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

          {/* Quick Account Hint */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-extrabold text-[10px] text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Akun Login (Default):</span>
              <span className="text-[10px] text-red-600 font-bold font-mono">Pass: 123</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('123');
                }}
                className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded text-[10px] transition"
              >
                Admin Master: admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('panitia');
                  setPassword('123');
                }}
                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-[10px] transition"
              >
                Anggota: panitia
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <KeyRound className="w-4 h-4" /> Masuk ke Aplikasi
          </button>

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
