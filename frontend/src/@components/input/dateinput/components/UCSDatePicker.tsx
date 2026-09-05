import React from "react";
import { Box, FormHelperText } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs, { Dayjs } from "dayjs";

import { BSInput } from "./BSInput";
import { adStrToBsStr } from "../utils/bsCalendar";
import type { IUCSDatePicker, OutputValueFormat } from "../types";
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

function toBSDisplay(
  stored: string | null,
  outputFmt: OutputValueFormat,
): string {
  if (!stored) return "";
  if (outputFmt === "bs") return stored;
  const d = dayjs(stored);
  if (!d.isValid()) return "";
  return adStrToBsStr(d.format("YYYY-MM-DD"));
}

function resolveADOutput(
  adDateStr: string,
  outputFmt: OutputValueFormat,
): string {
  if (outputFmt === "bs") return adStrToBsStr(adDateStr);
  return dayjs(adDateStr).toISOString();
}

export const UCSDatePicker: React.FC<IUCSDatePicker> = ({
  inputRef,
  type,
  outputValueFormat = "ad",
  value = "",
  defaultValue,
  onChange,
  label,
  placeholder,
  format,
  disabled,
  required,
  size = "small",
  fullWidth,
  mini,
  width,
  error,
  language = "en",
  minDate,
  maxDate,
}) => {
  if (!type) {
    type = getUserDateTypeSetting();
  }
  const outputFmt: OutputValueFormat = outputValueFormat;

  // ── BS branch ─────────────────────────────────────────────────────────────
  if (type === "bs") {
    const bsDisplay = toBSDisplay(value, outputFmt);
    const handleBSChange = ({
      bsDate,
      adDate,
    }: {
      bsDate: string;
      adDate: string;
    }) => {
      onChange(outputFmt === "bs" ? bsDate : dayjs(adDate).toISOString());
    };
    return (
      <Box sx={{ width: width ?? "100%" }}>
        <BSInput
          value={bsDisplay}
          onChange={handleBSChange}
          label={getLabel(label, required)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          size={size}
          mini={mini}
          language={language}
          minDate={minDate}
          maxDate={maxDate}
          error={!!error}
          inputRef={inputRef}
        />
        {getError(error)}
      </Box>
    );
  }

  // ── AD branch ─────────────────────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer
        components={["DatePicker"]}
        sx={{ paddingTop: 1, marginTop: -1, minWidth: width ?? "auto" }}
      >
        <DatePicker
          inputRef={inputRef}
          value={value ? dayjs(value) : null}
          defaultValue={defaultValue ? dayjs(defaultValue) : undefined}
          disabled={disabled}
          onChange={(v: Dayjs | null) => {
            onChange(
              v ? resolveADOutput(v.format("YYYY-MM-DD"), outputFmt) : "",
            );
          }}
          label={getLabel(label, required)}
          format={format ?? "YYYY-MM-DD"}
          slotProps={{
            textField: {
              size,
              fullWidth: fullWidth ?? false,
              error: !!error,
              helperText: error
                ? typeof error === "string"
                  ? error
                  : error?.message
                : undefined,
              sx: { minWidth: width ?? "auto" },
            },
          }}
        />
      </DemoContainer>
    </LocalizationProvider>
  );
};
