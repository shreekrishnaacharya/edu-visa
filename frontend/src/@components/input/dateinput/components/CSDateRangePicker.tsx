/**
 * CSDateRangePicker
 * ─────────────────────────────────────────────────────────────────────────────
 * Configurable date range picker with three modes:
 *
 *  mode = "bs"    — both pickers in BS,  output BS strings
 *  mode = "ad"    — both pickers in AD,  output AD ISO strings
 *  mode = "mixed" — from=BS picker, to=AD picker (overridable via fromType/toType)
 *
 * outputValueFormat is applied to both from and to independently.
 * Defaults: mode="bs" → outputValueFormat="bs", mode="ad" → outputValueFormat="ad"
 *           mode="mixed" follows fromType/toType defaults.
 *
 * Value stored in RHF as: { from: string, to: string }
 *
 * Usage:
 *   // Both BS, output BS
 *   <CSDateRangePicker mode="bs" name="range" label="Date Range" control={control} />
 *
 *   // Both AD, output AD ISO
 *   <CSDateRangePicker mode="ad" name="range" label="Date Range" control={control} />
 *
 *   // Mixed: from=BS, to=AD; both output AD ISO
 *   <CSDateRangePicker mode="mixed" outputValueFormat="ad" name="range" label="Fiscal Range" control={control} />
 *
 *   // Mixed with explicit types
 *   <CSDateRangePicker mode="mixed" fromType="bs" toType="bs" outputValueFormat="ad" name="range" control={control} />
 */

import React from "react";
import { Controller } from "react-hook-form";
import {
  Box,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs, { Dayjs } from "dayjs";

import { BSInput } from "./BSInput";
import { resolveOutputValue, buildLabel, getUserDateTypeSetting } from "../utils/resolver";
import { adStringToBsString } from "../utils/converters";
import type {
  ICSDateRangePicker,
  DatePickerType,
  OutputValueFormat,
  NepaliChangePayload,
  DateRange,
} from "../types";

function getError(error: any): React.ReactNode {
  if (!error) return null;
  const message =
    typeof error === "string" ? error : error?.message ?? "Invalid value";
  return <FormHelperText error>{message}</FormHelperText>;
}

// ─── Single range field ───────────────────────────────────────────────────────

interface RangeFieldProps {
  type: DatePickerType;
  value: string;
  onChange: (val: string) => void;
  outputFmt: OutputValueFormat;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  size?: "small" | "medium";
  mini?: boolean;
  language?: "en" | "ne";
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
}

const RangeField: React.FC<RangeFieldProps> = ({
  type,
  value,
  onChange,
  outputFmt,
  label,
  required,
  disabled,
  error,
  size = "small",
  mini,
  language,
  minDate,
  maxDate,
  placeholder,
}) => {
  if (type === "bs") {
    const handleBSChange = (payload: NepaliChangePayload) => {
      const resolved = resolveOutputValue(
        payload.adDate,
        payload.bsDate,
        outputFmt,
      );
      onChange(resolved);
    };

    return (
      <BSInput
        value={value}
        onChange={handleBSChange}
        label={buildLabel(label, required)}
        required={required}
        disabled={disabled}
        error={error}
        size={size}
        mini={mini}
        language={language}
        minDate={minDate}
        maxDate={maxDate}
        placeholder={placeholder ?? "YYYY-MM-DD"}
      />
    );
  }

  // AD picker
  const handleADChange = (dayjsValue: Dayjs | null) => {
    if (!dayjsValue) {
      onChange("");
      return;
    }
    const adDateStr = dayjsValue.format("YYYY-MM-DD");
    const bsDateStr = outputFmt === "bs" ? adStringToBsString(adDateStr) : "";
    onChange(resolveOutputValue(adDateStr, bsDateStr, outputFmt));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer
        components={["DatePicker"]}
        sx={{ paddingTop: 0.5, overflow: "hidden" }}
      >
        <DatePicker
          disabled={disabled}
          sx={{ width: "100%" }}
          value={value ? dayjs(value) : null}
          onChange={handleADChange}
          format="YYYY-MM-DD"
          label={buildLabel(label, required)}
          minDate={minDate ? dayjs(minDate) : undefined}
          maxDate={maxDate ? dayjs(maxDate) : undefined}
          slotProps={{
            textField: {
              size,
              error,
              sx: { minWidth: "auto !important", width: "100%" },
            },
          }}
        />
      </DemoContainer>
    </LocalizationProvider>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const CSDateRangePicker: React.FC<ICSDateRangePicker> = ({
  type,
  outputValueFormat = "ad",
  control,
  errors,
  error,
  onChange,
  name,
  label,
  fromLabel,
  toLabel,
  defaultValue,
  rules,
  required,
  disabled,
  size,
  fullWidth,
  mini,
  language,
  minDate,
  maxDate,
  showSwap = true,
}) => {
  if (!type) {
    type = getUserDateTypeSetting();
  }

  // Resolve picker types from mode
  const fromType: DatePickerType = type;
  const toType: DatePickerType = type;

  // Resolve output format
  const outputFmt: OutputValueFormat = outputValueFormat;

  const hasError = Boolean(error ?? errors?.[name]);

  return (
    <Box>
      <FormControl fullWidth={fullWidth} size={size ?? "small"}>
        {label && (
          <Box sx={{ mb: 0.5 }}>
            <FormHelperText sx={{ m: 0, fontSize: 13 }}>
              {buildLabel(label, required)}
            </FormHelperText>
          </Box>
        )}

        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue ?? { from: "", to: "" }}
          rules={{
            ...rules,
            ...(required ? { required: `${label ?? name} is required` } : {}),
          }}
          render={({ field }) => {
            const rangeValue: DateRange = field.value ?? { from: "", to: "" };

            const handleFromChange = (val: string) => {
              const next: DateRange = { ...rangeValue, from: val };
              if (onChange) {
                onChange(next, field);
              } else {
                field.onChange({ target: { name, value: next } });
              }
            };

            const handleToChange = (val: string) => {
              const next: DateRange = { ...rangeValue, to: val };
              if (onChange) {
                onChange(next, field);
              } else {
                field.onChange({ target: { name, value: next } });
              }
            };

            const handleSwap = () => {
              const next: DateRange = {
                from: rangeValue.to,
                to: rangeValue.from,
              };
              if (onChange) {
                onChange(next, field);
              } else {
                field.onChange({ target: { name, value: next } });
              }
            };

            return (
              <Grid container alignItems="center" spacing={1}>
                {/* From field */}
                <Grid item xs>
                  <RangeField
                    type={fromType}
                    value={rangeValue.from}
                    onChange={handleFromChange}
                    outputFmt={outputFmt}
                    label={fromLabel ?? "From"}
                    required={required}
                    disabled={disabled}
                    error={hasError}
                    size={size ?? "small"}
                    mini={mini}
                    language={language}
                    minDate={minDate}
                    maxDate={rangeValue.to || maxDate}
                  />
                </Grid>

                {/* Swap button */}
                {showSwap && (
                  <Grid
                    item
                    sx={{ display: "flex", alignItems: "center", pt: 0.5 }}
                  >
                    <Tooltip title="Swap dates">
                      <span>
                        <IconButton
                          size="small"
                          disabled={
                            disabled || (!rangeValue.from && !rangeValue.to)
                          }
                          onClick={handleSwap}
                          aria-label="Swap from and to dates"
                        >
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                )}

                {/* To field */}
                <Grid item xs>
                  <RangeField
                    type={toType}
                    value={rangeValue.to}
                    onChange={handleToChange}
                    outputFmt={outputFmt}
                    label={toLabel ?? "To"}
                    required={required}
                    disabled={disabled}
                    error={hasError}
                    size={size ?? "small"}
                    mini={mini}
                    language={language}
                    minDate={rangeValue.from || minDate}
                    maxDate={maxDate}
                  />
                </Grid>
              </Grid>
            );
          }}
        />
        {getError(error ?? errors?.[name])}
      </FormControl>
    </Box>
  );
};
