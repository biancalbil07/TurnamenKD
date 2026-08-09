import React, { useState } from 'react';
import { Match, Tournament, Role } from '../types';
import { Calendar, Clock, MapPin, Filter, Edit3, CheckCircle, Play, AlertCircle, Save } from 'lucide-react';
import { updateMatches } from '../lib/db';
import { notifyScheduleUpdate } from '../lib/telegram';
import { formatShortDate } from '../lib/bracketEngine';

interface ScheduleViewProps {
  tournament: Tournament | undefined;
  matches: Match[];
  onSelectMatch: (match: Match) => void;
  currentUser: { name: string; role: Role };
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  tournament,
  matches,
  onSelectMatch,
  currentUser,
}) => {
  if (!tournament) return null;

  const tournamentMatches = matches.filter((m) => m.tournament_id === tournament.id);

  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'live' | 'completed'>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Filter venues list
  const allVenues = Array.from(new Set(tournamentMatches.map((m) => m.venue).filter(Boolean)));

  // Filter matches
  let filteredMatches = tournamentMatches.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (venueFilter !== 'all' && m.venue !== venueFilter) return false;
    return true;
  });

  // Chronological Sorting: Date ascending, then Time ascending
  filteredMatches.sort((a, b) => {
    const dateA = a.date || '9999-12-31';
    const dateB = b.date || '9999-12-31';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const timeA = a.time || '99:99';
    const timeB = b.time || '99:99';
    return timeA.localeCompare(timeB);
  });

  const handleSaveScheduleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    const updatedList = tournamentMatches.map((m) => (m.id === editingMatch.id ? editingMatch : m));
    await updateMatches(
      tournament.id,
      updatedList,
      currentUser,
      `Ubah jadwal [${editingMatch.match_code}]: Lapangan "${editingMatch.venue}" jam ${editingMatch.time} (${editingMatch.date})`
    );

    // Notify Telegram
    await notifyScheduleUpdate(editingMatch, tournament);

    setEditingMatch(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-600" />
            <span>Jadwal Pertandingan Kronologis</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Diurutkan berdasarkan Tanggal & Jam Pertandingan (Terlama ke Terbaru).
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition ${statusFilter === 'all' ? 'bg-white shadow text-red-700 font-bold' : ''}`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-3 py-1 rounded-lg transition ${statusFilter === 'scheduled' ? 'bg-white shadow text-red-700 font-bold' : ''}`}
            >
              Terjadwal
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-lg transition ${statusFilter === 'completed' ? 'bg-white shadow text-red-700 font-bold' : ''}`}
            >
              Selesai
            </button>
          </div>

          {/* Venue Filter */}
          {allVenues.length > 0 && (
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="all">Semua Lapangan</option>
              {allVenues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Match Schedule Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada pertandingan yang cocok dengan filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Waktu & Venue</th>
                  <th className="px-4 py-3">Babak / Code</th>
                  <th className="px-4 py-3 text-center">Pertandingan (Tim 1 vs Tim 2)</th>
                  <th className="px-4 py-3 text-center">Skor / Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatches.map((m) => {
                  const isCompleted = m.status === 'completed';
                  const isBye = m.status === 'bye';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Waktu & Venue */}
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 font-bold text-red-700">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatShortDate(m.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                          <span className="flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3 text-amber-500" /> {m.time || 'TBA'} WIB
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400" /> {m.venue}
                          </span>
                        </div>
                      </td>

                      {/* Round & Code & Time Slot */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {m.match_code}
                          </span>
                          {m.time_slot && (
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                                m.time_slot === '23:00 - Selesai'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                  : m.time_slot === '16:00 - 22:00'
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {m.time_slot === '23:00 - Selesai' ? '⚡ Lintas Slot (23:00)' : m.time_slot}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{m.round_name}</div>
                      </td>

                      {/* Teams */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-3 font-semibold text-slate-800">
                          {(() => {
                            const f1 = matches.find((x) => x.next_match_id === m.id && x.next_match_slot === 1);
                            const t1Display =
                              m.team1_name && m.team1_name !== 'TBD'
                                ? m.team1_name
                                : f1
                                ? `Pemenang ${f1.match_code}`
                                : 'Menunggu Tim';

                            const f2 = matches.find((x) => x.next_match_id === m.id && x.next_match_slot === 2);
                            const t2Display =
                              m.team2_name && m.team2_name !== 'TBD'
                                ? m.team2_name
                                : f2
                                ? `Pemenang ${f2.match_code}`
                                : 'Menunggu Tim';

                            return (
                              <>
                                <span
                                  className={`px-2.5 py-1 rounded-lg ${
                                    m.winner_id === m.team1_id
                                      ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                      : !m.team1_name || m.team1_name === 'TBD'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold'
                                      : 'bg-slate-50'
                                  }`}
                                >
                                  🔴 {t1Display}
                                </span>
                                <span className="text-slate-400 font-bold text-[10px]">VS</span>
                                <span
                                  className={`px-2.5 py-1 rounded-lg ${
                                    m.winner_id === m.team2_id
                                      ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                      : !m.team2_name || m.team2_name === 'TBD'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold'
                                      : 'bg-slate-50'
                                  }`}
                                >
                                  ⚪ {t2Display}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Score / Status */}
                      <td className="px-4 py-3 text-center">
                        {isCompleted ? (
                          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-black text-sm px-3 py-1 rounded-xl">
                            <span>{m.team1_score ?? 0}</span>
                            <span>-</span>
                            <span>{m.team2_score ?? 0}</span>
                          </div>
                        ) : isBye ? (
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            ⚡ Lolos BYE
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            ⏱️ Terjadwal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser.role === 'master' && (
                            <button
                              onClick={() => setEditingMatch(m)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                              title="Ubah Jam & Lapangan"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onSelectMatch(m)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] shadow transition"
                          >
                            Input Skor
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Match Schedule Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveScheduleEdit}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-600" /> Edit Jadwal & Venue
            </h3>

            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Match: <strong>{editingMatch.team1_name}</strong> vs <strong>{editingMatch.team2_name}</strong> ({editingMatch.match_code})
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lapangan / Venue</label>
              <input
                type="text"
                value={editingMatch.venue}
                onChange={(e) => setEditingMatch({ ...editingMatch, venue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={editingMatch.date}
                  onChange={(e) => setEditingMatch({ ...editingMatch, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jam (WIB)</label>
                <input
                  type="time"
                  value={editingMatch.time}
                  onChange={(e) => setEditingMatch({ ...editingMatch, time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Simpan & Notifikasi
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
