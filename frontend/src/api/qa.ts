import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface Evidence {
  source: string
  quote: string
  confidence: 'high' | 'medium' | 'low'
}

export interface MapAction {
  dynasty: string
  year?: number
  layer: 'admin' | 'military' | 'journey' | 'cultural'
  focus?: [number, number]
}

export interface GradedResponse {
  level: 1 | 2 | 3 | 4
  answer: string
  evidence: Evidence[]
  uncertainty: string[]
  mapAction?: MapAction
}

export async function askQuestion(question: string): Promise<GradedResponse> {
  const { data } = await api.post<GradedResponse>('/qa', { question })
  return data
}