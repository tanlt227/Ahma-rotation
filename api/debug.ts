import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

/**
 * GET /api/debug
 * Diagnostic endpoint — shows env var status and tests Gemini connectivity.
 * Remove or protect this endpoint before going fully public.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const geminiKey   = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo  = process.env.GITHUB_REPO;

  const result: Record<string, unknown> = {
    env: {
      GEMINI_API_KEY:  geminiKey  ? `set (ends ...${geminiKey.slice(-4)})`  : 'NOT SET ❌',
      GITHUB_TOKEN:    githubToken ? `set (ends ...${githubToken.slice(-4)})` : 'NOT SET ❌',
      GITHUB_REPO:     githubRepo  ?? 'NOT SET ❌',
    },
    gemini: null as unknown,
  };

  if (!geminiKey) {
    result.gemini = 'skipped — GEMINI_API_KEY not set';
    return res.status(200).json(result);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: GEMINI_OK' }] }],
    });
    result.gemini = {
      status: 'success ✅',
      reply: response.text?.trim(),
    };
  } catch (err: any) {
    result.gemini = {
      status: 'failed ❌',
      error: err?.message ?? String(err),
    };
  }

  return res.status(200).json(result);
}
