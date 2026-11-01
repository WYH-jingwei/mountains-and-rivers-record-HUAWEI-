<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { askQuestion, type GradedResponse, type RelatedQuestion } from '../api/qa'

const question = ref('')
const loading = ref(false)

// ---- 对话气泡窗（closed=true 时仅显示常驻宠物，false 时在宠物右侧展开对话流）----
const closed = ref(true)

interface ChatMsg {
  id: number
  role: 'user' | 'pet'
  text: string
  level?: number
  evidence?: GradedResponse['evidence']
  uncertainty?: string[]
  related?: RelatedQuestion[]
  mapAction?: GradedResponse['mapAction']
  pending?: boolean
}
const messages = ref<ChatMsg[]>([])
let msgSeq = 0
const chatBody = ref<HTMLElement | null>(null)

// ---- 常驻卷轴宠物（可拖动；轻点展开面板，拖动不触发点击）----
const petPos = ref({ x: 16, y: 80 })
const PET_KEY = 'pet-pos'
const petDrag = { active: false, startX: 0, startY: 0, ox: 0, oy: 0, moved: false }
// 桌宠式手感：抓起中稳定跟随、松手落地回弹、点中脉冲
const petGrabbing = ref(false)
const petAnim = ref<'' | 'land' | 'tap'>('')
function playPetAnim(kind: 'land' | 'tap') {
  petAnim.value = kind
  window.setTimeout(() => {
    if (petAnim.value === kind) petAnim.value = ''
  }, 320)
}

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
  if (!q || loading.value) return
  question.value = ''
  messages.value.push({ id: ++msgSeq, role: 'user', text: q })
  const petId = ++msgSeq
  messages.value.push({ id: petId, role: 'pet', text: '', pending: true })
  await scrollToBottom()
  loading.value = true
  try {
    const res = await askQuestion(q)
    const idx = messages.value.findIndex((m) => m.id === petId)
    if (idx >= 0) {
      messages.value[idx] = {
        id: petId,
        role: 'pet',
        text: res.answer,
        level: res.level,
        evidence: res.evidence,
        uncertainty: res.uncertainty,
        related: res.relatedQuestions,
        mapAction: res.mapAction,
      }
    }
  } catch (e) {
    console.error(e)
    const idx = messages.value.findIndex((m) => m.id === petId)
    if (idx >= 0) {
      messages.value[idx] = { id: petId, role: 'pet', text: '史料检索暂时不可用，请稍后再试。' }
    }
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function handleAsk() {
  return doAsk(question.value)
}

function askRelated(rq: RelatedQuestion) {
  return doAsk(rq.question)
}

async function scrollToBottom() {
  await nextTick()
  const el = chatBody.value
  if (el) el.scrollTop = el.scrollHeight
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

function onResize() {
  petPos.value = clampPet(petPos.value.x, petPos.value.y)
}

function closePanel() {
  closed.value = true
}

function openPanel() {
  closed.value = false
}

// 气泡窗贴在宠物右侧；右侧空间不足时自动改贴左侧，并避免顶部越界
const CHAT_W = 332
const chatPos = computed(() => {
  const petW = 84
  const gap = 10
  const top = Math.min(petPos.value.y, Math.max(8, window.innerHeight - 440))
  const rightX = petPos.value.x + petW + gap
  if (window.innerWidth - rightX >= CHAT_W + 8) {
    return { left: rightX, top, side: 'right' as const }
  }
  const leftX = petPos.value.x - CHAT_W - gap
  return { left: Math.max(8, leftX), top, side: 'left' as const }
})

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
  petGrabbing.value = true
  petAnim.value = ''
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
  petGrabbing.value = false
  window.removeEventListener('pointermove', onPetDrag)
  window.removeEventListener('pointerup', endPetDrag)
  localStorage.setItem(PET_KEY, JSON.stringify(petPos.value))
  if (petDrag.moved) playPetAnim('land')
}

function onPetTap() {
  if (petDrag.moved) return
  playPetAnim('tap')
  openPanel()
}

onMounted(() => {
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
      class="pet-scroll"
      :class="{ grabbing: petGrabbing, land: petAnim === 'land', tap: petAnim === 'tap' }"
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
      v-if="!closed"
      class="chat-bubble"
      :class="chatPos.side"
      :style="{ left: chatPos.left + 'px', top: chatPos.top + 'px' }"
    >
      <div class="chat-titlebar">
        <span class="qa-book-icon" aria-label="史料问答"></span>
        <div class="qa-controls">
          <button class="icon-btn" title="收起对话（回到卷轴）" @click="closePanel">✕</button>
        </div>
      </div>

      <div ref="chatBody" class="chat-body">
        <div v-if="messages.length === 0" class="chat-empty">
          垂询史籍：疆域四至、行军路线、丝路往来……
        </div>

        <div v-for="m in messages" :key="m.id" class="msg-row" :class="m.role">
          <span v-if="m.role === 'pet'" class="msg-avatar">
            <span class="qa-book-icon"></span>
          </span>
          <div class="bubble">
            <div v-if="m.pending" class="typing">
              <span></span><span></span><span></span>
            </div>
            <template v-else>
              <span v-if="m.level" class="response-level" :style="{ background: levelColors[m.level!] }">
                {{ levelLabels[m.level!] }}
              </span>
              <p class="response-answer">{{ m.text }}</p>

              <div v-if="m.evidence && m.evidence.length > 0" class="evidence-section">
                <h4>出处</h4>
                <div v-for="(ev, i) in m.evidence" :key="i" class="evidence-card">
                  <div class="evidence-source">{{ ev.source }}</div>
                  <div class="evidence-quote">"{{ ev.quote }}"</div>
                  <div class="evidence-confidence" :class="`conf-${ev.confidence}`">
                    {{ ev.confidence === 'high' ? '高置信' : ev.confidence === 'medium' ? '中置信' : '低置信' }}
                  </div>
                </div>
              </div>

              <div v-if="m.uncertainty && m.uncertainty.length > 0" class="uncertainty-section">
                <h4>不确定项</h4>
                <ul>
                  <li v-for="(u, i) in m.uncertainty" :key="i">{{ u }}</li>
                </ul>
              </div>

              <button v-if="m.mapAction" class="map-action-btn" @click="handleMapAction(m.mapAction)">
                在地图上查看
              </button>

              <div v-if="m.related && m.related.length > 0" class="related-section">
                <h4>相关追问</h4>
                <div class="related-list">
                  <button v-for="rq in m.related" :key="rq.id" class="related-btn" @click="askRelated(rq)">
                    {{ rq.question }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <input
          v-model="question"
          type="text"
          placeholder="问一处疆域、一条路线，如：唐朝最西到哪？"
          @keyup.enter="handleAsk"
        />
        <button :disabled="loading" @click="handleAsk">{{ loading ? '…' : '发问' }}</button>
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
/* 对话气泡窗：贴宠物右侧（空间不足自动贴左侧），古风宣纸，多轮消息流 */
.chat-bubble {
  position: fixed;
  z-index: 1000;
  width: 332px;
  max-width: calc(100vw - 16px);
  max-height: min(460px, calc(100vh - 24px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #33281a;
  font-family: "Songti SC", "STSong", "SimSun", "Noto Serif SC", serif;
  background:
    repeating-linear-gradient(0deg, rgba(120, 90, 50, 0.05) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #f4e7c5 0%, #ecdcaf 45%, #e4d19f 100%);
  border: 1px solid #8a6a44;
  border-radius: 10px;
  box-shadow:
    0 14px 44px rgba(0, 0, 0, 0.6),
    inset 0 0 24px rgba(120, 86, 40, 0.18);
  animation: chat-pop 0.22s ease;
}
@keyframes chat-pop {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.chat-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: linear-gradient(180deg, #7a4e2c, #63391f);
  border-bottom: 1px solid #4a2a14;
  user-select: none;
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

.chat-body {
  flex: 1;
  min-height: 120px;
  max-height: 340px;
  overflow-y: auto;
  padding: 0.7rem 0.7rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.chat-empty {
  font-size: 13px;
  color: #8a6a44;
  line-height: 1.7;
  padding: 0.3rem 0.2rem;
}
.msg-row {
  display: flex;
  gap: 0.45rem;
  align-items: flex-end;
}
.msg-row.user {
  flex-direction: row-reverse;
}
.msg-avatar {
  flex: 0 0 auto;
  width: 26px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.bubble {
  max-width: 82%;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.7;
  position: relative;
  word-break: break-word;
}
.msg-row.pet .bubble {
  background: #fbf5e2;
  border: 1px solid #c9b283;
  border-bottom-left-radius: 3px;
  color: #2e2417;
}
.msg-row.user .bubble {
  background: linear-gradient(180deg, #a33a2a, #8c2f21);
  color: #f6ead0;
  border: 1px solid #6e2418;
  border-bottom-right-radius: 3px;
}
.msg-row.user .response-answer {
  color: #f6ead0;
  margin-bottom: 0;
}
.typing {
  display: inline-flex;
  gap: 4px;
  padding: 0.3rem 0.2rem;
}
.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8a6a44;
  animation: typing-dot 1.1s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.18s; }
.typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.55rem 0.6rem 0.65rem;
  border-top: 1px solid #c9b283;
}
.chat-input input {
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
.chat-input input::placeholder { color: #9a8460; }
.chat-input input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(163, 58, 42, 0.18);
}
.chat-input button {
  padding: 0.5rem 0.85rem;
  background: linear-gradient(180deg, #a33a2a, #8c2f21);
  border: 1px solid #6e2418;
  color: #f6ead0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  letter-spacing: 1px;
}
.chat-input button:hover { filter: brightness(1.08); }
.chat-input button:disabled { opacity: 0.55; cursor: not-allowed; }
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
.pet-scroll:hover .pet-svg {
  transform: scale(1.08) rotate(-3deg);
}
/* 抓起：停止呼吸浮动、稳定跟随并轻微放大，像被拎起 */
.pet-scroll.grabbing {
  animation: none;
  cursor: grabbing;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
}
.pet-scroll.grabbing .pet-svg {
  transform: scale(1.12);
}
/* 松手落地回弹 / 点中脉冲反馈 */
.pet-scroll.land .pet-svg {
  animation: pet-land 0.28s ease;
}
.pet-scroll.tap .pet-svg {
  animation: pet-tap 0.22s ease;
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
@keyframes pet-land {
  0% { transform: scale(1.1); }
  45% { transform: scale(0.94); }
  100% { transform: scale(1); }
}
@keyframes pet-tap {
  0% { transform: scale(1); }
  40% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

/* 窄屏：对话气泡几乎占满宽度，避免横向溢出 */
@media (max-width: 480px) {
  .chat-bubble {
    width: calc(100vw - 16px);
  }
}
</style>
