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
  figure?: string
}

export interface RelatedQuestion {
  id: string
  question: string
}

/** 单条召回：命中条目 + 命中路径 + 分数，用于“检索依据”面板展示。 */
export interface RetrievalHitTrace {
  id: string
  dynasty: string
  question: string
  via: 'semantic' | 'keyword' | 'hybrid'
  score: number
  semScore?: number
  kwScore?: number
}

/** 检索与定级溯源：只做解释展示，不参与分级。 */
export interface RetrievalTrace {
  effectiveQuestion: string
  rewritten: boolean
  dynastyCodes: string[]
  hits: RetrievalHitTrace[]
  rationale: string
}

export interface GradedResponse {
  level: 1 | 2 | 3 | 4
  answer: string
  evidence: Evidence[]
  uncertainty: string[]
  mapAction?: MapAction
  relatedQuestions?: RelatedQuestion[]
  retrieval?: RetrievalTrace
}

export interface HistoryTurn {
  role: 'user' | 'assistant'
  text: string
}

export async function askQuestion(
  question: string,
  history?: HistoryTurn[],
): Promise<GradedResponse> {
  const { data } = await api.post<GradedResponse>('/qa', { question, history })
  return data
}