import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Helpers — inline schedule logic so the Vercel function is self-contained
// ---------------------------------------------------------------------------

const GRANDMA_ANCHOR = '2026-05-07';
const GRANDMA_SEQUENCE = ['KC', 'KG', 'KB'];
const GRANDMA_DAYS = 14;

const LOCATION_NAMES: Record<string, { en: string; zh: string }> = {
  KC: { en: 'Kay Cheow (Dad\'s place)', zh: '启超 (爸爸家)' },
  KG: { en: 'Kay Guan', zh: '启源' },
  KB: { en: 'Kay Boon', zh: '启文' },
};

function daysBetween(a: string, b: string): number {
  const [yA, mA, dA] = a.split('-').map(Number);
  const [yB, mB, dB] = b.split('-').map(Number);
  return Math.round((Date.UTC(yA, mA - 1, dA) - Date.UTC(yB, mB - 1, dB)) / 86400000);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().split('T')[0];
}

function getAhmaInfo(dateStr: string) {
  const diff = daysBetween(dateStr, GRANDMA_ANCHOR);
  const total = GRANDMA_SEQUENCE.length * GRANDMA_DAYS;
  const cycleDay = ((diff % total) + total) % total;
  const locIdx = Math.floor(cycleDay / GRANDMA_DAYS);
  const code = GRANDMA_SEQUENCE[locIdx];
  const dayInStay = (cycleDay % GRANDMA_DAYS) + 1;
  const daysLeft = GRANDMA_DAYS - dayInStay;
  const nextCode = GRANDMA_SEQUENCE[(locIdx + 1) % GRANDMA_SEQUENCE.length];
  const nextDate = addDays(dateStr, daysLeft + 1);
  return { code, dayInStay, daysLeft, nextCode, nextDate };
}

/** Find next date Ahma arrives at a given location code from a start date */
function nextAhmaVisit(fromDate: string, targetCode: string): { date: string; daysFromNow: number } {
  for (let i = 0; i <= GRANDMA_DAYS * GRANDMA_SEQUENCE.length * 2; i++) {
    const d = addDays(fromDate, i);
    const info = getAhmaInfo(d);
    if (info.code === targetCode && info.dayInStay === 1) {
      return { date: d, daysFromNow: i };
    }
  }
  return { date: '?', daysFromNow: -1 };
}

// ---------------------------------------------------------------------------
// Language detection — based on message content, NOT app language setting
// ---------------------------------------------------------------------------
function detectLanguage(text: string): 'en' | 'zh' {
  return /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Detect language from the message itself — not from the app UI language
  const lang = detectLanguage(message);
  const today = new Date().toISOString().split('T')[0];

  // ---------------------------------------------------------------------------
  // Pre-compute calendar context to inject into Gemini prompt
  // ---------------------------------------------------------------------------
  const ahmaToday = getAhmaInfo(today);
  const todayLocName = LOCATION_NAMES[ahmaToday.code] ?? { en: ahmaToday.code, zh: ahmaToday.code };

  // Next visits to each location
  const nextKC = nextAhmaVisit(today, 'KC');
  const nextKG = nextAhmaVisit(today, 'KG');
  const nextKB = nextAhmaVisit(today, 'KB');

  const calendarContext = `
Today: ${today}
Ahma today: ${ahmaToday.code} (${todayLocName.en}) — Day ${ahmaToday.dayInStay} of ${GRANDMA_DAYS}. ${ahmaToday.daysLeft} days left, then moves to ${ahmaToday.nextCode} on ${ahmaToday.nextDate}.
Next KC (Kay Cheow/Dad's) visit: ${nextKC.date} (in ${nextKC.daysFromNow} days)
Next KG (Kay Guan) visit: ${nextKG.date} (in ${nextKG.daysFromNow} days)
Next KB (Kay Boon) visit: ${nextKB.date} (in ${nextKB.daysFromNow} days)`;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are Ahma Bot 🌸 — a warm, friendly family assistant for the "Ahma's Rotation" app used by a Singapore Chinese family. You're like a family member: helpful, cheerful, and happy to chat about anything.

IMPORTANT: Always respond in the SAME language as the user's message. If they write in English, respond in English. If they write in Chinese (中文), respond in Chinese. Never switch languages unless asked.

You have access to live calendar data:
${calendarContext}

Family rotation rules:
- Ahma rotates: Kay Cheow (KC, Dad's place) → Kay Guan (KG) → Kay Boon (KB), 14 days each
- Anchor: 7 May 2026 @ Kay Cheow. Sequence repeats indefinitely.
- CNY special: Eve (5pm) to Day 2 (8pm) at: 2026→KG, 2027→KB, 2028→KC, 2029→KG, repeating
- Jun Jie 3-week roster from Mon 15 Jun 2026:
  Week 1: Mon-Tue Night (2200-0900), Wed OFF, Thu REST, Fri-Sun Morning (0630-1530)
  Week 2: Mon Morning (0630-1530), Tue OFF, Wed-Thu Afternoon 1 (1400-0100), Fri-Sat Afternoon 2 (1500-0200), Sun REST
  Week 3: Mon OFF, Tue-Thu Morning (0630-1530), Fri REST, Sat-Sun Afternoon 3 (1600-0100)

Abbreviations: KC=Kay Cheow (Dad's place), KG=Kay Guan, KB=Kay Boon, JJ/jj=Jun Jie, LT/lt=Lay Ting

Answer guidelines:
- For "when is Ahma next at KC/KG/KB" — use the pre-computed next visit dates above
- For shift questions without a date — use today's date
- For casual chat — just be warm and natural, no need to mention the calendar
- Keep answers concise and friendly, no markdown headers
- Plain text only, use • for bullet points if needed`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] }],
      });

      if (response.text?.trim()) {
        return res.status(200).json({ reply: response.text.trim() });
      }
    } catch (err: any) {
      console.warn('[chat] Gemini failed:', err?.message ?? err);
    }
  }

  // Fallback — return empty so frontend local solver handles it
  return res.status(200).json({ reply: '' });
}
