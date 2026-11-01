<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { askQuestion, type GradedResponse, type RelatedQuestion } from '../api/qa'

const question = ref('')
const response = ref<GradedResponse | null>(null)
const loading = ref(false)

// ---- 悬浮窗状态 ----
const panelPos = ref({ x: 0, y: 0 })
const collapsed = ref(false)
const closed = ref(true) // 桌面宠物常驻，初始先显示宠物、点击再展开面板
const isDragging = ref(false)
const POS_KEY = 'qa-panel-pos'
const COLLAPSE_KEY = 'qa-panel-collapsed'

// ---- 常驻卷轴宠物（可拖动；轻点展开面板，拖动不触发点击）----
const petPos = ref({ x: 16, y: 80 })
const PET_KEY = 'pet-pos'
const petDrag = { active: false, startX: 0, startY: 0, ox: 0, oy: 0, moved: false }

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
  petPos.value = clampPet(petPos.value.x, petPos.value.y)
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

function closePanel() {
  closed.value = true
}

function openPanel() {
  closed.value = false
}

function clampPet(x: number, y: number) {
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, w - 84)),
    y: Math.min(Math.max(y, 0), Math.max(0, h - 96)),
  }
}

function startPetDrag(e: PointerEvent) {
  petDrag.active = true
  petDrag.moved = false
  petDrag.startX = e.clientX
  petDrag.startY = e.clientY
  petDrag.ox = petPos.value.x
  petDrag.oy = petPos.value.y
  window.addEventListener('pointermove', onPetDrag)
  window.addEventListener('pointerup', endPetDrag)
}

function onPetDrag(e: PointerEvent) {
  if (!petDrag.active) return
  if (Math.abs(e.clientX - petDrag.startX) > 4 || Math.abs(e.clientY - petDrag.startY) > 4) {
    petDrag.moved = true
  }
  petPos.value = clampPet(
    petDrag.ox + (e.clientX - petDrag.startX),
    petDrag.oy + (e.clientY - petDrag.startY),
  )
}

function endPetDrag() {
  petDrag.active = false
  window.removeEventListener('pointermove', onPetDrag)
  window.removeEventListener('pointerup', endPetDrag)
  localStorage.setItem(PET_KEY, JSON.stringify(petPos.value))
}

function onPetTap() {
  if (petDrag.moved) return
  openPanel()
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

  const petSaved = localStorage.getItem(PET_KEY)
  if (petSaved) {
    try {
      const p = JSON.parse(petSaved) as { x: number; y: number }
      petPos.value = clampPet(p.x, p.y)
    } catch {
      petPos.value = clampPet(16, window.innerHeight - 104)
    }
  } else {
    petPos.value = clampPet(16, window.innerHeight - 104)
  }
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointermove', onPetDrag)
  window.removeEventListener('pointerup', endPetDrag)
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

    <button
      v-if="closed"
      class="pet-scroll"
      :style="{ left: petPos.x + 'px', top: petPos.y + 'px' }"
      @pointerdown="startPetDrag"
      @click="onPetTap"
      title="点开史料问答"
    >
      <svg class="pet-svg" viewBox="0 0 64 76" aria-hidden="true">
        <rect x="14" y="4" width="36" height="9" rx="4.5" fill="#6b4423" />
        <rect x="18" y="11" width="28" height="52" rx="3" fill="#f3e4bd" stroke="#8a6a44" stroke-width="1.2" />
        <line x1="23" y1="24" x2="41" y2="24" stroke="#b89a68" stroke-width="1.2" />
        <line x1="23" y1="31" x2="41" y2="31" stroke="#b89a68" stroke-width="1.2" />
        <line x1="23" y1="48" x2="41" y2="48" stroke="#b89a68" stroke-width="1.2" />
        <ellipse class="pet-cheek" cx="24" cy="43" rx="3.2" ry="1.7" fill="#d98a7a" opacity="0.55" />
        <ellipse class="pet-cheek" cx="40" cy="43" rx="3.2" ry="1.7" fill="#d98a7a" opacity="0.55" />
        <circle class="pet-eye" cx="28.5" cy="38" r="2.3" fill="#33281a" />
        <circle class="pet-eye" cx="35.5" cy="38" r="2.3" fill="#33281a" />
        <circle cx="29.3" cy="37.2" r="0.7" fill="#fff" />
        <circle cx="36.3" cy="37.2" r="0.7" fill="#fff" />
        <rect x="14" y="63" width="36" height="9" rx="4.5" fill="#5b3a22" />
      </svg>
    </button>

    <div
      v-else
      class="qa-float"
      :class="{ dragging: isDragging }"
      :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }"
    >
      <div class="qa-titlebar" @pointerdown="startDrag">
        <span class="qa-book-icon" aria-label="史料问答"></span>
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
/* 标题栏纯书卷图标（无文字）：纸面 + 上下卷轴杆 + 行线 */
.qa-book-icon {
  flex: 0 0 auto;
  position: relative;
  width: 22px;
  height: 20px;
  background:
    repeating-linear-gradient(180deg, transparent 0 4px, rgba(120, 90, 50, 0.28) 4px 5px),
    #f3e4bd;
  border: 1px solid #8a6a44;
  border-radius: 2px;
  box-shadow: inset 0 0 2px rgba(90, 60, 30, 0.35);
}
.qa-book-icon::before,
.qa-book-icon::after {
  content: "";
  position: absolute;
  left: -3px;
  right: -3px;
  height: 3px;
  background: linear-gradient(180deg, #8a5a33, #5b3a22);
  border-radius: 2px;
}
.qa-book-icon::before { top: -2px; }
.qa-book-icon::after { bottom: -2px; }
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

/* 常驻卷轴宠物：可拖动、轻点展开、呼吸浮动 + 眨眼 */
.pet-scroll {
  position: fixed;
  z-index: 1000;
  width: 84px;
  height: 92px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: grab;
  touch-action: none;
  animation: pet-float 3s ease-in-out infinite;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.45));
}
.pet-scroll:active {
  cursor: grabbing;
}
.pet-scroll:hover .pet-svg {
  transform: scale(1.08) rotate(-3deg);
}
.pet-svg {
  width: 64px;
  height: 76px;
  display: block;
  margin: 0 auto;
  transition: transform 0.18s ease;
}
.pet-eye {
  transform-origin: center;
  transform-box: fill-box;
  animation: pet-blink 4.2s infinite;
}
@keyframes pet-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
@keyframes pet-blink {
  0%, 91%, 98%, 100% { transform: scaleY(1); }
  94%, 96% { transform: scaleY(0.1); }
}

/* 窄屏：悬浮窗几乎占满宽度，避免横向溢出 */
@media (max-width: 480px) {
  .qa-float {
    width: calc(100vw - 16px);
  }
}
</style>
