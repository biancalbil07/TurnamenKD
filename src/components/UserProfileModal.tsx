import React, { useState } from 'react';
import { X, User, Phone, Lock, Save, Shield, CheckCircle } from 'lucide-react';
import { PanitiaMember } from '../types';
import { updatePanitiaMember } from '../lib/db';

interface UserProfileModalProps {
  currentUser: PanitiaMember;
  onClose: () => void;
  onUserUpdated: (updatedUser: PanitiaMember) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  onClose,
  onUserUpdated,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [password, setPassword] = useState(currentUser.password || '123');
  const [confirmPassword, setConfirmPassword] = useState(currentUser.password || '123');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Nama tidak boleh kosong.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Password dan konfirmasi password tidak cocok.');
      return;
    }

    const updated: PanitiaMember = {
      ...currentUser,
      name: name.trim(),
      phone: phone.trim(),
      password: password,
    };

    await updatePanitiaMember(updated, currentUser);
    onUserUpdated(updated);
    setSuccessMsg('Profil dan password berhasil diperbarui!');

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-black">Pengaturan Profil & Password</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username & Divisi</div>
              <div className="font-bold text-slate-800 text-sm">@{currentUser.username}</div>
              <div className="text-slate-500">{currentUser.division}</div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
              currentUser.role === 'master' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-800'
            }`}>
              {currentUser.role === 'master' ? 'Master Admin' : 'Anggota Panitia'}
            </span>
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-red-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 mb-1">Nomor WhatsApp / Telepon</label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block font-extrabold text-slate-800 mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-red-600" /> Kata Sandi / Password Baru
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password baru"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 mb-1">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-sm"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Simpan Perubahan
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
