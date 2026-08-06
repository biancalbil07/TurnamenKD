import React, { useState, useEffect } from 'react';
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
} from './lib/db';
import { getSupabaseClient } from './lib/supabase';

export default function App() {
  const [dbState, setDbState] = useState(getAppData());
  const [activeTab, setActiveTab] = useState('bracket');
  
  // Modals
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewTournModal, setShowNewTournModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Active Logged-in User Session State
  const [currentUser, setCurrentUser] = useState<PanitiaMember | null>(() => {
    const saved = localStorage.getItem('turnamen_kd_logged_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    initDatabase().then(() => {
      const appData = getAppData();
      setDbState({ ...appData });

      // If no user session saved yet, default to first user or prompt login
      const saved = localStorage.getItem('turnamen_kd_logged_user');
      if (!saved && appData.panitiaMembers.length > 0) {
        // Auto select first user if none logged in yet
        const defaultUser = appData.panitiaMembers[0];
        setCurrentUser(defaultUser);
        localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(defaultUser));
      }
    });

    const unsubscribe = subscribeDataChanges(() => {
      setDbState({ ...getAppData() });
    });

    return () => {
      unsubscribe();
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
  };

  const handleUserUpdated = (updatedUser: PanitiaMember) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('turnamen_kd_logged_user', JSON.stringify(updatedUser));
    setDbState({ ...getAppData() });
  };

  // If not logged in, render Login Modal screen
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

  // RBAC Tab Protection: Anggota biasa cannot access committee or audit
  const isMaster = currentUser.role === 'master';
  const handleTabChange = (tab: string) => {
    if (!isMaster && (tab === 'committee' || tab === 'audit' || tab === 'time_slots')) {
      setActiveTab('bracket');
      return;
    }
    setActiveTab(tab);
  };

  const handleDeleteTournament = async (id: string) => {
    if (!currentUser) return;
    await deleteTournament(id, { name: currentUser.name, role: currentUser.role });
    setDbState({ ...getAppData() });
  };

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
