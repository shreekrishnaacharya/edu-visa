/**
 * BSInput — custom Bikram Sambat date picker, built from scratch.
 *
 * No dependency on @sbmdkl/nepali-datepicker-reactjs.
 * Uses our own bsCalendar engine for all conversion and rendering.
 *
 * Features:
 *  - MUI OutlinedInput for typing (auto-formats YYYY-MM-DD as you type)
 *  - Calendar icon opens a fully custom popup calendar
 *  - Month/year navigation with prev/next arrows
 *  - Month and year dropdowns in header
 *  - Highlights today and selected date
 *  - Respects minDate / maxDate
 *  - Controlled: value prop drives display, onChange fires on pick or valid type
 */

import React from "react";
import { createPortal } from "react-dom";
import {
  Box,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

import { bsToAD } from "../utils/bsCalendar";
import { formatDateInput } from "../utils/formatInput";
import { usePopupPosition } from "../utils/usePopupPosition";
import { isValidBSDate } from "../utils/validators";
import type { FieldSize, Language, NepaliChangePayload } from "../types";

interface BSInputProps {
  value: string; // BS "YYYY-MM-DD"
  onChange: (payload: NepaliChangePayload) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: FieldSize;
  mini?: boolean;
  format?: string; // reserved for future use
  language?: Language;
  minDate?: string; // BS "YYYY-MM-DD"
  maxDate?: string; // BS "YYYY-MM-DD"
  error?: boolean;
  inputRef?: any;
}

import { CalendarPopup } from "./CalendarPopup";

// ─── Main BSInput ─────────────────────────────────────────────────────────────

export const BSInput: React.FC<BSInputProps> = ({
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder,
  size = "small",
  mini,
  language = "en",
  minDate,
  maxDate,
  error,
  inputRef,
}) => {
  // localText is used only while the user is actively typing.
  // When not typing, we display `value` prop directly (fully controlled).
  const [localText, setLocalText] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const { pos: popupPos, computePos } = usePopupPosition();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);

  // The text shown in the input: localText while typing, value prop otherwise.
  const inputText = localText ?? value ?? "";

  const inputHeight = mini ? 28 : size === "small" ? 40 : 56;
  const fontSize = mini ? 12 : 14;

  // Close popup on outside click.
  // MUI Select renders its dropdown Menu in a portal (appended to document.body),
  // so clicking a MenuItem gives a target outside containerRef. We must not close
  // the calendar when the click is inside a MUI Menu portal — check for the
  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      // Click inside the input/trigger area — keep open
      if (containerRef.current?.contains(target)) return;
      // Click inside the calendar popup itself — keep open
      if (popupRef.current?.contains(target)) return;
      // Click inside a MUI Select/Menu portal (month or year dropdown) — keep open
      if ((target as Element).closest?.(".MuiMenu-root, .MuiPopover-root"))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const fire = (bsYear: number, bsMonth: number, bsDay: number) => {
    const bsDate = `${bsYear}-${String(bsMonth).padStart(2, "0")}-${String(
      bsDay,
    ).padStart(2, "0")}`;
    const adDate = bsToAD(bsYear, bsMonth, bsDay);
    onChange({ bsDate, adDate });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value);
    setLocalText(formatted);
    if (isValidBSDate(formatted, minDate, maxDate)) {
      const [y, m, d] = formatted.split("-").map(Number);
      fire(y, m, d);
    }
  };

  const handleBlur = () => {
    // On blur, discard local text — revert to controlled value prop.
    // If what was typed was valid, onChange already fired and value prop
    // will have been updated by the parent. Either way, stop local override.
    setLocalText(null);
  };

  const handleDaySelect = (y: number, m: number, d: number) => {
    fire(y, m, d);
    setLocalText(null); // stop any in-progress typing override
    setOpen(false);
  };

  const displayLabel = label ? (required ? `${label} *` : label) : undefined;

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
        <CalendarPopup
          selectedBS={inputText}
          language={language}
          minDate={minDate}
          maxDate={maxDate}
          onSelect={handleDaySelect}
        />
      </Box>
    )
    : null;

  return (
    <>
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
            value={inputText}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            error={error}
            inputRef={inputRef}
            placeholder={placeholder ?? "YYYY-MM-DD"}
            inputProps={{
              maxLength: 10,
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
                  edge="end"
                  disabled={disabled}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!open) computePos(containerRef.current, 294, 340);
                    setOpen((o) => !o);
                  }}
                  aria-label="Open Nepali calendar"
                >
                  <CalendarTodayIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            }
          />
        </FormControl>
      </Box>
      {createPortal(popup, document.body)}
    </>
  );
};
