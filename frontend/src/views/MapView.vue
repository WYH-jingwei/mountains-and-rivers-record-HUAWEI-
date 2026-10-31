<script setup lang="ts">
import { ref } from 'vue'
import { askQuestion, type GradedResponse } from '../api/qa'

const question = ref('')
const response = ref<GradedResponse | null>(null)
const loading = ref(false)

const levelLabels: Record<number, string> = {
  1: '直答',
  2: '条件答',
  3: '范围声明',
  4: '证据展示',
}

const levelColors: Record<number, string> = {
  1: '#4caf50',
  2: '#ff9800',
  3: '#2196f3',
  4: '#9c27b0',
}

async function handleAsk() {
  if (!question.value.trim()) return
  loading.value = true
  response.value = null
  try {
    response.value = await askQuestion(question.value)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleMapAction(action: GradedResponse['mapAction']) {
  if (!action) return
  const iframe = document.getElementById('map-iframe') as HTMLIFrameElement
  if (iframe?.contentWindow) {
    // response.mapAction 是 Vue 响应式代理(Proxy)，postMessage 结构化克隆无法克隆 Proxy，
    // 先序列化为普通纯对象再发送，避免 DataCloneError
    const payload = JSON.parse(JSON.stringify(action)) as GradedResponse['mapAction']
    iframe.contentWindow.postMessage(payload, '*')
  }
}
</script>

<template>
  <div class="map-view">
    <div class="map-container">
      <iframe
        id="map-iframe"
        src="/舆图山河录.html"
        class="map-iframe"
        title="舆图山河录"
      />
    </div>
    <aside class="qa-panel">
      <div class="qa-header">
        <h3>史料问答</h3>
        <span class="hint">每个回答都带出处</span>
      </div>

      <div class="qa-input">
        <input
          v-model="question"
          type="text"
          placeholder="问一个问题，如：唐朝最西到哪？"
          @keyup.enter="handleAsk"
        />
        <button :disabled="loading" @click="handleAsk">
          {{ loading ? '查询中...' : '提问' }}
        </button>
      </div>

      <div v-if="response" class="qa-response">
        <div class="response-level" :style="{ background: levelColors[response.level] }">
          {{ levelLabels[response.level] }}
        </div>

        <p class="response-answer">{{ response.answer }}</p>

        <div v-if="response.evidence.length > 0" class="evidence-section">
          <h4>出处</h4>
          <div v-for="(ev, i) in response.evidence" :key="i" class="evidence-card">
            <div class="evidence-source">{{ ev.source }}</div>
            <div class="evidence-quote">"{{ ev.quote }}"</div>
            <div class="evidence-confidence" :class="`conf-${ev.confidence}`">
              {{ ev.confidence === 'high' ? '高置信' : ev.confidence === 'medium' ? '中置信' : '低置信' }}
            </div>
          </div>
        </div>

        <div v-if="response.uncertainty.length > 0" class="uncertainty-section">
          <h4>不确定项</h4>
          <ul>
            <li v-for="(u, i) in response.uncertainty" :key="i">{{ u }}</li>
          </ul>
        </div>

        <button
          v-if="response.mapAction"
          class="map-action-btn"
          @click="handleMapAction(response.mapAction)"
        >
          在地图上查看
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.map-view {
  display: flex;
  height: 100%;
}
.map-container {
  flex: 1;
  position: relative;
}
.map-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.qa-panel {
  width: 360px;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 1rem;
  overflow-y: auto;
  border-left: 1px solid #333;
}
.qa-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1rem;
}
.qa-header h3 {
  margin: 0;
  font-size: 16px;
}
.hint {
  font-size: 12px;
  color: #888;
}
.qa-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.qa-input input {
  flex: 1;
  padding: 0.5rem;
  background: #16213e;
  border: 1px solid #333;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
}
.qa-input button {
  padding: 0.5rem 1rem;
  background: #0f3460;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.qa-input button:disabled {
  opacity: 0.5;
}
.qa-response {
  border-top: 1px solid #333;
  padding-top: 1rem;
}
.response-level {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  margin-bottom: 0.5rem;
}
.response-answer {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 1rem;
}
.evidence-section h4,
.uncertainty-section h4 {
  font-size: 13px;
  color: #aaa;
  margin: 0.5rem 0;
}
.evidence-card {
  background: #16213e;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}
.evidence-source {
  font-size: 13px;
  color: #4fc3f7;
  font-weight: bold;
}
.evidence-quote {
  font-size: 12px;
  color: #ccc;
  margin: 0.25rem 0;
  font-style: italic;
}
.evidence-confidence {
  font-size: 11px;
}
.conf-high { color: #4caf50; }
.conf-medium { color: #ff9800; }
.conf-low { color: #f44336; }
.uncertainty-section ul {
  padding-left: 1rem;
  font-size: 13px;
  color: #ff9800;
}
.map-action-btn {
  width: 100%;
  padding: 0.5rem;
  background: #0f3460;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
  font-size: 14px;
}
</style>