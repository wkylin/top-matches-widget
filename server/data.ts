import type { MatchMarket, MatchRow, TopMatchesResponse, WsOddsOutcome } from "../src/types";

const TOTAL_MATCHES = 100000;
const LIVE_RATIO = 0.22;
export const UPDATE_BATCH_SIZE = 100000;

type Team = {
  name: string;
  shortName: string;
  abbreviation: string;
  country: string;
  countryCode: string;
  strength: number;
};

type League = {
  leagueName: string;
  eventName: string;
  countryCode: string;
  weight: number;
  kickoffPeaksUtcHours: number[];
  teams: Team[];
};

const LEAGUES: League[] = [
  {
    leagueName: "Premier League",
    eventName: "Premier League",
    countryCode: "ENG",
    weight: 0.30,
    kickoffPeaksUtcHours: [11, 14, 16, 19],
    teams: [
      { name: "Manchester City", shortName: "Man City", abbreviation: "MCI", country: "England", countryCode: "ENG", strength: 95 },
      { name: "Arsenal", shortName: "Arsenal", abbreviation: "ARS", country: "England", countryCode: "ENG", strength: 90 },
      { name: "Liverpool", shortName: "Liverpool", abbreviation: "LIV", country: "England", countryCode: "ENG", strength: 91 },
      { name: "Chelsea", shortName: "Chelsea", abbreviation: "CHE", country: "England", countryCode: "ENG", strength: 83 },
      { name: "Manchester United", shortName: "Man Utd", abbreviation: "MUN", country: "England", countryCode: "ENG", strength: 84 },
      { name: "Tottenham Hotspur", shortName: "Spurs", abbreviation: "TOT", country: "England", countryCode: "ENG", strength: 82 },
      { name: "Newcastle United", shortName: "Newcastle", abbreviation: "NEW", country: "England", countryCode: "ENG", strength: 79 },
      { name: "Aston Villa", shortName: "Villa", abbreviation: "AVL", country: "England", countryCode: "ENG", strength: 78 },
    ],
  },
  {
    leagueName: "La Liga",
    eventName: "La Liga",
    countryCode: "ESP",
    weight: 0.23,
    kickoffPeaksUtcHours: [12, 14, 17, 20],
    teams: [
      { name: "Real Madrid", shortName: "Real Madrid", abbreviation: "RMA", country: "Spain", countryCode: "ESP", strength: 95 },
      { name: "Barcelona", shortName: "Barcelona", abbreviation: "BAR", country: "Spain", countryCode: "ESP", strength: 92 },
      { name: "Atletico Madrid", shortName: "Atletico", abbreviation: "ATL", country: "Spain", countryCode: "ESP", strength: 88 },
      { name: "Sevilla", shortName: "Sevilla", abbreviation: "SEV", country: "Spain", countryCode: "ESP", strength: 78 },
      { name: "Real Sociedad", shortName: "Sociedad", abbreviation: "RSO", country: "Spain", countryCode: "ESP", strength: 81 },
      { name: "Real Betis", shortName: "Betis", abbreviation: "BET", country: "Spain", countryCode: "ESP", strength: 77 },
      { name: "Villarreal", shortName: "Villarreal", abbreviation: "VIL", country: "Spain", countryCode: "ESP", strength: 76 },
      { name: "Athletic Club", shortName: "Athletic", abbreviation: "ATH", country: "Spain", countryCode: "ESP", strength: 80 },
    ],
  },
  {
    leagueName: "Serie A",
    eventName: "Serie A",
    countryCode: "ITA",
    weight: 0.19,
    kickoffPeaksUtcHours: [11, 14, 16, 19],
    teams: [
      { name: "Inter Milan", shortName: "Inter", abbreviation: "INT", country: "Italy", countryCode: "ITA", strength: 91 },
      { name: "AC Milan", shortName: "AC Milan", abbreviation: "ACM", country: "Italy", countryCode: "ITA", strength: 85 },
      { name: "Juventus", shortName: "Juventus", abbreviation: "JUV", country: "Italy", countryCode: "ITA", strength: 87 },
      { name: "Napoli", shortName: "Napoli", abbreviation: "NAP", country: "Italy", countryCode: "ITA", strength: 84 },
      { name: "Roma", shortName: "Roma", abbreviation: "ROM", country: "Italy", countryCode: "ITA", strength: 79 },
      { name: "Atalanta", shortName: "Atalanta", abbreviation: "ATA", country: "Italy", countryCode: "ITA", strength: 82 },
      { name: "Lazio", shortName: "Lazio", abbreviation: "LAZ", country: "Italy", countryCode: "ITA", strength: 78 },
      { name: "Fiorentina", shortName: "Fiorentina", abbreviation: "FIO", country: "Italy", countryCode: "ITA", strength: 75 },
    ],
  },
  {
    leagueName: "Bundesliga",
    eventName: "Bundesliga",
    countryCode: "GER",
    weight: 0.16,
    kickoffPeaksUtcHours: [13, 14, 16, 18],
    teams: [
      { name: "Bayern Munich", shortName: "Bayern", abbreviation: "BAY", country: "Germany", countryCode: "GER", strength: 94 },
      { name: "Borussia Dortmund", shortName: "Dortmund", abbreviation: "BVB", country: "Germany", countryCode: "GER", strength: 86 },
      { name: "RB Leipzig", shortName: "Leipzig", abbreviation: "RBL", country: "Germany", countryCode: "GER", strength: 83 },
      { name: "Bayer Leverkusen", shortName: "Leverkusen", abbreviation: "B04", country: "Germany", countryCode: "GER", strength: 89 },
      { name: "Eintracht Frankfurt", shortName: "Frankfurt", abbreviation: "SGE", country: "Germany", countryCode: "GER", strength: 77 },
      { name: "Wolfsburg", shortName: "Wolfsburg", abbreviation: "WOB", country: "Germany", countryCode: "GER", strength: 72 },
      { name: "Stuttgart", shortName: "Stuttgart", abbreviation: "VFB", country: "Germany", countryCode: "GER", strength: 76 },
      { name: "Freiburg", shortName: "Freiburg", abbreviation: "SCF", country: "Germany", countryCode: "GER", strength: 73 },
    ],
  },
  {
    leagueName: "Ligue 1",
    eventName: "Ligue 1",
    countryCode: "FRA",
    weight: 0.12,
    kickoffPeaksUtcHours: [13, 16, 18, 19],
    teams: [
      { name: "Paris Saint-Germain", shortName: "PSG", abbreviation: "PSG", country: "France", countryCode: "FRA", strength: 95 },
      { name: "Marseille", shortName: "Marseille", abbreviation: "OM", country: "France", countryCode: "FRA", strength: 82 },
      { name: "Monaco", shortName: "Monaco", abbreviation: "ASM", country: "France", countryCode: "FRA", strength: 83 },
      { name: "Lille", shortName: "Lille", abbreviation: "LIL", country: "France", countryCode: "FRA", strength: 79 },
      { name: "Lyon", shortName: "Lyon", abbreviation: "OL", country: "France", countryCode: "FRA", strength: 77 },
      { name: "Nice", shortName: "Nice", abbreviation: "NIC", country: "France", countryCode: "FRA", strength: 76 },
      { name: "Lens", shortName: "Lens", abbreviation: "RCL", country: "France", countryCode: "FRA", strength: 75 },
      { name: "Rennes", shortName: "Rennes", abbreviation: "REN", country: "France", countryCode: "FRA", strength: 74 },
    ],
  },
];

const LIVE_PHASES = [
  { min: 2, max: 16, label: "1st Half" },
  { min: 17, max: 44, label: "1st Half" },
  { min: 45, max: 45, label: "Half Time" },
  { min: 46, max: 70, label: "2nd Half" },
  { min: 71, max: 88, label: "2nd Half" },
  { min: 89, max: 96, label: "Stoppage Time" },
];
const monthDayFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const kickoffFormatter = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function rand(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function weightedLeague(index: number): League {
  const roll = ((index * 37) % 1000) / 1000;
  let cumulative = 0;
  for (const league of LEAGUES) {
    cumulative += league.weight;
    if (roll <= cumulative) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

function pickTeams(league: League, index: number): { home: Team; away: Team } {
  const home = league.teams[index % league.teams.length];
  const away = league.teams[(index * 3 + 5) % league.teams.length];
  if (home.abbreviation !== away.abbreviation) return { home, away };
  return {
    home,
    away: league.teams[(index + 1) % league.teams.length],
  };
}

function computeExpectedGoals(team: Team, opponent: Team, isHome: boolean): number {
  const strengthGap = team.strength - opponent.strength;
  const homeBoost = isHome ? 0.18 : -0.08;
  return clamp(1.25 + strengthGap * 0.028 + homeBoost, 0.35, 2.95);
}

function sampleGoals(lambda: number, seed: number): number {
  const roll = ((seed * 7919) % 1000) / 1000;
  if (roll < Math.exp(-lambda)) return 0;
  if (roll < Math.exp(-lambda) + lambda * 0.28) return 1;
  if (roll < Math.exp(-lambda) + lambda * 0.53) return 2;
  if (roll < Math.exp(-lambda) + lambda * 0.69) return 3;
  return roll > 0.97 ? 5 : 4;
}

function marketSuspended(index: number): boolean {
  return index % 41 === 0;
}

function outcomeLocked(index: number, outcomeCode: string): boolean {
  return (index % 73 === 0 && outcomeCode === "X") || (index % 127 === 0 && outcomeCode === "2");
}

function kickoffOffsetForLeague(league: League, index: number, now: number): number {
  const basePeakHour = league.kickoffPeaksUtcHours[index % league.kickoffPeaksUtcHours.length];
  const dayOffset = (index % 6) * 24 * 60;
  const minuteOffset = [0, 15, 30, 45][index % 4] + randInt(-6, 8);
  const kickoff = new Date(now);
  kickoff.setUTCDate(kickoff.getUTCDate() + Math.floor(index / 900) % 5);
  kickoff.setUTCHours(basePeakHour, 0, 0, 0);
  kickoff.setUTCMinutes(minuteOffset);
  const targetTs = kickoff.getTime() + dayOffset * 60000;
  return targetTs - now;
}

function buildLiveState(index: number, home: Team, away: Team) {
  const minute = LIVE_PHASES[index % LIVE_PHASES.length];
  const minuteValue = randInt(minute.min, minute.max);
  const progress = minuteValue / 90;
  const fullHomeGoals = sampleGoals(computeExpectedGoals(home, away, true), index + 17);
  const fullAwayGoals = sampleGoals(computeExpectedGoals(away, home, false), index + 29);
  const homeScore = clamp(Math.round(fullHomeGoals * progress + ((index % 5) === 0 ? 1 : 0) * 0.1), 0, 5);
  const awayScore = clamp(Math.round(fullAwayGoals * progress), 0, 5);
  const displayStatusText = minuteValue > 90 ? `90+${minuteValue - 90}'` : `${minuteValue}'`;
  const phaseLabel = minute.label === "Half Time" ? "HT" : minute.label === "Stoppage Time" ? "LIVE" : minute.label;

  return {
    matchState: "LIVE",
    eventStatus: "live",
    statusLabel: phaseLabel,
    statusShortLabel: phaseLabel,
    displayStatusText,
    liveOdds: "LIVE",
    homeScore,
    awayScore,
    scoreText: `${homeScore}-${awayScore}`,
    scheduledOffsetMs: -(minuteValue + randInt(1, 4)) * 60000,
  };
}

function buildPrematchState(index: number, league: League, now: number) {
  const scheduledOffsetMs = kickoffOffsetForLeague(league, index, now);
  const offsetMinutes = Math.round(scheduledOffsetMs / 60000);
  const soon = offsetMinutes <= 45;
  return {
    matchState: "NOT_STARTED",
    eventStatus: "not_started",
    statusLabel: soon ? "Starting Soon" : "Scheduled",
    statusShortLabel: soon ? "SOON" : "SCH",
    displayStatusText: soon ? "Starting Soon" : "Scheduled",
    liveOdds: undefined,
    homeScore: undefined,
    awayScore: undefined,
    scoreText: undefined,
    scheduledOffsetMs,
  };
}

function formatScheduledParts(iso: string) {
  const d = new Date(iso);
  return {
    dateLabel: monthDayFormatter.format(d),
    kickoff: kickoffFormatter.format(d),
  };
}

function buildMarkets(marketId: number, index: number, home: Team, away: Team): MatchMarket[] {
  const strengthGap = (home.strength - away.strength) / 100;
  const favoriteBias = strengthGap * 2.4;
  const suspended = marketSuspended(index);
  const homeOdds = clamp(rand(1.55, 2.95) - favoriteBias, 1.16, 5.4);
  const drawOdds = clamp(rand(3.0, 4.3) + Math.abs(strengthGap) * 0.45, 2.85, 5.8);
  const awayOdds = clamp(rand(1.7, 3.3) + favoriteBias, 1.18, 6.8);

  const marketKey = `1X2-${marketId}`;
  return [
    {
      key: "1",
      label: "1",
      value: homeOdds,
      locked: suspended || outcomeLocked(index, "1"),
      outcomeId: `${marketId}-1`,
      marketKey,
    },
    {
      key: "X",
      label: "X",
      value: drawOdds,
      locked: suspended || outcomeLocked(index, "X"),
      outcomeId: `${marketId}-X`,
      marketKey,
    },
    {
      key: "2",
      label: "2",
      value: awayOdds,
      locked: suspended || outcomeLocked(index, "2"),
      outcomeId: `${marketId}-2`,
      marketKey,
    },
  ];
}

function createMatch(index: number, now: number): MatchRow {
  const league = weightedLeague(index);
  const { home, away } = pickTeams(league, index);
  const isLive = index < Math.floor(TOTAL_MATCHES * LIVE_RATIO);
  const state = isLive ? buildLiveState(index, home, away) : buildPrematchState(index, league, now);
  const marketId = 1000 + index;
  const scheduledTime = new Date(now + state.scheduledOffsetMs).toISOString();
  const scheduledParts = formatScheduledParts(scheduledTime);
  const sport = "football";
  const id = `${isLive ? "evt-live" : "evt-prem"}-${index}`;
  const eventName = `${home.name} vs ${away.name}`;
  const marketStatus = marketSuspended(index) ? "suspended" : "active";

  return {
    id,
    eventId: id,
    eventName,
    sportId: sport,
    sportCode: sport,
    categoryCode: sport,
    matchCode: id,
    dateLabel: scheduledParts.dateLabel,
    kickoff: isLive ? "Live" : scheduledParts.kickoff,
    scheduledTime,
    livePhase: state.displayStatusText,
    countryCode: league.countryCode,
    leagueName: league.leagueName,
    league: [league.countryCode, league.leagueName],
    homeTeam: home.name,
    homeTeamShort: home.shortName,
    homeTeamCode: home.abbreviation,
    awayTeam: away.name,
    awayTeamShort: away.shortName,
    awayTeamCode: away.abbreviation,
    score: state.scoreText,
    isLive,
    matchState: state.matchState,
    eventStatus: state.eventStatus,
    statusLabel: state.displayStatusText,
    marketName: "1X2",
    marketStatus,
    markets: buildMarkets(marketId, index, home, away),
    extraMarkets: 0,
  };
}

let cachedMatches: MatchRow[] | null = null;

export function getCachedMatches(): MatchRow[] {
  if (cachedMatches) return cachedMatches;

  const now = Date.now();
  const items: MatchRow[] = [];

  for (let i = 0; i < TOTAL_MATCHES; i++) {
    items.push(createMatch(i, now));
  }

  cachedMatches = items;
  return items;
}

export function getTopMatchesResponse(): TopMatchesResponse {
  const list = getCachedMatches();
  return {
    total: list.length,
    latestEventUpdatedAt: new Date().toISOString(),
    latestOddsUpdatedAt: new Date().toISOString(),
    list,
  };
}

interface OddsChangeOutcome {
  code: string | number;
  label: string;
  outcomeId: string | number;
  outcomeName: string;
  odds: number;
  active: boolean;
  locked: boolean;
  oddsTrend: "UP" | "DOWN" | "FLAT";
}

interface OddsChangeEntry {
  eventId: string;
  marketId: number;
  marketKey: string;
  marketName: string;
  status: string;
  outcomes: OddsChangeOutcome[];
}

let updateCursor = 0;

export function generateOddsChanges(batchSize = UPDATE_BATCH_SIZE): OddsChangeEntry[] {
  const matches = getCachedMatches();
  if (!matches.length) return [];

  const targetSize = Math.min(batchSize, matches.length);
  const changes: OddsChangeEntry[] = new Array(targetSize);

  for (let offset = 0; offset < targetSize; offset++) {
    const idx = (updateCursor + offset) % matches.length;

    const match = matches[idx];
    const marketKey = String(match.markets[0]?.marketKey ?? "");
    if (!match.eventId || !match.markets.length || !marketKey) {
      throw new Error(`Invalid market data at index ${idx}`);
    }

    const suspended = marketSuspended(idx) && idx % 5 === 0;
    match.marketStatus = suspended ? "suspended" : "active";
    const nextOutcomes: OddsChangeOutcome[] = match.markets.map((outcome, outcomeIndex) => {
      const oldOdds = Number(outcome.value) || rand(1.5, 4);
      const delta = (Math.random() - 0.5) * 0.34;
      const newOdds = Math.max(1.05, +(oldOdds + delta).toFixed(2));
      const trend = delta > 0.04 ? "UP" : delta < -0.04 ? "DOWN" : "FLAT";
      const code = String(outcome.key ?? "");
      const locked = suspended || outcomeLocked(idx, code);
      outcome.value = newOdds;
      outcome.locked = locked;
      outcome.trend = trend === "UP" ? "up" : trend === "DOWN" ? "down" : "stable";
      return {
        code,
        label: outcome.label ?? "",
        outcomeId: outcome.outcomeId ?? `${1000 + idx}-${outcomeIndex}`,
        outcomeName: outcome.label ?? "",
        odds: newOdds,
        active: !locked,
        locked: outcome.locked ?? false,
        oddsTrend: trend,
      };
    });

    changes[offset] = {
      eventId: match.eventId,
      marketId: 1000 + idx,
      marketKey,
      marketName: match.marketName,
      status: match.marketStatus,
      outcomes: nextOutcomes,
    };
  }

  updateCursor = (updateCursor + targetSize) % matches.length;
  return changes;
}
