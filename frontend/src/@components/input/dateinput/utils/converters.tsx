/**
 * converters.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All functions here delegate to bsCalendar.ts which has the correct and
 * complete BS data table (2000–2099 BS) and the right reference point.
 *
 * adStringToBsString had a wrong reference point (2000-01-01 AD = 2056-09-17 BS)
 * and an incomplete/incorrect BS_DATA table — giving wrong results.
 *
 * adStrToBsStr in bsCalendar.ts uses the correct reference (1943-04-14 AD =
 * 2000-01-01 BS) and the full authoritative table — always correct.
 *
 * Both old names are kept as aliases so existing call sites don't break.
 */

import dayjs from "dayjs";
import { adStrToBsStr, bsStrToAdStr } from "./bsCalendar";

/** AD "YYYY-MM-DD" → BS "YYYY-MM-DD" */
export function adStringToBsString(adDateStr: string): string {
  return adStrToBsStr(adDateStr);
}

/** BS "YYYY-MM-DD" → AD "YYYY-MM-DD" */
export function bsStringToAdString(bsDateStr: string): string {
  return bsStrToAdStr(bsDateStr);
}

/** Extract the date portion "YYYY-MM-DD" from an ISO string or date string. */
export function toDateString(value: string): string {
  if (!value) return "";
  return value.substring(0, 10);
}
