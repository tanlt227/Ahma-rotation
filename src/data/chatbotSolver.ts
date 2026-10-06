import { CalendarAppSettings, DayOverride, ShiftRosterWeek } from '../types';
import { getGrandmaLocation, getScheduledJunjieShift, getAhmaLocationName } from './schedule';
import { SINGAPORE_PUBLIC_HOLIDAYS, getPublicHoliday } from './holidays';

export function solveChatLocally(
  message: string,
  language: 'en' | 'zh',
  settings: CalendarAppSettings,
  overrides: DayOverride[] = [],
  rosterWeeks?: ShiftRosterWeek[]
): string {
  const query = message.toLowerCase().trim();
  const isZh = language === 'zh' || /[\u4e00-\u9fa5]/.test(message);

  // 1. Date extraction
  let targetDate = '';
  // Check for YYYY-MM-DD
  const isoMatch = message.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
  if (isoMatch) {
    const parts = isoMatch[1].split(/[-/.]/).map(Number);
    targetDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
  } else {
    // Natural English date like "7 May 2026" or "May 7"
    const mNames: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
      nov: 11, november: 11, dec: 12, december: 12,
    };
    const engDateMatch = message.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i) ||
                         message.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
    if (engDateMatch) {
      let dNum: number, mStr: string, yNum: number;
      if (isNaN(Number(engDateMatch[1]))) {
        mStr = engDateMatch[1].toLowerCase();
        dNum = parseInt(engDateMatch[2], 10);
        yNum = engDateMatch[3] ? parseInt(engDateMatch[3], 10) : 2026;
      } else {
        dNum = parseInt(engDateMatch[1], 10);
        mStr = engDateMatch[2].toLowerCase();
        yNum = engDateMatch[3] ? parseInt(engDateMatch[3], 10) : 2026;
      }
      const mNum = mNames[mStr];
      if (mNum) {
        targetDate = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      }
    }

    // Chinese date like 2026年5月7日 or 5月7日
    const zhDateMatch = message.match(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]?/);
    if (zhDateMatch) {
      const yNum = zhDateMatch[1] ? parseInt(zhDateMatch[1], 10) : 2026;
      const mNum = parseInt(zhDateMatch[2], 10);
      const dNum = parseInt(zhDateMatch[3], 10);
      targetDate = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    }
  }

  // If no date found but says "today" or "今天"
  if (!targetDate) {
    if (query.includes('today') || query.includes('今天')) {
      const today = new Date();
      targetDate = today.toISOString().split('T')[0];
    }
  }

  // 1. Check Ahma / Grandma
  if (
    query.includes('ahma') ||
    query.includes('grandma') ||
    query.includes('阿嬷') ||
    query.includes('外婆') ||
    query.includes('奶奶') ||
    query.includes('grandmother') ||
    query.includes('kay cheow') ||
    query.includes('kay guan') ||
    query.includes('kay boon') ||
    query.includes('启超') ||
    query.includes('启源') ||
    query.includes('启文')
  ) {
    const checkDate = targetDate || '2026-05-07';
    const grandma = getGrandmaLocation(checkDate, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
    const locNameZh = getAhmaLocationName(grandma.locationCode, 'zh');
    const locNameEn = getAhmaLocationName(grandma.locationCode, 'en');

    if (isZh) {
      if (grandma.cnyArrangement) {
        return `🧧 在 **${checkDate}**，适逢农历新年特殊轮流安排：\n• 阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 时间安排：除夕（5pm起）至 初二（8pm）。\n• 当日属于：**${grandma.cnyArrangement.stageLabelZh}**（${grandma.cnyArrangement.timeWindowZh}）。\n• 新年轮流顺序为：2026 启源(KG) -> 2027 启文(KB) -> 2028 启超(KC) -> 2029 启源(KG)，以此循环。`;
      }
      return `👵 在 **${checkDate}**，阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 当前周期居住第 ${grandma.dayInCurrentStay} 天（周期共 ${grandma.stayDuration} 天）。\n• 周期开始日期为 2026年5月7日（启超），按 启超 > 启源 > 启文 顺序轮流。${grandma.isOverridden ? `\n• ⚡ 注意：该日期有特殊调期安排！` : ''}`;
    }
    if (grandma.cnyArrangement) {
      return `🧧 On **${checkDate}**, Ahma is at **${locNameEn}** (${grandma.locationCode}) under the CNY Special Arrangement:\n• Window: CNY Eve (5:00 PM) till CNY Day 2 (8:00 PM).\n• Today's stage: **${grandma.cnyArrangement.stageLabel}** (${grandma.cnyArrangement.timeWindow}).\n• Annual CNY sequence: 2026 Kay Guan -> 2027 Kay Boon -> 2028 Kay Cheow -> 2029 Kay Guan (repeating).`;
    }
    return `👵 On **${checkDate}**, Ahma is staying at **${locNameEn}** (${grandma.locationCode}).\n• Day ${grandma.dayInCurrentStay} of ${grandma.stayDuration} in this stay.\n• Rotation sequence: Kay Cheow → Kay Guan → Kay Boon (starts 7 May 2026 @ Kay Cheow).${grandma.isOverridden ? `\n• ⚡ Note: Special arrangement override active for this date.` : ''}`;
  }

  // Check CNY specifically if asked
  if (query.includes('cny') || query.includes('chinese new year') || query.includes('新年') || query.includes('过年') || query.includes('除夕')) {
    const yrMatch = message.match(/\b(202\d|203\d)\b/);
    const yr = yrMatch ? parseInt(yrMatch[1], 10) : 2026;
    const cnyHost = yr % 3 === 2026 % 3 ? 'Kay Guan (启源/KG)' : yr % 3 === 2027 % 3 ? 'Kay Boon (启文/KB)' : 'Kay Cheow (启超/KC)';
    if (isZh) {
      return `🧧 **农历新年 (CNY) 特殊轮流安排**：\n• 时间：除夕傍晚 5:00 至 大年初二晚上 8:00\n• 轮流规则：\n  * 2026年：启源 (KG)\n  * 2027年：启文 (KB)\n  * 2028年：启超 (KC)\n  * 2029年：启源 (KG)（以此循环）\n• **${yr}年 新年阿嬷在：${cnyHost}**。`;
    }
    return `🧧 **CNY Special Arrangement**:\n• Period: CNY Eve (5:00 PM) till CNY Day 2 (8:00 PM)\n• Repeating Order:\n  * 2026: Kay Guan (KG)\n  * 2027: Kay Boon (KB)\n  * 2028: Kay Cheow (KC)\n  * 2029: Kay Guan (KG) (repeating order)\n• **In ${yr}, Ahma will be at: ${cnyHost}**.`;
  }

  // 2. Check Jun Jie / Shift
  if (
    query.includes('jun jie') ||
    query.includes('junjie') ||
    query.includes('俊杰') ||
    query.includes('shift') ||
    query.includes('work') ||
    query.includes('班次') ||
    query.includes('上班') ||
    query.includes('工作')
  ) {
    const checkDate = targetDate || '2026-06-15';
    const junjie = getScheduledJunjieShift(checkDate, settings.junjieAnchorDate, overrides, rosterWeeks);

    if (isZh) {
      return `💼 在 **${checkDate}**，俊杰上 **${junjie.shift.name}**${junjie.shift.time ? `（时间：${junjie.shift.time}）` : '（休息/休假）'}。\n• 俊杰工作排班每3周一循环，从2026年6月15日开始。${junjie.isOverridden ? `\n• ⚡ 注意：当日有调班或请假记录（${junjie.overrideReason || '特殊安排'}）` : ''}`;
    }
    return `💼 On **${checkDate}**, Jun Jie is working **${junjie.shift.name}**${junjie.shift.time ? ` (${junjie.shift.time})` : ' (Off/Rest Day)'}.\n• Follows 3-week repeating shift roster starting 15 June 2026.${junjie.isOverridden ? `\n• ⚡ Note: Shift swapped or on leave (${junjie.overrideReason || 'Override'}).` : ''}`;
  }

  // 3. Check Singapore Public Holidays
  if (
    query.includes('holiday') ||
    query.includes('假期') ||
    query.includes('公假') ||
    query.includes('public holiday') ||
    query.includes('cny') ||
    query.includes('chinese new year') ||
    query.includes('national day')
  ) {
    if (targetDate) {
      const h = getPublicHoliday(targetDate);
      if (h) {
        return isZh
          ? `🇸🇬 **${targetDate}** 是新加坡公共假期：**${h.name}**。`
          : `🇸🇬 **${targetDate}** is an official Singapore Public Holiday: **${h.name}**.`;
      }
    }
    if (isZh) {
      return `🇸🇬 新加坡主要公共假期：\n• 2026年5月1日：劳动节 (Labour Day)\n• 2026年5月31日 - 6月1日：卫塞节及补假 (Vesak Day)\n• 2026年8月9日 - 8月10日：国庆日及补假 (National Day)\n• 2026年11月8日 - 11月9日：屠妖节及补假 (Deepavali)\n• 2026年12月25日：圣诞节 (Christmas Day)`;
    }
    return `🇸🇬 Upcoming Singapore Public Holidays:\n• 1 May 2026: Labour Day\n• 31 May – 1 Jun 2026: Vesak Day & In-Lieu\n• 9 Aug – 10 Aug 2026: National Day & In-Lieu\n• 8 Nov – 9 Nov 2026: Deepavali & In-Lieu\n• 25 Dec 2026: Christmas Day`;
  }

  // Default helpful message
  if (isZh) {
    return `您好！我是阿嬷日程小助手。您可以问我：\n• 某一天阿嬷住在谁家（例如：“2026年5月7日阿嬷住在哪里？”）\n• 俊杰某天的上下班排班（例如：“6月15日俊杰上什么班？”）\n• 新加坡公共假期安排`;
  }
  return `Hello! I'm your family calendar assistant. You can ask me:\n• Where Ahma is staying on any date (e.g., "Where is Ahma on 7 May 2026?")\n• Jun Jie's work shift for any date (e.g., "What shift on 15 June?")\n• Upcoming Singapore public holidays`;
}
