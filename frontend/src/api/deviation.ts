import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface DeviationItem {
  type: string
  count: number
  description: string
  suggestion: string
}

export interface DeviationProfile {
  classId: string
  totalAnswers: number
  totalStudents: number
  deviations: DeviationItem[]
  summary: string
}

export async function getDeviationProfile(classId: string): Promise<DeviationProfile> {
  const { data } = await api.get<DeviationProfile>(`/deviation/class/${classId}`)
  return data
}

export async function submitAnswer(
  studentId: string,
  classId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  await api.post('/deviation/answer', { studentId, classId, questionId, answer })
}