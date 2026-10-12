import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

/**
 * POST /api/translate
 * Body: { text: string, notes?: string }
 * Returns: { en: string, zh: string, notesEn?: string, notesZh?: string }
 *
 * Detects the source language and returns both EN and ZH versions.
 * Used by EventModal to auto-translate event titles and notes on save.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, notes } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No API key — return original text for both languages as fallback
    return res.status(200).json({
      en: text,
      zh: text,
      notesEn: notes || '',
      notesZh: notes || '',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build prompt — translate title and optionally notes in one call
    const notesPart = notes?.trim()
      ? `\nNotes: "${notes.trim()}"`
      : '';

    const prompt = `You are a bilingual translator for a family calendar app used by a Singapore Chinese family.

Translate the following calendar event title (and optional notes) into BOTH English and Chinese (Simplified).
- Keep translations natural and concise — this is for a calendar badge, not a formal document.
- Preserve proper nouns, place names, and names as-is (e.g. "Sentosa", "Ahma", "Kay Cheow", "启超").
- If the input is already in one language, provide a natural translation into the other.
- Respond ONLY with valid JSON, no extra text.

Input:
Title: "${text.trim()}"${notesPart}

Respond with this exact JSON schema:
{
  "en": "<English title>",
  "zh": "<Chinese title>",
  "notesEn": "<English notes or empty string>",
  "notesZh": "<Chinese notes or empty string>"
}`;

    // Retry up to 3 times on 503 (model overload)
    let parsed: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const raw = response.text?.trim() ?? '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        parsed = JSON.parse(jsonMatch[0]);
        break;
      } catch (err: any) {
        const is503 = String(err?.message ?? err).includes('503') || String(err?.message ?? err).includes('UNAVAILABLE');
        if (is503 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    if (!parsed) throw new Error('No parsed response');

    return res.status(200).json({
      en:       parsed.en       || text,
      zh:       parsed.zh       || text,
      notesEn:  parsed.notesEn  || notes || '',
      notesZh:  parsed.notesZh  || notes || '',
    });
  } catch (err) {
    console.error('[translate] Gemini failed:', err);
    // Graceful fallback — return original for both languages
    return res.status(200).json({
      en: text,
      zh: text,
      notesEn: notes || '',
      notesZh: notes || '',
    });
  }
}
