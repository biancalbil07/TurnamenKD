import React, { useState } from 'react';
import { Match, Tournament, Role } from '../types';
import { Smartphone, Trophy, Play, Check, Send, RotateCcw, Plus, Minus, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { processMatchScoreUpdate } from '../lib/bracketEngine';
import { updateMatches } from '../lib/db';
import { notifyMatchScore } from '../lib/telegram';

interface FieldScoreInputProps {
  tournament: Tournament | undefined;
  matches: Match[];
  currentUser: { name: string; role: Role };
}

export const FieldScoreInput: React.FC<FieldScoreInputProps> = ({
  tournament,
  matches,
  currentUser,
}) => {
  if (!tournament) return null;

  const tourMatches = matches.filter((m) => m.tournament_id === tournament.id && m.status !== 'bye');

  // Active selected match to input score
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    tourMatches.find((m) => m.status === 'scheduled' || m.status === 'live')?.id || tourMatches[0]?.id || ''
  );

  const selectedMatch = tourMatches.find((m) => m.id === selectedMatchId);

  // Local state for instant scoring
  const [t1Score, setT1Score] = useState<number>(selectedMatch?.team1_score ?? 0);
  const [t2Score, setT2Score] = useState<number>(selectedMatch?.team2_score ?? 0);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (selectedMatch) {
      setT1Score(selectedMatch.team1_score ?? 0);
      setT2Score(selectedMatch.team2_score ?? 0);
      setErrorMsg(null);
    }
  }, [selectedMatchId, selectedMatch?.team1_score, selectedMatch?.team2_score]);

  const handleSelectMatch = (m: Match) => {
    setSelectedMatchId(m.id);
    setT1Score(m.team1_score ?? 0);
    setT2Score(m.team2_score ?? 0);
    setErrorMsg(null);
  };

  const handleQuickSubmitScore = async () => {
    if (!selectedMatch) return;
    setErrorMsg(null);

    const { updatedMatches, winnerName, error } = processMatchScoreUpdate(
      matches,
      selectedMatch.id,
      t1Score,
      t2Score
    );

    if (error) {
      setErrorMsg(error);
      return;
    }

    const logDetail = `Input/Koreksi skor lapangan [${selectedMatch.match_code}]: ${selectedMatch.team1_name} (${t1Score}) VS ${selectedMatch.team2_name} (${t2Score}) - Winner: ${winnerName || 'TBA'}`;

    await updateMatches(tournament.id, updatedMatches, currentUser, logDetail);

    const updatedTarget = updatedMatches.find((m) => m.id === selectedMatch.id);
    if (notifyTelegram && updatedTarget) {
      await notifyMatchScore(updatedTarget, tournament, winnerName || undefined);
    }

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleDeclareWO = async (winningTeamId: string | null) => {
    if (!selectedMatch) return;
    setErrorMsg(null);

    const isWO = Boolean(winningTeamId);
    const { updatedMatches, winnerName, error } = processMatchScoreUpdate(
      matches,
      selectedMatch.id,
      selectedMatch.team1_score ?? 0,
      selectedMatch.team2_score ?? 0,
      undefined,
      isWO,
      winningTeamId
    );

    if (error) {
      setErrorMsg(error);
      return;
    }

    const logDetail = isWO
      ? `Menang WO [${selectedMatch.match_code}]: Pemenang WO ${winnerName || 'TBA'}`
      : `Reset status WO [${selectedMatch.match_code}]`;

    await updateMatches(tournament.id, updatedMatches, currentUser, logDetail);

    const updatedTarget = updatedMatches.find((m) => m.id === selectedMatch.id);
    if (notifyTelegram && updatedTarget) {
      await notifyMatchScore(updatedTarget, tournament, winnerName || undefined);
    }

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-800 to-red-950 text-white rounded-2xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-red-200 uppercase">
            <Smartphone className="w-4 h-4 text-amber-300" /> Mode Skor Lapangan (Panitia HP/Tablet)
          </div>
          <h2 className="text-xl font-black mt-1">Live Scoreboard Operator</h2>
        </div>
        <div className="text-right text-xs text-red-200">
          <div className="font-bold">{tournament.name}</div>
          <div className="opacity-80">Sync Otomatis ke Bagan</div>
        </div>
      </div>

      {/* Select Active Match Dropdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
          Pilih Pertandingan Lapangan
        </label>
        <select
          value={selectedMatchId}
          onChange={(e) => {
            const m = tourMatches.find((x) => x.id === e.target.value);
            if (m) handleSelectMatch(m);
          }}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {tourMatches.map((m) => {
            const t1Name = m.team1_name && m.team1_name !== 'TBD' ? m.team1_name : '-';
            const t2Name = m.team2_name && m.team2_name !== 'TBD' ? m.team2_name : '-';

            return (
              <option key={m.id} value={m.id}>
                [{m.match_code}] {t1Name} VS {t2Name} ({m.venue} - {m.time}) {m.status === 'completed' ? '✅ SELESAI' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Digital Scoreboard Card */}
      {selectedMatch ? (
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-8">
          
          {errorMsg && (
            <div className="bg-red-950/90 border-2 border-red-600 text-red-100 text-xs font-bold rounded-2xl p-4 flex items-start gap-3 shadow-lg animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-black uppercase tracking-wider block text-red-400 text-xs">
                  ⚠️ Perubahan Ditolak
                </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Match Info Badge */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 font-mono font-bold text-red-400 bg-red-950/80 px-2.5 py-1 rounded-lg border border-red-800/50">
              {selectedMatch.round_name} • {selectedMatch.match_code}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-400" /> {selectedMatch.venue}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> {selectedMatch.time} WIB
              </span>
            </div>
          </div>

          {/* Big Score Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Team 1 Score Box */}
            <div className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-between transition ${
              t1Score > t2Score
                ? 'bg-gradient-to-b from-emerald-950 to-slate-900 border-emerald-500 shadow-xl'
                : 'bg-slate-850 border-slate-700'
            }`}>
              <div className="text-center">
                <span className="text-2xl mb-1 block">🔴</span>
                <h3 className="text-xl font-black text-white truncate max-w-[200px]">
                  {selectedMatch.team1_name}
                </h3>
              </div>

              {/* Score Display */}
              <div className="my-6 text-6xl sm:text-7xl font-mono font-black text-emerald-400 tracking-wider">
                {t1Score}
              </div>

              {/* Big Touch Buttons */}
              <div className="flex items-center gap-3 w-full max-w-[200px]">
                <button
                  type="button"
                  onClick={() => setT1Score(Math.max(0, t1Score - 1))}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xl font-extrabold active:scale-95 transition flex items-center justify-center border border-slate-600"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setT1Score(t1Score + 1)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xl font-extrabold active:scale-95 transition flex items-center justify-center shadow-lg border border-red-500"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Team 2 Score Box */}
            <div className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-between transition ${
              t2Score > t1Score
                ? 'bg-gradient-to-b from-emerald-950 to-slate-900 border-emerald-500 shadow-xl'
                : 'bg-slate-850 border-slate-700'
            }`}>
              <div className="text-center">
                <span className="text-2xl mb-1 block">⚪</span>
                <h3 className="text-xl font-black text-white truncate max-w-[200px]">
                  {selectedMatch.team2_name}
                </h3>
              </div>

              {/* Score Display */}
              <div className="my-6 text-6xl sm:text-7xl font-mono font-black text-emerald-400 tracking-wider">
                {t2Score}
              </div>

              {/* Big Touch Buttons */}
              <div className="flex items-center gap-3 w-full max-w-[200px]">
                <button
                  type="button"
                  onClick={() => setT2Score(Math.max(0, t2Score - 1))}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xl font-extrabold active:scale-95 transition flex items-center justify-center border border-slate-600"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setT2Score(t2Score + 1)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xl font-extrabold active:scale-95 transition flex items-center justify-center shadow-lg border border-red-500"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

          </div>

          {/* Menang WO Action Bar */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-2">
            <div className="font-extrabold text-amber-300 flex items-center justify-between">
              <span>⚡ Opsi Menang WO (Walkover)</span>
              {selectedMatch.is_wo && (
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  Menang WO Aktif
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!selectedMatch.team1_id}
                onClick={() => {
                  if (selectedMatch.is_wo && selectedMatch.wo_winner_id === selectedMatch.team1_id) {
                    handleDeclareWO(null);
                  } else if (selectedMatch.team1_id) {
                    handleDeclareWO(selectedMatch.team1_id);
                  }
                }}
                className={`py-2.5 px-3 rounded-xl font-extrabold transition flex items-center justify-center gap-2 border ${
                  selectedMatch.is_wo && selectedMatch.wo_winner_id === selectedMatch.team1_id
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg ring-2 ring-amber-400/50'
                    : 'bg-slate-800 text-amber-200 border-amber-700/60 hover:bg-slate-700'
                }`}
              >
                🔴 {selectedMatch.team1_name} Menang WO
              </button>

              <button
                type="button"
                disabled={!selectedMatch.team2_id}
                onClick={() => {
                  if (selectedMatch.is_wo && selectedMatch.wo_winner_id === selectedMatch.team2_id) {
                    handleDeclareWO(null);
                  } else if (selectedMatch.team2_id) {
                    handleDeclareWO(selectedMatch.team2_id);
                  }
                }}
                className={`py-2.5 px-3 rounded-xl font-extrabold transition flex items-center justify-center gap-2 border ${
                  selectedMatch.is_wo && selectedMatch.wo_winner_id === selectedMatch.team2_id
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg ring-2 ring-amber-400/50'
                    : 'bg-slate-800 text-amber-200 border-amber-700/60 hover:bg-slate-700'
                }`}
              >
                ⚪ {selectedMatch.team2_name} Menang WO
              </button>
            </div>
          </div>

          {/* Telegram Option & Save Action */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={(e) => setNotifyTelegram(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
              />
              <Send className="w-4 h-4 text-blue-400" /> Kirimkan notifikasi ke Telegram
            </label>

            <button
              onClick={handleQuickSubmitScore}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-xl text-sm shadow-xl active:scale-98 transition flex items-center justify-center gap-2"
            >
              {isSavedNotice ? <Check className="w-5 h-5 text-emerald-300" /> : <Trophy className="w-5 h-5" />}
              {isSavedNotice ? 'SKOR BERHASIL DISIMPAN!' : 'UPDATE SKOR & TENTUKAN PEMENANG'}
            </button>
          </div>

        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-2xl border text-slate-400 text-xs">
          Silakan pilih pertandingan dari menu dropdown di atas.
        </div>
      )}

    </div>
  );
};
