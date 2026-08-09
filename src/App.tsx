import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Header } from './components/Header';
import { BracketView } from './components/BracketView';
import { ScoreModal } from './components/ScoreModal';
import { TeamManager } from './components/TeamManager';
import { ScheduleView } from './components/ScheduleView';
import { FieldScoreInput } from './components/FieldScoreInput';
import { CommitteeManager } from './components/CommitteeManager';
import { AuditLogView } from './components/AuditLogView';
import { TimeSlotManager } from './components/TimeSlotManager';
import { SettingsModal } from './components/SettingsModal';
import { NewTournamentModal } from './components/NewTournamentModal';
import { LoginModal } from './components/LoginModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Match, PanitiaMember } from './types';
import {
  initDatabase,
  getAppData,
  getActiveTournament,
  setActiveTournamentId,
  deleteTournament,
  subscribeDataChanges,
  cleanupSupabaseRealtime,
} from './lib/db';
import { getSupabaseClient } from './lib/supabase';

export default function App() {
  const [dbState, setDbState] = useState(getAppData());
  const [activeTab, setActiveTab] = useState('bracket');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  // Modals
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewTournModal, setShowNewTournModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Active Logged-in User Session State
  const [currentUser, setCurrentUser] = useState<PanitiaMember | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initAuthAndDb = async () => {
      try {
        await initDatabase();
        const appData = getAppData();
        if (isMounted) setDbState({ ...appData });

        // Check saved user session in localStorage
        const saved = localStorage.getItem('turnamen_kd_logged_user');
        if (saved) {
          try {
            const parsedUser: PanitiaMember = JSON.parse(saved);
            // Verify if user still exists in database and is active
            const activeMember = appData.panitiaMembers.find(
              (m) => (m.id === parsedUser.id || m.username.toLowerCase() === parsedUser.username.toLowerCase()) && m.status === 'active'
            );

            if (activeMember) {
              if (isMounted) setCurrentUser(activeMember);
              localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(activeMember));
            } else {
              // User no longer exists or status is inactive -> Force logout
              if (isMounted) setCurrentUser(null);
              localStorage.removeItem('turnamen_kd_logged_user');
            }
          } catch {
            if (isMounted) setCurrentUser(null);
            localStorage.removeItem('turnamen_kd_logged_user');
          }
        } else {
          // No saved session -> Force Login Screen (No auto-select!)
          if (isMounted) setCurrentUser(null);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };

    initAuthAndDb();

    // Supabase Auth listener for session changes & token invalidation
    const supabase = getSupabaseClient();
    let authListener: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          if (isMounted) {
            setCurrentUser(null);
            localStorage.removeItem('turnamen_kd_logged_user');
          }
        }
      });
      authListener = data?.subscription;
    }

    // Subscribe to real-time DB changes
    const unsubscribeDb = subscribeDataChanges(() => {
      const updatedData = getAppData();
      if (isMounted) setDbState({ ...updatedData });

      // Verify currently logged in user status in real-time
      const currentSaved = localStorage.getItem('turnamen_kd_logged_user');
      if (currentSaved && isMounted) {
        try {
          const parsed = JSON.parse(currentSaved);
          const liveUser = updatedData.panitiaMembers.find(
            (m) => m.id === parsed.id || m.username.toLowerCase() === parsed.username.toLowerCase()
          );
          if (!liveUser || liveUser.status !== 'active') {
            setCurrentUser(null);
            localStorage.removeItem('turnamen_kd_logged_user');
          } else {
            setCurrentUser(liveUser);
            localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(liveUser));
          }
        } catch {
          // ignore
        }
      }
    });

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
      unsubscribeDb();
      cleanupSupabaseRealtime();
    };
  }, []);

  const activeTournament = getActiveTournament();

  const handleSelectTournament = (id: string) => {
    setActiveTournamentId(id);
    setDbState({ ...getAppData() });
  };

  const handleRefreshData = () => {
    setDbState({ ...getAppData() });
  };

  const handleLoginSuccess = (user: PanitiaMember) => {
    setCurrentUser(user);
    localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(user));
    if (user.role !== 'master') {
      setActiveTab('bracket');
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout error:', err);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('turnamen_kd_logged_user');
    setActiveTab('bracket');
    setShowSettingsModal(false);
    setShowNewTournModal(false);
    setShowProfileModal(false);
  };

  const handleUserUpdated = (updatedUser: PanitiaMember) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(updatedUser));
    setDbState({ ...getAppData() });
  };

  // RBAC Tab Protection: Non-master user cannot access committee, audit, or time_slots
  const isMaster = currentUser?.role === 'master';

  useEffect(() => {
    if (currentUser && !isMaster && (activeTab === 'committee' || activeTab === 'audit' || activeTab === 'time_slots')) {
      setActiveTab('bracket');
    }
  }, [currentUser, isMaster, activeTab]);

  const handleTabChange = (tab: string) => {
    if (!isMaster && (tab === 'committee' || tab === 'audit' || tab === 'time_slots')) {
      setActiveTab('bracket');
      return;
    }
    setActiveTab(tab);
  };

  const handleDeleteTournament = async (id: string) => {
    if (!currentUser || !isMaster) return;
    await deleteTournament(id, { name: currentUser.name, role: currentUser.role });
    setDbState({ ...getAppData() });
  };

  // 1. Loading State Screen (Prevents visual flicker before auth state is checked)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-white flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center font-black text-2xl italic shadow-2xl shadow-red-600/50">
              KD
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-red-500/50 animate-ping pointer-events-none"></div>
          </div>
          
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black tracking-wider uppercase flex items-center justify-center gap-2">
              <span>TURNAMEN KD</span>
              <ShieldCheck className="w-4 h-4 text-red-500" />
            </h2>
            <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
              <span>Memeriksa Status Autentikasi & Sesi User...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Auth Guard: If not authenticated, render Login Modal screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-900 flex items-center justify-center p-4">
        <LoginModal
          panitiaMembers={dbState.panitiaMembers}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col selection:bg-red-500 selection:text-white">
      
      {/* Top Header Navigation */}
      <Header
        tournaments={dbState.tournaments}
        activeTournament={activeTournament}
        onSelectTournament={handleSelectTournament}
        onOpenNewTournament={() => setShowNewTournModal(true)}
        onDeleteTournament={handleDeleteTournament}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        onOpenSettings={() => {
          if (isMaster) setShowSettingsModal(true);
        }}
        activeTab={activeTab}
        onChangeTab={handleTabChange}
      />

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Tab 1: Interactive Bracket */}
        {activeTab === 'bracket' && (
          <BracketView
            tournament={activeTournament}
            matches={dbState.matches}
            teams={dbState.teams}
            onSelectMatch={(match) => setSelectedMatch(match)}
            currentUserRole={currentUser.role}
            onOpenTeamManager={() => setActiveTab('teams')}
          />
        )}

        {/* Tab 2: Team Manager & Bracket Generator */}
        {activeTab === 'teams' && (
          <TeamManager
            tournament={activeTournament}
            teams={dbState.teams}
            timeSlots={dbState.timeSlots}
            currentUser={currentUser}
            onMatchesRegenerated={handleRefreshData}
          />
        )}

        {/* Tab 3: Match Schedule */}
        {activeTab === 'schedule' && (
          <ScheduleView
            tournament={activeTournament}
            matches={dbState.matches}
            onSelectMatch={(match) => setSelectedMatch(match)}
            currentUser={currentUser}
          />
        )}

        {/* Tab 4: Field Scoreboard Input */}
        {activeTab === 'field_input' && (
          <FieldScoreInput
            tournament={activeTournament}
            matches={dbState.matches}
            currentUser={currentUser}
          />
        )}

        {/* Tab 5: Dynamic Time Slots Manager (Only Master Admin) */}
        {activeTab === 'time_slots' && isMaster && (
          <TimeSlotManager
            timeSlots={dbState.timeSlots}
            currentUser={currentUser}
            onRefresh={handleRefreshData}
          />
        )}

        {/* Tab 5: Panitia Members & Role Access (Only Master Admin) */}
        {activeTab === 'committee' && isMaster && (
          <CommitteeManager
            panitiaMembers={dbState.panitiaMembers}
            currentUser={currentUser}
            onRefresh={handleRefreshData}
          />
        )}

        {/* Tab 6: Audit Logs (Only Master Admin) */}
        {activeTab === 'audit' && isMaster && (
          <AuditLogView logs={dbState.auditLogs} />
        )}

      </main>

      {/* Score Modal */}
      {selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          tournament={activeTournament}
          allMatches={dbState.matches}
          onClose={() => setSelectedMatch(null)}
          currentUser={currentUser}
        />
      )}

      {/* Settings Modal (Only Master Admin) */}
      {showSettingsModal && isMaster && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          currentUser={currentUser}
          onRefreshData={handleRefreshData}
        />
      )}

      {/* User Profile / Password Update Modal */}
      {showProfileModal && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* New Tournament Modal */}
      {showNewTournModal && (
        <NewTournamentModal
          onClose={() => setShowNewTournModal(false)}
          currentUser={currentUser}
          onCreated={handleRefreshData}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white">TURNAMEN KD</span>
            <span>•</span>
            <span>Sistem Manajemen Turnamen & Bagan Real-Time</span>
          </div>

          <div className="text-slate-500">
            Creat By • Pudelinkz
          </div>
        </div>
      </footer>

    </div>
  );
}
