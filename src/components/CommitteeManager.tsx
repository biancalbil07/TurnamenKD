import React, { useState } from 'react';
import { PanitiaMember, Role } from '../types';
import {
  Shield,
  UserPlus,
  Trash2,
  Edit3,
  CheckCircle,
  Phone,
  Lock,
  UserCheck,
  Key,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  UserX,
  ShieldAlert,
  KeyRound,
  Check,
  Copy,
} from 'lucide-react';
import { addPanitiaMember, updatePanitiaMember, deletePanitiaMember } from '../lib/db';

interface CommitteeManagerProps {
  panitiaMembers: PanitiaMember[];
  currentUser: PanitiaMember;
  onRefresh: () => void;
}

export const CommitteeManager: React.FC<CommitteeManagerProps> = ({
  panitiaMembers,
  currentUser,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<PanitiaMember | null>(null);
  const [resetPassMember, setResetPassMember] = useState<PanitiaMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'master' | 'anggota'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form State for Add Member
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('anggota');
  const [phone, setPhone] = useState('');
  const [division, setDivision] = useState('Seksi Lapangan');

  const isMaster = currentUser.role === 'master';

  const resetAddForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole('anggota');
    setPhone('');
    setDivision('Seksi Lapangan');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;

    // Check existing username
    const exists = panitiaMembers.some(
      (m) => m.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (exists) {
      alert(`Username @${username.trim()} sudah digunakan oleh anggota lain!`);
      return;
    }

    const newMember: PanitiaMember = {
      id: `panitia_${Date.now()}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password: password.trim() || '123',
      role,
      phone: phone.trim() || '081234567890',
      division: division.trim() || 'Seksi Lapangan',
      status: 'active',
      joined_at: new Date().toISOString(),
    };

    await addPanitiaMember(newMember, currentUser);
    setShowAddModal(false);
    resetAddForm();
    onRefresh();
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    await updatePanitiaMember(editingMember, currentUser);
    setEditingMember(null);
    onRefresh();
  };

  // Direct Role Change Handler
  const handleToggleRole = async (targetMember: PanitiaMember) => {
    if (!isMaster) return;
    if (targetMember.id === currentUser.id) {
      alert('Anda tidak dapat mengubah peran akun Anda sendiri yang sedang digunakan.');
      return;
    }

    const newRole: Role = targetMember.role === 'master' ? 'anggota' : 'master';
    const roleLabel = newRole === 'master' ? '👑 Master Admin' : '⚽ Panitia Lapangan';

    if (confirm(`Ubah peran ${targetMember.name} menjadi "${roleLabel}"?`)) {
      const updated: PanitiaMember = { ...targetMember, role: newRole };
      await updatePanitiaMember(updated, currentUser);
      onRefresh();
    }
  };

  // Direct Status Toggle Handler
  const handleToggleStatus = async (targetMember: PanitiaMember) => {
    if (!isMaster) return;
    if (targetMember.id === currentUser.id) {
      alert('Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.');
      return;
    }

    const newStatus = targetMember.status === 'active' ? 'inactive' : 'active';
    const updated: PanitiaMember = { ...targetMember, status: newStatus };
    await updatePanitiaMember(updated, currentUser);
    onRefresh();
  };

  // Reset Password Action
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassMember || !newPassword.trim()) return;

    const updated: PanitiaMember = {
      ...resetPassMember,
      password: newPassword.trim(),
    };

    await updatePanitiaMember(updated, currentUser);
    setResetSuccessMsg(`Password untuk @${resetPassMember.username} berhasil di-reset menjadi "${newPassword.trim()}"!`);
    onRefresh();

    setTimeout(() => {
      setResetPassMember(null);
      setNewPassword('');
      setResetSuccessMsg('');
    }, 1500);
  };

  const generateRandomPassword = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = 'KD-';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(rand);
  };

  const handleDeleteMember = async (id: string) => {
    if (!isMaster) {
      alert('Hanya Master Admin yang diizinkan menghapus panitia.');
      return;
    }
    if (id === currentUser.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus anggota panitia ini secara permanen?')) {
      await deletePanitiaMember(id, currentUser);
      onRefresh();
    }
  };

  // Filtered members list
  const filteredMembers = panitiaMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.division.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' || (m.status || 'active') === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            <span>Manajemen Role, Kelola Pengguna & Kredensial</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Modul khusus Master Admin untuk mengelola hak akses, ubah peran, status aktif, dan reset password anggota.
          </p>
        </div>

        {isMaster && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow-lg shadow-red-600/20 hover:shadow-red-500/30 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Registrasi Anggota Baru
          </button>
        )}
      </div>

      {/* Privilege Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Master Admin Privilege */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
              <span className="text-xl">👑</span> MASTER ADMIN
            </div>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black uppercase rounded">
              Full Access
            </span>
          </div>
          <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
            Memiliki kewenangan penuh: mengubah role anggota, mereset password, mengelola database Supabase, konfigurasi Bot Telegram, dan reset sistem.
          </p>
        </div>

        {/* Panitia Lapangan Privilege */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-blue-950 text-sm">
              <span className="text-xl">⚽</span> PANITIA LAPANGAN
            </div>
            <span className="px-2 py-0.5 bg-blue-200 text-blue-900 text-[10px] font-black uppercase rounded">
              Operational Only
            </span>
          </div>
          <p className="text-xs text-blue-900/80 leading-relaxed font-medium">
            Hak akses operasional: fokus pada input skor pertandingan live di lapangan, update waktu match, dan memantau bagan turnamen.
          </p>
        </div>

      </div>

      {/* Users Table & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, username, divisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Role & Status Filter Selectors */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 text-xs"
            >
              <option value="all">Semua Role</option>
              <option value="master">👑 Master Admin</option>
              <option value="anggota">⚽ Panitia Lapangan</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 text-xs"
            >
              <option value="all">Semua Status</option>
              <option value="active">🟢 Aktif</option>
              <option value="inactive">🔴 Non-Aktif</option>
            </select>
          </div>

        </div>

        {/* User Table Header */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 font-extrabold text-[11px] text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5 sm:col-span-4">Informasi Pengguna</div>
          <div className="col-span-3 sm:col-span-3">Peran / Role</div>
          <div className="col-span-2 sm:col-span-2">Status Akun</div>
          <div className="col-span-2 sm:col-span-3 text-right">Aksi & Kredensial</div>
        </div>

        {/* User Rows List */}
        <div className="divide-y divide-slate-100 text-xs">
          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium">
              Tidak ada anggota panitia yang sesuai dengan pencarian / filter.
            </div>
          ) : (
            filteredMembers.map((m) => {
              const isUserMaster = m.role === 'master';
              const isSelf = m.id === currentUser.id;
              const isActive = (m.status || 'active') === 'active';

              return (
                <div
                  key={m.id}
                  className="px-6 py-4 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/80 transition"
                >
                  
                  {/* Column 1: User Info */}
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-3">
                    <div
                      className={`w-10 h-10 shrink-0 rounded-xl font-black flex items-center justify-center text-lg ${
                        isUserMaster
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isUserMaster ? '👑' : '⚽'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm truncate">
                          {m.name}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] bg-red-100 text-red-800 font-black px-1.5 py-0.5 rounded uppercase">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        @{m.username} • {m.division}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span>{m.phone || '081234567890'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Role Switch */}
                  <div className="col-span-3 sm:col-span-3 flex items-center">
                    <button
                      onClick={() => handleToggleRole(m)}
                      disabled={!isMaster || isSelf}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-black transition flex items-center gap-1.5 ${
                        isUserMaster
                          ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                          : 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
                      } ${(!isMaster || isSelf) ? 'opacity-90 cursor-default' : 'cursor-pointer shadow-sm'}`}
                      title={isMaster && !isSelf ? 'Klik untuk mengubah Role pengguna ini' : ''}
                    >
                      <span>{isUserMaster ? '👑 Master Admin' : '⚽ Panitia Lapangan'}</span>
                      {isMaster && !isSelf && (
                        <RefreshCw className="w-3 h-3 text-slate-400 group-hover:rotate-180 transition-transform" />
                      )}
                    </button>
                  </div>

                  {/* Column 3: Account Status */}
                  <div className="col-span-2 sm:col-span-2 flex items-center">
                    <button
                      onClick={() => handleToggleStatus(m)}
                      disabled={!isMaster || isSelf}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      } ${(!isMaster || isSelf) ? 'opacity-90 cursor-default' : 'cursor-pointer'}`}
                      title={isMaster && !isSelf ? 'Klik untuk ubah Status Aktif/Non-aktif' : ''}
                    >
                      {isActive ? (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 text-red-600" />
                          <span>Non-Aktif</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Column 4: Actions (Reset Password, Edit, Delete) */}
                  <div className="col-span-2 sm:col-span-3 flex items-center justify-end gap-1.5">
                    {isMaster && (
                      <>
                        {/* Reset Password Button */}
                        <button
                          onClick={() => {
                            setResetPassMember(m);
                            setNewPassword(m.password || '123');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-300 hover:border-amber-300 rounded-xl font-bold text-[11px] transition flex items-center gap-1 shadow-sm"
                          title="Reset / Atur Ulang Password Anggota"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          <span className="hidden lg:inline">Reset Pass</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingMember(m)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                          title="Edit Data Anggota"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition"
                            title="Hapus Anggota"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* MODAL 1: ADD NEW MEMBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddMember}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="w-5 h-5 text-red-600" /> Registrasi Anggota Panitia Baru
            </h3>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Nama Lengkap Anggota
              </label>
              <input
                type="text"
                placeholder="Contoh: Mas Rian Panitia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Username Login
                </label>
                <input
                  type="text"
                  placeholder="rian_lapangan"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Password Awal
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Peran / Hak Akses
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="anggota">⚽ Panitia Lapangan</option>
                  <option value="master">👑 Master Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  No. WhatsApp / HP
                </label>
                <input
                  type="text"
                  placeholder="081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Divisi / Seksi Tugas
              </label>
              <input
                type="text"
                placeholder="Seksi Wasit & Skor / Koordinator Lapangan A"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Simpan Anggota Baru
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD FOR USER */}
      {resetPassMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleResetPassword}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" /> Reset Password Anggota
              </h3>
              <button
                type="button"
                onClick={() => setResetPassMember(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {resetSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetSuccessMsg}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Target Pengguna
              </div>
              <div className="font-extrabold text-slate-900 text-sm">{resetPassMember.name}</div>
              <div className="text-xs text-slate-500 font-mono">@{resetPassMember.username} ({resetPassMember.division})</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-extrabold text-slate-800">
                  Password Baru
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Acak Password (e.g. KD-X8A2)
                </button>
              </div>

              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Password akan langsung diperbarui. Beritahukan password baru ini kepada anggota yang bersangkutan.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetPassMember(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center gap-1.5"
              >
                <Key className="w-4 h-4" /> Reset Password Sekarang
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: EDIT MEMBER DETAILS */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateMember}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Edit3 className="w-5 h-5 text-red-600" /> Edit Data Anggota Panitia
            </h3>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={editingMember.name}
                onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Peran / Hak Akses
                </label>
                <select
                  value={editingMember.role}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, role: e.target.value as Role })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="anggota">⚽ Panitia Lapangan</option>
                  <option value="master">👑 Master Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Status Akun
                </label>
                <select
                  value={editingMember.status || 'active'}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="active">🟢 Aktif</option>
                  <option value="inactive">🔴 Non-Aktif</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Divisi / Tugas
              </label>
              <input
                type="text"
                value={editingMember.division}
                onChange={(e) => setEditingMember({ ...editingMember, division: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                Nomor Telepon / WA
              </label>
              <input
                type="text"
                value={editingMember.phone || ''}
                onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow"
              >
                Update Data
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

