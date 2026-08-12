import React, { useState, useRef } from 'react';
import { Match, Team, Tournament, Role } from '../types';
import { Trophy, Clock, MapPin, Search, ZoomIn, ZoomOut, RotateCcw, AlertCircle, Edit3, ArrowRight, Download, Send, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng, toBlob } from 'html-to-image';
import { sendTelegramBot2Photo } from '../lib/telegram';
import { formatShortDate, ensureDualBranchCrossSessionLinks } from '../lib/bracketEngine';

interface BracketViewProps {
  tournament: Tournament | undefined;
  matches: Match[];
  teams: Team[];
  onSelectMatch: (match: Match) => void;
  currentUserRole: Role;
  onOpenTeamManager: () => void;
}

export const BracketView: React.FC<BracketViewProps> = ({
  tournament,
  matches,
  teams,
  onSelectMatch,
  currentUserRole,
  onOpenTeamManager,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingTele, setIsSendingTele] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  const bracketRef = useRef<HTMLDivElement>(null);

  if (!tournament) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center max-w-xl mx-auto my-8 shadow-sm border border-slate-200">
        <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Belum Ada Turnamen Ditemukan</h2>
        <p className="text-sm text-slate-500 mt-2">Silakan buat turnamen baru melalui menu di bagian atas header.</p>
      </div>
    );
  }

  const allTourMatches = ensureDualBranchCrossSessionLinks(matches.filter((m) => m.tournament_id === tournament.id));
  const tourMatches = allTourMatches.filter((m) => !m.is_third_place);
  const thirdPlaceMatch = allTourMatches.find((m) => m.is_third_place);

  if (tourMatches.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center max-w-2xl mx-auto my-8 shadow-sm border border-slate-200">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
        <h2 className="text-2xl font-extrabold text-slate-800">Bagan Belum Digenerasi</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
          Daftar tim sudah siap? Klik tombol di bawah untuk memasukkan tim, melakukan seeding/pengocokan, dan membuat bagan pertandingan otomatis.
        </p>
        <button
          onClick={onOpenTeamManager}
          className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg hover:shadow-red-500/20 transition flex items-center gap-2 mx-auto"
        >
          <Trophy className="w-5 h-5" />
          Atur Tim & Generasi Bagan
        </button>
      </div>
    );
  }

  // Group matches by round_number
  const maxRound = Math.max(...tourMatches.map((m) => m.round_number), 1);
  const roundMap: { [key: number]: Match[] } = {};
  for (let r = 1; r <= maxRound; r++) {
    roundMap[r] = tourMatches.filter((m) => m.round_number === r);
  }

  // Organize matches in tree order so feeder pairs stay adjacent and align with target matches
  const organizeMatchesByTreeOrder = (
    map: { [key: number]: Match[] },
    maxR: number
  ): { [key: number]: Match[] } => {
    const result: { [key: number]: Match[] } = {};

    // Sort final round chronologically
    const maxMatches = [...(map[maxR] || [])].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.time || '';
      const timeB = b.time || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return (a.match_code || a.id).localeCompare(b.match_code || b.id, undefined, { numeric: true });
    });
    result[maxR] = maxMatches;

    // Process preceding rounds backwards to pair feeders directly with target match
    for (let r = maxR - 1; r >= 1; r--) {
      const currentMatches = map[r] || [];
      const parentMatches = result[r + 1] || [];
      const ordered: Match[] = [];
      const usedIds = new Set<string>();

      for (const parent of parentMatches) {
        const feeders = currentMatches
          .filter((m) => !usedIds.has(m.id) && m.next_match_id === parent.id)
          .sort((a, b) => {
            const slotA = a.next_match_slot || 1;
            const slotB = b.next_match_slot || 1;
            if (slotA !== slotB) return slotA - slotB;
            const dateA = a.date || '';
            const dateB = b.date || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const timeA = a.time || '';
            const timeB = b.time || '';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return (a.match_code || a.id).localeCompare(b.match_code || b.id, undefined, { numeric: true });
          });

        for (const f of feeders) {
          ordered.push(f);
          usedIds.add(f.id);
        }
      }

      // Add any leftover matches in this round
      const leftovers = currentMatches
        .filter((m) => !usedIds.has(m.id))
        .sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const timeA = a.time || '';
          const timeB = b.time || '';
          if (timeA !== timeB) return timeA.localeCompare(timeB);
          return (a.match_code || a.id).localeCompare(b.match_code || b.id, undefined, { numeric: true });
        });

      ordered.push(...leftovers);
      result[r] = ordered;
    }

    return result;
  };

  const organizedRoundMap = organizeMatchesByTreeOrder(roundMap, maxRound);

  // Export Bracket to PNG Download
  const handleDownloadImage = async () => {
    if (!bracketRef.current) return;
    setIsExporting(true);
    setStatusMsg(null);

    try {
      const el = bracketRef.current;
      const fullWidth = el.scrollWidth + 32;
      const fullHeight = el.scrollHeight + 32;

      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#0f172a',
        width: fullWidth,
        height: fullHeight,
        style: {
          overflow: 'visible',
          transform: 'none',
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
        },
      });
      const link = document.createElement('a');
      link.download = `Bagan_${tournament.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      setStatusMsg({ success: true, text: 'Gambar bagan berhasil di-download!' });
    } catch (err: any) {
      console.error('Download bracket image error:', err);
      setStatusMsg({ success: false, text: 'Gagal membuat gambar bagan.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Send Bracket to Telegram Bot 2
  const handleSendToTelegramBot2 = async () => {
    if (!bracketRef.current) return;
    setIsSendingTele(true);
    setStatusMsg(null);

    try {
      const el = bracketRef.current;
      const fullWidth = el.scrollWidth + 32;
      const fullHeight = el.scrollHeight + 32;

      const blob = await toBlob(el, {
        cacheBust: true,
        backgroundColor: '#0f172a',
        width: fullWidth,
        height: fullHeight,
        style: {
          overflow: 'visible',
          transform: 'none',
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
        },
      });

      if (!blob) {
        setStatusMsg({ success: false, text: 'Gagal membuat gambar bagan.' });
        setIsSendingTele(false);
        return;
      }

      const caption = `📊 *UPDATE BAGAN PERTANDINGAN*\n🏆 *${tournament.name}* (${tournament.category})\n⏰ Waktu Update: ${new Date().toLocaleString('id-ID')}\n\n_Sistem Realtime Turnamen KD_`;
      const res = await sendTelegramBot2Photo(blob, caption);
      setStatusMsg({ success: res.success, text: res.message });
    } catch (err: any) {
      console.error('Send bracket image to telegram bot 2 error:', err);
      setStatusMsg({ success: false, text: `Error kirim gambar: ${err.message || err}` });
    } finally {
      setIsSendingTele(false);
    }
  };

  // Trigger celebratory confetti if Final match has a winner
  const finalMatch = tourMatches.find((m) => m.round_number === maxRound);
  if (finalMatch && finalMatch.winner_id && finalMatch.status === 'completed') {
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            🏆 <span>Bagan Sistem Gugur: {tournament.name}</span>
            <span className="text-xs bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full uppercase">
              {tournament.category}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik pada kartu pertandingan untuk memasukkan skor lapangan & menentukan pemenang secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          
          {/* Download & Telegram Bot 2 Buttons */}
          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center gap-1.5 shadow-sm"
            title="Download gambar bagan format PNG"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            {isExporting ? 'Generating...' : 'Download PNG'}
          </button>

          <button
            onClick={handleSendToTelegramBot2}
            disabled={isSendingTele}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
            title="Kirim gambar bagan terbaru ke Bot Telegram 2"
          >
            <Send className="w-3.5 h-3.5 text-purple-200" />
            {isSendingTele ? 'Sending...' : 'Kirim ke Bot 2 Telegram'}
          </button>

          {/* Search team */}
          <div className="relative flex-1 md:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari Tim..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200">
            <button
              onClick={() => setZoomLevel(Math.max(70, zoomLevel - 10))}
              className="p-1 hover:bg-white text-slate-700 rounded-lg transition"
              title="Perkecil Tampilan"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-600 px-1 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(130, zoomLevel + 10))}
              className="p-1 hover:bg-white text-slate-700 rounded-lg transition"
              title="Perbesar Tampilan"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1 hover:bg-white text-slate-700 rounded-lg transition"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
          statusMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs hover:underline">Tutup</button>
        </div>
      )}

      {/* Interactive Bracket Canvas Container */}
      <div ref={bracketRef} className="bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-800 overflow-x-auto min-h-[550px] relative">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
          className="flex items-stretch gap-12 min-w-max pb-8 pt-2 transition-transform duration-200"
        >
          {Object.keys(organizedRoundMap)
            .map(Number)
            .sort((a, b) => a - b)
            .map((roundNum) => {
              const roundMatchesList = organizedRoundMap[roundNum] || [];
              if (roundMatchesList.length === 0) return null;
              const isFinalRound = roundNum === maxRound;

              // Dynamic header naming based on actual match count and round structure
              const rawName = roundMatchesList[0]?.round_name;
              let roundTitle = '';

              if (isFinalRound) {
                roundTitle = 'GRAND FINAL';
              } else if (roundNum === maxRound - 1 && maxRound >= 2) {
                roundTitle = 'SEMIFINAL';
              } else if (roundMatchesList.length === 4) {
                roundTitle = 'PEREMPAT FINAL';
              } else if (roundMatchesList.length === 8) {
                roundTitle = '16 BESAR';
              } else if (rawName) {
                const cleaned = rawName
                  .replace(/\s*\((SORE|PAGI|SESI\s+SORE|SESI\s+PAGI)\)/gi, '')
                  .replace(/\s+LANJUTAN\s+(SORE|PAGI)/gi, '')
                  .replace(/\s+(SORE|PAGI)\b/gi, '')
                  .replace(/LINTAS\s+SESI/gi, '')
                  .trim();

                if (cleaned && !/semifinal|final|perempat|16\s*besar/i.test(cleaned)) {
                  roundTitle = cleaned.toUpperCase();
                } else {
                  roundTitle = `BABAK ${roundNum}`;
                }
              } else {
                roundTitle = `BABAK ${roundNum}`;
              }

              // Strip any remaining (SORE), (PAGI), etc.
              roundTitle = roundTitle
                .replace(/\s*\((SORE|PAGI|SESI\s+SORE|SESI\s+PAGI)\)/gi, '')
                .replace(/\s+LANJUTAN\s+(SORE|PAGI)/gi, '')
                .replace(/\s+(SORE|PAGI)\b/gi, '')
                .trim();

              const roundDates = Array.from(
                new Set(
                  roundMatchesList
                    .map((m) => m.date)
                    .filter((d): d is string => Boolean(d) && d !== 'TBA')
                )
              ).sort();

              const roundDateLabel =
                roundDates.length > 0
                  ? roundDates.length === 1
                    ? formatShortDate(roundDates[0])
                    : `${formatShortDate(roundDates[0])} - ${formatShortDate(roundDates[roundDates.length - 1])}`
                  : null;

              return (
                <div key={roundNum} className="flex flex-col min-w-[280px] max-w-[310px] relative">
                  {/* Round Header */}
                  <div className={`mb-6 text-center py-2.5 px-4 rounded-xl border shadow-md z-10 flex flex-col items-center justify-center ${
                    isFinalRound
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-300 ring-2 ring-amber-400/30'
                      : 'bg-slate-800 text-red-400 border-slate-700'
                  }`}>
                    <span className="font-black uppercase tracking-wider text-xs">
                      {isFinalRound ? '👑 ' : ''}{roundTitle}
                    </span>
                    {roundDateLabel && (
                      <span className={`text-[10px] font-semibold mt-0.5 ${isFinalRound ? 'text-slate-900/80' : 'text-slate-400'}`}>
                        📅 {roundDateLabel}
                      </span>
                    )}
                  </div>

                  {/* Round Matches List */}
                  <div className="flex-1 flex flex-col justify-around gap-6 py-2">
                    {roundMatchesList.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        allMatches={tourMatches}
                        searchTerm={searchTerm}
                        onSelect={() => onSelectMatch(m)}
                        isFinalRound={isFinalRound}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

          {/* Optional Perebutan Juara 3 Column */}
          {thirdPlaceMatch && (
            <div className="flex flex-col min-w-[280px] max-w-[310px] pl-6 border-l border-slate-800 border-dashed">
              <div className="mb-6 text-center py-2 px-4 rounded-xl bg-orange-950 text-orange-300 border border-orange-700/50 flex flex-col items-center justify-center shadow-md">
                <span className="font-black uppercase tracking-wider text-xs">
                  🥉 Perebutan Juara 3
                </span>
                {thirdPlaceMatch.date && (
                  <span className="text-[10px] font-semibold mt-0.5 text-orange-300/80">
                    📅 {formatShortDate(thirdPlaceMatch.date)}
                  </span>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center">
                <MatchCard
                  match={thirdPlaceMatch}
                  allMatches={tourMatches}
                  searchTerm={searchTerm}
                  onSelect={() => onSelectMatch(thirdPlaceMatch)}
                  isSpecialBadge="JUARA 3"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MatchCardProps {
  match: Match;
  allMatches: Match[];
  searchTerm: string;
  onSelect: () => void;
  isSpecialBadge?: string;
  isFinalRound?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, allMatches, searchTerm, onSelect, isSpecialBadge, isFinalRound }) => {
  const isMatchCompleted = match.status === 'completed';
  const isBye = match.status === 'bye';

  const isT1Winner = match.winner_id && match.winner_id === match.team1_id;
  const isT2Winner = match.winner_id && match.winner_id === match.team2_id;

  const isT1Real = match.team1_name && match.team1_name !== 'TBD' && match.team1_name.trim() !== '';
  const isT2Real = match.team2_name && match.team2_name !== 'TBD' && match.team2_name.trim() !== '';

  const isT1Highlighted = isT1Real && searchTerm && match.team1_name.toLowerCase().includes(searchTerm.toLowerCase());
  const isT2Highlighted = isT2Real && searchTerm && match.team2_name.toLowerCase().includes(searchTerm.toLowerCase());

  // Connector lines logic
  const hasNextMatch = Boolean(match.next_match_id) && !isSpecialBadge;
  const nextSlot = match.next_match_slot || 1;
  const isTargetOfFeeders = allMatches.some((m) => m.next_match_id === match.id) && !isSpecialBadge;

  // Next round target match
  const nextMatch = match.next_match_id ? allMatches.find((m) => m.id === match.next_match_id) : undefined;

  const renderTeamSlot = (isReal: boolean, teamName: string) => {
    if (isReal) {
      if (teamName === 'BYE') {
        return (
          <div className="flex items-center gap-1.5 text-slate-500 italic">
            <span>BYE</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded uppercase not-italic font-bold">BYE</span>
          </div>
        );
      }
      return <span className="truncate">{teamName}</span>;
    }

    return <span className="text-slate-500 font-bold text-sm tracking-widest text-center w-full block">-</span>;
  };

  return (
    <div className="relative group/card my-auto">
      {/* Left connector line (incoming from feeder matches) */}
      {isTargetOfFeeders && (
        <div className="hidden lg:block absolute -left-6 top-1/2 w-6 border-t-2 border-slate-600/80 pointer-events-none z-0" />
      )}

      {/* Right connector line (outgoing to next round match) */}
      {hasNextMatch && (
        <div
          className={`hidden lg:block absolute -right-6 ${
            nextSlot === 1
              ? 'top-1/2 h-[calc(100%+1.5rem)] border-r-2 border-t-2 border-slate-600/80 rounded-tr-md'
              : 'bottom-1/2 h-[calc(100%+1.5rem)] border-r-2 border-b-2 border-slate-600/80 rounded-br-md'
          } w-6 pointer-events-none z-0`}
        />
      )}

      <div
        onClick={onSelect}
        className={`group relative z-10 bg-slate-800 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-0.5 ${
          isMatchCompleted
            ? 'border-emerald-500/50 bg-slate-800/90'
            : isBye
            ? 'border-slate-700 opacity-80'
            : isFinalRound
            ? 'border-amber-500/60 hover:border-amber-400'
            : 'border-slate-700 hover:border-red-500'
        }`}
      >
      {/* Top Header Bar */}
      <div className="px-3 py-1.5 bg-slate-850 border-b border-slate-700/70 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/50">
            {isSpecialBadge || match.match_code}
          </span>
          {match.is_wo && (
            <span className="text-[9px] bg-amber-950 text-amber-300 font-black px-1.5 py-0.5 rounded border border-amber-700 uppercase tracking-wider animate-pulse">
              [WO]
            </span>
          )}
          {match.time_slot && (
            <span
              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                match.time_slot === '23:00 - Fleksibel' || match.time_slot === '23:00 - Selesai'
                  ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                  : match.time_slot === '17:30 - 22:00' || match.time_slot === '16:00 - 22:00'
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
            >
              {match.time_slot}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {match.venue && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin className="w-3 h-3 text-red-400" />
              {match.venue}
            </span>
          )}
          {match.time && (
            <span className="flex items-center gap-1 text-[10px] text-slate-300 font-mono font-bold">
              <Clock className="w-3 h-3 text-amber-400" />
              {match.date ? `${formatShortDate(match.date)} - ` : ''}{match.time}
            </span>
          )}
        </div>
      </div>

      {/* Teams Container */}
      <div className="p-2.5 space-y-1.5">
        {/* Team 1 Row */}
        <div
          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition ${
            isT1Winner
              ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-100 font-extrabold shadow-sm'
              : match.team1_name === 'BYE'
              ? 'bg-slate-900/40 text-slate-500 italic'
              : isT1Real
              ? 'bg-slate-900/70 text-slate-200 font-semibold'
              : 'bg-slate-900/30 text-slate-400'
          } ${isT1Highlighted ? 'ring-2 ring-amber-400 bg-amber-950/80' : ''}`}
        >
          <div className="flex items-center gap-2 truncate pr-2 min-w-0 flex-1">
            {isT1Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            {renderTeamSlot(Boolean(isT1Real), match.team1_name)}
            {isT1Winner && match.is_wo && (
              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 py-0.2 rounded uppercase shrink-0">
                WO
              </span>
            )}
          </div>
          <span className={`font-mono text-sm px-2 py-0.5 rounded font-bold shrink-0 ${
            isT1Winner ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
          }`}>
            {match.team1_score !== null ? match.team1_score : match.is_wo && isT1Winner ? 'WO' : '-'}
          </span>
        </div>

        {/* Team 2 Row */}
        <div
          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition ${
            isT2Winner
              ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-100 font-extrabold shadow-sm'
              : match.team2_name === 'BYE'
              ? 'bg-slate-900/40 text-slate-500 italic'
              : isT2Real
              ? 'bg-slate-900/70 text-slate-200 font-semibold'
              : 'bg-slate-900/30 text-slate-400'
          } ${isT2Highlighted ? 'ring-2 ring-amber-400 bg-amber-950/80' : ''}`}
        >
          <div className="flex items-center gap-2 truncate pr-2 min-w-0 flex-1">
            {isT2Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            {renderTeamSlot(Boolean(isT2Real), match.team2_name)}
            {isT2Winner && match.is_wo && (
              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1 py-0.2 rounded uppercase shrink-0">
                WO
              </span>
            )}
          </div>
          <span className={`font-mono text-sm px-2 py-0.5 rounded font-bold shrink-0 ${
            isT2Winner ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
          }`}>
            {match.team2_score !== null ? match.team2_score : match.is_wo && isT2Winner ? 'WO' : '-'}
          </span>
        </div>
      </div>

      {/* Footer hover hint & next match route info */}
      <div className="px-3 py-1.5 bg-slate-850/80 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-medium flex items-center gap-1">
          {match.is_wo ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">⚡ Menang WO</span>
          ) : isMatchCompleted ? (
            <span className="text-emerald-400 font-bold">✅ Selesai</span>
          ) : isBye ? (
            <span className="text-blue-400 font-bold">⚡ Lolos Otomatis</span>
          ) : (
            <span className="text-slate-400">⏱️ Belum Dimulai</span>
          )}
          {nextMatch && (
            <span className="ml-1 text-[9px] text-amber-400/90 font-mono font-bold bg-amber-950/60 px-1 py-0.2 rounded border border-amber-800/40">
              ➜ {nextMatch.match_code}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 font-bold text-red-400 group-hover:translate-x-0.5 transition-transform">
          {isMatchCompleted ? 'Koreksi / Edit' : 'Input Skor'} <Edit3 className="w-3 h-3" />
        </span>
      </div>
    </div>
    </div>
  );
};
