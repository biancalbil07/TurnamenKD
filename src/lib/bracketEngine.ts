import { Match, Team, TimeSlot, Tournament } from '../types';

export function getRoundName(roundNumber: number, totalRounds: number, isThirdPlace = false): string {
  if (isThirdPlace) return 'Perebutan Juara 3';
  if (roundNumber === totalRounds) return 'FINAL';
  if (roundNumber === totalRounds - 1) return 'Semifinal';
  if (roundNumber === totalRounds - 2) return 'Perempat Final';
  if (roundNumber === 1) return 'Babak Penyisihan (Babak 1)';
  return `Babak ${roundNumber}`;
}

/**
 * Calculates nearest power of 2 >= teamCount (minimum 4)
 */
export function getBracketSize(teamCount: number): number {
  let size = 4;
  while (size < teamCount) {
    size *= 2;
  }
  return size;
}

/**
 * Formats YYYY-MM-DD or date string to short Indonesian date string (e.g., '14 Ags')
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return 'TBA';
  if (dateStr.includes('Ags') || dateStr.includes('Jan')) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[monthIdx] || 'Ags'}`;
    }
    return dateStr;
  }
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function isMorningSlot(slot?: string): boolean {
  if (!slot) return true;
  const s = slot.toLowerCase().trim();
  if (s.includes('17:30') || s.includes('16:00') || s.includes('22:00') || s.includes('23:00') || s.includes('sore') || s.includes('malam')) {
    return false;
  }
  if (s.includes('10:00') || s.includes('09:00') || s.includes('15:00') || s.includes('pagi') || s.includes('siang')) {
    return true;
  }
  return true;
}

/**
 * Helper to group and pair teams by time_slot preference (Pagi vs Pagi, Sore vs Sore)
 */
export function seedTeamsByTimeSlot(
  teams: Team[],
  shuffle = false,
  totalByeCount = 0
): {
  orderedTeams: Team[];
  byeTeams: Team[];
  r1Teams: Team[];
} {
  const morningTeams: Team[] = [];
  const eveningTeams: Team[] = [];

  teams.forEach((t) => {
    if (isMorningSlot(t.time_slot)) {
      morningTeams.push(t);
    } else {
      eveningTeams.push(t);
    }
  });

  const sortFn = (a: Team, b: Team) => (a.seed || 0) - (b.seed || 0);

  if (shuffle) {
    morningTeams.sort(() => Math.random() - 0.5);
    eveningTeams.sort(() => Math.random() - 0.5);
  } else {
    morningTeams.sort(sortFn);
    eveningTeams.sort(sortFn);
  }

  let mByes = 0;
  let eByes = 0;

  if (totalByeCount > 0) {
    let bestScore = -10;
    let bestMByes = 0;
    let bestEByes = 0;

    for (let mb = 0; mb <= Math.min(totalByeCount, morningTeams.length); mb++) {
      const eb = totalByeCount - mb;
      if (eb < 0 || eb > eveningTeams.length) continue;

      const mR1Count = morningTeams.length - mb;
      const eR1Count = eveningTeams.length - eb;

      let score = 0;
      if (mR1Count % 2 === 0) score += 100;
      if (eR1Count % 2 === 0) score += 100;

      score -= Math.abs(mb - eb) * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestMByes = mb;
        bestEByes = eb;
      }
    }

    mByes = bestMByes;
    eByes = bestEByes;
  }

  const morningBYETeams = morningTeams.slice(0, mByes);
  const morningR1Teams = morningTeams.slice(mByes);

  const eveningBYETeams = eveningTeams.slice(0, eByes);
  const eveningR1Teams = eveningTeams.slice(eByes);

  // Dynamic Session Priority: The smaller session gets priority to complete its internal rounds first
  let r1Teams: Team[];
  let byeTeams: Team[];

  if (morningTeams.length <= eveningTeams.length) {
    byeTeams = [...morningBYETeams, ...eveningBYETeams];
    r1Teams = [...morningR1Teams, ...eveningR1Teams];
  } else {
    byeTeams = [...eveningBYETeams, ...morningBYETeams];
    r1Teams = [...eveningR1Teams, ...morningR1Teams];
  }

  const orderedTeams = [...byeTeams, ...r1Teams];

  return { orderedTeams, byeTeams, r1Teams };
}

/**
 * Generates an interleaved feeder slot order for power-of-2 length (e.g. 4 -> [0, 2, 1, 3])
 */
function getFeederOrder(length: number): number[] {
  if (length <= 1) return [0];
  if (length === 2) return [0, 1];
  const prev = getFeederOrder(length / 2);
  const result: number[] = [];
  for (const val of prev) {
    result.push(val * 2);
  }
  for (const val of prev) {
    result.push(val * 2 + 1);
  }
  return result;
}

/**
 * Generates array of YYYY-MM-DD strings between startDate and endDate
 */
export function generateDateList(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr || '2026-08-10'];
  }

  const dates: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

/**
 * Multi-Day Scheduler Clock with Strict Session Isolation & Day Overflow
 * 1. Morning Slot (10:00 - 15:00) -> Strict Morning Isolation (Overflows to Next Day Morning if full)
 * 2. Evening Slot (17:30 - 22:00) -> Strict Evening Isolation (Overflows to Next Day Evening if full)
 * 3. Flexible Cross-Session Slot (23:00 - Selesai) -> Automated Neutral Slot for Pagi vs Sore matches
 */
export class MultiDaySchedulerClock {
  private dates: string[];
  private morningSlotLabel = '10:00 - 15:00';
  private eveningSlotLabel = '17:30 - 22:00';
  private neutralSlotLabel = '23:00 - Selesai';

  private courts = ['Lapangan A', 'Lapangan B'];

  private dateStates: Map<
    string,
    {
      mTime: number;
      mCourtIdx: number;
      eTime: number;
      eCourtIdx: number;
      nTime: number;
      nCourtIdx: number;
    }
  > = new Map();

  constructor(dates: string[], timeSlots?: TimeSlot[]) {
    this.dates = dates.length > 0 ? dates : ['2026-08-10'];

    if (timeSlots && timeSlots.length > 0) {
      const s1 = timeSlots.find((s) => s.slot_label.includes('10:00') || s.slot_label.includes('09:00') || s.slot_label.includes('Siang'));
      const s2 = timeSlots.find((s) => s.slot_label.includes('17:30') || s.slot_label.includes('16:00') || s.slot_label.includes('Sore') || s.slot_label.includes('Malam'));
      const s3 = timeSlots.find((s) => s.slot_label.includes('23:00') || s.slot_label.includes('Netral') || s.slot_label.includes('Selesai'));

      if (s1) this.morningSlotLabel = s1.slot_label;
      if (s2) this.eveningSlotLabel = s2.slot_label;
      if (s3) this.neutralSlotLabel = s3.slot_label;
    }

    this.dates.forEach((dStr) => {
      this.dateStates.set(dStr, {
        mTime: 10,
        mCourtIdx: 0,
        eTime: 17.5,
        eCourtIdx: 0,
        nTime: 23,
        nCourtIdx: 0,
      });
    });
  }

  private getState(dStr: string) {
    if (!this.dateStates.has(dStr)) {
      this.dateStates.set(dStr, {
        mTime: 10,
        mCourtIdx: 0,
        eTime: 17.5,
        eCourtIdx: 0,
        nTime: 23,
        nCourtIdx: 0,
      });
    }
    return this.dateStates.get(dStr)!;
  }

  allocateMatch(
    slotType: '10:00 - 15:00' | '17:30 - 22:00' | '23:00 - Selesai',
    preferredDateIdx = 0
  ): { date: string; time: string; time_slot: string; venue: string } {
    let startDIdx = Math.min(preferredDateIdx, this.dates.length - 1);
    if (startDIdx < 0) startDIdx = 0;

    if (slotType === '10:00 - 15:00') {
      // Find day with morning time < 15.0 starting from startDIdx (Morning Day Overflow)
      let dIdx = startDIdx;
      while (dIdx < this.dates.length) {
        const dStr = this.dates[dIdx];
        const state = this.getState(dStr);
        if (state.mTime < 15.0) {
          const decimalTime = Math.min(state.mTime, 14.5);
          const courtIdx = state.mCourtIdx;
          const venue = this.courts[courtIdx % this.courts.length];

          state.mCourtIdx++;
          if (state.mCourtIdx >= this.courts.length) {
            state.mCourtIdx = 0;
            state.mTime += 0.5; // 30-min step for parallel courts
          }

          const h = Math.floor(decimalTime) % 24;
          const m = Math.round((decimalTime - Math.floor(decimalTime)) * 60);
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          return { date: dStr, time: timeStr, time_slot: this.morningSlotLabel, venue };
        }
        dIdx++;
      }
      // Fallback overflow to last day
      const lastDStr = this.dates[this.dates.length - 1];
      const state = this.getState(lastDStr);
      const courtIdx = state.mCourtIdx;
      const venue = this.courts[courtIdx % this.courts.length];

      const h = Math.floor(state.mTime) % 24;
      const m = Math.round((state.mTime - Math.floor(state.mTime)) * 60);
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      state.mCourtIdx++;
      if (state.mCourtIdx >= this.courts.length) {
        state.mCourtIdx = 0;
        state.mTime += 0.5;
      }
      return { date: lastDStr, time: timeStr, time_slot: this.morningSlotLabel, venue };
    } else if (slotType === '17:30 - 22:00') {
      // Find day with evening time < 22.0 starting from startDIdx (Evening Day Overflow)
      let dIdx = startDIdx;
      while (dIdx < this.dates.length) {
        const dStr = this.dates[dIdx];
        const state = this.getState(dStr);
        if (state.eTime < 22.0) {
          const decimalTime = Math.min(state.eTime, 21.5);
          const courtIdx = state.eCourtIdx;
          const venue = this.courts[courtIdx % this.courts.length];

          state.eCourtIdx++;
          if (state.eCourtIdx >= this.courts.length) {
            state.eCourtIdx = 0;
            state.eTime += 0.5;
          }

          const h = Math.floor(decimalTime) % 24;
          const m = Math.round((decimalTime - Math.floor(decimalTime)) * 60);
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          return { date: dStr, time: timeStr, time_slot: this.eveningSlotLabel, venue };
        }
        dIdx++;
      }
      // Fallback overflow to last day
      const lastDStr = this.dates[this.dates.length - 1];
      const state = this.getState(lastDStr);
      const courtIdx = state.eCourtIdx;
      const venue = this.courts[courtIdx % this.courts.length];

      const h = Math.floor(state.eTime) % 24;
      const m = Math.round((state.eTime - Math.floor(state.eTime)) * 60);
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      state.eCourtIdx++;
      if (state.eCourtIdx >= this.courts.length) {
        state.eCourtIdx = 0;
        state.eTime += 0.5;
      }
      return { date: lastDStr, time: timeStr, time_slot: this.eveningSlotLabel, venue };
    } else {
      // Cross-Session Flexible Slot (23:00 - Selesai)
      let dIdx = startDIdx;
      const dStr = this.dates[Math.min(dIdx, this.dates.length - 1)];
      const state = this.getState(dStr);

      const decimalTime = Math.min(state.nTime, 24);
      const courtIdx = state.nCourtIdx;
      const venue = this.courts[courtIdx % this.courts.length];

      state.nCourtIdx++;
      if (state.nCourtIdx >= this.courts.length) {
        state.nCourtIdx = 0;
        state.nTime += 0.5;
      }

      const h = Math.floor(decimalTime) % 24;
      const m = Math.round((decimalTime - Math.floor(decimalTime)) * 60);
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      return { date: dStr, time: timeStr, time_slot: this.neutralSlotLabel, venue };
    }
  }
}

interface SubBracketData {
  matchesByRound: Match[][];
  rounds: number;
  finalMatch: Match | null;
  branchSize: number;
}

function buildSubBracket(
  tournamentId: string,
  teams: Team[],
  timeSlotLabel: '10:00 - 15:00' | '17:30 - 22:00',
  branchPrefix: 'M' | 'E',
  shuffle: boolean,
  startDateStr: string,
  now: string
): SubBracketData | null {
  if (teams.length === 0) return null;

  const sorted = [...teams];
  const sortFn = (a: Team, b: Team) => (a.seed || 0) - (b.seed || 0);
  if (shuffle) {
    sorted.sort(() => Math.random() - 0.5);
  } else {
    sorted.sort(sortFn);
  }

  const numTeams = sorted.length;
  const branchSize = getBracketSize(numTeams);
  const totalRounds = Math.log2(branchSize);
  const byeCount = branchSize - numTeams;

  const byeTeams = sorted.slice(0, byeCount);
  const r1Teams = sorted.slice(byeCount);
  const r1MatchCount = Math.floor(r1Teams.length / 2);

  const matchesByRound: Match[][] = [];

  for (let r = 1; r <= totalRounds; r++) {
    let numMatchesInRound = 0;
    if (r === 1) {
      numMatchesInRound = r1MatchCount;
    } else {
      numMatchesInRound = branchSize / Math.pow(2, r);
    }

    const roundMatches: Match[] = [];
    for (let i = 0; i < numMatchesInRound; i++) {
      const matchId = `match_${tournamentId}_${branchPrefix}_r${r}_m${i + 1}`;
      const code = `${branchPrefix}-R${r}-M${i + 1}`;
      const roundName = totalRounds === 1 ? `Final Sesi (${branchPrefix === 'M' ? 'Pagi' : 'Sore'})` : `${getRoundName(r, totalRounds)} (${branchPrefix === 'M' ? 'Pagi' : 'Sore'})`;

      roundMatches.push({
        id: matchId,
        tournament_id: tournamentId,
        round_number: r,
        round_name: roundName,
        match_code: code,
        team1_id: null,
        team2_id: null,
        team1_name: 'TBD',
        team2_name: 'TBD',
        team1_score: null,
        team2_score: null,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null,
        status: 'scheduled',
        venue: 'Lapangan A',
        date: startDateStr,
        time: timeSlotLabel === '10:00 - 15:00' ? '10:00' : '17:30',
        time_slot: timeSlotLabel,
        updated_at: now,
      });
    }
    matchesByRound.push(roundMatches);
  }

  // Populate Round 1 matches
  const round1 = matchesByRound[0] || [];
  for (let i = 0; i < r1MatchCount; i++) {
    const match = round1[i];
    const t1 = r1Teams[i * 2];
    const t2 = r1Teams[i * 2 + 1];
    if (match && t1 && t2) {
      match.team1_id = t1.id;
      match.team1_name = t1.name;
      match.team2_id = t2.id;
      match.team2_name = t2.name;
      match.time_slot = timeSlotLabel;
    }
  }

  // Link Round 1 -> Round 2 (Place BYEs directly into Round 2 slots)
  if (totalRounds >= 2) {
    const halfR2Slots = branchSize / 2;
    const feederOrder = getFeederOrder(halfR2Slots);
    const round2Matches = matchesByRound[1] || [];

    let byeIdx = 0;
    let r1Idx = 0;

    feederOrder.forEach((slotIndex, orderPos) => {
      const targetMatchIdx = Math.floor(slotIndex / 2);
      const targetSlot = (slotIndex % 2 === 0 ? 1 : 2) as 1 | 2;
      const r2Match = round2Matches[targetMatchIdx];

      if (orderPos < byeCount) {
        const byeTeam = byeTeams[byeIdx++];
        if (byeTeam && r2Match) {
          if (targetSlot === 1) {
            r2Match.team1_id = byeTeam.id;
            r2Match.team1_name = byeTeam.name;
          } else {
            r2Match.team2_id = byeTeam.id;
            r2Match.team2_name = byeTeam.name;
          }
        }
      } else {
        if (r1Idx < r1MatchCount) {
          const r1Match = round1[r1Idx++];
          if (r1Match && r2Match) {
            r1Match.next_match_id = r2Match.id;
            r1Match.next_match_slot = targetSlot;
          }
        }
      }
    });

    // Link Round 2 -> Round totalRounds
    for (let r = 1; r < totalRounds - 1; r++) {
      const currentRound = matchesByRound[r];
      const nextRound = matchesByRound[r + 1];

      currentRound.forEach((m, idx) => {
        const targetMatchIdx = Math.floor(idx / 2);
        const targetSlot = (idx % 2 === 0 ? 1 : 2) as 1 | 2;
        if (nextRound[targetMatchIdx]) {
          m.next_match_id = nextRound[targetMatchIdx].id;
          m.next_match_slot = targetSlot;
        }
      });
    }
  }

  const lastRoundMatches = matchesByRound[totalRounds - 1] || [];
  const finalMatch = lastRoundMatches[0] || null;

  return {
    matchesByRound,
    rounds: totalRounds,
    finalMatch,
    branchSize,
  };
}

/**
 * Generates a complete knockout bracket with Independent Sub-Brackets:
 * 1. Morning Sub-Bracket (Filtered ONLY Morning teams, independent BYE calculation & 10:00-15:00 slots).
 * 2. Evening Sub-Bracket (Filtered ONLY Evening teams, independent BYE calculation & 17:30-22:00 slots).
 * 3. Cross-Session Grand Final (Morning Winner vs Evening Winner at 23:00 - Selesai).
 */
export function generateKnockoutMatches(
  tournamentId: string,
  teams: Team[],
  includeThirdPlace = true,
  shuffle = false,
  timeSlots?: TimeSlot[],
  startDateStr = '2026-08-10',
  endDateStr = '2026-08-16'
): Match[] {
  if (teams.length < 2) return [];

  const morningTeams: Team[] = [];
  const eveningTeams: Team[] = [];

  teams.forEach((t) => {
    if (isMorningSlot(t.time_slot)) {
      morningTeams.push(t);
    } else {
      eveningTeams.push(t);
    }
  });

  const now = new Date().toISOString();

  const mSub = buildSubBracket(tournamentId, morningTeams, '10:00 - 15:00', 'M', shuffle, startDateStr, now);
  const eSub = buildSubBracket(tournamentId, eveningTeams, '17:30 - 22:00', 'E', shuffle, startDateStr, now);

  if (!mSub && !eSub) return [];

  let overallMatchesByRound: Match[][] = [];
  let totalRounds = 0;

  if (mSub && eSub) {
    // Both Sub-Brackets Exist (Dual Branch)
    const maxInternalRounds = Math.max(mSub.rounds, eSub.rounds);
    const sfRoundNum = maxInternalRounds + 1;
    const finalRoundNum = maxInternalRounds + 2;
    totalRounds = finalRoundNum;

    // Construct Bridge Matches if mSub or eSub has fewer internal rounds than maxInternalRounds
    // This ensures Morning & Evening branches have symmetrical round progression (no shortcuts to Grand Final)
    const mBridgeMatches: Match[] = [];
    if (mSub.rounds < maxInternalRounds) {
      for (let r = mSub.rounds + 1; r <= maxInternalRounds; r++) {
        const roundName = `Babak Lanjutan Pagi (R${r})`;
        const bridgeMatch: Match = {
          id: `match_${tournamentId}_M_bridge_r${r}`,
          tournament_id: tournamentId,
          round_number: r,
          round_name: roundName,
          match_code: `M-BRIDGE-R${r}`,
          team1_id: null,
          team2_id: null,
          team1_name: 'TBD',
          team2_name: 'BYE',
          team1_score: null,
          team2_score: null,
          winner_id: null,
          next_match_id: null,
          next_match_slot: 1,
          status: 'scheduled',
          venue: 'Lapangan Utama',
          date: startDateStr,
          time: '23:00',
          time_slot: '23:00 - Selesai',
          updated_at: now,
        };
        mBridgeMatches.push(bridgeMatch);
      }
    }

    const eBridgeMatches: Match[] = [];
    if (eSub.rounds < maxInternalRounds) {
      for (let r = eSub.rounds + 1; r <= maxInternalRounds; r++) {
        const roundName = `Babak Lanjutan Sore (R${r})`;
        const bridgeMatch: Match = {
          id: `match_${tournamentId}_E_bridge_r${r}`,
          tournament_id: tournamentId,
          round_number: r,
          round_name: roundName,
          match_code: `E-BRIDGE-R${r}`,
          team1_id: null,
          team2_id: null,
          team1_name: 'TBD',
          team2_name: 'BYE',
          team1_score: null,
          team2_score: null,
          winner_id: null,
          next_match_id: null,
          next_match_slot: 1,
          status: 'scheduled',
          venue: 'Lapangan Utama',
          date: startDateStr,
          time: '23:00',
          time_slot: '23:00 - Selesai',
          updated_at: now,
        };
        eBridgeMatches.push(bridgeMatch);
      }
    }

    // Semifinal Matches (Round sfRoundNum)
    const sf1Match: Match = {
      id: `match_${tournamentId}_SF1`,
      tournament_id: tournamentId,
      round_number: sfRoundNum,
      round_name: 'Semifinal',
      match_code: 'SF1',
      team1_id: null,
      team2_id: null,
      team1_name: 'Pemenang Sesi Pagi',
      team2_name: 'Pemenang Match B',
      team1_score: null,
      team2_score: null,
      winner_id: null,
      next_match_id: `match_${tournamentId}_GF`,
      next_match_slot: 1,
      loser_next_match_id: `match_${tournamentId}_3rd`,
      loser_next_match_slot: 1,
      status: 'scheduled',
      venue: 'Lapangan Utama',
      date: startDateStr,
      time: '19:00',
      time_slot: '19:00 - Selesai',
      updated_at: now,
    };

    const sf2Match: Match = {
      id: `match_${tournamentId}_SF2`,
      tournament_id: tournamentId,
      round_number: sfRoundNum,
      round_name: 'Semifinal',
      match_code: 'SF2',
      team1_id: null,
      team2_id: null,
      team1_name: 'Pemenang Sesi Sore',
      team2_name: 'Pemenang Match D',
      team1_score: null,
      team2_score: null,
      winner_id: null,
      next_match_id: `match_${tournamentId}_GF`,
      next_match_slot: 2,
      loser_next_match_id: `match_${tournamentId}_3rd`,
      loser_next_match_slot: 2,
      status: 'scheduled',
      venue: 'Lapangan Utama',
      date: startDateStr,
      time: '20:30',
      time_slot: '20:30 - Selesai',
      updated_at: now,
    };

    // Grand Final Match (Round finalRoundNum)
    const grandFinalMatch: Match = {
      id: `match_${tournamentId}_GF`,
      tournament_id: tournamentId,
      round_number: finalRoundNum,
      round_name: 'Grand Final',
      match_code: 'GRAND-FINAL',
      team1_id: null,
      team2_id: null,
      team1_name: 'Pemenang Semifinal 1',
      team2_name: 'Pemenang Semifinal 2',
      team1_score: null,
      team2_score: null,
      winner_id: null,
      next_match_id: null,
      next_match_slot: null,
      status: 'scheduled',
      venue: 'Lapangan Utama',
      date: endDateStr,
      time: '19:00',
      time_slot: '19:00 - Selesai',
      updated_at: now,
    };

    // Connect Morning Branch to Semifinals (Pure Single Elimination - Loser is OUT)
    if (mBridgeMatches.length > 0) {
      if (mSub.finalMatch) {
        mSub.finalMatch.next_match_id = mBridgeMatches[0].id;
        mSub.finalMatch.next_match_slot = 1;
        mSub.finalMatch.loser_next_match_id = null;
        mSub.finalMatch.loser_next_match_slot = null;
      }
      for (let i = 0; i < mBridgeMatches.length - 1; i++) {
        mBridgeMatches[i].next_match_id = mBridgeMatches[i + 1].id;
        mBridgeMatches[i].next_match_slot = 1;
        mBridgeMatches[i].loser_next_match_id = null;
      }
      mBridgeMatches[mBridgeMatches.length - 1].next_match_id = sf1Match.id;
      mBridgeMatches[mBridgeMatches.length - 1].next_match_slot = 1;
      mBridgeMatches[mBridgeMatches.length - 1].loser_next_match_id = null;
    } else {
      if (mSub.finalMatch) {
        mSub.finalMatch.next_match_id = sf1Match.id;
        mSub.finalMatch.next_match_slot = 1;
        mSub.finalMatch.loser_next_match_id = null;
        mSub.finalMatch.loser_next_match_slot = null;
      }
    }

    // Connect Evening Branch to Semifinals (Pure Single Elimination - Loser is OUT)
    if (eBridgeMatches.length > 0) {
      if (eSub.finalMatch) {
        eSub.finalMatch.next_match_id = eBridgeMatches[0].id;
        eSub.finalMatch.next_match_slot = 1;
        eSub.finalMatch.loser_next_match_id = null;
        eSub.finalMatch.loser_next_match_slot = null;
      }
      for (let i = 0; i < eBridgeMatches.length - 1; i++) {
        eBridgeMatches[i].next_match_id = eBridgeMatches[i + 1].id;
        eBridgeMatches[i].next_match_slot = 1;
        eBridgeMatches[i].loser_next_match_id = null;
      }
      eBridgeMatches[eBridgeMatches.length - 1].next_match_id = sf2Match.id;
      eBridgeMatches[eBridgeMatches.length - 1].next_match_slot = 1;
      eBridgeMatches[eBridgeMatches.length - 1].loser_next_match_id = null;
    } else {
      if (eSub.finalMatch) {
        eSub.finalMatch.next_match_id = sf2Match.id;
        eSub.finalMatch.next_match_slot = 1;
        eSub.finalMatch.loser_next_match_id = null;
        eSub.finalMatch.loser_next_match_slot = null;
      }
    }

    // Combine matches for internal rounds (1..maxInternalRounds)
    for (let r = 1; r <= maxInternalRounds; r++) {
      const roundMatches: Match[] = [];

      if (r <= mSub.rounds) {
        const mList = mSub.matchesByRound[r - 1];
        if (mList) roundMatches.push(...mList);
      } else {
        const bMatch = mBridgeMatches.find((bm) => bm.round_number === r);
        if (bMatch) roundMatches.push(bMatch);
      }

      if (r <= eSub.rounds) {
        const eList = eSub.matchesByRound[r - 1];
        if (eList) roundMatches.push(...eList);
      } else {
        const bMatch = eBridgeMatches.find((bm) => bm.round_number === r);
        if (bMatch) roundMatches.push(bMatch);
      }

      overallMatchesByRound.push(roundMatches);
    }

    // Round sfRoundNum: Semifinal Lintas Sesi
    overallMatchesByRound.push([sf1Match, sf2Match]);

    // Round finalRoundNum: Grand Final & Perebutan Juara 3
    const finalRoundMatches: Match[] = [grandFinalMatch];

    // Perebutan Juara 3 (3rd Place Match)
    if (includeThirdPlace) {
      const thirdPlaceMatch: Match = {
        id: `match_${tournamentId}_3rd`,
        tournament_id: tournamentId,
        round_number: finalRoundNum,
        round_name: 'Perebutan Juara 3',
        match_code: '3RD-PLACE',
        team1_id: null,
        team2_id: null,
        team1_name: 'Kalah Semifinal 1',
        team2_name: 'Kalah Semifinal 2',
        team1_score: null,
        team2_score: null,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null,
        status: 'scheduled',
        venue: 'Lapangan Utama',
        date: endDateStr,
        time: '17:30',
        time_slot: '23:00 - Selesai',
        updated_at: now,
        is_third_place: true,
      };
      finalRoundMatches.push(thirdPlaceMatch);
    }

    overallMatchesByRound.push(finalRoundMatches);

  } else {
    // Single Sub-Bracket
    const singleSub = mSub || eSub!;
    totalRounds = singleSub.rounds;
    overallMatchesByRound = singleSub.matchesByRound;

    if (includeThirdPlace && totalRounds >= 2) {
      const thirdPlaceMatch: Match = {
        id: `match_${tournamentId}_3rd`,
        tournament_id: tournamentId,
        round_number: totalRounds,
        round_name: 'Perebutan Juara 3',
        match_code: '3RD-PLACE',
        team1_id: null,
        team2_id: null,
        team1_name: 'Kalah Semifinal 1',
        team2_name: 'Kalah Semifinal 2',
        team1_score: null,
        team2_score: null,
        winner_id: null,
        next_match_id: null,
        next_match_slot: null,
        status: 'scheduled',
        venue: 'Lapangan Utama',
        date: endDateStr,
        time: '17:30',
        time_slot: singleSub === mSub ? '10:00 - 15:00' : '17:30 - 22:00',
        updated_at: now,
        is_third_place: true,
      };
      overallMatchesByRound[overallMatchesByRound.length - 1].push(thirdPlaceMatch);
    }
  }

  // Multi-Day Automatic Time & Date Allocation with 30-minute intervals
  const allDates = generateDateList(startDateStr, endDateStr);
  const finalDate = allDates.length > 0 ? allDates[allDates.length - 1] : endDateStr;
  const preFinalDates = allDates.length > 1 ? allDates.slice(0, allDates.length - 1) : [startDateStr];

  const multiDayClock = new MultiDaySchedulerClock(preFinalDates, timeSlots);
  const numPreFinalRounds = Math.max(1, totalRounds - 1);
  const numPreFinalDates = preFinalDates.length;

  for (let r = 0; r < numPreFinalRounds; r++) {
    const roundMatches = overallMatchesByRound[r];
    if (!roundMatches || roundMatches.length === 0) continue;

    const startDIdx = Math.floor((r / numPreFinalRounds) * numPreFinalDates);

    roundMatches.forEach((m) => {
      let slotType: '10:00 - 15:00' | '17:30 - 22:00' | '23:00 - Selesai' = '10:00 - 15:00';
      if (m.time_slot === '17:30 - 22:00') {
        slotType = '17:30 - 22:00';
      } else if (m.time_slot === '23:00 - Selesai') {
        slotType = '23:00 - Selesai';
      } else {
        slotType = '10:00 - 15:00';
      }

      const slotAlloc = multiDayClock.allocateMatch(slotType, startDIdx);

      m.date = slotAlloc.date;
      m.time = slotAlloc.time;
      m.time_slot = slotAlloc.time_slot;
      m.venue = slotAlloc.venue;
    });
  }

  // Locked Final Day for Final matches (Grand Final & 3rd Place match)
  const finalRoundMatches = overallMatchesByRound[totalRounds - 1];
  if (finalRoundMatches && finalRoundMatches.length > 0) {
    finalRoundMatches.forEach((m) => {
      m.date = finalDate;
      m.venue = 'Lapangan Utama';
      if (m.is_third_place) {
        m.time = '17:30';
      } else {
        m.time = '19:00';
      }
    });
  }

  // Flatten matches
  const allMatches: Match[] = [];
  overallMatchesByRound.forEach((rm) => allMatches.push(...rm));

  return applyAutoProgression(allMatches);
}

export function ensureDualBranchCrossSessionLinks(matches: Match[]): Match[] {
  if (!matches || matches.length === 0) return matches;

  const matchesMap = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));
  const matchArray = Array.from(matchesMap.values());

  // Find Morning and Evening internal matches
  const morningMatches = matchArray.filter((m) => m.id.includes('_M_r'));
  const eveningMatches = matchArray.filter((m) => m.id.includes('_E_r'));

  if (morningMatches.length === 0 || eveningMatches.length === 0) {
    return matches;
  }

  // Find max internal round for Morning & Evening branches
  const maxMRound = Math.max(...morningMatches.map((m) => m.round_number));
  const maxERound = Math.max(...eveningMatches.map((m) => m.round_number));
  const maxInternalRounds = Math.max(maxMRound, maxERound);

  const mFinalMatch = morningMatches.find((m) => m.round_number === maxMRound);
  const eFinalMatch = eveningMatches.find((m) => m.round_number === maxERound);

  if (!mFinalMatch || !eFinalMatch) return matches;

  const tournamentId = mFinalMatch.tournament_id;
  const sf1Id = `match_${tournamentId}_SF1`;
  const sf2Id = `match_${tournamentId}_SF2`;
  const gfId = `match_${tournamentId}_GF`;
  const thirdId = `match_${tournamentId}_3rd`;

  let sf1Match = matchesMap.get(sf1Id);
  let sf2Match = matchesMap.get(sf2Id);
  let grandFinalMatch = matchesMap.get(gfId);
  let thirdPlaceMatch = matchesMap.get(thirdId);

  const sfRoundNum = maxInternalRounds + 1;
  const finalRoundNum = maxInternalRounds + 2;

  const internalDates = [...morningMatches, ...eveningMatches]
    .map((m) => m.date)
    .filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d));
  internalDates.sort();
  const defaultSfDate = internalDates.length > 0 ? internalDates[internalDates.length - 1] : new Date().toISOString().split('T')[0];

  // Ensure pure Single Elimination: clear any legacy loser links on internal branch finals
  mFinalMatch.loser_next_match_id = null;
  mFinalMatch.loser_next_match_slot = null;
  eFinalMatch.loser_next_match_id = null;
  eFinalMatch.loser_next_match_slot = null;

  // Create SF1 if missing
  if (!sf1Match) {
    sf1Match = {
      id: sf1Id,
      tournament_id: tournamentId,
      round_number: sfRoundNum,
      round_name: 'Semifinal',
      match_code: 'SF1',
      team1_id: null,
      team2_id: null,
      team1_name: 'Pemenang Match A',
      team2_name: 'Pemenang Match B',
      team1_score: null,
      team2_score: null,
      winner_id: null,
      next_match_id: gfId,
      next_match_slot: 1,
      loser_next_match_id: thirdId,
      loser_next_match_slot: 1,
      status: 'scheduled',
      venue: 'Lapangan Utama',
      date: defaultSfDate,
      time: '19:00',
      time_slot: '19:00 - Selesai',
      updated_at: new Date().toISOString(),
    };
    matchesMap.set(sf1Id, sf1Match);
  } else {
    sf1Match.round_number = sfRoundNum;
    sf1Match.match_code = 'SF1';
    sf1Match.round_name = 'Semifinal';
    if (!sf1Match.date || sf1Match.date < defaultSfDate) sf1Match.date = defaultSfDate;
    if (sf1Match.team1_name === 'Juara Sesi Pagi') sf1Match.team1_name = 'Pemenang Sesi Pagi';
    if (sf1Match.team2_name === 'Runner-up Sesi Sore') sf1Match.team2_name = 'Pemenang Match B';
    sf1Match.next_match_id = gfId;
    sf1Match.next_match_slot = 1;
    sf1Match.loser_next_match_id = thirdId;
    sf1Match.loser_next_match_slot = 1;
  }

  // Create SF2 if missing
  if (!sf2Match) {
    sf2Match = {
      id: sf2Id,
      tournament_id: tournamentId,
      round_number: sfRoundNum,
      round_name: 'Semifinal',
      match_code: 'SF2',
      team1_id: null,
      team2_id: null,
      team1_name: 'Pemenang Match C',
      team2_name: 'Pemenang Match D',
      team1_score: null,
      team2_score: null,
      winner_id: null,
      next_match_id: gfId,
      next_match_slot: 2,
      loser_next_match_id: thirdId,
      loser_next_match_slot: 2,
      status: 'scheduled',
      venue: 'Lapangan Utama',
      date: defaultSfDate,
      time: '20:30',
      time_slot: '20:30 - Selesai',
      updated_at: new Date().toISOString(),
    };
    matchesMap.set(sf2Id, sf2Match);
  } else {
    sf2Match.round_number = sfRoundNum;
    sf2Match.match_code = 'SF2';
    sf2Match.round_name = 'Semifinal';
    if (!sf2Match.date || sf2Match.date < defaultSfDate) sf2Match.date = defaultSfDate;
    if (sf2Match.team1_name === 'Juara Sesi Sore') sf2Match.team1_name = 'Pemenang Sesi Sore';
    if (sf2Match.team2_name === 'Runner-up Sesi Pagi') sf2Match.team2_name = 'Pemenang Match D';
    sf2Match.next_match_id = gfId;
    sf2Match.next_match_slot = 2;
    sf2Match.loser_next_match_id = thirdId;
    sf2Match.loser_next_match_slot = 2;
  }

  const sfDates = [sf1Match?.date, sf2Match?.date, defaultSfDate]
    .filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d));
  sfDates.sort();
  const defaultFinalDate = sfDates[sfDates.length - 1];

  // Update Grand Final round_number & placeholder names & dates
  if (grandFinalMatch) {
    grandFinalMatch.round_number = finalRoundNum;
    grandFinalMatch.round_name = 'Grand Final';
    if (!grandFinalMatch.date || grandFinalMatch.date < defaultFinalDate) grandFinalMatch.date = defaultFinalDate;
    if (!grandFinalMatch.team1_id && (grandFinalMatch.team1_name === 'Juara Sesi Pagi' || !grandFinalMatch.team1_name)) {
      grandFinalMatch.team1_name = 'Pemenang Semifinal 1';
    }
    if (!grandFinalMatch.team2_id && (grandFinalMatch.team2_name === 'Juara Sesi Sore' || !grandFinalMatch.team2_name)) {
      grandFinalMatch.team2_name = 'Pemenang Semifinal 2';
    }
    matchesMap.set(grandFinalMatch.id, grandFinalMatch);
  }

  if (thirdPlaceMatch) {
    thirdPlaceMatch.round_number = finalRoundNum;
    thirdPlaceMatch.round_name = 'Perebutan Juara 3';
    if (!thirdPlaceMatch.date || thirdPlaceMatch.date < defaultFinalDate) thirdPlaceMatch.date = defaultFinalDate;
    if (!thirdPlaceMatch.team1_id) thirdPlaceMatch.team1_name = 'Kalah Semifinal 1';
    if (!thirdPlaceMatch.team2_id) thirdPlaceMatch.team2_name = 'Kalah Semifinal 2';
    matchesMap.set(thirdPlaceMatch.id, thirdPlaceMatch);
  }

  // Re-link Morning internal final to SF1 (pure single elimination: winner advances, loser is OUT)
  mFinalMatch.next_match_id = sf1Id;
  mFinalMatch.next_match_slot = 1;
  mFinalMatch.loser_next_match_id = null;
  mFinalMatch.loser_next_match_slot = null;

  // Re-link Evening internal final to SF2 (pure single elimination: winner advances, loser is OUT)
  eFinalMatch.next_match_id = sf2Id;
  eFinalMatch.next_match_slot = 1;
  eFinalMatch.loser_next_match_id = null;
  eFinalMatch.loser_next_match_slot = null;

  matchesMap.set(mFinalMatch.id, mFinalMatch);
  matchesMap.set(eFinalMatch.id, eFinalMatch);

  return ensureChronologicalRoundDates(Array.from(matchesMap.values()));
}

export function ensureChronologicalRoundDates(matches: Match[]): Match[] {
  if (!matches || matches.length === 0) return matches;

  // Find all distinct round numbers sorted ascending
  const roundNumbers = Array.from(new Set(matches.map((m) => m.round_number))).sort((a, b) => a - b);

  for (let i = 0; i < roundNumbers.length - 1; i++) {
    const currentR = roundNumbers[i];
    const nextR = roundNumbers[i + 1];

    const currentMatches = matches.filter((m) => m.round_number === currentR);
    const validCurrentDates = currentMatches
      .map((m) => m.date)
      .filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d));

    if (validCurrentDates.length === 0) continue;

    validCurrentDates.sort();
    const maxCurrentDate = validCurrentDates[validCurrentDates.length - 1];

    matches.forEach((m) => {
      if (m.round_number === nextR) {
        if (!m.date || m.date < maxCurrentDate) {
          m.date = maxCurrentDate;
        }
      }
    });
  }

  // Also enforce direct feeder -> target match date constraint
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, m]));
  matches.forEach((m) => {
    if (m.next_match_id) {
      const nextM = matchMap.get(m.next_match_id);
      if (nextM && m.date && /^\d{4}-\d{2}-\d{2}$/.test(m.date)) {
        if (!nextM.date || nextM.date < m.date) {
          nextM.date = m.date;
        }
      }
    }
  });

  return matches;
}

/**
 * Propagates winners through next_match_id links.
 * Handles both completed matches with winner_id and BYE matches automatically.
 */
export function applyAutoProgression(matches: Match[]): Match[] {
  const sanitizedMatches = ensureDualBranchCrossSessionLinks(matches);
  const matchMap = new Map<string, Match>(sanitizedMatches.map((m) => [m.id, { ...m }]));

  let changed = true;
  let maxPasses = 20;

  while (changed && maxPasses > 0) {
    changed = false;
    maxPasses--;

    for (const match of matchMap.values()) {
      let winnerId: string | null = match.winner_id;
      let winnerName: string | null = null;

      if (winnerId) {
        winnerName = match.winner_id === match.team1_id ? match.team1_name : match.team2_name;
      } else if (match.status === 'bye' || match.team1_name === 'BYE' || match.team2_name === 'BYE') {
        if (match.team1_name === 'BYE' && match.team2_id && match.team2_name && match.team2_name !== 'TBD' && match.team2_name !== 'BYE') {
          winnerId = match.team2_id;
          winnerName = match.team2_name;
          match.status = 'bye';
        } else if (match.team2_name === 'BYE' && match.team1_id && match.team1_name && match.team1_name !== 'TBD' && match.team1_name !== 'BYE') {
          winnerId = match.team1_id;
          winnerName = match.team1_name;
          match.status = 'bye';
        }
      }

      if (winnerId && winnerName && match.next_match_id) {
        const nextMatch = matchMap.get(match.next_match_id);
        if (nextMatch) {
          const targetSlot = match.next_match_slot;

          let updatedNext = false;
          if (targetSlot === 1 && (nextMatch.team1_id !== winnerId || nextMatch.team1_name !== winnerName)) {
            nextMatch.team1_id = winnerId;
            nextMatch.team1_name = winnerName;
            updatedNext = true;
          } else if (targetSlot === 2 && (nextMatch.team2_id !== winnerId || nextMatch.team2_name !== winnerName)) {
            nextMatch.team2_id = winnerId;
            nextMatch.team2_name = winnerName;
            updatedNext = true;
          }

          if (updatedNext) {
            matchMap.set(nextMatch.id, nextMatch);
            changed = true;
          }
        }
      }
    }
  }

  return Array.from(matchMap.values());
}

/**
 * Safely updates score for a match, declares winner, and advances/resets downstream bracket slots.
 */
export function processMatchScoreUpdate(
  allMatches: Match[],
  targetMatchId: string,
  team1Score: number | null,
  team2Score: number | null,
  teams?: Team[],
  isWO?: boolean,
  woWinnerId?: string | null
): { updatedMatches: Match[]; winnerName: string | null; error?: string } {
  const matchesMap = new Map<string, Match>(allMatches.map((m) => [m.id, { ...m }]));
  const match = matchesMap.get(targetMatchId);

  if (!match) return { updatedMatches: allMatches, winnerName: null };

  const previousWinnerId = match.winner_id;

  // Determine potential winner/loser based on inputs
  let potentialWinnerId: string | null = null;
  let potentialWinnerName: string | null = null;
  let potentialLoserId: string | null = null;
  let potentialLoserName: string | null = null;

  if (isWO && woWinnerId) {
    if (woWinnerId === match.team1_id) {
      potentialWinnerId = match.team1_id;
      potentialWinnerName = match.team1_name;
      potentialLoserId = match.team2_id;
      potentialLoserName = match.team2_name;
    } else if (woWinnerId === match.team2_id) {
      potentialWinnerId = match.team2_id;
      potentialWinnerName = match.team2_name;
      potentialLoserId = match.team1_id;
      potentialLoserName = match.team1_name;
    }
  } else if (team1Score !== null && team2Score !== null) {
    if (team1Score > team2Score) {
      potentialWinnerId = match.team1_id;
      potentialWinnerName = match.team1_name;
      potentialLoserId = match.team2_id;
      potentialLoserName = match.team2_name;
    } else if (team2Score > team1Score) {
      potentialWinnerId = match.team2_id;
      potentialWinnerName = match.team2_name;
      potentialLoserId = match.team1_id;
      potentialLoserName = match.team1_name;
    }
  }

  // Safety Check: If winner is changing, check if downstream match is already played/in progress
  if (previousWinnerId && previousWinnerId !== potentialWinnerId) {
    if (match.next_match_id) {
      const nextMatch = matchesMap.get(match.next_match_id);
      if (nextMatch) {
        const isNextMatchPlayed =
          nextMatch.status === 'completed' ||
          nextMatch.status === 'live' ||
          (nextMatch.team1_score !== null && nextMatch.team1_score !== undefined) ||
          (nextMatch.team2_score !== null && nextMatch.team2_score !== undefined) ||
          Boolean(nextMatch.is_wo);

        if (isNextMatchPlayed) {
          return {
            updatedMatches: allMatches,
            winnerName: null,
            error: 'Tidak dapat mengubah pemenang karena pertandingan babak berikutnya sudah berjalan.'
          };
        }
      }
    }

    // Also check 3rd place match if Semifinal
    const thirdPlaceMatch = Array.from(matchesMap.values()).find((m) => m.is_third_place);
    if (thirdPlaceMatch && match.round_name === 'Semifinal') {
      const is3rdPlayed =
        thirdPlaceMatch.status === 'completed' ||
        thirdPlaceMatch.status === 'live' ||
        (thirdPlaceMatch.team1_score !== null && thirdPlaceMatch.team1_score !== undefined) ||
        (thirdPlaceMatch.team2_score !== null && thirdPlaceMatch.team2_score !== undefined) ||
        Boolean(thirdPlaceMatch.is_wo);

      if (is3rdPlayed) {
        return {
          updatedMatches: allMatches,
          winnerName: null,
          error: 'Tidak dapat mengubah pemenang karena pertandingan perebutan juara 3 sudah berjalan.'
        };
      }
    }
  }

  match.team1_score = team1Score;
  match.team2_score = team2Score;
  match.updated_at = new Date().toISOString();

  let winnerId: string | null = null;
  let winnerName: string | null = null;
  let loserId: string | null = null;
  let loserName: string | null = null;

  if (isWO && woWinnerId) {
    match.is_wo = true;
    match.wo_winner_id = woWinnerId;
    match.status = 'completed';
    winnerId = potentialWinnerId;
    winnerName = potentialWinnerName;
    loserId = potentialLoserId;
    loserName = potentialLoserName;
  } else {
    match.is_wo = false;
    match.wo_winner_id = null;

    if (team1Score !== null && team2Score !== null) {
      if (team1Score > team2Score || team2Score > team1Score) {
        winnerId = potentialWinnerId;
        winnerName = potentialWinnerName;
        loserId = potentialLoserId;
        loserName = potentialLoserName;
        match.status = 'completed';
      } else {
        // Draw (Need winner in knockout!)
        winnerId = null;
        winnerName = null;
        match.status = 'live';
      }
    } else {
      // Score cleared or reset
      winnerId = null;
      winnerName = null;
      match.status = 'scheduled';
    }
  }

  match.winner_id = winnerId;
  matchesMap.set(match.id, match);

  // Handle downstream progression or reset
  if (match.next_match_id) {
    const nextMatch = matchesMap.get(match.next_match_id);
    if (nextMatch) {
      const slot = match.next_match_slot;
      if (winnerId && winnerName) {
        if (slot === 1) {
          nextMatch.team1_id = winnerId;
          nextMatch.team1_name = winnerName;
        } else {
          nextMatch.team2_id = winnerId;
          nextMatch.team2_name = winnerName;
        }
      } else {
        // Reset slot
        if (slot === 1) {
          nextMatch.team1_id = null;
          nextMatch.team1_name = 'TBD';
        } else {
          nextMatch.team2_id = null;
          nextMatch.team2_name = 'TBD';
        }

        if (nextMatch.winner_id && previousWinnerId && nextMatch.winner_id === previousWinnerId) {
          nextMatch.winner_id = null;
          nextMatch.team1_score = null;
          nextMatch.team2_score = null;
          nextMatch.status = 'scheduled';
        }
      }
      matchesMap.set(nextMatch.id, nextMatch);
    }
  }

  // Handle downstream loser progression or reset
  if (match.loser_next_match_id) {
    const loserNextMatch = matchesMap.get(match.loser_next_match_id);
    if (loserNextMatch) {
      const slot = match.loser_next_match_slot;
      if (loserId && loserName) {
        if (slot === 1) {
          loserNextMatch.team1_id = loserId;
          loserNextMatch.team1_name = loserName;
        } else {
          loserNextMatch.team2_id = loserId;
          loserNextMatch.team2_name = loserName;
        }
      } else {
        if (slot === 1) {
          loserNextMatch.team1_id = null;
          loserNextMatch.team1_name = 'TBD';
        } else {
          loserNextMatch.team2_id = null;
          loserNextMatch.team2_name = 'TBD';
        }
      }
      matchesMap.set(loserNextMatch.id, loserNextMatch);
    }
  }

  // Handle 3rd Place Match Losers progression if this is a Semifinal or session final
  const thirdPlaceMatch = Array.from(matchesMap.values()).find((m) => m.is_third_place);
  if (thirdPlaceMatch) {
    const isMorningInternalFinal = match.round_name.includes('Pagi') || (match.id.includes('_M_r') && !match.id.includes('bridge'));
    const isEveningInternalFinal = match.round_name.includes('Sore') || (match.id.includes('_E_r') && !match.id.includes('bridge'));

    if (isMorningInternalFinal) {
      if (loserId && loserName) {
        thirdPlaceMatch.team1_id = loserId;
        thirdPlaceMatch.team1_name = loserName;
      } else {
        thirdPlaceMatch.team1_id = null;
        thirdPlaceMatch.team1_name = 'Runner-up Sesi Pagi';
      }
      matchesMap.set(thirdPlaceMatch.id, thirdPlaceMatch);
    } else if (isEveningInternalFinal) {
      if (loserId && loserName) {
        thirdPlaceMatch.team2_id = loserId;
        thirdPlaceMatch.team2_name = loserName;
      } else {
        thirdPlaceMatch.team2_id = null;
        thirdPlaceMatch.team2_name = 'Runner-up Sesi Sore';
      }
      matchesMap.set(thirdPlaceMatch.id, thirdPlaceMatch);
    } else if (match.round_name === 'Semifinal' || match.round_name.includes('Semifinal')) {
      if (loserId && loserName) {
        if (match.next_match_slot === 1) {
          thirdPlaceMatch.team1_id = loserId;
          thirdPlaceMatch.team1_name = loserName;
        } else {
          thirdPlaceMatch.team2_id = loserId;
          thirdPlaceMatch.team2_name = loserName;
        }
      } else {
        if (match.next_match_slot === 1) {
          thirdPlaceMatch.team1_id = null;
          thirdPlaceMatch.team1_name = 'Kalah Semifinal 1';
        } else {
          thirdPlaceMatch.team2_id = null;
          thirdPlaceMatch.team2_name = 'Kalah Semifinal 2';
        }
      }
      matchesMap.set(thirdPlaceMatch.id, thirdPlaceMatch);
    }
  }

  const updatedList = applyAutoProgression(Array.from(matchesMap.values()));
  return { updatedMatches: updatedList, winnerName };
}
