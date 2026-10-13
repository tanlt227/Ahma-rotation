import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { createGroqChat } from '../lib/groq';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groqKey       = (process.env.GROQ_API_KEY ?? '').trim();
  const githubToken   = (process.env.GITHUB_TOKEN ?? '').trim();
  const githubRepo    = (process.env.GITHUB_REPO ?? '').trim();
  const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

  const result: Record<string, unknown> = {
    deployedCommit: '04cc2a0',
    todaySGT: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0],
    env: {
      TELEGRAM_BOT_TOKEN: telegramToken ? `set (ends ...${telegramToken.slice(-4)}) ✅` : 'NOT SET ❌',
      GROQ_API_KEY:       groqKey       ? `set (ends ...${groqKey.slice(-4)}) ✅`       : 'NOT SET ❌',
      GITHUB_TOKEN:       githubToken   ? `set (ends ...${githubToken.slice(-4)}) ✅`   : 'NOT SET ⚠️ (Local memory only)',
      GITHUB_REPO:        githubRepo    || 'tanlt227/Ahma-rotation',
    },
    groq: null as unknown,
  };

  if (!groqKey) {
    result.groq = 'skipped — GROQ_API_KEY not set';
    return res.status(200).json(result);
  }

  try {
    const groq = new Groq({ apiKey: groqKey });
    const { completion, modelUsed } = await createGroqChat(groq, {
      messages: [{ role: 'user', content: 'Reply with exactly: GROQ_OK' }],
      max_tokens: 16,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    result.groq = { status: 'success ✅', modelUsed, reply };
  } catch (err: any) {
    result.groq = { status: 'failed ❌', error: err?.message ?? String(err) };
  }

  // Test GitHub sync
  if (githubToken) {
    try {
      const repo = githubRepo || 'tanlt227/Ahma-rotation';
      const path = process.env.GITHUB_PATH || 'data/calendar-data.json';
      const url = `https://api.github.com/repos/${repo}/contents/${path}`;
      const ghRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (ghRes.ok) {
        const file: any = await ghRes.json();
        const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
        result.github = { status: 'success ✅', eventCount: state.events?.length ?? 0, version: state.version, lastUpdated: state.lastUpdated };
      } else if (ghRes.status === 404) {
        result.github = { status: 'file not found ⚠️ — will be created on first save', sha: null };
      } else {
        result.github = { status: `failed ❌ ${ghRes.status}`, body: await ghRes.text() };
      }
    } catch (err: any) {
      result.github = { status: 'failed ❌', error: err?.message ?? String(err) };
    }
  } else {
    result.github = 'skipped — GITHUB_TOKEN not set';
  }

  return res.status(200).json(result);
}
