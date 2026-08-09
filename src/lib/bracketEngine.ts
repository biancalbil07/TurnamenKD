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

/**
 * Generates a complete knockout bracket with Dual-Branch Architecture (Cabang Pagi & Cabang Sore):
 * 1. Morning Branch (Top Half) contains ONLY Morning teams.
 * 2. Evening Branch (Bottom Half) contains ONLY Evening teams.
 * 3. Morning BYEs stay strictly in Morning Branch; Evening BYEs stay strictly in Evening Branch.
 * 4. Internal branch matches run sequentially at 30-minute intervals.
 * 5. Morning Winner and Evening Winner meet in Cross-Branch rounds (e.g. Grand Final) at flexible slot (23:00 - Selesai).
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

  const sortFn = (a: Team, b: Team) => (a.seed || 0) - (b.seed || 0);

  if (shuffle) {
    morningTeams.sort(() => Math.random() - 0.5);
    eveningTeams.sort(() => Math.random() - 0.5);
  } else {
    morningTeams.sort(sortFn);
    eveningTeams.sort(sortFn);
  }

  const numM = morningTeams.length;
  const numE = eveningTeams.length;

  let branchSize = 0;
  if (numM > 0 && numE > 0) {
    branchSize = Math.max(2, getBracketSize(numM), getBracketSize(numE));
  } else if (numM > 0) {
    branchSize = getBracketSize(numM);
  } else if (numE > 0) {
    branchSize = getBracketSize(numE);
  } else {
    return [];
  }

  const isDualBranch = numM > 0 && numE > 0;
  const bracketSize = isDualBranch ? branchSize * 2 : branchSize;
  const totalRounds = Math.log2(bracketSize);
  const branchRounds = Math.log2(branchSize);

  // Internal session BYE counts
  const mByeCount = numM > 0 ? branchSize - numM : 0;
  const eByeCount = numE > 0 ? branchSize - numE : 0;

  const morningBYETeams = morningTeams.slice(0, mByeCount);
  const morningR1Teams = morningTeams.slice(mByeCount);

  const eveningBYETeams = eveningTeams.slice(0, eByeCount);
  const eveningR1Teams = eveningTeams.slice(eByeCount);

  const mR1MatchCount = Math.floor(morningR1Teams.length / 2);
  const eR1MatchCount = Math.floor(eveningR1Teams.length / 2);

  const allMatches: Match[] = [];
  const matchesByRound: Match[][] = [];
  const now = new Date().toISOString();

  // Initialize empty match structures round by round
  for (let r = 1; r <= totalRounds; r++) {
    let numMatchesInRound = 0;
    if (r === 1) {
      if (isDualBranch) {
        numMatchesInRound = mR1MatchCount + eR1MatchCount;
      } else if (numM > 0) {
        numMatchesInRound = mR1MatchCount;
      } else {
        numMatchesInRound = eR1MatchCount;
      }
    } else {
      numMatchesInRound = bracketSize / Math.pow(2, r);
    }

    const roundMatches: Match[] = [];
    for (let i = 0; i < numMatchesInRound; i++) {
      const matchId = `match_${tournamentId}_r${r}_m${i + 1}`;
      const code = `R${r}-M${i + 1}`;
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

  // Populate Round 1 & Round 2 Feeder Structure
  const round1 = matchesByRound[0] || [];

  if (isDualBranch) {
    // 1. Fill Morning R1 matches (Top Half)
    for (let i = 0; i < mR1MatchCount; i++) {
      const match = round1[i];
      const t1 = morningR1Teams[i * 2];
      const t2 = morningR1Teams[i * 2 + 1];
      if (match && t1 && t2) {
        match.team1_id = t1.id;
        match.team1_name = t1.name;
        match.team2_id = t2.id;
        match.team2_name = t2.name;
        match.time_slot = '10:00 - 15:00';
      }
    }

    // 2. Fill Evening R1 matches (Bottom Half)
    for (let i = 0; i < eR1MatchCount; i++) {
      const match = round1[mR1MatchCount + i];
      const t1 = eveningR1Teams[i * 2];
      const t2 = eveningR1Teams[i * 2 + 1];
      if (match && t1 && t2) {
        match.team1_id = t1.id;
        match.team1_name = t1.name;
        match.team2_id = t2.id;
        match.team2_name = t2.name;
        match.time_slot = '17:30 - 22:00';
      }
    }

    // Map Round 2 Feeder slots
    const halfR2Slots = branchSize / 2;
    const feederOrder = getFeederOrder(halfR2Slots);
    const round2Matches = matchesByRound[1] || [];

    // Morning Branch R2 Seeding (Top Half)
    let mByeIdx = 0;
    let mR1Idx = 0;
    feederOrder.forEach((slotIndex, orderPos) => {
      const targetMatchIdx = Math.floor(slotIndex / 2);
      const targetSlot = (slotIndex % 2 === 0 ? 1 : 2) as 1 | 2;
      const r2Match = round2Matches[targetMatchIdx];

      if (orderPos < mByeCount) {
        const byeTeam = morningBYETeams[mByeIdx++];
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
        if (mR1Idx < mR1MatchCount) {
          const r1Match = round1[mR1Idx++];
          if (r1Match && r2Match) {
            r1Match.next_match_id = r2Match.id;
            r1Match.next_match_slot = targetSlot;
          }
        }
      }
    });

    // Evening Branch R2 Seeding (Bottom Half)
    let eByeIdx = 0;
    let eR1Idx = 0;
    feederOrder.forEach((slotIndex, orderPos) => {
      const targetMatchIdx = Math.floor(halfR2Slots / 2) + Math.floor(slotIndex / 2);
      const targetSlot = (slotIndex % 2 === 0 ? 1 : 2) as 1 | 2;
      const r2Match = round2Matches[targetMatchIdx];

      if (orderPos < eByeCount) {
        const byeTeam = eveningBYETeams[eByeIdx++];
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
        if (eR1Idx < eR1MatchCount) {
          const r1Match = round1[mR1MatchCount + eR1Idx++];
          if (r1Match && r2Match) {
            r1Match.next_match_id = r2Match.id;
            r1Match.next_match_slot = targetSlot;
          }
        }
      }
    });

    // Standard next_match links for Round 2 onwards
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
  } else {
    // Single Branch (Only Morning or Only Evening)
    const singleTeams = numM > 0 ? morningTeams : eveningTeams;
    const byeCount = singleTeams.length > 0 ? branchSize - singleTeams.length : 0;
    const byeTeams = singleTeams.slice(0, byeCount);
    const r1Teams = singleTeams.slice(byeCount);

    if (byeCount === 0) {
      round1.forEach((match, idx) => {
        const t1 = r1Teams[idx * 2];
        const t2 = r1Teams[idx * 2 + 1];
        if (t1 && t2) {
          match.team1_id = t1.id;
          match.team1_name = t1.name;
          match.team2_id = t2.id;
          match.team2_name = t2.name;
          match.time_slot = isMorningSlot(t1.time_slot) ? '10:00 - 15:00' : '17:30 - 22:00';
        }
      });

      for (let r = 0; r < totalRounds - 1; r++) {
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
    } else {
      round1.forEach((match, idx) => {
        const t1 = r1Teams[idx * 2];
        const t2 = r1Teams[idx * 2 + 1];
        if (t1 && t2) {
          match.team1_id = t1.id;
          match.team1_name = t1.name;
          match.team2_id = t2.id;
          match.team2_name = t2.name;
          match.time_slot = isMorningSlot(t1.time_slot) ? '10:00 - 15:00' : '17:30 - 22:00';
        }
      });

      const totalR2Slots = branchSize / 2;
      const feederOrder = getFeederOrder(totalR2Slots);
      const round2Matches = matchesByRound[1] || [];

      let byeTeamIdx = 0;
      let r1MatchIdx = 0;

      feederOrder.forEach((slotIndex, orderPos) => {
        const targetMatchIdx = Math.floor(slotIndex / 2);
        const targetSlot = (slotIndex % 2 === 0 ? 1 : 2) as 1 | 2;
        const r2Match = round2Matches[targetMatchIdx];

        if (orderPos < byeCount) {
          const byeTeam = byeTeams[byeTeamIdx++];
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
          if (r1MatchIdx < round1.length) {
            const r1Match = round1[r1MatchIdx++];
            if (r1Match && r2Match) {
              r1Match.next_match_id = r2Match.id;
              r1Match.next_match_slot = targetSlot;
            }
          }
        }
      });

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
  }

  // Assign session time_slots for matches
  for (let r = 0; r < totalRounds; r++) {
    const currentRoundMatches = matchesByRound[r];
    const numInRound = currentRoundMatches.length;

    currentRoundMatches.forEach((match, idx) => {
      if (isDualBranch) {
        if (r + 1 > branchRounds) {
          match.time_slot = '23:00 - Selesai';
        } else {
          const isTopHalf = idx < numInRound / 2;
          match.time_slot = isTopHalf ? '10:00 - 15:00' : '17:30 - 22:00';
        }
      } else {
        if (numM > 0) {
          match.time_slot = '10:00 - 15:00';
        } else {
          match.time_slot = '17:30 - 22:00';
        }
      }
    });
  }

  // Multi-Day Automatic Time & Date Allocation with 30-minute intervals
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

  // Locked Final Day for FINAL match
  const finalMatch = matchesByRound[totalRounds - 1]?.[0];
  if (finalMatch) {
    finalMatch.date = finalDate;
    finalMatch.time = '19:00';
    finalMatch.time_slot = isDualBranch ? '23:00 - Selesai' : numM > 0 ? '10:00 - 15:00' : '17:30 - 22:00';
    finalMatch.venue = 'Lapangan Utama';
  }

  // Add 3rd Place match if enabled and totalRounds >= 2
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
      date: finalDate,
      time: '17:30',
      time_slot: '17:30 - 22:00',
      updated_at: now,
      is_third_place: true,
    };
    matchesByRound[matchesByRound.length - 1].push(thirdPlaceMatch);
  }

  // Flatten matches
  matchesByRound.forEach((rm) => allMatches.push(...rm));

  return applyAutoProgression(allMatches);
}

/**
 * Propagates winners through next_match_id links.
 * Handles both completed matches with winner_id and BYE matches automatically.
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
  teams?: Team[]
): { updatedMatches: Match[]; winnerName: string | null } {
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

  const previousWinnerId = match.winner_id;
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

  // Handle 3rd Place Match Losers progression if this is a Semifinal
  const thirdPlaceMatch = Array.from(matchesMap.values()).find((m) => m.is_third_place);
  if (thirdPlaceMatch && match.round_name === 'Semifinal') {
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

  const updatedList = applyAutoProgression(Array.from(matchesMap.values()));
  return { updatedMatches: updatedList, winnerName };
}
