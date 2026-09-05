import dayjs from "dayjs";
import type { DatePickerType, OutputValueFormat } from "../types";
import { DEFAULT_SYSTEM_DATE_TYPE, USER_DETAIL } from "@common/options";
import { adStrToBsStr } from "./bsCalendar";

/**
 * Given the picked dates and the desired output format,
 * produce the final string stored in the RHF field.
 *
 *  outputFmt = "ad"  → dayjs ISO string  e.g. "2024-07-30T00:00:00.000Z"
 *  outputFmt = "bs"  → BS date string    e.g. "2081-04-15"
 *
 * For datetime, pass timeSuffix e.g. "T14:30:00" to append to the AD ISO string.
 */
export function resolveOutputValue(
  adDateStr: string,
  bsDateStr: string,
  outputFmt: OutputValueFormat,
  timeSuffix?: string, // e.g. " 14:30" for BS datetime output
): string {
  if (outputFmt === "ad") {
    // With a time component this is a genuine instant → keep the local→UTC conversion.
    if (timeSuffix) {
      return dayjs(`${adDateStr}${timeSuffix}`).toISOString();
    }
    // Date-only (e.g. DOB): a calendar date has no timezone. Running it through
    // dayjs(adDateStr).toISOString() interprets it at LOCAL midnight and shifts
    // the day backward for positive UTC offsets (e.g. Nepal +05:45 → previous day),
    // which then mismatches the UTC date-only parse done server-side. Pin it to
    // UTC midnight so it round-trips as a pure date regardless of timezone.
    return `${dayjs(adDateStr).format("YYYY-MM-DD")}T00:00:00.000Z`;
  }
  // outputFmt === "bs"
  return timeSuffix ? `${bsDateStr}${timeSuffix}` : bsDateStr;
}

/**
 * Build a label string, appending " *" when required.
 */
export function buildLabel(
  label?: string,
  required?: boolean,
): string | undefined {
  if (!label) return undefined;
  return required ? `${label} *` : label;
}

export function getUserDateTypeSetting(): DatePickerType {
  const userSettingRawDate = localStorage.getItem(USER_DETAIL);
  try {
    const setting = JSON.parse(userSettingRawDate ?? "{}");
    return setting?.setting_meta?.date_ad_bs ?? DEFAULT_SYSTEM_DATE_TYPE;
  } catch {}
  return DEFAULT_SYSTEM_DATE_TYPE;
}

export function convertToDefaultDateFormat(
  date: string,
  time: boolean = false,
) {
  if (date == "" || date == null) {
    return "";
  }
  const type = getUserDateTypeSetting();
  let dateValue = "";
  if (time) {
    if (type == "ad") {
      dateValue = dayjs(date).format("YYYY-MM-DD hh:mm A");
    } else {
      dateValue = `${adStrToBsStr(dayjs(date).format("YYYY-MM-DD"))} ${dayjs(
        date,
      ).format("hh:mm A")}`;
    }
  } else {
    if (type == "ad") {
      dateValue = dayjs(date).format("YYYY-MM-DD");
    } else {
      dateValue = adStrToBsStr(dayjs(date).format("YYYY-MM-DD"));
    }
  }

  return dateValue;
}
