<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { exportLecturePackage, type LecturePackage } from '../api/lecture'
import { getDeviationProfile, type DeviationProfile } from '../api/deviation'

const selectedDynasty = ref<'tang' | 'ming'>('tang')
const lecturePackage = ref<LecturePackage | null>(null)
const deviationProfile = ref<DeviationProfile | null>(null)
const loading = ref(false)
const classId = ref('demo-class')

async function loadLecture() {
  loading.value = true
  try {
    lecturePackage.value = await exportLecturePackage(selectedDynasty.value)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadDeviation() {
  try {
    deviationProfile.value = await getDeviationProfile(classId.value)
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadLecture()
  loadDeviation()
})
</script>

<template>
  <div class="teach-view">
    <div class="teach-header">
      <h2>教师端 · 备课与讲解</h2>
      <div class="dynasty-selector">
        <button
          :class="{ active: selectedDynasty === 'tang' }"
          @click="selectedDynasty = 'tang'; loadLecture()"
        >唐</button>
        <button
          :class="{ active: selectedDynasty === 'ming' }"
          @click="selectedDynasty = 'ming'; loadLecture()"
        >明</button>
      </div>
    </div>

    <div class="teach-body">
      <section class="lecture-section">
        <h3>讲解包 · {{ lecturePackage?.dynasty ?? '' }}</h3>

        <div v-if="loading" class="loading">加载中...</div>

        <template v-else-if="lecturePackage">
          <div class="subsection">
            <h4>地图切片 ({{ lecturePackage.maps.length }})</h4>
            <div class="map-list">
              <div v-for="(m, i) in lecturePackage.maps" :key="i" class="map-item">
                {{ m.title }} · {{ m.year }}年 · {{ m.layer }}
              </div>
            </div>
          </div>

          <div class="subsection">
            <h4>课堂问题 ({{ lecturePackage.questions.length }})</h4>
            <div v-for="(q, i) in lecturePackage.questions" :key="i" class="question-item">
              <div class="question-text">{{ i + 1 }}. {{ q.question }}</div>
              <div class="question-options">
                <div v-for="(opt, j) in q.options" :key="j" class="option">
                  {{ String.fromCharCode(65 + j) }}. {{ opt }}
                </div>
              </div>
              <div class="question-answer">正确答案：{{ q.correctAnswer }}</div>
              <div class="question-evidence">出处：{{ q.evidenceSource }}</div>
            </div>
          </div>

          <div class="subsection">
            <h4>出处卡片 ({{ lecturePackage.evidenceCards.length }})</h4>
            <div class="evidence-grid">
              <div v-for="(card, i) in lecturePackage.evidenceCards" :key="i" class="evidence-card">
                <div class="card-source">{{ card.source }}</div>
                <div class="card-quote">"{{ card.quote }}"</div>
                <div class="card-confidence">{{ card.confidence }}</div>
              </div>
            </div>
          </div>
        </template>
      </section>

      <section class="deviation-section">
        <h3>认知偏差画像 · {{ classId }}</h3>

        <div v-if="deviationProfile">
          <div class="deviation-summary">{{ deviationProfile.summary }}</div>

          <div class="deviation-stats">
            <div class="stat">
              <span class="stat-label">作答总数</span>
              <span class="stat-value">{{ deviationProfile.totalAnswers }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">学生人数</span>
              <span class="stat-value">{{ deviationProfile.totalStudents }}</span>
            </div>
          </div>

          <div v-if="deviationProfile.deviations.length > 0" class="deviation-list">
            <div v-for="(d, i) in deviationProfile.deviations" :key="i" class="deviation-item">
              <div class="deviation-type">{{ d.type }}</div>
              <div class="deviation-count">{{ d.count }} 人</div>
              <div class="deviation-suggestion">{{ d.suggestion }}</div>
            </div>
          </div>
          <div v-else class="no-deviation">暂无偏差数据，等待学生作答</div>
        </div>

        <button class="refresh-btn" @click="loadDeviation">刷新画像</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.teach-view {
  height: 100%;
  overflow-y: auto;
  background: #0f0f1e;
  color: #e0e0e0;
  padding: 1rem;
}
.teach-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.teach-header h2 {
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
.teach-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
}
.lecture-section,
.deviation-section {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 8px;
}
.lecture-section h3,
.deviation-section h3 {
  font-size: 16px;
  margin: 0 0 1rem;
}
.subsection {
  margin-bottom: 1.5rem;
}
.subsection h4 {
  font-size: 14px;
  color: #aaa;
  margin: 0 0 0.5rem;
}
.map-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.map-item {
  font-size: 13px;
  padding: 0.25rem 0.5rem;
  background: #16213e;
  border-radius: 4px;
}
.question-item {
  background: #16213e;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}
.question-text {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 0.5rem;
}
.question-options {
  font-size: 13px;
  color: #ccc;
  margin-bottom: 0.5rem;
}
.option {
  padding: 0.1rem 0;
}
.question-answer {
  font-size: 13px;
  color: #4caf50;
}
.question-evidence {
  font-size: 12px;
  color: #4fc3f7;
}
.evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
}
.evidence-card {
  background: #16213e;
  padding: 0.5rem;
  border-radius: 4px;
}
.card-source {
  font-size: 13px;
  color: #4fc3f7;
  font-weight: bold;
}
.card-quote {
  font-size: 12px;
  color: #ccc;
  font-style: italic;
}
.card-confidence {
  font-size: 11px;
  color: #888;
}
.deviation-summary {
  font-size: 14px;
  color: #ff9800;
  background: #16213e;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}
.deviation-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.stat {
  background: #16213e;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}
.stat-label {
  display: block;
  font-size: 12px;
  color: #888;
}
.stat-value {
  display: block;
  font-size: 18px;
  color: #fff;
}
.deviation-item {
  background: #16213e;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}
.deviation-type {
  font-size: 14px;
  color: #ff9800;
  font-weight: bold;
}
.deviation-count {
  font-size: 13px;
  color: #f44336;
}
.deviation-suggestion {
  font-size: 12px;
  color: #ccc;
  margin-top: 0.25rem;
}
.no-deviation {
  font-size: 14px;
  color: #888;
  text-align: center;
  padding: 2rem;
}
.refresh-btn {
  width: 100%;
  padding: 0.5rem;
  background: #0f3460;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}
.loading {
  text-align: center;
  padding: 2rem;
  color: #888;
}

/* 窄屏：左右两栏改为单列堆叠，头部允许换行 */
@media (max-width: 900px) {
  .teach-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .teach-body {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .teach-view {
    padding: 0.75rem;
  }
  .lecture-section,
  .deviation-section {
    padding: 0.75rem;
  }
}
</style>