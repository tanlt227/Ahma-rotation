import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groqKey    = process.env.GROQ_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo  = process.env.GITHUB_REPO;

  const result: Record<string, unknown> = {
    env: {
      GROQ_API_KEY:  groqKey     ? `set (ends ...${groqKey.slice(-4)})`     : 'NOT SET ❌',
      GITHUB_TOKEN:  githubToken ? `set (ends ...${githubToken.slice(-4)})` : 'NOT SET ❌',
      GITHUB_REPO:   githubRepo  ?? 'NOT SET ❌',
    },
    groq: null as unknown,
  };

  if (!groqKey) {
    result.groq = 'skipped — GROQ_API_KEY not set';
    return res.status(200).json(result);
  }

  try {
    const groq = new Groq({ apiKey: groqKey });
    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: 'Reply with exactly: GROQ_OK' }],
      max_tokens: 16,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    result.groq = { status: 'success ✅', reply };
  } catch (err: any) {
    result.groq = { status: 'failed ❌', error: err?.message ?? String(err) };
  }

  return res.status(200).json(result);
}
