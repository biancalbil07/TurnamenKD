import React, { useState } from 'react';
import { Trophy, Shield, Users, RefreshCw, Send, Plus, ChevronDown, Radio, User, LogOut, Settings, Trash2, AlertTriangle, Zap } from 'lucide-react';
import { Tournament, Role, PanitiaMember } from '../types';
import { getSupabaseConfig } from '../lib/supabase';
import { getTelegramSettings } from '../lib/telegram';
import { getRealtimeConnectionStatus } from '../lib/db';

interface HeaderProps {
  tournaments: Tournament[];
  activeTournament: Tournament | undefined;
  onSelectTournament: (id: string) => void;
  onOpenNewTournament: () => void;
  onDeleteTournament?: (id: string) => Promise<void>;
  currentUser: PanitiaMember;
  onOpenProfile: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  activeTab: string;
  onChangeTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  tournaments,
  activeTournament,
  onSelectTournament,
  onOpenNewTournament,
  onDeleteTournament,
  currentUser,
  onOpenProfile,
  onLogout,
  onOpenSettings,
  activeTab,
  onChangeTab,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showTournDropdown, setShowTournDropdown] = useState(false);
  const [deletingTourn, setDeletingTourn] = useState<Tournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabaseConfig = getSupabaseConfig();
  const telegramSettings = getTelegramSettings();
  const realtimeStatus = getRealtimeConnectionStatus();

  const isSupabaseConnected = supabaseConfig.enabled && supabaseConfig.url;
  const isTelegramConfigured = (telegramSettings.bot1_enabled && telegramSettings.bot1_token) || (telegramSettings.bot2_enabled && telegramSettings.bot2_token);

  // RBAC Menu Filtering
  const isMaster = currentUser.role === 'master';
  
  const allTabs = [
    { id: 'bracket', label: '🏆 Bagan Pertandingan' },
    { id: 'teams', label: '👥 Registrasi Tim & Seeding' },
    { id: 'schedule', label: '📅 Jadwal & Lapangan' },
    { id: 'field_input', label: '⚽ Input Skor Lapangan' },
    ...(isMaster ? [{ id: 'time_slots', label: '⏰ Slot Jam Pertandingan' }] : []),
    ...(isMaster ? [{ id: 'committee', label: '🛡️ Hak Akses Panitia' }] : []),
    ...(isMaster ? [{ id: 'audit', label: '📜 Audit Logs' }] : []),
  ];

  return (
    <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-slate-800 w-full no-scrollbar">
      {/* Top Banner - Responsive Layout (2-rows on Mobile, 1-row on Tablet/Desktop) */}
      <div className="w-full px-2.5 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 text-xs no-scrollbar">
        
        {/* Top Row / Left Section: Brand Logo & Tournament Selector */}
        <div className="flex flex-row items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner h-8 shrink-0">
              <div className="w-5 h-5 bg-red-600 text-white rounded flex items-center justify-center font-black text-[11px] italic shadow-md shadow-red-600/30 shrink-0">
                KD
              </div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-xs tracking-wider uppercase leading-none text-white whitespace-nowrap">
                  Turnamen KD
                </h1>
                <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap hidden md:inline-block shrink-0">
                  {isMaster ? 'Master Admin' : 'Panitia Lapangan'}
                </span>
              </div>
            </div>

            {/* Tournament Dropdown Selector */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowTournDropdown(!showTournDropdown)}
                className="h-8 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 px-2 sm:px-2.5 rounded-lg border border-slate-700 text-xs font-bold transition shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="max-w-[110px] sm:max-w-[150px] md:max-w-[200px] truncate text-slate-100">
                  {activeTournament?.name || 'Pilih Turnamen'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showTournDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 flex items-center justify-between">
                    <span>Daftar Turnamen Aktif</span>
                    <span className="text-slate-400 font-mono">({tournaments.length})</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-100/60 no-scrollbar">
                    {tournaments.map((t) => (
                      <div
                        key={t.id}
                        className={`group flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 transition ${
                          t.id === activeTournament?.id ? 'bg-red-50/80 font-black border-l-4 border-red-600' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            onSelectTournament(t.id);
                            setShowTournDropdown(false);
                          }}
                          className="flex-1 text-left text-xs truncate py-1 pr-2 flex items-center justify-between"
                        >
                          <span className={`truncate ${t.id === activeTournament?.id ? 'text-red-600 font-black' : 'text-slate-800 font-bold'}`}>
                            {t.name}
                          </span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase ml-1 shrink-0">
                            {t.category}
                          </span>
                        </button>

                        {isMaster && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingTourn(t);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition ml-1 shrink-0"
                            title="Hapus Turnamen Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isMaster && (
                    <div className="p-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowTournDropdown(false);
                          onOpenNewTournament();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-red-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Buat Turnamen Baru
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Right Controls: Profile & Settings Button (sm:hidden) */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {/* Mobile Profile Dropdown Button */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="h-8 flex items-center gap-1 bg-slate-800 hover:bg-slate-750 px-2 rounded-lg border border-slate-700 font-bold text-white text-xs transition shadow-sm whitespace-nowrap cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="max-w-[75px] truncate">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: showRoleDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/80">
                    <div className="font-extrabold text-slate-900 text-xs">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">@{currentUser.username}</div>
                    <div className="mt-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        currentUser.role === 'master' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`}>
                        {currentUser.role === 'master' ? 'Master Admin' : 'Anggota Panitia'}
                      </span>
                    </div>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        onOpenProfile();
                      }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition"
                    >
                      <User className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>🔑 Setting Profil & Password</span>
                    </button>

                    {isMaster && (
                      <button
                        onClick={() => {
                          setShowRoleDropdown(false);
                          onOpenSettings();
                        }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition"
                      >
                        <Settings className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>⚙️ Pengaturan System</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50 rounded-lg text-red-600 font-bold transition border-t border-slate-100 mt-1 pt-1.5"
                    >
                      <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                      <span>🚪 Log Out (Keluar Akun)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isMaster && (
              <button
                onClick={onOpenSettings}
                className="h-8 w-8 flex items-center justify-center bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition shadow-sm shrink-0"
                title="Pengaturan Database & Bot Telegram"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Section / Mobile Row 2: Status Badges & Tablet/Desktop Controls */}
        <div className="flex flex-row items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0 whitespace-nowrap text-xs flex-nowrap">
          
          {/* Global Realtime Connection Status Indicator */}
          <div
            className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-wide transition whitespace-nowrap shrink-0 ${
              realtimeStatus.connected
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-red-950/80 border-red-500/50 text-red-300'
            }`}
            title={realtimeStatus.connected ? 'Realtime Websocket Supabase Live & Terhubung' : 'Terputus dari Supabase Realtime'}
          >
            <Zap className={`w-3.5 h-3.5 shrink-0 ${realtimeStatus.connected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
            <span className="hidden lg:inline">{realtimeStatus.connected ? '⚡ REALTIME: SUPABASE LIVE' : '🔴 REALTIME: DISCONNECTED'}</span>
            <span className="lg:hidden">{realtimeStatus.connected ? '⚡ LIVE' : '🔴 DISCONNECTED'}</span>
          </div>

          {/* Cloud Sync Status (Only for Master) */}
          {isMaster && (
            <div
              onClick={onOpenSettings}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-wide transition whitespace-nowrap shrink-0 cursor-pointer ${
                isSupabaseConnected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
              }`}
              title="Klik untuk konfigurasi database Supabase"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400 shrink-0" />
              <span className="hidden lg:inline">{isSupabaseConnected ? 'DATABASE: SUPABASE LIVE' : 'DATABASE: LOCAL ONLY'}</span>
              <span className="lg:hidden">{isSupabaseConnected ? 'DB: LIVE' : 'DB: LOCAL'}</span>
            </div>
          )}

          {/* Telegram Indicator (Only for Master) */}
          {isMaster && (
            <div
              onClick={onOpenSettings}
              className={`h-7 sm:h-8 px-2 rounded-lg border flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold tracking-wide transition whitespace-nowrap shrink-0 cursor-pointer ${
                isTelegramConfigured
                  ? 'bg-blue-950/60 border-blue-500/40 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
              }`}
              title="Klik untuk atur Bot Telegram"
            >
              <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{isTelegramConfigured ? 'BOT: ON' : 'BOT: OFF'}</span>
            </div>
          )}

          {/* Tablet & Desktop Logged-In Profile Dropdown (hidden on sm) */}
          <div className="relative shrink-0 hidden sm:block">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-8 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 px-2.5 rounded-lg border border-slate-700 font-bold text-white text-xs transition shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="max-w-[80px] md:max-w-[120px] truncate">{currentUser.name}</span>
              <span className="bg-red-600/20 text-red-400 px-1 py-0.5 rounded text-[9px] uppercase font-black tracking-wider border border-red-500/30 shrink-0 hidden md:inline-block">
                {currentUser.role === 'master' ? 'Master' : 'Lapangan'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: showRoleDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                
                {/* User Info Header */}
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                  <div className="font-extrabold text-slate-900 text-xs">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">@{currentUser.username} • {currentUser.division}</div>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      currentUser.role === 'master' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}>
                      {currentUser.role === 'master' ? 'Master Admin' : 'Anggota Panitia'}
                    </span>
                  </div>
                </div>

                {/* Profile Actions */}
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowRoleDropdown(false);
                      onOpenProfile();
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition"
                  >
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>🔑 Setting Profil & Password</span>
                  </button>

                  {isMaster && (
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition"
                    >
                      <Settings className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>⚙️ Pengaturan System</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowRoleDropdown(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50 rounded-lg text-red-600 font-bold transition border-t border-slate-100 mt-1 pt-1.5"
                  >
                    <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                    <span>🚪 Log Out (Keluar Akun)</span>
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* System Settings Button (Only for Master Admin on Tablet/Desktop) */}
          {isMaster && (
            <button
              onClick={onOpenSettings}
              className="h-8 w-8 hidden sm:flex items-center justify-center bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition shadow-sm shrink-0"
              title="Pengaturan Database & Bot Telegram"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="w-full bg-slate-900/90 border-t border-slate-800/80 px-2 sm:px-4">
        <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1.5 no-scrollbar whitespace-nowrap">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`whitespace-nowrap px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 font-black tracking-wide'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {/* Delete Tournament Confirmation Modal */}
      {deletingTourn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-red-200 space-y-5">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Konfirmasi Hapus Turnamen</h3>
                <p className="text-xs text-slate-500 font-semibold">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-red-50 p-3.5 rounded-xl border border-red-100">
              Apakah Anda yakin ingin menghapus turnamen <strong className="text-red-700 font-extrabold">"{deletingTourn.name}"</strong> beserta seluruh data tim, jadwal, dan bagan di dalamnya dari Supabase?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingTourn(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>

              <button
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteTournament || !deletingTourn) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteTournament(deletingTourn.id);
                    setDeletingTourn(null);
                    setShowTournDropdown(false);
                  } catch (e) {
                    console.error('Failed to delete tournament', e);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Turnamen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

