import React from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Paper,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
  useTheme,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { StaticTimePicker } from "@mui/x-date-pickers/StaticTimePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs, { Dayjs } from "dayjs";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

import { CalendarPopup } from "./CalendarPopup";
import { adStrToBsStr, bsToAD, todayBS } from "../utils/bsCalendar";
import { usePopupPosition } from "../utils/usePopupPosition";
import type {
  IUCSDateTimePicker,
  OutputValueFormat,
  FieldSize,
  Language,
} from "../types";
import { getUserDateTypeSetting } from "../utils/resolver";

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

function parseStoredDT(
  stored: string | null,
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

function buildStoredDT(
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

// ─── BS inner field ───────────────────────────────────────────────────────────

interface BSUDateTimeFieldProps {
  value: string | null;
  outputFmt: OutputValueFormat;
  onChange: (value: string) => void;
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
  error?: any;
  format?: string;
  inputRef?: any;
}

const BSUDateTimeField: React.FC<BSUDateTimeFieldProps> = ({
  value,
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

  const { bsDate, time } = parseStoredDT(value, outputFmt, showSeconds);

  const [localText, setLocalText] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const { pos: popupPos, computePos } = usePopupPosition();

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
  const timeAsDayjs = time ? dayjs(`2000-01-01T${time}`) : null;
  const inputHeight = mini ? 28 : size === "small" ? 40 : 56;
  const fontSize = mini ? 12 : 14;
  const displayLabel = getLabel(label, required);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    computePos(containerRef.current, 562, 430);
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

  const emit = (newBsDate: string, newTime: string) => {
    const stored = buildStoredDT(newBsDate, newTime, outputFmt);
    if (stored) onChange(stored);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateTimeInput(e.target.value, showSeconds);
    setLocalText(formatted);
    if (isValidDateTime(formatted, showSeconds)) {
      const [datePart, timePart] = formatted.split(" ");
      emit(datePart, timePart);
    }
  };

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
    setLocalText(null);
    const effectiveBsDate = bsDate || (() => {
      const t = todayBS();
      return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
    })();
    emit(effectiveBsDate, val.format(showSeconds ? "HH:mm:ss" : "HH:mm"));
  };

  return (
    <Box ref={containerRef} sx={{ position: "relative", width: "100%" }}>
      <FormControl fullWidth size={size} error={!!error}>
        {displayLabel && (
          <InputLabel
            shrink
            required={required}
            disabled={disabled}
            error={!!error}
          >
            {displayLabel}
          </InputLabel>
        )}
        <OutlinedInput
          notched={!!displayLabel}
          label={displayLabel}
          value={displayText}
          onChange={handleInputChange}
          onBlur={() => setLocalText(null)}
          disabled={disabled}
          error={!!error}
          placeholder={placeholder}
          inputRef={inputRef}
          inputProps={{
            maxLength: is12h ? (showSeconds ? 22 : 19) : showSeconds ? 19 : 16,
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
              >
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </InputAdornment>
          }
        />
      </FormControl>
      {getError(error)}

      {createPortal(
        open && !disabled ? (
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
        ) : null,
        document.body,
      )}
    </Box>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const UCSDateTimePicker: React.FC<IUCSDateTimePicker> = ({
  type,
  outputValueFormat = "ad",
  value = "",
  defaultValue,
  onChange,
  label,
  format,
  disabled,
  required,
  size = "small",
  fullWidth,
  mini,
  error,
  language = "en",
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

  if (type === "bs") {
    return (
      <BSUDateTimeField
        value={value}
        outputFmt={outputFmt}
        onChange={onChange}
        label={label}
        required={required}
        disabled={disabled}
        size={size}
        mini={mini}
        language={language}
        minDate={minDate}
        maxDate={maxDate}
        showSeconds={showSeconds}
        timeFormat={timeFormat}
        error={error}
        format={format}
        inputRef={inputRef}
      />
    );
  }

  // AD branch — your original UCSDateTimePicker, unchanged
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer components={["DateTimePicker"]} sx={{ paddingTop: 0.5 }}>
        <DateTimePicker
          value={value ? dayjs(value) : null}
          defaultValue={defaultValue ? dayjs(defaultValue) : undefined}
          disabled={disabled}
          inputRef={inputRef}
          onChange={(e) => onChange(e?.toISOString() ?? "")}
          format={format ?? "YYYY-MM-DD hh:mm A"}
          label={getLabel(label, required)}
          slotProps={{
            textField: {
              size: size ?? "small",
              error: !!error,
              helperText: error
                ? typeof error === "string"
                  ? error
                  : error?.message
                : undefined,
              sx: { minWidth: "auto !important", width: "100%" },
            },
          }}
        />
      </DemoContainer>
    </LocalizationProvider>
  );
};
