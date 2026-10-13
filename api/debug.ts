import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groqKey       = process.env.GROQ_API_KEY;
  const githubToken   = process.env.GITHUB_TOKEN;
  const githubRepo    = process.env.GITHUB_REPO;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

  const result: Record<string, unknown> = {
    deployedCommit: '6acdf7c',
    todaySGT: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0],
    env: {
      TELEGRAM_BOT_TOKEN: telegramToken ? `set (ends ...${telegramToken.slice(-4)})` : 'NOT SET ❌',
      GROQ_API_KEY:       groqKey       ? `set (ends ...${groqKey.slice(-4)})`       : 'NOT SET ❌',
      GITHUB_TOKEN:       githubToken   ? `set (ends ...${githubToken.slice(-4)})`   : 'NOT SET ⚠️ (Local memory only)',
      GITHUB_REPO:        githubRepo    ?? 'tanlt227/Ahma-rotation',
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
      model: 'llama-3.1-8b-instant',
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
