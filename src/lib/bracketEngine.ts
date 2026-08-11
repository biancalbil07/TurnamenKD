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
 * Helper to group and pair teams by time_slot preference for Round 1 (Pagi vs Pagi, Sore vs Sore)
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

  const byeTeams = [...morningBYETeams, ...eveningBYETeams];
  const r1Teams = [...morningR1Teams, ...eveningR1Teams];
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
 * Multi-Day Scheduler Clock for Match Scheduling
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
            state.mTime += 0.5;
          }

          const h = Math.floor(decimalTime) % 24;
          const m = Math.round((decimalTime - Math.floor(decimalTime)) * 60);
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          return { date: dStr, time: timeStr, time_slot: this.morningSlotLabel, venue };
        }
        dIdx++;
      }
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

/**
 * Generates a UNIFIED SINGLE ELIMINATION knockout bracket:
 * - Babak 1 (Penyisihan): Shift kerja / time_slot seeding (Pagi vs Pagi, Sore vs Sore)
 * - Babak 2 Ke Atas: MERGE otomatis menjadi SATU BAGAN GUGUR TUNGGAL
 * - Pure single elimination: Loser eliminated immediately; winner advances via next_match_id
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

  const now = new Date().toISOString();
  const numTeams = teams.length;
  const bracketSize = getBracketSize(numTeams);
  const totalRounds = Math.log2(bracketSize);
  const totalByeCount = bracketSize - numTeams;

  // Seed teams (Morning vs Morning, Evening vs Evening for Round 1)
  const { orderedTeams, byeTeams, r1Teams } = seedTeamsByTimeSlot(teams, shuffle, totalByeCount);

  const r1MatchCount = Math.floor(r1Teams.length / 2);
  const matchesByRound: Match[][] = [];

  // 1. Build blank matches for each round
  for (let r = 1; r <= totalRounds; r++) {
    let numMatchesInRound = 0;
    if (r === 1) {
      numMatchesInRound = r1MatchCount;
    } else {
      numMatchesInRound = bracketSize / Math.pow(2, r);
    }

    const roundMatches: Match[] = [];
    for (let i = 0; i < numMatchesInRound; i++) {
      const matchId = `match_${tournamentId}_r${r}_m${i + 1}`;
      let code = `R${r}-M${i + 1}`;
      if (r === totalRounds) {
        code = 'FINAL';
      } else if (r === totalRounds - 1 && totalRounds >= 2) {
        code = `SF${i + 1}`;
      } else if (r === totalRounds - 2 && totalRounds >= 3) {
        code = `QF${i + 1}`;
      }

      const roundName = getRoundName(r, totalRounds);

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
        loser_next_match_id: null,
        loser_next_match_slot: null,
        status: 'scheduled',
        venue: 'Lapangan A',
        date: startDateStr,
        time: '10:00',
        time_slot: '10:00 - 15:00',
        updated_at: now,
      });
    }
    matchesByRound.push(roundMatches);
  }

  // 2. Populate Round 1 matches
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
      match.time_slot = isMorningSlot(t1.time_slot) ? '10:00 - 15:00' : '17:30 - 22:00';
    }
  }

  // 3. Link Round 1 -> Round 2 and assign BYE teams directly to Round 2 slots
  if (totalRounds >= 2) {
    const halfR2Slots = bracketSize / 2;
    const feederOrder = getFeederOrder(halfR2Slots);
    const round2Matches = matchesByRound[1] || [];

    let byeIdx = 0;
    let r1Idx = 0;

    feederOrder.forEach((slotIndex, orderPos) => {
      const targetMatchIdx = Math.floor(slotIndex / 2);
      const targetSlot = (slotIndex % 2 === 0 ? 1 : 2) as 1 | 2;
      const r2Match = round2Matches[targetMatchIdx];

      if (orderPos < byeTeams.length) {
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

    // Link Round 2+ -> Next Round
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

  // 4. Semifinals -> Final & 3rd Place Match
  if (totalRounds >= 2) {
    const sfRound = matchesByRound[totalRounds - 2];
    const finalRound = matchesByRound[totalRounds - 1];
    const grandFinalMatch = finalRound[0];

    if (sfRound && sfRound.length >= 2 && grandFinalMatch) {
      const sf1 = sfRound[0];
      const sf2 = sfRound[1];

      sf1.next_match_id = grandFinalMatch.id;
      sf1.next_match_slot = 1;
      sf2.next_match_id = grandFinalMatch.id;
      sf2.next_match_slot = 2;

      if (includeThirdPlace) {
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
          loser_next_match_id: null,
          loser_next_match_slot: null,
          status: 'scheduled',
          venue: 'Lapangan Utama',
          date: endDateStr,
          time: '17:30',
          time_slot: '17:30 - 22:00',
          updated_at: now,
          is_third_place: true,
        };

        sf1.loser_next_match_id = thirdPlaceMatch.id;
        sf1.loser_next_match_slot = 1;
        sf2.loser_next_match_id = thirdPlaceMatch.id;
        sf2.loser_next_match_slot = 2;

        finalRound.push(thirdPlaceMatch);
      }
    }
  } else if (includeThirdPlace && totalRounds === 1) {
    // Small 2-3 team tournament fallback
  }

  // 5. Automatic Time & Date Schedule Allocation
  const allDates = generateDateList(startDateStr, endDateStr);
  const finalDate = allDates.length > 0 ? allDates[allDates.length - 1] : endDateStr;
  const preFinalDates = allDates.length > 1 ? allDates.slice(0, allDates.length - 1) : [startDateStr];

  const multiDayClock = new MultiDaySchedulerClock(preFinalDates, timeSlots);
  const numPreFinalRounds = Math.max(1, totalRounds - 1);
  const numPreFinalDates = preFinalDates.length;

  for (let r = 0; r < numPreFinalRounds; r++) {
    const roundMatches = matchesByRound[r];
    if (!roundMatches || roundMatches.length === 0) continue;

    const startDIdx = Math.floor((r / numPreFinalRounds) * numPreFinalDates);

    roundMatches.forEach((m) => {
      let slotType: '10:00 - 15:00' | '17:30 - 22:00' | '23:00 - Selesai' = '10:00 - 15:00';
      if (m.time_slot === '17:30 - 22:00') {
        slotType = '17:30 - 22:00';
      } else if (m.time_slot === '23:00 - Selesai') {
        slotType = '23:00 - Selesai';
      }

      const slotAlloc = multiDayClock.allocateMatch(slotType, startDIdx);
      m.date = slotAlloc.date;
      m.time = slotAlloc.time;
      m.time_slot = slotAlloc.time_slot;
      m.venue = slotAlloc.venue;
    });
  }

  // Final Day Schedule
  const finalRoundMatches = matchesByRound[totalRounds - 1];
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
  matchesByRound.forEach((rm) => allMatches.push(...rm));

  return applyAutoProgression(allMatches);
}

export function ensureDualBranchCrossSessionLinks(matches: Match[]): Match[] {
  if (!matches || matches.length === 0) return matches;
  return ensureChronologicalRoundDates(applyAutoProgression(matches));
}

export function ensureChronologicalRoundDates(matches: Match[]): Match[] {
  if (!matches || matches.length === 0) return matches;

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
 * Propagates winners & losers through next_match_id & loser_next_match_id links.
 * Handles both completed matches and BYE matches automatically.
 */
export function applyAutoProgression(matches: Match[]): Match[] {
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));

  let changed = true;
  let maxPasses = 20;

  while (changed && maxPasses > 0) {
    changed = false;
    maxPasses--;

    for (const match of matchMap.values()) {
      let winnerId: string | null = match.winner_id;
      let winnerName: string | null = null;
      let loserId: string | null = null;
      let loserName: string | null = null;

      if (winnerId) {
        if (winnerId === match.team1_id) {
          winnerName = match.team1_name;
          loserId = match.team2_id;
          loserName = match.team2_name;
        } else if (winnerId === match.team2_id) {
          winnerName = match.team2_name;
          loserId = match.team1_id;
          loserName = match.team1_name;
        }
      } else if (match.status === 'bye' || match.team1_name === 'BYE' || match.team2_name === 'BYE') {
        if ((match.team1_name === 'BYE' || !match.team1_id) && match.team2_id && match.team2_name && match.team2_name !== 'TBD' && match.team2_name !== 'BYE') {
          winnerId = match.team2_id;
          winnerName = match.team2_name;
          match.status = 'bye';
        } else if ((match.team2_name === 'BYE' || !match.team2_id) && match.team1_id && match.team1_name && match.team1_name !== 'TBD' && match.team1_name !== 'BYE') {
          winnerId = match.team1_id;
          winnerName = match.team1_name;
          match.status = 'bye';
        }
      }

      // 1. Advance Winner to next_match_id
      if (winnerId && winnerName && match.next_match_id) {
        const nextMatch = matchMap.get(match.next_match_id);
        if (nextMatch) {
          const targetSlot = match.next_match_slot || 1;
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

      // 2. Advance Loser to loser_next_match_id (e.g. 3rd Place match)
      if (loserId && loserName && match.loser_next_match_id) {
        const loserNextMatch = matchMap.get(match.loser_next_match_id);
        if (loserNextMatch) {
          const targetSlot = match.loser_next_match_slot || 1;
          let updatedLoserNext = false;

          if (targetSlot === 1 && (loserNextMatch.team1_id !== loserId || loserNextMatch.team1_name !== loserName)) {
            loserNextMatch.team1_id = loserId;
            loserNextMatch.team1_name = loserName;
            updatedLoserNext = true;
          } else if (targetSlot === 2 && (loserNextMatch.team2_id !== loserId || loserNextMatch.team2_name !== loserName)) {
            loserNextMatch.team2_id = loserId;
            loserNextMatch.team2_name = loserName;
            updatedLoserNext = true;
          }

          if (updatedLoserNext) {
            matchMap.set(loserNextMatch.id, loserNextMatch);
            changed = true;
          }
        }
      }
    }
  }

  return Array.from(matchMap.values());
}

/**
 * Score Submission & Winner Advancement Handler
 * 1. SIMPAN SKOR & SET PEMENANG:
 *    - Izinkan input skor/pilih pemenang untuk SEMUA match.
 *    - Saat disubmit: simpan team1_score & team2_score, set winner_id, set status = 'completed'.
 * 2. OPER PEMENANG TANPA FILTER (UPDATE NEXT MATCH):
 *    - Ambil next_match_id dari match saat ini.
 *    - Update slot target di match tujuan (team1_id or team2_id).
 * 3. REFRESH STATE:
 *    - Invalidate / update state agar tim pemenang langsung muncul di slot babak selanjutnya.
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
    if (woWinnerId === match.team1_id) {
      winnerId = match.team1_id;
      winnerName = match.team1_name;
      loserId = match.team2_id;
      loserName = match.team2_name;
    } else if (woWinnerId === match.team2_id) {
      winnerId = match.team2_id;
      winnerName = match.team2_name;
      loserId = match.team1_id;
      loserName = match.team1_name;
    }
  } else {
    match.is_wo = false;
    match.wo_winner_id = null;

    if (team1Score !== null && team2Score !== null) {
      if (team1Score > team2Score) {
        winnerId = match.team1_id;
        winnerName = match.team1_name;
        loserId = match.team2_id;
        loserName = match.team2_name;
        match.status = 'completed';
      } else if (team2Score > team1Score) {
        winnerId = match.team2_id;
        winnerName = match.team2_name;
        loserId = match.team1_id;
        loserName = match.team1_name;
        match.status = 'completed';
      } else {
        // Draw score entered
        winnerId = null;
        winnerName = null;
        match.status = 'completed';
      }
    } else {
      // Reset score
      winnerId = null;
      winnerName = null;
      match.status = 'scheduled';
    }
  }

  match.winner_id = winnerId;
  matchesMap.set(match.id, match);

  // 1. Pass winner to next_match_id
  if (match.next_match_id) {
    const nextMatch = matchesMap.get(match.next_match_id);
    if (nextMatch) {
      const slot = match.next_match_slot;
      if (winnerId && winnerName) {
        if (slot === 1) {
          nextMatch.team1_id = winnerId;
          nextMatch.team1_name = winnerName;
        } else if (slot === 2) {
          nextMatch.team2_id = winnerId;
          nextMatch.team2_name = winnerName;
        } else {
          if (!nextMatch.team1_id || nextMatch.team1_id === winnerId || nextMatch.team1_name === 'TBD') {
            nextMatch.team1_id = winnerId;
            nextMatch.team1_name = winnerName;
          } else {
            nextMatch.team2_id = winnerId;
            nextMatch.team2_name = winnerName;
          }
        }
      } else {
        if (slot === 1) {
          nextMatch.team1_id = null;
          nextMatch.team1_name = 'TBD';
        } else if (slot === 2) {
          nextMatch.team2_id = null;
          nextMatch.team2_name = 'TBD';
        }
      }
      matchesMap.set(nextMatch.id, nextMatch);
    }
  }

  // 2. Pass loser to loser_next_match_id
  if (match.loser_next_match_id) {
    const loserNextMatch = matchesMap.get(match.loser_next_match_id);
    if (loserNextMatch) {
      const slot = match.loser_next_match_slot;
      if (loserId && loserName) {
        if (slot === 1) {
          loserNextMatch.team1_id = loserId;
          loserNextMatch.team1_name = loserName;
        } else if (slot === 2) {
          loserNextMatch.team2_id = loserId;
          loserNextMatch.team2_name = loserName;
        } else {
          if (!loserNextMatch.team1_id || loserNextMatch.team1_id === loserId || loserNextMatch.team1_name === 'TBD') {
            loserNextMatch.team1_id = loserId;
            loserNextMatch.team1_name = loserName;
          } else {
            loserNextMatch.team2_id = loserId;
            loserNextMatch.team2_name = loserName;
          }
        }
      } else {
        if (slot === 1) {
          loserNextMatch.team1_id = null;
          loserNextMatch.team1_name = 'TBD';
        } else if (slot === 2) {
          loserNextMatch.team2_id = null;
          loserNextMatch.team2_name = 'TBD';
        }
      }
      matchesMap.set(loserNextMatch.id, loserNextMatch);
    }
  }

  // Full progression pass
  const updatedList = applyAutoProgression(Array.from(matchesMap.values()));
  return { updatedMatches: updatedList, winnerName };
}
