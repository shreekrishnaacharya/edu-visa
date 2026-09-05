/*
 * Locales code
 * https://gist.github.com/raushankrjha/d1c7e35cf87e69aa8b4208a8171a8416
 */

export type InputNumberValue = string | number | null | undefined;

type Options = (Intl.NumberFormatOptions | undefined) & {
  absolute?: boolean; // new custom option
};
const DEFAULT_LOCALE = { code: "ne-NP", currency: "NPR" };

function processInput(inputValue: InputNumberValue): number | null {
  if (inputValue == null || Number.isNaN(inputValue)) return null;
  return Number(inputValue);
}

// ----------------------------------------------------------------------
export function fDecimal(inputValue: InputNumberValue, decimal = 2) {
  const number = processInput(inputValue);
  if (number === null) return "";
  return number.toFixed(decimal);
}

export function fNumber(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  let number = processInput(inputValue);
  const isNegative = (number ?? 1) < 0;
  if (number === null) return "";
  if (options?.absolute) {
    number = Math.abs(number);
  }
  const fm = new Intl.NumberFormat(locale.code, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(number);
  if (isNegative && options?.absolute) {
    return `(${fm})`;
  }
  return fm;
}

// ----------------------------------------------------------------------

export function fCurrency(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return "";

  // Use custom formatting with rupee symbol for better display
  const formattedNumber = new Intl.NumberFormat(locale.code, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(Math.abs(number));

  // Add rupee symbol prefix with proper spacing
  const rupeeSymbol = "₹";
  const sign = number < 0 ? "-" : "";
  
  return `${sign}${rupeeSymbol} ${formattedNumber}`;
}

// ----------------------------------------------------------------------

export function fPercent(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return "";

  const fm = new Intl.NumberFormat(locale.code, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(number / 100);

  return fm;
}

// ----------------------------------------------------------------------

export function fShortenNumber(
  inputValue: InputNumberValue,
  options?: Options
) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return "";

  const fm = new Intl.NumberFormat(locale.code, {
    notation: "compact",
    maximumFractionDigits: 2,
    ...options,
  }).format(number);

  return fm.replace(/[A-Z]/g, (match) => match.toLowerCase());
}

// ----------------------------------------------------------------------

export function fData(inputValue: InputNumberValue) {
  const number = processInput(inputValue);
  if (number === null || number === 0) return "0 bytes";

  const units = ["bytes", "Kb", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const decimal = 2;
  const baseValue = 1024;

  const index = Math.floor(Math.log(number) / Math.log(baseValue));
  const fm = `${parseFloat((number / baseValue ** index).toFixed(decimal))} ${
    units[index]
  }`;

  return fm;
}
