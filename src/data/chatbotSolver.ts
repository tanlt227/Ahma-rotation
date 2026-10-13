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
    // "next visit / coming over / when / which house" query
    const asksNext =
      query.includes('next') || query.includes('when') || query.includes('coming') ||
      query.includes('come') || query.includes('arrive') || query.includes('arriving') ||
      query.includes('turn') || query.includes('visit') || query.includes('visiting') ||
      query.includes('go to') || query.includes('going') || query.includes('reach') ||
      query.includes('reaches') || query.includes('下次') || query.includes('什么时候') ||
      query.includes('几时') || query.includes('何时') || query.includes('过来') ||
      query.includes('去') || query.includes('来') || query.includes('轮到') || query.includes('到') ||
      (!targetDate && (query.includes('kc') || query.includes('kg') || query.includes('kb') || query.includes('dad') || query.includes('爸爸') || query.includes('启超') || query.includes('启源') || query.includes('启文')));

    if (asksNext) {
      const targetCode =
        query.includes('kc') || query.includes('kay cheow') || query.includes('启超') || query.includes('dad') || query.includes('爸爸') ? 'KC' :
        query.includes('kg') || query.includes('kay guan') || query.includes('启源') ? 'KG' :
        query.includes('kb') || query.includes('kay boon') || query.includes('启文') ? 'KB' : null;

      const today = todaySGT();
      const currentInfo = getGrandmaLocation(today, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);

      if (targetCode) {
        const locName = getAhmaLocationName(targetCode, isZh ? 'zh' : 'en');
        const isCurrentlyThere = currentInfo.locationCode === targetCode;

        // Find next arrival (dayInStay === 1) at targetCode
        let nextDate = '';
        let nextEndDate = '';
        let daysAway = 0;
        for (let i = 1; i <= 42 * 3; i++) {
          const ds = addDaysSGT(i);
          const info = getGrandmaLocation(ds, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
          if (info.locationCode === targetCode && info.dayInCurrentStay === 1) {
            nextDate = ds;
            daysAway = i;
            nextEndDate = addDaysSGT(i + (info.stayDuration || 14) - 1);
            break;
          }
        }

        if (isCurrentlyThere) {
          const nextLocName = getAhmaLocationName(currentInfo.nextLocationCode, isZh ? 'zh' : 'en');
          return isZh
            ? `👵 **阿嬷目前就在 ${locName} (${targetCode})！**\n• 今天是第 ${currentInfo.dayInCurrentStay} 天（共 ${currentInfo.stayDuration} 天），还剩 **${currentInfo.daysRemainingInStay}** 天（直到 ${currentInfo.nextMoveDate} 前往 ${nextLocName}）。\n• 下一次再轮到 ${locName} 是 **${nextDate}**（${daysAway} 天后）。`
            : `👵 **Ahma is currently at ${locName} (${targetCode}) right now!**\n• Today is Day ${currentInfo.dayInCurrentStay} of ${currentInfo.stayDuration} (${currentInfo.daysRemainingInStay} days remaining, until ${currentInfo.nextMoveDate} when she moves to ${nextLocName}).\n• Her next return visit to ${locName} will be on **${nextDate}** (in ${daysAway} days).`;
        }

        if (nextDate) {
          const currentLocName = getAhmaLocationName(currentInfo.locationCode, isZh ? 'zh' : 'en');
          return isZh
            ? `👵 阿嬷下次到 **${locName} (${targetCode})** 是 **${nextDate}**（${daysAway} 天后，住到 ${nextEndDate}）。\n• 目前阿嬷在 **${currentLocName}**，还剩 ${currentInfo.daysRemainingInStay} 天（直到 ${currentInfo.nextMoveDate}）。`
            : `👵 Ahma will be coming over to **${locName} (${targetCode})** on **${nextDate}** (in ${daysAway} days, staying until ${nextEndDate}).\n• Currently, Ahma is staying at **${currentLocName}** (${currentInfo.daysRemainingInStay} days left until ${currentInfo.nextMoveDate}).`;
        }
      } else {
        // No specific location — tell where Ahma is now and when she moves next
        return isZh
          ? `👵 阿嬷目前在 **${getAhmaLocationName(currentInfo.locationCode, 'zh')} (${currentInfo.locationCode})**，还剩 **${currentInfo.daysRemainingInStay}** 天，将于 **${currentInfo.nextMoveDate}** 前往 ${getAhmaLocationName(currentInfo.nextLocationCode, 'zh')} (${currentInfo.nextLocationCode})。`
          : `👵 Ahma is currently at **${getAhmaLocationName(currentInfo.locationCode, 'en')} (${currentInfo.locationCode})** with **${currentInfo.daysRemainingInStay}** days left, then moves to ${getAhmaLocationName(currentInfo.nextLocationCode, 'en')} (${currentInfo.nextLocationCode}) on **${currentInfo.nextMoveDate}**.`;
      }
    }

    const checkDate = targetDate || todaySGT();
    const isToday = checkDate === todaySGT();
    const grandma = getGrandmaLocation(checkDate, settings.grandmaAnchorDate, overrides, settings.grandmaCycleDays);
    const locNameZh = getAhmaLocationName(grandma.locationCode, 'zh');
    const locNameEn = getAhmaLocationName(grandma.locationCode, 'en');

    if (isZh) {
      if (grandma.cnyArrangement) {
        return `🧧 在 **${checkDate}**，适逢农历新年特殊轮流安排：\n• 阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 时间安排：除夕（5pm起）至 初二（8pm）。\n• 当日属于：**${grandma.cnyArrangement.stageLabelZh}**（${grandma.cnyArrangement.timeWindowZh}）。\n• 新年轮流顺序为：2026 启源(KG) -> 2027 启文(KB) -> 2028 启超(KC) -> 2029 启源(KG)，以此循环。`;
      }
      return `👵 ${isToday ? '今天' : `在 **${checkDate}**`}，阿嬷住在 **${locNameZh}** (${grandma.locationCode})。\n• 当前周期居住第 ${grandma.dayInCurrentStay} 天（还剩 ${grandma.daysRemainingInStay} 天，将于 ${grandma.nextMoveDate} 前往 ${getAhmaLocationName(grandma.nextLocationCode, 'zh')}）。${grandma.isOverridden ? `\n• ⚡ 注意：该日期有特殊调期安排！` : ''}`;
    }
    if (grandma.cnyArrangement) {
      return `🧧 On **${checkDate}**, Ahma is at **${locNameEn}** (${grandma.locationCode}) under the CNY Special Arrangement:\n• Window: CNY Eve (5:00 PM) till CNY Day 2 (8:00 PM).\n• Today's stage: **${grandma.cnyArrangement.stageLabel}** (${grandma.cnyArrangement.timeWindow}).\n• Annual CNY sequence: 2026 Kay Guan -> 2027 Kay Boon -> 2028 Kay Cheow -> 2029 Kay Guan (repeating).`;
    }
    return `👵 ${isToday ? 'Today' : `On **${checkDate}**`}, Ahma is staying at **${locNameEn}** (${grandma.locationCode}).\n• Day ${grandma.dayInCurrentStay} of ${grandma.stayDuration} in this stay (${grandma.daysRemainingInStay} days left, moving to ${getAhmaLocationName(grandma.nextLocationCode, 'en')} on ${grandma.nextMoveDate}).${grandma.isOverridden ? `\n• ⚡ Note: Special arrangement override active for this date.` : ''}`;
  }

  // Check CNY specifically if asked
  if (query.includes('cny') || query.includes('chinese new year') || query.includes('新年') || query.includes('过年') || query.includes('除夕')) {
    const yrMatch = message.match(/\b(202\d|203\d)\b/);
    const currentYear = parseInt(todaySGT().split('-')[0]);
    // "next year" → currentYear + 1, else use matched year or current year
    const yr = yrMatch
      ? parseInt(yrMatch[1], 10)
      : (query.includes('next year') || query.includes('明年') ? currentYear + 1 : currentYear);

    // Use actual CNY schedule data
    const CNY_MAP: Record<number, { location: string; locationZh: string; code: string; eve: string; day1: string }> = {
      2026: { code: 'KG', location: 'Kay Guan',  locationZh: '启源', eve: '2026-02-16', day1: '2026-02-17' },
      2027: { code: 'KB', location: 'Kay Boon',  locationZh: '启文', eve: '2027-02-05', day1: '2027-02-06' },
      2028: { code: 'KC', location: 'Kay Cheow', locationZh: '启超', eve: '2028-01-25', day1: '2028-01-26' },
      2029: { code: 'KG', location: 'Kay Guan',  locationZh: '启源', eve: '2029-02-12', day1: '2029-02-13' },
      2030: { code: 'KB', location: 'Kay Boon',  locationZh: '启文', eve: '2030-02-02', day1: '2030-02-03' },
    };
    const cny = CNY_MAP[yr];
    if (cny) {
      return isZh
        ? `🧧 **${yr}年农历新年**：阿嬷在 **${cny.locationZh} (${cny.code})**。\n• 除夕 (${cny.eve}) 傍晚5点 至 初二 晚上8点。\n• 轮流：2026 启源 → 2027 启文 → 2028 启超 → 2029 启源（循环）。`
        : `🧧 **CNY ${yr}**: Ahma stays at **${cny.location} (${cny.code})**.\n• From CNY Eve (${cny.eve}, 5pm) to Day 2 (8pm).\n• Rotation: 2026 KG → 2027 KB → 2028 KC → 2029 KG (repeating).`;
    }
    return isZh
      ? `🧧 暂无 ${yr} 年的农历新年数据。已知：2026 启源、2027 启文、2028 启超、2029 启源。`
      : `🧧 No CNY data for ${yr}. Known: 2026 KG, 2027 KB, 2028 KC, 2029 KG (repeating).`;
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

    // Check if a specific year is mentioned
    const yearMatch = message.match(/\b(202\d|203\d)\b/);
    const filterYear = yearMatch ? parseInt(yearMatch[1]) : null;

    const today = todaySGT();
    const upcoming = SINGAPORE_PUBLIC_HOLIDAYS
      .filter((h) => filterYear ? h.year === filterYear : h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, filterYear ? 20 : 5); // show all for a specific year, else next 5

    if (upcoming.length > 0) {
      const lines = upcoming.map((h) =>
        isZh
          ? `• ${h.date}：${h.nameZh || h.name}`
          : `• ${h.date}: ${h.name}`
      ).join('\n');
      const header = filterYear
        ? (isZh ? `🇸🇬 ${filterYear}年新加坡公共假期：` : `🇸🇬 Singapore Public Holidays ${filterYear}:`)
        : (isZh ? '🇸🇬 即将到来的新加坡公共假期：' : '🇸🇬 Upcoming Singapore Public Holidays:');
      return `${header}\n${lines}`;
    }
    return isZh ? '🇸🇬 暂无该年份的公共假期数据。' : '🇸🇬 No public holiday data found for that year.';
  }

  // 4. Casual chat / greetings — warm fallback
  const casualPatterns = [
    'hi', 'hello', 'hey', 'how are you', 'good morning', 'good afternoon',
    'good evening', 'good night', 'thanks', 'thank you', 'ok', 'okay',
    'nice', 'cool', 'great', 'awesome', 'what can you do', 'help',
    '你好', '早安', '晚安', '谢谢', '好的', '嗯', '帮我', '可以',
  ];
  const isCasual = casualPatterns.some((g) =>
    query === g ||
    query.startsWith(g) ||
    query.endsWith(g) ||
    query.length < 10
  );
  if (isCasual) {
    const greetings = isZh
      ? ['您好！😊 有什么我可以帮您的吗？', '你好！可以问我阿嬷的住处、俊杰的班次或新加坡公共假期 😊', '嗨！有需要就说哦 🌸']
      : ['Hey there! 😊 Ask me about Ahma\'s rotation, JJ\'s shifts, or SG holidays!', 'Hello! How can I help you today? 🌸', 'Hi! I can help with Ahma\'s schedule, Jun Jie\'s shifts, or upcoming holidays 😊'];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Default helpful message
  if (isZh) {
    return `您好！我是阿嬷日程小助手。您可以问我：\n• 某一天阿嬷住在谁家（例如：“2026年5月7日阿嬷住在哪里？”）\n• 俊杰某天的上下班排班（例如：“6月15日俊杰上什么班？”）\n• 新加坡公共假期安排`;
  }
  return `Hello! I'm your family calendar assistant. You can ask me:\n• Where Ahma is staying on any date (e.g., "Where is Ahma on 7 May 2026?")\n• Jun Jie's work shift for any date (e.g., "What shift on 15 June?")\n• Upcoming Singapore public holidays`;
}
