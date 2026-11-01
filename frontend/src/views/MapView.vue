<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { askQuestion, type GradedResponse, type RelatedQuestion } from '../api/qa'

const question = ref('')
const response = ref<GradedResponse | null>(null)
const loading = ref(false)

// ---- 悬浮窗状态 ----
const panelPos = ref({ x: 0, y: 0 })
const collapsed = ref(false)
const closed = ref(false)
const isDragging = ref(false)
const POS_KEY = 'qa-panel-pos'
const COLLAPSE_KEY = 'qa-panel-collapsed'

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

async function doAsk(qText: string) {
  const q = qText.trim()
  if (!q) return
  question.value = q
  loading.value = true
  response.value = null
  try {
    response.value = await askQuestion(q)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleAsk() {
  return doAsk(question.value)
}

function askRelated(rq: RelatedQuestion) {
  return doAsk(rq.question)
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

// ---- 拖拽（pointer events，统一鼠标/触摸）----
const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

function clampPos(x: number, y: number) {
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    // 至少保留约 120px 标题栏在屏内，避免整窗被拖出视口
    x: Math.min(Math.max(x, 0), Math.max(0, w - 120)),
    y: Math.min(Math.max(y, 0), Math.max(0, h - 44)),
  }
}

function startDrag(e: PointerEvent) {
  drag.active = true
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.originX = panelPos.value.x
  drag.originY = panelPos.value.y
  isDragging.value = true
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
}

function onDrag(e: PointerEvent) {
  if (!drag.active) return
  const nx = drag.originX + (e.clientX - drag.startX)
  const ny = drag.originY + (e.clientY - drag.startY)
  panelPos.value = clampPos(nx, ny)
}

function endDrag() {
  drag.active = false
  isDragging.value = false
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
  localStorage.setItem(POS_KEY, JSON.stringify(panelPos.value))
}

function onResize() {
  panelPos.value = clampPos(panelPos.value.x, panelPos.value.y)
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

function closePanel() {
  closed.value = true
}

function reopen() {
  closed.value = false
}

onMounted(() => {
  const saved = localStorage.getItem(POS_KEY)
  if (saved) {
    try {
      const p = JSON.parse(saved) as { x: number; y: number }
      panelPos.value = clampPos(p.x, p.y)
    } catch {
      panelPos.value = clampPos(window.innerWidth - 380, 88)
    }
  } else {
    panelPos.value = clampPos(window.innerWidth - 380, 88)
  }
  collapsed.value = localStorage.getItem(COLLAPSE_KEY) === '1'
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
})
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

    <button v-if="closed" class="reopen-btn" @click="reopen">
      史料问答
    </button>

    <div
      v-else
      class="qa-float"
      :class="{ dragging: isDragging }"
      :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }"
    >
      <div class="qa-titlebar" @pointerdown="startDrag">
        <span class="qa-seal" aria-hidden="true">史</span>
        <span class="qa-title">史料问答 · 每条皆有出处</span>
        <div class="qa-controls">
          <button
            class="icon-btn"
            :title="collapsed ? '展开' : '收起'"
            @pointerdown.stop
            @click="toggleCollapse"
          >
            {{ collapsed ? '▢' : '—' }}
          </button>
          <button
            class="icon-btn"
            title="关闭"
            @pointerdown.stop
            @click="closePanel"
          >
            ✕
          </button>
        </div>
      </div>

      <div v-show="!collapsed" class="qa-body">
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

          <div v-if="response.relatedQuestions && response.relatedQuestions.length > 0" class="related-section">
            <h4>相关问题</h4>
            <div class="related-list">
              <button
                v-for="rq in response.relatedQuestions"
                :key="rq.id"
                class="related-btn"
                @click="askRelated(rq)"
              >
                {{ rq.question }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-view {
  position: relative;
  height: 100%;
}
.map-container {
  position: absolute;
  inset: 0;
}
.map-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* 悬浮窗：卷轴卷宗外观（脱离文档流、覆盖地图的可拖动面板），功能逻辑不变 */
.qa-float {
  position: fixed;
  z-index: 1000;
  width: 360px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #33281a;
  font-family: "Songti SC", "STSong", "SimSun", "Noto Serif SC", serif;
  background:
    repeating-linear-gradient(0deg, rgba(120, 90, 50, 0.05) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #f4e7c5 0%, #ecdcaf 45%, #e4d19f 100%);
  border: 1px solid #8a6a44;
  border-radius: 6px;
  box-shadow:
    0 14px 44px rgba(0, 0, 0, 0.6),
    inset 0 0 24px rgba(120, 86, 40, 0.18);
}
/* 上下卷轴木杆 */
.qa-float::before,
.qa-float::after {
  content: "";
  display: block;
  flex: 0 0 10px;
  background: linear-gradient(180deg, #8a5a33 0%, #5b3a22 50%, #7a4e2c 100%);
  box-shadow: inset 0 1px 0 rgba(255, 235, 190, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.4);
}
.qa-float::after {
  flex-basis: 8px;
  background: linear-gradient(180deg, #7a4e2c, #5b3a22, #8a5a33);
}
.qa-float.dragging {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.72);
}

.qa-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem 0.5rem 0.55rem;
  background: linear-gradient(180deg, #7a4e2c, #63391f);
  border-bottom: 1px solid #4a2a14;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.qa-titlebar:active {
  cursor: grabbing;
}
.qa-seal {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #a33a2a;
  color: #f6ead0;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(246, 234, 208, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
  transform: rotate(-4deg);
}
.qa-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: bold;
  color: #f3e4bd;
  letter-spacing: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qa-controls {
  display: flex;
  gap: 0.3rem;
}
.icon-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 234, 208, 0.12);
  border: 1px solid rgba(246, 234, 208, 0.35);
  color: #f3e4bd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.icon-btn:hover {
  background: rgba(163, 58, 42, 0.55);
  color: #fff;
}

.qa-body {
  padding: 0.8rem;
  overflow-y: auto;
}

.qa-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.qa-input input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  background: #fbf5e2;
  border: 1px solid #8a6a44;
  color: #33281a;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}
.qa-input input::placeholder {
  color: #9a8460;
}
.qa-input input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(163, 58, 42, 0.18);
}
.qa-input button {
  padding: 0.5rem 0.9rem;
  background: linear-gradient(180deg, #a33a2a, #8c2f21);
  border: 1px solid #6e2418;
  color: #f6ead0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 1px;
}
.qa-input button:hover {
  filter: brightness(1.08);
}
.qa-input button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.qa-response {
  border-top: 1px dashed #8a6a44;
  padding-top: 1rem;
}
.response-level {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  margin-bottom: 0.5rem;
  letter-spacing: 1px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.response-answer {
  font-size: 14px;
  line-height: 1.75;
  margin-bottom: 1rem;
  color: #2e2417;
  text-align: justify;
}
.evidence-section h4,
.uncertainty-section h4,
.related-section h4 {
  font-size: 13px;
  color: #6b4423;
  margin: 0.6rem 0 0.4rem;
  letter-spacing: 2px;
  border-left: 3px solid #a33a2a;
  padding-left: 0.4rem;
}
.evidence-card {
  background: #f8f0da;
  padding: 0.5rem 0.6rem;
  border: 1px solid #c9b283;
  border-left: 3px solid #a33a2a;
  border-radius: 3px;
  margin-bottom: 0.5rem;
}
.evidence-source {
  font-size: 13px;
  color: #7a3b1e;
  font-weight: bold;
}
.evidence-quote {
  font-size: 12px;
  color: #55432c;
  margin: 0.25rem 0;
  line-height: 1.6;
}
.evidence-confidence {
  font-size: 11px;
}
.conf-high { color: #3f7d3a; }
.conf-medium { color: #b07416; }
.conf-low { color: #a33a2a; }
.uncertainty-section ul {
  padding-left: 1rem;
  font-size: 13px;
  color: #8a5a1e;
}
.map-action-btn {
  width: 100%;
  padding: 0.55rem;
  background: linear-gradient(180deg, #6b4423, #543218);
  border: 1px solid #3f2410;
  color: #f3e4bd;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 2px;
}
.map-action-btn:hover {
  filter: brightness(1.1);
}

.related-section {
  margin-top: 0.6rem;
}
.related-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.related-btn {
  text-align: left;
  padding: 0.45rem 0.6rem;
  background: #f8f0da;
  border: 1px solid #c9b283;
  color: #5a3d20;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}
.related-btn::before {
  content: "◈ ";
  color: #a33a2a;
}
.related-btn:hover {
  background: #f1e2bd;
  border-color: #a33a2a;
  color: #3d2512;
}

.reopen-btn {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  padding: 0.7rem 0.9rem;
  background: linear-gradient(180deg, #a33a2a, #8c2f21);
  border: 1px solid #6e2418;
  color: #f6ead0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 1px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 235, 190, 0.3);
}
.reopen-btn:hover {
  filter: brightness(1.1);
}

/* 窄屏：悬浮窗几乎占满宽度，避免横向溢出 */
@media (max-width: 480px) {
  .qa-float {
    width: calc(100vw - 16px);
  }
}
</style>
