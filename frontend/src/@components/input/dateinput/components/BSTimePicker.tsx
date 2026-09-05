/**
 * BSTimePicker
 * ─────────────────────────────────────────────────────────────────────────────
 * A compact time input for the BS DateTime picker.
 * Renders three MUI OutlinedInput fields: HH | mm | ss (optional).
 * Each field auto-advances to the next on full entry.
 */

import React from "react";
import {
  Box,
  FormControl,
  InputLabel,
  OutlinedInput,
  Typography,
  useTheme,
} from "@mui/material";
import type { FieldSize } from "../types";
import { clampTimeSegment } from "../utils/formatInput";
import { isValidTime } from "../utils/validators";

interface BSTimePickerProps {
  value: string; // "HH:mm" or "HH:mm:ss"
  onChange: (timeStr: string) => void;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  size?: FieldSize;
  mini?: boolean;
  showSeconds?: boolean;
}

export const BSTimePicker: React.FC<BSTimePickerProps> = ({
  value,
  onChange,
  label,
  disabled,
  error,
  size = "small",
  mini,
  showSeconds = false,
}) => {
  const theme = useTheme();

  const parts = value ? value.split(":") : [];
  const [hh, setHh] = React.useState(parts[0] ?? "");
  const [mm, setMm] = React.useState(parts[1] ?? "");
  const [ss, setSs] = React.useState(parts[2] ?? "");

  const mmRef = React.useRef<HTMLInputElement>(null);
  const ssRef = React.useRef<HTMLInputElement>(null);

  // Sync if parent value changes
  React.useEffect(() => {
    const p = value ? value.split(":") : [];
    setHh(p[0] ?? "");
    setMm(p[1] ?? "");
    setSs(p[2] ?? "");
  }, [value]);

  const emit = (h: string, m: string, s: string) => {
    const timeStr = showSeconds
      ? `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`
      : `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    if (isValidTime(timeStr, showSeconds)) {
      onChange(timeStr);
    }
  };

  const handleHH = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    const clamped = raw.length === 2 ? clampTimeSegment(raw, 23) : raw;
    setHh(clamped);
    if (clamped.length === 2) {
      mmRef.current?.focus();
      emit(clamped, mm, ss);
    }
  };

  const handleMM = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    const clamped = raw.length === 2 ? clampTimeSegment(raw, 59) : raw;
    setMm(clamped);
    if (clamped.length === 2) {
      if (showSeconds) ssRef.current?.focus();
      emit(hh, clamped, ss);
    }
  };

  const handleSS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    const clamped = raw.length === 2 ? clampTimeSegment(raw, 59) : raw;
    setSs(clamped);
    if (clamped.length === 2) emit(hh, mm, clamped);
  };

  const inputHeight = mini ? 28 : size === "small" ? 40 : 56;
  const fieldWidth = showSeconds ? 56 : 64;
  const fontSize = mini ? 12 : 14;

  const inputSx = {
    width: fieldWidth,
    "& input": {
      textAlign: "center" as const,
      fontSize,
      padding: mini ? "4px 6px" : size === "small" ? "8.5px 6px" : "16.5px 6px",
      height: mini ? `${inputHeight - 16}px` : undefined,
    },
  };

  const separator = (
    <Typography
      variant="body2"
      sx={{
        color: disabled
          ? theme.palette.text.disabled
          : theme.palette.text.secondary,
        fontWeight: 600,
        lineHeight: `${inputHeight}px`,
        userSelect: "none",
      }}
    >
      :
    </Typography>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {label && (
        <Typography
          variant="caption"
          sx={{
            color: error
              ? theme.palette.error.main
              : theme.palette.text.secondary,
            fontSize: mini ? 10 : 12,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <FormControl size={size} error={error}>
          <OutlinedInput
            value={hh}
            onChange={handleHH}
            disabled={disabled}
            placeholder="HH"
            inputProps={{ maxLength: 2, "aria-label": "hours" }}
            sx={inputSx}
          />
        </FormControl>

        {separator}

        <FormControl size={size} error={error}>
          <OutlinedInput
            inputRef={mmRef}
            value={mm}
            onChange={handleMM}
            disabled={disabled}
            placeholder="mm"
            inputProps={{ maxLength: 2, "aria-label": "minutes" }}
            sx={inputSx}
          />
        </FormControl>

        {showSeconds && (
          <>
            {separator}
            <FormControl size={size} error={error}>
              <OutlinedInput
                inputRef={ssRef}
                value={ss}
                onChange={handleSS}
                disabled={disabled}
                placeholder="ss"
                inputProps={{ maxLength: 2, "aria-label": "seconds" }}
                sx={inputSx}
              />
            </FormControl>
          </>
        )}
      </Box>
    </Box>
  );
};