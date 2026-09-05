import React from "react";
import { Controller } from "react-hook-form";
import { Box, FormControl, FormHelperText } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs, { Dayjs } from "dayjs";

import { BSInput } from "./BSInput";
import {
  resolveOutputValue,
  buildLabel,
  getUserDateTypeSetting,
} from "../utils/resolver";
import { adStrToBsStr } from "../utils/bsCalendar";
import { adStringToBsString } from "../utils/converters";
import type {
  ICSDatePicker,
  OutputValueFormat,
  NepaliChangePayload,
  FieldSize,
  Language,
} from "../types";

function getError(error: any): React.ReactNode {
  if (!error) return null;
  const msg =
    typeof error === "string" ? error : error?.message ?? "Invalid value";
  return <FormHelperText error>{msg}</FormHelperText>;
}

/**
 * Convert a stored RHF value → BS "YYYY-MM-DD" for display in BSInput.
 *   outputFmt="bs" → stored IS the BS string
 *   outputFmt="ad" → stored is ISO string → parse → convert to BS
 */
function toBSDisplay(stored: string, outputFmt: OutputValueFormat): string {
  if (!stored) return "";
  if (outputFmt === "bs") return stored;
  const d = dayjs(stored);
  if (!d.isValid()) return "";
  return adStrToBsStr(d.format("YYYY-MM-DD")); // our own engine — always correct
}

// ─── BS branch as a proper component so hooks are valid ───────────────────────

interface BSDateFieldProps {
  field: any;
  name: string;
  outputFmt: OutputValueFormat;
  onChange?: (value: any, field: any) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: FieldSize;
  mini?: boolean;
  format?: string;
  language?: Language;
  minDate?: string;
  maxDate?: string;
  error?: boolean;
  inputRef?: any;
}

const BSDateField: React.FC<BSDateFieldProps> = ({
  field,
  name,
  outputFmt,
  onChange,
  label,
  required,
  disabled,
  placeholder,
  size,
  mini,
  format,
  language,
  minDate,
  maxDate,
  error,
  inputRef,
}) => {
  // BSInput always receives a BS display string.
  // toBSDisplay uses our own engine (accurate for 2000-2099 BS).
  const bsDisplay = toBSDisplay(field.value ?? "", outputFmt);

  const handleChange = (payload: NepaliChangePayload) => {
    const resolved = resolveOutputValue(
      payload.adDate,
      payload.bsDate,
      outputFmt,
    );
    if (onChange) {
      onChange(resolved, field);
    } else {
      field.onChange({ target: { name, value: resolved } });
    }
  };

  return (
    <BSInput
      value={bsDisplay}
      onChange={handleChange}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      size={size ?? "small"}
      mini={mini}
      format={format}
      language={language}
      minDate={minDate}
      maxDate={maxDate}
      error={error}
      inputRef={inputRef}
    />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const CSDatePicker: React.FC<ICSDatePicker> = ({
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
  placeholder,
  language,
  minDate,
  maxDate,
  inputRef,
  getValue,
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
            const value = () => {
              if (!field.value) return null;
              if (getValue) getValue(field.value);
              return dayjs(field.value);
            };
            if (type === "bs") {
              return (
                <BSDateField
                  field={field}
                  name={name}
                  outputFmt={outputFmt}
                  onChange={onChange}
                  label={buildLabel(label, required)}
                  required={required}
                  disabled={disabled}
                  placeholder={placeholder}
                  size={size ?? "small"}
                  mini={mini}
                  format={format}
                  language={language}
                  minDate={minDate}
                  maxDate={maxDate}
                  error={Boolean(error ?? errors?.[name])}
                  inputRef={inputRef}
                />
              );
            }

            return (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer
                  components={["DatePicker"]}
                  sx={{ paddingTop: 0.5, overflow: "hidden" }}
                >
                  <DatePicker
                    {...field}
                    disabled={disabled}
                    inputRef={inputRef}
                    sx={{ width: "100%" }}
                    value={value()}
                    onChange={(v: Dayjs | null) => {
                      if (!v) {
                        onChange
                          ? onChange("", field)
                          : field.onChange({ name, target: { value: "" } });
                        return;
                      }
                      const adDateStr = v.format("YYYY-MM-DD");
                      const bsDateStr =
                        outputFmt === "bs" ? adStringToBsString(adDateStr) : "";
                      const resolved = resolveOutputValue(
                        adDateStr,
                        bsDateStr,
                        outputFmt,
                      );
                      onChange
                        ? onChange(resolved, field)
                        : field.onChange({ name, target: { value: resolved } });
                    }}
                    format={format ?? "YYYY-MM-DD"}
                    label={buildLabel(label, required)}
                    slotProps={{
                      textField: {
                        size: size ?? "small",
                        InputLabelProps: {
                          sx: mini
                            ? { padding: "-6px 0px", lineHeight: 0 }
                            : undefined,
                        },
                        InputProps: {
                          inputProps: {
                            sx: mini
                              ? { padding: "4px 10px", lineHeight: 0 }
                              : undefined,
                          },
                        },
                        sx: { minWidth: "auto !important", width: "100%" },
                      },
                    }}
                  />
                </DemoContainer>
              </LocalizationProvider>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};
