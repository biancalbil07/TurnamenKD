import React, { useState } from 'react';
import { Clock, Plus, Trash2, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { TimeSlot, PanitiaMember } from '../types';
import { addTimeSlot, deleteTimeSlot } from '../lib/db';

interface TimeSlotManagerProps {
  timeSlots: TimeSlot[];
  currentUser: PanitiaMember;
  onRefresh: () => void;
}

export function TimeSlotManager({ timeSlots, currentUser, onRefresh }: TimeSlotManagerProps) {
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isMaster = currentUser.role === 'master';

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = newSlotLabel.trim();
    if (!trimmed) {
      setErrorMsg('Label slot jam main tidak boleh kosong.');
      return;
    }

    if (timeSlots.some((s) => s.slot_label.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Slot jam main ini sudah ada.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTimeSlot(trimmed, currentUser);
      setNewSlotLabel('');
      setSuccessMsg(`Slot jam main "${trimmed}" berhasil ditambahkan!`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan slot jam main.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string, label: string) => {
    if (timeSlots.length <= 1) {
      setErrorMsg('Harus ada setidaknya 1 slot jam main aktif dalam sistem.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus slot jam main "${label}"?`)) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      await deleteTimeSlot(id, currentUser);
      setSuccessMsg(`Slot jam main "${label}" berhasil dihapus.`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus slot jam main.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-amber-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold text-amber-300 mb-2">
              <Clock className="w-3.5 h-3.5" /> CRUD Khusus Master Admin
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Pengaturan Slot Jam Pertandingan Dinamis
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Kelola opsi ketersediaan waktu main untuk pendaftaran tim. Sistem akan otomatis memasangkan tim (Same Time Slot Matching) pada babak kualifikasi berdasarkan slot yang dipilih.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hak Akses: <strong className="text-white">Master Admin</strong></span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add New Time Slot Card */}
      {isMaster && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-500" />
            Tambah Slot Jam Pertandingan Baru
          </h3>

          <form onSubmit={handleAddSlot} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Contoh: 08:00 - 12:00 atau 13:00 - 18:00..."
                value={newSlotLabel}
                onChange={(e) => setNewSlotLabel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Tambah Slot'}</span>
            </button>
          </form>

          <p className="text-[11px] text-slate-500 italic">
            * Opsi slot yang ditambahkan di sini akan langsung muncul secara otomatis pada form registrasi tim dan tersimpan di database Supabase.
          </p>
        </div>
      )}

      {/* Active Time Slots List */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Daftar Slot Jam Pertandingan Aktif ({timeSlots.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Opsi aktif di bawah ini digunakan untuk pengelompokan tim dan pembuatan bagan kualifikasi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {timeSlots.map((slot, idx) => (
            <div
              key={slot.id}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center border border-amber-200">
                  #{idx + 1}
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>☀️ {slot.slot_label}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {slot.is_default ? 'Sistem Default' : 'Slot Kustom Admin'}
                  </div>
                </div>
              </div>

              {isMaster && (
                <button
                  onClick={() => handleDeleteSlot(slot.id, slot.slot_label)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Hapus Slot Jam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {/* Neutral Night Slot Info Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-rose-950 rounded-xl border border-rose-800/50 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 font-extrabold text-xs flex items-center justify-center border border-rose-500/40">
                ⚡
              </div>
              <div>
                <div className="font-extrabold text-xs text-rose-200">
                  23:00 - Selesai (Slot Netral)
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  Fallback otomatis untuk bentrok jadwal babak gugur/final.
                </div>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
