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

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = `You are Ahma Bot 🌸, a warm and friendly family assistant for the "Ahma's Rotation" (阿嬷轮流表) app. You love chatting with the family and can talk about anything — daily life, food, feelings, general questions, or just casual conversation. You are helpful, cheerful, and feel like a family member yourself.

Your specialty is the family calendar:
- Elder: Ahma (阿嬷) rotates between Kay Cheow (启超/KC) → Kay Guan (启源/KG) → Kay Boon (启文/KB), 14 days per house.
- Ahma anchor: 7 May 2026 starts at Kay Cheow (启超/KC). Note: KC is also known as Dad's place.
- CNY Special Arrangement (Eve 5pm → Day 2 8pm): 2026 KG, 2027 KB, 2028 KC, 2029 KG, repeating.
- Jun Jie (俊杰) 3-week shift roster anchored Monday 15 June 2026:
  Week 1: Mon-Tue Night/晚 (2200-0900), Wed OFF, Thu REST, Fri-Sun Morning/早 (0630-1530)
  Week 2: Mon Morning/早 (0630-1530), Tue OFF, Wed-Thu Afternoon 1/午1 (1400-0200), Fri-Sat Afternoon 2/午2 (1500-0100), Sun REST
  Week 3: Mon OFF, Tue-Thu Morning/早 (0630-1530), Fri REST, Sat-Sun Afternoon 3/午3 (1600-0100)
- Shift Chinese short forms: Morning=早, Afternoon 1=午1, Afternoon 2=午2, Afternoon 3=午3, Night=晚, OFF=休, REST=休息
- Abbreviations: "JJ"/"jj" = Jun Jie (俊杰), "LT"/"lt" = Lay Ting (丽婷), "KC" = Kay Cheow (Dad's place).

When answering about events, trips, or plans on the calendar, if the user's language is Chinese (中文) translate event titles and details into Chinese naturally. If English, keep in English.
For casual chat, just be natural and warm. For calendar questions, be accurate and concise.
Answer in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Keep responses friendly and practical.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
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
