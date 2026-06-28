<template>
  <div class="app">
    <nav class="app__nav">
      <button v-for="tab in tabs" :key="tab.id" class="app__tab" :class="{ 'is-active': activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </nav>

    <TopMatches v-if="activeTab === 'matches'" />
    <PerfBenchmark v-else-if="activeTab === 'benchmark'" />
    <PerfMonitor v-else-if="activeTab === 'monitor'" />
    <PerfSessionReport v-else-if="activeTab === 'session'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TopMatches from "./components/TopMatches.vue";
import PerfBenchmark from "./components/PerfBenchmark.vue";
import PerfMonitor from "./components/PerfMonitor.vue";
import PerfSessionReport from "./components/PerfSessionReport.vue";

const tabs = [
  { id: "matches", label: "🎮 Top Matches" },
  { id: "benchmark", label: "📊 性能分析" },
  { id: "monitor", label: "📡 实时监控" },
  { id: "session", label: "📘 会话总结" },
] as const;

const activeTab = ref<string>("monitor");
</script>

<style scoped>
.app {
  min-height: 100vh;
}

.app__nav {
  display: flex;
  gap: 4px;
  padding: 10px 20px;
  background: #161923;
  border-bottom: 1px solid #1e293b;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app__tab {
  padding: 8px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.app__tab:hover {
  color: #e2e8f0;
  background: #1e293b;
}

.app__tab.is-active {
  color: #fff;
  background: #6366f1;
  border-color: #818cf8;
}
</style>
