import { CalendarAppSettings, DayOverride, ShiftRosterWeek } from '../types';
import { getGrandmaLocation, getScheduledJunjieShift, getAhmaLocationName } from './schedule';
import { SINGAPORE_PUBLIC_HOLIDAYS, getPublicHoliday } from './holidays';
import { getShiftLabel, todaySGT, addDaysSGT } from './i18n';

export function solveChatLocally(
  message: string,
  language: 'en' | 'zh',
  settings: CalendarAppSettings,
  overrides: DayOverride[] = [],
  rosterWeeks?: ShiftRosterWeek[]
): string {
  const query = message.toLowerCase().trim();
  // Detect language from the message itself, fall back to app language
  const isZh = /[\u4e00-\u9fa5]/.test(message) || language === 'zh';

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
    if (query.includes('today') || query.includes('今天') || query.includes('今日')) {
      targetDate = todaySGT();
    } else if (query.includes('tomorrow') || query.includes('明天') || query.includes('明日')) {
      targetDate = addDaysSGT(1);
    } else if (query.includes('day after tomorrow') || query.includes('后天')) {
      targetDate = addDaysSGT(2);
    } else if (query.includes('next week') || query.includes('下周') || query.includes('下个星期')) {
      targetDate = addDaysSGT(7);
    } else if (query.includes('this week') || query.includes('本周') || query.includes('这周')) {
      targetDate = todaySGT();
    } else if (query.includes('next year') || query.includes('明年')) {
      targetDate = addDaysSGT(365);
    } else if (query.includes('this weekend') || query.includes('这个周末') || query.includes('本周末')) {
      const d = new Date();
      const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      const daysToSat = (6 - sgt.getUTCDay() + 7) % 7 || 7;
      targetDate = addDaysSGT(daysToSat);
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
    query.includes('启超') ||
    query.includes('dad') ||
    query.includes('爸爸家') ||
    query.includes('kay guan') ||
    query.includes('kay boon') ||
    query.includes('启源') ||
    query.includes('启文')
  ) {
    // "next visit / coming over / when" query
    const asksNext = query.includes('next') || query.includes('when') || query.includes('coming') ||
                     query.includes('arrive') || query.includes('下次') || query.includes('什么时候') ||
                     query.includes('几时') || query.includes('过来');

    if (asksNext) {
      const targetCode =
        query.includes('kc') || query.includes('kay cheow') || query.includes('启超') || query.includes('dad') || query.includes('爸爸') ? 'KC' :
        query.includes('kg') || query.includes('kay guan') || query.includes('启源') ? 'KG' :
        query.includes('kb') || query.includes('kay boon') || query.includes('启文') ? 'KB' : null;

      const today = todaySGT();
      const currentInfo = getGrandmaLocation(today, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);

      if (targetCode) {
        // Find next arrival (dayInStay === 1) at targetCode
        let nextDate = '';
        let daysAway = 0;
        for (let i = 1; i <= 42 * 3; i++) {
          const ds = addDaysSGT(i);
          const info = getGrandmaLocation(ds, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
          if (info.locationCode === targetCode && info.dayInCurrentStay === 1) {
            nextDate = ds; daysAway = i; break;
          }
        }
        const locName = getAhmaLocationName(targetCode, isZh ? 'zh' : 'en');
        if (nextDate) {
          return isZh
            ? `👵 阿嬷下次到 **${locName} (${targetCode})** 是 **${nextDate}**（${daysAway} 天后）。\n• 目前阿嬷在 ${getAhmaLocationName(currentInfo.locationCode, 'zh')}，还有 ${currentInfo.daysRemainingInStay} 天。`
            : `👵 Ahma's next visit to **${locName} (${targetCode})** is on **${nextDate}** (in ${daysAway} days).\n• Currently at ${getAhmaLocationName(currentInfo.locationCode, 'en')}, ${currentInfo.daysRemainingInStay} days remaining.`;
        }
      } else {
        // No specific location — just say where Ahma is now and when she moves next
        return isZh
          ? `👵 阿嬷目前在 **${getAhmaLocationName(currentInfo.locationCode, 'zh')} (${currentInfo.locationCode})**，还有 **${currentInfo.daysRemainingInStay}** 天，然后 **${currentInfo.nextMoveDate}** 前往 ${getAhmaLocationName(currentInfo.nextLocationCode, 'zh')} (${currentInfo.nextLocationCode})。`
          : `👵 Ahma is currently at **${getAhmaLocationName(currentInfo.locationCode, 'en')} (${currentInfo.locationCode})** with **${currentInfo.daysRemainingInStay}** days left, then moves to ${getAhmaLocationName(currentInfo.nextLocationCode, 'en')} (${currentInfo.nextLocationCode}) on **${currentInfo.nextMoveDate}**.`;
      }
    }

    const checkDate = targetDate || todaySGT();
    const grandma = getGrandmaLocation(checkDate, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
    const locNameZh = getAhmaLocationName(grandma.locationCode, 'zh');
    const locNameEn = getAhmaLocationName(grandma.locationCode, 'en');

    if (isZh) {
      if (grandma.cnyArrangement) {
        return `🧧 在 **${checkDate}**，适逢农历新年特殊轮流安排：\n• 阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 时间安排：除夕（5pm起）至 初二（8pm）。\n• 当日属于：**${grandma.cnyArrangement.stageLabelZh}**（${grandma.cnyArrangement.timeWindowZh}）。\n• 新年轮流顺序为：2026 启源(KG) -> 2027 启文(KB) -> 2028 启超(KC) -> 2029 启源(KG)，以此循环。`;
      }
      return `👵 在 **${checkDate}**，阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 当前周期居住第 ${grandma.dayInCurrentStay} 天（周期共 ${grandma.stayDuration} 天）。\n• 周期开始日期为 2026年5月7日（启超/KC），按 启超 > 启源 > 启文 顺序轮流。${grandma.isOverridden ? `\n• ⚡ 注意：该日期有特殊调期安排！` : ''}`;
    }
    if (grandma.cnyArrangement) {
      return `🧧 On **${checkDate}**, Ahma is at **${locNameEn}** (${grandma.locationCode}) under the CNY Special Arrangement:\n• Window: CNY Eve (5:00 PM) till CNY Day 2 (8:00 PM).\n• Today's stage: **${grandma.cnyArrangement.stageLabel}** (${grandma.cnyArrangement.timeWindow}).\n• Annual CNY sequence: 2026 Kay Guan -> 2027 Kay Boon -> 2028 Kay Cheow -> 2029 Kay Guan (repeating).`;
    }
    return `👵 On **${checkDate}**, Ahma is staying at **${locNameEn}** (${grandma.locationCode}).\n• Day ${grandma.dayInCurrentStay} of ${grandma.stayDuration} in this stay.\n• Rotation sequence: Kay Cheow (KC) → Kay Guan (KG) → Kay Boon (KB) (starts 7 May 2026 @ Kay Cheow).${grandma.isOverridden ? `\n• ⚡ Note: Special arrangement override active for this date.` : ''}`;
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

  // 2. Check Jun Jie / Shift (also responds to "jj")
  if (
    query.includes('jun jie') ||
    query.includes('junjie') ||
    query.includes('俊杰') ||
    query.includes('jj') ||
    query.includes('shift') ||
    query.includes('work') ||
    query.includes('班次') ||
    query.includes('上班') ||
    query.includes('工作')
  ) {
    const checkDate = targetDate || todaySGT();
    const junjie = getScheduledJunjieShift(checkDate, settings.junjieAnchorDate, overrides, rosterWeeks);
    const shiftLabelEn = junjie.shift.time && junjie.shift.time !== 'Off' && junjie.shift.time !== 'Rest' && junjie.shift.time !== 'Leave'
      ? `${junjie.shift.name} (${junjie.shift.time})` : junjie.shift.name;
    const shiftLabelZh = getShiftLabel(junjie.shift.name, junjie.shift.time, 'zh');

    if (isZh) {
      return `💼 在 **${checkDate}**，俊杰上 **${shiftLabelZh}**${junjie.shift.time && junjie.shift.time !== 'Off' && junjie.shift.time !== 'Rest' ? '' : '（休息/休假）'}。\n• 俊杰工作排班每3周一循环，从2026年6月15日开始。${junjie.isOverridden ? `\n• ⚡ 注意：当日有调班或请假记录（${junjie.overrideReason || '特殊安排'}）` : ''}`;
    }
    return `💼 On **${checkDate}**, Jun Jie is working **${shiftLabelEn}**.\n• Follows 3-week repeating shift roster starting 15 June 2026.${junjie.isOverridden ? `\n• ⚡ Note: Shift swapped or on leave (${junjie.overrideReason || 'Override'}).` : ''}`;
  }

  // 2b. Check Lay Ting (also responds to "lt" / "丽婷")
  if (
    query.includes('lay ting') ||
    query.includes('layting') ||
    query.includes('丽婷') ||
    (query.includes('lt') && !query.includes('alt') && !query.includes('result'))
  ) {
    return isZh
      ? `丽婷 (Lay Ting) 是家庭成员之一（女儿/姐妹）。您可以在日历上查看她的相关活动安排。`
      : `Lay Ting (LT) is a family member (daughter/sister). You can view her events on the calendar.`;
  }

  // 3. Check Singapore Public Holidays
  if (
    query.includes('holiday') ||
    query.includes('假期') ||
    query.includes('公假') ||
    query.includes('public holiday') ||
    query.includes('national day') ||
    query.includes('国庆')
  ) {
    if (targetDate) {
      const h = getPublicHoliday(targetDate);
      if (h) {
        return isZh
          ? `🇸🇬 **${targetDate}** 是新加坡公共假期：**${h.nameZh || h.name}**。`
          : `🇸🇬 **${targetDate}** is a Singapore Public Holiday: **${h.name}**.`;
      } else {
        return isZh
          ? `🇸🇬 **${targetDate}** 不是新加坡公共假期。`
          : `🇸🇬 **${targetDate}** is not a Singapore Public Holiday.`;
      }
    }

    // Find the next upcoming holiday from today
    const today = todaySGT();
    const upcoming = SINGAPORE_PUBLIC_HOLIDAYS
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    if (upcoming.length > 0) {
      const lines = upcoming.map((h) =>
        isZh
          ? `• ${h.date}：${h.nameZh || h.name}`
          : `• ${h.date}: ${h.name}`
      ).join('\n');
      return isZh
        ? `🇸🇬 新加坡即将到来的公共假期：\n${lines}`
        : `🇸🇬 Upcoming Singapore Public Holidays:\n${lines}`;
    }
    return isZh ? '🇸🇬 暂无即将到来的公共假期数据。' : '🇸🇬 No upcoming public holidays found in the current data.';
  }

  // 4. Casual chat / greetings — warm fallback
  const casualGreetings = ['hi', 'hello', 'hey', 'how are you', 'good morning', 'good evening', 'good night',
    'thanks', 'thank you', 'ok', 'okay', 'nice', 'cool', '你好', '早安', '晚安', '谢谢', '好的', '嗯'];
  if (casualGreetings.some((g) => query === g || query.startsWith(g + ' ') || query.endsWith(' ' + g))) {
    const greetings = [
      isZh ? '您好！😊 有什么我可以帮您的吗？' : 'Hey there! 😊 How can I help you today?',
      isZh ? '你好！有什么想了解的吗？' : 'Hello! What can I help you with?',
      isZh ? '😊 有需要就说哦！' : '😊 Just let me know what you need!',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Default helpful message
  if (isZh) {
    return `您好！我是阿嬷日程小助手。您可以问我：\n• 某一天阿嬷住在谁家（例如：“2026年5月7日阿嬷住在哪里？”）\n• 俊杰某天的上下班排班（例如：“6月15日俊杰上什么班？”）\n• 新加坡公共假期安排`;
  }
  return `Hello! I'm your family calendar assistant. You can ask me:\n• Where Ahma is staying on any date (e.g., "Where is Ahma on 7 May 2026?")\n• Jun Jie's work shift for any date (e.g., "What shift on 15 June?")\n• Upcoming Singapore public holidays`;
}
