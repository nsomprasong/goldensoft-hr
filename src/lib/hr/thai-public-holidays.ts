/**
 * Thai public (ราชการ) holidays by Gregorian calendar year.
 *
 * Fixed national days are generated every year. Buddhist lunar holidays use a
 * curated table for nearby years; other years still get the fixed set.
 *
 * Storage dates are ISO `YYYY-MM-DD` (ค.ศ.). Display uses Thai helpers elsewhere.
 */

export type ThaiPublicHoliday = {
  /** ISO `YYYY-MM-DD` */
  date: string;
  name: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Fixed Gregorian-date national holidays (month/day). */
const FIXED: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "วันขึ้นปีใหม่" },
  { month: 4, day: 6, name: "วันจักรี" },
  { month: 4, day: 13, name: "วันสงกรานต์" },
  { month: 4, day: 14, name: "วันสงกรานต์" },
  { month: 4, day: 15, name: "วันสงกรานต์" },
  { month: 5, day: 1, name: "วันแรงงานแห่งชาติ" },
  { month: 5, day: 4, name: "วันฉัตรมงคล" },
  { month: 6, day: 3, name: "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี" },
  { month: 7, day: 28, name: "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว" },
  { month: 8, day: 12, name: "วันแม่แห่งชาติ" },
  { month: 10, day: 13, name: "วันคล้ายวันสวรรคตพระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร" },
  { month: 10, day: 23, name: "วันปิยมหาราช" },
  { month: 12, day: 5, name: "วันพ่อแห่งชาติ" },
  { month: 12, day: 10, name: "วันรัฐธรรมนูญ" },
  { month: 12, day: 31, name: "วันสิ้นปี" },
];

/**
 * Buddhist lunar holidays (ค.ศ. year → month/day).
 * Extend this table as new cabinet calendars are published.
 */
const BUDDHIST_BY_YEAR: Record<
  number,
  Array<{ month: number; day: number; name: string }>
> = {
  2025: [
    { month: 2, day: 12, name: "วันมาฆบูชา" },
    { month: 5, day: 11, name: "วันวิสาขบูชา" },
    { month: 7, day: 10, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 11, name: "วันเข้าพรรษา" },
  ],
  2026: [
    { month: 3, day: 3, name: "วันมาฆบูชา" },
    { month: 5, day: 31, name: "วันวิสาขบูชา" },
    { month: 7, day: 29, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 30, name: "วันเข้าพรรษา" },
  ],
  2027: [
    { month: 2, day: 21, name: "วันมาฆบูชา" },
    { month: 5, day: 20, name: "วันวิสาขบูชา" },
    { month: 7, day: 18, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 19, name: "วันเข้าพรรษา" },
  ],
  2028: [
    { month: 2, day: 10, name: "วันมาฆบูชา" },
    { month: 5, day: 8, name: "วันวิสาขบูชา" },
    { month: 7, day: 6, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 7, name: "วันเข้าพรรษา" },
  ],
  2029: [
    { month: 2, day: 27, name: "วันมาฆบูชา" },
    { month: 5, day: 27, name: "วันวิสาขบูชา" },
    { month: 7, day: 25, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 26, name: "วันเข้าพรรษา" },
  ],
  2030: [
    { month: 2, day: 17, name: "วันมาฆบูชา" },
    { month: 5, day: 16, name: "วันวิสาขบูชา" },
    { month: 7, day: 14, name: "วันอาสาฬหบูชา" },
    { month: 7, day: 15, name: "วันเข้าพรรษา" },
  ],
};

/** Gregorian year for “today” in Asia/Bangkok (approx via UTC+7). */
export function currentGregorianYearBangkok(now = new Date()): number {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return bangkok.getUTCFullYear();
}

export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

export function fromBuddhistYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/**
 * Build the public-holiday list for a Gregorian year.
 * Songkran days share the same display name but different dates (unique key).
 */
export function thaiPublicHolidaysForYear(
  gregorianYear: number,
): ThaiPublicHoliday[] {
  if (!Number.isInteger(gregorianYear) || gregorianYear < 2000 || gregorianYear > 2100) {
    return [];
  }

  const rows: ThaiPublicHoliday[] = FIXED.map((h) => ({
    date: iso(gregorianYear, h.month, h.day),
    name: h.name,
  }));

  const lunar = BUDDHIST_BY_YEAR[gregorianYear] ?? [];
  for (const h of lunar) {
    rows.push({
      date: iso(gregorianYear, h.month, h.day),
      name: h.name,
    });
  }

  // Songkran shares a name across 3 days — disambiguate for unique (date,name)
  // by appending the Thai date day number when needed... Actually unique is
  // (workCalendarId, holidayDate, name). Same name on different dates is OK.
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function hasBuddhistHolidayTable(gregorianYear: number): boolean {
  return Object.prototype.hasOwnProperty.call(BUDDHIST_BY_YEAR, gregorianYear);
}
