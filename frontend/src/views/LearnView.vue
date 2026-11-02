<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { exportLecturePackage, type LecturePackage } from '../api/lecture'
import { submitAnswer } from '../api/deviation'
import { DYNASTIES } from '../constants/dynasties'

const selectedDynasty = ref<string>('tang')
const lecturePackage = ref<LecturePackage | null>(null)
const currentQuestionIndex = ref(0)
const selectedOption = ref<string | null>(null)
const answers = ref<{ questionId: string; selected: string; correct: string; isCorrect: boolean }[]>([])
const studentId = ref(`student-${Math.random().toString(36).slice(2, 8)}`)
const classId = ref('demo-class')
const phase = ref<'intro' | 'quiz' | 'result'>('intro')

const currentQuestion = computed(() => {
  if (!lecturePackage.value) return null
  return lecturePackage.value.questions[currentQuestionIndex.value] ?? null
})

const totalQuestions = computed(() => lecturePackage.value?.questions.length ?? 0)

const dynastyLabel = computed(
  () => DYNASTIES.find(d => d.code === selectedDynasty.value)?.label ?? selectedDynasty.value,
)

const correctCount = computed(() => answers.value.filter(a => a.isCorrect).length)

const cognitiveTags = computed(() => {
  const tags: string[] = []
  for (const ans of answers.value) {
    if (!ans.isCorrect) {
      if (ans.selected.includes('羁縻') || ans.selected.includes('1237')) {
        tags.push('管到/写到混淆：把羁縻当成直辖')
      }
      if (ans.selected.includes('行迹') || ans.selected.includes('走到')) {
        tags.push('走到/管到混淆：把行迹当成管辖')
      }
      if (ans.selected.includes('未收录') || ans.selected.includes('不准确')) {
        tags.push('范围超出：选了系统不存在的选项')
      }
    } else {
      tags.push('正确')
    }
  }
  return tags
})

async function startQuiz() {
  await loadLecture()
  phase.value = 'quiz'
  currentQuestionIndex.value = 0
  selectedOption.value = null
  answers.value = []
}

async function loadLecture() {
  try {
    lecturePackage.value = await exportLecturePackage(selectedDynasty.value)
  } catch (e) {
    console.error(e)
  }
}

async function submitCurrentAnswer() {
  if (!currentQuestion.value || !selectedOption.value) return

  const isCorrect = selectedOption.value === currentQuestion.value.correctAnswer
  answers.value.push({
    questionId: currentQuestion.value.id,
    selected: selectedOption.value,
    correct: currentQuestion.value.correctAnswer,
    isCorrect,
  })

  try {
    await submitAnswer(studentId.value, classId.value, currentQuestion.value.id, selectedOption.value)
  } catch (e) {
    console.error(e)
  }

  if (currentQuestionIndex.value < totalQuestions.value - 1) {
    currentQuestionIndex.value++
    selectedOption.value = null
  } else {
    phase.value = 'result'
  }
}

onMounted(() => {
  loadLecture()
})
</script>

<template>
  <div class="learn-view">
    <div class="learn-header">
      <h2>学生端 · 历史地理课堂</h2>
      <div class="dynasty-selector">
        <button
          v-for="d in DYNASTIES"
          :key="d.code"
          :class="{ active: selectedDynasty === d.code }"
          @click="selectedDynasty = d.code"
        >{{ d.label }}</button>
      </div>
    </div>

    <div v-if="phase === 'intro'" class="intro-phase">
      <div class="intro-card">
        <h3>{{ dynastyLabel }} · 历史地理</h3>
        <p>本节课包含 {{ totalQuestions }} 个问题，答完后你会看到自己的认知标签。</p>
        <p class="hint">每个问题都基于真实史料，答错不是随机——而是概念混淆。看看你会不会把"写到"当成"管到"。</p>
        <button class="start-btn" @click="startQuiz">开始答题</button>
      </div>
    </div>

    <div v-else-if="phase === 'quiz'" class="quiz-phase">
      <div class="progress">
        第 {{ currentQuestionIndex + 1 }} / {{ totalQuestions }} 题
      </div>

      <div v-if="currentQuestion" class="question-card">
        <h3>{{ currentQuestion.question }}</h3>
        <div class="options">
          <button
            v-for="(opt, i) in currentQuestion.options"
            :key="i"
            :class="{ selected: selectedOption === opt }"
            @click="selectedOption = opt"
          >
            {{ String.fromCharCode(65 + i) }}. {{ opt }}
          </button>
        </div>
        <button
          class="submit-btn"
          :disabled="!selectedOption"
          @click="submitCurrentAnswer"
        >提交</button>
      </div>
    </div>

    <div v-else-if="phase === 'result'" class="result-phase">
      <div class="result-card">
        <h3>答题完成</h3>
        <div class="score">
          {{ correctCount }} / {{ totalQuestions }} 正确
        </div>

        <div class="cognitive-tags">
          <h4>你的认知标签</h4>
          <div v-for="(tag, i) in cognitiveTags" :key="i" class="tag" :class="{ correct: tag === '正确' }">
            {{ tag }}
          </div>
        </div>

        <div class="evidence-hint">
          <p>每个问题都有史料出处。在地图端提问，可以看到完整的证据链。</p>
          <router-link to="/map" class="go-map">去地图端提问 →</router-link>
        </div>

        <button class="retry-btn" @click="phase = 'intro'">重新答题</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn-view {
  height: 100%;
  overflow-y: auto;
  background: #0f0f1e;
  color: #e0e0e0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.learn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 600px;
  margin-bottom: 1rem;
}
.learn-header h2 {
  font-size: 18px;
  margin: 0;
}
.dynasty-selector button {
  padding: 0.25rem 1rem;
  background: #16213e;
  border: 1px solid #333;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
}
.dynasty-selector button.active {
  background: #0f3460;
  color: #fff;
}
.intro-phase,
.quiz-phase,
.result-phase {
  width: 100%;
  max-width: 600px;
}
.intro-card,
.question-card,
.result-card {
  background: #1a1a2e;
  padding: 1.5rem;
  border-radius: 8px;
}
.intro-card h3,
.question-card h3,
.result-card h3 {
  font-size: 18px;
  margin: 0 0 1rem;
}
.intro-card p {
  font-size: 14px;
  color: #ccc;
  line-height: 1.6;
}
.intro-card .hint {
  color: #ff9800;
  font-size: 13px;
}
.start-btn,
.submit-btn,
.retry-btn {
  width: 100%;
  padding: 0.75rem;
  background: #0f3460;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 1rem;
}
.submit-btn:disabled {
  opacity: 0.5;
}
.progress {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 1rem;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.options button {
  text-align: left;
  padding: 0.75rem;
  background: #16213e;
  border: 1px solid #333;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.options button.selected {
  background: #0f3460;
  color: #fff;
  border-color: #4fc3f7;
}
.score {
  font-size: 24px;
  color: #4caf50;
  margin-bottom: 1rem;
}
.cognitive-tags h4 {
  font-size: 14px;
  color: #aaa;
  margin: 0 0 0.5rem;
}
.tag {
  display: inline-block;
  padding: 4px 12px;
  background: #16213e;
  border-radius: 4px;
  font-size: 13px;
  margin: 0.25rem;
  color: #ff9800;
}
.tag.correct {
  color: #4caf50;
}
.evidence-hint {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #333;
}
.evidence-hint p {
  font-size: 13px;
  color: #888;
}
.go-map {
  color: #4fc3f7;
  text-decoration: none;
  font-size: 14px;
}

/* 窄屏：收紧内边距，头部允许换行，卡片不贴边 */
@media (max-width: 560px) {
  .learn-view {
    padding: 0.75rem;
  }
  .learn-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .intro-card,
  .question-card,
  .result-card {
    padding: 1rem;
  }
}
</style>