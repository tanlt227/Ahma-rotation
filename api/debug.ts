import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const groqKey     = (process.env.GROQ_API_KEY ?? '').trim();
    const githubToken = (process.env.GITHUB_TOKEN ?? '').trim();
    const githubRepo  = (process.env.GITHUB_REPO ?? '').trim() || 'tanlt227/Ahma-rotation';
    const githubPath  = (process.env.GITHUB_PATH ?? '').trim() || 'data/calendar-data.json';
    const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

    const result: Record<string, unknown> = {
      todaySGT: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0],
      env: {
        GROQ_API_KEY:       groqKey       ? `set ✅ (ends ...${groqKey.slice(-4)})`       : 'NOT SET ❌',
        GITHUB_TOKEN:       githubToken   ? `set ✅ (ends ...${githubToken.slice(-4)})`   : 'NOT SET ❌ (no cross-device sync)',
        GITHUB_REPO:        githubRepo,
        TELEGRAM_BOT_TOKEN: telegramToken ? `set ✅ (ends ...${telegramToken.slice(-4)})` : 'NOT SET ❌',
      },
      groq: null as unknown,
      github: null as unknown,
    };

    // --- Test Groq ---
    if (groqKey) {
      const FREE_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'llama3-8b-8192'];
      let groqResult: Record<string, unknown> = { status: 'all models failed ❌' };

      for (const model of FREE_MODELS) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Reply with exactly: GROQ_OK' }],
              max_tokens: 16,
            }),
          });
          const data = await groqRes.json();
          if (groqRes.ok && data.choices?.[0]?.message?.content) {
            groqResult = { status: 'success ✅', modelUsed: model, reply: data.choices[0].message.content.trim() };
            break;
          } else if (data.error?.code === 'model_not_found') {
            groqResult = { ...groqResult, [`${model}`]: 'model_not_found — trying next' };
            continue;
          } else {
            groqResult = { status: `failed ❌`, model, error: data.error?.message ?? JSON.stringify(data) };
            break;
          }
        } catch (err: any) {
          groqResult = { status: 'network error ❌', error: err?.message };
          break;
        }
      }
      result.groq = groqResult;
    } else {
      result.groq = 'skipped — GROQ_API_KEY not set';
    }

    // --- Test GitHub write ---
    if (githubToken) {
      try {
        const url = `https://api.github.com/repos/${githubRepo}/contents/${githubPath}`;
        const ghHeaders: Record<string, string> = {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        };

        const getRes = await fetch(url, { headers: ghHeaders });

        if (getRes.ok) {
          const file: any = await getRes.json();
          const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));

          // Test write: bump version number and write back
          const testState = { ...state, version: (state.version ?? 1) + 1, lastUpdated: new Date().toISOString() };
          const putRes = await fetch(url, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
              message: 'chore: debug write test',
              content: Buffer.from(JSON.stringify(testState, null, 2)).toString('base64'),
              sha: file.sha,
              committer: { name: 'Ahma Debug', email: 'debug@ahma-rotation.app' },
            }),
          });

          if (putRes.ok) {
            result.github = {
              status: 'read+write ✅',
              eventCount: state.events?.length ?? 0,
              version: `${state.version} → ${testState.version}`,
              lastUpdated: testState.lastUpdated,
              sha: file.sha.slice(0, 8),
            };
          } else {
            const putErr = await putRes.text();
            result.github = {
              status: `read ✅ write ❌ HTTP ${putRes.status}`,
              eventCount: state.events?.length ?? 0,
              writeError: putErr.slice(0, 200),
            };
          }
        } else if (getRes.status === 404) {
          result.github = { status: 'file not found ⚠️ — visit /api/init-state first' };
        } else {
          const body = await getRes.text();
          result.github = { status: `failed ❌ HTTP ${getRes.status}`, body };
        }
      } catch (err: any) {
        result.github = { status: 'error ❌', error: err?.message ?? String(err) };
      }
    } else {
      result.github = 'skipped — GITHUB_TOKEN not set';
    }

    // --- Test chat (joke) directly via Groq ---
    if (groqKey) {
      try {
        const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: 'Tell me a very short joke in one sentence.' },
            ],
            max_tokens: 64,
            temperature: 0.7,
          }),
        });
        const chatData = await chatRes.json();
        if (chatRes.ok && chatData.choices?.[0]?.message?.content) {
          result.chatTest = { status: 'success ✅', model: chatData.model, reply: chatData.choices[0].message.content.trim() };
        } else {
          result.chatTest = { status: 'failed ❌', error: chatData.error?.message ?? JSON.stringify(chatData) };
        }
      } catch (err: any) {
        result.chatTest = { status: 'error ❌', error: err?.message };
      }
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Debug handler crashed', detail: err?.message ?? String(err) });
  }
}
