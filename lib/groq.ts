import Groq from 'groq-sdk';

export const GROQ_CANDIDATE_MODELS = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
];

export type GroqChatParams = Omit<Parameters<Groq['chat']['completions']['create']>[0], 'model'>;

/**
 * Executes a chat completion with automatic model fallback.
 * If the current model returns 404 (model_not_found), it tries the next candidate model.
 */
export async function createGroqChat(
  groq: Groq,
  params: GroqChatParams
): Promise<{ completion: Groq.Chat.ChatCompletion; modelUsed: string }> {
  let lastError: any = null;

  for (const model of GROQ_CANDIDATE_MODELS) {
    try {
      const completion = (await groq.chat.completions.create({
        ...params,
        model,
      } as Parameters<Groq['chat']['completions']['create']>[0])) as Groq.Chat.ChatCompletion;
      return { completion, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const isNotFound =
        err?.status === 404 ||
        err?.message?.includes('model_not_found') ||
        err?.error?.code === 'model_not_found';
      if (isNotFound) {
        console.warn(`[groq] Model ${model} not found or inaccessible, trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
