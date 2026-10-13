import Groq from 'groq-sdk';

export const GROQ_CANDIDATE_MODELS = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
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
      // Disable qwen reasoning mode to prevent empty content responses
      const extraParams = model.includes('qwen') ? { reasoning_effort: 'none' } : {};
      const completion = (await groq.chat.completions.create({
        ...params,
        ...extraParams,
        model,
      } as Parameters<Groq['chat']['completions']['create']>[0])) as Groq.Chat.ChatCompletion;
      // Extract content — some models use reasoning/reasoning_content instead of content
      const msg = completion.choices[0]?.message as any;
      const content = msg?.content?.trim()
        || msg?.reasoning_content?.trim()
        || msg?.reasoning?.trim()
        || '';
      if (!content) {
        console.warn(`[groq] Model ${model} returned empty content, trying next model...`);
        continue;
      }
      return { completion, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const isNotFound =
        err?.status === 404 ||
        err?.message?.includes('model_not_found') ||
        err?.error?.code === 'model_not_found';
      const isRetryable =
        err?.status === 429 || err?.status === 503 ||
        String(err?.message ?? '').includes('429') ||
        String(err?.message ?? '').includes('503') ||
        String(err?.message ?? '').includes('overloaded') ||
        String(err?.message ?? '').includes('rate_limit');
      if (isNotFound || isRetryable) {
        console.warn(`[groq] Model ${model} unavailable (${err?.status ?? 'unknown'}), trying next model...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
