/**
 * Performance Benchmark for 100,000 Matches
 * Tests data generation, serialization, mapping, and WS batch processing
 */
import { performance, PerformanceObserver } from "node:perf_hooks";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── Re-implement data generation locally to avoid ESM/CJS issues ──

const TOTAL_MATCHES = 100000;
const LIVE_RATIO = 0.22;
const UPDATE_BATCH_SIZE = 100000;

const LEAGUES = [
  {
    leagueName: "Premier League",
    eventName: "Premier League",
    countryCode: "ENG",
    weight: 0.3,
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

function rand(min, max) { return +(min + Math.random() * (max - min)).toFixed(2); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function weightedLeague(index) {
  const roll = ((index * 37) % 1000) / 1000;
  let cumulative = 0;
  for (const league of LEAGUES) {
    cumulative += league.weight;
    if (roll <= cumulative) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

function pickTeams(league, index) {
  const home = league.teams[index % league.teams.length];
  const away = league.teams[(index * 3 + 5) % league.teams.length];
  if (home.abbreviation !== away.abbreviation) return { home, away };
  return { home, away: league.teams[(index + 1) % league.teams.length] };
}

function computeExpectedGoals(team, opponent, isHome) {
  const strengthGap = team.strength - opponent.strength;
  const homeBoost = isHome ? 0.18 : -0.08;
  return clamp(1.25 + strengthGap * 0.028 + homeBoost, 0.35, 2.95);
}

function sampleGoals(lambda, seed) {
  const roll = ((seed * 7919) % 1000) / 1000;
  if (roll < Math.exp(-lambda)) return 0;
  if (roll < Math.exp(-lambda) + lambda * 0.28) return 1;
  if (roll < Math.exp(-lambda) + lambda * 0.53) return 2;
  if (roll < Math.exp(-lambda) + lambda * 0.69) return 3;
  return roll > 0.97 ? 5 : 4;
}

function marketSuspended(index) { return index % 41 === 0; }
function outcomeLocked(index, outcomeCode) {
  return (index % 73 === 0 && outcomeCode === "X") || (index % 127 === 0 && outcomeCode === "2");
}

function kickoffOffsetForLeague(league, index, now) {
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

function buildLiveState(index, home, away) {
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

function buildPrematchState(index, league, now) {
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

function buildMarket(marketId, index, home, away) {
  const strengthGap = (home.strength - away.strength) / 100;
  const favoriteBias = strengthGap * 2.4;
  const suspended = marketSuspended(index);
  const homeOdds = clamp(rand(1.55, 2.95) - favoriteBias, 1.16, 5.4);
  const drawOdds = clamp(rand(3.0, 4.3) + Math.abs(strengthGap) * 0.45, 2.85, 5.8);
  const awayOdds = clamp(rand(1.7, 3.3) + favoriteBias, 1.18, 6.8);
  const outcomes = [
    { code: "1", label: "1", outcomeId: `${marketId}-1`, odds: homeOdds, active: !suspended, locked: suspended || outcomeLocked(index, "1") },
    { code: "X", label: "X", outcomeId: `${marketId}-X`, odds: drawOdds, active: !suspended, locked: suspended || outcomeLocked(index, "X") },
    { code: "2", label: "2", outcomeId: `${marketId}-2`, odds: awayOdds, active: !suspended, locked: suspended || outcomeLocked(index, "2") },
  ];
  return {
    marketId,
    marketKey: `1X2-${marketId}`,
    marketName: "1X2",
    status: suspended ? "suspended" : "active",
    oddsUpdatedAt: new Date().toISOString(),
    outcomes,
  };
}

function createMatch(index, now) {
  const league = weightedLeague(index);
  const { home, away } = pickTeams(league, index);
  const isLive = index < Math.floor(TOTAL_MATCHES * LIVE_RATIO);
  const matchState = isLive ? buildLiveState(index, home, away) : buildPrematchState(index, league, now);
  const marketId = 1000 + index;
  const scheduledTime = new Date(now + matchState.scheduledOffsetMs).toISOString();
  return {
    eventId: `${isLive ? "evt-live" : "evt-prem"}-${index}`,
    eventName: `${home.name} vs ${away.name}`,
    sportName: "Football",
    leagueName: league.leagueName,
    countryCode: league.countryCode,
    matchState: matchState.matchState,
    eventStatus: matchState.eventStatus,
    statusLabel: matchState.statusLabel,
    statusShortLabel: matchState.statusShortLabel,
    displayStatusText: matchState.displayStatusText,
    liveOdds: matchState.liveOdds,
    homeScore: matchState.homeScore,
    awayScore: matchState.awayScore,
    scoreText: matchState.scoreText,
    scheduledTime,
    homeTeam: {
      id: `t-${home.abbreviation}-${index}`,
      name: home.name,
      shortName: home.shortName,
      abbreviation: home.abbreviation,
      country: home.country,
      countryCode: home.countryCode,
    },
    awayTeam: {
      id: `t-${away.abbreviation}-${index}`,
      name: away.name,
      shortName: away.shortName,
      abbreviation: away.abbreviation,
      country: away.country,
      countryCode: away.countryCode,
    },
    market: buildMarket(marketId, index, home, away),
  };
}

// ── Frontend mapItem simulation ──
function text(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function dateParts(iso) {
  const ts = text(iso) ? Date.parse(text(iso)) : NaN;
  if (Number.isNaN(ts)) return { dateLabel: "", kickoff: "--:--" };
  const d = new Date(ts);
  return {
    dateLabel: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d),
    kickoff: new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
  };
}

function isLive(item) {
  const s = text(item.matchState ?? item.eventStatus ?? item.liveOdds).toUpperCase();
  return s === "LIVE";
}

function mapItem(item) {
  const id = text(item.eventId);
  const home = text(item.homeTeam?.name);
  const away = text(item.awayTeam?.name);
  if (!id || !home || !away) return null;

  const outcomes = item.market?.outcomes ?? [];
  const markets = [];
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i];
    const v = Number(o.odds);
    if (!Number.isFinite(v) || v <= 0) continue;
    const key = text(o.code) || `out-${i}`;
    markets.push({
      key,
      label: text(o.label) || key,
      value: v,
      locked: o.locked === true || o.active === false,
      outcomeId: text(o.outcomeId ?? o.code) || key,
      marketKey: item.market?.marketKey ?? item.market?.marketId ?? "",
      trend: undefined,
    });
  }

  const dp = dateParts(item.scheduledTime);
  const live = isLive(item);
  const livePhase = text(item.displayStatusText ?? item.statusLabel ?? item.statusShortLabel);

  return {
    id,
    eventId: id,
    eventName: text(item.eventName),
    sportId: "football",
    sportCode: "football",
    categoryCode: "football",
    matchCode: id,
    dateLabel: dp.dateLabel,
    kickoff: live ? "Live" : dp.kickoff,
    scheduledTime: text(item.scheduledTime),
    livePhase,
    countryCode: text(item.countryCode ?? item.homeTeam?.countryCode ?? item.homeTeam?.country),
    leagueName: text(item.leagueName),
    league: [text(item.countryCode ?? item.homeTeam?.country), text(item.leagueName ?? item.eventName)].filter(Boolean),
    homeTeam: home,
    homeTeamShort: text(item.homeTeam?.shortName),
    homeTeamCode: text(item.homeTeam?.abbreviation),
    awayTeam: away,
    awayTeamShort: text(item.awayTeam?.shortName),
    awayTeamCode: text(item.awayTeam?.abbreviation),
    score: text(item.scoreText) || (item.homeScore != null && item.awayScore != null ? `${item.homeScore}-${item.awayScore}` : undefined),
    isLive: live,
    matchState: text(item.matchState),
    eventStatus: text(item.eventStatus),
    statusLabel: text(item.displayStatusText ?? item.statusLabel ?? item.statusShortLabel),
    marketName: text(item.market?.marketName),
    marketStatus: text(item.market?.status),
    markets,
    extraMarkets: 0,
  };
}

// ── WS odds change simulation (patchOutcome) ──
function patchOutcome(row, change, outcome) {
  const code = text(outcome.code);
  const outcomeId = text(outcome.outcomeId);
  const lookupKey = outcomeId || code;
  if (!lookupKey && !code) return null;
  const market = row.markets.find((m) => {
    const mk = String(m.marketKey ?? "");
    const oid = String(m.outcomeId ?? "");
    const key = String(m.key);
    return (
      mk === change.marketKey &&
      ((outcomeId && oid === outcomeId) || (code && key === code) || (code && oid === code) || (lookupKey && key === lookupKey))
    );
  });
  if (!market) return null;

  const nextValue = Number(outcome.odds ?? outcome.oddsDecimal ?? 0);
  if (Number.isFinite(nextValue) && nextValue > 0) market.value = nextValue;

  const locked = text(change.status).toLowerCase() === "suspended" || outcome.active === false || outcome.locked === true;
  market.locked = locked;

  const trend = text(outcome.oddsTrend).toUpperCase();
  if (trend === "UP") market.trend = "up";
  else if (trend === "DOWN") market.trend = "down";
  else if (trend === "FLAT") market.trend = "stable";

  if (trend === "UP" || trend === "DOWN") {
    const flashOutcomeKey = outcomeId || code || market.outcomeId || market.key;
    return `${row.eventId ?? row.id}::${change.marketKey}::${flashOutcomeKey}`;
  }
  return null;
}

// ── Benchmark class ──
class Benchmark {
  constructor() {
    this.results = [];
  }

  run(label, fn, iterations = 1) {
    // Warmup
    if (iterations > 1) fn();

    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p50 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)];
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

    this.results.push({ label, avg, min, max, p50, p95, p99 });
    return { avg, min, max, p50, p95, p99 };
  }

  export() {
    return this.results;
  }
}

// ── Memory tracking ──
function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
    rssMB: (mem.rss / 1024 / 1024).toFixed(2),
    externalMB: (mem.external / 1024 / 1024).toFixed(2),
  };
}

// ═══════════════════════════════════════
// RUN BENCHMARKS
// ═══════════════════════════════════════

console.log("=".repeat(70));
console.log("  TOP MATCHES PERFORMANCE BENCHMARK — 100,000 Matches");
console.log("=".repeat(70));

const bench = new Benchmark();

// ── 1. Data Generation ──
console.log("\n📦 Generating 100,000 matches...");
const memBeforeGen = getMemoryUsage();
const now = Date.now();

let matches;
bench.run("Data Generation (100K matches)", () => {
  matches = [];
  for (let i = 0; i < TOTAL_MATCHES; i++) {
    matches.push(createMatch(i, now));
  }
}, 5);

const memAfterGen = getMemoryUsage();
const liveMatches = matches.filter(m => m.matchState === "LIVE").length;
const prematchMatches = matches.length - liveMatches;
console.log(`   Live: ${liveMatches}, Prematch: ${prematchMatches}`);
console.log(`   Memory before: ${JSON.stringify(memBeforeGen)}`);
console.log(`   Memory after:  ${JSON.stringify(memAfterGen)}`);

// ── 2. JSON Serialization ──
console.log("\n📝 JSON.stringify (100K matches)...");
let jsonStr;
const jsonResult = bench.run("JSON.stringify (100K matches)", () => {
  jsonStr = JSON.stringify({ total: matches.length, list: matches });
}, 10);

const jsonSizeMB = (Buffer.byteLength(jsonStr, "utf8") / 1024 / 1024).toFixed(2);
const jsonSizeKB = (Buffer.byteLength(jsonStr, "utf8") / 1024).toFixed(2);
console.log(`   JSON size: ${jsonSizeMB} MB (${jsonSizeKB} KB)`);
console.log(`   Avg time: ${jsonResult.avg.toFixed(2)}ms`);

// ── 3. JSON.parse ──
console.log("\n📝 JSON.parse (100K matches)...");
let parsed;
bench.run("JSON.parse (100K matches)", () => {
  parsed = JSON.parse(jsonStr);
}, 10);

// ── 4. Frontend mapItem ──
console.log("\n🔀 mapItem transformation (100K → MatchRow)...");
let mappedRows;
const mapResult = bench.run("mapItem (100K items)", () => {
  mappedRows = [];
  for (const item of matches) {
    const row = mapItem(item);
    if (row) mappedRows.push(row);
  }
}, 5);

console.log(`   Mapped rows: ${mappedRows.length}`);
console.log(`   Avg per item: ${(mapResult.avg / TOTAL_MATCHES * 1000).toFixed(3)}µs`);

// ── 5. RowMap lookup ──
console.log("\n🔍 RowMap lookup (HashMap)...");
const rowMap = new Map();
for (const row of mappedRows) {
  rowMap.set(row.eventId ?? row.id, row);
}

bench.run("rowMap.get (100K lookups)", () => {
  for (let i = 0; i < TOTAL_MATCHES; i++) {
    const item = matches[i];
    rowMap.get(item.eventId);
  }
}, 5);

// ── 6. Virtual scroll slice ──
console.log("\n🖥️  Virtual scroll slice simulation...");
const CARD_HEIGHT = 188;
const OVERSCAN = 2;
const columns = 5;
const viewportHeight = 900;
const visibleRowCount = Math.ceil(viewportHeight / CARD_HEIGHT) + OVERSCAN * 2;
const totalRows = Math.ceil(mappedRows.length / columns);

bench.run("Virtual scroll compute (slice + compute)", () => {
  for (let scrollTop = 0; scrollTop < 100000; scrollTop += CARD_HEIGHT) {
    const startRow = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - OVERSCAN);
    const endRow = Math.min(totalRows, startRow + visibleRowCount);
    const startIndex = startRow * columns;
    const endIndex = Math.min(mappedRows.length, endRow * columns);
    const visible = mappedRows.slice(startIndex, endIndex);
    // simulate reactivity
    const _totalHeight = totalRows * CARD_HEIGHT;
    const _offsetY = startRow * CARD_HEIGHT;
  }
}, 5);

// ── 7. Filter by live/prematch ──
console.log("\n🏷️  Filter operations...");
bench.run("Filter LIVE (100K)", () => {
  mappedRows.filter(r => r.isLive);
}, 10);

bench.run("Filter PREMATCH (100K)", () => {
  mappedRows.filter(r => !r.isLive);
}, 10);

// ── 8. WS odds change batch: full 100K push ──
console.log("\n⚡ WebSocket odds change batch (100K updates)...");
// Simulate generating odds changes
const changes = [];
for (let offset = 0; offset < Math.min(UPDATE_BATCH_SIZE, matches.length); offset++) {
  const match = matches[offset];
  const market = match.market;
  const outcomes = market.outcomes.map((outcome, outcomeIndex) => {
    const oldOdds = Number(outcome.odds) || rand(1.5, 4);
    const delta = (Math.random() - 0.5) * 0.34;
    const newOdds = Math.max(1.05, +(oldOdds + delta).toFixed(2));
    const trend = delta > 0.04 ? "UP" : delta < -0.04 ? "DOWN" : "FLAT";
    return {
      code: outcome.code ?? "",
      label: outcome.label ?? "",
      outcomeId: outcome.outcomeId ?? `${market.marketId}-${outcome.code ?? outcomeIndex}`,
      outcomeName: outcome.label ?? "",
      odds: newOdds,
      oddsDecimal: newOdds,
      active: outcome.active ?? true,
      locked: outcome.locked ?? false,
      oddsTrend: trend,
    };
  });
  changes.push({
    eventType: "sportradar_odds_change",
    eventId: match.eventId,
    marketId: market.marketId,
    marketKey: market.marketKey,
    marketName: market.marketName,
    status: market.status,
    outcomes,
  });
}

const wsBatchJson = JSON.stringify({ type: "sportradar_odds_change_batch", changes });
const wsBatchMB = (Buffer.byteLength(wsBatchJson, "utf8") / 1024 / 1024).toFixed(2);
console.log(`   Batch JSON size: ${wsBatchMB} MB`);

bench.run("WS batch JSON.stringify", () => {
  JSON.stringify({ type: "sportradar_odds_change_batch", changes });
}, 10);

bench.run("WS batch JSON.parse", () => {
  JSON.parse(wsBatchJson);
}, 10);

// Patch all 100K rows
bench.run("patchOutcome (100K rows, 3 outcomes each)", () => {
  for (const change of changes) {
    const row = rowMap.get(change.eventId);
    if (!row) continue;
    for (const outcome of change.outcomes ?? []) {
      patchOutcome(row, change, outcome);
    }
  }
}, 3);

// ── 9. Filtered array computed ──
console.log("\n🔢 Computed arrays (Vue reactivity simulation)...");

// Simulate the filtered computed
bench.run("computed filtered(all) 100K", () => {
  const result = mappedRows;
  return result.length;
}, 50);

bench.run("computed filtered(live) 100K", () => {
  const result = mappedRows.filter(r => r.isLive);
  return result.length;
}, 50);

bench.run("computed filtered(prematch) 100K", () => {
  const result = mappedRows.filter(r => !r.isLive);
  return result.length;
}, 50);

// ── 10. Column count calc ──
console.log("\n📐 Layout calculations...");
bench.run("columnCount calc (1000 iterations)", () => {
  for (let w = 320; w <= 2560; w += 2) {
    const usableWidth = Math.max(320, w - 24);
    const cols = Math.max(1, Math.floor((usableWidth + 12) / (240 + 12)));
  }
}, 10);

// ═══════════════════════════════════════
// OUTPUT RESULTS
// ═══════════════════════════════════════

console.log("\n\n" + "=".repeat(70));
console.log("  BENCHMARK RESULTS");
console.log("=".repeat(70));

const results = bench.export();

// Table format
console.log("\n" + "─".repeat(100));
console.log(
  "  " +
  "Operation".padEnd(48) +
  "Avg (ms)".padStart(12) +
  "Min (ms)".padStart(12) +
  "Max (ms)".padStart(12) +
  "P95 (ms)".padStart(12)
);
console.log("─".repeat(100));

for (const r of results) {
  console.log(
    "  " +
    r.label.padEnd(48) +
    r.avg.toFixed(2).padStart(12) +
    r.min.toFixed(2).padStart(12) +
    r.max.toFixed(2).padStart(12) +
    r.p95.toFixed(2).padStart(12)
  );
}
console.log("─".repeat(100));

// ── SIZES SUMMARY ──
console.log("\n" + "=".repeat(70));
console.log("  DATA SIZE SUMMARY");
console.log("=".repeat(70));

// Estimate sizes
const singleMatchJson = JSON.stringify(matches[0]);
const singleMatchBytes = Buffer.byteLength(singleMatchJson, "utf8");
console.log(`  Single match JSON size:      ${singleMatchBytes} bytes (${(singleMatchBytes/1024).toFixed(2)} KB)`);
console.log(`  100K matches JSON size:      ${jsonSizeMB} MB (${jsonSizeKB} KB)`);
console.log(`  WS batch (100K changes):     ${wsBatchMB} MB`);
console.log(`  Avg bytes per match:         ${(Buffer.byteLength(jsonStr, "utf8") / TOTAL_MATCHES).toFixed(1)} bytes`);

console.log("\n  Memory Usage:");
console.log(`    Before generation:  Heap ${memBeforeGen.heapUsedMB}MB, RSS ${memBeforeGen.rssMB}MB`);
console.log(`    After generation:   Heap ${memAfterGen.heapUsedMB}MB, RSS ${memAfterGen.rssMB}MB`);
console.log(`    Delta:              Heap ${(Number(memAfterGen.heapUsedMB) - Number(memBeforeGen.heapUsedMB)).toFixed(2)}MB, RSS ${(Number(memAfterGen.rssMB) - Number(memBeforeGen.rssMB)).toFixed(2)}MB`);

// Write JSON results for visualization
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public");
mkdirSync(outDir, { recursive: true });

const exportData = {
  timestamp: new Date().toISOString(),
  config: { totalMatches: TOTAL_MATCHES, liveRatio: LIVE_RATIO, batchSize: UPDATE_BATCH_SIZE },
  memory: { before: memBeforeGen, after: memAfterGen },
  sizes: {
    singleMatchBytes,
    totalJsonMB: jsonSizeMB,
    totalJsonKB: jsonSizeKB,
    wsBatchMB,
  },
  results,
};

writeFileSync(join(outDir, "benchmark-results.json"), JSON.stringify(exportData, null, 2));
console.log(`\n✅ Results written to public/benchmark-results.json`);
console.log(`📍 Snapshot time: ${new Date(exportData.timestamp).toLocaleString("zh-CN")}`);
console.log(`📄 File: ${join(outDir, "benchmark-results.json")}`);
console.log(`🔄 Refresh the 性能分析 page to see the latest benchmark snapshot.\n`);
