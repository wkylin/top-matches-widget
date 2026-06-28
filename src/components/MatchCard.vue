<template>
  <article class="card" :class="{ 'is-live': row.isLive }" @click="$emit('select', row)">
    <div class="card__top">
      <span class="card__league">{{ row.leagueName || row.league[1] || "--" }}</span>
      <span class="card__badge" :class="{ 'is-live': row.isLive }">
        {{ row.statusLabel || row.eventStatus || row.matchState || "--" }}
      </span>
    </div>

    <div class="card__teams">
      <div class="card__team">
        <strong>{{ row.homeTeam }}</strong>
        <small>{{ row.homeTeamCode || row.homeTeamShort || "--" }}</small>
      </div>
      <div class="card__score">{{ row.score || row.kickoff }}</div>
      <div class="card__team card__team--away">
        <strong>{{ row.awayTeam }}</strong>
        <small>{{ row.awayTeamCode || row.awayTeamShort || "--" }}</small>
      </div>
    </div>

    <div class="card__meta">
      <span>{{ row.countryCode || "--" }}</span>
      <span>{{ row.eventId }}</span>
    </div>

    <div class="card__odds">
      <button v-for="cell in row.markets" :key="cell.outcomeId ?? cell.key" type="button" class="odd" :class="{
        'is-selected': selected.has(cellKey(row, cell)),
        'is-up': flash[flashKey(row, cell)] === 'up',
        'is-down': flash[flashKey(row, cell)] === 'down',
      }" :disabled="!cell.value || cell.locked" @click.stop="$emit('toggle-odds', row, cell)">
        <span class="odd__label">{{ cell.label }}</span>
        <span class="odd__value">
          <template v-if="!cell.value || cell.locked">--</template>
          <template v-else>{{ cell.value.toFixed(2) }}</template>
        </span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { MatchMarket, MatchRow } from "../types";

defineProps<{
  row: MatchRow;
  selected: Set<string>;
  flash: Record<string, string | null>;
}>();

defineEmits<{
  select: [row: MatchRow];
  "toggle-odds": [row: MatchRow, market: MatchMarket];
}>();

function cellKey(row: MatchRow, m: MatchMarket): string {
  return `${row.id}|${m.key}`;
}

function flashKey(row: MatchRow, m: MatchMarket): string {
  return `${row.eventId ?? row.id}::${m.marketKey ?? ""}::${m.outcomeId ?? m.key}`;
}
</script>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 176px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, .94);
  border: 1px solid #dde5f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
  cursor: pointer;
}

.card.is-live {
  border-color: #fecaca;
  box-shadow: 0 10px 28px rgba(232, 17, 45, .12);
}

.card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card__league {
  font-size: 12px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.35;
  overflow: hidden;
}

.card__badge {
  flex: none;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e2e8f0;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
}

.card__badge.is-live {
  background: #fee2e2;
  color: #b91c1c;
}

.card__teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
  margin: 12px 0;
}

.card__team {
  min-width: 0;
}

.card__team strong {
  display: block;
  font-size: 13px;
  color: #0f172a;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
}

.card__team small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #64748b;
}

.card__team--away {
  text-align: right;
}

.card__score {
  padding: 6px 10px;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.card__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 10px;
  color: #94a3b8;
}

.card__meta span:last-child {
  text-align: right;
  word-break: break-all;
}

.card__odds {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.odd {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 52px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid transparent;
  transition: all .15s;
}

.odd:disabled {
  opacity: .45;
}

.odd__label {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
}

.odd__value {
  font-size: 14px;
  font-weight: 800;
  color: #111827;
}

.odd.is-selected {
  background: linear-gradient(135deg, #d6006e, #e8112d);
}

.odd.is-selected .odd__label,
.odd.is-selected .odd__value {
  color: #fff;
}

.odd.is-up {
  animation: flashUp .55s ease;
  background: rgba(244, 63, 94, .14);
  border-color: rgba(225, 29, 72, .28);
}

.odd.is-down {
  animation: flashDown .55s ease;
  background: rgba(34, 197, 94, .16);
  border-color: rgba(22, 163, 74, .28);
}

@keyframes flashUp {
  0% {
    background: rgba(244, 63, 94, .34);
    transform: scale(1.02);
  }

  100% {
    background: rgba(244, 63, 94, .14);
    transform: scale(1);
  }
}

@keyframes flashDown {
  0% {
    background: rgba(34, 197, 94, .34);
    transform: scale(1.02);
  }

  100% {
    background: rgba(34, 197, 94, .16);
    transform: scale(1);
  }
}
</style>
