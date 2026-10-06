import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { solveChatLocally } from '../src/data/chatbotSolver';
import { DEFAULT_ROSTER_WEEKS } from '../src/data/schedule';

// ---------------------------------------------------------------------------
// Default settings mirroring server.ts DEFAULT_STATE — used when no
// persistent state is available (serverless has no in-memory store).
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  grandmaAnchorDate: '2026-05-07',
  grandmaCycleDays: 14,
  grandmaSequence: ['KC', 'KG', 'KB'],
  grandmaLocations: {
    KC: { name: 'Kay Cheow', notes: 'Kay Cheow (KC)' },
    KG: { name: 'Kay Guan', notes: 'Kay Guan (KG)' },
    KB: { name: 'Kay Boon', notes: 'Kay Boon (KB)' },
  },
  junjieAnchorDate: '2026-06-15',
  junjieCycleWeeks: 3,
  junjieRosterWeeks: DEFAULT_ROSTER_WEEKS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectLanguage(text: string): 'en' | 'zh' {
  return /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      // parse_mode omitted intentionally — Telegram's Markdown can choke on
      // asterisks in shift names like "Morning (0630-1530)". Plain text is safe.
    }),
  });
}

async function getAiReply(
  message: string,
  language: 'en' | 'zh',
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = `You are the friendly family calendar assistant for the "Ahma's Rotation" (阿嬷轮流表) app, now also accessible via Telegram.
Key facts:
- Elder: Ahma (阿嬷) rotates between Kay Cheow (启超/KC) -> Kay Guan (启源/KG) -> Kay Boon (启文/KB), default 14 days per house.
- Anchor: 7 May 2026 starts at Kay Cheow (启超/KC).
- CNY Special Arrangement (CNY Eve 5pm → CNY Day 2 8pm):
  * 2026: Kay Guan (KG) | 2027: Kay Boon (KB) | 2028: Kay Cheow (KC) | 2029: Kay Guan (KG) repeating.
- Jun Jie (俊杰) is a Police shift worker on a 3-week repeating roster anchored on Monday 15 June 2026:
  Week 1: Mon-Tue Night (2200-0900), Wed Off, Thu Rest, Fri-Sun Morning (0630-1530).
  Week 2: Mon Morning (0630-1530), Tue Off, Wed-Thu Afternoon 1 (1600-0100), Fri-Sat Afternoon 2 (1400-0100), Sun Rest.
  Week 3: Mon Off, Tue-Thu Morning (0630-1530), Fri Rest, Sat-Sun Afternoon 3 (1500-0200).
Answer clearly and warmly in ${language === 'zh' ? 'Chinese (中文)' : 'English'}. Keep responses concise and practical. Do NOT use Markdown formatting — plain text only.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nQuestion: ${message}` }],
      },
    ],
  });

  return response.text?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Vercel Serverless Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Telegram only POSTs to webhooks
  if (req.method !== 'POST') {
    return res.status(200).send('Ahma Rotation Telegram Webhook is active.');
  }

  // Always ACK Telegram immediately — if we take >5 s Telegram will retry
  res.status(200).end();

  const body = req.body;
  const msg = body?.message ?? body?.edited_message;

  // Ignore non-text updates (stickers, photos, etc.)
  if (!msg?.text) return;

  const chatId: number = msg.chat.id;
  const userText: string = msg.text.trim();
  const language = detectLanguage(userText);
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

  if (!TELEGRAM_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN env var is not set.');
    return;
  }

  // Handle /start command gracefully
  if (userText === '/start') {
    await sendTelegramMessage(
      TELEGRAM_TOKEN,
      chatId,
      language === 'zh'
        ? '您好！我是阿嬷日程小助手 🌸\n\n您可以问我：\n• 某一天阿嬷住在谁家（启超、启源、启文）\n• 俊杰的上下班班次\n• 新加坡公共假期\n\n例如：「2026年6月15日阿嬷住在哪里？」'
        : "Hello! I'm Ahma's Rotation Assistant 🌸\n\nYou can ask me:\n• Where Ahma is staying on any date (Kay Cheow, Kay Guan, Kay Boon)\n• Jun Jie's work shift on any date\n• Upcoming Singapore public holidays\n\nExample: \"Where is Ahma on 15 June 2026?\""
    );
    return;
  }

  let replyText = '';

  // 1. Try Gemini AI if key is available
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
  if (geminiKey) {
    try {
      replyText = await getAiReply(userText, language, geminiKey);
    } catch (err: any) {
      console.warn('Gemini API failed, falling back to local solver:', err?.message ?? err);
    }
  }

  // 2. Fall back to the same offline rule-based solver the web app uses
  if (!replyText) {
    replyText = solveChatLocally(
      userText,
      language,
      DEFAULT_SETTINGS,
      [], // no overrides available in stateless context
      DEFAULT_ROSTER_WEEKS
    );
  }

  // Strip Markdown bold (**text**) since we send plain text to Telegram
  replyText = replyText.replace(/\*\*(.*?)\*\*/g, '$1');

  await sendTelegramMessage(TELEGRAM_TOKEN, chatId, replyText);
}
