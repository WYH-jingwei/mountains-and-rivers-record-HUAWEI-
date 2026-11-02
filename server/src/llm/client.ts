/**
 * 华为云 ModelArts Studio（MaaS）客户端，同时兼容任意 OpenAI 协议网关。
 * 对话与向量使用不同根路径（MaaS 实际地址），共享同一个 API Key：
 *   对话根 LLM_BASE_URL      默认 https://api.modelarts-maas.com/openai/v1
 *   向量根 EMBEDDING_BASE_URL 默认 https://api.modelarts-maas.com/v1
 * 仅使用 Node 内置 fetch，不引入额外 SDK 依赖。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_CHAT_BASE = 'https://api.modelarts-maas.com/openai/v1';
const DEFAULT_EMBEDDING_BASE = 'https://api.modelarts-maas.com/v1';

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function chatBase(): string {
  return trimSlash(process.env.LLM_BASE_URL || DEFAULT_CHAT_BASE);
}

function embeddingBase(): string {
  return trimSlash(process.env.EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE);
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.EMBEDDING_MODEL);
}

/** 单次上游请求超时（毫秒）：模型侧挂起时及时失败，避免前端问答被无限阻塞。 */
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20000);

/** MaaS 单请求向量条数有限制，构建全库向量时按批串行请求。 */
const EMBEDDING_BATCH_SIZE = 32;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`上游请求超时（${REQUEST_TIMEOUT_MS}ms）：${url}`);
    }
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface EmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

/** 生成文本向量；input 为单条或多条。 */
export async function createEmbedding(input: string | string[]): Promise<number[][]> {
  const resp = await postJson<EmbeddingResponse>(`${embeddingBase()}/embeddings`, {
    model: process.env.EMBEDDING_MODEL,
    input,
    encoding_format: 'float',
  });
  return resp.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}

/** 分批生成向量（每批 32 条），返回顺序与 inputs 一致。 */
export async function createEmbeddingBatched(
  inputs: string[],
  batchSize = EMBEDDING_BATCH_SIZE,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const vecs = await createEmbedding(batch);
    if (vecs.length !== batch.length) {
      throw new Error(`embedding 返回条数不匹配：${vecs.length}/${batch.length}`);
    }
    out.push(...vecs);
  }
  return out;
}

interface ChatResponse {
  choices: { message: { content: string } }[];
}

/** 对话补全，返回首条助手文本。 */
export async function chatCompletion(
  messages: ChatMessage[],
  temperature = 0.3,
): Promise<string> {
  const resp = await postJson<ChatResponse>(`${chatBase()}/chat/completions`, {
    model: process.env.LLM_MODEL,
    messages,
    temperature,
  });
  const content = resp.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回为空');
  return content.trim();
}
