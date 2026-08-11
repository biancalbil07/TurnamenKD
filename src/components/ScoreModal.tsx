import React, { useState, useEffect } from 'react';
import { Match, Tournament, Role, Team } from '../types';
import { X, Trophy, Save, RotateCcw, MapPin, Clock, Calendar, Send, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { processMatchScoreUpdate } from '../lib/bracketEngine';
import { updateMatches } from '../lib/db';
import { notifyMatchScore } from '../lib/telegram';

interface ScoreModalProps {
  match: Match | null;
  tournament: Tournament | undefined;
  allMatches: Match[];
  teams?: Team[];
  onClose: () => void;
  currentUser: { name: string; role: Role };
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  match,
  tournament,
  allMatches,
  teams,
  onClose,
  currentUser,
}) => {
  if (!match || !tournament) return null;

  const [t1Score, setT1Score] = useState<number | ''>(match.team1_score ?? '');
  const [t2Score, setT2Score] = useState<number | ''>(match.team2_score ?? '');
  const [team1Id, setTeam1Id] = useState<string | null>(match.team1_id);
  const [team1Name, setTeam1Name] = useState<string>(match.team1_name);
  const [team2Id, setTeam2Id] = useState<string | null>(match.team2_id);
  const [team2Name, setTeam2Name] = useState<string>(match.team2_name);
  const [venue, setVenue] = useState(match.venue || 'Lapangan A');
  const [date, setDate] = useState(match.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(match.time || '10:00');
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isWO, setIsWO] = useState<boolean>(match.is_wo || false);
  const [woWinnerId, setWoWinnerId] = useState<string | null>(match.wo_winner_id || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tournamentTeams = (teams || []).filter((t) => t.tournament_id === tournament.id);

  useEffect(() => {
    setT1Score(match.team1_score ?? '');
    setT2Score(match.team2_score ?? '');
    setTeam1Id(match.team1_id);
    setTeam1Name(match.team1_name);
    setTeam2Id(match.team2_id);
    setTeam2Name(match.team2_name);
    setVenue(match.venue || 'Lapangan A');
    setDate(match.date || new Date().toISOString().split('T')[0]);
    setTime(match.time || '10:00');
    setIsWO(match.is_wo || false);
    setWoWinnerId(match.wo_winner_id || null);
    setErrorMsg(null);
  }, [match]);

  const handleSwapTeams = () => {
    const nextT1Id = team2Id;
    const nextT1Name = team2Name;
    const nextT2Id = team1Id;
    const nextT2Name = team1Name;

    setTeam1Id(nextT1Id);
    setTeam1Name(nextT1Name);
    setTeam2Id(nextT2Id);
    setTeam2Name(nextT2Name);

    // Swap scores
    setT1Score(t2Score);
    setT2Score(t1Score);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    const score1 = t1Score === '' ? null : Number(t1Score);
    const score2 = t2Score === '' ? null : Number(t2Score);

    // Apply updated teams to target match before running processMatchScoreUpdate
    const matchesForEngine = allMatches.map((m) => {
      if (m.id === match.id) {
        return {
          ...m,
          team1_id: team1Id,
          team1_name: team1Name,
          team2_id: team2Id,
          team2_name: team2Name,
        };
      }
      return m;
    });

    // Process score/WO update in engine
    const { updatedMatches, winnerName, error } = processMatchScoreUpdate(
      matchesForEngine,
      match.id,
      score1,
      score2,
      tournamentTeams.length > 0 ? tournamentTeams : teams,
      isWO,
      woWinnerId
    );

    if (error) {
      setErrorMsg(error);
      return;
    }

    // Update match schedule/venue & team info for target match
    const target = updatedMatches.find((m) => m.id === match.id);
    if (target) {
      target.venue = venue;
      target.date = date;
      target.time = time;
      target.team1_id = team1Id;
      target.team1_name = team1Name;
      target.team2_id = team2Id;
      target.team2_name = team2Name;
    }

    const logDetail = isWO
      ? `Menang WO [${match.match_code}]: Pemenang WO ${winnerName || 'Belum Ada'}`
      : `Input/Koreksi skor & tim [${match.match_code}]: ${team1Name} (${score1 ?? 0}) VS ${team2Name} (${score2 ?? 0}) - Pemenang: ${winnerName || 'Belum Ada'}`;

    await updateMatches(tournament.id, updatedMatches, currentUser, logDetail);

    // Notify Telegram if checked
    if (notifyTelegram && target) {
      await notifyMatchScore(target, tournament, winnerName || undefined);
    }

    onClose();
  };

  const handleResetScore = async () => {
    setErrorMsg(null);
    const { updatedMatches, error } = processMatchScoreUpdate(allMatches, match.id, null, null, undefined, false, null);
    
    if (error) {
      setErrorMsg(error);
      return;
    }

    await updateMatches(
      tournament.id,
      updatedMatches,
      currentUser,
      `Mereset skor untuk match [${match.match_code}]`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-200 uppercase tracking-wider">
              {match.round_name} • Kode: {match.match_code}
            </div>
            <h3 className="text-lg font-black">{tournament.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {errorMsg && (
            <div className="bg-red-50 border-2 border-red-300 text-red-900 text-xs font-bold rounded-xl p-3.5 flex items-start gap-2.5 shadow-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-extrabold uppercase tracking-wider block text-red-700 text-[10px]">
                  ⚠️ Perubahan Ditolak
                </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Ganti & Tukar Tim Section */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between font-extrabold text-slate-800">
              <span className="flex items-center gap-1.5">
                <span>⚙️ Koreksi Tim Bertanding</span>
              </span>
              <button
                type="button"
                onClick={handleSwapTeams}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition shadow-sm"
                title="Tukar posisi Tim 1 dan Tim 2"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Tukar Posisi Tim (⇄)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">🔴 Tim 1 (Home)</label>
                <select
                  value={team1Id || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = tournamentTeams.find((t) => t.id === val);
                    setTeam1Id(val || null);
                    setTeam1Name(found ? found.name : val ? val : 'TBD');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-xs focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Pilih Tim 1 (TBD) --</option>
                  {tournamentTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">⚪ Tim 2 (Away)</label>
                <select
                  value={team2Id || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = tournamentTeams.find((t) => t.id === val);
                    setTeam2Id(val || null);
                    setTeam2Name(found ? found.name : val ? val : 'TBD');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-xs focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Pilih Tim 2 (TBD) --</option>
                  {tournamentTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Teams & Score Input Cards */}
          <div className="grid grid-cols-2 gap-4 text-center">
            
            {/* Team 1 */}
            <div className={`p-4 rounded-xl border-2 transition ${
              t1Score !== '' && t2Score !== '' && Number(t1Score) > Number(t2Score)
                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="font-extrabold text-slate-800 text-sm truncate mb-3">
                🔴 {team1Name}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setT1Score(Math.max(0, Number(t1Score || 0) - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  value={t1Score}
                  onChange={(e) => setT1Score(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-16 h-12 text-center text-2xl font-black bg-white border-2 border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setT1Score(Number(t1Score || 0) + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-base"
                >
                  +
                </button>
              </div>

              {t1Score !== '' && t2Score !== '' && Number(t1Score) > Number(t2Score) && (
                <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> Pemenang
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div className={`p-4 rounded-xl border-2 transition ${
              t1Score !== '' && t2Score !== '' && Number(t2Score) > Number(t1Score)
                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="font-extrabold text-slate-800 text-sm truncate mb-3">
                ⚪ {team2Name}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setT2Score(Math.max(0, Number(t2Score || 0) - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  value={t2Score}
                  onChange={(e) => setT2Score(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-16 h-12 text-center text-2xl font-black bg-white border-2 border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setT2Score(Number(t2Score || 0) + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 text-base"
                >
                  +
                </button>
              </div>

              {t1Score !== '' && t2Score !== '' && Number(t2Score) > Number(t1Score) && (
                <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> Pemenang
                </div>
              )}
            </div>

          </div>

          {/* Menang WO (Walkover) Option Box */}
          <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 space-y-2">
            <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-extrabold">
                ⚡ Status Menang WO (Walkover)
              </span>
              {isWO && (
                <span className="text-[10px] bg-amber-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  Status WO Aktif
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Pilih tim yang dinyatakan <strong>Menang WO</strong> jika tim lawan diskualifikasi / tidak hadir. Pemenang WO otomatis maju ke babak berikutnya tanpa reset bagan.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={!team1Id}
                onClick={() => {
                  if (isWO && woWinnerId === team1Id) {
                    setIsWO(false);
                    setWoWinnerId(null);
                  } else {
                    setIsWO(true);
                    setWoWinnerId(team1Id);
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  isWO && woWinnerId === team1Id
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/80'
                }`}
              >
                🔴 {team1Name} Menang WO
              </button>

              <button
                type="button"
                disabled={!team2Id}
                onClick={() => {
                  if (isWO && woWinnerId === team2Id) {
                    setIsWO(false);
                    setWoWinnerId(null);
                  } else {
                    setIsWO(true);
                    setWoWinnerId(team2Id);
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  isWO && woWinnerId === team2Id
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/80'
                }`}
              >
                ⚪ {team2Name} Menang WO
              </button>
            </div>
          </div>

          {/* Schedule & Venue Fields */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="font-bold text-slate-700 uppercase tracking-wider">Detail Lapangan & Jadwal</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Lapangan / Venue</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Tanggal</label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Jam / Waktu</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Notification Checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyTelegram}
              onChange={(e) => setNotifyTelegram(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
            />
            <Send className="w-3.5 h-3.5 text-blue-500" />
            Kirimkan notifikasi update skor otomatis ke Telegram Group Panitia
          </label>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetScore}
            className="flex items-center gap-1.5 px-3 py-2 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition"
            title="Reset Skor & Tarik Pemenang"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Skor
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-red-500/20 transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Simpan & Majukan Tim
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
