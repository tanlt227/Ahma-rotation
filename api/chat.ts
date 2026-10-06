import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, language } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = `You are the friendly family calendar assistant for the "Ahma's Rotation" (阿嬷轮流表) web app.
Key facts:
- Elder: Ahma (阿嬷) rotates between Kay Cheow (启超/KC) -> Kay Guan (启源/KG) -> Kay Boon (启文/KB), default 14 days per house.
- Fortnightly cycle anchor: 7 May 2026 starts at Kay Cheow (启超).
- Jun Jie (俊杰): Police / shift worker on a 3-week repeating roster.
- Roster details:
  * Week 1: Mon (Night 2200-0900), Tue (Night 2200-0900), Wed (OFF), Thu (REST), Fri (Morning 0630-1530), Sat (Morning 0630-1530), Sun (Morning 0630-1530)
  * Week 2: Mon (OFF), Tue (REST), Wed (Afternoon 1 1600-0100), Thu (Afternoon 1 1600-0100), Fri (Afternoon 1 1600-0100), Sat (Afternoon 2 1400-0100), Sun (Afternoon 3 1500-0200)
  * Week 3: Mon (OFF), Tue (REST), Wed (OFF), Thu (REST), Fri (Night 2200-0900), Sat (Night 2200-0900), Sun (Night 2200-0900)
- Jun Jie roster anchor: Monday 15 June 2026 is Week 1 Monday.
- Context: Singapore public holidays and family coordination.
Answer clearly and warmly in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Keep responses concise and practical.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nQuestion: ${message}` }],
          },
        ],
      });

      if (response.text) {
        return res.status(200).json({ reply: response.text });
      }
    } catch (err: any) {
      console.warn('Vercel Gemini API call failed:', err?.message || err);
    }
  }

  // If no API key or failed, return empty reply so client-side solver answers instantly
  return res.status(200).json({ reply: '' });
}
