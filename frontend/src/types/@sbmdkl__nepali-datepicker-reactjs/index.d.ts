/**
 * Type declarations for @sbmdkl/nepali-datepicker-reactjs
 *
 * The package ships no types and has no DefinitelyTyped entry.
 * These declarations are derived by inspecting the compiled bundle
 * (dist/index.modern.js) directly.
 *
 * Drop this file into your project at:
 *   src/types/@sbmdkl__nepali-datepicker-reactjs/index.d.ts
 *
 * Then add to tsconfig.json:
 *   "typeRoots": ["./src/types", "./node_modules/@types"]
 *
 * Or use the module augmentation path mapping approach (see bottom of file).
 */

declare module "@sbmdkl/nepali-datepicker-reactjs" {
  import * as React from "react";

  // ─── onChange payload ──────────────────────────────────────────────────────
  /**
   * The object passed to `onChange` whenever the user selects a date.
   *
   * Both strings are always in `"YYYY-MM-DD"` format using English (ASCII) digits.
   *
   * @example
   * { bsDate: "2081-04-15", adDate: "2024-07-30" }
   */
  export interface NepaliDatePickerOnChangePayload {
    /** Selected date in Bikram Sambat, e.g. "2081-04-15" */
    bsDate: string;
    /** Corresponding Gregorian date, e.g. "2024-07-30" */
    adDate: string;
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────
  /**
   * Built-in colour themes shipped by the library.
   * Applies a CSS class to the calendar popup.
   */
  export type NepaliDatePickerTheme =
    | "default"
    | "red"
    | "blue"
    | "green"
    | "dark"
    | "deepdark";

  // ─── Language ──────────────────────────────────────────────────────────────
  /**
   * Calendar display language.
   *  - `"en"` — English digits and month/day names  (default)
   *  - `"ne"` — Nepali (Devanagari) digits and names
   */
  export type NepaliDatePickerLanguage = "en" | "ne";

  // ─── dateFormat tokens ─────────────────────────────────────────────────────
  /**
   * Tokens supported in the `dateFormat` prop.
   *
   * | Token  | Output (en)          | Output (ne)        |
   * |--------|----------------------|--------------------|
   * | YYYY   | 2081                 | २०८१               |
   * | YYY    | 081                  | ०८१                |
   * | YY     | 81                   | ८१                 |
   * | M      | 1 – 12               | १ – १२             |
   * | MM     | 01 – 12              | ०१ – १२            |
   * | MMMM   | Baisakh, Jestha …    | बैशाख, जेठ …       |
   * | D      | 1 – 32               | १ – ३२             |
   * | DD     | 01 – 32              | ०१ – ३२            |
   * | DDD    | Sun, Mon …           | आइत, सोम …         |
   * | DDDD   | Sunday, Monday …     | आइतबार, सोमबार … |
   *
   * Tokens can be combined freely, e.g. `"YYYY-MM-DD"` or `"DDDD, MMMM DD, YYYY"`.
   */
  export type NepaliDateFormatToken =
    | "YYYY"
    | "YYY"
    | "YY"
    | "M"
    | "MM"
    | "MMMM"
    | "D"
    | "DD"
    | "DDD"
    | "DDDD";

  // ─── Props ─────────────────────────────────────────────────────────────────
  export interface NepaliDatePickerProps {
    /**
     * Called whenever the user selects a date.
     * Receives `{ bsDate, adDate }` — both as `"YYYY-MM-DD"` strings.
     */
    onChange: (payload: NepaliDatePickerOnChangePayload) => void;

    /**
     * Pre-select / seed date in `"YYYY-MM-DD"` BS format (English digits).
     * The calendar opens on this month; the day is highlighted as selected.
     *
     * @example "2081-04-15"
     */
    defaultDate?: string;

    /**
     * Format string for the value shown inside the text input.
     * Build from `NepaliDateFormatToken` values separated by any separator.
     *
     * @default "YYYY-MM-DD"
     * @example "YYYY/MM/DD"
     * @example "DDDD, MMMM DD, YYYY"
     */
    dateFormat?: string;

    /**
     * Calendar display language.
     * @default "en"
     */
    language?: NepaliDatePickerLanguage;

    /**
     * Colour theme applied to the calendar popup.
     * @default "default"
     */
    theme?: NepaliDatePickerTheme;

    /**
     * Earliest selectable date in BS `"YYYY-MM-DD"` format (English digits).
     * Dates before this value are rendered as disabled in the calendar.
     *
     * @example "2081-01-01"
     */
    minDate?: string;

    /**
     * Latest selectable date in BS `"YYYY-MM-DD"` format (English digits).
     * Dates after this value are rendered as disabled in the calendar.
     *
     * @example "2081-12-30"
     */
    maxDate?: string;

    /**
     * When `true`, the text input shows no date on first render even if
     * `defaultDate` is provided. Useful for "uncontrolled but seeded" patterns.
     *
     * @default false
     */
    hideDefaultValue?: boolean;

    /**
     * Placeholder text shown in the text input when no date is selected.
     */
    placeholder?: string;

    /**
     * CSS class name(s) applied directly to the underlying `<input>` element.
     * Use this to override library styles or integrate with MUI / Tailwind.
     */
    className?: string;

    /**
     * Inline styles applied directly to the underlying `<input>` element.
     */
    style?: React.CSSProperties;
  }

  /**
   * Nepali (Bikram Sambat) date picker component.
   *
   * @example
   * ```tsx
   * import NepaliDatePicker from "@sbmdkl/nepali-datepicker-reactjs";
   * import "@sbmdkl/nepali-datepicker-reactjs/dist/index.css";
   *
   * <NepaliDatePicker
   *   onChange={({ bsDate, adDate }) => console.log(bsDate, adDate)}
   *   defaultDate="2081-04-15"
   *   dateFormat="YYYY-MM-DD"
   *   language="en"
   *   theme="default"
   * />
   * ```
   */
  const NepaliDatePicker: React.FC<NepaliDatePickerProps>;
  export default NepaliDatePicker;
}
