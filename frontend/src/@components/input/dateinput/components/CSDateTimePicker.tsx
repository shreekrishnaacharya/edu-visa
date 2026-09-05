/**
 * CSDateTimePicker
 * ─────────────────────────────────────────────────────────────────────────────
 *  type="ad" → custom popup via Portal: DateCalendar (left) + StaticTimePicker (right)
 *               Portal at document.body + zIndex:9999 — works inside MUI Dialog and Cards
 *  type="bs" → single input (YYYY-MM-DD hh:mm a) with:
 *                calendar icon → custom BS date popup
 *                clock icon    → MUI TimePicker popup
 *
 * outputValueFormat:
 *  "ad" → ISO string  "2024-07-30T14:30:00.000Z"
 *  "bs" → BS string   "2081-04-15 14:30"
 */

import React from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import {
  Box,
  Paper,
  FormControl,
  FormHelperText,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
  Button,
  useTheme,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { StaticTimePicker } from "@mui/x-date-pickers/StaticTimePicker";
import dayjs, { Dayjs } from "dayjs";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

import { CalendarPopup } from "./CalendarPopup";
import { adStrToBsStr, bsToAD, todayBS } from "../utils/bsCalendar";
import { getUserDateTypeSetting } from "../utils/resolver";
import { usePopupPosition } from "../utils/usePopupPosition";
import type {
  ICSDateTimePicker,
  OutputValueFormat,
  FieldSize,
  Language,
} from "../types";

// ─── shared helpers ───────────────────────────────────────────────────────────

function getLabel(label?: string, required?: boolean) {
  if (!label) return undefined;
  return required ? `${label} *` : label;
}

function getError(error: any): React.ReactNode {
  if (!error) return null;
  const msg =
    typeof error === "string" ? error : error?.message ?? "Invalid value";
  return <FormHelperText error>{msg}</FormHelperText>;
}

// ─── BS helpers ───────────────────────────────────────────────────────────────

function parseStored(
  stored: string,
  outputFmt: OutputValueFormat,
  withSeconds: boolean,
): { bsDate: string; time: string } {
  if (!stored) return { bsDate: "", time: "" };
  if (outputFmt === "ad") {
    const d = dayjs(stored);
    if (!d.isValid()) return { bsDate: "", time: "" };
    return {
      bsDate: adStrToBsStr(d.format("YYYY-MM-DD")),
      time: d.format(withSeconds ? "HH:mm:ss" : "HH:mm"),
    };
  }
  const [bsDate = "", time = ""] = stored.split(" ");
  return { bsDate, time };
}

function buildStored(
  bsDate: string,
  time: string,
  outputFmt: OutputValueFormat,
): string {
  if (!bsDate || !time) return "";
  if (outputFmt === "bs") return `${bsDate} ${time}`;
  const [by, bm, bd] = bsDate.split("-").map(Number);
  const adDate = bsToAD(by, bm, bd);
  return dayjs(`${adDate}T${time}`).toISOString();
}

function formatDateTimeInput(raw: string, withSeconds: boolean): string {
  const digits = raw.replace(/\D/g, "").slice(0, withSeconds ? 14 : 12);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 4 || i === 6) out += "-";
    if (i === 8) out += " ";
    if (i === 10 || (withSeconds && i === 12)) out += ":";
    out += digits[i];
  }
  return out;
}

function isValidDateTime(s: string, withSeconds: boolean): boolean {
  return withSeconds
    ? /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s);
}

// ─── AD DateTimeField — custom popup via Portal: DateCalendar + StaticTimePicker ─

interface ADDateTimeFieldProps {
  field: any;
  name: string;
  outputFmt: OutputValueFormat;
  onChange?: (value: any, field: any) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  mini?: boolean;
  showSeconds?: boolean;
  timeFormat?: "12h" | "24h";
  error?: boolean;
  format?: string;
  inputRef?: any;
}

const ADDateTimeField: React.FC<ADDateTimeFieldProps> = ({
  field,
  name,
  outputFmt,
  onChange,
  label,
  required,
  disabled,
  size = "small",
  mini,
  showSeconds = false,
  timeFormat = "12h",
  error,
  format,
  inputRef,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [popupPos, setPopupPos] = React.useState<{ top: number; left: number }>(
    { top: 0, left: 0 },
  );

  const is12h = timeFormat === "12h";

  const parsedValue: Dayjs | null = React.useMemo(() => {
    if (!field.value) return null;
    const d = dayjs(field.value);
    return d.isValid() ? d : null;
  }, [field.value]);

  const timeDisplayFmt = is12h
    ? showSeconds ? "hh:mm:ss A" : "hh:mm A"
    : showSeconds ? "HH:mm:ss" : "HH:mm";
  const displayFmt = format ?? `YYYY-MM-DD ${timeDisplayFmt}`;
  const displayText = parsedValue ? parsedValue.format(displayFmt) : "";
  const displayLabel = getLabel(label, required);

  const inputHeight = mini ? 28 : size === "small" ? 40 : 56;
  const fontSize = mini ? 12 : 14;

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".MuiMenu-root, .MuiPopover-root"))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const emit = (combined: Dayjs) => {
    const stored =
      outputFmt === "bs"
        ? combined.format("YYYY-MM-DD HH:mm")
        : combined.toISOString();
    if (onChange) onChange(stored, field);
    else field.onChange(stored);
  };

  const handleDateChange = (newDate: Dayjs | null) => {
    if (!newDate) return;
    const base = parsedValue ?? dayjs().startOf("day");
    emit(
      newDate
        .hour(base.hour())
        .minute(base.minute())
        .second(base.second())
        .millisecond(0),
    );
  };

  const handleTimeChange = (newTime: Dayjs | null) => {
    if (!newTime) return;
    const base = parsedValue ?? dayjs();
    emit(
      base
        .hour(newTime.hour())
        .minute(newTime.minute())
        .second(showSeconds ? newTime.second() : 0)
        .millisecond(0),
    );
  };

  const currentPeriod: "am" | "pm" = parsedValue
    ? parsedValue.hour() < 12 ? "am" : "pm"
    : "am";

  const handlePeriodToggle = (newPeriod: "am" | "pm") => {
    const base = parsedValue ?? dayjs().startOf("day");
    const h = base.hour();
    let newHour = h;
    if (newPeriod === "am" && h >= 12) newHour = h - 12;
    else if (newPeriod === "pm" && h < 12) newHour = h + 12;
    if (newHour !== h) emit(base.hour(newHour).millisecond(0));
  };

  const popup = open && !disabled
    ? (
      <Box
        ref={popupRef}
        sx={{
          position: "fixed",
          top: popupPos.top,
          left: popupPos.left,
          zIndex: 9999,
        }}
      >
        <Paper
          elevation={4}
          sx={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex" }}>
            {/* Left: AD calendar */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateCalendar
                value={parsedValue}
                onChange={handleDateChange}
              />
            </LocalizationProvider>

            <Box sx={{ width: "1px", bgcolor: "divider", flexShrink: 0 }} />

            {/* Right: time picker */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <StaticTimePicker
                  ampm={is12h}
                  value={parsedValue}
                  onChange={handleTimeChange}
                  views={
                    showSeconds
                      ? ["hours", "minutes", "seconds"]
                      : ["hours", "minutes"]
                  }
                  slots={{ toolbar: () => null, actionBar: () => null }}
                  slotProps={{
                    layout: {
                      sx: {
                        boxShadow: "none",
                        border: "none",
                        ".MuiPickersLayout-contentWrapper": {
                          alignItems: "center",
                        },
                      },
                    },
                  }}
                />
              </LocalizationProvider>

              {is12h && (
                <Box sx={{ display: "flex", gap: 1, pb: 1.5 }}>
                  <Button
                    size="small"
                    variant={currentPeriod === "am" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => handlePeriodToggle("am")}
                  >
                    AM
                  </Button>
                  <Button
                    size="small"
                    variant={currentPeriod === "pm" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => handlePeriodToggle("pm")}
                  >
                    PM
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ height: "1px", bgcolor: "divider" }} />

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              px: 1.5,
              py: 1,
            }}
          >
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={() => setOpen(false)}
            >
              OK
            </Button>
          </Box>
        </Paper>
      </Box>
    )
    : null;

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%" }}>
      <FormControl fullWidth size={size} error={error}>
        {displayLabel && (
          <InputLabel shrink required={required} disabled={disabled} error={error}>
            {displayLabel}
          </InputLabel>
        )}
        <OutlinedInput
          notched={!!displayLabel}
          label={displayLabel}
          value={displayText}
          disabled={disabled}
          error={error}
          placeholder={displayFmt}
          inputProps={{
            readOnly: true,
            sx: {
              fontSize,
              height: mini ? `${inputHeight - 16}px` : undefined,
              padding: mini ? "4px 10px" : undefined,
            },
          }}
          inputRef={inputRef ?? field.ref}
          onBlur={field.onBlur}
          sx={{ width: "100%", height: inputHeight }}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                size="small"
                disabled={disabled}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleOpen}
                aria-label="Open calendar"
              >
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          }
        />
      </FormControl>

      {createPortal(popup, document.body)}
    </Box>
  );
};

// ─── BS DateTimeField — single input with calendar + time popups ──────────────

interface BSDateTimeFieldProps {
  field: any;
  name: string;
  outputFmt: OutputValueFormat;
  onChange?: (value: any, field: any) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  mini?: boolean;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  showSeconds?: boolean;
  timeFormat?: "12h" | "24h";
  error?: boolean;
  format?: string;
  inputRef?: any;
}

const BSDateTimeField: React.FC<BSDateTimeFieldProps> = ({
  field,
  name,
  outputFmt,
  onChange,
  label,
  required,
  disabled,
  size = "small",
  mini,
  language = "en",
  minDate,
  maxDate,
  showSeconds = false,
  timeFormat = "12h",
  error,
  format,
  inputRef,
}) => {
  const theme = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);

  const { bsDate, time } = parseStored(
    field.value ?? "",
    outputFmt,
    showSeconds,
  );

  const [localText, setLocalText] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const { pos: popupPos, computePos } = usePopupPosition();

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    computePos(containerRef.current, 562, 430);
    setOpen(true);
  };

  const inputHeight = mini ? 28 : size === "small" ? 40 : 56;
  const fontSize = mini ? 12 : 14;
  const is12h = timeFormat === "12h";
  const timeDisplayFmt = is12h
    ? showSeconds
      ? "hh:mm:ss a"
      : "hh:mm a"
    : showSeconds
    ? "HH:mm:ss"
    : "HH:mm";
  const placeholder = format ?? `YYYY-MM-DD ${timeDisplayFmt}`;

  const displayTime = React.useMemo(() => {
    if (!time) return "";
    if (!is12h) return time;
    return dayjs(`2000-01-01T${time}`).format(
      showSeconds ? "hh:mm:ss a" : "hh:mm a",
    );
  }, [time, is12h, showSeconds]);

  const displayText =
    localText ?? (bsDate && displayTime ? `${bsDate} ${displayTime}` : bsDate);

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".MuiMenu-root, .MuiPopover-root"))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const emit = (newBsDate: string, newTime: string) => {
    const stored = buildStored(newBsDate, newTime, outputFmt);
    if (!stored) return;
    if (onChange) onChange(stored, field);
    else field.onChange({ target: { name, value: stored } });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateTimeInput(e.target.value, showSeconds);
    setLocalText(formatted);
    if (isValidDateTime(formatted, showSeconds)) {
      const [datePart, timePart] = formatted.split(" ");
      emit(datePart, timePart);
    }
  };

  const handleBlur = () => setLocalText(null);

  const handleDatePick = (y: number, m: number, d: number) => {
    const picked = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0",
    )}`;
    setLocalText(null);
    emit(picked, time || (showSeconds ? "00:00:00" : "00:00"));
  };

  const handleTimePick = (val: Dayjs | null) => {
    if (!val) return;
    const picked = val.format(showSeconds ? "HH:mm:ss" : "HH:mm");
    setLocalText(null);
    const effectiveBsDate = bsDate || (() => {
      const t = todayBS();
      return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
    })();
    emit(effectiveBsDate, picked);
  };

  const displayLabel = getLabel(label, required);
  const timeAsDayjs = time ? dayjs(`2000-01-01T${time}`) : null;

  const currentPeriod: "am" | "pm" = timeAsDayjs
    ? timeAsDayjs.hour() < 12 ? "am" : "pm"
    : "am";

  const handlePeriodToggle = (newPeriod: "am" | "pm") => {
    const base = timeAsDayjs ?? dayjs("2000-01-01T00:00");
    const h = base.hour();
    let newHour = h;
    if (newPeriod === "am" && h >= 12) newHour = h - 12;
    else if (newPeriod === "pm" && h < 12) newHour = h + 12;
    if (newHour !== h) handleTimePick(base.hour(newHour));
  };

  const popup = open && !disabled
    ? (
      <Box
        ref={popupRef}
        sx={{
          position: "fixed",
          top: popupPos.top,
          left: popupPos.left,
          zIndex: 9999,
        }}
      >
        <Paper
          elevation={4}
          sx={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex" }}>
            <CalendarPopup
              selectedBS={bsDate}
              language={language}
              minDate={minDate}
              maxDate={maxDate}
              onSelect={handleDatePick}
            />

            <Box sx={{ width: "1px", bgcolor: "divider", flexShrink: 0 }} />

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <StaticTimePicker
                  ampm={is12h}
                  value={timeAsDayjs}
                  onChange={handleTimePick}
                  views={
                    showSeconds
                      ? ["hours", "minutes", "seconds"]
                      : ["hours", "minutes"]
                  }
                  slots={{
                    toolbar: () => null,
                    actionBar: () => null,
                  }}
                  slotProps={{
                    layout: {
                      sx: {
                        boxShadow: "none",
                        border: "none",
                        ".MuiPickersLayout-contentWrapper": {
                          alignItems: "center",
                        },
                      },
                    },
                  }}
                />
              </LocalizationProvider>

              {is12h && (
                <Box sx={{ display: "flex", gap: 1, pb: 1.5 }}>
                  <Button
                    size="small"
                    variant={currentPeriod === "am" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => handlePeriodToggle("am")}
                  >
                    AM
                  </Button>
                  <Button
                    size="small"
                    variant={currentPeriod === "pm" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => handlePeriodToggle("pm")}
                  >
                    PM
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ height: "1px", bgcolor: "divider" }} />

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              px: 1.5,
              py: 1,
            }}
          >
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={() => setOpen(false)}
            >
              OK
            </Button>
          </Box>
        </Paper>
      </Box>
    )
    : null;

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%" }}>
      <FormControl fullWidth size={size} error={error}>
        {displayLabel && (
          <InputLabel
            shrink
            required={required}
            disabled={disabled}
            error={error}
          >
            {displayLabel}
          </InputLabel>
        )}
        <OutlinedInput
          notched={!!displayLabel}
          label={displayLabel}
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          error={error}
          placeholder={placeholder}
          inputRef={inputRef}
          inputProps={{
            maxLength: is12h
              ? showSeconds
                ? 22
                : 19
              : showSeconds
              ? 19
              : 16,
            sx: {
              fontSize,
              height: mini ? `${inputHeight - 16}px` : undefined,
              padding: mini ? "4px 10px" : undefined,
            },
          }}
          sx={{ width: "100%", height: inputHeight }}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                size="small"
                disabled={disabled}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleOpen}
                aria-label="Open BS calendar"
              >
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          }
        />
      </FormControl>

      {createPortal(popup, document.body)}
    </Box>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const CSDateTimePicker: React.FC<ICSDateTimePicker> = ({
  type,
  outputValueFormat = "ad",
  control,
  errors,
  onChange,
  error,
  mini,
  fullWidth,
  size,
  disabled,
  required,
  format,
  label,
  name,
  defaultValue,
  rules,
  language,
  minDate,
  maxDate,
  showSeconds = false,
  timeFormat = "12h",
  inputRef,
}) => {
  if (!type) {
    type = getUserDateTypeSetting();
  }
  const outputFmt: OutputValueFormat = outputValueFormat;

  return (
    <Box>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue ?? ""}
          rules={{
            ...rules,
            ...(required ? { required: `${label ?? name} is required` } : {}),
          }}
          render={({ field }) => {
            if (type === "bs") {
              return (
                <BSDateTimeField
                  field={field}
                  name={name}
                  outputFmt={outputFmt}
                  onChange={onChange}
                  label={label}
                  required={required}
                  disabled={disabled}
                  size={size ?? "small"}
                  mini={mini}
                  language={language}
                  minDate={minDate}
                  maxDate={maxDate}
                  showSeconds={showSeconds}
                  timeFormat={timeFormat}
                  error={Boolean(error ?? errors?.[name])}
                  format={format}
                  inputRef={inputRef}
                />
              );
            }

            // ── AD branch ────
            return (
              <ADDateTimeField
                field={field}
                name={name}
                outputFmt={outputFmt}
                onChange={onChange}
                label={label}
                required={required}
                disabled={disabled}
                size={size ?? "small"}
                mini={mini}
                showSeconds={showSeconds}
                timeFormat={timeFormat}
                error={Boolean(error ?? errors?.[name])}
                format={format}
                inputRef={inputRef}
              />
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};
