import React, { useState, useEffect } from 'react';
import { Match, Tournament, Role } from '../types';
import { X, Trophy, Save, RotateCcw, MapPin, Clock, Calendar, Send, AlertTriangle } from 'lucide-react';
import { processMatchScoreUpdate } from '../lib/bracketEngine';
import { updateMatches } from '../lib/db';
import { notifyMatchScore } from '../lib/telegram';

interface ScoreModalProps {
  match: Match | null;
  tournament: Tournament | undefined;
  allMatches: Match[];
  onClose: () => void;
  currentUser: { name: string; role: Role };
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  match,
  tournament,
  allMatches,
  onClose,
  currentUser,
}) => {
  if (!match || !tournament) return null;

  const [t1Score, setT1Score] = useState<number | ''>(match.team1_score ?? '');
  const [t2Score, setT2Score] = useState<number | ''>(match.team2_score ?? '');
  const [venue, setVenue] = useState(match.venue || 'Lapangan A');
  const [date, setDate] = useState(match.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(match.time || '10:00');
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isWO, setIsWO] = useState<boolean>(match.is_wo || false);
  const [woWinnerId, setWoWinnerId] = useState<string | null>(match.wo_winner_id || null);

  useEffect(() => {
    setT1Score(match.team1_score ?? '');
    setT2Score(match.team2_score ?? '');
    setVenue(match.venue || 'Lapangan A');
    setDate(match.date || new Date().toISOString().split('T')[0]);
    setTime(match.time || '10:00');
    setIsWO(match.is_wo || false);
    setWoWinnerId(match.wo_winner_id || null);
  }, [match]);

  const handleSave = async () => {
    const score1 = t1Score === '' ? null : Number(t1Score);
    const score2 = t2Score === '' ? null : Number(t2Score);

    // Process score/WO update in engine
    const { updatedMatches, winnerName } = processMatchScoreUpdate(
      allMatches,
      match.id,
      score1,
      score2,
      undefined,
      isWO,
      woWinnerId
    );

    // Update match schedule/venue info for target match
    const target = updatedMatches.find((m) => m.id === match.id);
    if (target) {
      target.venue = venue;
      target.date = date;
      target.time = time;
    }

    const logDetail = isWO
      ? `Menang WO [${match.match_code}]: Pemenang WO ${winnerName || 'Belum Ada'}`
      : `Input skor [${match.match_code}]: ${match.team1_name} (${score1 ?? 0}) VS ${match.team2_name} (${score2 ?? 0}) - Pemenang: ${winnerName || 'Belum Ada'}`;

    await updateMatches(tournament.id, updatedMatches, currentUser, logDetail);

    // Notify Telegram if checked
    if (notifyTelegram && target) {
      await notifyMatchScore(target, tournament, winnerName || undefined);
    }

    onClose();
  };

  const handleResetScore = async () => {
    const { updatedMatches } = processMatchScoreUpdate(allMatches, match.id, null, null, undefined, false, null);
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
          
          {/* Teams & Score Input Cards */}
          <div className="grid grid-cols-2 gap-4 text-center">
            
            {/* Team 1 */}
            <div className={`p-4 rounded-xl border-2 transition ${
              t1Score !== '' && t2Score !== '' && Number(t1Score) > Number(t2Score)
                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="font-extrabold text-slate-800 text-sm truncate mb-3">
                🔴 {match.team1_name}
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
                ⚪ {match.team2_name}
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
                disabled={!match.team1_id}
                onClick={() => {
                  if (isWO && woWinnerId === match.team1_id) {
                    setIsWO(false);
                    setWoWinnerId(null);
                  } else {
                    setIsWO(true);
                    setWoWinnerId(match.team1_id);
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  isWO && woWinnerId === match.team1_id
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/80'
                }`}
              >
                🔴 {match.team1_name} Menang WO
              </button>

              <button
                type="button"
                disabled={!match.team2_id}
                onClick={() => {
                  if (isWO && woWinnerId === match.team2_id) {
                    setIsWO(false);
                    setWoWinnerId(null);
                  } else {
                    setIsWO(true);
                    setWoWinnerId(match.team2_id);
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 shadow-sm ${
                  isWO && woWinnerId === match.team2_id
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/80'
                }`}
              >
                ⚪ {match.team2_name} Menang WO
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
