import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface LecturePackage {
  dynasty: string
  maps: { title: string; year: number; layer: string }[]
  questions: { id: string; question: string; options: string[]; correctAnswer: string; evidenceSource: string }[]
  evidenceCards: { source: string; quote: string; confidence: string }[]
}

export async function exportLecturePackage(dynasty: string): Promise<LecturePackage> {
  const { data } = await api.post<LecturePackage>('/lecture/export', { dynasty })
  return data
}