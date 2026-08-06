import React, { useState } from 'react';
import { KeyRound, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { PanitiaMember } from '../types';
import { getSupabaseClient } from '../lib/supabase';

interface LoginModalProps {
  panitiaMembers: PanitiaMember[];
  onLoginSuccess: (user: PanitiaMember) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ panitiaMembers, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const trimmedUsername = username.trim().toLowerCase();
    
    // 1. Search in memory state first
    let foundUser = panitiaMembers.find(
      (m) => m.username.toLowerCase() === trimmedUsername
    );

    // 2. If not found in local memory state or to verify fresh data, query Supabase directly
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('panitia_members')
          .select('*')
          .ilike('username', trimmedUsername)
          .maybeSingle();

        if (error) {
          console.error('[AUTH ERROR] Supabase query failed when checking panitia_members:', error.message, error);
        } else if (data) {
          foundUser = data;
        }
      } catch (err) {
        console.error('[AUTH EXCEPTION] Error connecting to Supabase during login:', err);
      }
    }

    // 3. User not found check
    if (!foundUser) {
      console.error(`[AUTH FAILED] Username "@${trimmedUsername}" tidak ditemukan di database.`);
      setErrorMsg(`Username "@${trimmedUsername}" tidak ditemukan. Silakan hubungi Master Admin.`);
      setIsLoading(false);
      return;
    }

    // 4. Inactive account check
    if (foundUser.status === 'inactive') {
      console.error(`[AUTH REJECTED] Akun "@${trimmedUsername}" ditemukan tapi berstatus NON-AKTIF.`);
      setErrorMsg(`Akun @${foundUser.username} sedang non-aktif. Silakan hubungi Master Admin.`);
      setIsLoading(false);
      return;
    }

    // 5. Password check
    const expectedPass = foundUser.password || '123';
    if (password !== expectedPass) {
      console.error(`[AUTH REJECTED] Password salah untuk username "@${trimmedUsername}".`);
      setErrorMsg('Password yang Anda masukkan salah! Silakan periksa kembali.');
      setIsLoading(false);
      return;
    }

    // 6. Login Success
    console.log(`[AUTH SUCCESS] User "${foundUser.name}" (@${foundUser.username}) - Role: ${foundUser.role} berhasil login.`);
    setIsLoading(false);
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
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm disabled:opacity-50"
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
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm disabled:opacity-50"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa Akses...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Masuk ke Aplikasi</span>
                </>
              )}
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
