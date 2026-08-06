import { Match, Team, Tournament } from '../types';

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
Helper to group and pair teams by time_slot (09:00 - 15:00 vs 16:00 - 22:00)
*/
export function seedTeamsByTimeSlot(teams: Team[], shuffle = false): Team[] {
  const groups = new Map<string, Team[]>();

  teams.forEach((t) => {
    const slot = t.time_slot || '09:00 - 15:00';
    if (!groups.has(slot)) {
      groups.set(slot, []);
    }
    groups.get(slot)!.push(t);
  });

  const result: Team[] = [];

  groups.forEach((groupTeams) => {
    if (shuffle) {
      groupTeams.sort(() => Math.random() - 0.5);
    } else {
      groupTeams.sort((a, b) => (a.seed || 0) - (b.seed || 0));
    }

    for (let i = 0; i < groupTeams.length; i += 2) {
      result.push(groupTeams[i]);
      if (i + 1 < groupTeams.length) {
        result.push(groupTeams[i + 1]);
      }
    }
  });

  return result;
}

/**
 * Generates a complete knockout bracket for a tournament with Time Slot Seeding.
 */
export function generateKnockoutMatches(
  tournamentId: string,
  teams: Team[],
  includeThirdPlace = true,
  shuffle = false
): Match[] {
  if (teams.length < 2) return [];

  const orderedTeams = seedTeamsByTimeSlot(teams, shuffle);
  const bracketSize = getBracketSize(orderedTeams.length); // e.g. 8 or 16 or 32
  const totalRounds = Math.log2(bracketSize); // e.g. 3 for 8, 4 for 16

  // Pad teams with BYE entries up to bracketSize
  const paddedTeams: (Team | { id: string; name: string; time_slot?: string })[] = [...orderedTeams];
  const byeCount = bracketSize - orderedTeams.length;
  for (let i = 0; i < byeCount; i++) {
    paddedTeams.push({
      id: `bye_${i + 1}`,
      name: 'BYE',
    });
  }

  // Interleave BYE slots so seeded/top teams get BYEs cleanly
  const distributedTeams: (Team | { id: string; name: string; time_slot?: string })[] = new Array(bracketSize);
  if (byeCount > 0) {
    let teamIdx = 0;
    let byeIdx = 0;
    for (let i = 0; i < bracketSize; i++) {
      if (i % 2 === 1 && byeIdx < byeCount && teamIdx < orderedTeams.length) {
        distributedTeams[i] = { id: `bye_${byeIdx + 1}`, name: 'BYE' };
        byeIdx++;
      } else if (teamIdx < orderedTeams.length) {
        distributedTeams[i] = orderedTeams[teamIdx++];
      } else {
        distributedTeams[i] = { id: `bye_${byeIdx + 1}`, name: 'BYE' };
        byeIdx++;
      }
    }
  } else {
    for (let i = 0; i < bracketSize; i++) {
      distributedTeams[i] = orderedTeams[i];
    }
  }

  const allMatches: Match[] = [];
  const matchesByRound: Match[][] = [];

  let matchCounter = 1;
  const slotCounters = new Map<string, number>();
  const now = new Date().toISOString();

  for (let r = 1; r <= totalRounds; r++) {
    const numMatchesInRound = bracketSize / Math.pow(2, r);
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
        date: new Date().toISOString().split('T')[0],
        time: `${String(8 + matchCounter).padStart(2, '0')}:00`,
        time_slot: '09:00 - 15:00',
        updated_at: now,
      });
      matchCounter++;
    }
    matchesByRound.push(roundMatches);
  }

  // Link next_match_id and next_match_slot
  for (let r = 0; r < totalRounds - 1; r++) {
    const currentRound = matchesByRound[r];
    const nextRound = matchesByRound[r + 1];

    currentRound.forEach((m, idx) => {
      const targetMatchIdx = Math.floor(idx / 2);
      const targetSlot = (idx % 2 === 0 ? 1 : 2) as 1 | 2;
      m.next_match_id = nextRound[targetMatchIdx].id;
      m.next_match_slot = targetSlot;
    });
  }

  // Populate Round 1 Teams & Set Time Slots
  const round1 = matchesByRound[0];
  round1.forEach((match, idx) => {
    const t1 = distributedTeams[idx * 2];
    const t2 = distributedTeams[idx * 2 + 1];

    match.team1_id = t1.id;
    match.team1_name = t1.name;
    match.team2_id = t2.id;
    match.team2_name = t2.name;

    const slot1_val = (t1 as Team).time_slot || (t1.name !== 'BYE' ? '09:00 - 15:00' : undefined);
    const slot2_val = (t2 as Team).time_slot || (t2.name !== 'BYE' ? '09:00 - 15:00' : undefined);

    if (t1.name !== 'BYE' && t2.name !== 'BYE') {
      if (slot1_val && slot2_val && slot1_val === slot2_val) {
        match.time_slot = slot1_val;
        const startHourMatch = slot1_val.match(/(\d{1,2}):/);
        const baseHour = startHourMatch ? Number(startHourMatch[1]) : 9;
        const matchOffset = (slotCounters.get(slot1_val) || 0) % 6;
        slotCounters.set(slot1_val, (slotCounters.get(slot1_val) || 0) + 1);
        match.time = `${String(baseHour + matchOffset).padStart(2, '0')}:00`;
      } else {
        // Cross-slot conflict in Round 1
        match.time_slot = '23:00 - Selesai';
        match.time = '23:00';
      }
    } else {
      // One or both is BYE
      const activeSlot = slot1_val || slot2_val || '09:00 - 15:00';
      match.time_slot = activeSlot;
      const startHourMatch = activeSlot.match(/(\d{1,2}):/);
      const baseHour = startHourMatch ? Number(startHourMatch[1]) : 9;
      const matchOffset = (slotCounters.get(activeSlot) || 0) % 6;
      slotCounters.set(activeSlot, (slotCounters.get(activeSlot) || 0) + 1);
      match.time = `${String(baseHour + matchOffset).padStart(2, '0')}:00`;
    }

    // Auto Advance BYE in Round 1
    if (t1.name === 'BYE' && t2.name !== 'BYE') {
      match.winner_id = t2.id;
      match.status = 'bye';
      match.team2_score = 1;
      match.team1_score = 0;
    } else if (t2.name === 'BYE' && t1.name !== 'BYE') {
      match.winner_id = t1.id;
      match.status = 'bye';
      match.team1_score = 1;
      match.team2_score = 0;
    } else if (t1.name === 'BYE' && t2.name === 'BYE') {
      match.status = 'bye';
    }
  });

  // Flatten matches
  matchesByRound.forEach((rm) => allMatches.push(...rm));

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
      venue: 'Lapangan B',
      date: new Date().toISOString().split('T')[0],
      time: '15:00',
      time_slot: '09:00 - 15:00',
      updated_at: now,
      is_third_place: true,
    };
    allMatches.push(thirdPlaceMatch);
  }

  // Apply auto-progression & time slot conflict resolution
  return recalculateMatchTimeSlots(applyAutoProgression(allMatches), teams);
}

/**
 * Recalculates time slots and detects cross-slot conflicts for downstream matches (Semi Final, Grand Final, etc.)
 */
export function recalculateMatchTimeSlots(matches: Match[], teams: Team[]): Match[] {
  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));

  // Find feeders for each match
  const feedersMap = new Map<string, Match[]>();
  for (const m of matchMap.values()) {
    if (m.next_match_id) {
      const existing = feedersMap.get(m.next_match_id) || [];
      existing.push(m);
      feedersMap.set(m.next_match_id, existing);
    }
  }

  // Helper to get time slot set for a match node (including potential future winners)
  const getPossibleSlots = (match: Match): Set<string> => {
    const set = new Set<string>();

    // If team1 is known
    if (match.team1_id && match.team1_name !== 'TBD' && match.team1_name !== 'BYE') {
      const slot = teamMap.get(match.team1_id)?.time_slot;
      if (slot) set.add(slot);
    }
    // If team2 is known
    if (match.team2_id && match.team2_name !== 'TBD' && match.team2_name !== 'BYE') {
      const slot = teamMap.get(match.team2_id)?.time_slot;
      if (slot) set.add(slot);
    }

    // If team slot directly on match is set
    if (match.time_slot) {
      set.add(match.time_slot);
    }

    // Check upstream feeders
    const feeders = feedersMap.get(match.id) || [];
    for (const feeder of feeders) {
      const subSlots = getPossibleSlots(feeder);
      subSlots.forEach((s) => set.add(s));
    }

    return set;
  };

  // Sort matches by round_number ascending
  const sortedMatches = Array.from(matchMap.values()).sort((a, b) => a.round_number - b.round_number);

  for (const match of sortedMatches) {
    if (match.round_number === 1) continue; // Round 1 initialized already

    const feeders = feedersMap.get(match.id) || [];

    // Check actual team 1 and team 2 slots if populated
    const t1Slot = match.team1_id ? teamMap.get(match.team1_id)?.time_slot : undefined;
    const t2Slot = match.team2_id ? teamMap.get(match.team2_id)?.time_slot : undefined;

    if (t1Slot && t2Slot) {
      if (t1Slot === t2Slot) {
        match.time_slot = t1Slot;
        if (match.time === '23:00') {
          const startHourMatch = t1Slot.match(/(\d{1,2}):/);
          if (startHourMatch) {
            match.time = `${String(Math.min(22, Number(startHourMatch[1]) + 4)).padStart(2, '0')}:00`;
          } else {
            match.time = '14:00';
          }
        }
      } else {
        // Cross-Slot Conflict! (e.g. Tim Slot A vs Tim Slot B)
        match.time_slot = '23:00 - Selesai';
        match.time = '23:00';
      }
    } else if (feeders.length === 2) {
      const f1Slots = Array.from(getPossibleSlots(feeders[0]));
      const f2Slots = Array.from(getPossibleSlots(feeders[1]));

      if (
        f1Slots.includes('23:00 - Selesai') ||
        f2Slots.includes('23:00 - Selesai') ||
        (f1Slots.length === 1 && f2Slots.length === 1 && f1Slots[0] !== f2Slots[0])
      ) {
        match.time_slot = '23:00 - Selesai';
        match.time = '23:00';
      } else if (f1Slots.length === 1 && f2Slots.length === 1 && f1Slots[0] === f2Slots[0]) {
        match.time_slot = f1Slots[0];
      }
    }
  }

  return Array.from(matchMap.values());
}

/**
 * Propagates winners (including BYEs) through next_match_id links.
 */
export function applyAutoProgression(matches: Match[]): Match[] {
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));

  let changed = true;
  let maxPasses = 20;

  while (changed && maxPasses > 0) {
    changed = false;
    maxPasses--;

    for (const match of matchMap.values()) {
      if (match.winner_id && match.next_match_id) {
        const nextMatch = matchMap.get(match.next_match_id);
        if (nextMatch) {
          const winnerName = match.winner_id === match.team1_id ? match.team1_name : match.team2_name;
          const targetSlot = match.next_match_slot;

          let updatedNext = false;
          if (targetSlot === 1 && (nextMatch.team1_id !== match.winner_id || nextMatch.team1_name !== winnerName)) {
            nextMatch.team1_id = match.winner_id;
            nextMatch.team1_name = winnerName;
            updatedNext = true;
          } else if (targetSlot === 2 && (nextMatch.team2_id !== match.winner_id || nextMatch.team2_name !== winnerName)) {
            nextMatch.team2_id = match.winner_id;
            nextMatch.team2_name = winnerName;
            updatedNext = true;
          }

          // Check if nextMatch now faces a BYE or is a single BYE match
          if (nextMatch.team1_name === 'BYE' && nextMatch.team2_name !== 'BYE' && nextMatch.team2_name !== 'TBD') {
            nextMatch.winner_id = nextMatch.team2_id;
            nextMatch.status = 'bye';
            updatedNext = true;
          } else if (nextMatch.team2_name === 'BYE' && nextMatch.team1_name !== 'BYE' && nextMatch.team1_name !== 'TBD') {
            nextMatch.winner_id = nextMatch.team1_id;
            nextMatch.status = 'bye';
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

        // If next match had a winner derived from previous winner, reset it as well recursively
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

  let updatedList = applyAutoProgression(Array.from(matchesMap.values()));
  if (teams && teams.length > 0) {
    updatedList = recalculateMatchTimeSlots(updatedList, teams);
  }

  return { updatedMatches: updatedList, winnerName };
}
