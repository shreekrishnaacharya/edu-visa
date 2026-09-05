// ─── Shared Types ─────────────────────────────────────────────────────────────

export type DatePickerType = "ad" | "bs";
export type FieldSize = "small" | "medium";
export type Language = "en" | "ne";

/**
 * Controls what value is written into the RHF field.
 *  "ad" → ISO string via dayjs  e.g. "2024-07-30T00:00:00.000Z"
 *  "bs" → BS date string        e.g. "2081-04-15"
 */
export type OutputValueFormat = "ad" | "bs";

export interface NepaliChangePayload {
  bsDate: string; // "2081-04-15"
  adDate: string; // "2024-07-30"
}

// ─── Base props shared across all pickers ────────────────────────────────────

export interface BasePickerProps {
  name: string;
  label?: string;
  control: any;
  errors?: Record<string, any>;
  error?: any;
  onChange?: (value: any, field: any) => void;
  disabled?: boolean;
  required?: boolean;
  defaultValue?: string;
  rules?: object;
  size?: FieldSize;
  fullWidth?: boolean;
  mini?: boolean;
  getValue?: (value: any) => void;
  placeholder?: string;
  inputRef?: any;
}

// ─── CSDatePicker ─────────────────────────────────────────────────────────────

export interface ICSDatePicker extends BasePickerProps {
  /** Calendar UI: "ad" = MUI Gregorian, "bs" = Nepali Bikram Sambat */
  type?: DatePickerType;
  /**
   * Format of the stored RHF value.
   * Defaults to match `type` when omitted.
   */
  outputValueFormat?: OutputValueFormat;
  /** AD: dayjs format string. BS: dateFormat string. Default "YYYY-MM-DD" */
  format?: string;
  /** BS calendar language */
  language?: Language;
  /** BS min date "YYYY-MM-DD" */
  minDate?: string;
  /** BS max date "YYYY-MM-DD" */
  maxDate?: string;
}

// ─── CSDateTimePicker ─────────────────────────────────────────────────────────

export interface ICSDateTimePicker extends BasePickerProps {
  /** Calendar UI: "ad" = MUI, "bs" = Nepali */
  type?: DatePickerType;
  outputValueFormat?: OutputValueFormat;
  /** AD: dayjs display format. BS: date portion format. Default "YYYY-MM-DD HH:mm" */
  format?: string;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  /** Show seconds field in time picker. Default false */
  showSeconds?: boolean;
  /** Time format for BS datetime picker. "12h" = hh:mm a, "24h" = HH:mm. Default "12h" */
  timeFormat?: "12h" | "24h";
}

// ─── CSDateRangePicker ────────────────────────────────────────────────────────

export type RangePickerMode = "bs" | "ad" | "mixed";

export interface DateRange {
  from: string;
  to: string;
}

export interface ICSDateRangePicker {
  /**
   * "bs"    → both pickers BS, output BS strings
   * "ad"    → both pickers AD, output AD ISO strings
   * "mixed" → from=BS picker, to=AD picker (or configure via fromType/toType)
   */
  type?: DatePickerType;
  /** Output format for from/to values */
  outputValueFormat?: OutputValueFormat;
  name: string;
  label?: string;
  fromLabel?: string;
  toLabel?: string;
  control: any;
  errors?: Record<string, any>;
  error?: any;
  onChange?: (value: DateRange, field: any) => void;
  disabled?: boolean;
  required?: boolean;
  defaultValue?: DateRange;
  rules?: object;
  size?: FieldSize;
  fullWidth?: boolean;
  mini?: boolean;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  /** Show swap button between from/to. Default true */
  showSwap?: boolean;
}

// ─── Uncontrolled picker interfaces (no RHF control) ─────────────────────────

export interface IUCSDatePicker {
  type?: DatePickerType;
  outputValueFormat?: OutputValueFormat;
  value?: string | null;
  defaultValue?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  format?: string;
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
  fullWidth?: boolean;
  mini?: boolean;
  width?: number | string;
  error?: any;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  inputRef?: any;
}

export interface IUCSDateTimePicker {
  type?: DatePickerType;
  outputValueFormat?: OutputValueFormat;
  value?: string | null;
  defaultValue?: string;
  onChange: (value: string) => void;
  label?: string;
  format?: string;
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
  fullWidth?: boolean;
  mini?: boolean;
  error?: any;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  showSeconds?: boolean;
  timeFormat?: "12h" | "24h";
  inputRef?: any;
}

export interface IUCSTime {
  value?: string | null;
  fullWidth?: boolean;
  onChange: (value: string) => void;
  label?: string;
  format?: string;
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
  ampm?: boolean;
  error?: any;
  inputRef?: any;
}

export interface IUCSDateRangePicker {
  type?: DatePickerType;
  outputValueFormat?: OutputValueFormat;
  fromValue?: string;
  toValue?: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  fromLabel?: string;
  toLabel?: string;
  placeholder?: string;
  separator?: string;
  format?: string;
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
  fullWidth?: boolean;
  width?: number | string;
  error?: any;
  id?: string;
  sx?: object;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  inputRef?: any;
}
