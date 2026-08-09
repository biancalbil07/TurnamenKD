import React, { useState } from 'react';
import { Team, Tournament, Role, TimeSlot } from '../types';
import { Users, Plus, Shuffle, Trash2, ArrowUp, ArrowDown, Save, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getBracketSize } from '../lib/bracketEngine';
import { saveTeamsAndRegenerateMatches, getTimeSlots } from '../lib/db';

interface TeamManagerProps {
  tournament: Tournament | undefined;
  teams: Team[];
  timeSlots?: TimeSlot[];
  currentUser: { name: string; role: Role };
  onMatchesRegenerated: () => void;
}

export const TeamManager: React.FC<TeamManagerProps> = ({
  tournament,
  teams,
  timeSlots: timeSlotsProp,
  currentUser,
  onMatchesRegenerated,
}) => {
  if (!tournament) return null;

  const activeSlots = timeSlotsProp && timeSlotsProp.length > 0 ? timeSlotsProp : getTimeSlots();
  const defaultSlotLabel = activeSlots[0]?.slot_label || '10:00 - 15:00';

  const tournamentTeams = teams.filter((t) => t.tournament_id === tournament.id);

  const [teamList, setTeamList] = useState<Team[]>(
    tournamentTeams.length > 0 ? tournamentTeams : []
  );
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSlot, setNewTeamSlot] = useState<string>(defaultSlotLabel);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkSlot, setBulkSlot] = useState<string>(defaultSlotLabel);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [includeThirdPlace, setIncludeThirdPlace] = useState(tournament.third_place_match ?? true);
  const [startDate, setStartDate] = useState(tournament.start_date || '2026-08-10');
  const [endDate, setEndDate] = useState(tournament.end_date || '2026-08-16');
  const [isSaved, setIsSaved] = useState(false);

  // Calculate bracket sizing & BYE count
  const teamCount = teamList.length;
  const bracketSize = getBracketSize(teamCount);
  const byeCount = Math.max(0, bracketSize - teamCount);

  const handleAddSingleTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeam: Team = {
      id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tournament_id: tournament.id,
      name: newTeamName.trim(),
      seed: teamList.length + 1,
      logo_emoji: ['⚽', '🏆', '🔥', '⚡', '🦅', '🦁', '🐉', '🐯', '🔵', '🔴', '🟢', '⭐'][teamList.length % 12],
      time_slot: newTeamSlot,
    };

    setTeamList([...teamList, newTeam]);
    setNewTeamName('');
  };

  const handleBulkImport = () => {
    const lines = bulkInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const imported: Team[] = lines.map((name, idx) => ({
      id: `team_${Date.now()}_${idx}`,
      tournament_id: tournament.id,
      name: name,
      seed: teamList.length + idx + 1,
      logo_emoji: ['⚽', '🏆', '🔥', '⚡', '🦅', '🦁', '🐉', '🐯', '🔵', '🔴', '🟢', '⭐'][(teamList.length + idx) % 12],
      time_slot: bulkSlot,
    }));

    setTeamList([...teamList, ...imported]);
    setBulkInput('');
    setShowBulkModal(false);
  };

  const handleToggleTeamSlot = (id: string, slot: string) => {
    setTeamList(teamList.map((t) => (t.id === id ? { ...t, time_slot: slot } : t)));
  };

  const handleMoveTeam = (index: number, direction: 'up' | 'down') => {
    const updated = [...teamList];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;

    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // update seeds
    updated.forEach((t, i) => (t.seed = i + 1));
    setTeamList(updated);
  };

  const handleDeleteTeam = (id: string) => {
    const updated = teamList.filter((t) => t.id !== id);
    updated.forEach((t, i) => (t.seed = i + 1));
    setTeamList(updated);
  };

  const handleShuffleTeams = () => {
    const shuffled = [...teamList].sort(() => Math.random() - 0.5);
    shuffled.forEach((t, i) => (t.seed = i + 1));
    setTeamList(shuffled);
  };

  const handleGenerateAndSave = async () => {
    if (teamList.length < 2) {
      alert('Minimal masukkan 2 tim untuk membuat bagan pertandingan.');
      return;
    }

    if (currentUser.role !== 'master') {
      alert('Hanya Master Admin yang dapat mereset dan meregenerasi bagan pertandingan.');
      return;
    }

    const confirmed = confirm(
      `Apakah Anda yakin ingin membuat ulang bagan turnamen "${tournament.name}" dengan ${teamList.length} tim?\nCatatan: Skor lama akan di-reset!`
    );

    if (!confirmed) return;

    await saveTeamsAndRegenerateMatches(
      tournament.id,
      teamList,
      shuffleMode,
      includeThirdPlace,
      currentUser,
      startDate,
      endDate
    );

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    onMatchesRegenerated();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" />
            <span>Manajemen Tim & Generasi Bagan</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Turnamen: <strong className="text-slate-700">{tournament.name}</strong> • Atur urutan seeding atau acak urutan tim.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500" /> Import Masal (Paste)
          </button>
          
          <button
            onClick={handleGenerateAndSave}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-lg hover:shadow-red-500/20 transition flex items-center gap-2"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <RefreshCw className="w-4 h-4" />}
            {isSaved ? 'Bagan Berhasil Dibuat!' : 'Generasi Bagan Sekarang'}
          </button>
        </div>
      </div>

      {/* Bracket Math & BYE Info Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Tim Terdaftar</div>
          <div className="text-3xl font-black text-red-400 mt-1">{teamCount} Tim</div>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Ukuran Slot Bagan</div>
          <div className="text-3xl font-black text-amber-400 mt-1">{bracketSize} Slot</div>
          <div className="text-[10px] text-slate-400 mt-0.5">(Kelipatan 2 terdekat)</div>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Slot Tim BYE (Lolos Otomatis)</div>
          <div className="text-3xl font-black text-emerald-400 mt-1">{byeCount} BYE</div>
          <div className="text-[10px] text-emerald-300 mt-0.5">
            {byeCount > 0 ? 'Maju ke Babak 2 tanpa tanding' : 'Bagan genap sempurna'}
          </div>
        </div>
      </div>

      {/* Add Single Team Input & Options */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        
        <form onSubmit={handleAddSingleTeam} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Masukkan nama tim baru (misal: Garuda FC)..."
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Jam Main:</span>
            <select
              value={newTeamSlot}
              onChange={(e) => setNewTeamSlot(e.target.value)}
              className="px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {activeSlots.map((s) => (
                <option key={s.id} value={s.slot_label}>
                  ☀️ {s.slot_label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Tambah Tim
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleShuffleTeams}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold transition flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" /> Acak Urutan Seeding
            </button>

            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeThirdPlace}
                onChange={(e) => setIncludeThirdPlace(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
              />
              Sertakan Perebutan Juara 3
            </label>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Tgl Mulai:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Tgl Selesai (Final):</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Team List Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-extrabold text-sm text-slate-800 flex items-center justify-between">
          <span>Daftar Tim Turnamen ({teamList.length})</span>
          <span className="text-xs text-slate-500 font-normal">
            {teamList.length < 2 ? 'Minimal 2 tim untuk membuat bagan' : 'Siap digenerasi'}
          </span>
        </div>

        {teamList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada tim yang ditambahkan. Silakan ketik nama tim di atas atau gunakan Import Masal.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {teamList.map((t, idx) => (
              <div
                key={t.id}
                className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-xs flex items-center justify-center border border-slate-200">
                    #{idx + 1}
                  </span>
                  <span className="text-lg">{t.logo_emoji || '⚽'}</span>
                  <span className="font-bold text-sm text-slate-800">{t.name}</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Time slot selector badge */}
                  <select
                    value={t.time_slot || defaultSlotLabel}
                    onChange={(e) => handleToggleTeamSlot(t.id, e.target.value)}
                    className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {activeSlots.map((s) => (
                      <option key={s.id} value={s.slot_label}>
                        ☀️ {s.slot_label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveTeam(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg disabled:opacity-30 transition"
                      title="Naikkan Urutan"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveTeam(idx, 'down')}
                      disabled={idx === teamList.length - 1}
                      className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg disabled:opacity-30 transition"
                      title="Turunkan Urutan"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition"
                      title="Hapus Tim"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Import Daftar Tim Masal
            </h3>
            <p className="text-xs text-slate-500">
              Paste nama tim per baris di kotak berikut (misal dicopy dari WhatsApp / Excel):
            </p>

            <textarea
              rows={6}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Garuda FC&#10;Persib Muda&#10;Arema Thunder&#10;Persebaya Blitz&#10;PSM Makassar"
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Pilih Slot Jam Main:</span>
                <select
                  value={bulkSlot}
                  onChange={(e) => setBulkSlot(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {activeSlots.map((s) => (
                    <option key={s.id} value={s.slot_label}>
                      ☀️ {s.slot_label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Tambah Semua Tim
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
