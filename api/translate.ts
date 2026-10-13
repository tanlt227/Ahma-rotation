import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { createGroqChat } from '../lib/groq';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, notes } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = (process.env.GROQ_API_KEY ?? '').trim();
  if (!apiKey) {
    return res.status(200).json({ en: text, zh: text, notesEn: notes || '', notesZh: notes || '' });
  }

  const notesPart = notes?.trim() ? `\nNotes: "${notes.trim()}"` : '';

  const prompt = `You are a bilingual translator for a Singapore Chinese family calendar app.
Translate the calendar event title (and optional notes) into BOTH English and Chinese (Simplified).
- Keep it natural and concise — this is a calendar badge, not a formal document.
- Preserve proper nouns as-is: "Sentosa", "Ahma", "Kay Cheow", "启超", "Guizhou", "贵州", names of people and places.
- If input is already in one language, provide a natural translation into the other.
- Respond ONLY with valid JSON, no extra text, no markdown.

Input:
Title: "${text.trim()}"${notesPart}

JSON schema (respond with exactly this):
{"en":"<English title>","zh":"<Chinese title>","notesEn":"<English notes or empty>","notesZh":"<Chinese notes or empty>"}`;

  try {
    const groq = new Groq({ apiKey });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { completion } = await createGroqChat(groq, {
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 256,
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? '';
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        const parsed = JSON.parse(jsonMatch[0]);

        return res.status(200).json({
          en:      parsed.en      || text,
          zh:      parsed.zh      || text,
          notesEn: parsed.notesEn || notes || '',
          notesZh: parsed.notesZh || notes || '',
        });
      } catch (err: any) {
        const isRetryable = String(err?.message ?? err).includes('503') ||
                            String(err?.message ?? err).includes('429');
        if (isRetryable && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    console.error('[translate] Groq failed:', err);
  }

  // Fallback — return original text for both languages
  return res.status(200).json({ en: text, zh: text, notesEn: notes || '', notesZh: notes || '' });
}
