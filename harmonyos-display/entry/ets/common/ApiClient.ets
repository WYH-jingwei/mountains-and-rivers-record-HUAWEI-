import { http } from '@kit.NetworkKit';

const API_BASE = 'http://192.168.1.100:3000/api';

export interface GradedResponse {
  level: number;
  answer: string;
  evidence: { source: string; quote: string; confidence: string }[];
  uncertainty: string[];
  mapAction?: { dynasty: string; year?: number; layer: string; focus?: number[] };
}

export interface LecturePackage {
  dynasty: string;
  maps: { title: string; year: number; layer: string }[];
  questions: { id: string; question: string; options: string[]; correctAnswer: string; evidenceSource: string }[];
  evidenceCards: { source: string; quote: string; confidence: string }[];
}

export async function askQuestion(question: string): Promise<GradedResponse> {
  const req = http.createHttp();
  const res = await req.request(API_BASE + '/qa', {
    method: http.RequestMethod.POST,
    header: { 'Content-Type': 'application/json' },
    extraData: JSON.stringify({ question })
  });
  req.destroy();
  return JSON.parse(res.result as string) as GradedResponse;
}

export async function exportLecture(dynasty: string): Promise<LecturePackage> {
  const req = http.createHttp();
  const res = await req.request(API_BASE + '/lecture/export', {
    method: http.RequestMethod.POST,
    header: { 'Content-Type': 'application/json' },
    extraData: JSON.stringify({ dynasty })
  });
  req.destroy();
  return JSON.parse(res.result as string) as LecturePackage;
}