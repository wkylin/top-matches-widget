export interface MatchMarket {
  key: string;
  label: string;
  value: number;
  locked?: boolean;
  trend?: "up" | "down" | "stable";
  outcomeId?: string | number;
  marketKey?: string | number;
}

export interface MatchRow {
  id: string;
  eventId?: string;
  eventName?: string;
  sportId: string;
  sportCode?: string;
  categoryCode?: string;
  matchCode?: string;
  dateLabel?: string;
  weekdayLabel?: string;
  kickoff: string;
  scheduledTime?: string;
  livePhase?: string;
  countryCode?: string;
  leagueName?: string;
  league: string[];
  homeTeam: string;
  homeTeamShort?: string;
  homeTeamCode?: string;
  awayTeam: string;
  awayTeamShort?: string;
  awayTeamCode?: string;
  score?: string;
  isLive?: boolean;
  matchState?: string;
  eventStatus?: string;
  statusLabel?: string;
  marketName: string;
  marketStatus?: string;
  markets: MatchMarket[];
  extraMarkets: number;
}

export interface TopMatchesMeta {
  total: number;
  latestEventUpdatedAt: string;
  latestOddsUpdatedAt: string;
}

export interface TopMatchesBatchStats {
  total: number;
  live: number;
  prematch: number;
  pushedAt: string;
}

// ---- API types ----

export interface TopMatchesOutcome {
  code?: string | number;
  label?: string;
  outcomeId?: string | number;
  outcomeKey?: string;
  outcomeName?: string;
  odds?: number;
  probability?: number | null;
  active?: boolean;
  locked?: boolean;
  trend?: "up" | "down" | "stable";
  oddsTrend?: "UP" | "DOWN" | "FLAT" | string;
  oddsUpdatedAt?: string;
}

export interface TopMatchesMarket {
  marketId?: number;
  marketKey?: string;
  marketName?: string;
  status?: string;
  oddsUpdatedAt?: string;
  outcomes?: TopMatchesOutcome[];
}

export interface TopMatchesTeam {
  id?: string;
  name?: string;
  shortName?: string;
  abbreviation?: string;
  country?: string;
  countryCode?: string;
}

export interface TopMatchesItem {
  eventId?: string;
  eventName?: string;
  sportName?: string;
  leagueName?: string;
  countryCode?: string;
  matchState?: string;
  eventStatus?: string;
  statusLabel?: string;
  statusShortLabel?: string;
  displayStatusText?: string;
  liveOdds?: string;
  homeScore?: number;
  awayScore?: number;
  scoreText?: string;
  scheduledTime?: string;
  homeTeam?: TopMatchesTeam;
  awayTeam?: TopMatchesTeam;
  market?: TopMatchesMarket;
}

export interface TopMatchesResponse {
  total?: number;
  latestEventUpdatedAt?: string;
  latestOddsUpdatedAt?: string;
  list?: MatchRow[];
}

// ---- WebSocket types ----

export interface WsOddsOutcome {
  code?: string | number;
  label?: string;
  outcomeId: string | number;
  outcomeName?: string;
  oddsDecimal?: number;
  odds?: number;
  active?: boolean;
  locked?: boolean;
  oddsTrend?: "UP" | "DOWN" | "FLAT" | string;
}

export interface WsSportradarOddsChange {
  eventType: "sportradar_odds_change";
  eventId: string;
  marketId?: number;
  marketKey: string;
  marketName?: string;
  status?: string;
  oddsUpdatedAt?: string;
  outcomes?: WsOddsOutcome[];
}

export interface WsSportradarOddsChangeBatch {
  type: "sportradar_odds_change_batch";
  eventType: "sportradar_odds_change_batch";
  batchSize?: number;
  pushedAt?: string;
  changes?: WsSportradarOddsChange[];
}

export type WsMessage =
  | { type: "welcome"; serverTime: number; dataRev: number }
  | { type: "heartbeat"; serverTime: number }
  | { type: "pong"; clientTime: number }
  | WsSportradarOddsChangeBatch
  | (Record<string, unknown> & { type: string });
